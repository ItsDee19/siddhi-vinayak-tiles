import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import test from 'node:test'
import * as THREE from 'three'
import { applyModelDetails, createBasinGeometry, disposeModelDetails } from '../src/components/three/modelDetails.js'
import { applyStructuralEdits } from '../src/components/three/sceneEdits.js'

// These fixtures exercise the retained legacy GLB helpers. The current room
// registry uses native scene factories, so its entries no longer have GLB URLs.
const legacyBathrooms = [
  { glbUrl: '/models/model-a-bathroom.glb' },
  {
    glbUrl: '/models/model-b-bathroom-lg.glb',
    sceneEdits: {
      hide: ['Glass frame 1', 'Glass in frame 1', 'Glass frame 2', 'Glass in frame 2'],
      grow: {
        nodes: ['Mirror base', 'Mirror', 'tap', 'Tap handles', 'Sink', 'Under sink cabinet base', 'Top of cabinet under sink'],
        pivot: [-1.2516, 0, -1],
        scale: 1.28,
      },
      jets: {
        host: 'Bath', count: 8, inset: 0.075, belowRim: 0.13,
        nozzleRadius: 0.035, nozzleDepth: 0.012,
        material: { color: '#dfe6ea', metalness: 0.7, roughness: 0.12, envMapIntensity: 1.3 },
      },
    },
  },
]

// Reconstruct the authored hierarchy and bounds from the actual GLB manifest.
// Structural fitting uses these bounds, so it can be verified without WebGL
// or Draco workers; the renderer still loads the full compressed geometry.
function modelBoundsScene(url) {
  const buffer = readFileSync(new URL(`../public${url}`, import.meta.url))
  const gltf = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)))
  const nodes = gltf.nodes.map((node) => {
    const object = new THREE.Group()
    const primitives = node.mesh === undefined ? [] : gltf.meshes[node.mesh].primitives
    const meshes = primitives.map((primitive) => {
      const { min, max } = gltf.accessors[primitive.attributes.POSITION]
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([...min, ...max], 3))
      geometry.computeBoundingBox()
      return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial())
    })
    const result = meshes.length === 1 ? meshes[0] : object
    if (meshes.length > 1) meshes.forEach((mesh, i) => {
      mesh.name = `${THREE.PropertyBinding.sanitizeNodeName(node.name)}_${i}`
      object.add(mesh)
    })
    result.name = THREE.PropertyBinding.sanitizeNodeName(node.name)
    if (node.translation) result.position.fromArray(node.translation)
    if (node.rotation) result.quaternion.fromArray(node.rotation)
    if (node.scale) result.scale.fromArray(node.scale)
    return result
  })
  gltf.nodes.forEach((node, i) => node.children?.forEach((child) => nodes[i].add(nodes[child])))
  const root = new THREE.Group()
  gltf.scenes[gltf.scene || 0].nodes.forEach((node) => root.add(nodes[node]))
  return root
}

async function modelDecodedScene(url) {
  const context = { require: createRequire(import.meta.url), process, console,
    __dirname: new URL('../public/draco', import.meta.url).pathname }
  vm.runInNewContext(readFileSync(new URL('../public/draco/draco_decoder.js', import.meta.url), 'utf8'), context)
  const draco = await context.DracoDecoderModule()
  const buffer = readFileSync(new URL(`../public${url}`, import.meta.url))
  const jsonLength = buffer.readUInt32LE(12)
  const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength))
  const root = modelBoundsScene(url)
  for (const node of gltf.nodes) {
    if (node.mesh === undefined) continue
    const primitives = gltf.meshes[node.mesh].primitives
    for (let p = 0; p < primitives.length; p++) {
      const primitive = primitives[p]
      const extension = primitive.extensions.KHR_draco_mesh_compression
      const view = gltf.bufferViews[extension.bufferView]
      const bytes = buffer.subarray(28 + jsonLength + view.byteOffset, 28 + jsonLength + view.byteOffset + view.byteLength)
      const input = new draco.DecoderBuffer()
      input.Init(bytes, bytes.length)
      const decoder = new draco.Decoder()
      const decoded = new draco.Mesh()
      const status = decoder.DecodeBufferToMesh(input, decoded)
      assert.ok(status.ok())
      const geometry = new THREE.BufferGeometry()
      for (const [name, attributeId] of Object.entries(extension.attributes)) {
        const attribute = decoder.GetAttributeByUniqueId(decoded, attributeId)
        const values = new draco.DracoFloat32Array()
        decoder.GetAttributeFloatForAllPoints(decoded, attribute, values)
        const itemSize = attribute.num_components()
        const array = Float32Array.from({ length: decoded.num_points() * itemSize }, (_, i) => values.GetValue(i))
        const key = { POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv', TEXCOORD_1: 'uv1' }[name]
        if (key) geometry.setAttribute(key, new THREE.BufferAttribute(array, itemSize))
        draco.destroy(values)
      }
      const face = new draco.DracoInt32Array()
      const indices = []
      for (let i = 0; i < decoded.num_faces(); i++) {
        decoder.GetFaceFromMesh(decoded, i, face)
        indices.push(face.GetValue(0), face.GetValue(1), face.GetValue(2))
      }
      geometry.setIndex(indices)
      const object = root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(node.name))
      const mesh = primitives.length === 1 ? object : object.children[p]
      mesh.geometry = geometry
      for (const value of [face, decoded, input, decoder]) draco.destroy(value)
    }
  }
  return root
}

function area(geometry) {
  let result = 0
  const position = geometry.attributes.position
  const length = geometry.index ? geometry.index.count : position.count
  const get = (i) => new THREE.Vector3().fromBufferAttribute(position, geometry.index ? geometry.index.getX(i) : i)
  for (let i = 0; i < length; i += 3) result += new THREE.Triangle(get(i), get(i + 1), get(i + 2)).getArea()
  return result
}

test('basins have a smooth, upward-facing inner bowl and a closed underside', () => {
  for (const style of ['rect', 'round', 'vessel']) {
    const geometry = createBasinGeometry(0.6, 0.42, 0.155, style)
    const positions = geometry.attributes.position
    const normals = geometry.attributes.normal
    for (let i = 0; i < normals.count; i++) {
      const length = Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i))
      assert.ok(Number.isFinite(length) && Math.abs(length - 1) < 0.001)
      assert.ok(positions.getY(i) >= 0 && positions.getY(i) <= 0.156)
    }
    assert.ok(normals.getY(0) < -0.9, 'underside faces down')
    assert.ok(normals.getY(normals.count - 1) > 0.9, 'bowl floor faces up')
    const size = geometry.boundingBox.getSize(new THREE.Vector3())
    assert.ok(size.x > 0.59 && size.x <= 0.6)
    assert.ok(size.z > 0.41 && size.z <= 0.42)
    geometry.dispose()
  }
})

test('both bathroom exports preserve tile geometry and fit details after structural scaling', () => {
  for (const model of legacyBathrooms) {
    const cached = modelBoundsScene(model.glbUrl)
    const originalSink = cached.getObjectByName('Sink').geometry
    const instance = applyStructuralEdits(cached.clone(true), model.sceneEdits)
    const zones = new Map()
    instance.traverse((object) => { if (object.name.includes('__')) zones.set(object.name, object.geometry) })
    applyModelDetails(instance, model.glbUrl)
    assert.equal(cached.getObjectByName('Sink').geometry, originalSink)
    assert.notEqual(instance.getObjectByName('Sink').geometry, originalSink)
    for (const [name, geometry] of zones) assert.equal(instance.getObjectByName(name).geometry, geometry)
    assert.equal(instance.getObjectByName('NurbsPath').userData.fixture, 'shower')
    assert.equal(instance.getObjectByName('Toilet_base').children[0].userData.fixture, 'wc')
    assert.ok(instance.getObjectByName('room_floor_slab'))
    const meshCount = instance.children.length
    applyModelDetails(instance, model.glbUrl)
    assert.equal(instance.children.length, meshCount, 'second call cannot duplicate fixtures')
    let originalDisposed = false
    originalSink.addEventListener('dispose', () => { originalDisposed = true })
    let detailDisposed = false
    instance.getObjectByName('Sink').geometry.addEventListener('dispose', () => { detailDisposed = true })
    disposeModelDetails(instance)
    assert.equal(originalDisposed, false)
    assert.equal(detailDisposed, true)
  }
})

test('vanity supplies every selectable basin and replaces orphaned faucet pieces', () => {
  const url = '/models/model-e-vanity.glb'
  const root = applyModelDetails(modelBoundsScene(url), url)
  assert.equal(root.getObjectByName('basin_vessel_main'), undefined)
  assert.equal(root.getObjectByName('faucet_Plane010'), undefined)
  for (const style of ['rect', 'round', 'vessel']) {
    const basin = root.getObjectByName(`basin_${style}_refined`)
    const drain = root.getObjectByName(`basin_${style}_refined_drain`)
    assert.ok(basin?.userData.ownedGeometry)
    assert.ok(drain?.userData.ownedGeometry)
    assert.equal(basin.visible, style === 'rect')
    assert.equal(drain.visible, basin.visible)
  }
  assert.ok(root.getObjectByName('faucet_refined_neck'))
  assert.ok(root.getObjectByName('vanity_backwall__backWall'))
})

test('feature-wall bands cover the actual compressed mesh without holes or lost UVs', async () => {
  const url = '/models/model-d-feature-wall.glb'
  const root = await modelDecodedScene(url)
  const original = root.getObjectByName('feature_wall__full').geometry
  const sourceArea = area(original)
  applyModelDetails(root, url)
  const lower = root.getObjectByName('wall_bands_lower__lowerBand')
  const upper = root.getObjectByName('wall_bands_upper__upperBand')
  assert.ok(Math.abs(area(lower.geometry) + area(upper.geometry) - sourceArea) < 0.0001)
  assert.ok(lower.geometry.attributes.uv.count > 0)
  assert.ok(upper.geometry.attributes.uv.count > 0)
  assert.equal(root.getObjectByName('Plane').visible, false)
  for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) {
    const section = root.getObjectByName(`wall_grid_${row}_${col}__full`)
    assert.ok(section.geometry.attributes.position.count > 0)
    assert.equal(section.visible, false)
  }
})

test('stair nosing follows actual riser tops and leaves tile geometry untouched', async (t) => {
  const url = '/models/model-c-staircase.glb'
  const root = await modelDecodedScene(url)
  const source = root.getObjectByName('stair_risers__riser').geometry
  applyModelDetails(root, url)
  const edges = []
  root.traverse((object) => { if (object.userData.fixture === 'nosing') edges.push(object) })
  t.diagnostic(`Created ${edges.length} nosing strips from the compressed staircase mesh.`)
  assert.ok(edges.length >= 16 && edges.length <= 24, `expected one nosing per tread, found ${edges.length}`)
  assert.equal(root.getObjectByName('stair_risers__riser').geometry, source)
  for (const edge of edges) {
    assert.ok(edge.userData.ownedGeometry)
    assert.ok(edge.position.y > 0 && edge.position.y < 3.7)
  }
})

test('bathroom wall triangles face inward and the outside right wall is culled', async () => {
  const url = '/models/model-a-bathroom.glb'
  const cached = await modelDecodedScene(url)
  const sourceWall = cached.getObjectByName('right_wall_lower__lower').geometry
  const sourceIndex = [...sourceWall.index.array]
  const root = applyModelDetails(cached.clone(true), url)
  assert.notEqual(root.getObjectByName('right_wall_lower__lower').geometry, sourceWall, 'outward export needs its own corrected copy')
  const directions = { left: new THREE.Vector3(1, 0, 0), right: new THREE.Vector3(-1, 0, 0), back: new THREE.Vector3(0, 0, 1) }
  const walls = []
  root.traverse((object) => {
    const side = object.name.match(/^(left|right|back)_wall_/i)?.[1]
    if (!side) return
    walls.push(object)
    object.material = new THREE.MeshStandardMaterial({ side: THREE.FrontSide })
    const positions = object.geometry.attributes.position
    const indices = object.geometry.index
    for (let i = 0; i < indices.count; i += 3) {
      const vertices = [0, 1, 2].map((offset) => new THREE.Vector3().fromBufferAttribute(positions, indices.getX(i + offset)))
      const normal = new THREE.Triangle(...vertices).getNormal(new THREE.Vector3())
      assert.ok(normal.dot(directions[side]) > 0.99, `${object.name} must face inside the room`)
    }
    const normals = object.geometry.attributes.normal
    for (let i = 0; i < normals.count; i++) {
      assert.ok(new THREE.Vector3().fromBufferAttribute(normals, i).dot(directions[side]) > 0.99)
    }
  })
  assert.equal(walls.length, 9)
  assert.deepEqual([...sourceWall.index.array], sourceIndex, 'cached triangles are unchanged')
  root.updateMatrixWorld(true)
  const ray = new THREE.Raycaster(new THREE.Vector3(3, 0.6, 0), new THREE.Vector3(-1, 0, 0))
  const right = root.getObjectByName('right_wall_lower__lower')
  const left = root.getObjectByName('left_wall_lower__lower')
  assert.equal(ray.intersectObject(right).length, 0, 'outside right face should reveal the room')
  assert.ok(ray.intersectObject(left).length > 0, 'inside opposite wall stays visible')
})
