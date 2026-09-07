import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshPhysicalMaterial, PlaneGeometry, ShaderLib } from 'three'
import { computeTileRepeat, configureTileSurface, getTileSizeMM, groutCoverage1D, measureUVSize, repairTileUVs } from './tileMaterial.js'

const near = (actual, expected, tolerance = 1e-5) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`)

test('texture orientation and real aspect determine rectangular tile dimensions', () => {
  assert.deepEqual(getTileSizeMM({ size: '600×1200mm' }, 2), [1200, 600])
  assert.deepEqual(getTileSizeMM({ size: '600 x 1200 mm' }, 0.5), [600, 1200])
  assert.deepEqual(getTileSizeMM({ size: '300x600mm' }, 4), [600, 150])
  assert.deepEqual(getTileSizeMM({}), [600, 600])
  assert.deepEqual(getTileSizeMM({ size: '0x0' }, Number.NaN), [600, 600])
})

test('repeat follows UV direction and transformed dimensions, not sorted bounds', () => {
  const parent = new Group()
  parent.scale.set(2, 3, 1)
  const mesh = new Mesh(new PlaneGeometry(1, 2))
  parent.add(mesh)
  const repeat = computeTileRepeat(mesh, { size: '500x1000mm' }, 1, 0.5)
  near(repeat.x, 4)
  near(repeat.y, 6)

  parent.rotation.set(0.4, -0.9, 0.2)
  const rotated = computeTileRepeat(mesh, { size: '500x1000mm' }, 1, 0.5)
  near(rotated.x, repeat.x)
  near(rotated.y, repeat.y)
})

test('authored UV repeats and narrow partial tiles retain physical scale', () => {
  const mesh = new Mesh(new PlaneGeometry(2.4, 0.1))
  const uv = mesh.geometry.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 2)
  const repeat = computeTileRepeat(mesh, { size: '600x600mm' })
  near(repeat.x, 2) // two authored UV repeats × two texture repeats = four tiles
  near(repeat.y, 1 / 6) // never rounded up to a full tile or clamped to 0.25
  const scaled = computeTileRepeat(mesh, { size: '600x600mm' }, 1.5)
  near(scaled.x, repeat.x * 1.5)
  near(scaled.y, repeat.y * 1.5)
})

test('UV repair clones geometry, preserves AO and gives adjacent panels continuous metre UVs', () => {
  const geometry = new PlaneGeometry(2, 1)
  geometry.setAttribute('uv1', geometry.getAttribute('uv').clone())
  const originalUV = Array.from(geometry.getAttribute('uv').array)
  const left = new Mesh(geometry)
  const right = new Mesh(geometry)
  left.position.x = -1
  right.position.x = 1
  assert.equal(repairTileUVs(left), true)
  assert.equal(repairTileUVs(right), true)
  assert.notEqual(left.geometry, geometry)
  assert.notEqual(left.geometry, right.geometry)
  assert.deepEqual(Array.from(geometry.getAttribute('uv').array), originalUV)
  assert.ok(left.geometry.getAttribute('uv1'))
  assert.equal(left.geometry.index, null)
  assert.equal(repairTileUVs(left), false)
  for (const mesh of [left, right]) {
    const positions = mesh.geometry.getAttribute('position')
    const uv = mesh.geometry.getAttribute('uv')
    for (let i = 0; i < positions.count; i++) {
      near(uv.getX(i), positions.getX(i) + mesh.position.x)
      near(uv.getY(i), positions.getY(i))
    }
    const measured = measureUVSize(mesh)
    near(measured.x, 1)
    near(measured.y, 1)
  }
})

// Decode the actual shipped asset so a future export cannot hide the original
// folded-quad defect behind an idealized synthetic plane fixture.
test('shipped bathroom folded UV quad is repaired without changing its geometry', async () => {
  const root = new URL('../../', import.meta.url)
  const decoderFile = new URL('public/draco/draco_decoder.js', root)
  const context = {
    console, process, Buffer, setTimeout, clearTimeout,
    require: createRequire(import.meta.url),
    module: { exports: {} }, exports: {},
    __dirname: fileURLToPath(new URL('public/draco', root)),
  }
  vm.runInNewContext(fs.readFileSync(decoderFile, 'utf8'), context)
  const draco = await context.module.exports()
  const glb = fs.readFileSync(new URL('public/models/model-a-bathroom.glb', root))
  const jsonLength = glb.readUInt32LE(12)
  const gltf = JSON.parse(glb.subarray(20, 20 + jsonLength).toString())
  const binary = glb.subarray(28 + jsonLength)
  const node = gltf.nodes.find(entry => entry.name === 'back_wall_lower__lower')
  const primitive = gltf.meshes[node.mesh].primitives[0]
  const extension = primitive.extensions.KHR_draco_mesh_compression
  const view = gltf.bufferViews[extension.bufferView]
  const decoder = new draco.Decoder(), buffer = new draco.DecoderBuffer(), decoded = new draco.Mesh()
  buffer.Init(new Int8Array(binary.subarray(view.byteOffset, view.byteOffset + view.byteLength)), view.byteLength)
  const status = decoder.DecodeBufferToMesh(buffer, decoded)
  assert.equal(status.ok(), true)
  const geometry = new BufferGeometry()
  for (const [key, attributeName, dimensions] of [['POSITION', 'position', 3], ['TEXCOORD_0', 'uv', 2]]) {
    const attribute = decoder.GetAttributeByUniqueId(decoded, extension.attributes[key])
    const values = new draco.DracoFloat32Array()
    decoder.GetAttributeFloatForAllPoints(decoded, attribute, values)
    geometry.setAttribute(attributeName, new Float32BufferAttribute(Array.from({ length: values.size() }, (_, i) => values.GetValue(i)), dimensions))
    draco.destroy(values)
  }
  const indices = [], face = new draco.DracoInt32Array()
  for (let i = 0; i < decoded.num_faces(); i++) {
    decoder.GetFaceFromMesh(decoded, i, face)
    indices.push(face.GetValue(0), face.GetValue(1), face.GetValue(2))
  }
  geometry.setIndex(indices)
  const bounds = geometry.computeBoundingBox() ?? geometry.boundingBox.clone()
  const mesh = new Mesh(geometry)
  repairTileUVs(mesh)
  mesh.geometry.computeBoundingBox()
  assert.ok(mesh.geometry.boundingBox.equals(bounds))
  const uv = mesh.geometry.getAttribute('uv')
  const signedAreas = []
  for (let i = 0; i < uv.count; i += 3) {
    signedAreas.push((uv.getX(i + 1) - uv.getX(i)) * (uv.getY(i + 2) - uv.getY(i)) - (uv.getX(i + 2) - uv.getX(i)) * (uv.getY(i + 1) - uv.getY(i)))
  }
  assert.ok(signedAreas.every(area => Math.sign(area) === Math.sign(signedAreas[0])))
  const measured = measureUVSize(mesh)
  near(measured.x, 1)
  near(measured.y, 1)
  const repeats = computeTileRepeat(mesh, { size: '600x1200mm' }, 1, 2)
  near(repeats.x * 2.5, 2.5 / 1.2)
  near(repeats.y * 0.85, 0.85 / 0.6)
  for (const value of [face, status, decoded, buffer, decoder]) draco.destroy(value)
})

test('degenerate or missing UVs have a finite fallback', () => {
  const mesh = new Mesh(new BufferGeometry())
  assert.equal(measureUVSize(mesh), null)
  assert.deepEqual(computeTileRepeat(mesh, {}, Number.NaN), { x: 1, y: 1 })
  assert.equal(repairTileUVs(mesh), false)
})

test('distant grout contributes its physical pixel coverage instead of a thick dark line', () => {
  near(groutCoverage1D(0, 600, 2, 40), 0.05)
  near(groutCoverage1D(0, 600, 2, 2), 1)
  near(groutCoverage1D(0, 600, 2, 0.2), 1)
  near(groutCoverage1D(300, 600, 2, 40), 0)
  near(groutCoverage1D(20, 600, 2, 40), 0.025)
  near(groutCoverage1D(-600, 600, 2, 40), 0.05)
  near(groutCoverage1D(170, 600, 2, 6000), 2 / 600)
})

test('zooming and changing tile size conserve the average grout area', () => {
  for (const tileMM of [150, 600, 1200]) {
    for (const footprintMM of [0.5, 4, 40, tileMM * 3]) {
      let coverage = 0
      const sampleCount = 12000
      for (let i = 0; i < sampleCount; i++) {
        const position = (i + 0.5) / sampleCount * tileMM - tileMM / 2
        coverage += groutCoverage1D(position, tileMM, 2, footprintMM)
      }
      near(coverage / sampleCount, 2 / tileMM, 1e-5)
    }
  }
})

test('surface shader updates one shared uniform set and keeps the original albedo', () => {
  const material = new MeshPhysicalMaterial()
  let previousHookCalls = 0
  material.onBeforeCompile = () => { previousHookCalls++ }
  configureTileSurface(material, { tileSizeMM: [1200, 600], groutColor: '#aaaaaa' })
  const shader = { uniforms: {}, fragmentShader: ShaderLib.physical.fragmentShader }
  material.onBeforeCompile(shader)
  assert.equal(previousHookCalls, 1)
  assert.ok(shader.fragmentShader.includes('#include <map_fragment>'))
  assert.ok(shader.fragmentShader.includes('material.clearcoat *= 1.0 - svtGroutMask'))
  const version = material.version
  const cacheKey = material.customProgramCacheKey()
  configureTileSurface(material, { tileSizeMM: [600, 300], groutColor: 'none' })
  assert.equal(shader.uniforms.svtSurfaceEnabled.value, 0)
  assert.deepEqual(shader.uniforms.svtTileSizeMM.value.toArray(), [600, 300])
  assert.equal(material.version, version)
  assert.equal(material.customProgramCacheKey(), cacheKey)
  configureTileSurface(material, { groutColor: 'black' })
  assert.equal(shader.uniforms.svtSurfaceEnabled.value, 1)
  assert.equal(shader.uniforms.svtGroutColor.value.getHexString(), '333333')
})
