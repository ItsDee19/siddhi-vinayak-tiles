import * as THREE from 'three'
import { room, material, woodMaterial, fabricMaterial, stoneMaterial, plasterMaterial, box, panel, cylinder, tube, tile } from './roomKit.js'

const FOOT = 0.3048
const WALL_WIDTH = 30 * FOOT
const WALL_HEIGHT = 10 * FOOT
const ROOM_DEPTH = 8.6

function architecture(object) {
  object.castShadow = false
  object.userData.castShadow = false
  return object
}

// A tapered blade with a raised midrib and a curled tip. Each leaf is a small
// two-sided surface, rather than an opaque oval that reads as plastic foliage.
function leafGeometry(length, halfWidth, curl) {
  const positions = [], uvs = [], indices = []
  const rows = 10, columns = 4
  for (let row = 0; row <= rows; row++) {
    const t = row / rows
    const envelope = Math.sin(Math.PI * t) ** 0.8
    for (let column = 0; column <= columns; column++) {
      const s = column / columns * 2 - 1
      positions.push(s * halfWidth * envelope, t * length,
        envelope * (0.006 * (1 - Math.abs(s)) - 0.004 * s * s) + curl * t * t + s * t * 0.007)
      uvs.push(column / columns, t)
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column, b = a + columns + 1
        indices.push(a, a + 1, b, a + 1, b + 1, b)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function planter(root, position) {
  const finish = plasterMaterial('#a69780', { roughness: 0.83, scale: 3 })
  const outline = [[0, 0.008], [0.14, 0.008], [0.17, 0.03], [0.195, 0.35], [0.188, 0.38], [0.171, 0.382], [0.166, 0.345], [0.137, 0.035], [0, 0.035]]
  const pot = new THREE.Mesh(new THREE.LatheGeometry(outline.map(point => new THREE.Vector2(...point)), 48), finish)
  pot.name = 'feature_earthen_planter'
  pot.position.set(...position)
  pot.castShadow = true
  pot.receiveShadow = true
  root.add(pot)
  const [x, y, z] = position
  cylinder(root, 'feature_planter_soil', 0.164, 0.16, 0.015, [x, y + 0.34, z], material('#514a3b', 0.98))
  const bark = material('#797157', 0.84)
  const foliage = ['#687754', '#798061', '#5b6d50'].map(color => {
    const finish = material(color, 0.73)
    finish.side = THREE.DoubleSide
    finish.sheen = 0.12
    finish.sheenColor.set('#8b9b75')
    return finish
  })
  const up = new THREE.Vector3(0, 1, 0)
  for (let branch = 0; branch < 5; branch++) {
    const azimuth = branch * 2.4
    const height = 1.28 + (branch % 3) * 0.20
    const leanX = Math.sin(azimuth) * 0.20, leanZ = Math.cos(azimuth) * 0.17
    tube(root, `feature_olive_branch_${branch}`, [[x, y + 0.34, z], [x + leanX * 0.3, y + 0.86, z + leanZ * 0.3], [x + leanX, y + height, z + leanZ]], branch === 2 ? 0.007 : 0.0045, bark)
    for (let n = 0; n < 7; n++) {
      const t = 0.36 + n * 0.095
      const node = new THREE.Vector3(x + leanX * t, y + 0.34 + t * (height - 0.34), z + leanZ * t)
      for (let pair = 0; pair < 2; pair++) {
        const angle = azimuth + n * 1.68 + pair * Math.PI
        const direction = new THREE.Vector3(Math.sin(angle), 0.30 + Math.sin(n * 1.4) * 0.22, Math.cos(angle)).normalize()
        const stem = cylinder(root, `feature_leaf_petiole_${branch}_${n}_${pair}`, 0.0008, 0.0013, 0.025,
          node.clone().addScaledVector(direction, 0.0125).toArray(), bark, 6)
        stem.quaternion.setFromUnitVectors(up, direction)
        const leaf = new THREE.Mesh(leafGeometry(0.10 + (n % 3) * 0.013, 0.014 + (branch % 2) * 0.004, 0.014 - pair * 0.025), foliage[(branch + n + pair) % foliage.length])
        leaf.name = `feature_olive_leaf_${branch}_${n}_${pair}`
        leaf.position.copy(node).addScaledVector(direction, 0.025)
        leaf.quaternion.setFromUnitVectors(up, direction)
        leaf.rotateY(0.38 * Math.sin(branch + n * 2.1))
        leaf.castShadow = true
        leaf.receiveShadow = true
        root.add(leaf)
      }
    }
  }
}

/** A true 30 × 10 ft wall, with furnishings kept outside its central field. */
export function createFeatureWall() {
  const root = room('30 ft feature wall')
  root.userData.dimensions = { wallWidth: WALL_WIDTH, wallHeight: WALL_HEIGHT, roomDepth: ROOM_DEPTH }
  const plaster = plasterMaterial('#e8e4da')
  const limestone = stoneMaterial('#cbc5b8', { polished: false, roughness: 0.62, scale: 6 })
  const oak = woodMaterial('#a28360')
  const darkOak = woodMaterial('#64513e')
  const bronze = material('#625b4d', 0.36, 0.72)
  const light = material('#ffffff', 0.45)
  light.emissive.set('#ffffff')
  light.emissiveIntensity = 0.48

  tile(root, 'feature_wall', 'wall', [WALL_WIDTH, WALL_HEIGHT, 0.14], [0, WALL_HEIGHT / 2, -0.07])
  const floor = architecture(box(root, 'feature_fixed_limestone_floor', [WALL_WIDTH + 0.24, 0.10, ROOM_DEPTH + 0.20], [0, -0.05, ROOM_DEPTH / 2 - 0.05], limestone))
  floor.userData.isFloor = true
  architecture(box(root, 'feature_right_return', [0.12, WALL_HEIGHT, ROOM_DEPTH], [WALL_WIDTH / 2 + 0.06, WALL_HEIGHT / 2, ROOM_DEPTH / 2], plaster))
  // A real side opening gives the broad illumination an architectural source.
  architecture(box(root, 'feature_left_return_rear', [0.12, WALL_HEIGHT, 1.10], [-WALL_WIDTH / 2 - 0.06, WALL_HEIGHT / 2, 0.55], plaster))
  architecture(box(root, 'feature_left_return_front', [0.12, WALL_HEIGHT, ROOM_DEPTH - 3.0], [-WALL_WIDTH / 2 - 0.06, WALL_HEIGHT / 2, (ROOM_DEPTH + 3.0) / 2], plaster))
  architecture(box(root, 'feature_window_sill_wall', [0.12, 0.75, 1.90], [-WALL_WIDTH / 2 - 0.06, 0.375, 2.05], plaster))
  architecture(box(root, 'feature_window_header_wall', [0.12, WALL_HEIGHT - 2.7, 1.90], [-WALL_WIDTH / 2 - 0.06, (WALL_HEIGHT + 2.7) / 2, 2.05], plaster))
  architecture(box(root, 'feature_ceiling', [WALL_WIDTH + 0.24, 0.12, ROOM_DEPTH + 0.14], [0, WALL_HEIGHT + 0.06, ROOM_DEPTH / 2], plaster))
  architecture(box(root, 'feature_entrance_wall', [WALL_WIDTH + 0.24, WALL_HEIGHT, 0.12], [0, WALL_HEIGHT / 2, ROOM_DEPTH + 0.06], plaster))
  architecture(box(root, 'feature_entrance_door', [1.04, 2.30, 0.035], [3.15, 1.15, ROOM_DEPTH - 0.018], oak, 0.004))
  box(root, 'feature_entrance_handle', [0.11, 0.014, 0.035], [3.51, 1.03, ROOM_DEPTH - 0.043], bronze, 0.005)

  const daylight = material('#e0e0e0', 0.75)
  daylight.emissive.set('#ffffff')
  daylight.emissiveIntensity = 0.2
  architecture(panel(root, 'feature_window_daylight', 1.90, 1.95, [-WALL_WIDTH / 2 - 0.09, 1.725, 2.05], [0, Math.PI / 2, 0], daylight))
  const glass = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.09, transparent: true, opacity: 0.06, metalness: 0, clearcoat: 1, depthWrite: false })
  architecture(panel(root, 'feature_window_glazing', 1.88, 1.93, [-WALL_WIDTH / 2 - 0.022, 1.725, 2.05], [0, Math.PI / 2, 0], glass))
  for (const z of [1.10, 2.05, 3.0]) box(root, `feature_window_mullion_${z}`, [0.09, 1.98, 0.035], [-WALL_WIDTH / 2 + 0.025, 1.725, z], oak, 0.003)
  for (const y of [0.75, 2.7]) box(root, `feature_window_rail_${y}`, [0.10, 0.038, 1.97], [-WALL_WIDTH / 2 + 0.025, y, 2.05], oak, 0.003)
  box(root, 'feature_window_stone_sill', [0.22, 0.032, 2.0], [-WALL_WIDTH / 2 + 0.028, 0.746, 2.05], limestone, 0.004)

  // A narrow ceiling cove and floor reveal frame the wall without subdividing
  // the tile surface or obscuring its actual dimensions.
  architecture(box(root, 'feature_cove_shadow', [WALL_WIDTH, 0.025, 0.025], [0, WALL_HEIGHT - 0.04, 0.025], material('#a39a8a', 0.8)))
  architecture(box(root, 'feature_cove_diffuser', [WALL_WIDTH - 0.08, 0.006, 0.012], [0, WALL_HEIGHT - 0.034, 0.042], light))
  architecture(box(root, 'feature_cove_lip', [WALL_WIDTH, 0.026, 0.09], [0, WALL_HEIGHT - 0.013, 0.049], plaster, 0.003))
  for (const sign of [-1, 1]) {
    architecture(box(root, `feature_cove_end_return_${sign}`, [0.012, 0.042, 0.09], [sign * (WALL_WIDTH / 2 - 0.006), WALL_HEIGHT - 0.021, 0.049], plaster, 0.001))
    architecture(box(root, `feature_side_floor_joint_${sign}`, [0.008, 0.009, ROOM_DEPTH], [sign * (WALL_WIDTH / 2 - 0.004), 0.0045, ROOM_DEPTH / 2], material('#999183', 0.85)))
  }
  architecture(box(root, 'feature_floor_shadow_joint', [WALL_WIDTH, 0.009, 0.009], [0, 0.0045, 0.0045], material('#8c8578', 0.82)))

  // The 1.65 m bench and potted tree are scale references at opposite edges;
  // the central field stays completely free of objects and wall art.
  const benchX = -3.22
  box(root, 'feature_bench_solid_oak_seat', [1.65, 0.065, 0.42], [benchX, 0.455, 0.40], oak, 0.016)
  for (const x of [benchX - 0.63, benchX + 0.63]) {
    box(root, 'feature_bench_trestle', [0.085, 0.4225, 0.32], [x, 0.21125, 0.40], darkOak, 0.008)
    box(root, 'feature_bench_trestle_shoulder', [0.12, 0.034, 0.35], [x, 0.405, 0.40], darkOak, 0.006)
    const dowel = cylinder(root, 'feature_bench_pegged_joint', 0.006, 0.006, 0.002, [x, 0.17, 0.561], oak, 16)
    dowel.rotation.x = Math.PI / 2
  }
  box(root, 'feature_bench_stretcher', [1.32, 0.055, 0.045], [benchX, 0.17, 0.40], darkOak, 0.006)
  for (const z of [0.235, 0.565]) box(root, 'feature_bench_under_seat_rail', [1.38, 0.052, 0.027], [benchX, 0.397, z], oak, 0.004)
  const linen = fabricMaterial('#d4c9b8')
  box(root, 'feature_bench_linen_pad', [0.53, 0.035, 0.35], [benchX - 0.38, 0.505, 0.40], linen, 0.015)
  tube(root, 'feature_bench_pad_piping', [[benchX - 0.63, 0.503, 0.235], [benchX - 0.38, 0.503, 0.228], [benchX - 0.13, 0.503, 0.235]], 0.0012, linen)
  const bookCover = material('#8a8a75', 0.88), paper = material('#ddd7c9', 0.93)
  box(root, 'feature_bench_book_pages', [0.211, 0.019, 0.151], [benchX + 0.41, 0.500, 0.403], paper, 0.001)
  for (const y of [0.4895, 0.5105]) box(root, 'feature_bench_book_cover', [0.22, 0.002, 0.16], [benchX + 0.41, y, 0.40], bookCover, 0.0007)
  box(root, 'feature_bench_book_spine', [0.004, 0.022, 0.16], [benchX + 0.302, 0.500, 0.40], bookCover, 0.001)
  planter(root, [3.95, 0, 0.48])
  return root
}
