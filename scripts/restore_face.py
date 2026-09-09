"""Recover the original head surface and add a neck-only transition."""
import bpy,json,struct,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from head_transition import extend_neck
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'artifacts/anatomy-v4.blend'))
b=(ROOT/'artifacts/anatomy-v4-before-transitions.glb').read_bytes();length=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+length]);binary=b[28+length:]
node=next(n for n in g['nodes'] if n.get('name')=='head');primitive=g['meshes'][node['mesh']]['primitives'][0]
def values(index):
 a=g['accessors'][index];v=g['bufferViews'][a['bufferView']];width={'SCALAR':1,'VEC3':3}[a['type']];fmt={5126:'f',5125:'I',5123:'H'}[a['componentType']];size=struct.calcsize(fmt)*width;start=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',size)
 return [struct.unpack_from('<'+fmt*width,binary,start+i*stride) for i in range(a['count'])]
positions=values(primitive['attributes']['POSITION']);idx=[v[0] for v in values(primitive['indices'])]
head=next(o for o in bpy.data.objects if o.get('sourceName')=='head');material=head.data.materials[0]
mesh=bpy.data.meshes.new('Original face with neck-only transition');mesh.from_pydata(positions,[],[idx[i:i+3] for i in range(0,len(idx),3)]);mesh.update();mesh.materials.append(material);head.data=mesh
print('NECK_BOUNDARY',extend_neck(head),'ORIGINAL_HEAD_VERTEX_COUNT',len(positions))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/anatomy-v4.glb'),export_format='GLB',export_yup=False,export_extras=True,export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'artifacts/anatomy-v4.blend'))
