"""Convert attributed BodyParts3D OBJ parts into a smooth, independently selectable fitness rig asset.
Run: /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/build_anatomy_asset.py
Source downloads are performed separately by download_anatomy.py. No source model scripts execute.
"""
import bpy,bmesh,json,math,re,pathlib
from mathutils import Vector,Quaternion
ROOT=pathlib.Path(__file__).resolve().parents[1];CACHE=pathlib.Path('/tmp/dayly-anatomy')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
S=.0022
# Source landmarks (mm) -> target rest rig landmarks (relative units).
P={'pelvis':Vector((0,1.99,0)), 'torso':Vector((0,2.13,0))}
source={'upper':((-175,-75,1315),(-225,-82,1035)), 'lower':((-225,-82,1035),(-270,-100,805)), 'thigh':((-72,-78,817),(-82,-84,384)), 'shin':((-82,-84,384),(-82,-70,10))}
def cv(v):return Vector((v[0]*S,(v[2]+78)*S,(-v[1]-80)*S))
def remap_y(z):
 anchors=[(-78,0),(10,.19),(384,1.04),(817,1.88),(1000,2.32),(1315,3.12),(1430,3.30),(1641.36,3.78)]
 for (a,b),(c,d) in zip(anchors,anchors[1:]):
  if z<=c:return b+(z-a)/(c-a)*(d-b)
 return 3.78+(z-1641.36)*S

def segment_point(raw,part,side):
 # Source right side is negative x; target retains this convention.
 sign=-1 if side=='right' else 1
 if part in source:
  aa,bb=source[part];a=cv(aa);b=cv(bb)
  if sign>0:a.x=-a.x;b.x=-b.x
  v=cv(raw)-a;direction=b-a;rot=direction.normalized().rotation_difference(Vector((0,-1,0)));v=rot@v
  length={'upper':.70,'lower':.58,'thigh':.84,'shin':.85}[part]
  v.y*=length/direction.length
  origin={'upper':(sign*.425,3.12,0),'lower':(sign*.425,2.42,0),'thigh':(sign*.185,1.88,0),'shin':(sign*.185,1.04,0)}[part]
  return v+Vector(origin)
 if part=='foot':
  v=segment_point(raw,'shin',side);return v
 return Vector((raw[0]*S,remap_y(raw[2]),(-raw[1]-80)*S))

musmat=bpy.data.materials.new('Muscle neutral');musmat.diffuse_color=(.46,.45,.43,1);musmat.use_nodes=True
musmat.node_tree.nodes.clear();out=musmat.node_tree.nodes.new('ShaderNodeOutputMaterial');bs=musmat.node_tree.nodes.new('ShaderNodeBsdfPrincipled');musmat.node_tree.links.new(bs.outputs['BSDF'],out.inputs['Surface']);bs.inputs['Base Color'].default_value=(.46,.45,.43,1);bs.inputs['Roughness'].default_value=.52
bone=bpy.data.materials.new('Connective tissue');bone.diffuse_color=(.65,.63,.58,1)
skin=bpy.data.materials.new('Anatomical surface');skin.diffuse_color=(.61,.60,.56,1)

def parse(path):
 vs=[];fs=[]
 for line in path.open():
  if line.startswith('v '):vs.append(tuple(map(float,line.split()[1:4])))
  elif line.startswith('f '):fs.append(tuple(int(x.split('/')[0])-1 for x in line.split()[1:]))
 return vs,fs

def addmesh(name,vs,fs,group,part,side,kind,sourceid):
 if not fs:return
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vs,[],fs);mesh.update()
 # OBJ seam vertices must be welded before smoothing/subdivision to avoid torn facets.
 bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free();mesh.update()
 obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
 obj['muscleId']=group;obj['rigPart']=part;obj['bodySide']=side;obj['sourceId']=sourceid
 obj['source']='BodyParts3D, © The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan' if sourceid else 'Dayly supplemental surface'
 obj['kind']=kind;obj.data.materials.append(musmat if kind=='muscle' else skin if kind=='skin' else bone)
 bpy.context.view_layer.objects.active=obj;obj.select_set(True)
 budget=1800 if group in ['quads','chest','glutes','traps','obliques'] else 950
 if kind=='skin':budget=8000
 if len(mesh.polygons)>budget:
  dec=obj.modifiers.new('Preserve anatomical volume','DECIMATE');dec.ratio=budget/len(mesh.polygons);bpy.ops.object.modifier_apply(modifier=dec.name)
 smooth=obj.modifiers.new('Surface refinement','SMOOTH');smooth.factor=.55;smooth.iterations=3;bpy.ops.object.modifier_apply(modifier=smooth.name)
 if kind=='muscle':
  sub=obj.modifiers.new('Anatomical surface subdivision','SUBSURF');sub.levels=1;sub.subdivision_type='CATMULL_CLARK';bpy.ops.object.modifier_apply(modifier=sub.name)
 for p in obj.data.polygons:p.use_smooth=True
 obj.select_set(False)
 return obj

items=json.load(open(CACHE/'selected.json'));manifest=[]
for e in items:
 name=e['nameEn'];n=name.lower();side='left' if 'left' in n else 'right' if 'right' in n else 'center';g=e['muscleId'];part='torso'
 vs,fs=parse(CACHE/'obj'/(e['id']+'.obj'))
 if e['kind']=='skin':
  # Keep the original continuous head, hands and feet; no full skin shell occludes muscle meshes.
  for region in ['head','left-hand','right-hand','left-foot','right-foot']:
   def keep(v):
    x,y,z=v
    if region=='head':return z>1400
    sg=1 if region.startswith('left') else -1
    if region.endswith('hand'):return x*sg>225 and 540<z<810
    return z<35 and x*sg>0
   ff=[f for f in fs if all(keep(vs[i]) for i in f)];sd='center' if region=='head' else region.split('-')[0];pt='torso' if region=='head' else 'lower' if region.endswith('hand') else 'foot'
   used=sorted({i for f in ff for i in f});mp={a:b for b,a in enumerate(used)}
   addmesh(region,[segment_point(vs[i],pt,sd) for i in used],[tuple(mp[i] for i in f) for f in ff],'',pt,sd,'skin',e['id'])
  continue
 if g in ['deltoids','biceps','triceps'] or re.search('humerus|brachialis$|coracobrachialis',n):part='upper'
 elif g=='forearms' or re.search(r'ulna$|radius$',n):part='lower'
 elif g in ['quads','hamstrings','adductors'] or re.search(r'femur|sartorius|tensor fasciae|iliotibial',n):part='thigh'
 elif g in ['calves','tibialis'] or re.search(r'tibia$|fibula$|calcaneal|patella',n):part='shin'
 elif g=='glutes' or 'gluteus' in n or re.search('hip bone|sacrum',n):part='pelvis'
 addmesh(name,[segment_point(v,part,side) for v in vs],fs,g,part,side,e['kind'],e['id'])
 manifest.append(dict(id=e['id'],name=name,muscleId=g,rigPart=part,bodySide=side))

# Supplement two absent surface groups in this ISA subset. Sculpt continuous fiber-aligned volumes.
def sculpt_strip(name,group,side):
 sg=-1 if side=='right' else 1;vs=[];fs=[];rows=72;cols=48
 for i in range(rows+1):
  t=i/rows
  for j in range(cols):
   u=j/cols*2*math.pi
   if group=='abs':
    y=2.10+.61*t;w=.078+.011*math.sin(math.pi*t);cx=sg*.092;cz=.24+.034*math.sin(math.pi*t)
    # Rounded muscle belly with transverse tendinous intersections, not disconnected tiles.
    seam=1-.12*sum(math.exp(-((t-k)/.021)**2) for k in [.23,.48,.73]);d=.028*seam
    x=cx+math.cos(u)*w;z=cz+math.sin(u)*d
   else:
    y=2.14+.79*t;cx=sg*(.08+.28*t);w=.025+.11*math.sin(math.pi*t);cz=-.13-.075*t;d=.025+.012*math.sin(math.pi*t)
    x=cx+math.cos(u)*w;z=cz+math.sin(u)*d
   fiber=.0007*math.cos(u*24)*math.sin(math.pi*t)
   vs.append((x+math.cos(u)*fiber,y,z+math.sin(u)*fiber))
 for i in range(rows):
  for j in range(cols):
   a=i*cols+j;b=i*cols+(j+1)%cols;fs.append((a,a+cols,b+cols,b))
 fs.append(tuple(reversed(range(cols))));fs.append(tuple(rows*cols+j for j in range(cols)))
 addmesh(name,vs,fs,group,'torso',side,'muscle','')
for side in ['right','left']:
 sculpt_strip(side+' rectus abdominis (supplement)','abs',side)
 sculpt_strip(side+' latissimus dorsi (supplement)','lats',side)
# Neutral closed pelvis support is intentionally a modest connector, not a detailed reproductive model.
bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=32,location=(0,1.96,.055));o=bpy.context.object;o.name='Pelvis connective surface';o.scale=(.28,.24,.14);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
o['rigPart']='pelvis';o['bodySide']='center';o['kind']='connective';o['muscleId']='';o.data.materials.append(bone)
for p in o.data.polygons:p.use_smooth=True
bpy.ops.object.select_all(action='SELECT')
OUT=ROOT/'public/models/bodyparts3d-fitness.glb';bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',export_extras=True,export_animations=False,export_yup=False)
# Source geometry is authored in Three.js Y-up coordinates; export_yup=False preserves coordinates.
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'artifacts/bodyparts3d-fitness.blend'))
json.dump({'parts':manifest,'supplemental':['abs','lats'],'sourceLicense':'CC BY-SA 2.1 Japan (source OBJ headers)','modelCount':len(bpy.data.objects)},open(ROOT/'research/bodyparts3d/manifest.json','w'),indent=2)
print('ASSET_READY',OUT.stat().st_size,'bytes',len(bpy.data.objects),'objects')
