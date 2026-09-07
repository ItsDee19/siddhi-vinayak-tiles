import assert from 'node:assert/strict'
import test from 'node:test'
import { Box3, PerspectiveCamera, Raycaster, Vector2, Vector3 } from 'three'
import { roomFactories } from '../src/components/three/rooms/index.js'
import { prepareRoom } from '../src/components/three/rooms/prepareRoom.js'
import { disposeRoom } from '../src/components/three/rooms/roomKit.js'
import { models } from '../src/components/three/models/registry.js'
import { measureUVSize } from '../src/utils/tileMaterial.js'

function visibleMeshes(root) {
  const meshes = []
  root.traverseVisible(object => { if (object.isMesh) meshes.push(object) })
  return meshes
}

function opaqueHit(raycaster, meshes) {
  return raycaster.intersectObjects(meshes, false).find(hit => {
    const mat = Array.isArray(hit.object.material)
      ? hit.object.material[hit.face.materialIndex]
      : hit.object.material
    // Clear shower glass should not hide the tiled surface behind it when
    // measuring useful view coverage. Its opaque frame still counts normally.
    return mat.visible && !(mat.transparent && mat.opacity < 0.3)
  })
}

function viewCoverage(meshes, preset, yawDegrees) {
  const camera = new PerspectiveCamera(preset.fov || 58, 1.5, 0.04, 40)
  camera.position.fromArray(preset.position)
  const direction = new Vector3(...preset.target).sub(camera.position)
  if (yawDegrees !== undefined) {
    const pitch = Math.atan2(direction.y, Math.hypot(direction.x, direction.z))
    const yaw = yawDegrees * Math.PI / 180
    direction.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch))
  }
  camera.lookAt(camera.position.clone().add(direction))
  camera.updateMatrixWorld(true)
  const raycaster = new Raycaster()
  raycaster.near = camera.near
  raycaster.far = camera.far
  const ndc = new Vector2()
  const columns = 29, rows = 23
  let filled = 0, selectable = 0
  const visibleZones = new Set()
  const visibleNames = new Set()
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      // Sample pixel centres over the complete frame, including its edges.
      ndc.set((column + 0.5) / columns * 2 - 1, (row + 0.5) / rows * 2 - 1)
      raycaster.setFromCamera(ndc, camera)
      const hit = opaqueHit(raycaster, meshes)
      if (!hit) continue
      filled++
      visibleNames.add(hit.object.name)
      if (hit.object.userData.zoneId) {
        selectable++
        visibleZones.add(hit.object.userData.zoneId)
      }
    }
  }
  return { filled: filled / (columns * rows), selectable: selectable / (columns * rows), visibleZones, visibleNames }
}

function resources(root) {
  const result = new Set()
  root.traverse(object => {
    if (!object.isMesh) return
    if (object.isInstancedMesh) result.add(object)
    result.add(object.geometry)
    for (const mat of Array.isArray(object.material) ? object.material : [object.material]) {
      result.add(mat)
      for (const value of Object.values(mat)) if (value?.isTexture) result.add(value)
    }
  })
  return result
}

test('every registered room has a native factory and unique selectable zones', () => {
  assert.deepEqual(models.map(model => model.id), ['bathroom-s', 'bathroom-l', 'stairs', 'feature-wall', 'vanity'])
  assert.equal(new Set(models.map(model => model.id)).size, models.length)
  for (const model of models) {
    assert.equal(typeof roomFactories[model.id], 'function', `${model.id}: missing room factory`)
    assert.equal(new Set(model.zones.map(zone => zone.id)).size, model.zones.length, `${model.id}: duplicate zone IDs`)
    assert.ok(model.presets.default, `${model.id}: missing entrance viewpoint`)
  }
})

const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 0.001,
  `${label}: measured ${actual.toFixed(4)} m, expected ${expected.toFixed(4)} m`)

for (const [id, widthFeet, depthFeet, heights] of [
  ['bathroom-s', 8, 5, [3, 2, 3]], ['bathroom-l', 10, 10, [2, 4, 2]],
]) {
  test(`${id}: exact client footprint, two continuous banded walls and an immutable floor`, t => {
    const model = models.find(entry => entry.id === id)
    assert.deepEqual(model.zones.map(zone => zone.surface), ['Wall', 'Wall', 'Wall'])
    const { root, zoneMeshes } = prepareRoom(roomFactories[id](), model.zones)
    t.after(() => disposeRoom(root))
    const floor = root.getObjectByName('bathroom_floor')
    assert.ok(floor?.userData.isFloor, 'the physical bathroom floor must exist')
    assert.equal(floor.userData.zoneId, undefined, 'the floor cannot enter the surface picker')
    assert.equal(zoneMeshes.floor, undefined)
    const floorSize = new Box3().setFromObject(floor).getSize(new Vector3())
    close(floorSize.x, widthFeet * 0.3048, 'floor width')
    close(floorSize.z, depthFeet * 0.3048, 'floor depth')
    let bottom = 0
    for (const [index, zone] of ['lower', 'feature', 'upper'].entries()) {
      assert.equal(zoneMeshes[zone].length, 2, `${zone}: one continuous band on each of two walls`)
      const back = zoneMeshes[zone].find(mesh => new Box3().setFromObject(mesh).getSize(new Vector3()).x > 0.2)
      const side = zoneMeshes[zone].find(mesh => mesh !== back)
      assert.ok(back && side, `${zone}: two adjacent wall orientations required`)
      close(new Box3().setFromObject(back).getSize(new Vector3()).x, widthFeet * 0.3048, 'back wall width')
      close(new Box3().setFromObject(side).getSize(new Vector3()).z, depthFeet * 0.3048, 'side wall depth')
      for (const mesh of [back, side]) {
        const bounds = new Box3().setFromObject(mesh)
        close(bounds.min.y, bottom, `${zone} lower edge`)
        close(bounds.max.y, bottom + heights[index] * 0.3048, `${zone} upper edge`)
      }
      bottom += heights[index] * 0.3048
    }
    close(bottom, 8 * 0.3048, 'total tiled wall height')
    const seen = viewCoverage(visibleMeshes(root), model.presets.default).visibleNames
    for (const zone of ['lower', 'feature', 'upper']) {
      for (const mesh of zoneMeshes[zone]) assert.ok(seen.has(mesh.name), `${mesh.name}: default view must show both wall bands`)
    }
  })
}

test('the luxury bathroom has a distinct usable tub and two hollow basins', t => {
  const small = roomFactories['bathroom-s']()
  const large = roomFactories['bathroom-l']()
  t.after(() => { disposeRoom(small); disposeRoom(large) })
  small.updateMatrixWorld(true)
  large.updateMatrixWorld(true)
  const bowls = visibleMeshes(large).filter(mesh => mesh.userData.fixture === 'basin')
  const bath = large.getObjectByName('spa_freestanding_soaking_tub')
  assert.equal(bowls.length, 2, 'the large bathroom needs two independent basins')
  assert.ok(bath, 'the soaking bath establishes the distinct large-room layout')
  assert.equal(small.getObjectByName('spa_freestanding_soaking_tub'), undefined)
  assert.ok(small.getObjectByName('ceramic_vessel_basin'), 'the compact single vanity remains available')
  const ray = new Raycaster()
  for (const fixture of [...bowls, bath]) {
    const bounds = new Box3().setFromObject(fixture)
    const centre = bounds.getCenter(new Vector3())
    ray.set(new Vector3(centre.x, bounds.max.y + 0.05, centre.z), new Vector3(0, -1, 0))
    const interior = ray.intersectObject(fixture)[0]
    const depth = fixture === bath ? 0.35 : 0.07
    assert.ok(interior && bounds.max.y - interior.point.y > depth,
      `${fixture.name}: an actual hollow interior must sit below the rim`)
    assert.equal(fixture.userData.zoneId, undefined, 'fixture materials remain separate from tile selection')
  }
  const tubBounds = new Box3().setFromObject(bath)
  close(tubBounds.max.x - tubBounds.min.x, 0.70, 'tub width')
  close(tubBounds.max.z - tubBounds.min.z, 1.55, 'tub length')
  assert.ok(tubBounds.min.y >= 0 && tubBounds.min.y < 0.01, 'the tub rests on the floor')
  const floorBounds = new Box3().setFromObject(large.getObjectByName('bathroom_floor'))
  assert.ok(tubBounds.min.x > floorBounds.min.x && tubBounds.max.x < floorBounds.max.x
    && tubBounds.min.z > floorBounds.min.z && tubBounds.max.z < floorBounds.max.z, 'the bath fits inside the room')
  const vanity = new Box3().setFromObject(large.getObjectByName('spa_vanity_walnut_carcass'))
  assert.ok(tubBounds.min.z - vanity.max.z >= 0.30, 'keep access space between the bath and vanity')
})

test('wide wall and basin wall retain their requested tileable dimensions', t => {
  for (const [id, zone, widthFeet, heightFeet, baseFeet] of [
    ['feature-wall', 'wall', 30, 10, 0], ['vanity', 'backWall', 10, 5, 2.5],
  ]) {
    const model = models.find(entry => entry.id === id)
    const { root, zoneMeshes } = prepareRoom(roomFactories[id](), model.zones)
    t.after(() => disposeRoom(root))
    const bounds = new Box3()
    for (const mesh of zoneMeshes[zone]) bounds.union(new Box3().setFromObject(mesh))
    close(bounds.max.x - bounds.min.x, widthFeet * 0.3048, `${id} wall width`)
    close(bounds.max.y - bounds.min.y, heightFeet * 0.3048, `${id} wall height`)
    close(bounds.min.y, baseFeet * 0.3048, `${id} wall base`)
  }
})

for (const model of models) {
  test(`${model.name}: physical geometry, useful tile coverage and interior viewpoints`, t => {
    const { root, zoneMeshes } = prepareRoom(roomFactories[model.id](), model.zones)
    t.after(() => disposeRoom(root))
    root.updateMatrixWorld(true)
    const meshes = visibleMeshes(root)
    let triangles = 0
    root.traverse(object => {
      if (!object.isMesh) return
      const geometry = object.geometry
      triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3 * (object.isInstancedMesh ? object.count : 1)
      for (const [name, attribute] of Object.entries(geometry.attributes)) {
        for (const value of attribute.array) assert.ok(Number.isFinite(value), `${model.id}/${object.name}: non-finite ${name}`)
      }
    })
    // This guards accidental geometry explosions without locking the design
    // to a mesh count. 500k triangles leaves room for purposeful new details.
    assert.ok(triangles < 500_000, `${model.id}: ${triangles} triangles exceed the interior budget`)

    for (const zone of model.zones) {
      assert.ok(zoneMeshes[zone.id]?.length, `${model.id}: declared ${zone.id} zone has no surfaces`)
      for (const mesh of zoneMeshes[zone.id]) {
        const measured = measureUVSize(mesh)
        assert.ok(measured, `${mesh.name}: missing usable UVs`)
        assert.ok(Math.abs(measured.x - 1) < 0.005, `${mesh.name}: U covers ${measured.x} metres instead of 1`)
        assert.ok(Math.abs(measured.y - 1) < 0.005, `${mesh.name}: V covers ${measured.y} metres instead of 1`)
      }
    }

    const envelope = new Box3().setFromObject(root)
    const floorBounds = new Box3()
    for (const floor of meshes.filter(mesh => mesh.userData.isFloor || mesh.userData.zoneId === 'floor')) {
      floorBounds.union(new Box3().setFromObject(floor))
    }
    assert.ok(!floorBounds.isEmpty(), `${model.id}: missing ground-floor envelope`)
    const down = new Raycaster()
    for (const [name, preset] of Object.entries(model.presets)) {
      const eye = new Vector3(...preset.position)
      const target = new Vector3(...preset.target)
      assert.ok(preset.position.every(Number.isFinite) && preset.target.every(Number.isFinite), `${model.id}/${name}: invalid camera vectors`)
      assert.ok(eye.distanceTo(target) > 0.1, `${model.id}/${name}: undefined look direction`)
      assert.ok(eye.x > floorBounds.min.x && eye.x < floorBounds.max.x && eye.z > floorBounds.min.z && eye.z < floorBounds.max.z,
        `${model.id}/${name}: eye has left the floor envelope`)
      assert.ok(eye.y > floorBounds.max.y + 0.45 && eye.y < envelope.max.y - 0.1,
        `${model.id}/${name}: eye must be above the floor and below the ceiling`)
      down.set(eye, new Vector3(0, -1, 0))
      const supportingSurface = opaqueHit(down, meshes)
      assert.ok(supportingSurface && supportingSurface.distance > 0.45 && supportingSurface.distance < 2.2,
        `${model.id}/${name}: eye intersects a fixture or has no walkable surface beneath it`)
    }

    const normal = viewCoverage(meshes, model.presets.default)
    const left = viewCoverage(meshes, model.presets.default, -75)
    const right = viewCoverage(meshes, model.presets.default, 75)
    const percent = value => `${(value * 100).toFixed(1)}%`
    t.diagnostic(`${Math.round(triangles).toLocaleString('en-US')} triangles; entrance fills ${percent(normal.filled)}, visible tile ${percent(normal.selectable)}; ±75° frame coverage ${percent(left.filled)} / ${percent(right.filled)}`)
    assert.ok(normal.filled > 0.90, `${model.id}: only ${percent(normal.filled)} of the entrance frame contains the room`)
    const minimumTileCoverage = { stairs: 0.35, 'feature-wall': 0.30, vanity: 0.25 }[model.id] || 0.40
    assert.ok(normal.selectable > minimumTileCoverage,
      `${model.id}: furnishings leave only ${percent(normal.selectable)} of the frame available for tile comparison`)
    const primaryZones = model.id.startsWith('bathroom') ? ['lower', 'feature', 'upper']
      : model.id === 'vanity' ? ['backWall', 'frontPanel']
        : model.id === 'stairs' ? ['tread', 'riser'] : ['wall']
    for (const zone of primaryZones) {
      assert.ok(normal.visibleZones.has(zone), `${model.id}: the default view hides ${zone}`)
    }
    // A 150° look plus the camera's field of view can see past an open doorway.
    // Require the room to remain dominant, while allowing that real opening.
    assert.ok(left.filled > 0.80 && right.filled > 0.80,
      `${model.id}: looking to an arc end reveals too much exterior (${percent(left.filled)} / ${percent(right.filled)})`)
  })
}

test('every stair tread and landing is the exposed surface above its structural support', t => {
  const model = models.find(entry => entry.id === 'stairs')
  const { root, zoneMeshes } = prepareRoom(roomFactories.stairs(), model.zones)
  t.after(() => disposeRoom(root))
  root.updateMatrixWorld(true)
  const meshes = visibleMeshes(root)
  const raycaster = new Raycaster()
  raycaster.far = 1
  for (const tread of zoneMeshes.tread) {
    const bounds = new Box3().setFromObject(tread)
    const centre = bounds.getCenter(new Vector3())
    // Sample across the walking surface, including both flights and their
    // landings. This tests what a viewer sees, not the core's construction.
    for (const across of [-0.25, 0, 0.25]) {
      const origin = new Vector3(centre.x + across * (bounds.max.x - bounds.min.x), bounds.max.y + 0.05, centre.z)
      raycaster.set(origin, new Vector3(0, -1, 0))
      const first = opaqueHit(raycaster, meshes)
      assert.equal(first?.object, tread, `${tread.name}: structural geometry covers the selected tile`)
      const support = opaqueHit(raycaster, meshes.filter(mesh => mesh !== tread))
      // Even if a coplanar hit happens to sort after the tile, it still causes
      // z-fighting in WebGL. The finish must clearly stand above its support.
      assert.ok(!support || support.distance - first.distance > 0.001,
        `${tread.name}: another surface is coplanar with the tile finish`)
    }
  }
})

test('the intermediate landing view shows treads on both the ascending and descending flights', t => {
  const model = models.find(entry => entry.id === 'stairs')
  const { root } = prepareRoom(roomFactories.stairs(), model.zones)
  t.after(() => disposeRoom(root))
  const seen = [...viewCoverage(visibleMeshes(root), model.presets.default).visibleNames]
  for (const flight of ['lower', 'upper']) {
    assert.ok(seen.filter(name => name.startsWith(`${flight}_tread_`)).length >= 4,
      `${flight}: the landing view must clearly reveal at least four separate treads`)
  }
  assert.ok(seen.some(name => name.startsWith('intermediate_landing')),
    'the platform joining the two flights must be visible')
})

test('switching rooms disposes each shared resource once and leaves another instance intact', () => {
  for (const model of models) {
    const first = prepareRoom(roomFactories[model.id](), model.zones).root
    const second = prepareRoom(roomFactories[model.id](), model.zones).root
    const firstResources = resources(first)
    const secondResources = resources(second)
    for (const resource of firstResources) assert.ok(!secondResources.has(resource), `${model.id}: independent rooms share a disposable resource`)
    const disposed = new Map([...firstResources].map(resource => [resource, 0]))
    let otherDisposals = 0
    for (const resource of firstResources) resource.addEventListener('dispose', () => disposed.set(resource, disposed.get(resource) + 1))
    for (const resource of secondResources) resource.addEventListener('dispose', () => { otherDisposals++ })
    disposeRoom(first)
    for (const count of disposed.values()) assert.equal(count, 1, `${model.id}: a resource was leaked or disposed more than once`)
    assert.equal(otherDisposals, 0, `${model.id}: switching away disposed resources used by the other instance`)
    disposeRoom(second)
  }
})
