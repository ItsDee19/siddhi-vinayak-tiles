import bpy

blend_path = r"C:\Users\KIIT\Downloads\BrickWall.blend"
print(f"Loading {blend_path} in Blender...")

# Inspect all objects in scene
print("=== OBJECTS IN BRICKWALL.BLEND ===")
for obj in bpy.data.objects:
    print(f"- Object: '{obj.name}', Type: {obj.type}, Location: {obj.location}, Dimensions: {obj.dimensions}")
    if obj.type == 'MESH' and obj.data:
        materials = [mat.name for mat in obj.data.materials if mat]
        print(f"  Materials: {materials}")
        print(f"  UV Layers: {[uv.name for uv in obj.data.uv_layers]}")
        print(f"  Vertices: {len(obj.data.vertices)}, Polygons: {len(obj.data.polygons)}")

# Render preview thumbnail
bpy.context.scene.render.image_settings.file_format = 'PNG'
bpy.context.scene.render.filepath = r"c:\sanket da\siddhi-vinayak-tiles\blender\brickwall_preview.png"
bpy.ops.render.render(write_still=True)
print("Saved brickwall_preview.png!")
