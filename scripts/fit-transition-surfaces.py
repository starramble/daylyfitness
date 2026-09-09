"""Fit extended head/ankle rims into adjacent anatomical surfaces (Blender)."""
import bpy,bmesh,pathlib
from mathutils.bvhtree import BVHTree
ROOT=pathlib.Path(__file__).resolve().parents[1]
def fit_rims():
 surfaces={}
 for family in ['core','leg']:
  vertices=[];faces=[]
  for o in bpy.data.objects:
   if o.type!='MESH' or o.get('kind')=='skin' or o.get('family')!=family:continue
   base=len(vertices);vertices.extend([o.matrix_world@v.co for v in o.data.vertices]);faces.extend([tuple(base+i for i in p.vertices) for p in o.data.polygons])
  surfaces[family]=BVHTree.FromPolygons(vertices,faces)
 for o in bpy.data.objects:
  region=o.get('sourceName','');head=region=='head'
  if not region.endswith('foot'):continue
  # Head transition is built separately without modifying source face vertices.
  tree=surfaces['core' if head else 'leg']
  for v in o.data.vertices:
   y=v.co.y;t=max(0,min(1,(3.255-y)/(.177) if head else (y-.155)/.183));t=t*t*(3-2*t)
   if not t:continue
   p,n,_,distance=tree.find_nearest(v.co)
   if p is not None and distance<.2:v.co=v.co.lerp(p-n*.004,t)
  bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
if __name__=='__main__':
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/'artifacts/anatomy-v4.blend'))
 fit_rims()
 bpy.ops.object.select_all(action='SELECT')
 bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/anatomy-v4.glb'),export_format='GLB',export_yup=False,export_extras=True,export_animations=False)
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'artifacts/anatomy-v4.blend'))
