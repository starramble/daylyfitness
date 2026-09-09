"""Extend the cut neck rim without moving facial vertices."""
import bpy,bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

def extend_neck(head):
 vertices=[];faces=[]
 for o in bpy.data.objects:
  if o.type!='MESH' or o.get('kind')=='skin' or o.get('family')!='core':continue
  base=len(vertices);vertices.extend([o.matrix_world@v.co for v in o.data.vertices]);faces.extend([tuple(base+i for i in p.vertices) for p in o.data.polygons])
 tree=BVHTree.FromPolygons(vertices,faces)
 bm=bmesh.new();bm.from_mesh(head.data)
 def smooth(a,b,x):
  t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
 # Protect the entire facial region, including the forward chin. Only the
 # lower neck below y=3.215 may taper into the added transition.
 for v in bm.verts:
  x,y,z=v.co
  influence=(1-smooth(3.15,3.215,y))*(1-smooth(.06,.13,z))
  radial=((x/.083)**2+((z+.026)/.09)**2)**.5
  if influence>0 and radial>1:
   scale=1-influence+influence/radial
   v.co.x=x*scale;v.co.z=-.026+(z+.026)*scale
 # Only the lower crop boundary; eye/mouth boundaries must never be changed.
 edges=[e for e in bm.edges if e.is_boundary and all(v.co.y<3.20 for v in e.verts)]
 start=list({v for e in edges for v in e.verts})
 origins={v:v.co.copy() for v in start};targets={}
 for v in start:
  q=v.co.copy();q.y=3.078
  radial=Vector((q.x,0,q.z+.026));factor=max(1,((radial.x/.075)**2+(radial.z/.086)**2)**.5)
  q.x/=factor;q.z=-.026+(q.z+.026)/factor
  p,n,_,distance=tree.find_nearest(q)
  targets[v]=p-n*.004 if p is not None and distance<.15 else q
 previous={v:v for v in start}
 # Add a collar to the existing boundary, rather than shrinking the chin into
 # neck muscles. All facial vertices remain at their source positions; only the lower neck tapers.
 oriented=[(e.link_loops[0].vert,e.link_loops[0].link_loop_next.vert) for e in edges]
 for step in range(1,6):
  t=step/5;t=t*t*(3-2*t)
  current={v:bm.verts.new(origins[v].lerp(targets[v],t)) for v in start}
  for a,b in oriented:bm.faces.new((previous[b],previous[a],current[a],current[b]))
  previous=current
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(head.data);bm.free()
 for p in head.data.polygons:p.use_smooth=True
 return len(start)
