import * as THREE from 'three'
import { room, material, box, panel, cylinder, sphere, tube, tile, woodMaterial, fabricMaterial } from './roomKit.js'
import { createBasinGeometry } from '../modelDetails.js'

function envelope(object) {
  object.castShadow = false
  object.userData.castShadow = false
  return object
}

function torus(root, name, radius, thickness, position, mat, rotation = [-Math.PI / 2, 0, 0]) {
  const object = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 8, 56), mat)
  object.name = name
  object.position.set(...position)
  object.rotation.set(...rotation)
  object.castShadow = true
  object.receiveShadow = true
  root.add(object)
  return object
}

function bottle(root, name, position, finish, height = 0.25) {
  const [x, y, z] = position
  cylinder(root, `${name}_body`, 0.035, 0.034, height * 0.73, [x, y + height * 0.365, z], finish, 32)
  sphere(root, `${name}_shoulder`, [0.035, 0.035, 0.035], [x, y + height * 0.72, z], finish)
  cylinder(root, `${name}_neck`, 0.014, 0.02, height * 0.22, [x, y + height * 0.85, z], finish, 24)
  cylinder(root, `${name}_cap`, 0.016, 0.016, 0.025, [x, y + height, z], material('#554c3c', 0.49), 24)
}

function cup(root, name, position, mat) {
  const points = [[0.037, 0], [0.044, 0.013], [0.049, 0.09], [0.049, 0.105], [0.043, 0.108], [0.043, 0.096], [0.037, 0.013], [0, 0.013]]
  const geometry = new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), 36)
  const object = new THREE.Mesh(geometry, mat)
  object.name = name
  object.position.set(...position)
  object.castShadow = true
  object.receiveShadow = true
  root.add(object)
  const handle = torus(root, `${name}_handle`, 0.029, 0.006, [position[0] + 0.055, position[1] + 0.058, position[2]], mat, [0, 0, 0])
  handle.scale.x = 0.75
}

/** Full kitchen architecture, with the tile floor and backsplash unobscured. */
export function createKitchen() {
  const root = room('Kitchen')
  const plaster = material('#eeebe3', 0.86)
  const quartz = material('#e8e5dc', 0.27)
  quartz.clearcoat = 0.18
  quartz.clearcoatRoughness = 0.28
  const oak = woodMaterial('#aa8965')
  const painted = material('#b7b3a7', 0.47)
  const dark = material('#292d2b', 0.32, 0.20)
  const brushedSteel = material('#b6c0bd', 0.25, 0.92)
  const chrome = material('#dce2df', 0.16, 0.96)
  const bronze = material('#665e4e', 0.32, 0.72)
  const ceramic = material('#e5dfd2', 0.26)

  tile(root, 'kitchen_floor', 'floor', [4.2, 0.10, 4.6], [0, -0.05, 0])
  tile(root, 'kitchen_backsplash', 'backsplash', [4.2, 1.68, 0.12], [0, 1.76, -2.36])
  envelope(box(root, 'kitchen_lower_rear_wall', [4.2, 0.92, 0.12], [0, 0.46, -2.36], plaster))
  envelope(box(root, 'kitchen_upper_rear_wall', [4.2, 0.2, 0.12], [0, 2.7, -2.36], plaster))
  tile(root, 'kitchen_right_wall', 'wall', [0.12, 2.8, 4.6], [2.16, 1.4, 0])
  // Side daylight opening, framed within complete walls rather than painted
  // onto a box. Its position leaves the cabinet run and backsplash continuous.
  tile(root, 'kitchen_left_wall_rear', 'wall', [0.12, 2.8, 1.15], [-2.16, 1.4, -1.725])
  tile(root, 'kitchen_left_wall_front', 'wall', [0.12, 2.8, 1.65], [-2.16, 1.4, 1.475])
  tile(root, 'kitchen_left_wall_below_window', 'wall', [0.12, 1.0, 1.8], [-2.16, 0.5, -0.25])
  tile(root, 'kitchen_left_wall_above_window', 'wall', [0.12, 0.25, 1.8], [-2.16, 2.675, -0.25])
  envelope(box(root, 'kitchen_ceiling', [4.32, 0.12, 4.72], [0, 2.86, 0], plaster))
  envelope(box(root, 'kitchen_front_wall', [4.2, 2.8, 0.12], [0, 1.4, 2.36], plaster))
  for (const x of [-2.09, 2.09]) box(root, 'kitchen_side_skirting', [0.018, 0.068, 4.6], [x, 0.034, 0], plaster, 0.003)

  const daylight = material('#e2e9df', 0.7)
  daylight.emissive.set('#d2dfca')
  daylight.emissiveIntensity = 0.19
  envelope(panel(root, 'kitchen_window_daylight', 1.8, 1.55, [-2.19, 1.775, -0.25], [0, Math.PI / 2, 0], daylight))
  for (const z of [-1.15, 0.65]) box(root, 'kitchen_window_jamb', [0.12, 1.60, 0.038], [-2.085, 1.775, z], oak, 0.003)
  for (const y of [1.0, 2.55]) box(root, 'kitchen_window_rail', [0.12, 0.038, 1.8], [-2.085, y, -0.25], oak, 0.003)
  box(root, 'kitchen_window_mullion', [0.04, 1.48, 0.025], [-2.04, 1.775, -0.2], oak, 0.002)
  box(root, 'kitchen_window_sill', [0.21, 0.028, 1.87], [-2.07, 0.994, -0.25], quartz, 0.004)
  const blindFabric = fabricMaterial('#d8d2c3')
  for (let fold = 0; fold < 5; fold++) {
    box(root, `kitchen_roman_blind_fold_${fold}`, [0.045, 0.078, 1.84], [-1.99 + fold * 0.002, 2.495 - fold * 0.064, -0.25], blindFabric, 0.015)
  }
  tube(root, 'kitchen_blind_pull', [[-1.98, 2.47, 0.54], [-1.98, 1.86, 0.54], [-1.98, 1.80, 0.56], [-1.98, 1.85, 0.59], [-1.98, 2.47, 0.59]], 0.0022, material('#9c9687', 0.8))

  // A 3.8m cabinet run with an inset toe kick, deliberate reveal gaps,
  // varied drawers and a built-in oven. No island covers the customer's floor.
  box(root, 'kitchen_recessed_toe_kick', [3.75, 0.14, 0.44], [0, 0.07, -1.98], material('#514b43', 0.78), 0.006)
  // Keep the carcass below the sink bowl; a solid cabinet box up to the
  // worktop would invisibly fill the otherwise correctly cut-out basin.
  box(root, 'kitchen_cabinet_carcass', [3.8, 0.55, 0.58], [0, 0.415, -1.965], painted, 0.008)
  box(root, 'kitchen_cabinet_rear_rail', [3.8, 0.16, 0.03], [0, 0.804, -2.24], painted, 0.005)
  box(root, 'kitchen_cabinet_front_rail', [3.8, 0.16, 0.03], [0, 0.804, -1.677], painted, 0.005)
  const widths = [0.65, 0.65, 0.60, 0.70, 0.60, 0.60]
  let cursor = -1.9
  const handles = []
  widths.forEach((width, i) => {
    const x = cursor + width / 2
    cursor += width
    if (i === 4) return // the oven occupies this entire front
    const finish = i < 2 ? painted : oak
    const rows = i < 2 ? [[0.518, 0.722]] : [[0.765, 0.228], [0.516, 0.258], [0.263, 0.232]]
    rows.forEach(([y, height], row) => {
      box(root, `kitchen_cabinet_${i}_front_${row}`, [width - 0.009, height, 0.024], [x, y, -1.662], finish, 0.005)
      handles.push([x, y + height / 2 - 0.047, -1.638, Math.min(width - 0.16, 0.30)])
    })
  })
  handles.forEach(([x, y, z, width], i) => {
    box(root, `kitchen_pull_${i}`, [width, 0.012, 0.022], [x, y, z + 0.014], bronze, 0.005)
    for (const dx of [-width / 2 + 0.022, width / 2 - 0.022]) box(root, `kitchen_pull_standoff_${i}`, [0.013, 0.013, 0.019], [x + dx, y, z + 0.002], bronze, 0.003)
  })
  for (const x of [-1.91, 1.91]) box(root, 'kitchen_cabinet_end_panel', [0.022, 0.78, 0.63], [x, 0.51, -1.96], oak, 0.004)

  // The quartz top is built around a real sink opening. No solid countertop
  // crosses the bowl, so its rim, inner walls and drain remain visible.
  const topY = 0.918
  box(root, 'kitchen_quartz_left', [0.54, 0.035, 0.68], [-1.66, topY, -1.92], quartz, 0.005)
  box(root, 'kitchen_quartz_right', [2.64, 0.035, 0.68], [0.61, topY, -1.92], quartz, 0.005)
  box(root, 'kitchen_quartz_sink_front', [0.68, 0.035, 0.125], [-1.05, topY, -1.6425], quartz, 0.004)
  box(root, 'kitchen_quartz_sink_rear', [0.68, 0.035, 0.125], [-1.05, topY, -2.1975], quartz, 0.004)
  const basin = new THREE.Mesh(createBasinGeometry(0.674, 0.447, 0.18, 'rect'), brushedSteel)
  basin.name = 'kitchen_recessed_stainless_sink'
  basin.position.set(-1.05, 0.759, -1.92)
  basin.castShadow = true
  basin.receiveShadow = true
  root.add(basin)
  cylinder(root, 'kitchen_sink_drain', 0.031, 0.031, 0.004, [-1.05, 0.794, -1.92], chrome, 40)
  for (let hole = 0; hole < 7; hole++) {
    const angle = hole / 7 * Math.PI * 2
    cylinder(root, `kitchen_drain_slot_${hole}`, 0.0035, 0.0035, 0.001, [-1.05 + Math.sin(angle) * 0.018, 0.7965, -1.92 + Math.cos(angle) * 0.018], dark, 12)
  }
  cylinder(root, 'kitchen_mixer_base', 0.025, 0.027, 0.012, [-1.05, 0.945, -2.2], chrome)
  tube(root, 'kitchen_curved_mixer', [[-1.05, 0.943, -2.2], [-1.05, 1.19, -2.2], [-1.05, 1.29, -2.16], [-1.05, 1.285, -1.98], [-1.05, 1.23, -1.94]], 0.012, chrome)
  cylinder(root, 'kitchen_mixer_aerator', 0.013, 0.013, 0.023, [-1.05, 1.218, -1.94], chrome, 28)
  box(root, 'kitchen_mixer_lever', [0.012, 0.095, 0.02], [-0.993, 1.012, -2.2], chrome, 0.006)
  tube(root, 'kitchen_mixer_lever_mount', [[-1.05, 0.988, -2.2], [-0.995, 0.988, -2.2]], 0.015, chrome)

  const hobGlass = material('#17201e', 0.11, 0.20)
  box(root, 'kitchen_induction_hob', [0.83, 0.012, 0.48], [1.00, 0.943, -1.92], hobGlass, 0.012)
  const ringMat = material('#6d7975', 0.52, 0.12)
  for (const [x, z, radius] of [[0.77, -2.04, 0.087], [1.20, -2.04, 0.072], [0.77, -1.82, 0.070], [1.20, -1.82, 0.093]]) {
    torus(root, 'kitchen_induction_ring', radius, 0.0012, [x, 0.950, z], ringMat)
    torus(root, 'kitchen_induction_inner_ring', radius - 0.012, 0.0008, [x, 0.950, z], ringMat)
  }
  for (let i = 0; i < 4; i++) cylinder(root, `kitchen_hob_touch_${i}`, 0.007, 0.007, 0.001, [0.90 + i * 0.060, 0.9505, -1.708], ringMat, 16)
  box(root, 'kitchen_oven_frame', [0.582, 0.724, 0.034], [1.00, 0.518, -1.646], brushedSteel, 0.007)
  box(root, 'kitchen_oven_door', [0.548, 0.484, 0.028], [1.00, 0.424, -1.62], hobGlass, 0.008)
  box(root, 'kitchen_oven_glass_inner', [0.444, 0.317, 0.006], [1.00, 0.409, -1.602], material('#28302d', 0.14, 0.28), 0.012)
  box(root, 'kitchen_oven_control_strip', [0.547, 0.111, 0.019], [1.00, 0.771, -1.618], dark, 0.004)
  for (const x of [0.815, 1.185]) {
    const knob = cylinder(root, 'kitchen_oven_dial', 0.022, 0.022, 0.019, [x, 0.769, -1.598], brushedSteel, 32)
    knob.rotation.x = Math.PI / 2
  }
  box(root, 'kitchen_oven_handle', [0.411, 0.021, 0.037], [1, 0.651, -1.583], brushedSteel, 0.009)
  for (const x of [0.82, 1.18]) box(root, 'kitchen_oven_handle_bracket', [0.022, 0.024, 0.031], [x, 0.651, -1.606], brushedSteel, 0.005)

  // One slim shelf and a restrained collection of real objects leave most
  // of the backsplash uninterrupted for tile comparison.
  box(root, 'kitchen_open_oak_shelf', [1.66, 0.035, 0.19], [-0.88, 2.04, -2.15], oak, 0.004)
  for (const x of [-1.47, -0.30]) box(root, 'kitchen_shelf_bracket', [0.018, 0.14, 0.15], [x, 1.976, -2.19], bronze, 0.003)
  const shelfY = 2.058
  cup(root, 'kitchen_shelf_cup_sand', [-1.44, shelfY, -2.14], ceramic)
  cup(root, 'kitchen_shelf_cup_clay', [-1.25, shelfY, -2.14], material('#a88c74', 0.44))
  cup(root, 'kitchen_shelf_cup_cream', [-1.07, shelfY, -2.14], ceramic)
  box(root, 'kitchen_shelf_book_linen', [0.24, 0.024, 0.145], [-0.58, shelfY + 0.012, -2.15], material('#b5ac96', 0.83), 0.002)
  const shelfBook = box(root, 'kitchen_shelf_book_cream', [0.215, 0.019, 0.135], [-0.58, shelfY + 0.034, -2.15], material('#ded8c8', 0.85), 0.002)
  shelfBook.rotation.y = 0.09

  const board = box(root, 'kitchen_chopping_board_tall', [0.23, 0.34, 0.023], [-0.17, 1.107, -2.237], oak, 0.035)
  board.rotation.x = -0.09
  const smallBoard = box(root, 'kitchen_chopping_board_small', [0.25, 0.25, 0.023], [-0.03, 1.066, -2.203], woodMaterial('#826344'), 0.024)
  smallBoard.rotation.set(-0.08, 0, -0.08)
  bottle(root, 'kitchen_olive_oil', [1.66, 0.936, -2.125], material('#556347', 0.23), 0.26)
  bottle(root, 'kitchen_small_oil', [1.79, 0.936, -2.105], material('#8a7146', 0.28), 0.20)
  cylinder(root, 'kitchen_salt_cellar', 0.045, 0.046, 0.075, [1.60, 0.976, -1.89], ceramic)
  cylinder(root, 'kitchen_salt_cellar_lid', 0.047, 0.047, 0.010, [1.60, 1.019, -1.89], oak)
  cylinder(root, 'kitchen_soap_dispenser', 0.027, 0.029, 0.107, [-1.62, 0.991, -2.16], ceramic, 32)
  tube(root, 'kitchen_soap_pump', [[-1.62, 1.047, -2.16], [-1.62, 1.081, -2.16], [-1.57, 1.081, -2.16]], 0.006, bronze)

  // Small recessed ceiling fittings supplement the broad window daylight.
  const light = material('#fff2d6', 0.45)
  light.emissive.set('#fff0ce')
  light.emissiveIntensity = 0.5
  for (const x of [-1.2, 1.2]) {
    envelope(cylinder(root, 'kitchen_downlight_trim', 0.067, 0.067, 0.010, [x, 2.793, -0.60], plaster))
    envelope(cylinder(root, 'kitchen_downlight_diffuser', 0.047, 0.047, 0.012, [x, 2.787, -0.60], light))
  }
  return root
}
