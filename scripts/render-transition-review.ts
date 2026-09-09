import * as T from 'three';import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';import {createBodyRig} from '../src/bodyRig';import {attachAnatomyAsset} from '../src/anatomyAsset';
const loader=new GLTFLoader();
const assets=await Promise.all([loader.loadAsync('/artifacts/anatomy-v4-before-transitions.glb'),loader.loadAsync('/models/anatomy-v4.glb')]);
for(const region of ['头颈正面','头颈侧面','脚踝正面','脚踝侧面'])for(let version=0;version<2;version++){
 const fig=document.createElement('figure');document.querySelector('main')!.append(fig);fig.innerHTML=`<figcaption>${region} · ${version?'调整后':'调整前'}</figcaption>`;
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(600,740);renderer.setPixelRatio(1);renderer.domElement.style.width="300px";renderer.domElement.style.height="370px";fig.append(renderer.domElement);renderer.setClearColor('#f1f2e9');renderer.outputColorSpace=T.SRGBColorSpace;
 const scene=new T.Scene();scene.add(new T.HemisphereLight('#fffef6','#666957',2));const light=new T.DirectionalLight('#ffffff',2.8);light.position.set(-3,5,4);scene.add(light);
 const r=createBodyRig();attachAnatomyAsset(r,assets[version].scene);scene.add(r.root);r.mats.forEach(({mat})=>mat.color.set('#a5aaa8'));r.arms.forEach(a=>a.weight.visible=false);
 if(!version)for(const m of r.meshes)if(m.userData.kind==='skin')for(const mat of Array.isArray(m.material)?m.material:[m.material]){(mat as T.MeshStandardMaterial).color.set('#bdb5a8');(mat as T.MeshStandardMaterial).roughness=.8;}
 const head=region.startsWith('头');const side=region.endsWith('侧面');const center=new T.Vector3(head?0:side?.185:0,head?3.32:.28,head?0:.07);const extent=head?.43:.44;const camera=new T.OrthographicCamera(-extent*600/740,extent*600/740,extent,-extent,.1,20);camera.position.copy(center).add(new T.Vector3(side?5:0,0,side?0:5));camera.lookAt(center);r.root.updateMatrixWorld(true);r.skeleton.update();renderer.render(scene,camera);
}
document.body.dataset.ready='true';
