import * as T from 'three';
const steel=new T.MeshStandardMaterial({color:'#75827c',metalness:.7,roughness:.4});
const pad=new T.MeshStandardMaterial({color:'#3b5146',roughness:.85});
const rubber=new T.MeshStandardMaterial({color:'#303934',roughness:.82});
export function createTrainingEquipment(root:T.Group){
 const group=new T.Group();group.name='Training_apparatus';root.add(group);
 function box(parent:T.Object3D,size:number[],pos:number[],mat:T.Material=pad){const m=new T.Mesh(new T.BoxGeometry(...size as [number,number,number]),mat);m.position.fromArray(pos);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
 const barbell=new T.Group();barbell.name='Barbell';group.add(barbell);
 const shaft=new T.Mesh(new T.CylinderGeometry(.026,.026,3.1,20),steel);shaft.rotation.z=Math.PI/2;barbell.add(shaft);
 for(const s of [-1,1]){const plate=new T.Mesh(new T.CylinderGeometry(.32,.32,.14,32),rubber);plate.rotation.z=Math.PI/2;plate.position.x=s*1.30;barbell.add(plate);}
 const kettle=new T.Group();kettle.name='Kettlebell';group.add(kettle);
 const handle=new T.Mesh(new T.TorusGeometry(.135,.026,12,28),steel);kettle.add(handle);
 const bell=new T.Mesh(new T.SphereGeometry(.215,24,20),rubber);bell.position.y=-.24;kettle.add(bell);
 const bench=new T.Group();bench.name='Adjustable_bench';group.add(bench);
 const back=new T.Group();back.name='Back_pad_pivot';bench.add(back);box(back,[.57,.14,1.95],[0,-.07,-.84]);
 box(bench,[.57,.14,.55],[0,-.07,.27]);
 box(bench,[.12,.10,1.95],[0,-.16,-.43],steel);
 const benchPosts=[-1.35,.42].map(z=>({post:box(bench,[.12,1,.12],[0,0,z],steel),foot:box(bench,[1.05,.08,.16],[0,0,z],steel)}));
 const backSupport=new T.Mesh(new T.CylinderGeometry(.035,.035,1,12),steel);bench.add(backSupport);
 function updateSupport(){const height=bench.position.y;for(const {post,foot} of benchPosts){post.scale.y=Math.max(.12,height-.20);post.position.y=(-height+.08-.12)/2;foot.position.y=-height+.04;}
  const start=new T.Vector3(0,-.16,-1.30),end=new T.Vector3(0,-.09,-1.1).applyEuler(back.rotation);backSupport.position.copy(start).add(end).multiplyScalar(.5);backSupport.scale.y=start.distanceTo(end);backSupport.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),end.sub(start).normalize());
 }
 const platform=new T.Group();platform.name='Pushup_support';group.add(platform);box(platform,[1.65,.12,.8],[0,-.06,0]);for(const s of [-1,1])box(platform,[.10,1.1,.6],[s*.69,-.65,0],steel);
 const frame=new T.Group();frame.name='Cable_station';group.add(frame);
 for(const s of [-1,1]){box(frame,[.075,4.15,.075],[s*1.15,2.08,0],steel);box(frame,[.22,.08,1.05],[s*1.15,.04,0],steel);}
 box(frame,[2.38,.08,.08],[0,4.12,0],steel);box(frame,[.07,3.95,.07],[0,2.10,0],steel);
 const pulleys=[0,1].map(()=>{const p=new T.Mesh(new T.TorusGeometry(.065,.018,10,20),steel);p.rotation.y=Math.PI/2;group.add(p);return p;});
 const cables=[0,1].map(()=>{const line=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]),new T.LineBasicMaterial({color:'#59635e'}));line.frustumCulled=false;line.userData.apparatus=true;group.add(line);return line;});
 const handles=[0,1].map(()=>{const h=new T.Mesh(new T.CylinderGeometry(.027,.027,.22,16),steel);group.add(h);return h;});
 const roller=new T.Mesh(new T.CylinderGeometry(.095,.095,.93,24),pad);roller.name='Leg_roller';roller.rotation.z=Math.PI/2;group.add(roller);
 const thighPad=box(group,[.95,.13,.20],[0,0,0]);thighPad.name='Thigh_restraint';
 const footPlate=box(group,[1.15,.10,.84],[0,0,0]);footPlate.name='Leg_press_footplate';
 const rails=new T.Group();rails.name='Leg_press_rails';group.add(rails);
 for(const s of [-1,1]){const rail=box(rails,[.06,.06,2.9],[s*.72,0,0],steel);rail.rotation.x=-Math.PI/4;}
 const pressLinks=[0,1].map(()=>{const m=new T.Mesh(new T.CylinderGeometry(.033,.033,1,12),steel);group.add(m);return m;});
 const all=[barbell,kettle,bench,platform,frame,...cables,...pulleys,...handles,roller,thighPad,footPlate,rails,...pressLinks];
 function reset(){all.forEach(o=>o.visible=false);back.rotation.set(0,0,0);bench.position.set(0,0,0);bench.rotation.set(0,0,0);bench.scale.set(1,1,1);}
 function cable(index:number,anchor:T.Vector3,grip:T.Vector3,q:T.Quaternion){const pulley=pulleys[index];pulley.visible=true;pulley.position.copy(anchor);const l=cables[index];l.visible=true;const p=l.geometry.getAttribute('position');p.setXYZ(0,...anchor.toArray());p.setXYZ(1,...grip.toArray());p.needsUpdate=true;const h=handles[index];h.visible=true;h.position.copy(grip);h.quaternion.copy(q);}
 function link(index:number,from:T.Vector3,to:T.Vector3){const m=pressLinks[index];m.visible=true;m.position.copy(from).add(to).multiplyScalar(.5);m.scale.y=from.distanceTo(to);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),to.clone().sub(from).normalize());}
 reset();return {updateSupport,group,barbell,kettle,bench,back,platform,frame,roller,thighPad,footPlate,rails,handles,reset,cable,link};
}
