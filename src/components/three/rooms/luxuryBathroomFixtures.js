import * as THREE from 'three'
import { createBasinGeometry } from '../modelDetails.js'
import { material, box, cylinder, tube } from './roomKit.js'

const PI = Math.PI

function fixedMesh(root, name, geometry, finish, position) {
  const object = new THREE.Mesh(geometry, finish)
  object.name = name
  object.position.set(...position)
  object.castShadow = true
  object.receiveShadow = true
  object.userData.ownedGeometry = true
  root.add(object)
  return object
}

function glow(object) {
  object.castShadow = false
  object.userData.castShadow = false
  return object
}

// Fit the continuous inner/outer shell to its physical envelope, including
// its foot. This makes a freestanding bath sit on the floor rather than float.
function hollowShell(width, depth, height, style = 'vessel') {
  const geometry = createBasinGeometry(width, depth, height, style)
  const bounds = geometry.boundingBox
  const size = bounds.getSize(new THREE.Vector3())
  const centre = bounds.getCenter(new THREE.Vector3())
  geometry.translate(-centre.x, -bounds.min.y, -centre.z)
  geometry.scale(width / size.x, height / size.y, depth / size.z)
  geometry.computeBoundingBox()
  const position = geometry.attributes.position
  return { geometry, innerFloorY: position.getY(position.count - 1) }
}

function broadMirror(root, x, backZ, brass, light) {
  const width = 1.40, height = 0.88, y = 1.62, radius = 0.13
  glow(box(root, 'mirror_backlight', [width + 0.030, height + 0.030, 0.014], [x, y, backZ + 0.016], light, radius + 0.012))
  box(root, 'mirror_champagne_frame', [width + 0.015, height + 0.015, 0.027], [x, y, backZ + 0.035], brass, radius + 0.006)
  const outline = new THREE.Shape()
  const left = -width / 2, right = width / 2, bottom = -height / 2, top = height / 2
  outline.moveTo(left + radius, bottom)
  outline.lineTo(right - radius, bottom)
  outline.quadraticCurveTo(right, bottom, right, bottom + radius)
  outline.lineTo(right, top - radius)
  outline.quadraticCurveTo(right, top, right - radius, top)
  outline.lineTo(left + radius, top)
  outline.quadraticCurveTo(left, top, left, top - radius)
  outline.lineTo(left, bottom + radius)
  outline.quadraticCurveTo(left, bottom, left + radius, bottom)
  const silver = material('#d5dfda', 0.085, 0.68)
  silver.emissive.set('#9aa7a0')
  silver.emissiveIntensity = 0.055
  const face = fixedMesh(root, 'mirror_silver_face', new THREE.ShapeGeometry(outline, 22), silver, [x, y, backZ + 0.050])
  face.userData.roomMirror = true
  glow(face)
}

function doubleVanity(root, { leftX, backZ }, finishes) {
  const { oak, quartz, brass, ceramic, dark, light } = finishes
  const width = 1.50, depth = 0.53
  const x = leftX + 0.12 + width / 2
  const z = backZ + depth / 2 + 0.03
  const frontZ = z + depth / 2 - 0.037
  box(root, 'spa_vanity_walnut_carcass', [width - 0.03, 0.42, depth - 0.07], [x, 0.610, z - 0.015], oak, 0.008)
  for (const sign of [-1, 1]) {
    box(root, `spa_vanity_drawer_${sign}`, [0.714, 0.374, 0.024], [x + sign * 0.365, 0.603, frontZ], oak, 0.004)
    box(root, `spa_vanity_pull_${sign}`, [0.37, 0.010, 0.022], [x + sign * 0.365, 0.796, frontZ + 0.016], brass, 0.003)
  }
  box(root, 'spa_vanity_centre_reveal', [0.010, 0.37, 0.006], [x, 0.603, frontZ + 0.014], dark, 0.001)

  // Real curved walnut reeds catch grazing light; instancing keeps the
  // fluted fronts to a single draw call rather than sixty separate meshes.
  const ribGeometry = new THREE.CylinderGeometry(0.009, 0.009, 0.365, 16)
  const reeds = new THREE.InstancedMesh(ribGeometry, oak, 58)
  reeds.name = 'spa_vanity_walnut_fluting'
  reeds.castShadow = true
  reeds.receiveShadow = true
  reeds.userData.ownedGeometry = true
  const matrix = new THREE.Matrix4()
  for (let i = 0; i < 58; i++) {
    const side = i < 29 ? -1 : 1
    const local = i % 29
    matrix.makeTranslation(x + side * 0.365 + (local - 14) * 0.024, 0.603, frontZ + 0.020)
    reeds.setMatrixAt(i, matrix)
  }
  reeds.instanceMatrix.needsUpdate = true
  reeds.computeBoundingBox()
  reeds.computeBoundingSphere()
  root.add(reeds)
  box(root, 'spa_vanity_stone_counter', [1.52, 0.040, depth], [x, 0.84, z], quartz, 0.008)
  glow(box(root, 'spa_vanity_underside_glow', [1.38, 0.005, 0.020], [x, 0.397, frontZ - 0.025], light, 0.002))
  const underlight = new THREE.PointLight('#ffffff', 0.25, 1.35, 2)
  underlight.name = 'spa_vanity_soft_underlight'
  underlight.position.set(x, 0.36, frontZ - 0.01)
  root.add(underlight)

  root.userData.basins = []
  for (const side of [-1, 1]) {
    const basinX = x + side * 0.36
    const shell = hollowShell(0.46, 0.34, 0.13)
    const basin = fixedMesh(root, `spa_basin_${side}`, shell.geometry, ceramic, [basinX, 0.86, z + 0.009])
    basin.userData.fixture = 'basin'
    basin.userData.basinDimensions = [0.46, 0.13, 0.34]
    root.userData.basins.push({ name: basin.name, width: 0.46, depth: 0.34, height: 0.13 })
    cylinder(root, `spa_basin_waste_${side}`, 0.017, 0.017, 0.003, [basinX, 0.862 + shell.innerFloorY, z + 0.009], brass)
    const rosette = cylinder(root, `spa_wall_spout_rosette_${side}`, 0.028, 0.028, 0.009, [basinX, 1.12, backZ + 0.010], brass)
    rosette.rotation.x = PI / 2
    tube(root, `spa_wall_spout_${side}`, [
      [basinX, 1.12, backZ + 0.015], [basinX, 1.135, backZ + 0.12],
      [basinX, 1.135, z - 0.037], [basinX, 1.108, z - 0.022],
    ], 0.010, brass)
    const valve = cylinder(root, `spa_wall_mixer_${side}`, 0.020, 0.021, 0.025, [basinX + 0.088, 1.12, backZ + 0.022], brass)
    valve.rotation.x = PI / 2
    box(root, `spa_wall_mixer_lever_${side}`, [0.008, 0.039, 0.025], [basinX + 0.088, 1.141, backZ + 0.041], brass, 0.003)
  }
  broadMirror(root, x, backZ, brass, light)
  cylinder(root, 'spa_soap_dispenser', 0.031, 0.035, 0.105, [x, 0.914, z + 0.05], quartz)
  cylinder(root, 'spa_soap_pump', 0.010, 0.010, 0.023, [x, 0.978, z + 0.05], brass)
  tube(root, 'spa_soap_pump_spout', [[x, 0.991, z + 0.05], [x, 0.991, z + 0.1]], 0.005, brass)
}

function soakingTub(root, { leftX, frontZ }, finishes) {
  const { brass, ceramic, oak, linen } = finishes
  const length = 1.55, width = 0.70, height = 0.57
  const x = leftX + 0.45
  const z = frontZ - 1.22
  const shell = hollowShell(length, width, height)
  const tub = fixedMesh(root, 'spa_freestanding_soaking_tub', shell.geometry, ceramic, [x, 0.002, z])
  tub.rotation.y = PI / 2
  tub.userData.fixture = 'bath'
  root.userData.soakingTub = { name: tub.name, width, length, height, position: [x, 0.002, z] }
  cylinder(root, 'spa_tub_waste', 0.023, 0.023, 0.003, [x, 0.004 + shell.innerFloorY, z], brass)
  const overflow = cylinder(root, 'spa_tub_overflow', 0.022, 0.022, 0.003, [x, 0.425, z - 0.647], brass)
  overflow.rotation.x = PI / 2

  const tapX = leftX + 0.047
  const tapZ = z - 0.32
  cylinder(root, 'spa_tub_mixer_base', 0.033, 0.036, 0.008, [tapX, 0.006, tapZ], brass)
  tube(root, 'spa_tub_floor_mixer', [
    [tapX, 0.010, tapZ], [tapX, 0.80, tapZ], [tapX + 0.026, 0.895, tapZ],
    [tapX + 0.185, 0.901, tapZ], [tapX + 0.26, 0.865, tapZ],
  ], 0.012, brass)
  const control = cylinder(root, 'spa_tub_mixer_control', 0.022, 0.022, 0.025, [tapX + 0.023, 0.755, tapZ], brass)
  control.rotation.z = PI / 2
  box(root, 'spa_tub_mixer_lever', [0.012, 0.059, 0.019], [tapX + 0.041, 0.774, tapZ], brass, 0.004)
  tube(root, 'spa_tub_handset_hose', [
    [tapX + 0.023, 0.65, tapZ + 0.03], [tapX + 0.062, 0.27, tapZ + 0.085],
    [tapX + 0.12, 0.28, tapZ + 0.10], [tapX + 0.095, 0.735, tapZ + 0.09],
  ], 0.005, brass)
  cylinder(root, 'spa_tub_handset', 0.012, 0.010, 0.15, [tapX + 0.095, 0.81, tapZ + 0.09], brass)

  box(root, 'spa_tub_walnut_bridge', [0.75, 0.016, 0.095], [x, 0.579, z + 0.27], oak, 0.006)
  const towel = cylinder(root, 'spa_rolled_linen', 0.039, 0.039, 0.20, [x + 0.11, 0.626, z + 0.27], linen, 40)
  towel.rotation.z = PI / 2
  // A small fold at the end keeps the roll from reading as a ceramic tube.
  box(root, 'spa_linen_fold', [0.20, 0.008, 0.049], [x + 0.11, 0.592, z + 0.29], linen, 0.004)
}

/** Distinct spa furnishings; all editable architecture remains in bathroom.js. */
export function addLuxuryBathroomFixtures(root, dimensions, finishes) {
  doubleVanity(root, dimensions, finishes)
  soakingTub(root, dimensions, finishes)
  const { leftX, rightX, backZ, frontZ, height } = dimensions
  const { quartz, light } = finishes
  glow(box(root, 'spa_rear_cove_reveal', [rightX - leftX - 0.08, 0.026, 0.040],
    [0, height - 0.026, backZ + 0.024], quartz, 0.003))
  glow(box(root, 'spa_rear_cove_light', [rightX - leftX - 0.11, 0.005, 0.012],
    [0, height - 0.040, backZ + 0.043], light, 0.002))
  glow(box(root, 'spa_left_cove_light', [0.012, 0.005, frontZ - backZ - 0.12],
    [leftX + 0.028, height - 0.040, 0], light, 0.002))
}
