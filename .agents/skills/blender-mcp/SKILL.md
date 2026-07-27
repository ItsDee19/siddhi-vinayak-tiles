---
name: blender-mcp
description: "Blender 3D MCP skill for automated 3D modeling, spatial assembly, scene inspection, texture assignment, and production-ready GLTF/GLB web exports for Three.js / R3F visualizers. Use when interacting with Blender via Blender MCP on port 9876."
---

# Blender MCP Skill: Automated 3D Modeling & WebGL Pipeline

This skill provides comprehensive instructions for controlling Blender via **Blender MCP** (`blender-mcp` listening on `localhost:9876`), building precise 3D scenes, managing materials and textures, and exporting optimized `.glb` / `.gltf` assets for web visualizers.

---

## 1. Connection & Tool Setup

- **Port**: `localhost:9876`
- **MCP Command**: `uvx blender-mcp`
- **Core Operations**:
  - `get_scene_info`: Retrieve object list, transform hierarchies, and material counts.
  - `get_object_info`: Inspect mesh vertices, UV maps, materials, and bounds.
  - `get_viewport_screenshot`: Capture viewport state to visually audit modeling results.
  - `execute_blender_code` / `run_python`: Execute `bpy` scripts inside Blender.

---

## 2. Modeling & Assembly Rules

To prevent geometric bugs, gaps, overlapping faces, or flipped normals, enforce these strict modeling rules:

### A. Connection Planning
Before creating complex assemblies (e.g. bathroom fixtures, vanities, staircases):
1. **Connection Map**: Outline exact joint coordinates and bounding box extents in code comments.
2. **Overlap**: Ensure adjacent surfaces overlap by at least **0.005m (5mm)** to avoid visual gaps or z-fighting.

### B. Primitives & Transforms
1. **Cube Scaling**: Always initialize cube primitives with `size=2` (`bpy.ops.mesh.primitive_cube_add(size=2)`). A unit half-extent of 1 simplifies scaling math: setting `scale=(x, y, z)` directly establishes the half-extents.
2. **Apply Transforms**: Always apply scale and rotation immediately after transforming meshes:
   ```python
   bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
   ```
3. **Avoid Euler Rotations for Directional Alignments**: Use quaternion math or vector alignment for cylinders and angled components.

### C. Precision Spanning with BMesh
For elements spanning two arbitrary points (e.g. handrails, steps, piping):
```python
import bpy, bmesh
# Use bmesh for exact vertex placement along vectors
```

---

## 3. Materials, Textures & UV Unwrapping

### A. UV Mapping for Web Tiles
- Ensure all wall and floor meshes have clean, non-overlapping UVs on UV Map 0 (`uv_layers.active`).
- Use Smart UV Project or Cube Projection with uniform texel density:
  ```python
  bpy.ops.uv.smart_project(angle_limit=66.0, island_margin=0.02)
  ```

### B. Mesh Naming Conventions for Visualizers
When creating interactive zones for WebGL tile swap (e.g., in Three.js / React Three Fiber):
- Append `__zoneId` suffix to interactive surface mesh names:
  - `floor_mesh__floor`
  - `back_wall_lower__lower`
  - `feature_wall__feature`
  - `counter_top__counterTop`

---

## 4. WebGL Export Guidelines (GLTF / GLB)

When exporting 3D models for web visualization:

1. **Draco Compression**: Export with Draco mesh compression enabled or compressed via gltf-pipeline for fast mobile network loading.
2. **Export Settings**:
   ```python
   bpy.ops.export_scene.gltf(
       filepath="public/models/model-name.glb",
       export_format='GLB',
       use_selection=False,
       export_apply=True,
       export_yup=True,
       export_texcoords=True,
       export_normals=True,
       export_draco_mesh_compression_enable=True
   )
   ```
3. **Materials**: Use Principled BSDF shaders for all PBR materials to ensure 100% compatibility with Three.js `MeshStandardMaterial`.

---

## 5. Verification & Auditing Workflow

1. **Inspect Scene**: Run `get_scene_info` to confirm object hierarchy.
2. **Check Overlap & Origin**: Verify origins are centered at geometry centers or base pivot points.
3. **Visual Audit**: Take a screenshot using `get_viewport_screenshot` to confirm lighting, alignments, and scale relative to human scale before completing the task.
