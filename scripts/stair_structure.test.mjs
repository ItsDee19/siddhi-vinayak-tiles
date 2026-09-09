import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { createStairHall } from '../src/components/three/rooms/stairs.js'
import { disposeRoom } from '../src/components/three/rooms/roomKit.js'

const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 0.0001,
  `${message}: ${actual} versus ${expected}`)

function scene(t) {
  const root = createStairHall()
  root.updateMatrixWorld(true)
  t.after(() => disposeRoom(root))
  return root
}

test('the upper flight has a continuous sloped concrete soffit, seated below every tread', t => {
  const root = scene(t)
  const waist = root.getObjectByName('upper_stair_concrete_waist')
  assert.ok(waist?.isMesh && waist.castShadow)
  assert.equal(root.getObjectByName('upper_stair_core_0'), undefined,
    'the upper flight must not be filled with columns to the ground')
  const bounds = new THREE.Box3().setFromObject(waist)
  assert.ok(bounds.min.y > 1.4, 'the upper flight leaves open space beneath its soffit')
  const ray = new THREE.Raycaster()
  const down = new THREE.Vector3(0, -1, 0)
  for (let step = 0; step < 9; step++) {
    const tread = root.getObjectByName(`upper_tread_${step}__tread`)
    const treadBounds = new THREE.Box3().setFromObject(tread)
    const centre = treadBounds.getCenter(new THREE.Vector3())
    for (const x of [centre.x - 0.35, centre.x, centre.x + 0.35]) {
      ray.set(new THREE.Vector3(x, treadBounds.max.y + 0.05, centre.z), down)
      const support = ray.intersectObject(waist)[0]
      assert.ok(support, `step ${step}: tile needs solid support across its width`)
      close(support.point.y, treadBounds.min.y, `step ${step}: concrete contacts the tile underside`)
      assert.ok(treadBounds.max.y - support.point.y > 0.023,
        'the selected tile remains the exposed finish above concrete')
    }
  }
  const underside = []
  for (const z of [1.1, 0.0, -1.1]) {
    ray.set(new THREE.Vector3(0.69, 0, z), new THREE.Vector3(0, 1, 0))
    const hit = ray.intersectObject(waist)[0]
    assert.ok(hit)
    const normal = hit.face.normal.clone().transformDirection(waist.matrixWorld)
    assert.ok(normal.y < -0.8 && Math.abs(normal.z) > 0.4,
      'the underside is an inclined surface, not horizontal step bottoms')
    underside.push(hit.point)
  }
  close(underside[1].y - underside[0].y, underside[2].y - underside[1].y,
    'the concrete soffit has a constant pitch')
  close((underside[2].y - underside[0].y) / 2.2, 0.17 / 0.28,
    'the soffit runs parallel to the authored stair pitch')
  const landingSlab = new THREE.Box3().setFromObject(root.getObjectByName('upper_landing_structure'))
  close(bounds.min.z, landingSlab.max.z, 'the waist joins the rear landing slab')
  ray.set(new THREE.Vector3(0.69, 0, landingSlab.max.z + 0.00001), new THREE.Vector3(0, 1, 0))
  close(ray.intersectObject(waist)[0].point.y, landingSlab.min.y,
    'the soffit joins the full landing slab thickness')
  ray.set(new THREE.Vector3(0.69, 4, -1.41), down)
  close(ray.intersectObject(waist)[0].point.y, 3.40 - 0.026,
    'the waist supports the front of the upper landing')
  assert.equal(waist.userData.zoneId, undefined, 'structural concrete is not a tile-picker surface')
})

test('slender instanced infill seats on actual tiles and meets the handrail centreline', t => {
  const root = scene(t)
  const infill = root.getObjectByName('stair_guard_vertical_infill')
  assert.ok(infill?.isInstancedMesh, 'infill must stay in one draw call')
  assert.ok(infill.count > 90 && infill.count < 150, 'both flights and landing guards receive infill')
  assert.equal(infill.userData.zoneId, undefined)
  const treads = root.children.filter(object => object.userData.zoneId === 'tread')
  const rails = root.children.filter(object => /descending_handrail|ascending_handrail|intermediate_side_guard|upper_landing_open_edge_guard/.test(object.name))
  const ray = new THREE.Raycaster()
  const matrix = new THREE.Matrix4()
  for (let index = 0; index < infill.count; index++) {
    infill.getMatrixAt(index, matrix)
    matrix.premultiply(infill.matrixWorld)
    const bottom = new THREE.Vector3(0, -0.5, 0).applyMatrix4(matrix)
    const top = new THREE.Vector3(0, 0.5, 0).applyMatrix4(matrix)
    ray.set(top.clone().add(new THREE.Vector3(0, 0.05, 0)), new THREE.Vector3(0, -1, 0))
    const support = ray.intersectObjects(treads, false)[0]
    assert.ok(support, `bar ${index}: a tread or landing must support the bar`)
    close(support.point.y - bottom.y, 0.002, `bar ${index}: the foot embeds 2 mm in the finish`)
    const nearestRail = Math.min(...rails.map(rail => {
      const curve = rail.geometry.parameters.path
      const line = new THREE.Line3(rail.localToWorld(curve.getPoint(0)), rail.localToWorld(curve.getPoint(1)))
      return line.closestPointToPoint(top, true, new THREE.Vector3()).distanceTo(top)
    }))
    assert.ok(nearestRail < 0.0001, `bar ${index}: its top meets a real handrail`)
  }
})

test('handrail returns connect to rail ends and return into supported posts', t => {
  const root = scene(t)
  const returns = root.children.filter(object => /handrail_.*_return_/.test(object.name))
  assert.equal(returns.length, 8)
  const rails = root.children.filter(object => /descending_handrail|ascending_handrail/.test(object.name))
  const posts = root.children.filter(object => /^(lower|upper)_(platform|ground|level)_post_/.test(object.name) && !object.name.endsWith('_shoe'))
  for (const pipe of returns) {
    const curve = pipe.geometry.parameters.path
    const start = pipe.localToWorld(curve.getPoint(0))
    const end = pipe.localToWorld(curve.getPoint(1))
    assert.ok(rails.some(rail => [0, 1].some(t =>
      rail.localToWorld(rail.geometry.parameters.path.getPoint(t)).distanceTo(start) < 0.0001)),
    `${pipe.name}: the return joins an existing handrail end`)
    assert.ok(posts.some(post => new THREE.Box3().setFromObject(post).containsPoint(end)),
      `${pipe.name}: its lower end connects into an end post`)
    assert.ok(start.y - end.y > 0.12, 'the cut end turns down into the post')
  }
  for (const sign of [-1, 1]) {
    const corner = root.getObjectByName(`platform_guard_corner_${sign}`)
    const curve = corner.geometry.parameters.path
    const first = corner.localToWorld(curve.getPoint(0))
    const last = corner.localToWorld(curve.getPoint(1))
    close(first.y, 2.595, 'landing rail connection height')
    close(last.y, 2.595, 'side guard connection height')
    close(Math.abs(first.x), 1.28, 'flight rail joins the corner')
    close(Math.abs(last.x), 1.42, 'corner joins the side guard')
  }
})

test('visible stair daylight and ceiling emitters use neutral white', t => {
  const root = scene(t)
  const emitters = root.children.filter(object => /hall_window_daylight|hall_ceiling_light_diffuser/.test(object.name))
  assert.equal(emitters.length, 3)
  for (const object of emitters) {
    const { color, emissive } = object.material
    close(color.r, color.g, `${object.name}: neutral base`)
    close(color.g, color.b, `${object.name}: neutral base`)
    close(emissive.r, emissive.g, `${object.name}: neutral radiance`)
    close(emissive.g, emissive.b, `${object.name}: neutral radiance`)
  }
})
