"""Build a cohesive Z-Anatomy surface asset; runtime supplies shared skeleton skinning.
Blender --factory-startup --background --python scripts/build_anatomy_v4.py
Inputs: downloaded MuscularSystem100/SkeletalSystem100 FBX and BodyParts3D skin OBJ.
"""
import bpy,bmesh,json,re,math,pathlib
from mathutils import Vector,Matrix
ROOT=pathlib.Path(__file__).resolve().parents[1];CACHE=pathlib.Path('/tmp/dayly-zanatomy')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for fn in ['MuscularSystem100.fbx','SkeletalSystem100.fbx']:
 before=set(bpy.data.objects);bpy.ops.import_scene.fbx(filepath=str(CACHE/fn))
 for o in set(bpy.data.objects)-before:o['inputFile']=fn
worlds={o.name:o.matrix_world.copy() for o in bpy.data.objects}
rules=[('chest',r'pectoralis major'),('deltoids',r'part of deltoid muscle'),('biceps',r'biceps brachii'),('triceps',r'triceps brachii'),('forearms',r'carpi|digitorum (superficialis|profundus)|pronator|supinator|brachioradialis|extensor digitorum muscle|extensor indicis|extensor digiti minimi|palmaris longus'),('abs',r'rectus abdominis'),('lats',r'latissimus dorsi'),('obliques',r'external abdominal oblique'),('traps',r'trapezius muscle'),('erectors',r'iliocostalis (lumborum|thoracis)|longissimus thoracis|spinalis thoracis'),('glutes',r'gluteus maximus'),('quads',r'rectus femoris|vastus'),('hamstrings',r'biceps femoris|semitendinosus|semimembranosus'),('adductors',r'adductor (longus|brevis|magnus|minimus)|gracilis|pectineus'),('calves',r'gastrocnemius|soleus'),('tibialis',r'tibialis anterior')]
# All input coordinates are mapped by one continuous deformation field, including tendon insertions.
S=2.16
src={'pelvis':(0,.94,0),'torso':(0,1.005,0),'upper':(.175,1.393,-.005),'lower':(.225,1.113,.002),'hand':(.270,.883,.02),'thigh':(.072,.895,-.002),'shin':(.082,.462,.004),'foot':(.082,.088,-.01)}
dst={'pelvis':(0,1.99,0),'torso':(0,2.13,0),'upper':(.425,3.12,0),'lower':(.425,2.42,0),'hand':(.425,1.84,0),'thigh':(.185,1.88,0),'shin':(.185,1.04,0),'foot':(.185,.19,0)}
ends={'upper':'lower','lower':'hand','thigh':'shin','shin':'foot'}
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def weights(v,family):
 x,y,z=v;ax=abs(x)
 if family=='arm':
  if y>1.32:
   t=smooth(.13,.19,ax)* (1-smooth(1.38,1.46,y));return [('torso',1-t),('upper',t)]
  if y>1.18:return [('upper',1)]
  if y>1.04:
   t=smooth(1.04,1.18,y);return [('upper',t),('lower',1-t)]
  if y>.925:return [('lower',1)]
  t=smooth(.845,.925,y);return [('lower',t),('hand',1-t)]
 if family=='leg':
  if y>.82:
   t=smooth(.82,.97,y);return [('pelvis',t),('thigh',1-t)]
  if y>.53:return [('thigh',1)]
  if y>.395:
   t=smooth(.395,.53,y);return [('thigh',t),('shin',1-t)]
  if y>.12:return [('shin',1)]
  t=smooth(.06,.12,y);return [('shin',t),('foot',1-t)]
 # Chest/lats insert on the humerus; use the exact same shoulder field as the arm.
 if ax>.13 and y>1.24:
  t=smooth(.13,.195,ax)*(1-smooth(1.38,1.46,y));return [('torso',1-t),('upper',t)]
 t=smooth(.94,1.14,y);return [('pelvis',1-t),('torso',t)]
def point(v,family):
 side=1 if v.x>=0 else -1;out=Vector()
 for part,w in weights(v,family):
  a=Vector(src[part]);a.x*=side;b=Vector(dst[part]);b.x*=side;q=(v-a)*S
  if part in ends:
   end=Vector(src[ends[part]]);end.x*=side;d=end-a;rot=d.normalized().rotation_difference(Vector((0,-1,0)));q=rot@q
   targetlen=Vector(dst[ends[part]])-Vector(dst[part]);q.y*=targetlen.length/(d.length*S)
  out+=(q+b)*w
 return out
mus=bpy.data.materials.new('Muscle fibers');mus.diffuse_color=(.55,.42,.36,1)
ten=bpy.data.materials.new('Tendon');ten.diffuse_color=(.78,.75,.68,1)
bone=bpy.data.materials.new('Bone');bone.diffuse_color=(.7,.68,.62,1)
skin=bpy.data.materials.new('Skin');skin.diffuse_color=(.61,.58,.53,1)
manifest=[]
for o in list(bpy.data.objects):
 if o.type!='MESH':bpy.data.objects.remove(o,do_unlink=True);continue
 n=o.name.lower();g=next((k for k,p in rules if re.search(p,n)), '')
 excluded=bool(re.search(r'\.(?:i|j|ol|or|el|er)$',n)) or bool(re.search('bursa|sheath|fascia|ligament|insertion|origin|foramen|surface|groove|tuberc|facet|margin|border|part of .*bone',n))
 isbone=not excluded and bool(re.search(r'^(humerus|radius|ulna|femur|tibia|fibula|patella|clavicle|scapula|hip bone|sacrum|sternum|rib|[a-z]+ vertebra)',n))
 keep=not excluded and ((isbone if o.get('inputFile')=='SkeletalSystem100.fbx' else bool(g)) or (o.get('inputFile')=='MuscularSystem100.fbx' and bool(re.search('serratus anterior|sartorius|gluteus medius|infraspinatus|teres major|sternocleidomastoid|brachialis muscle|tibialis posterior',n))))
 if not keep:bpy.data.objects.remove(o,do_unlink=True);continue
 family='arm' if g in ['deltoids','biceps','triceps','forearms'] or re.search('humerus|radius|ulna|brachialis',n) else 'leg' if g in ['quads','hamstrings','adductors','calves','tibialis','glutes'] or re.search('femur|tibia|fibula|patella|sartorius|gluteus',n) else 'core'
 o.data=o.data.copy();mw=worlds[o.name]
 for v in o.data.vertices:
  q=mw@v.co;v.co=point(Vector((q.x,q.z,-q.y)),family)
 o.parent=None;o.matrix_world=Matrix.Identity(4)
 # Preserve anatomically segmented pale tendon polygons.
 oldm=[m.name.lower() if m else '' for m in o.data.materials]
 mids=[p.material_index for p in o.data.polygons];o.data.materials.clear()
 o.data.materials.append(bone if isbone else mus);o.data.materials.append(ten)
 for p,mi in zip(o.data.polygons,mids):p.material_index=1 if not isbone and mi<len(oldm) and ('tendon' in oldm[mi] or 'aponeuros' in oldm[mi]) else 0
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00002);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
 bpy.context.view_layer.objects.active=o
 budget=2500 if g in ['abs','lats'] else 1100
 if len(o.data.polygons)>budget:
  dec=o.modifiers.new('Anatomical reduction','DECIMATE');dec.ratio=budget/len(o.data.polygons);bpy.ops.object.modifier_apply(modifier=dec.name)
 sub=o.modifiers.new('Surface subdivision','SUBSURF');sub.levels=1;bpy.ops.object.modifier_apply(modifier=sub.name)
 for p in o.data.polygons:p.use_smooth=True
 o['muscleId']=g;o['family']=family;o['kind']='bone' if isbone else 'muscle';o['bodySide']='left' if o.name.endswith('.l') else 'right' if o.name.endswith('.r') else 'center'
 o['source']='Z-Anatomy / BodyParts3D';o['sourceName']=o.name
 manifest.append({'name':o.name,'muscleId':g,'family':family})
# Original BodyParts3D skin only on head/hands/feet, in the common deformation field.
vs=[];fs=[]
for l in open('/tmp/dayly-anatomy/obj/FJ2810.obj'):
 if l.startswith('v '):
  x,y,z=map(float,l.split()[1:4]);vs.append(Vector((x*.001,z*.001+.078,-y*.001-.08)))
 elif l.startswith('f '):fs.append(tuple(int(a.split('/')[0])-1 for a in l.split()[1:]))
for region in ['head','left-hand','right-hand','left-foot','right-foot']:
 side=1 if region.startswith('left') else -1
 def keep(v):
  if region=='head':return v.y>1.478
  if region.endswith('hand'):return v.x*side>.225 and .61<v.y<.895
  return v.y<.153 and v.x*side>0
 ff=[f for f in fs if all(keep(vs[i]) for i in f)];used=sorted({i for f in ff for i in f});mp={a:i for i,a in enumerate(used)};family='core' if region=='head' else 'arm' if 'hand' in region else 'leg'
 mesh=bpy.data.meshes.new(region);mesh.from_pydata([point(vs[i],family) for i in used],[],[tuple(mp[i] for i in f) for f in ff]);mesh.update()
 o=bpy.data.objects.new(region,mesh);bpy.context.collection.objects.link(o);o.data.materials.append(skin)
 bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00002);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
 bpy.context.view_layer.objects.active=o
 budget=12000 if region=='head' else 7000
 if len(mesh.polygons)>budget:
  dec=o.modifiers.new('Skin reduction','DECIMATE');dec.ratio=budget/len(mesh.polygons);bpy.ops.object.modifier_apply(modifier=dec.name)
 mesh=o.data
 # Extend the original neck/ankle surface into an overlap band, then taper the
 # open rim inside the anatomical envelope. Preserve face, sole and toes.
 # This replaces the exposed full-thickness collar with a smooth radial transition.
 for v in mesh.vertices:
  x,y,z=v.co
  if region=='head':
   continue
  elif region.endswith('foot'):
   blend=smooth(.155,.325,y);cx=side*.185;cz=-.029;rx=.055;rz=.076
  else:continue
  if blend>0:
   dx=x-cx;dz=z-cz;radius=math.sqrt((dx/rx)**2+(dz/rz)**2)
   if radius>1:
    scale=1-blend+blend/radius
    v.co.x=cx+dx*scale;v.co.z=cz+dz*scale
 bm=bmesh.new();bm.from_mesh(mesh)
 if region.endswith('foot'):
  boundary=[v for v in bm.verts if v.is_boundary and (v.co.y<3.16 if region=='head' else v.co.y>.24)]
  for v in boundary:v.co.y=3.078 if region=='head' else .338
  # Smooth the cut itself so source triangles cannot leave a saw-tooth rim.
  for _ in range(5):bmesh.ops.smooth_vert(bm,verts=boundary,factor=.4,use_axis_x=True,use_axis_y=False,use_axis_z=True)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
 for p in mesh.polygons:p.use_smooth=True
 o['family']=family;o['kind']='skin';o['bodySide']='left' if side==1 else 'right';o['muscleId']='';o['source']='BodyParts3D FJ2810';o['sourceName']=region
import runpy
head=next(o for o in bpy.data.objects if o.get('sourceName')=='head')
runpy.run_path(str(ROOT/'scripts/head_transition.py'))['extend_neck'](head)
runpy.run_path(str(ROOT/'scripts/fit-transition-surfaces.py'))['fit_rims']()
# Cleanup unused source data; no synthesized abdominal or back surfaces.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/anatomy-v4.glb'),export_format='GLB',export_yup=False,export_extras=True,export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'artifacts/anatomy-v4.blend'))
json.dump(manifest,open(ROOT/'research/bodyparts3d/v4-manifest.json','w'),indent=2)
print('V4_READY',len(manifest))
