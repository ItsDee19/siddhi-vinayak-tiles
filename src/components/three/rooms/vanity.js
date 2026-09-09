import * as THREE from 'three'
import { createBasinGeometry } from '../modelDetails.js'
import { room, material, woodMaterial, fabricMaterial, stoneMaterial, plasterMaterial, box, panel, cylinder, tube, tile } from './roomKit.js'

const FOOT = 0.3048
const WIDTH = 10 * FOOT
const BACK_HEIGHT = 5 * FOOT
const COUNTER_HEIGHT = 2.5 * FOOT
const DEPTH = 2 * FOOT
const COUNTER_THICKNESS = 0.036
const ROOM_WIDTH = 4.5
const ROOM_HEIGHT = 2.7
const ROOM_DEPTH = 5.1

function architecture(object) {
  object.castShadow = false
  object.userData.castShadow = false
  return object
}

function mirror(root, finish) {
  const width = 0.94, height = 0.58, radius = 0.06
  const left = -width / 2, right = width / 2, bottom = -height / 2, top = height / 2
  const shape = new THREE.Shape()
  shape.moveTo(left + radius, bottom)
  shape.lineTo(right - radius, bottom)
  shape.quadraticCurveTo(right, bottom, right, bottom + radius)
  shape.lineTo(right, top - radius)
  shape.quadraticCurveTo(right, top, right - radius, top)
  shape.lineTo(left + radius, top)
  shape.quadraticCurveTo(left, top, left, top - radius)
  shape.lineTo(left, bottom + radius)
  shape.quadraticCurveTo(left, bottom, left + radius, bottom)
  const face = new THREE.Mesh(new THREE.ShapeGeometry(shape, 18), finish)
  face.name = 'mirror_silver_face'
  face.position.set(0, 1.64, 0.047)
  face.receiveShadow = true
  face.userData.ownedGeometry = true
  face.userData.roomMirror = true
  architecture(face)
  root.add(face)
}

/** A separately owned fixture can change without recreating the tiled room. */
export function createVanityBasin(basinProduct = null) {
  const root = room('vanity_basin_fixture')
  root.userData.fixtureSelectionId = 'basin'
  const fallback = [600, 400, 150]
  const dimensions = fallback.map((value, index) => {
    const supplied = basinProduct?.dimensionsMM?.[index]
    return (Number.isFinite(supplied) && supplied > 0 ? supplied : value) / 1000
  })
  const [width, depth, height] = dimensions
  root.userData.dimensions = { width, depth, height }
  root.userData.basinProductId = basinProduct?.id ?? null
  const isMatte = /matt/i.test(basinProduct?.finish || '')
  const ceramic = material(basinProduct?.color || '#ffffff', isMatte ? 0.38 : 0.13)
  ceramic.clearcoat = isMatte ? 0.08 : 0.65
  ceramic.clearcoatRoughness = isMatte ? 0.32 : 0.11
  const chrome = material('#d7dcd5', 0.17, 0.93)
  const dark = material('#494b42', 0.52)
  const geometry = createBasinGeometry(width, depth, height, basinProduct?.shape === 'oval' ? 'vessel' : 'rect')
  // Normalize the procedural envelope to the stated product size. Authored
  // Blender shells inherit these exact bounds when they replace this geometry.
  const bounds = geometry.boundingBox
  const size = bounds.getSize(new THREE.Vector3())
  geometry.translate(0, -bounds.min.y, 0)
  geometry.scale(width / size.x, height / size.y, depth / size.z)
  geometry.computeBoundingBox()
  const basinZ = DEPTH / 2 + 0.045
  const bowl = new THREE.Mesh(geometry, ceramic)
  bowl.name = 'vanity_vessel_basin_center'
  bowl.position.set(0, COUNTER_HEIGHT + 0.0005, basinZ)
  bowl.castShadow = true
  bowl.receiveShadow = true
  bowl.userData.ownedGeometry = true
  bowl.userData.authoredSource = basinProduct?.assetMeshName || 'basin_vanity'
  bowl.userData.authoredWasteName = 'vanity_basin_waste_center'
  root.add(bowl)
  cylinder(root, 'vanity_basin_waste_center', 0.019, 0.019, 0.004, [0, bowl.position.y + height * 0.18 + 0.002, basinZ], chrome, 40)
  const faucetZ = 0.065
  const rimY = COUNTER_HEIGHT + height + 0.0005
  const spoutY = rimY + 0.09
  const outletZ = basinZ - depth * 0.10
  cylinder(root, 'vanity_mixer_rosette_center', 0.026, 0.028, 0.009, [0, COUNTER_HEIGHT + 0.005, faucetZ], chrome, 40)
  tube(root, 'vanity_mixer_neck_center', [
    [0, COUNTER_HEIGHT + 0.009, faucetZ], [0, spoutY, faucetZ],
    [0, spoutY + 0.037, faucetZ + 0.045], [0, spoutY + 0.030, outletZ - 0.015], [0, spoutY, outletZ],
  ], 0.012, chrome)
  cylinder(root, 'vanity_mixer_aerator_center', 0.0125, 0.0125, 0.017, [0, spoutY - 0.010, outletZ], chrome, 32)
  tube(root, 'vanity_mixer_lever_mount_center', [[0, COUNTER_HEIGHT + 0.055, faucetZ], [0.046, COUNTER_HEIGHT + 0.055, faucetZ]], 0.013, chrome)
  box(root, 'vanity_mixer_lever_center', [0.011, 0.07, 0.031], [0.047, COUNTER_HEIGHT + 0.088, faucetZ], chrome, 0.005)
  box(root, 'vanity_mixer_index_center', [0.002, 0.018, 0.002], [0.047, COUNTER_HEIGHT + 0.108, faucetZ + 0.0165], dark, 0.0005)
  root.traverse(object => { if (object.isMesh) object.userData.fixtureSelectionId = 'basin' })
  root.updateMatrixWorld(true)
  const interior = new THREE.Raycaster(new THREE.Vector3(0, rimY + 0.05, basinZ), new THREE.Vector3(0, -1, 0)).intersectObject(bowl, false)[0]
  if (interior) root.getObjectByName('vanity_basin_waste_center').position.y = interior.point.y - 0.0005
  return root
}

function foldedTowels(root, x, linen) {
  for (let layer = 0; layer < 3; layer++) {
    const towel = box(root, `vanity_folded_towel_${layer}`, [0.29, 0.027, 0.21], [x + layer * 0.005, COUNTER_HEIGHT + 0.014 + layer * 0.025, 0.38], linen, 0.012)
    towel.rotation.y = -0.06 + layer * 0.025
    tube(root, `vanity_towel_hem_${layer}`, [[x - 0.135, COUNTER_HEIGHT + 0.009 + layer * 0.025, 0.482], [x + 0.135, COUNTER_HEIGHT + 0.009 + layer * 0.025, 0.482]], 0.0015, linen)
  }
}

/** Exact 10 ft wash counter with a 5 ft tiled wall ABOVE its 2.5 ft top. */
export function createVanity({ basinProduct, includeBasin = true } = {}) {
  const root = room('10 ft single basin wall')
  root.userData.dimensions = { width: WIDTH, backWallHeight: BACK_HEIGHT, counterHeight: COUNTER_HEIGHT, counterDepth: DEPTH }
  const plaster = plasterMaterial('#e9e5db', { roughness: 0.85 })
  const limestone = stoneMaterial('#cbc5b8', { polished: false, roughness: 0.61, scale: 4 })
  const quartz = stoneMaterial('#e7e3d8', { roughness: 0.23, scale: 2 })
  quartz.clearcoat = 0.22
  quartz.clearcoatRoughness = 0.18
  const oak = woodMaterial('#aa8763')
  const dark = material('#494b42', 0.52)
  const bronze = material('#b59a6e', 0.31, 0.73)
  const ceramic = material('#faf9f4', 0.13)
  ceramic.clearcoat = 0.65
  ceramic.clearcoatRoughness = 0.11
  const linen = fabricMaterial('#d8d0bd')
  const light = material('#ffffff', 0.5)
  light.emissive.set('#ffffff')
  light.emissiveIntensity = 0.5

  const floor = architecture(box(root, 'vanity_fixed_limestone_floor', [ROOM_WIDTH + 0.24, 0.1, ROOM_DEPTH + 0.24], [0, -0.05, ROOM_DEPTH / 2 - 0.06], limestone))
  floor.userData.isFloor = true
  architecture(box(root, 'vanity_room_backing', [ROOM_WIDTH + 0.24, ROOM_HEIGHT, 0.10], [0, ROOM_HEIGHT / 2, -0.13], plaster))
  architecture(box(root, 'vanity_room_left_wall', [0.12, ROOM_HEIGHT, ROOM_DEPTH + 0.18], [-ROOM_WIDTH / 2 - 0.06, ROOM_HEIGHT / 2, ROOM_DEPTH / 2 - 0.09], plaster))
  architecture(box(root, 'vanity_room_right_rear', [0.12, ROOM_HEIGHT, 1.75], [ROOM_WIDTH / 2 + 0.06, ROOM_HEIGHT / 2, 0.695], plaster))
  architecture(box(root, 'vanity_room_right_front', [0.12, ROOM_HEIGHT, 1.85], [ROOM_WIDTH / 2 + 0.06, ROOM_HEIGHT / 2, 4.175], plaster))
  architecture(box(root, 'vanity_window_lower_wall', [0.12, 0.8, 1.68], [ROOM_WIDTH / 2 + 0.06, 0.4, 2.41], plaster))
  architecture(box(root, 'vanity_window_upper_wall', [0.12, 0.3, 1.68], [ROOM_WIDTH / 2 + 0.06, 2.55, 2.41], plaster))
  architecture(box(root, 'vanity_room_ceiling', [ROOM_WIDTH + 0.24, 0.12, ROOM_DEPTH + 0.24], [0, ROOM_HEIGHT + 0.06, ROOM_DEPTH / 2 - 0.06], plaster))
  architecture(box(root, 'vanity_entrance_wall', [ROOM_WIDTH + 0.24, ROOM_HEIGHT, 0.12], [0, ROOM_HEIGHT / 2, ROOM_DEPTH + 0.06], plaster))
  architecture(box(root, 'vanity_entrance_oak_door', [0.92, 2.16, 0.038], [-0.12, 1.08, ROOM_DEPTH - 0.02], oak, 0.004))
  for (const x of [-0.60, 0.36]) box(root, 'vanity_door_jamb', [0.04, 2.2, 0.032], [x, 1.10, ROOM_DEPTH - 0.042], dark, 0.002)
  box(root, 'vanity_door_lintel', [1.0, 0.04, 0.032], [-0.12, 2.18, ROOM_DEPTH - 0.042], dark, 0.002)
  box(root, 'vanity_door_lever', [0.11, 0.014, 0.037], [0.2, 1.01, ROOM_DEPTH - 0.058], bronze, 0.005)

  const daylight = material('#e0e0e0', 0.7)
  daylight.emissive.set('#ffffff')
  daylight.emissiveIntensity = 0.20
  architecture(panel(root, 'vanity_window_daylight', 1.68, 1.6, [ROOM_WIDTH / 2 + 0.095, 1.6, 2.41], [0, -Math.PI / 2, 0], daylight))
  for (const z of [1.57, 2.41, 3.25]) box(root, `vanity_window_mullion_${z}`, [0.08, 1.64, 0.032], [ROOM_WIDTH / 2 - 0.025, 1.6, z], oak, 0.003)
  for (const y of [0.8, 2.4]) box(root, `vanity_window_rail_${y}`, [0.08, 0.035, 1.75], [ROOM_WIDTH / 2 - 0.025, y, 2.41], oak, 0.003)

  // All editable upper panels are exactly 5 ft tall, starting at the finished
  // counter height. Their inside faces meet the counter and back wall flush.
  tile(root, 'vanity_back_wall', 'backWall', [WIDTH, BACK_HEIGHT, 0.08], [0, COUNTER_HEIGHT + BACK_HEIGHT / 2, -0.04])
  for (const sign of [-1, 1]) {
    tile(root, `vanity_upper_side_return_${sign}`, 'sideReturns', [0.08, BACK_HEIGHT, DEPTH],
      [sign * (WIDTH / 2 + 0.04), COUNTER_HEIGHT + BACK_HEIGHT / 2, DEPTH / 2])
  }
  box(root, 'vanity_quartz_counter', [WIDTH, COUNTER_THICKNESS, DEPTH], [0, COUNTER_HEIGHT - COUNTER_THICKNESS / 2, DEPTH / 2], quartz, 0.003)
  const apronHeight = COUNTER_HEIGHT - COUNTER_THICKNESS
  tile(root, 'vanity_front_apron', 'frontPanel', [WIDTH, apronHeight, 0.018], [0, apronHeight / 2, DEPTH - 0.009])
  // Fixed side cheeks and a recessed carcass support the apron without a
  // second coplanar face behind its tile or the finished quartz worktop.
  for (const sign of [-1, 1]) box(root, `vanity_quartz_base_cheek_${sign}`, [0.018, apronHeight, DEPTH - 0.018],
    [sign * (WIDTH / 2 - 0.009), apronHeight / 2, (DEPTH - 0.018) / 2], quartz, 0.002)
  architecture(box(root, 'vanity_recessed_carcass', [WIDTH - 0.046, apronHeight - 0.03, DEPTH - 0.047], [0, (apronHeight - 0.03) / 2, (DEPTH - 0.047) / 2 + 0.006], plaster))
  architecture(box(root, 'vanity_under_counter_light', [WIDTH - 0.07, 0.004, 0.008], [0, apronHeight - 0.013, DEPTH + 0.0045], light))

  if (includeBasin) root.add(createVanityBasin(basinProduct))
  const silver = material('#d8e0dc', 0.08, 0.68)
  silver.envMapIntensity = 1.2
  architecture(box(root, 'vanity_mirror_backlight', [0.976, 0.616, 0.009], [0, 1.64, 0.012], light, 0.069))
  box(root, 'vanity_mirror_bronze_frame', [0.962, 0.602, 0.024], [0, 1.64, 0.031], bronze, 0.065)
  mirror(root, silver)
  // The compact single mirror leaves almost nine tenths of the back wall tiled.
  architecture(box(root, 'vanity_wall_wash_lip', [WIDTH, 0.025, 0.065], [0, COUNTER_HEIGHT + BACK_HEIGHT + 0.013, 0.028], plaster, 0.003))
  architecture(box(root, 'vanity_wall_wash_diffuser', [WIDTH - 0.08, 0.005, 0.016], [0, COUNTER_HEIGHT + BACK_HEIGHT - 0.001, 0.031], light))

  foldedTowels(root, -0.90, linen)
  cylinder(root, 'vanity_soap_dispenser', 0.03, 0.033, 0.115, [0.49, COUNTER_HEIGHT + 0.058, 0.20], ceramic, 40)
  cylinder(root, 'vanity_soap_pump_neck', 0.011, 0.012, 0.022, [0.49, COUNTER_HEIGHT + 0.126, 0.20], bronze, 28)
  tube(root, 'vanity_soap_pump_spout', [[0.49, COUNTER_HEIGHT + 0.14, 0.20], [0.49, COUNTER_HEIGHT + 0.14, 0.259]], 0.005, bronze)
  box(root, 'vanity_small_quartz_tray', [0.24, 0.018, 0.17], [1.28, COUNTER_HEIGHT + 0.009, 0.25], quartz, 0.018)
  cylinder(root, 'vanity_lidded_ceramic_jar', 0.04, 0.042, 0.072, [1.28, COUNTER_HEIGHT + 0.054, 0.25], ceramic, 40)
  cylinder(root, 'vanity_ceramic_jar_lid', 0.043, 0.043, 0.012, [1.28, COUNTER_HEIGHT + 0.096, 0.25], ceramic, 40)
  for (const x of [-1.02, 1.02]) {
    architecture(cylinder(root, `vanity_ceiling_downlight_trim_${x}`, 0.065, 0.065, 0.008, [x, ROOM_HEIGHT - 0.005, 1.5], plaster, 40))
    architecture(cylinder(root, `vanity_ceiling_downlight_lens_${x}`, 0.045, 0.045, 0.009, [x, ROOM_HEIGHT - 0.010, 1.5], light, 40))
  }
  return root
}
