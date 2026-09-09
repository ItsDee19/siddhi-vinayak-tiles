import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { room, material, woodMaterial, plasterMaterial, box, panel, cylinder, tube, tile } from './roomKit.js'

function architecture(object) {
  object.castShadow = false
  object.userData.castShadow = false
  return object
}

function structure(object) {
  object.castShadow = true
  object.userData.castShadow = true
  return object
}

function finishedTread(root, name, size, position) {
  const object = tile(root, name, 'tread', size, position)
  // The actual tile has a softened nosing; no coplanar trim hides its finish.
  object.geometry.dispose()
  object.geometry = new RoundedBoxGeometry(...size, 3, 0.003)
  return object
}

function antiSlipGrooves(root, name, x, width, topY, leadingZ, inward, finish) {
  // Narrow dark groove beds make a pale stone nosing legible. The 1mm lift
  // avoids coplanar flicker; only two 2.5mm strips cover the very edge region.
  for (const [index, inset] of [0.015, 0.023].entries()) {
    box(root, `${name}_${index}`, [width - 0.08, 0.001, 0.0025],
      [x, topY + 0.0005, leadingZ + inward * inset], finish)
  }
}

function railPost(root, name, x, surfaceY, z, finish) {
  cylinder(root, `${name}_shoe`, 0.022, 0.026, 0.013, [x, surfaceY + 0.007, z], finish, 24)
  cylinder(root, name, 0.009, 0.009, 0.88, [x, surfaceY + 0.447, z], finish, 24)
}

function stairWaist(root, { x, startZ, platformY, rise, going, flightWidth, tileThickness, landingThickness }, finish) {
  // Connection map: front soffit meets the intermediate slab's underside.
  // The stepped top seats each tile; the continuous soffit rises parallel to
  // the pitch and continues one going into the upper landing, joining its
  // slab through the full 200 mm thickness rather than a thin edge contact.
  const verticalThickness = 0.20
  const undersideAt = z => platformY - landingThickness - verticalThickness + (startZ - z) * rise / going
  const shape = new THREE.Shape()
  shape.moveTo(-startZ, undersideAt(startZ))
  shape.lineTo(-startZ, platformY + rise - tileThickness)
  for (let step = 0; step < 9; step++) {
    const rearZ = startZ - (step + 1) * going
    const topY = platformY + (step + 1) * rise - tileThickness
    shape.lineTo(-rearZ, topY)
    if (step < 8) shape.lineTo(-rearZ, topY + rise)
  }
  const landingFrontZ = startZ - 9 * going
  const endZ = startZ - 10 * going
  const landingTopY = platformY + 10 * rise - landingThickness
  shape.lineTo(-landingFrontZ, landingTopY)
  shape.lineTo(-endZ, landingTopY)
  shape.lineTo(-endZ, undersideAt(endZ))
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: flightWidth, steps: 1, bevelEnabled: false })
  const waist = new THREE.Mesh(geometry, finish)
  waist.name = 'upper_stair_concrete_waist'
  waist.rotation.y = Math.PI / 2
  waist.position.x = x - flightWidth / 2
  waist.receiveShadow = true
  waist.userData.ownedGeometry = true
  structure(waist)
  root.add(waist)
}

function handrailReturn(root, name, end, outward, finish) {
  const [x, y, z] = end
  // The open tube returns into its own end post rather than stopping at an
  // exposed cut end. Both endpoints overlap their connected tube/post.
  tube(root, name, [
    end, [x, y + 0.012, z + outward * 0.045],
    [x, y - 0.016, z + outward * 0.092],
    [x, y - 0.096, z + outward * 0.082], [x, y - 0.13, z],
  ], 0.013, finish)
}

function railInfill(root, spans, finish) {
  const bars = []
  root.updateMatrixWorld(true)
  const treads = root.children.filter(object => object.userData.zoneId === 'tread')
  const ray = new THREE.Raycaster()
  const down = new THREE.Vector3(0, -1, 0)
  for (const { from, to, posts } of spans) {
    const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to)
    const planLength = Math.hypot(end.x - start.x, end.z - start.z)
    const divisions = Math.ceil(planLength / 0.105)
    for (let index = 1; index < divisions; index++) {
      const top = start.clone().lerp(end, index / divisions)
      if (posts.some(post => Math.hypot(post[0] - top.x, post[1] - top.z) < 0.026)) continue
      // Seat against the actual nosing/landing geometry, including its small
      // overhang, rather than an idealised step-height formula.
      ray.set(new THREE.Vector3(top.x, top.y + 0.05, top.z), down)
      const tread = ray.intersectObjects(treads, false)[0]
      if (tread) bars.push({ top, bottomY: tread.point.y - 0.002 })
    }
  }
  // Seven millimetre rods leave both tile flights visible. One instanced draw
  // call keeps the extra silhouette detail inexpensive on mobile.
  const geometry = new THREE.CylinderGeometry(0.0035, 0.0035, 1, 12)
  const infill = new THREE.InstancedMesh(geometry, finish, bars.length)
  infill.name = 'stair_guard_vertical_infill'
  infill.castShadow = true
  infill.receiveShadow = true
  infill.userData.ownedGeometry = true
  const matrix = new THREE.Matrix4()
  for (const [index, { top, bottomY }] of bars.entries()) {
    matrix.makeScale(1, top.y - bottomY, 1)
    matrix.setPosition(top.x, (top.y + bottomY) / 2, top.z)
    infill.setMatrixAt(index, matrix)
  }
  infill.instanceMatrix.needsUpdate = true
  infill.computeBoundingBox()
  infill.computeBoundingSphere()
  root.add(infill)
}

function door(root, name, x, floorY, z, oak, metal, plaster) {
  architecture(box(root, `${name}_reveal`, [0.97, 2.19, 0.07], [x, floorY + 1.095, z], plaster, 0.004))
  box(root, `${name}_leaf`, [0.86, 2.10, 0.034], [x, floorY + 1.055, z + 0.043], oak, 0.004)
  cylinder(root, `${name}_handle_rose`, 0.019, 0.019, 0.011, [x + 0.31, floorY + 1.02, z + 0.064], metal, 24).rotation.x = Math.PI / 2
  box(root, `${name}_lever`, [0.091, 0.014, 0.023], [x + 0.28, floorY + 1.02, z + 0.078], metal, 0.006)
}

/** A dogleg viewed from its intermediate landing: left descends away to
 * ground, right ascends away to the upper storey, both in one forward view. */
export function createStairHall() {
  const root = room('Dogleg stair hall')
  const plaster = plasterMaterial('#e5e0d5', { roughness: 0.85 })
  const iron = material('#3d4440', 0.34, 0.60)
  const groove = material('#8c887f', 0.90)
  const oak = woodMaterial('#a98359')
  const trim = material('#b6b0a1', 0.48, 0.22)
  const daylight = material('#e5e5e5', 0.62)
  daylight.emissive.set('#ffffff')
  daylight.emissiveIntensity = 0.24
  const rise = 0.17, going = 0.28, flightWidth = 1.20
  const leftX = -0.69, rightX = 0.69, startZ = 1.25
  const platformY = 1.70, upperY = 3.40
  const tileThickness = 0.024, landingThickness = 0.026

  // Split the ground floor around the lower landing, avoiding double faces.
  tile(root, 'hall_floor_front', 'floor', [4.8, 0.12, 4.82], [0, -0.06, 1.14])
  tile(root, 'hall_floor_rear_left', 'floor', [1.09, 0.12, 1.88], [-1.855, -0.06, -2.21])
  tile(root, 'hall_floor_rear_right', 'floor', [2.47, 0.12, 1.88], [1.165, -0.06, -2.21])
  tile(root, 'hall_back_wall', 'wall', [4.8, 5.9, 0.12], [0, 2.95, -3.21])
  tile(root, 'hall_right_wall', 'wall', [0.12, 5.9, 6.7], [2.46, 2.95, 0.20])
  tile(root, 'hall_left_wall_rear', 'wall', [0.12, 5.9, 1.35], [-2.46, 2.95, -2.475])
  tile(root, 'hall_left_wall_front', 'wall', [0.12, 5.9, 2.85], [-2.46, 2.95, 2.125])
  tile(root, 'hall_left_wall_window_base', 'wall', [0.12, 2.2, 2.5], [-2.46, 1.10, -0.55])
  tile(root, 'hall_left_wall_window_head', 'wall', [0.12, 1.3, 2.5], [-2.46, 5.25, -0.55])
  architecture(box(root, 'hall_ceiling', [4.92, 0.12, 6.82], [0, 5.96, 0.20], plaster))
  architecture(box(root, 'hall_front_wall', [4.8, 5.9, 0.12], [0, 2.95, 3.61], plaster))

  // A full-width platform supports the fixed eye at ordinary standing height.
  structure(box(root, 'intermediate_landing_structure', [4.8, 0.20, 2.30], [0, platformY - landingThickness - 0.10, 2.40], plaster))
  finishedTread(root, 'intermediate_landing', [4.8, landingThickness, 2.30], [0, platformY - landingThickness / 2, 2.40])
  antiSlipGrooves(root, 'platform_descent_groove', leftX, flightWidth, platformY, startZ, 1, groove)

  // Nine treads plus the ground landing create ten equal descending risers.
  for (let step = 0; step < 9; step++) {
    const height = platformY - (step + 1) * rise
    const centreZ = startZ - (step + 0.5) * going
    const coreHeight = height - tileThickness
    structure(box(root, `lower_stair_core_${step}`, [flightWidth, coreHeight, going], [leftX, coreHeight / 2, centreZ], plaster))
    finishedTread(root, `lower_tread_${step}`, [flightWidth + 0.024, tileThickness, going + 0.014],
      [leftX, height - tileThickness / 2, centreZ - 0.005])
    antiSlipGrooves(root, `lower_antislip_groove_${step}`, leftX, flightWidth, height,
      centreZ - 0.005 - (going + 0.014) / 2, 1, groove)
  }
  for (let step = 0; step < 10; step++) {
    const top = platformY - step * rise, bottom = top - rise
    const finishThickness = step === 0 ? landingThickness : tileThickness
    tile(root, `lower_riser_${step}`, 'riser', [flightWidth, rise - finishThickness, 0.012],
      [leftX, (top - finishThickness + bottom) / 2, startZ - step * going - 0.006])
  }
  structure(box(root, 'lower_landing_structure', [1.24, 0.094, 1.88], [leftX, -0.073, -2.21], plaster))
  finishedTread(root, 'lower_landing', [1.24, landingThickness, 1.88], [leftX, -landingThickness / 2, -2.21])

  // The upper flight has a real sloping waist rather than solid columns to
  // ground level. Its stepped upper face stops at each tile's underside.
  stairWaist(root, { x: rightX, startZ, platformY, rise, going, flightWidth, tileThickness, landingThickness }, plaster)
  for (let step = 0; step < 9; step++) {
    const height = platformY + (step + 1) * rise
    const centreZ = startZ - (step + 0.5) * going
    finishedTread(root, `upper_tread_${step}`, [flightWidth + 0.024, tileThickness, going + 0.014],
      [rightX, height - tileThickness / 2, centreZ + 0.005])
    antiSlipGrooves(root, `upper_antislip_groove_${step}`, rightX, flightWidth, height,
      centreZ + 0.005 + (going + 0.014) / 2, -1, groove)
  }
  for (let step = 0; step < 10; step++) {
    const bottom = platformY + step * rise, top = bottom + rise
    const finishThickness = step === 9 ? landingThickness : tileThickness
    tile(root, `upper_riser_${step}`, 'riser', [flightWidth, rise - finishThickness, 0.012],
      [rightX, (bottom + top - finishThickness) / 2, startZ - step * going + 0.006])
  }
  // The waist supplies the front-left 280 mm of landing. Split the remaining
  // slab around it so there is no duplicate concrete face under the tile.
  structure(box(root, 'upper_landing_structure', [2.31, 0.20, 1.60], [1.245, upperY - landingThickness - 0.10, -2.35], plaster))
  structure(box(root, 'upper_landing_side_bearing', [1.11, 0.20, going], [1.845, upperY - landingThickness - 0.10, -1.41], plaster))
  finishedTread(root, 'upper_landing', [2.31, landingThickness, 1.88], [1.245, upperY - landingThickness / 2, -2.21])

  // Narrow rails reveal both opposite slopes without an opaque balustrade.
  const infillSpans = []
  for (const x of [-1.28, -0.10]) {
    for (const step of [0, 3, 6, 8]) railPost(root, `lower_rail_post_${x}_${step}`, x,
      platformY - (step + 1) * rise, startZ - (step + 0.5) * going - 0.005, iron)
    railPost(root, `lower_platform_post_${x}`, x, platformY, 1.385, iron)
    railPost(root, `lower_ground_post_${x}`, x, 0, -1.415, iron)
    const from = [x, platformY + 0.895, 1.385], to = [x, 0.895, -1.415]
    tube(root, `lower_descending_handrail_${x}`, [from, to], 0.013, iron)
    handrailReturn(root, `lower_handrail_platform_return_${x}`, from, 1, iron)
    handrailReturn(root, `lower_handrail_ground_return_${x}`, to, -1, iron)
    infillSpans.push({ from, to,
      posts: [1.385, -1.415, ...[0, 3, 6, 8].map(step => startZ - (step + 0.5) * going - 0.005)].map(z => [x, z]) })
  }
  for (const x of [0.10, 1.28]) {
    for (const step of [0, 3, 6, 8]) railPost(root, `upper_rail_post_${x}_${step}`, x,
      platformY + (step + 1) * rise, startZ - (step + 0.5) * going + 0.005, iron)
    railPost(root, `upper_platform_post_${x}`, x, platformY, 1.395, iron)
    railPost(root, `upper_level_post_${x}`, x, upperY, -1.405, iron)
    const from = [x, platformY + 0.895, 1.395], to = [x, upperY + 0.895, -1.405]
    tube(root, `upper_ascending_handrail_${x}`, [from, to], 0.013, iron)
    handrailReturn(root, `upper_handrail_platform_return_${x}`, from, 1, iron)
    handrailReturn(root, `upper_handrail_level_return_${x}`, to, -1, iron)
    infillSpans.push({ from, to,
      posts: [1.395, -1.405, ...[0, 3, 6, 8].map(step => startZ - (step + 0.5) * going + 0.005)].map(z => [x, z]) })
  }
  for (const x of [-2.30, -1.46, 1.46, 2.30]) railPost(root, `intermediate_edge_post_${x}`, x, platformY, startZ + 0.014, iron)
  for (const [a, b] of [[-2.35, -1.42], [1.42, 2.35]]) {
    const from = [a, platformY + 0.895, startZ + 0.014], to = [b, platformY + 0.895, startZ + 0.014]
    tube(root, `intermediate_side_guard_${a}`, [from, to], 0.013, iron)
    infillSpans.push({ from, to,
      posts: [-2.30, -1.46, 1.46, 2.30].map(x => [x, startZ + 0.014]) })
  }
  for (const z of [-1.42, -2.24, -3.03]) railPost(root, `upper_landing_guard_post_${z}`, 0.12, upperY, z, iron)
  tube(root, 'upper_landing_open_edge_guard', [[0.12, upperY + 0.895, -1.34], [0.12, upperY + 0.895, -3.08]], 0.013, iron)
  infillSpans.push({ from: [0.12, upperY + 0.895, -1.34], to: [0.12, upperY + 0.895, -3.08],
    posts: [-1.42, -2.24, -3.03].map(z => [0.12, z]) })
  for (const [sign, z] of [[-1, 1.385], [1, 1.395]]) {
    tube(root, `platform_guard_corner_${sign}`, [
      [sign * 1.28, platformY + 0.895, z],
      [sign * 1.32, platformY + 0.895, z - 0.012],
      [sign * 1.405, platformY + 0.895, startZ + 0.055],
      [sign * 1.42, platformY + 0.895, startZ + 0.014],
    ], 0.013, iron)
  }
  railInfill(root, infillSpans, iron)

  // A genuine daylight opening establishes the hall's two-storey scale.
  architecture(panel(root, 'hall_window_daylight', 2.5, 2.4, [-2.49, 3.40, -0.55], [0, Math.PI / 2, 0], daylight))
  for (const z of [-1.80, 0.70]) architecture(box(root, 'hall_window_jamb', [0.12, 2.46, 0.045], [-2.39, 3.40, z], plaster, 0.003))
  for (const y of [2.20, 4.60]) architecture(box(root, 'hall_window_rail', [0.12, 0.045, 2.50], [-2.39, y, -0.55], plaster, 0.003))
  architecture(box(root, 'hall_window_vertical_mullion', [0.055, 2.38, 0.028], [-2.345, 3.40, -0.55], trim, 0.003))
  architecture(box(root, 'hall_window_horizontal_mullion', [0.055, 0.025, 2.45], [-2.345, 3.34, -0.55], trim, 0.003))
  architecture(box(root, 'hall_window_sill', [0.20, 0.034, 2.56], [-2.36, 2.19, -0.55], plaster, 0.005))
  door(root, 'ground_level_door', leftX, 0, -3.125, oak, iron, plaster)
  door(root, 'upper_level_door', 1.20, upperY, -3.125, oak, iron, plaster)

  // A compact bench stays behind the eye, outside the stair walking path.
  box(root, 'intermediate_landing_bench', [0.38, 0.06, 0.95], [-2.12, platformY + 0.46, 2.65], oak, 0.014)
  for (const z of [2.30, 3.0]) box(root, 'intermediate_bench_leg', [0.30, 0.43, 0.045], [-2.12, platformY + 0.215, z], oak, 0.006)
  for (const x of [-2.385, 2.385]) box(root, 'intermediate_landing_skirting', [0.018, 0.06, 2.30], [x, platformY + 0.03, 2.40], plaster, 0.003)
  const ceilingLight = material('#ffffff', 0.45)
  ceilingLight.emissive.set('#ffffff')
  ceilingLight.emissiveIntensity = 0.4
  for (const x of [-1.20, 1.20]) {
    architecture(cylinder(root, 'hall_ceiling_light_trim', 0.09, 0.09, 0.008, [x, 5.894, 0.65], plaster))
    architecture(cylinder(root, 'hall_ceiling_light_diffuser', 0.064, 0.064, 0.009, [x, 5.889, 0.65], ceilingLight))
  }
  return root
}
