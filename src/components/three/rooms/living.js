import * as THREE from 'three'
import { room, material, box, panel, cylinder, sphere, tube, tile, woodMaterial, fabricMaterial } from './roomKit.js'

function envelope(object) {
  object.castShadow = false
  object.userData.castShadow = false
  return object
}

function piping(root, name, width, depth, y, z, mat) {
  const r = 0.045, x = width / 2, d = depth / 2
  tube(root, name, [
    [-x + r, y, z - d], [x - r, y, z - d], [x, y, z - d + r],
    [x, y, z + d - r], [x - r, y, z + d], [-x + r, y, z + d],
    [-x, y, z + d - r], [-x, y, z - d + r], [-x + r, y, z - d],
  ], 0.0024, mat)
}

function curtain(root, name, zStart, width, fabric) {
  const columns = 56, rows = 18
  const positions = [], uv = [], indices = []
  for (let y = 0; y <= rows; y++) {
    const v = y / rows
    for (let x = 0; x <= columns; x++) {
      const u = x / columns
      const fold = Math.sin(u * Math.PI * 14)
      positions.push(-2.535 + fold * (0.019 + v * 0.018), 2.755 - v * 2.67 + Math.cos(u * Math.PI * 14) * v * 0.012, zStart + u * width)
      uv.push(u * 0.5, v * 2.4)
      if (y < rows && x < columns) {
        const i = y * (columns + 1) + x
        indices.push(i, i + 1, i + columns + 1, i + 1, i + columns + 2, i + columns + 1)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(geometry, fabric)
  mesh.name = name
  mesh.receiveShadow = true
  mesh.castShadow = true
  root.add(mesh)
}

function vase(root, name, position, scale, finish) {
  const points = [[0.0, 0], [0.075, 0], [0.095, 0.025], [0.11, 0.12], [0.085, 0.22], [0.037, 0.28], [0.036, 0.33], [0.027, 0.335], [0.026, 0.29]]
  const geometry = new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), 48)
  const object = new THREE.Mesh(geometry, finish)
  object.name = name
  object.position.set(...position)
  object.scale.setScalar(scale)
  object.castShadow = true
  object.receiveShadow = true
  root.add(object)
  return object
}

/** A furnished room seen from inside, with an uninterrupted tile floor. */
export function createLivingRoom() {
  const root = room('Living room')
  const plaster = material('#eee9df', 0.86)
  const warmWhite = material('#f4efe6', 0.62)
  const oak = woodMaterial('#a8825e')
  const darkOak = woodMaterial('#5e4532')
  const bronze = material('#514a40', 0.31, 0.75)
  const linen = fabricMaterial('#ded4c3')
  const upholstery = fabricMaterial('#c8b8a0')
  const seam = fabricMaterial('#b6a58e')
  const cream = fabricMaterial('#eee7da')
  const rust = fabricMaterial('#91664f')

  tile(root, 'living_floor', 'floor', [5.4, 0.10, 5.6], [0, -0.05, 0])
  tile(root, 'living_feature_wall', 'feature', [5.4, 2.9, 0.14], [0, 1.45, -2.87])
  tile(root, 'living_right_wall', 'wall', [0.14, 2.9, 5.6], [2.77, 1.45, 0])
  // A real opening in the left wall lets the room read as architecture.
  tile(root, 'living_window_wall_rear', 'wall', [0.14, 2.9, 1.05], [-2.77, 1.45, -2.275])
  tile(root, 'living_window_wall_front', 'wall', [0.14, 2.9, 2.15], [-2.77, 1.45, 1.725])
  tile(root, 'living_window_wall_sill', 'wall', [0.14, 0.75, 2.4], [-2.77, 0.375, -0.55])
  tile(root, 'living_window_wall_header', 'wall', [0.14, 0.3, 2.4], [-2.77, 2.75, -0.55])
  envelope(box(root, 'living_ceiling', [5.54, 0.12, 5.74], [0, 2.96, 0], plaster))
  envelope(box(root, 'living_front_wall', [5.4, 2.9, 0.14], [0, 1.45, 2.87], plaster))

  for (const [name, size, position] of [
    ['back', [5.4, 0.07, 0.018], [0, 0.035, -2.79]],
    ['left', [0.018, 0.07, 5.6], [-2.689, 0.035, 0]],
    ['right', [0.018, 0.07, 5.6], [2.689, 0.035, 0]],
    ['front', [5.4, 0.07, 0.018], [0, 0.035, 2.79]],
  ]) box(root, `living_${name}_skirting`, size, position, warmWhite, 0.003)
  envelope(box(root, 'living_ceiling_shadow_reveal', [5.32, 0.026, 0.026], [0, 2.85, -2.76], material('#b7ad9e', 0.8)))
  envelope(box(root, 'living_ceiling_lip', [5.4, 0.07, 0.075], [0, 2.855, -2.76], plaster, 0.004))

  const daylight = material('#e0e7dc', 0.7)
  daylight.emissive.set('#cdd9c8')
  daylight.emissiveIntensity = 0.2
  envelope(panel(root, 'living_window_daylight', 2.4, 1.85, [-2.79, 1.675, -0.55], [0, Math.PI / 2, 0], daylight))
  const frame = woodMaterial('#aa9477')
  for (const z of [-1.75, 0.65]) box(root, 'living_window_jamb', [0.13, 1.90, 0.045], [-2.685, 1.675, z], frame, 0.003)
  for (const y of [0.75, 2.6]) box(root, 'living_window_rail', [0.13, 0.045, 2.4], [-2.685, y, -0.55], frame, 0.003)
  box(root, 'living_window_mullion', [0.055, 1.82, 0.028], [-2.635, 1.675, -0.62], frame, 0.002)
  box(root, 'living_window_sill', [0.24, 0.038, 2.53], [-2.66, 0.746, -0.55], warmWhite, 0.005)
  const curtainLinen = fabricMaterial('#eae4d9')
  curtainLinen.side = THREE.DoubleSide
  curtain(root, 'living_linen_curtain_rear', -1.94, 0.51, curtainLinen)
  curtain(root, 'living_linen_curtain_front', 0.36, 0.53, curtainLinen)
  box(root, 'living_curtain_track', [0.055, 0.026, 2.91], [-2.53, 2.787, -0.525], warmWhite, 0.004)

  // Tailored upholstery: independent seat and back cushions, welt seams,
  // recessed timber plinth and slender metal feet rather than a solid block.
  const sofa = new THREE.Group()
  sofa.name = 'living_tailored_sofa'
  sofa.position.set(0.70, 0, -1.94)
  root.add(sofa)
  box(sofa, 'sofa_recessed_plinth', [2.62, 0.11, 0.77], [0, 0.19, 0], darkOak, 0.025)
  box(sofa, 'sofa_upholstered_base', [2.94, 0.19, 0.92], [0, 0.33, 0], upholstery, 0.065)
  box(sofa, 'sofa_back_shell', [2.94, 0.60, 0.22], [0, 0.67, -0.36], upholstery, 0.075)
  for (const x of [-1.32, 1.32]) box(sofa, 'sofa_soft_arm', [0.25, 0.39, 0.89], [x, 0.57, 0.01], upholstery, 0.075)
  for (const x of [-1.17, 1.17]) for (const z of [-0.31, 0.31]) cylinder(sofa, 'sofa_bronze_leg', 0.023, 0.016, 0.15, [x, 0.075, z], bronze, 24)
  for (let i = 0; i < 3; i++) {
    const seat = new THREE.Group()
    seat.position.x = (i - 1) * 0.79
    sofa.add(seat)
    box(seat, `sofa_seat_cushion_${i}`, [0.772, 0.18, 0.71], [0, 0.485, 0.07], linen, 0.065)
    piping(seat, `sofa_seat_welt_${i}`, 0.73, 0.66, 0.494, 0.07, seam)
    const back = box(seat, `sofa_back_cushion_${i}`, [0.77, 0.47, 0.17], [0, 0.745, -0.235], linen, 0.075)
    back.rotation.x = -0.12
  }
  const pillowLeft = box(sofa, 'sofa_ivory_scatter', [0.40, 0.40, 0.135], [-0.96, 0.77, 0.015], cream, 0.072)
  pillowLeft.rotation.set(-0.16, -0.1, -0.18)
  const pillowRight = box(sofa, 'sofa_clay_scatter', [0.43, 0.38, 0.14], [0.93, 0.76, 0.015], rust, 0.065)
  pillowRight.rotation.set(-0.15, 0.15, 0.15)

  const chair = new THREE.Group()
  chair.name = 'living_oak_lounge_chair'
  chair.position.set(-1.77, 0, -1.21)
  chair.rotation.y = 0.23
  root.add(chair)
  for (const x of [-0.335, 0.335]) {
    tube(chair, 'chair_continuous_oak_frame', [[x, 0.025, 0.36], [x, 0.42, 0.26], [x, 0.60, 0.22], [x, 0.61, -0.26], [x, 0.46, -0.34], [x, 0.025, -0.39]], 0.027, oak)
    box(chair, 'chair_flat_armrest', [0.068, 0.036, 0.62], [x, 0.617, -0.025], oak, 0.017)
  }
  box(chair, 'chair_seat_support', [0.66, 0.052, 0.65], [0, 0.365, -0.01], darkOak, 0.018)
  box(chair, 'chair_seat_pad', [0.59, 0.15, 0.60], [0, 0.439, 0.005], cream, 0.063)
  const chairBack = box(chair, 'chair_back_pad', [0.59, 0.44, 0.135], [0, 0.675, -0.26], cream, 0.060)
  chairBack.rotation.x = -0.19
  piping(chair, 'chair_seat_welt', 0.54, 0.55, 0.447, 0.005, seam)

  // Small objects stay at the room edges so customers can judge the floor.
  const tableTop = cylinder(root, 'living_side_table_top', 0.245, 0.245, 0.026, [-1.10, 0.48, -2.05], darkOak, 56)
  tableTop.scale.z = 0.84
  cylinder(root, 'living_side_table_stem', 0.045, 0.065, 0.44, [-1.10, 0.245, -2.05], darkOak)
  cylinder(root, 'living_side_table_foot', 0.18, 0.185, 0.026, [-1.10, 0.018, -2.05], darkOak)
  const book = box(root, 'living_linen_book', [0.21, 0.023, 0.15], [-1.11, 0.507, -2.04], material('#ded3bc', 0.82), 0.003)
  book.rotation.y = -0.16
  vase(root, 'living_small_stone_vessel', [-1.02, 0.52, -2.10], 0.35, material('#aba291', 0.76))

  cylinder(root, 'living_reading_lamp_base', 0.16, 0.17, 0.025, [-2.18, 0.02, -2.02], bronze)
  tube(root, 'living_reading_lamp_stem', [[-2.18, 0.03, -2.02], [-2.18, 1.27, -2.02], [-2.11, 1.46, -1.95], [-1.93, 1.47, -1.80]], 0.012, bronze)
  const shade = cylinder(root, 'living_reading_lamp_shade', 0.10, 0.15, 0.14, [-1.93, 1.42, -1.80], material('#b4a68d', 0.46, 0.25))
  shade.rotation.z = -0.12
  const lampDiffuser = material('#fff3dc', 0.4)
  lampDiffuser.emissive.set('#fff1cc')
  lampDiffuser.emissiveIntensity = 0.4
  cylinder(root, 'living_reading_lamp_diffuser', 0.137, 0.137, 0.006, [-1.93, 1.347, -1.80], lampDiffuser)

  vase(root, 'living_large_earthen_vase', [2.37, 0, -1.21], 1.8, material('#9c816b', 0.88))
  const stemMat = material('#6f7252', 0.85)
  const leafMat = material('#77815e', 0.79)
  for (let branch = 0; branch < 3; branch++) {
    const x = 2.36 + (branch - 1) * 0.065, z = -1.21 + (branch % 2) * 0.06
    const top = 1.30 + branch * 0.18
    tube(root, `living_olive_branch_${branch}`, [[2.37, 0.51, -1.21], [x, 0.9, z], [x + (branch - 1) * 0.16, top, z + 0.10]], 0.005, stemMat)
    for (let n = 0; n < 5; n++) {
      const sign = n % 2 ? 1 : -1
      const y = 0.76 + n * (top - 0.76) / 5
      const leaf = sphere(root, `living_olive_leaf_${branch}_${n}`, [0.041, 0.11, 0.011], [x + sign * 0.058, y, z + n * 0.018], leafMat)
      leaf.rotation.set(0.30, branch * 0.6, sign * 0.74)
    }
  }
  return root
}
