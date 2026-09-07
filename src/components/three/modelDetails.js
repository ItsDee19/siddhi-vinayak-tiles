import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

const normalName = (name) => (name || '').toLowerCase().replace(/[\s_.]+/g, ' ').trim()

function find(root, name) {
  let match
  root.traverse((object) => { if (normalName(object.name) === normalName(name)) match = object })
  return match
}

function material(kind) {
  const options = {
    ceramic: { color: '#f8f7f3', roughness: 0.17, metalness: 0, clearcoat: 0.65, clearcoatRoughness: 0.12 },
    chrome: { color: '#dce0df', roughness: 0.19, metalness: 0.92 },
    trim: { color: '#b5aaa0', roughness: 0.35, metalness: 0.52 },
    stone: { color: '#d9d4ca', roughness: 0.64, metalness: 0 },
    reveal: { color: '#29241e', roughness: 0.82, metalness: 0 },
  }
  return new THREE.MeshPhysicalMaterial({ ...options[kind], envMapIntensity: 1 })
}

function mesh(name, geometry, finish, position = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, finish)
  object.name = name
  object.position.set(...position)
  object.castShadow = true
  object.receiveShadow = true
  // Generated parts have no matching Blender AO atlas. GLBModel must leave
  // their purpose-built geometry/materials intact when preparing the clone.
  object.userData.generated = true
  object.userData.ownedGeometry = true
  return object
}

function roundedBox(name, size, position, finish, radius = 0.004) {
  return mesh(name, new RoundedBoxGeometry(...size, 3, Math.min(radius, ...size.map((v) => v / 2))), finish, position)
}

function localBounds(root, object) {
  root.updateMatrixWorld(true)
  return new THREE.Box3().setFromObject(object).applyMatrix4(root.matrixWorld.clone().invert())
}

/** A continuous ceramic shell, including its underside, rolled lip and bowl.
 * Unlike a scaled sphere/torus, the inside has real depth and a thin rim.
 * Dimensions are outer dimensions in metres, with the base at y = 0.
 */
export function createBasinGeometry(width, depth, height, style = 'vessel') {
  const profile = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.035, 0),
    new THREE.Vector3(0.56, 0.035, 0),
    new THREE.Vector3(0.67, 0.07, 0),
    new THREE.Vector3(0.78, 0.27, 0),
    new THREE.Vector3(0.93, 0.73, 0),
    new THREE.Vector3(0.994, 0.955, 0),
    new THREE.Vector3(0.99, 0.994, 0),
    new THREE.Vector3(0.954, 0.998, 0),
    new THREE.Vector3(0.917, 0.94, 0),
    new THREE.Vector3(0.85, 0.67, 0),
    new THREE.Vector3(0.66, 0.28, 0),
    new THREE.Vector3(0.43, 0.185, 0),
    new THREE.Vector3(0, 0.18, 0),
  ], false, 'centripetal')
  const rings = profile.getPoints(56)
  const segments = 96
  const positions = []
  const uvs = []
  const indices = []
  const exponent = style === 'rect' ? 0.48 : 1
  for (let row = 0; row < rings.length; row++) {
    const point = rings[row]
    for (let col = 0; col <= segments; col++) {
      const angle = col / segments * Math.PI * 2
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      const radius = THREE.MathUtils.clamp(point.x, 0, 1)
      positions.push(
        Math.sign(cos) * Math.pow(Math.abs(cos), exponent) * width * 0.5 * radius,
        THREE.MathUtils.clamp(point.y, 0, 1) * height,
        Math.sign(sin) * Math.pow(Math.abs(sin), exponent) * depth * 0.5 * radius,
      )
      uvs.push(col / segments, row / (rings.length - 1))
      if (row < rings.length - 1 && col < segments) {
        const a = row * (segments + 1) + col
        const b = a + segments + 1
        indices.push(a, b, a + 1, a + 1, b, b + 1)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  // Average coincident seam vertices, so a polished bowl has no lighting seam.
  const normals = geometry.attributes.normal
  const average = new THREE.Vector3()
  for (let row = 0; row < rings.length; row++) {
    const a = row * (segments + 1)
    const b = a + segments
    average.fromBufferAttribute(normals, a).add(new THREE.Vector3().fromBufferAttribute(normals, b)).normalize()
    normals.setXYZ(a, average.x, average.y, average.z)
    normals.setXYZ(b, average.x, average.y, average.z)
  }
  geometry.computeBoundingBox()
  return geometry
}

function addBasin(root, { name, width, depth, height, style, position, visible = true }) {
  const shell = mesh(name, createBasinGeometry(width, depth, height, style), material('ceramic'), position)
  shell.visible = visible
  root.add(shell)
  const drain = mesh(`${name}_drain`, new THREE.CylinderGeometry(0.017, 0.017, 0.003, 32), material('chrome'),
    [position[0], position[1] + height * 0.18 + 0.0015, position[2]])
  drain.visible = visible
  root.add(drain)
  return shell
}

function faceWallsIntoRoom(root) {
  root.updateMatrixWorld(true)
  const toRoot = root.matrixWorld.clone().invert()
  const inward = { left: new THREE.Vector3(1, 0, 0), right: new THREE.Vector3(-1, 0, 0), back: new THREE.Vector3(0, 0, 1) }
  root.traverse((object) => {
    if (!object.isMesh) return
    const wall = object.name.match(/^(left|right|back)_wall_/i)?.[1].toLowerCase()
    if (!wall) return
    const source = object.geometry
    const positions = source.attributes.position
    const length = source.index ? source.index.count : positions.count
    const transform = new THREE.Matrix4().multiplyMatrices(toRoot, object.matrixWorld)
    const indices = Array.from({ length }, (_, i) => source.index ? source.index.getX(i) : i)
    const triangle = new THREE.Triangle()
    const normal = new THREE.Vector3()
    let changed = false
    for (let i = 0; i < indices.length; i += 3) {
      triangle.a.fromBufferAttribute(positions, indices[i]).applyMatrix4(transform)
      triangle.b.fromBufferAttribute(positions, indices[i + 1]).applyMatrix4(transform)
      triangle.c.fromBufferAttribute(positions, indices[i + 2]).applyMatrix4(transform)
      if (triangle.getNormal(normal).dot(inward[wall]) >= 0) continue
      ;[indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]]
      changed = true
    }
    if (changed) {
      // FrontSide culling follows triangle winding, not the normal attribute.
      // Correct a private copy so the loader's shared geometry stays intact.
      object.geometry = source.clone()
      object.geometry.setIndex(indices)
      object.geometry.computeVertexNormals()
      object.userData.ownedGeometry = true
    }
  })
}

function refineBathroom(root) {
  faceWallsIntoRoom(root)
  const sink = find(root, 'Sink')
  if (sink?.isMesh) {
    sink.geometry.computeBoundingBox()
    const box = sink.geometry.boundingBox
    const size = box.getSize(new THREE.Vector3())
    const centre = box.getCenter(new THREE.Vector3())
    // Keep the original opening and transforms, including the large-room
    // vanity scale. No original GLTF geometry or material is mutated.
    const shell = createBasinGeometry(size.x, size.z, size.y, 'rect')
    shell.translate(centre.x, box.min.y, centre.z)
    sink.geometry = shell
    sink.material = material('ceramic')
    sink.userData.generated = true
    sink.userData.ownedGeometry = true
    const drain = mesh('sink_drain', new THREE.CylinderGeometry(0.014, 0.014, 0.003, 32), material('chrome'),
      [centre.x, box.min.y + size.y * 0.18 + 0.002, centre.z])
    sink.add(drain)
  }

  const cabinet = find(root, 'Under sink cabinet base')
  if (cabinet) {
    const box = localBounds(root, cabinet)
    const centre = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const reveal = material('reveal')
    const trim = material('trim')
    // Small shadow gaps and recessed pull lips articulate the existing front.
    for (const fraction of [0.49, 0.96]) {
      root.add(roundedBox(`cabinet_drawer_reveal_${fraction}`, [size.x - 0.024, 0.006, 0.004],
        [centre.x, box.min.y + size.y * fraction, box.max.z + 0.003], reveal, 0.001))
      root.add(roundedBox(`cabinet_pull_${fraction}`, [Math.min(size.x * 0.3, 0.28), 0.008, 0.018],
        [centre.x, box.min.y + size.y * fraction - 0.011, box.max.z + 0.009], trim, 0.003))
    }
  }

  const floor = find(root, 'floor__floor')
  if (floor) {
    const box = localBounds(root, floor)
    const size = box.getSize(new THREE.Vector3())
    const centre = box.getCenter(new THREE.Vector3())
    root.add(roundedBox('room_floor_slab', [size.x + 0.035, 0.065, size.z + 0.035],
      [centre.x, box.min.y - 0.034, centre.z], material('stone'), 0.008))
  }

  // Preserve the export's detailed toilet and shower; annotate real Blender
  // names rather than relying on names from an older, different GLB export.
  root.traverse((object) => {
    const name = normalName(object.name)
    if (/toilet|flush/.test(name)) object.traverse((part) => { if (part.isMesh) part.userData.fixture = 'wc' })
    if (/shower/.test(name)) object.traverse((part) => { if (part.isMesh) part.userData.fixture = 'shower' })
  })
}

function refineVanity(root) {
  const oldBasin = find(root, 'basin_vessel_main')
  if (!oldBasin) return
  const box = localBounds(root, oldBasin)
  const centre = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  oldBasin.removeFromParent()

  const styles = [
    { style: 'rect', width: size.x, depth: size.z, height: size.y * 0.88 },
    { style: 'round', width: size.z, depth: size.z, height: size.y * 0.8 },
    { style: 'vessel', width: size.x * 0.92, depth: size.z, height: size.y },
  ]
  for (const style of styles) {
    addBasin(root, { ...style, name: `basin_${style.style}_refined`,
      position: [centre.x, box.min.y, centre.z], visible: style.style === 'rect' })
  }

  // The imported tap contains loose duplicates behind the wall. Replace its
  // complete assembly with a single continuous, rounded swan-neck mixer.
  const oldFaucets = []
  root.traverse((object) => { if (normalName(object.name).startsWith('faucet')) oldFaucets.push(object) })
  oldFaucets.forEach((object) => object.removeFromParent())
  const chrome = material('chrome')
  const baseY = box.min.y + 0.001
  const backZ = box.min.z - 0.035
  const neckTop = baseY + size.y + 0.105
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(centre.x, baseY + 0.013, backZ),
    new THREE.Vector3(centre.x, neckTop - 0.055, backZ),
    new THREE.Vector3(centre.x, neckTop, backZ + 0.035),
    new THREE.Vector3(centre.x, neckTop, centre.z - size.z * 0.12),
    new THREE.Vector3(centre.x, neckTop - 0.043, centre.z - size.z * 0.06),
  ], false, 'centripetal')
  root.add(mesh('faucet_refined_neck', new THREE.TubeGeometry(path, 56, 0.012, 16, false), chrome))
  root.add(mesh('faucet_refined_base', new THREE.CylinderGeometry(0.022, 0.025, 0.012, 32), chrome,
    [centre.x, baseY + 0.006, backZ]))
  root.add(roundedBox('faucet_refined_handle', [0.012, 0.048, 0.035],
    [centre.x + 0.031, baseY + 0.102, backZ], chrome, 0.005))
  root.add(mesh('faucet_refined_aerator', new THREE.CylinderGeometry(0.0095, 0.0095, 0.003, 24), material('reveal'),
    [centre.x, neckTop - 0.044, centre.z - size.z * 0.06]))
}

// Clip complete triangles (and their interpolated UVs/normals) at layout
// boundaries. Filtering by triangle centres would leave gaps at band edges.
export function sliceGeometry(source, limits) {
  const attributes = Object.entries(source.attributes)
  const output = Object.fromEntries(attributes.map(([name]) => [name, []]))
  const positions = source.attributes.position
  const count = source.index ? source.index.count : positions.count
  const readVertex = (index) => Object.fromEntries(attributes.map(([name, attribute]) => [name,
    Array.from({ length: attribute.itemSize }, (_, component) => attribute.getComponent(index, component)),
  ]))
  for (let i = 0; i < count; i += 3) {
    let polygon = [0, 1, 2].map((offset) => readVertex(source.index ? source.index.getX(i + offset) : i + offset))
    for (const { axis, value, keepAbove } of limits) {
      const clipped = []
      for (let j = 0; j < polygon.length; j++) {
        const from = polygon[j]
        const to = polygon[(j + 1) % polygon.length]
        const a = from.position[axis] - value
        const b = to.position[axis] - value
        const insideA = keepAbove ? a >= 0 : a <= 0
        const insideB = keepAbove ? b >= 0 : b <= 0
        if (insideA) clipped.push(from)
        if (insideA !== insideB) {
          const t = a / (a - b)
          clipped.push(Object.fromEntries(attributes.map(([name]) => [name,
            from[name].map((v, k) => THREE.MathUtils.lerp(v, to[name][k], t)),
          ])))
        }
      }
      polygon = clipped
      if (polygon.length < 3) break
    }
    for (let j = 1; j < polygon.length - 1; j++) {
      for (const vertex of [polygon[0], polygon[j], polygon[j + 1]]) {
        for (const [name] of attributes) output[name].push(...vertex[name])
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  for (const [name, attribute] of attributes) {
    geometry.setAttribute(name, new THREE.Float32BufferAttribute(output[name], attribute.itemSize))
  }
  if (geometry.attributes.normal) geometry.normalizeNormals()
  geometry.computeBoundingBox()
  return geometry
}

function refineFeatureWall(root) {
  const wall = find(root, 'feature_wall__full')
  if (!wall?.isMesh) return
  const backdrop = find(root, 'Plane')
  // A 109-metre modelling backdrop is unnecessary with the showroom stage.
  if (backdrop) { backdrop.visible = false; backdrop.userData.structuralHidden = true }
  wall.geometry.computeBoundingBox()
  const { min, max } = wall.geometry.boundingBox
  const midY = (min.y + max.y) / 2
  wall.name = 'wall_full_refined__full'
  const addSection = (name, limits) => {
    const section = wall.clone(false)
    section.name = name
    section.geometry = sliceGeometry(wall.geometry, limits)
    section.material = wall.material.clone()
    section.visible = false
    section.userData.generated = true
    section.userData.ownedGeometry = true
    wall.parent.add(section)
  }
  addSection('wall_bands_lower__lowerBand', [{ axis: 1, value: midY, keepAbove: false }])
  addSection('wall_bands_upper__upperBand', [{ axis: 1, value: midY, keepAbove: true }])
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const left = THREE.MathUtils.lerp(min.x, max.x, col / 3)
      const right = THREE.MathUtils.lerp(min.x, max.x, (col + 1) / 3)
      addSection(`wall_grid_${row}_${col}__full`, [
        { axis: 0, value: left + (col > 0 ? 0.003 : 0), keepAbove: true },
        { axis: 0, value: right - (col < 2 ? 0.003 : 0), keepAbove: false },
        { axis: 1, value: midY + (row === 1 ? 0.003 : -0.003), keepAbove: row === 1 },
      ])
    }
  }
}

function refineStaircase(root) {
  const risers = find(root, 'stair_risers__riser')
  if (!risers?.isMesh) return
  const geometry = risers.geometry
  const positions = geometry.attributes.position
  const count = geometry.index ? geometry.index.count : positions.count
  const edges = new Map()
  const point = (index) => new THREE.Vector3().fromBufferAttribute(positions, geometry.index ? geometry.index.getX(index) : index)
  const key = (v) => [v.x, v.y, v.z].map((value) => Math.round(value * 10000)).join(',')
  for (let i = 0; i < count; i += 3) {
    const vertices = [point(i), point(i + 1), point(i + 2)]
    const minY = Math.min(...vertices.map((v) => v.y))
    const maxY = Math.max(...vertices.map((v) => v.y))
    const rise = maxY - minY
    if (rise < 0.1 || rise > 0.24) continue
    const top = vertices.filter((v) => Math.abs(v.y - maxY) < 0.001)
    if (top.length !== 2 || top[0].distanceTo(top[1]) < 0.35) continue
    edges.set(top.map(key).sort().join('|'), top)
  }
  const trim = material('trim')
  let index = 0
  for (const [a, b] of edges.values()) {
    const delta = b.clone().sub(a)
    const centre = a.clone().lerp(b, 0.5)
    const edge = roundedBox(`stair_nosing_${index++}`, [delta.length(), 0.007, 0.026],
      [centre.x, centre.y - 0.001, centre.z], trim, 0.003)
    edge.rotation.y = -Math.atan2(delta.z, delta.x)
    edge.userData.fixture = 'nosing'
    // Risers are authored in scene coordinates today, but inherit transforms
    // from the source so future exports can translate/rotate the staircase.
    const holder = new THREE.Group()
    holder.position.copy(risers.position)
    holder.quaternion.copy(risers.quaternion)
    holder.scale.copy(risers.scale)
    holder.add(edge)
    risers.parent.add(holder)
  }
}

/** Apply once to an instance clone after structural edits, before materials
 * and fixture visibility are prepared. Tile-zone meshes are never replaced.
 */
export function applyModelDetails(root, glbUrl) {
  if (root.userData.modelDetailsApplied) return root
  root.userData.modelDetailsApplied = true
  if (/bathroom/i.test(glbUrl)) refineBathroom(root)
  if (/vanity/i.test(glbUrl)) refineVanity(root)
  if (/feature-wall/i.test(glbUrl)) refineFeatureWall(root)
  if (/staircase/i.test(glbUrl)) refineStaircase(root)
  return root
}

/** Dispose only generated geometry; GLBModel owns the cloned materials.
 * Cached GLTF geometry must survive switching between room tabs.
 */
export function disposeModelDetails(root) {
  const geometries = new Set()
  root.traverse((object) => {
    if (object.isMesh && object.userData.ownedGeometry && object.geometry) geometries.add(object.geometry)
  })
  geometries.forEach((geometry) => geometry.dispose())
}
