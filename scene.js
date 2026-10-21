import * as THREE from './vendor/three.module.min.js';

const $=id=>document.getElementById(id);
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
let last=0;
const views=[];
function material(color,metalness=0,roughness=.55){return new THREE.MeshStandardMaterial({color,metalness,roughness});}
function mesh(geo,mat,parent,x=0,y=0,z=0){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function box(parent,w,h,d,mat,x=0,y=0,z=0){return mesh(new THREE.BoxGeometry(w,h,d),mat,parent,x,y,z);}
function sphere(parent,r,mat,x=0,y=0,z=0){return mesh(new THREE.SphereGeometry(r,32,24),mat,parent,x,y,z);}
function cylinder(parent,r1,r2,h,mat,x=0,y=0,z=0){return mesh(new THREE.CylinderGeometry(r1,r2,h,48),mat,parent,x,y,z);}
function view(canvas,position,target){
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.1,100);camera.position.set(...position);camera.lookAt(...target);
  scene.add(new THREE.HemisphereLight(0xffffff,0x7789ad,3));const light=new THREE.DirectionalLight(0xffffff,3.5);light.position.set(-4,7,5);scene.add(light);const rim=new THREE.DirectionalLight(0xb5ccff,2);rim.position.set(5,3,-3);scene.add(rim);
  const v={renderer,scene,camera,canvas,visible:true,tick:()=>{}};
  const resize=()=>{const rect=canvas.getBoundingClientRect();if(rect.width<1||rect.height<1)return;renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();v.labelLayout?.();requestAnimationFrame(()=>renderer.render(scene,camera));};
  new ResizeObserver(resize).observe(canvas);new IntersectionObserver(es=>{v.visible=es[0].isIntersecting;}).observe(canvas);views.push(v);resize();return v;
}
function educationTexture(){
  // Original project graphic: open book, roof and sun. Not a government seal.
  const c=document.createElement('canvas');c.width=1024;c.height=512;const x=c.getContext('2d');
  x.fillStyle='#f8faff';x.fillRect(0,0,1024,512);x.strokeStyle='#2858bd';x.fillStyle='#2858bd';x.lineWidth=14;x.lineJoin='round';x.lineCap='round';
  x.beginPath();x.moveTo(100,160);x.quadraticCurveTo(165,130,230,180);x.quadraticCurveTo(295,130,360,160);x.lineTo(360,310);x.quadraticCurveTo(295,285,230,335);x.quadraticCurveTo(165,285,100,310);x.closePath();x.stroke();
  x.beginPath();x.moveTo(230,180);x.lineTo(230,335);x.moveTo(155,110);x.lineTo(230,70);x.lineTo(305,110);x.stroke();x.fillStyle='#c65b41';x.beginPath();x.arc(230,113,17,0,Math.PI*2);x.fill();
  x.fillStyle='#172b4d';x.textAlign='left';x.font='600 61px "Noto Sans TC","Microsoft JhengHei",sans-serif';x.fillText('臺北市政府',415,205);x.font='700 84px "Noto Sans TC","Microsoft JhengHei",sans-serif';x.fillText('教育局',415,308);
  x.fillStyle='#2858bd';x.fillRect(415,350,385,6);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function makeCamera(){
  const v=view($('cameraCanvas'),[3.1,2.65,6.4],[0,.85,0]);
  const white=material(0xf8faff,.2,.25),silver=material(0xa5b5d2,.7,.3),navy=material(0x182c50,.45,.26),black=material(0x080f24,.35,.2),glass=material(0x355dba,.8,.08),blue=material(0x315fce,.35,.25),coral=material(0xd9674b,.2,.3);
  const assembly=new THREE.Group();v.scene.add(assembly);assembly.scale.setScalar(1.12);
  const modelRoot=new THREE.Group();assembly.add(modelRoot);
  cylinder(modelRoot,.66,.79,.14,white,0,-.12,0);cylinder(modelRoot,.54,.58,.075,blue,0,-.215,0);
  cylinder(modelRoot,.20,.29,.6,white,0,.23,-.18);sphere(modelRoot,.265,silver,0,.56,-.18);
  const head=new THREE.Group();head.position.set(0,1.05,0);modelRoot.add(head);head.rotation.x=-.06;
  const body=cylinder(head,.63,.57,1.55,white,0,0,-.03);body.rotation.x=Math.PI/2;
  const back=sphere(head,.57,white,0,0,-.81);back.scale.z=.3;
  const stripe=cylinder(head,.634,.634,.055,blue,0,0,-.52);stripe.rotation.x=Math.PI/2;
  const hood=cylinder(head,.7,.68,.20,white,0,.015,.76);hood.rotation.x=Math.PI/2;
  const ring=cylinder(head,.602,.602,.13,navy,0,.015,.89);ring.rotation.x=Math.PI/2;
  const face=cylinder(head,.525,.525,.13,black,0,.015,.97);face.rotation.x=Math.PI/2;
  mesh(new THREE.TorusGeometry(.365,.035,16,64),silver,head,0,.015,1.05);
  const lens=cylinder(head,.318,.318,.05,glass,0,.015,1.065);lens.rotation.x=Math.PI/2;
  const pupil=cylinder(head,.17,.17,.055,black,0,.015,1.10);pupil.rotation.x=Math.PI/2;
  const reflection=sphere(head,.09,material(0xcad9ff,.35,.12),-.1,.145,1.14);reflection.scale.z=.13;
  sphere(head,.032,coral,.435,.275,1.05);
  for(let i=0;i<4;i++){const vent=box(head,.025,.105,.18,navy,.604,-.17,-.42+i*.22);vent.rotation.z=-.14;}
  const branding=new THREE.MeshBasicMaterial({map:educationTexture(),side:THREE.DoubleSide});
  for(const side of [-1,1]){const plate=mesh(new THREE.PlaneGeometry(1.04,.52),branding,head,side*.655,.10,-.07);plate.rotation.y=side*Math.PI/2;}
  const shape=new THREE.Shape();shape.moveTo(-.68,.65);shape.lineTo(0,.82);shape.lineTo(.68,.65);shape.lineTo(.58,-.18);shape.quadraticCurveTo(.34,-.58,0,-.78);shape.quadraticCurveTo(-.34,-.58,-.58,-.18);shape.closePath();
  const shield=mesh(new THREE.ExtrudeGeometry(shape,{depth:.1,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.035,bevelThickness:.035}),blue,assembly,-1.12,.3,.62);
  shield.rotation.set(-.06,-.2,-.16);shield.scale.setScalar(.55);
  const check1=box(shield,.12,.39,.026,white,-.17,-.06,.16);check1.rotation.z=.65;const check2=box(shield,.12,.67,.026,white,.1,.08,.16);check2.rotation.z=-.65;
  const ground=cylinder(v.scene,1.72,1.72,.035,material(0xd7e1f7,.1,.75),0,-.34,0);
  const halo=mesh(new THREE.TorusGeometry(1.42,.018,8,100),material(0x9fb8ed,.2,.6),v.scene,0,-.305,0);halo.rotation.x=Math.PI/2;
  let px=0,py=0,inside=false,dragging=false,dragX=0,dragYaw=0,manualYaw=0;
  v.canvas.addEventListener('pointermove',e=>{const b=v.canvas.getBoundingClientRect();px=(e.clientX-b.left)/b.width-.5;py=(e.clientY-b.top)/b.height-.5;inside=true;if(dragging)manualYaw=THREE.MathUtils.clamp(dragYaw+(e.clientX-dragX)/b.width*3,-1.2,1.2);});
  v.canvas.addEventListener('pointerleave',()=>{inside=false;});
  v.canvas.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse')return;dragging=true;dragX=e.clientX;dragYaw=assembly.rotation.y;v.canvas.setPointerCapture(e.pointerId);});
  function release(e){dragging=false;inside=false;if(v.canvas.hasPointerCapture(e.pointerId))v.canvas.releasePointerCapture(e.pointerId);}
  v.canvas.addEventListener('pointerup',release);v.canvas.addEventListener('pointercancel',release);
  v.tick=t=>{
    if(reduce.matches){assembly.rotation.set(0,-.12,0);assembly.position.y=0;return;}
    const yaw=dragging?manualYaw:Math.sin(t*.55)*.92+(inside?px*.68:0);
    const pitch=reduce.matches?0:inside?py*.13:Math.sin(t*.45)*.025;
    assembly.rotation.y+=(yaw-assembly.rotation.y)*.12;assembly.rotation.x+=(pitch-assembly.rotation.x)*.12;
    assembly.position.y=reduce.matches?0:Math.sin(t*.8)*.035;
  };
  v.tick(0);v.renderer.render(v.scene,v.camera);
  if(window.PREVIEW_DATA)window.previewMotion={snapshot(){assembly.updateMatrixWorld(true);return {yaw:assembly.rotation.y,shieldParented:shield.parent===assembly,shieldPosition:shield.getWorldPosition(new THREE.Vector3()).toArray(),reduced:reduce.matches};}};
  const url=window.SITE_CONFIG?.CAMERA_MODEL_URL;
  if(url){import('./vendor/GLTFLoader.js').then(({GLTFLoader})=>new GLTFLoader().load(url,gltf=>{const model=gltf.scene;const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());model.position.sub(center);const group=new THREE.Group();group.add(model);group.scale.setScalar(2.6/Math.max(size.x,size.y,size.z));group.position.y=.9;assembly.add(group);modelRoot.visible=false;},undefined,()=>{})).catch(()=>{});}
}

function makeMap(id,city){
  const v=view($(id),[.4,5,5.5],[0,0,0]);
  const shapes=[],ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let hovered=null;
  const convert=([lon,lat])=>new THREE.Vector2((lon-121.56)*18*.906,(lat-25.085)*18);
  (window.TAIPEI_MAP||[]).forEach((d,i)=>{
    const group=new THREE.Group();group.userData.name=d.name;v.scene.add(group);
    d.polygons.forEach(rings=>{const pts=rings[0].map(convert),shape=new THREE.Shape(pts);rings.slice(1).forEach(r=>shape.holes.push(new THREE.Path(r.map(convert))));const geo=new THREE.ExtrudeGeometry(shape,{depth:.13,bevelEnabled:false});const m=mesh(geo,material(city?0x3f67b0:[0x6187c7,0x8aa6d5,0x4a70ae][i%3],.05,.7),group);m.rotation.x=-Math.PI/2;m.userData.group=group;shapes.push(m);const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geo),new THREE.LineBasicMaterial({color:0xf4f7ff,transparent:true,opacity:.65}));m.add(edges);});
    if(!city){const label=document.createElement('span');label.className='map-name';label.textContent=d.name.replace('區','');v.canvas.parentElement.append(label);const p=convert(d.center);group.userData.label=label;group.userData.point=new THREE.Vector3(p.x,.18,-p.y);}
  });
  v.labelLayout=()=>{v.camera.updateMatrixWorld();v.scene.children.forEach(g=>{if(g.userData.label){const p=g.userData.point.clone().project(v.camera);g.userData.label.style.left=((p.x+1)/2*v.canvas.clientWidth)+'px';g.userData.label.style.top=((-p.y+1)/2*v.canvas.clientHeight)+'px';}});};v.labelLayout();
  function hit(e){const b=v.canvas.getBoundingClientRect();pointer.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);ray.setFromCamera(pointer,v.camera);return ray.intersectObjects(shapes,false)[0]?.object.userData.group||null;}
  v.canvas.addEventListener('pointermove',e=>{hovered=hit(e);v.canvas.style.cursor=hovered?'pointer':'default';});v.canvas.addEventListener('pointerleave',()=>{hovered=null;});v.canvas.addEventListener('click',e=>{const h=hit(e);if(h)window.cameraApp.openQuery({district:city?'all':h.userData.name});});
  v.tick=()=>{shapes.forEach(m=>{const active=city?!!hovered:m.userData.group===hovered;const lift=active?.18:0;m.userData.group.position.y=reduce.matches?lift:m.userData.group.position.y+(lift-m.userData.group.position.y)*.22;m.material.emissive.set(active?0x242a4b:0x000000);});};
}
document.fonts.ready.then(()=>{try{makeCamera();}catch(e){$('cameraCanvas').hidden=true;$('cameraFallback').hidden=false;}});
for(const [id,city] of [['districtMap',false],['cityMap',true]])try{makeMap(id,city);}catch(e){$(id).hidden=true;}
function tick(ms){requestAnimationFrame(tick);if(document.hidden||ms-last<32)return;last=ms;for(const v of views){if(v.visible){v.tick(ms/1000);v.renderer.render(v.scene,v.camera);}}}
requestAnimationFrame(tick);
