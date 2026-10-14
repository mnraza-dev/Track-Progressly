import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { SceneKind } from './types';
const palette = { ink: '#272435', violet: '#7968ed', cream: '#f5f0df', lime: '#d9f68a', orange: '#ed9163', blue: '#719bbd', silver: '#d8dce1' };
function material(color: string, metalness = 0, roughness = .36) { return new THREE.MeshPhysicalMaterial({ color, metalness, roughness, clearcoat: .6, clearcoatRoughness: .2, envMapIntensity: 1.1 }); }
function box(width:number,height:number,depth:number,color:string,radius=.06){ return new THREE.Mesh(new RoundedBoxGeometry(width,height,depth,2,radius),material(color)); }
function sphere(radius:number,color:string,metalness=.7){return new THREE.Mesh(new THREE.SphereGeometry(radius,24,16),material(color,metalness,.16));}
function ring(radius:number,tube:number,color:string,metalness=.4,arc=Math.PI*2){return new THREE.Mesh(new THREE.TorusGeometry(radius,tube,14,80,arc),material(color,metalness,.22));}
function book(color:string,width=1.7){const group=new THREE.Group();const pages=box(width-.07,.23,1.07,palette.cream,.02);group.add(pages);for(const y of [-.16,.16]){const cover=box(width,.07,1.18,color,.035);cover.position.y=y;group.add(cover);}const spine=box(.09,.34,1.18,color,.035);spine.position.x=-width/2+.03;group.add(spine);for(let i=0;i<5;i++){const line=new THREE.Mesh(new THREE.BoxGeometry(width-.16,.006,.009),new THREE.MeshStandardMaterial({color:'#ddd5c4',roughness:.8}));line.position.set(.02,-.08+i*.04,.543);group.add(line);}return group;}
function browserTexture(kind:'video'|'code'){const canvas=document.createElement('canvas');canvas.width=768;canvas.height=512;const c=canvas.getContext('2d')!;c.fillStyle=kind==='code'?'#252833':'#f6f3e8';c.fillRect(0,0,768,512);c.fillStyle=kind==='code'?'#333744':'#e9e5d9';c.fillRect(0,0,768,72);['#ed976f','#d6d986','#b0c6c2'].forEach((color,i)=>{c.fillStyle=color;c.beginPath();c.arc(40+i*29,35,7,0,Math.PI*2);c.fill();});c.font='500 17px monospace';c.fillStyle=kind==='code'?'#7f899e':'#a6a197';c.fillText(kind==='code'?'a little practice.js':'learntrack / a new perspective',242,43);if(kind==='video'){c.fillStyle='#7464dc';c.beginPath();c.roundRect(288,165,182,142,25);c.fill();c.fillStyle='#f6f3e8';c.beginPath();c.moveTo(358,199);c.lineTo(413,236);c.lineTo(358,273);c.closePath();c.fill();c.font='500 19px monospace';c.fillStyle='#827c8e';c.fillText('WATCH. THINK. MAKE.',272,368);c.fillStyle='#ddd8cc';c.fillRect(51,449,658,5);c.fillStyle='#9584df';c.fillRect(51,449,255,5);}else{const lines=[['#8bc9a6','const curiosity = true;'],['#a6a0dc',''],['#a6a0dc','function makeProgress() {'],['#d7e1aa','  learn.somethingNew();'],['#94bdd6','  build.somethingReal();'],['#a6a0dc','}'],['#e2a17c',''],['#d6cbac','makeProgress();']];c.font='24px monospace';lines.forEach(([color,line],i)=>{c.fillStyle='#60687b';c.fillText(String(i+1).padStart(2,'0'),40,119+i*45);c.fillStyle=color;c.fillText(line,101,119+i*45);});}const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;}
function browser(kind:'video'|'code'){const group=new THREE.Group();const frame=box(2.05,1.39,.16,kind==='video'?palette.violet:palette.ink,.065);group.add(frame);const face=new THREE.Mesh(new THREE.PlaneGeometry(1.92,1.28),new THREE.MeshBasicMaterial({map:browserTexture(kind)}));face.position.z=.086;group.add(face);return group;}
function orbitLine(radius:number,color:string){const curve=new THREE.EllipseCurve(0,0,radius,radius,0,Math.PI*2);const geometry=new THREE.BufferGeometry().setFromPoints(curve.getPoints(96));return new THREE.LineLoop(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity:.45}));}
export function buildModel(kind:SceneKind,progress=0){const root=new THREE.Group();root.name=`learntrack-${kind}`;
 if(kind==='hero'){
  const portal=ring(1.48,.19,palette.violet,.62);portal.rotation.set(.18,.27,-.34);portal.position.set(.12,.17,-.18);root.add(portal);
  const orbit=orbitLine(1.98,'#a49ab8');orbit.rotation.set(.22,-.25,.35);orbit.position.z=-.6;root.add(orbit);
  const orbit2=ring(1.74,.011,palette.silver,.9);orbit2.rotation.set(.54,-.72,.42);orbit2.position.z=-.35;root.add(orbit2);
  const panel=browser('video');panel.rotation.set(-.06,-.3,.13);panel.position.set(.05,.27,.64);root.add(panel);
  const lower=book(palette.orange,1.8);lower.position.set(-.25,-1.25,.16);lower.rotation.y=-.26;root.add(lower);
  const upper=book(palette.lime,1.65);upper.position.set(-.13,-.89,.32);upper.rotation.y=.2;root.add(upper);
  const chrome=sphere(.27,palette.silver,.96);chrome.position.set(1.37,1.47,.36);root.add(chrome);
  const pebble=new THREE.Mesh(new THREE.IcosahedronGeometry(.23,1),material(palette.lime,.14,.32));pebble.position.set(-1.5,.99,.6);pebble.rotation.set(.3,.5,.2);root.add(pebble);
  const knot=new THREE.Mesh(new THREE.TorusKnotGeometry(.21,.072,64,10),material(palette.orange,.5,.24));knot.position.set(1.45,-.96,.65);root.add(knot);
  const dot=sphere(.08,palette.cream,.3);dot.position.set(-1.74,-.58,.26);root.add(dot);
  root.rotation.set(.06,-.06,-.06);
 }else if(kind==='books'){
  [palette.ink,palette.violet,palette.lime].forEach((color,i)=>{const volume=book(color,1.9-i*.12);volume.position.set((i-1)*.05,(i-1)*.37,0);volume.rotation.y=(i-1)*.26;root.add(volume);});root.rotation.set(.24,-.47,-.14);const dot=sphere(.16,palette.orange);dot.position.set(1.11,.62,.1);root.add(dot);
 }else if(kind==='code'){
  const panel=browser('code');panel.rotation.set(-.12,-.2,-.1);panel.position.y=.15;root.add(panel);const foot=box(2.12,.12,1.08,'#8baab6',.045);foot.position.set(0,-.69,.41);root.add(foot);const keyboard=box(1.75,.016,.56,palette.ink,.02);keyboard.position.set(0,-.618,.42);root.add(keyboard);const gem=sphere(.18,palette.lime,.5);gem.position.set(1.08,.92,.35);root.add(gem);root.rotation.y=.12;
 }else if(kind==='data'){
  const base=box(2.0,.12,1.5,'#c4ad88',.035);base.position.y=-.7;root.add(base);const colors=['#ecd4a4','#cc9b57','#f0be69'];for(let x=0;x<3;x++)for(let z=0;z<3;z++){const height=.3+((x*3+z*2)%5)*.18;const bar=box(.39,height,.39,colors[(x+z)%3],.035);bar.position.set((x-1)*.52,-.64+height/2,(z-1)*.46);root.add(bar);}const loop=ring(.5,.055,palette.ink,.45);loop.rotation.set(.25,0,.1);loop.position.set(.66,.89,-.3);root.add(loop);root.rotation.set(.23,-.5,.03);
 }else if(kind==='design'){
  const loop=ring(.75,.22,'#cf6b59',.32);loop.rotation.set(.1,.52,.52);loop.position.set(-.28,.12,.16);root.add(loop);const loop2=ring(.65,.18,'#e9b794',.2);loop2.rotation.set(.8,-.5,-.15);loop2.position.set(.36,-.08,-.22);root.add(loop2);const cube=box(.48,.48,.48,palette.cream,.03);cube.rotation.set(.25,-.4,.2);cube.position.set(-.95,-.67,.12);root.add(cube);const metal=sphere(.26,palette.silver,.95);metal.position.set(.9,.64,.27);root.add(metal);root.rotation.y=-.1;
 }else if(kind==='goal'){
  const base=ring(1.05,.09,'#e5dfd3',.08);root.add(base);if(progress>0){const arc=ring(1.05,.105,palette.violet,.25,Math.PI*2*Math.min(1,progress));arc.rotation.z=Math.PI/2;arc.position.z=.03;root.add(arc);}const cap=sphere(.11,palette.violet,.3);cap.position.set(0,1.05,.05);root.add(cap);root.rotation.set(.1,-.12,0);
 }else{
  const knot=new THREE.Mesh(new THREE.TorusKnotGeometry(.85,.23,100,18,2,3),material(palette.violet,.6,.24));root.add(knot);const orbit=orbitLine(1.5,'#8b80a1');orbit.rotation.x=.6;root.add(orbit);const dot=sphere(.15,palette.lime);dot.position.set(1.3,.51,.5);root.add(dot);root.rotation.set(.1,-.2,.2);
 }
 return root;
}
export function disposeModel(model:THREE.Object3D){const geometries=new Set<THREE.BufferGeometry>();const materials=new Set<THREE.Material>();const textures=new Set<THREE.Texture>();model.traverse(object=>{if(object instanceof THREE.Mesh || object instanceof THREE.Line){geometries.add(object.geometry);const list=Array.isArray(object.material)?object.material:[object.material];list.forEach(mat=>{materials.add(mat);Object.values(mat).forEach(value=>{if(value instanceof THREE.Texture)textures.add(value);});});}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
