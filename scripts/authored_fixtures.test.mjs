import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createHash } from 'node:crypto'
import { Box3, Raycaster, Vector3 } from 'three'
import { roomFactories } from '../src/components/three/rooms/index.js'
import { models } from '../src/components/three/models/registry.js'
import { applyAuthoredFixtures } from '../src/components/three/rooms/authoredFixtures.js'
import { prepareRoom } from '../src/components/three/rooms/prepareRoom.js'
import { disposeRoom } from '../src/components/three/rooms/roomKit.js'
import { loadFixtureAsset } from './helpers/load_fixture_asset.mjs'

let asset, originalCacheGeometry
before(async () => {
  asset = await loadFixtureAsset()
  originalCacheGeometry = meshes(asset.scene).map(mesh => ({
    geometry: mesh.geometry, digest: geometryDigest(mesh.geometry), bounds: mesh.geometry.boundingBox,
  }))
})
after(() => { if (asset) disposeRoom(asset.scene) })

function meshes(root) {
  const result = []
  root.traverse(object => { if (object.isMesh) result.push(object) })
  return result
}

function resources(root) {
  const result = new Set()
  for (const object of meshes(root)) {
    if (object.isInstancedMesh) result.add(object)
    result.add(object.geometry)
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      result.add(material)
      for (const value of Object.values(material)) if (value?.isTexture) result.add(value)
    }
  }
  return result
}

function watchDisposals(resources) {
  return new Map([...resources].map(resource => {
    const record = { count: 0 }
    resource.addEventListener('dispose', () => { record.count++ })
    return [resource, record]
  }))
}

function close(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} instead of ${expected}`)
}

function downHit(shell, xFraction = 0, zFraction = 0) {
  const bounds = new Box3().setFromObject(shell)
  const size = bounds.getSize(new Vector3())
  const centre = bounds.getCenter(new Vector3())
  return new Raycaster(
    new Vector3(centre.x + size.x * xFraction, bounds.max.y + 0.1, centre.z + size.z * zFraction),
    new Vector3(0, -1, 0),
  ).intersectObject(shell, false)[0]
}

function geometryDigest(geometry) {
  const hash = createHash('sha256')
  for (const attribute of [geometry.index, ...Object.values(geometry.attributes)]) {
    if (attribute) hash.update(new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength))
  }
  return hash.digest('hex')
}

test('the shipped Draco asset contains metre-scale baked fixture geometry and no tile textures', () => {
  const expected = {
    basin_compact: [0.45, 0.12, 0.31], basin_spa: [0.46, 0.13, 0.34],
    basin_vanity: [0.555, 0.12, 0.37], bath_soaking: [1.55, 0.57, 0.70],
    towel_drape: [0.25, 0.37, 0.03], towel_folded: [0.29, 0.027, 0.21],
    bench_cushion: [0.53, 0.035, 0.35],
  }
  assert.ok(asset.parser.json.extensionsRequired.includes('KHR_draco_mesh_compression'))
  assert.ok(asset.byteLength < 512 * 1024, 'fixed fixture download exceeded its 512 KB budget')
  assert.equal(asset.parser.json.images?.length || 0, 0, 'room-owned finishes should not require embedded texture images')
  assert.deepEqual(meshes(asset.scene).map(mesh => mesh.name).sort(), [...Object.keys(expected), 'olive_foliage', 'olive_branches'].sort())
  for (const source of meshes(asset.scene)) {
    assert.ok(source.position.length() < 1e-6, `${source.name}: unbaked location`)
    assert.ok(source.quaternion.angleTo(source.quaternion.clone().identity()) < 1e-6, `${source.name}: unbaked rotation`)
    assert.ok(source.scale.distanceTo(new Vector3(1, 1, 1)) < 1e-6, `${source.name}: unbaked scale`)
    const { position, normal, uv } = source.geometry.attributes
    assert.ok(position.count > 100, `${source.name}: missing authored surface detail`)
    assert.equal(normal?.count, position.count, `${source.name}: missing surface normals`)
    assert.equal(uv?.count, position.count, `${source.name}: missing UVs for the retained room finish`)
    for (const value of position.array) assert.ok(Number.isFinite(value), `${source.name}: invalid position`)
    for (const index of source.geometry.index.array) assert.ok(index < position.count, `${source.name}: invalid triangle index`)
    if (expected[source.name]) {
      const size = new Box3().setFromObject(source).getSize(new Vector3()).toArray()
      // Cloth includes a relaxed saddle/puff; the live integration fits its
      // outer envelope to the existing rail, counter and bench supports.
      const tolerance = source.name === 'towel_drape' ? 0.015 : source.name === 'bench_cushion' ? 0.005 : 0.003
      size.forEach((value, index) => close(value, expected[source.name][index], tolerance, `${source.name} axis ${index}`))
    }
  }
  const treeBounds = new Box3().setFromObject(asset.scene.getObjectByName('olive_foliage'))
  assert.ok(treeBounds.max.y >= 1.5 && treeBounds.max.y <= 1.85, 'olive foliage must retain human-scale height')
  assert.ok(treeBounds.min.y >= 0.34, 'foliage must not extend below the soil')
})

test('decoded basins and soaking bath have visible inner bowls, raised rims and closed undersides', () => {
  for (const name of ['basin_compact', 'basin_spa', 'basin_vanity', 'bath_soaking']) {
    const shell = asset.scene.getObjectByName(name)
    const bounds = new Box3().setFromObject(shell)
    const size = bounds.getSize(new Vector3())
    const centre = bounds.getCenter(new Vector3())
    const bowl = downHit(shell)
    const rim = downHit(shell, 0.46)
    assert.ok(bowl && rim, `${name}: inner floor or rolled rim is missing`)
    assert.ok(bounds.max.y - bowl.point.y > size.y * 0.6, `${name}: bowl is too shallow or capped`)
    assert.ok(rim.point.y - bowl.point.y > size.y * 0.3, `${name}: rim does not rise above the bowl`)
    const underside = new Raycaster(new Vector3(centre.x, bounds.min.y - 0.1, centre.z), new Vector3(0, 1, 0)).intersectObject(shell, false)[0]
    assert.ok(underside, `${name}: open underside`)
    assert.ok(bowl.point.y - underside.point.y > 0.002, `${name}: ceramic floor has no thickness`)
  }
})

const EXPECTED_REPLACEMENTS = {
  'bathroom-s': ['ceramic_vessel_basin', 'folded_hand_towel'],
  'bathroom-l': ['spa_basin_-1', 'spa_basin_1', 'spa_freestanding_soaking_tub'],
  stairs: [],
  'feature-wall': ['feature_bench_linen_pad', 'feature_olive_foliage', 'feature_olive_branches'],
  vanity: ['vanity_vessel_basin_left', 'vanity_vessel_basin_right', 'vanity_folded_towel_0', 'vanity_folded_towel_1', 'vanity_folded_towel_2'],
}

for (const model of models) {
  test(`${model.id}: live fixture injection preserves editable tile geometry, fixture placement and ownership`, t => {
    const root = roomFactories[model.id]()
    t.after(() => disposeRoom(root))
    root.updateMatrixWorld(true)
    const before = new Map(meshes(root).map(mesh => [mesh.name, {
      mesh, geometry: mesh.geometry, material: mesh.material,
      bounds: new Box3().setFromObject(mesh), matrix: mesh.matrix.clone(), zone: mesh.userData.zoneId,
    }]))
    applyAuthoredFixtures(root, asset.scene)
    const triangles = meshes(root).reduce((count, mesh) => count + (mesh.geometry.index?.count || mesh.geometry.attributes.position.count) / 3 * (mesh.isInstancedMesh ? mesh.count : 1), 0)
    assert.ok(triangles < 120000, `${model.id}: authored fixtures exceeded the room's 120k triangle budget`)
    t.diagnostic(`${model.id}: ${triangles.toLocaleString('en-IN')} triangles with Blender fixtures`)
    assert.deepEqual(meshes(root).filter(mesh => mesh.userData.authoredFixture).map(mesh => mesh.name).sort(), [...EXPECTED_REPLACEMENTS[model.id]].sort())
    for (const [name, original] of before) {
      const current = root.getObjectByName(name)
      if (original.zone) {
        assert.equal(current, original.mesh, `${name}: tile mesh replaced`)
        assert.equal(current.geometry, original.geometry, `${name}: tile geometry changed`)
        assert.equal(current.material, original.material, `${name}: tile material changed`)
        assert.ok(current.matrix.equals(original.matrix), `${name}: tile transform changed`)
      }
      if (!current?.userData.authoredFixture) continue
      assert.equal(current, original.mesh, `${name}: fixture identity changed`)
      assert.equal(current.material, original.material, `${name}: room finish was replaced by an asset material`)
      assert.ok(current.matrix.equals(original.matrix), `${name}: fixture transform changed`)
      const bounds = new Box3().setFromObject(current)
      assert.ok(bounds.min.distanceTo(original.bounds.min) < 0.00005 && bounds.max.distanceTo(original.bounds.max) < 0.00005, `${name}: outer footprint or contact height changed`)
      assert.notEqual(current.geometry, original.geometry, `${name}: generated fixture geometry still in use`)
      assert.notEqual(current.geometry, asset.scene.getObjectByName(current.userData.authoredFixture).geometry, `${name}: cached geometry is not owned by the room`)
      assert.equal(current.userData.zoneId, undefined, `${name}: fixed furnishing became selectable`)
    }
    const { zoneMeshes } = prepareRoom(root, model.zones)
    assert.deepEqual(Object.keys(zoneMeshes).sort(), model.zones.map(zone => zone.id).sort())
    assert.ok(Object.values(zoneMeshes).flat().every(mesh => !mesh.userData.authoredFixture))
    // Re-applying must not duplicate the tree or dispose a live clone.
    const injected = meshes(root).filter(mesh => mesh.userData.authoredFixture)
    const geometries = injected.map(mesh => mesh.geometry)
    applyAuthoredFixtures(root, asset.scene)
    assert.deepEqual(injected.map(mesh => mesh.geometry), geometries)
    assert.equal(meshes(root).filter(mesh => mesh.userData.authoredFixture).length, injected.length)
  })
}

test('live waste discs follow each new bowl floor and furnishings retain contact with their supports', t => {
  const fixtures = [
    ['bathroom-s', 'ceramic_vessel_basin', 'basin_pop_up_waste', 'vanity_quartz_counter'],
    ['bathroom-l', 'spa_basin_-1', 'spa_basin_waste_-1', 'spa_vanity_stone_counter'],
    ['bathroom-l', 'spa_basin_1', 'spa_basin_waste_1', 'spa_vanity_stone_counter'],
    ['bathroom-l', 'spa_freestanding_soaking_tub', 'spa_tub_waste', 'bathroom_floor'],
    ['vanity', 'vanity_vessel_basin_left', 'vanity_basin_waste_left', null],
    ['vanity', 'vanity_vessel_basin_right', 'vanity_basin_waste_right', null],
  ]
  const roots = new Map()
  for (const id of new Set(fixtures.map(entry => entry[0]))) {
    const root = applyAuthoredFixtures(roomFactories[id](), asset.scene)
    roots.set(id, root)
    t.after(() => disposeRoom(root))
  }
  for (const [id, shellName, wasteName, supportName] of fixtures) {
    const root = roots.get(id)
    const shell = root.getObjectByName(shellName)
    const bowl = downHit(shell)
    const waste = new Box3().setFromObject(root.getObjectByName(wasteName))
    close(waste.max.y - bowl.point.y, 0.0015, 0.0001, `${wasteName}: drain contact`)
    const supportY = supportName ? new Box3().setFromObject(root.getObjectByName(supportName)).max.y : root.userData.dimensions.counterHeight
    const gap = new Box3().setFromObject(shell).min.y - supportY
    assert.ok(gap >= -0.0001 && gap < 0.006, `${shellName}: floating or penetrating its support by ${gap} m`)
  }
  const vanity = roots.get('vanity')
  const towel = new Box3().setFromObject(vanity.getObjectByName('vanity_folded_towel_0'))
  close(towel.min.y, vanity.userData.dimensions.counterHeight + 0.0005, 0.0001, 'stacked towel support')
  const compact = roots.get('bathroom-s')
  const drape = new Box3().setFromObject(compact.getObjectByName('folded_hand_towel'))
  const rail = new Box3().setFromObject(compact.getObjectByName('towel_rail'))
  assert.ok(drape.intersectsBox(rail), 'the draped towel must meet its rail')
  assert.ok(drape.max.y >= rail.min.y && drape.max.y <= rail.max.y, 'the towel saddle must rest at rail height')
  const feature = applyAuthoredFixtures(roomFactories['feature-wall'](), asset.scene)
  t.after(() => disposeRoom(feature))
  const cushion = new Box3().setFromObject(feature.getObjectByName('feature_bench_linen_pad'))
  const bench = new Box3().setFromObject(feature.getObjectByName('feature_bench_solid_oak_seat'))
  close(cushion.min.y, bench.max.y, 0.0001, 'bench cushion support')
  assert.equal(meshes(feature).filter(mesh => /^(feature_olive_branch_|feature_leaf_petiole_|feature_olive_leaf_)/.test(mesh.name)).length, 0)
  assert.deepEqual(feature.getObjectByName('feature_olive_foliage').position.toArray(), [3.95, 0, 0.48])
  assert.ok(feature.getObjectByName('feature_earthen_planter'), 'the original planter must remain')
})

test('injection disposes retired native resources once while independent room clones leave the GLTF cache untouched', () => {
  const cachedResources = watchDisposals(resources(asset.scene))
  const first = roomFactories['feature-wall']()
  const second = roomFactories['feature-wall']()
  const originals = watchDisposals(resources(first))
  const oldLeaves = meshes(first).filter(mesh => mesh.name.startsWith('feature_olive_leaf_'))
  applyAuthoredFixtures(first, asset.scene)
  applyAuthoredFixtures(second, asset.scene)
  for (const leaf of oldLeaves) assert.equal(originals.get(leaf.geometry).count, 1, `${leaf.name}: retired geometry was not freed`)
  const firstResources = resources(first)
  const secondResources = resources(second)
  for (const resource of firstResources) assert.ok(!secondResources.has(resource), 'room instances share an owned resource')
  const currentDisposals = watchDisposals(firstResources)
  disposeRoom(first)
  for (const record of originals.values()) assert.equal(record.count, 1, 'a native resource was leaked or disposed twice')
  for (const record of currentDisposals.values()) assert.equal(record.count, 1, 'an injected resource was leaked or disposed twice')
  for (const { geometry, digest, bounds } of originalCacheGeometry) {
    assert.equal(geometryDigest(geometry), digest, 'injection mutated cached vertex/index buffers')
    assert.equal(geometry.boundingBox, bounds, 'injection changed the cache bounds')
  }
  for (const record of cachedResources.values()) assert.equal(record.count, 0, 'room cleanup disposed a cached GLTF resource')
  // The still-live second room must retain its own usable geometry.
  assert.ok(downHit(second.getObjectByName('feature_bench_linen_pad')))
  disposeRoom(second)
})
