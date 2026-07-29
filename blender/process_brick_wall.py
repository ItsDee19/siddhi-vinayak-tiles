import bpy
import os

print("=== PROCESSING BRICKWALL.BLEND FOR FEATURE WALL (MODEL D) ===")

# Deselect all objects first
bpy.ops.object.select_all(action='DESELECT')

scene = bpy.context.scene
mesh_objs = [obj for obj in scene.objects if obj.type == 'MESH']

print(f"Found {len(mesh_objs)} mesh objects in scene:")
for obj in mesh_objs:
    print(f"- {obj.name}: dims={obj.dimensions}, loc={obj.location}")

# Locate the main wall mesh
wall_obj = None
for obj in mesh_objs:
    if "Cube" in obj.name or "Wall" in obj.name or obj.dimensions.y > 2.0:
        wall_obj = obj
        break

if not wall_obj and mesh_objs:
    wall_obj = mesh_objs[0]

if wall_obj:
    print(f"Target Wall Mesh: {wall_obj.name}")
    
    # Rename with __zoneId suffix so GLBModel / Three.js maps zone textures to full / lowerBand / upperBand
    wall_obj.name = "feature_wall__full"
    
    # Select strictly the wall mesh object
    bpy.context.view_layer.objects.active = wall_obj
    wall_obj.select_set(True)
    
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=66.0, island_margin=0.02)
    bpy.ops.object.mode_set(mode='OBJECT')
    
    # Apply rotation and scale transforms to wall mesh only
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    print("Applied transforms and Smart UV unwrapping to wall mesh!")

# Set up clean WebGL export directory
out_dir = r"c:\sanket da\siddhi-vinayak-tiles\public\models"
os.makedirs(out_dir, exist_ok=True)
glb_path = os.path.join(out_dir, "model-d-feature-wall.glb")

# Export GLB with Draco compression
bpy.ops.export_scene.gltf(
    filepath=glb_path,
    export_format='GLB',
    use_selection=False,
    export_apply=True,
    export_yup=True,
    export_texcoords=True,
    export_normals=True,
    export_draco_mesh_compression_enable=True
)

print(f"Successfully exported {glb_path} (Size: {os.path.getsize(glb_path)} bytes)")

# Render preview thumbnail
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = r"c:\sanket da\siddhi-vinayak-tiles\blender\brickwall_final_preview.png"
bpy.ops.render.render(write_still=True)
print("Saved brickwall_final_preview.png!")
