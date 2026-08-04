import * as THREE from 'three'

// ---------------------------------------------------------------------------
// Per-model scene edits, applied to a loaded GLB's scene clone.
//
// model-a-bathroom.glb and model-b-bathroom-lg.glb are currently the *same*
// Blender export — byte-identical, same md5 — which is why the Small and Large
// Bathroom tabs render identically. Until the large room gets its own export,
// the Large Bathroom is differentiated here instead of in the file.
//
// These run against the per-instance clone GLBModel already makes, so editing
// model B never touches model A.
// ---------------------------------------------------------------------------

// Names in the config are the raw Blender ones, but they are NOT what arrives
// in the three.js scene. GLTFLoader.createUniqueName() runs every node name
// through PropertyBinding.sanitizeNodeName(), which is:
//
//   name.replace(/\s/g, '_').replace(/[\[\]\.:\/]/g, '')
//
// so "Glass frame 1" loads as "Glass_frame_1". Matching on the raw name
// silently hit only the single-word nodes ("Mirror", "Sink", "tap") and missed
// every multi-word one. Normalise both sides to the same space-separated form
// so either spelling matches, and drop the reserved characters the loader
// strips. Also absorbs the stray trailing space in the export's
// "Top of cabinet under sink ".
const norm = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/[[\].:/]/g, '')
    .replace(/[\s_]+/g, ' ')
    .trim()

function collect(root, names = []) {
  const want = new Set(names.map(norm))
  const found = []
  root.traverse((o) => {
    if (want.has(norm(o.name))) found.push(o)
  })
  return found
}

// A glTF mesh with multiple primitives loads as a Group named after the node
// with Mesh children, so material edits have to reach descendants too.
function meshesOf(node) {
  const out = []
  node.traverse((o) => { if (o.isMesh && o.material) out.push(o) })
  return out
}

/**
 * Structural edits. Must run exactly once per scene clone — reparenting
 * rewrites node positions, so applying it twice would double the offset.
 * Called from GLBModel's clone useMemo rather than an effect for that reason
 * (StrictMode double-invokes effects in development).
 */
export function applyStructuralEdits(root, edits) {
  if (!edits) return root

  for (const node of collect(root, edits.hide)) {
    node.visible = false
  }

  if (edits.grow) {
    const { nodes, pivot, scale } = edits.grow
    const origin = new THREE.Vector3(...pivot)
    // Scaling each node in place would scale it about its own centre and pull
    // the cluster apart, so reparent the whole set under one pivoted group and
    // scale that. Every node involved is a root-level child of the scene, so
    // its position is already in scene space and its own rotation survives.
    const group = new THREE.Group()
    group.name = '__grow'
    group.position.copy(origin)
    group.scale.setScalar(scale)
    // collect() is fully evaluated before any reparenting begins, so the
    // traversal can't observe the half-moved graph.
    for (const node of collect(root, nodes)) {
      node.position.sub(origin)
      group.add(node)
    }
    root.add(group)
  }

  return root
}

/**
 * Material overrides. Idempotent — every field is an absolute assignment, so
 * re-running is harmless.
 */
export function applyMaterialEdits(root, edits) {
  if (!edits || !edits.materials) return
  for (const spec of edits.materials) {
    for (const node of collect(root, spec.nodes)) {
      for (const mesh of meshesOf(node)) {
        const mat = mesh.material
        if (spec.color !== undefined) mat.color = new THREE.Color(spec.color)
        if (spec.metalness !== undefined) mat.metalness = spec.metalness
        if (spec.roughness !== undefined) mat.roughness = spec.roughness
        if (spec.envMapIntensity !== undefined) mat.envMapIntensity = spec.envMapIntensity
        mat.needsUpdate = true
      }
    }
  }
}
