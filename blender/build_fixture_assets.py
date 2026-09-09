"""Author the fixed showroom furnishings in Blender; editable tile shells stay native.

Run through scripts/blender_mcp_client.py execute_code --file <this file>.
All authoring coordinates below are metres, x/right, y/up, z/front. Conversion
to Blender happens once in mesh_object; glTF's Y-up export restores that frame.
The asset origins remain at (0,0,0), with applied scale/rotation for safe reuse.
"""
import bpy
import bmesh
import json
import math
import random
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'models' / 'showroom-fixtures.glb'
QA = ROOT / 'build-artifacts' / 'blender'
QA.mkdir(parents=True, exist_ok=True)
random.seed(29)

# Replace only this script's previous review scene, not other open projects.
for previous in list(bpy.data.scenes):
    if previous.get('svt_fixture_library') or previous.name == 'SVT authored fixture library':
        for obj in list(previous.objects):
            if len(obj.users_scene) == 1:
                bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.scenes.remove(previous)
# Own a fresh scene; never clear or alter another open scene's objects.
scene = bpy.data.scenes.new('SVT authored fixture library')
scene['svt_fixture_library'] = True
bpy.context.window.scene = scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
sources = bpy.data.collections.new('Export sources — metric origins')
scene.collection.children.link(sources)

def coord(p):
    return (p[0], -p[2], p[1])

def principled(name, rgb, roughness, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*rgb, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    if name == 'Glazed porcelain':
        shader.inputs['Coat Weight'].default_value = .24
        shader.inputs['Coat Roughness'].default_value = .16
    mat.diffuse_color = (*rgb, 1)
    return mat

porcelain = principled('Glazed porcelain', (.86, .86, .86), .21)
linen = principled('Woven natural linen', (.57, .54, .49), .88)
linen.node_tree.nodes.get('Principled BSDF').inputs['Sheen Weight'].default_value = .3
foliage = principled('Olive leaf', (.14, .20, .09), .65)
bark = principled('Olive bark', (.20, .15, .10), .83)

def mesh_object(name, vertices, faces, material, uvs=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([coord(v) for v in vertices], [], faces)
    mesh.update()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    sources.objects.link(obj)
    obj.data.materials.append(material)
    for poly in mesh.polygons:
        poly.use_smooth = True
    layer = mesh.uv_layers.new(name='UVMap')
    for poly in mesh.polygons:
        for loop in poly.loop_indices:
            index = mesh.loops[loop].vertex_index
            layer.data[loop].uv = uvs[index] if uvs else (vertices[index][0], vertices[index][1])
    obj['authored_in'] = 'Blender 4.5 LTS'
    obj['units'] = 'metres'
    return obj

def signed_power(value, exponent):
    return math.copysign(abs(value) ** exponent, value)

def sample_profile(points, count=3):
    # Gentle cubic profile with endpoint clamping: porcelain
    # has a rolled rim and a coved inner floor, not hard lathed ring corners.
    result = []
    for i in range(len(points) - 1):
        a, b, c, d = points[max(i-1, 0)], points[i], points[i+1], points[min(i+2, len(points)-1)]
        for step in range(count):
            t = step / count
            values = []
            for j in range(3):
                value = .5 * ((2*b[j]) + (-a[j]+c[j])*t + (2*a[j]-5*b[j]+4*c[j]-d[j])*t*t + (-a[j]+3*b[j]-3*c[j]+d[j])*t*t*t)
                values.append(max(min(b[j], c[j]), min(max(b[j], c[j]), value)))
            result.append(values)
    return result + [points[-1]]

def ceramic_shell(name, width, height, depth, exponent, profile, segments=112):
    vertices, faces, uvs = [], [], []
    rings = sample_profile(profile)
    for ring, (rx, rz, y) in enumerate(rings):
        for index in range(segments):
            angle = index / segments * math.tau
            x = signed_power(math.cos(angle), exponent) * width * rx / 2
            z = signed_power(math.sin(angle), exponent) * depth * rz / 2
            vertices.append((x, y * height, z))
            uvs.append((index / segments, ring / (len(rings)-1)))
            if ring:
                a = (ring-1)*segments + index
                b = (ring-1)*segments + (index+1)%segments
                faces.append((a, b, b+segments, a+segments))
    # Bottom and inner-floor caps are separated by real ceramic thickness.
    for ring, flip in [(0, True), (len(rings)-1, False)]:
        center = len(vertices)
        vertices.append((0, rings[ring][2]*height, 0))
        uvs.append((.5, .5))
        for index in range(segments):
            tri = (ring*segments+index, ring*segments+(index+1)%segments, center)
            faces.append(tuple(reversed(tri)) if flip else tri)
    return mesh_object(name, vertices, faces, porcelain, uvs)

# Connection map: shell foot y=0; counter remains y=0 after local placement.
# Outer/inner rim is continuous. Drain dishes sit at y~.20h for basins,
# y~.21h for the bath; runtime seats the separate metal waste on that dish.
compact = [( .71,.70,0),(.76,.75,.04),(.80,.79,.12),(.86,.85,.35),(.95,.94,.78),
           (1,1,.94),(1,1,.98),(.985,.980,1),(.94,.915,.99),(.923,.897,.96),
           (.90,.86,.80),(.78,.73,.36),(.64,.57,.23),(.45,.36,.205),(.10,.10,.20),(.015,.015,.19)]
spa = [(.64,.61,0),(.70,.67,.04),(.77,.74,.16),(.88,.86,.47),(.97,.97,.82),
       (1,1,.95),(.993,.994,.99),(.977,.971,1),(.95,.932,.98),(.944,.923,.94),
       (.90,.865,.72),(.74,.67,.35),(.53,.44,.21),(.29,.22,.18),(.025,.025,.17)]
vanity = [(.77,.70,0),(.81,.74,.035),(.85,.79,.10),(.91,.87,.48),(.99,.99,.91),
          (1,1,.96),(.993,.994,.99),(.982,.976,1),(.951,.933,.99),(.932,.902,.95),
          (.90,.854,.72),(.76,.67,.30),(.62,.49,.22),(.34,.22,.205),(.025,.025,.19)]
bath = [(.67,.61,0),(.72,.66,.018),(.76,.71,.055),(.82,.81,.18),(.92,.92,.52),
        (.985,.985,.88),(1,1,.968),(.997,.996,.992),(.984,.975,1),(.965,.922,.995),
        (.950,.900,.975),(.934,.878,.92),(.906,.850,.80),(.837,.795,.57),
        (.720,.686,.32),(.628,.576,.24),(.42,.40,.222),(.16,.18,.218),(.025,.04,.209)]
ceramic_shell('basin_compact', .45, .12, .31, .53, compact)
ceramic_shell('basin_spa', .46, .13, .34, .87, spa)
ceramic_shell('basin_vanity', .555, .12, .37, .41, vanity)
ceramic_shell('bath_soaking', 1.55, .57, .70, .86, bath, 144)

def folded_cloth(name, width, height, depth, cushion=False):
    # Closed fabric volume, rounded plan corners, relaxed seam perimeter and
    # broad low-frequency compression. The hem is geometry, never printed dirt.
    segs, vertices, faces, uv = 96, [], [], []
    levels = [(0,.86),( .10,.97),(.26,1),(.48,1),(.60,.976),(.69,1),(.84,.975),(1,.86)]
    for row, (h, radius) in enumerate(levels):
        for i in range(segs):
            a = i/segs*math.tau
            x = signed_power(math.cos(a), .25) * width/2 * radius
            z = signed_power(math.sin(a), .25) * depth/2 * radius
            ripple = (math.sin(a*5+.9)+.38*math.sin(a*11)) * height*.06
            y = height*h + ripple * math.sin(math.pi*h)
            vertices.append((x,y,z)); uv.append((i/segs,h))
            if row:
                k = (row-1)*segs+i
                j = (row-1)*segs+(i+1)%segs
                faces.append((k,j,j+segs,k+segs))
    # Radial top patch yields soft compression, without one large flat n-gon.
    for top in [False, True]:
        previous = (len(levels)-1)*segs if top else 0
        for radial in range(1,7):
            radius = .86*(1-radial/7)
            first = len(vertices)
            for i in range(segs):
                a=i/segs*math.tau
                x=signed_power(math.cos(a),.25)*width/2*radius
                z=signed_power(math.sin(a),.25)*depth/2*radius
                bulge=height*(.11 if cushion else .055)*(1-radius/.86)
                wave=height*.026*math.sin(x*37+z*21)*math.sin(math.pi*radius/.86)
                y=height+bulge+wave if top else 0
                vertices.append((x,y,z)); uv.append((x/width+.5,z/depth+.5))
                a0=previous+i; b0=previous+(i+1)%segs
                faces.append((a0,b0,first+(i+1)%segs,first+i))
            previous=first
        center=len(vertices); vertices.append((0,height*(1.11 if cushion else 1.055) if top else 0,0)); uv.append((.5,.5))
        for i in range(segs): faces.append((previous+i,previous+(i+1)%segs,center))
    return mesh_object(name,vertices,faces,linen,uv)

folded_cloth('towel_folded',.29,.027,.21)
folded_cloth('bench_cushion',.53,.035,.35,True)

def draped_towel():
    vertices, faces, uv = [], [], []
    rows, cols = 64, 40
    # Cross-section folds over an 8mm rail: a shorter back drop, round saddle,
    # and a long, gently corrugated front. Cloth thickness is 1.2mm per side.
    for side in [0,1]:
        for row in range(rows+1):
            t=row/rows
            if t < .40:
                u=t/.40; y=-.29+u*.29; z=-.012
            elif t < .53:
                a=(t-.40)/.13*math.pi; y=.012*math.sin(a); z=-.012*math.cos(a)
            else:
                u=(t-.53)/.47; y=-u*.355; z=.012
            drop=max(0,-y/.355)
            for col in range(cols+1):
                s=col/cols; x=(s-.5)*.25
                sag=(math.sin(s*math.pi)**2)*.006*drop
                ripple=(math.sin(s*math.tau*3.25+.25)*.005+math.sin(s*math.tau*6.8)*.0012)*(.18+.82*drop)
                hem=.0012 if s<.05 or s>.95 or t<.018 or t>.982 else 0
                vertices.append((x,y-sag,z+ripple+(side*2-1)*(.00065+hem)))
                uv.append((s,t))
                if row<rows and col<cols:
                    a=side*(rows+1)*(cols+1)+row*(cols+1)+col
                    faces.append((a,a+1,a+cols+2,a+cols+1))
    layer=(rows+1)*(cols+1)
    perimeter=list(range(cols+1))+[row*(cols+1)+cols for row in range(1,rows+1)]+[rows*(cols+1)+col for col in range(cols-1,-1,-1)]+[row*(cols+1) for row in range(rows-1,0,-1)]
    for i,a in enumerate(perimeter):
        b=perimeter[(i+1)%len(perimeter)]; faces.append((a,b,b+layer,a+layer))
    return mesh_object('towel_drape',vertices,faces,linen,uv)

draped_towel()

def olive():
    branch_vertices,branch_faces,leaf_vertices,leaf_faces,leaf_uv=[],[],[],[],[]
    def segment(a,b,r0,r1):
        direction=(Vector(b)-Vector(a)).normalized()
        tangent=direction.cross(Vector((0,0,1)))
        if tangent.length<.1: tangent=direction.cross(Vector((1,0,0)))
        tangent.normalize(); bitangent=direction.cross(tangent).normalized()
        offset=len(branch_vertices); sides=8
        for p,r in [(a,r0),(b,r1)]:
            for i in range(sides):
                v=Vector(p)+r*(math.cos(i/sides*math.tau)*tangent+math.sin(i/sides*math.tau)*bitangent)
                branch_vertices.append(tuple(v))
        for i in range(sides):
            j=(i+1)%sides
            branch_faces.append((offset+i,offset+j,offset+j+sides,offset+i+sides))
    def leaf(origin,direction,length,width,twist):
        up=Vector(direction).normalized()
        right=up.cross(Vector((0,1,0))).normalized()
        normal=right.cross(up).normalized()
        right2=right*math.cos(twist)+normal*math.sin(twist)
        normal=right2.cross(up).normalized()
        offset=len(leaf_vertices); rows,cols=10,4
        for row in range(rows+1):
            t=row/rows; envelope=math.sin(math.pi*t)**.75
            for col in range(cols+1):
                s=col/cols*2-1
                ridge=envelope*(.003*(1-abs(s))-.005*s*s)+.019*t*t
                point=Vector(origin)+up*t*length+right2*s*width*envelope+normal*ridge
                leaf_vertices.append(tuple(point)); leaf_uv.append((col/cols,t))
                if row<rows and col<cols:
                    a=offset+row*(cols+1)+col; leaf_faces.append((a,a+1,a+cols+2,a+cols+1))
    trunk=[(0,.34,0),(.018,.68,-.025),(-.006,.98,-.038),(.032,1.26,-.015),(.011,1.58,.011)]
    for i in range(len(trunk)-1): segment(trunk[i],trunk[i+1],.011-i*.002,.009-i*.002)
    for k in range(17):
        h=.70+(k/17)*.84
        angle=k*2.399+random.uniform(-.3,.3)
        reach=random.uniform(.16,.30)*(1-.25*(h-.7))
        start=(.01,h,-.02)
        end=(math.sin(angle)*reach,h+random.uniform(.14,.24),math.cos(angle)*reach)
        middle=tuple(Vector(start).lerp(Vector(end),.52)+Vector((.015,.045,-.01)))
        segment(start,middle,.0035,.002);segment(middle,end,.002,.0008)
        for n in range(random.randint(6,10)):
            t=.23+n*.076
            origin=Vector(middle).lerp(Vector(end),min(1,t)) if t>.5 else Vector(start).lerp(Vector(middle),t*2)
            azimuth=angle+n*2.25+random.uniform(-.35,.35)
            direction=(math.sin(azimuth),random.uniform(-.12,.58),math.cos(azimuth))
            leaf(origin,direction,random.uniform(.075,.13),random.uniform(.011,.018),random.uniform(-.6,.6))
    mesh_object('olive_branches',branch_vertices,branch_faces,bark)
    mesh_object('olive_foliage',leaf_vertices,leaf_faces,foliage,leaf_uv)

olive()

# Export only fixed asset sources. Every object has applied unit transforms;
# runtime retains its own calibrated material, so no illumination is baked.
bpy.ops.object.select_all(action='DESELECT')
for obj in sources.objects:
    obj.select_set(True)
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    obj.data.validate(verbose=False)
bpy.ops.export_scene.gltf(filepath=str(OUT), export_format='GLB', use_selection=True, use_active_scene=True,
    export_apply=True, export_yup=True, export_texcoords=True, export_normals=True,
    export_materials='EXPORT', export_extras=True, export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6, export_draco_position_quantization=16,
    export_draco_normal_quantization=12, export_draco_texcoord_quantization=14)

manifest=[]
for obj in sources.objects:
    obj.data.calc_loop_triangles()
    dimensions=obj.dimensions
    manifest.append({'name':obj.name,'dimensions':[dimensions.x,dimensions.z,dimensions.y],
        'vertices':len(obj.data.vertices),'triangles':len(obj.data.loop_triangles),
        'uvLayers':len(obj.data.uv_layers)})
(QA/'fixture-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')

# Review gallery lives in the editable .blend, separate from export coordinates.
gallery=bpy.data.collections.new('Review gallery')
scene.collection.children.link(gallery)
positions={'bath_soaking':(-.45,0,0),'basin_compact':(-1.0,.70,-.72),
 'basin_spa':(-.42,.70,-.72),'basin_vanity':(.22,.70,-.72),
 'towel_folded':(.72,.10,.20),'bench_cushion':(.75,.12,.65),
 'towel_drape':(1.05,.70,-.55),'olive_branches':(1.55,0,.45),'olive_foliage':(1.55,0,.45)}
for obj in list(sources.objects):
    clone=obj.copy();clone.data=obj.data;gallery.objects.link(clone)
    clone.location=coord(positions[obj.name]);clone.name='Review '+obj.name
sources.hide_render=True
sources.hide_viewport=True

def cube(name,size,position,mat):
    bpy.ops.mesh.primitive_cube_add(size=2,location=coord(position))
    obj=bpy.context.object;obj.name=name
    obj.scale=(size[0]/2,size[2]/2,size[1]/2)
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    obj.data.materials.append(mat)
    bevel=obj.modifiers.new('Manufactured eased edge','BEVEL');bevel.width=.008;bevel.segments=3
    return obj
stone=principled('Review stone',(.39,.39,.39),.6)
cube('Basin plinth',(1.85,.70,.56),(-.40,.35,-.72),stone)
cube('Cloth plinth',(.82,.10,.85),(.85,.05,.40),stone)
cube('Ground',(200,.08,200),(0,-.042,0),principled('Neutral grey floor',(.30,.30,.30),.82))

world=bpy.data.worlds.new('Neutral studio world');world.use_nodes=True
world.node_tree.nodes.get('Background').inputs[0].default_value=(.45,.45,.45,1)
world.node_tree.nodes.get('Background').inputs[1].default_value=.35
scene.world=world
for name,pos,power,size,target in [('Broad key',(-3,4,4),650,4,(0,.5,0)),('Window fill',(3,3,1),350,3,(0,.4,0)),('Top reflector',(0,5,-2),450,3,(0,.5,0))]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=(1,1,1)
    light=bpy.data.objects.new(name,data);scene.collection.objects.link(light);light.location=coord(pos)
    light.rotation_euler=(Vector(coord(target))-light.location).to_track_quat('-Z','Y').to_euler()
camera_data=bpy.data.cameras.new('Fixture review camera');camera=bpy.data.objects.new('Fixture review camera',camera_data)
scene.collection.objects.link(camera);camera.location=coord((3.5,2.65,4.6))
camera.rotation_euler=(Vector(coord((.10,.65,-.02)))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=3.65;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
scene.view_settings.exposure=-2;scene.view_settings.gamma=1
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(QA/'fixture-gallery.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender'/'showroom-fixtures.blend'))
bpy.ops.render.render(write_still=True)
print(json.dumps({'asset':str(OUT),'bytes':OUT.stat().st_size,'meshes':manifest,'render':scene.render.filepath}))
