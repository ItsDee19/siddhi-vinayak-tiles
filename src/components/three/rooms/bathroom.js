import * as THREE from 'three'
import { createBasinGeometry } from '../modelDetails.js'
import { configureTileSurface } from '../../../utils/tileMaterial.js'
import { room, material, woodMaterial, fabricMaterial, stoneMaterial, plasterMaterial, box, panel, cylinder, tube, tile } from './roomKit.js'
import { addLuxuryBathroomFixtures } from './luxuryBathroomFixtures.js'

const FT = 0.3048
const PI = Math.PI

function architecture(object) {
  object.castShadow = false
  object.userData.castShadow = false
  return object
}

function fixedFloorMaterial(width, depth, large) {
  const sizeMM = large ? 900 : 600
  const finish = stoneMaterial(large ? '#c9beab' : '#bab5a9', {
    roughness: large ? 0.48 : 0.57, polished: false, seed: large ? 61 : 29,
  })
  // Larger, warm honed slabs distinguish the spa from the compact bathroom.
  // Both authored floors remain independent of editable wall products.
  for (const texture of [finish.map, finish.roughnessMap, finish.bumpMap]) {
    texture.repeat.set(width * 1000 / sizeMM, depth * 1000 / sizeMM)
  }
  configureTileSurface(finish, {
    tileSizeMM: [sizeMM, sizeMM], groutWidthMM: 2,
    groutColor: large ? '#aea28e' : '#8f8a80',
  })
  return finish
}

function addMirror(root, x, backZ, width, brass, light) {
  const height = 0.73
  const centreY = 1.485
  const silver = material('#d5dfda', 0.085, 0.68)
  silver.envMapIntensity = 1.25
  silver.emissive.set('#9aa7a0')
  silver.emissiveIntensity = 0.055
  box(root, 'mirror_backlight', [width + 0.028, height + 0.028, 0.014], [x, centreY, backZ + 0.015], light, 0.068)
  box(root, 'mirror_brass_frame', [width + 0.016, height + 0.016, 0.025], [x, centreY, backZ + 0.035], brass, 0.065)
  // A single planar face is required by the room's reflection camera.
  const radius = 0.058
  const left = -width / 2, right = width / 2, bottom = -height / 2, top = height / 2
  const outline = new THREE.Shape()
  outline.moveTo(left + radius, bottom)
  outline.lineTo(right - radius, bottom)
  outline.quadraticCurveTo(right, bottom, right, bottom + radius)
  outline.lineTo(right, top - radius)
  outline.quadraticCurveTo(right, top, right - radius, top)
  outline.lineTo(left + radius, top)
  outline.quadraticCurveTo(left, top, left, top - radius)
  outline.lineTo(left, bottom + radius)
  outline.quadraticCurveTo(left, bottom, left + radius, bottom)
  const face = new THREE.Mesh(new THREE.ShapeGeometry(outline, 16), silver)
  face.name = 'mirror_silver_face'
  face.position.set(x, centreY, backZ + 0.05)
  face.userData.ownedGeometry = true
  face.userData.roomMirror = true
  architecture(face)
  root.add(face)
}

function addVanity(root, { leftX, backZ, large }, finishes) {
  const { oak, quartz, dark, chrome, ceramic, brass, light, linen } = finishes
  const width = large ? 1.10 : 0.86
  const depth = 0.455
  const x = leftX + 0.095 + width / 2
  const z = backZ + depth / 2 + 0.025
  box(root, 'vanity_oak_carcass', [width - 0.025, 0.41, depth - 0.055], [x, 0.622, z - 0.01], oak, 0.006)
  for (let row = 0; row < 2; row++) {
    const y = 0.515 + row * 0.205
    box(root, `vanity_drawer_${row}`, [width - 0.04, 0.188, 0.021], [x, y, z + depth / 2 - 0.025], oak, 0.004)
    box(root, `vanity_pull_recess_${row}`, [width * 0.40, 0.008, 0.007], [x, y + 0.089, z + depth / 2 - 0.012], dark, 0.002)
  }
  box(root, 'vanity_quartz_counter', [width, 0.036, depth], [x, 0.845, z], quartz, 0.006)
  architecture(box(root, 'vanity_underside_light', [width * 0.85, 0.003, 0.012], [x, 0.414, z + 0.11], light))

  const bowlWidth = large ? 0.52 : 0.45
  const bowlDepth = 0.31
  const bowl = new THREE.Mesh(createBasinGeometry(bowlWidth, bowlDepth, 0.12, 'rect'), ceramic)
  bowl.name = 'ceramic_vessel_basin'
  bowl.position.set(x, 0.863, z + 0.01)
  bowl.castShadow = true
  bowl.receiveShadow = true
  bowl.userData.ownedGeometry = true
  bowl.userData.fixture = 'basin'
  bowl.userData.basinDimensions = [bowlWidth, 0.12, bowlDepth]
  root.userData.basins = [{ name: bowl.name, width: bowlWidth, depth: bowlDepth, height: 0.12 }]
  root.add(bowl)
  cylinder(root, 'basin_pop_up_waste', 0.017, 0.017, 0.004, [x, 0.887, z + 0.01], chrome)
  cylinder(root, 'basin_mixer_rosette', 0.021, 0.023, 0.008, [x, 0.867, backZ + 0.059], chrome)
  tube(root, 'basin_mixer_neck', [
    [x, 0.872, backZ + 0.059], [x, 1.092, backZ + 0.059],
    [x, 1.12, backZ + 0.096], [x, 1.11, z - 0.036], [x, 1.079, z - 0.018],
  ], 0.010, chrome)
  box(root, 'basin_mixer_lever', [0.009, 0.043, 0.045], [x + 0.033, 0.962, backZ + 0.066], chrome, 0.004)
  addMirror(root, x, backZ, width - 0.075, chrome, light)

  cylinder(root, 'soap_dispenser', 0.029, 0.033, 0.10, [x - width / 2 + 0.073, 0.914, z + 0.04], ceramic)
  cylinder(root, 'soap_pump_neck', 0.010, 0.010, 0.021, [x - width / 2 + 0.073, 0.974, z + 0.04], chrome)
  tube(root, 'soap_pump_spout', [[x - width / 2 + 0.073, 0.987, z + 0.04], [x - width / 2 + 0.073, 0.987, z + 0.087]], 0.005, chrome)

  const towelZ = backZ + 0.81
  const railX = leftX + 0.098
  tube(root, 'towel_rail', [[railX, 1.08, towelZ - 0.17], [railX, 1.08, towelZ + 0.17]], 0.008, chrome)
  for (const dz of [-0.17, 0.17]) tube(root, `towel_bracket_${dz}`, [[leftX + 0.005, 1.08, towelZ + dz], [railX, 1.08, towelZ + dz]], 0.007, chrome)
  const clothGeometry = new THREE.PlaneGeometry(0.25, 0.355, 20, 24)
  const positions = clothGeometry.attributes.position
  for (let i = 0; i < positions.count; i++) {
    const px = positions.getX(i), py = positions.getY(i)
    positions.setZ(i, Math.sin(px * 80) * 0.007 * (0.7 - py) + Math.sin(py * 8) * 0.004)
  }
  clothGeometry.computeVertexNormals()
  const cloth = new THREE.Mesh(clothGeometry, linen)
  cloth.name = 'folded_hand_towel'
  cloth.position.set(railX + 0.003, 0.9, towelZ)
  cloth.rotation.y = PI / 2
  cloth.castShadow = true
  cloth.receiveShadow = true
  cloth.userData.ownedGeometry = true
  root.add(cloth)
}

function addShower(root, { rightX, backZ, large }, finishes) {
  const { chrome, dark, ceramic, quartz } = finishes
  const x = rightX - (large ? 0.43 : 0.35)
  const showerDepth = large ? 1.15 : 0.75
  const screenHeight = large ? 2.10 : 1.97
  const screenX = rightX - (large ? 0.95 : 0.84)
  const glass = material('#deebe4', 0.07)
  glass.transparent = true
  glass.opacity = large ? 0.085 : 0.12
  glass.depthWrite = false
  glass.side = THREE.DoubleSide
  glass.clearcoat = 0.9
  architecture(box(root, 'walk_in_shower_screen', [0.008, screenHeight, showerDepth], [screenX, screenHeight / 2, backZ + showerDepth / 2 + 0.012], glass, 0.002))
  box(root, 'screen_floor_channel', [0.014, 0.012, showerDepth], [screenX, 0.006, backZ + showerDepth / 2 + 0.012], chrome, 0.002)
  if (large) {
    for (const y of [0.42, 1.73]) box(root, `screen_brass_clamp_${y}`, [0.018, 0.047, 0.041], [screenX, y, backZ + 0.025], chrome, 0.003)
  } else box(root, 'screen_wall_channel', [0.014, screenHeight, 0.012], [screenX, screenHeight / 2, backZ + 0.009], chrome, 0.002)
  tube(root, 'screen_upper_stabilizer', [[screenX, screenHeight - 0.025, backZ + showerDepth * 0.75], [screenX, screenHeight - 0.025, backZ + 0.01]], 0.006, chrome)

  box(root, 'shower_mixer_backplate', [0.12, 0.22, 0.015], [x, 1.025, backZ + 0.012], dark, 0.010)
  for (const y of [0.969, 1.08]) {
    const control = cylinder(root, `shower_control_${y}`, 0.028, 0.028, 0.026, [x, y, backZ + 0.032], chrome)
    control.rotation.x = PI / 2
    box(root, `shower_control_index_${y}`, [0.0025, 0.017, 0.002], [x, y + 0.005, backZ + 0.047], dark, 0.001)
  }
  tube(root, 'rain_shower_arm', [
    [x, 2.16, backZ + 0.02], [x, 2.16, backZ + 0.17],
    [x, 2.14, backZ + 0.30], [x, 2.112, backZ + 0.31],
  ], 0.010, chrome)
  cylinder(root, 'rain_shower_head', 0.125, 0.125, 0.016, [x, 2.10, backZ + 0.31], chrome, 56)
  cylinder(root, 'rain_shower_face', 0.119, 0.119, 0.002, [x, 2.09, backZ + 0.31], dark, 56)
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    if (Math.hypot(dx, dz) > 2.3) continue
    cylinder(root, `rain_nozzle_${dx}_${dz}`, 0.003, 0.003, 0.002,
      [x + dx * 0.041, 2.088, backZ + 0.31 + dz * 0.041], ceramic, 10)
  }
  const handX = x + 0.17
  tube(root, 'hand_shower_rail', [[handX, 1.08, backZ + 0.036], [handX, 1.82, backZ + 0.036]], 0.006, chrome)
  tube(root, 'hand_shower_hose', [
    [x + 0.045, 0.99, backZ + 0.04], [x + 0.05, 0.62, backZ + 0.105],
    [handX, 0.64, backZ + 0.12], [handX, 1.48, backZ + 0.076],
  ], 0.005, chrome)
  cylinder(root, 'hand_shower_handle', 0.012, 0.011, 0.15, [handX, 1.56, backZ + 0.075], chrome)
  box(root, 'hand_shower_head', [0.032, 0.09, 0.022], [handX, 1.675, backZ + 0.085], chrome, 0.014)
  box(root, 'shower_soap_ledge', [0.21, 0.014, 0.070], [x - 0.25, 1.01, backZ + 0.04], quartz, 0.003)
  cylinder(root, 'shower_soap_bottle', 0.024, 0.026, 0.12, [x - 0.25, 1.078, backZ + 0.045], ceramic)
  cylinder(root, 'shower_soap_cap', 0.016, 0.016, 0.017, [x - 0.25, 1.147, backZ + 0.045], dark)
  box(root, 'shower_linear_drain', [0.42, 0.004, 0.046], [x - 0.04, 0.003, backZ + 0.14], chrome, 0.002)
  for (let i = 0; i < 3; i++) box(root, `drain_slot_${i}`, [0.38, 0.001, 0.004], [x - 0.04, 0.0055, backZ + 0.126 + i * 0.014], dark, 0.001)
}

/** Client A/B layout: exactly two tiled walls, three horizontal height bands,
 * and a fixed stone floor whose finished footprint matches the requested feet.
 */
export function createBathroom({ widthFeet = 8, depthFeet = 5, bandsFeet = [3, 2, 3] } = {}) {
  if (!(widthFeet > 0) || !(depthFeet > 0) || bandsFeet.length !== 3 || bandsFeet.some(value => !(value > 0))
    || Math.abs(bandsFeet.reduce((sum, value) => sum + value, 0) - 8) > 1e-6) {
    throw new RangeError('Bathroom dimensions must be positive, with three wall bands totaling eight feet.')
  }
  const width = widthFeet * FT, depth = depthFeet * FT, height = 8 * FT
  const leftX = -width / 2, rightX = width / 2, backZ = -depth / 2
  const large = widthFeet >= 10 && depthFeet >= 10
  const root = room(large ? 'Large bathroom — 10 × 10 ft' : 'Small bathroom — 8 × 5 ft')
  root.userData.roomDimensions = { width, depth, height }
  root.userData.floorBounds = { min: [leftX, 0, backZ], max: [rightX, 0, depth / 2], width, depth }
  root.userData.editableWalls = ['back', 'left']
  root.userData.bandsFeet = [...bandsFeet]
  root.userData.designStyle = large ? 'walnut-spa' : 'compact-oak'

  const plaster = plasterMaterial('#e9e5dc', { roughness: 0.84 })
  const quartz = stoneMaterial('#e7e3d9', { roughness: 0.3 })
  const oak = woodMaterial(large ? '#735641' : '#a27b52')
  const dark = material('#303531', 0.4, 0.35)
  const chrome = material('#c7cbc5', 0.19, 0.92)
  const brass = material(large ? '#bea885' : '#b89a69', large ? 0.34 : 0.3, large ? 0.75 : 0.68)
  const ceramic = material('#faf9f5', 0.17)
  ceramic.clearcoat = 0.7
  ceramic.clearcoatRoughness = 0.12
  const linen = fabricMaterial('#e5e0d5')
  linen.side = THREE.DoubleSide
  const light = material('#fff0d6', 0.5)
  light.emissive.set('#ffe4bc')
  light.emissiveIntensity = 0.48

  const floor = architecture(box(root, 'bathroom_floor', [width, 0.065, depth], [0, -0.0325, 0], fixedFloorMaterial(width, depth, large)))
  floor.userData.isFloor = true
  floor.userData.fixedSurface = true

  let bottom = 0
  const ids = ['lower', 'feature', 'upper']
  root.userData.bandBounds = {}
  for (let i = 0; i < 3; i++) {
    const bandHeight = bandsFeet[i] * FT
    const centreY = bottom + bandHeight / 2
    const zone = ids[i]
    const back = tile(root, `back_wall_${zone}`, zone, [width, bandHeight, 0.025], [0, centreY, backZ - 0.0125])
    const left = tile(root, `left_wall_${zone}`, zone, [0.025, bandHeight, depth], [leftX - 0.0125, centreY, 0])
    back.userData.wall = 'back'
    left.userData.wall = 'left'
    root.userData.bandBounds[zone] = [bottom, bottom + bandHeight]
    bottom += bandHeight
  }
  // Fine mortar joints distinguish the height bands even before tile choices
  // are applied. They sit on the boundary and do not change either band size.
  const grout = material('#bcb8b0', 0.88)
  for (const boundary of [bandsFeet[0] * FT, (bandsFeet[0] + bandsFeet[1]) * FT]) {
    architecture(box(root, `back_band_joint_${boundary}`, [width, 0.002, 0.001], [0, boundary, backZ + 0.0007], grout))
    architecture(box(root, `left_band_joint_${boundary}`, [0.001, 0.002, depth], [leftX + 0.0007, boundary, 0], grout))
  }

  // Fixed painted context is intentionally non-editable. Closing the entrance
  // behind the eye keeps the room visible at the ends of its 150-degree arc
  // and gives the mirror an actual opposite wall and door to reflect.
  const right = architecture(panel(root, 'painted_right_context', depth, height, [rightX, height / 2, 0], [0, -PI / 2, 0], plaster))
  right.userData.fixedSurface = true
  architecture(box(root, 'bathroom_ceiling', [width + 0.05, 0.065, depth], [0, height + 0.0325, 0], plaster))
  const frontEdge = depth / 2
  architecture(box(root, 'right_wall_front_trim', [0.025, height, 0.025], [rightX - 0.0125, height / 2, frontEdge - 0.0125], plaster, 0.002))
  const openingWidth = large ? 0.84 : 0.76
  const doorHeight = 2.06
  const doorX = width * 0.12
  const openingLeft = doorX - openingWidth / 2
  const openingRight = doorX + openingWidth / 2
  for (const [name, start, end] of [
    ['left', leftX, openingLeft], ['right', openingRight, rightX],
  ]) {
    const wall = architecture(box(root, `painted_entry_${name}`, [end - start, height, 0.075],
      [(start + end) / 2, height / 2, frontEdge + 0.0375], plaster))
    wall.userData.fixedSurface = true
  }
  const lintel = architecture(box(root, 'painted_entry_lintel', [openingWidth, height - doorHeight, 0.075],
    [doorX, (height + doorHeight) / 2, frontEdge + 0.0375], plaster))
  lintel.userData.fixedSurface = true
  const door = architecture(box(root, 'bathroom_entry_door', [openingWidth - 0.03, doorHeight - 0.026, 0.034],
    [doorX, doorHeight / 2, frontEdge + 0.023], oak, 0.004))
  door.userData.fixedSurface = true
  for (const x of [openingLeft, openingRight]) architecture(box(root, `entry_door_jamb_${x}`,
    [0.036, doorHeight + 0.018, 0.045], [x, doorHeight / 2, frontEdge - 0.006], quartz, 0.003))
  architecture(box(root, 'entry_door_head', [openingWidth + 0.036, 0.036, 0.045],
    [doorX, doorHeight, frontEdge - 0.006], quartz, 0.003))
  const leverX = openingRight - 0.105
  box(root, 'entry_door_lever_backplate', [0.036, 0.11, 0.007], [leverX, 1.01, frontEdge + 0.001], chrome, 0.01)
  box(root, 'entry_door_lever', [0.09, 0.012, 0.037], [leverX - 0.026, 1.024, frontEdge - 0.019], chrome, 0.005)

  const finishes = { oak, quartz, dark, chrome, ceramic, brass, light, linen }
  if (large) {
    addLuxuryBathroomFixtures(root, { leftX, rightX, backZ, frontZ: depth / 2, height }, finishes)
    addShower(root, { rightX, backZ, large }, { ...finishes, chrome: brass })
  } else {
    addVanity(root, { leftX, backZ, large }, finishes)
    addShower(root, { rightX, backZ, large }, finishes)
  }
  for (const x of [-width * 0.25, width * 0.25]) {
    architecture(cylinder(root, `ceiling_light_trim_${x}`, 0.055, 0.055, 0.007, [x, height - 0.005, -depth * 0.1], plaster))
    architecture(cylinder(root, `ceiling_light_lens_${x}`, 0.041, 0.041, 0.008, [x, height - 0.011, -depth * 0.1], light))
  }
  return root
}
