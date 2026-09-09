import assert from 'node:assert/strict'
import test from 'node:test'
import { Box3, PerspectiveCamera, Raycaster, Vector2, Vector3 } from 'three'
import { basinProducts } from '../src/data/basinCatalogue.js'
import { models } from '../src/components/three/models/registry.js'
import { createVanity, createVanityBasin } from '../src/components/three/rooms/vanity.js'
import { disposeRoom } from '../src/components/three/rooms/roomKit.js'
import { getInteriorView } from '../src/components/three/primitives/interiorCameraSettings.js'

const model = models.find(entry => entry.id === 'vanity')
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 0.0001, `${message}: ${actual} / ${expected}`)

function meshesOf(root) {
  const meshes = []
  root.updateMatrixWorld(true)
  root.traverseVisible(object => { if (object.isMesh) meshes.push(object) })
  return meshes
}

function cameraFor(preset, aspect = 1.5) {
  const settings = getInteriorView(preset, { aspect })
  const camera = new PerspectiveCamera(settings.fov, aspect, 0.04, 40)
  camera.position.fromArray(preset.position)
  camera.lookAt(new Vector3(...preset.target))
  camera.updateMatrixWorld(true)
  return camera
}

function projectedBounds(object, camera) {
  const bounds = new Box3().setFromObject(object)
  const projected = new Box3()
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) projected.expandByPoint(new Vector3(x, y, z).project(camera))
    }
  }
  return projected
}

function tileCoverage(meshes, preset) {
  const camera = cameraFor(preset)
  const raycaster = new Raycaster()
  const sample = new Vector2()
  const columns = 35, rows = 27
  let tiles = 0
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      sample.set((column + 0.5) / columns * 2 - 1, (row + 0.5) / rows * 2 - 1)
      raycaster.setFromCamera(sample, camera)
      const hit = raycaster.intersectObjects(meshes, false)[0]
      if (hit?.object.userData.zoneId) tiles++
    }
  }
  return tiles / (columns * rows)
}

test('the basin wall has one centered product, supported at its real catalogue dimensions', t => {
  for (const product of basinProducts) {
    const root = createVanity({ basinProduct: product })
    t.after(() => disposeRoom(root))
    const bowls = meshesOf(root).filter(mesh => mesh.name.startsWith('vanity_vessel_basin_'))
    assert.equal(bowls.length, 1, `${product.id}: only one tabletop basin`)
    const bowl = bowls[0]
    const bounds = new Box3().setFromObject(bowl)
    const counter = new Box3().setFromObject(root.getObjectByName('vanity_quartz_counter'))
    const size = bounds.getSize(new Vector3())
    close(size.x, product.dimensionsMM[0] / 1000, 'catalogue width')
    close(size.z, product.dimensionsMM[1] / 1000, 'catalogue depth')
    close(size.y, product.dimensionsMM[2] / 1000, 'catalogue height')
    close(bounds.getCenter(new Vector3()).x, 0, 'centered basin')
    close(bounds.min.y, counter.max.y + 0.0005, 'ceramic foot on quartz')
    assert.ok(bounds.min.z > 0.10 && bounds.max.z < counter.max.z - 0.045, 'basin leaves usable counter edges')
    assert.equal(bowl.userData.zoneId, undefined, 'wall tile materials cannot enter the basin')
    assert.equal(bowl.userData.authoredSource, product.assetMeshName)
    assert.equal(bowl.material.color.getHexString(), product.color.slice(1).toLowerCase())
    assert.ok(bowl.material.roughness >= 0.35, 'matte catalogue ceramic must not look polished')
    const mixer = new Box3().setFromObject(root.getObjectByName('vanity_mixer_aerator_center'))
    assert.ok(mixer.min.y - bounds.max.y >= 0.07, 'faucet outlet clears the basin rim')
    const ray = new Raycaster(new Vector3(0, bounds.max.y + 0.05, bounds.getCenter(new Vector3()).z), new Vector3(0, -1, 0))
    const inside = ray.intersectObject(bowl, false)[0]
    assert.ok(inside && bounds.max.y - inside.point.y > 0.09, 'a genuinely hollow inner bowl is visible')
    const waste = new Box3().setFromObject(root.getObjectByName('vanity_basin_waste_center'))
    close(waste.max.y, inside.point.y + 0.0015, 'waste seated in ceramic')
  }
})

test('basin changes have independent resources and leave the tiled architecture available', t => {
  const room = createVanity({ includeBasin: false })
  const first = createVanityBasin(basinProducts[0])
  const next = createVanityBasin(basinProducts[1])
  t.after(() => { disposeRoom(room); disposeRoom(first); disposeRoom(next) })
  assert.equal(room.getObjectByName('vanity_basin_fixture'), undefined)
  const zoneIds = new Set(meshesOf(room).map(mesh => mesh.userData.zoneId).filter(Boolean))
  assert.deepEqual([...zoneIds].sort(), ['backWall', 'frontPanel', 'sideReturns'])
  const firstMaterials = new Set(meshesOf(first).map(mesh => mesh.material))
  for (const mesh of meshesOf(next)) {
    assert.equal(firstMaterials.has(mesh.material), false, 'a replaced basin cannot dispose another instance material')
    assert.equal(mesh.userData.fixtureSelectionId, 'basin', 'every selectable fixture part resolves the basin picker')
  }
})

test('closer overview enlarges the tile field and basin detail frames the real product on mobile', t => {
  const root = createVanity({ basinProduct: basinProducts[0] })
  t.after(() => disposeRoom(root))
  const meshes = meshesOf(root)
  const previousOverview = { position: [1.25, 1.55, 3.05], target: [0, 0.95, 0], fov: 52, fitAspect: 1.5 }
  const previousCoverage = tileCoverage(meshes, previousOverview)
  const coverage = tileCoverage(meshes, model.presets.default)
  assert.ok(coverage > previousCoverage + 0.10, 'the closer overview substantially enlarges the visible tile field')
  assert.ok(coverage > 0.70, 'the main comparison view devotes most of its frame to tile surfaces')
  const bowl = root.getObjectByName('vanity_vessel_basin_center')
  const overview = projectedBounds(bowl, cameraFor(model.presets.default))
  const detail = projectedBounds(bowl, cameraFor(model.presets.detail))
  assert.ok(detail.max.x - detail.min.x > 2 * (overview.max.x - overview.min.x), 'detail view makes catalogue basin readable')
  for (const aspect of [1.5, 0.78]) {
    const bounds = projectedBounds(bowl, cameraFor(model.presets.detail, aspect))
    assert.ok(bounds.min.x > -0.95 && bounds.max.x < 0.95 && bounds.min.y > -0.95 && bounds.max.y < 0.95,
      `the whole basin fits with breathing room at ${aspect} aspect`)
  }
  t.diagnostic(`Tile coverage ${(previousCoverage * 100).toFixed(1)}% → ${(coverage * 100).toFixed(1)}% with the unchanged 10 × 5 ft wall.`)
})
