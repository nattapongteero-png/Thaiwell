/**
 * เรนเดอร์ท่ายืด (src/data/stretchMotion.ts) เป็นภาพ GIF วนซ้ำ → assets/stretch/<id>.gif
 * แนวเดียวกับ gymnerd / ExerciseDB: ภาพเคลื่อนไหวสำเร็จรูป แสดงด้วย <Image> ได้ทุกที่
 * (iOS simulator แสดง GL ได้แค่เฟรมแรก + ไม่ต้องโหลด/คำนวณ 3D บนมือถือ)
 *
 *   node scripts/render-stretch-gifs.mjs [path/to/playwright-core]
 *
 * ใช้ Google Chrome ในเครื่อง + three ใน node_modules + หุ่น assets/models/er_patient_figure.glb
 * ประกอบ GIF ด้วย Python Pillow (python3 -c ...) · แก้ท่า/สี/มุม → แก้ stretchMotion.ts แล้วรันใหม่
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { transform } from 'sucrase';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'assets/stretch');
// GIF เก็บเวลาต่อเฟรมเป็นหน่วย 10ms → ใช้ 80ms พอดี (12.5 fps) ไม่งั้นถูกปัดแล้วภาพเร็วกว่าป้ายขั้นตอน
// ต้องตรงกับ FRAME_MS ใน StretchDemo.tsx
const FRAME_MS = 80;
const W = 600;
const H = 538; // สัดส่วนช่องวิดีโอบนการ์ด (~335×300)
const BG = '#F3F4F6'; // colors.surface.sunken

let chromium;
try {
  ({ chromium } = require(process.argv[2] || 'playwright-core'));
} catch {
  console.error('ต้องมี playwright-core: node scripts/render-stretch-gifs.mjs <path/to/playwright-core>');
  process.exit(1);
}

// ข้อมูลท่า (TS → JS)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stretch-'));
const ts = fs.readFileSync(path.join(ROOT, 'src/data/stretchMotion.ts'), 'utf8');
fs.writeFileSync(path.join(tmp, 'motion.mjs'), transform(ts, { transforms: ['typescript'] }).code);
const { STRETCH_MOTION } = await import(path.join(tmp, 'motion.mjs'));

const HARNESS = `<!doctype html><html><body style="margin:0;background:${BG}">
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
// ลำดับ = แม่ก่อนลูก (สะบัก/ไหปลาร้าก่อนต้นแขน)
// (ขาของหุ่นนี้ผูกเท้ากับ IK แยก งอเข่าเองไม่ได้ → ท่านั่งใช้การซูมช่วงเอวขึ้นไปแทน)
const SEG={Belly:'Chest',Chest:'Neck',Neck:'Head',CollarL:'UpperArmL',CollarR:'UpperArmR',UpperArmL:'ForearmL',ForearmL:'PalmL',UpperArmR:'ForearmR',ForearmR:'PalmR'};
const ORDER=Object.keys(SEG);
const FINGERS=[];for(const S of ['L','R'])for(const f of ['Index','Middle','Ring','Pinky'])for(const j of [1,2,3])FINGERS.push(f+j+S);
// กระดูกทั้งหมดที่ท่าทางเปลี่ยน (เก็บ quaternion ต่อท่าแล้ว slerp)
for(const S of ['L','R'])for(const j of [1,2,3])FINGERS.push('Thumb'+j+S);
const ALL=[...ORDER,'PalmL','PalmR',...FINGERS];
const BASE=new THREE.Color('#D6D0C6'),PRIMARY=new THREE.Color('#D93A2B'),ASSIST=new THREE.Color('#F08A24');
const key=n=>n.replace(/_\\d+$/,'').replace(/\\./g,'');
const ease=x=>x*x*(3-2*x);
const r=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setPixelRatio(1);r.setSize(${W},${H});document.body.appendChild(r.domElement);
r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=0.95;
const scene=new THREE.Scene();scene.background=new THREE.Color('${BG}');
const pm=new THREE.PMREMGenerator(r);scene.environment=pm.fromScene(new RoomEnvironment(),0.04).texture;
scene.add(new THREE.HemisphereLight(0xffffff,0xa7acb2,1.1));
const d1=new THREE.DirectionalLight(0xfffaf4,2.2);d1.position.set(2,3,4);scene.add(d1);
const d2=new THREE.DirectionalLight(0xe9f0ff,1.4);d2.position.set(-3,1,-2);scene.add(d2);
const cam=new THREE.PerspectiveCamera(30,${W}/${H},0.1,100);cam.position.set(0,0.42,5.8);
const gltf=await new GLTFLoader().loadAsync('/model.glb');
const root=gltf.scene;const arms=[];root.traverse(o=>{if(o.name.startsWith('Armature'))arms.push(o)});
const arm=arms[1]??arms[0];arms.forEach(a=>a.visible=a===arm);
const bones={};arm.traverse(o=>{if(o.isBone)bones[key(o.name)]=o});
const rest={};for(const k of ALL)rest[k]=bones[k].quaternion.clone();
const group=new THREE.Group();group.add(root);scene.add(group);
root.updateMatrixWorld(true);
const c0=arm.getWorldPosition(new THREE.Vector3());root.position.set(-c0.x,-1.02,0);
const meshes=[];arm.traverse(o=>{if(o.isSkinnedMesh){o.frustumCulled=false;const col=new THREE.BufferAttribute(new Float32Array(o.geometry.getAttribute('position').count*3),3);o.geometry.setAttribute('color',col);o.material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.75,metalness:0});meshes.push({m:o,col})}});
/** หมุนกระดูกรอบแกนในพิกัดโลก */
function spin(bone,axis,ang){group.updateMatrixWorld(true);const dq=new THREE.Quaternion().setFromAxisAngle(axis,ang);const pw=bone.parent.getWorldQuaternion(new THREE.Quaternion()),bw=bone.getWorldQuaternion(new THREE.Quaternion());bone.quaternion.copy(pw.invert().multiply(dq.multiply(bw)));}
const WP=n=>bones[n].getWorldPosition(new THREE.Vector3());
/** ชี้ท่อน k ไปตามทิศ w (พิกัดโลก) */
function aim(k,w){group.updateMatrixWorld(true);const bone=bones[k];const cur=WP(SEG[k]).sub(WP(k)).normalize();
  const dq=new THREE.Quaternion().setFromUnitVectors(cur,w.clone().normalize());const pw=bone.parent.getWorldQuaternion(new THREE.Quaternion()),bw=bone.getWorldQuaternion(new THREE.Quaternion());bone.quaternion.copy(pw.invert().multiply(dq.multiply(bw)));}
/** IK 2 ท่อน: ข้อมือไปที่ T · ศอกชี้ตาม pole */
function ik(S,T,pole){group.updateMatrixWorld(true);const Sh=WP('UpperArm'+S),E0=WP('Forearm'+S),W0=WP('Palm'+S);
  const l1=E0.distanceTo(Sh),l2=W0.distanceTo(E0);
  const D=T.clone().sub(Sh);const d=Math.min(D.length(),l1+l2-1e-4);const dir=D.normalize();
  const a=(l1*l1-l2*l2+d*d)/(2*d),hh=Math.sqrt(Math.max(0,l1*l1-a*a));
  const pp=pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  const E=Sh.clone().addScaledVector(dir,a).addScaledVector(pp,hh);const Tc=Sh.clone().addScaledVector(dir,d);
  aim('UpperArm'+S,E.clone().sub(Sh));aim('Forearm'+S,Tc.clone().sub(E));}
/** normal ของฝ่ามือ (ด้านใน) — ตรวจกับท่ายืนพัก: ฝ่ามือหันเข้าหาลำตัว */
function palmN(S){group.updateMatrixWorld(true);const n=new THREE.Vector3().crossVectors(WP('Index1'+S).sub(WP('Pinky1'+S)).normalize(),WP('Middle1'+S).sub(WP('Palm'+S)).normalize()).normalize();if(S==='L')n.negate();return n;}
/** บิดปลายแขน/ข้อมือให้ฝ่ามือหันตาม want (ปลายแขน 60% · ข้อมือ 40% ผิวไม่บิดเป็นเกลียว) */
function twist(S,want){group.updateMatrixWorld(true);const axis=WP('Palm'+S).sub(WP('Forearm'+S)).normalize();
  const pa=palmN(S).projectOnPlane(axis).normalize(),pb=want.clone().normalize().projectOnPlane(axis).normalize();
  let ang=Math.acos(THREE.MathUtils.clamp(pa.dot(pb),-1,1));if(new THREE.Vector3().crossVectors(pa,pb).dot(axis)<0)ang=-ang;
  spin(bones['Forearm'+S],axis,ang*0.6);spin(bones['Palm'+S],axis,ang*0.4);}
/** กระดกข้อมือ + งอนิ้วเข้าหาฝ่ามือ (องศา) */
function hand(S,wrist,curl){const sg=S==='R'?1:-1;
  if(wrist){group.updateMatrixWorld(true);spin(bones['Palm'+S],WP('Index1'+S).sub(WP('Pinky1'+S)).normalize(),sg*wrist*Math.PI/180);}
  if(curl){for(const f of ['Index','Middle','Ring','Pinky'])for(const j of [1,2,3]){group.updateMatrixWorld(true);spin(bones[f+j+S],WP('Index1'+S).sub(WP('Pinky1'+S)).normalize(),sg*curl*Math.PI/180);}}}
const TORSO=['Belly','Chest','Neck','CollarL','CollarR'];
const FING=['Index','Middle','Ring','Pinky'];
/* ---------- ขา: ต้นขา (Hip) → หน้าแข้ง (Shin) · เท้าแขวนอยู่กับ LegIK (ลูกของ root) ไม่ใช่ปลายหน้าแข้ง
 * → แก้ IK ต้นขา/หน้าแข้งเอง แล้วย้าย LegIK ไปวางที่ข้อเท้า (ปลายหน้าแข้ง) · หมุน LegIK = หันปลายเท้า */
const restPos={Pelvis:bones.Pelvis.position.clone(),LegIKL:bones.LegIKL.position.clone(),LegIKR:bones.LegIKR.position.clone()};
const LEGQ=['Pelvis','HipL','ShinL','LegIKL','HipR','ShinR','LegIKR'];
for(const k of LEGQ)rest[k]=bones[k].quaternion.clone();
function resetAll(){for(const k of ALL)bones[k].quaternion.copy(rest[k]);for(const k of LEGQ)bones[k].quaternion.copy(rest[k]);for(const k in restPos)bones[k].position.copy(restPos[k]);group.updateMatrixWorld(true);}
resetAll();
const SHIN_LEN={L:WP('ShinL').distanceTo(WP('LegIKL')),R:WP('ShinR').distanceTo(WP('LegIKR'))};
const REST_ANK={L:WP('LegIKL'),R:WP('LegIKR')};const REST_HIP={L:WP('HipL'),R:WP('HipR')};
/** หมุนกระดูกให้ทิศ cur (โลก) ไปเป็น want */
function rotTo(bone,cur,want){group.updateMatrixWorld(true);const dq=new THREE.Quaternion().setFromUnitVectors(cur.clone().normalize(),want.clone().normalize());const pw=bone.parent.getWorldQuaternion(new THREE.Quaternion()),bw=bone.getWorldQuaternion(new THREE.Quaternion());bone.quaternion.copy(pw.invert().multiply(dq.multiply(bw)));}
const shinDir=S=>new THREE.Vector3(0,1,0).applyQuaternion(bones['Shin'+S].getWorldQuaternion(new THREE.Quaternion())).normalize();
function legIK(S,T,pole){group.updateMatrixWorld(true);const H=WP('Hip'+S),K0=WP('Shin'+S);const l1=K0.distanceTo(H),l2=SHIN_LEN[S];
  const D=T.clone().sub(H);const d=Math.min(D.length(),l1+l2-1e-4);const dir=D.normalize();
  const a=(l1*l1-l2*l2+d*d)/(2*d),hh=Math.sqrt(Math.max(0,l1*l1-a*a));
  const pp=pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  const K=H.clone().addScaledVector(dir,a).addScaledVector(pp,hh);const A=H.clone().addScaledVector(dir,d);
  rotTo(bones['Hip'+S],WP('Shin'+S).sub(WP('Hip'+S)),K.clone().sub(H));
  group.updateMatrixWorld(true);rotTo(bones['Shin'+S],shinDir(S),A.clone().sub(K));
  group.updateMatrixWorld(true);const lk=bones['LegIK'+S];lk.position.copy(lk.parent.worldToLocal(A.clone()));}
function footTo(S,w){group.updateMatrixWorld(true);rotTo(bones['LegIK'+S],WP('Toes'+S).sub(WP('Foot'+S)),new THREE.Vector3(...w));}
function setPelvis(drop,fwd){const p=bones.Pelvis;p.position.copy(restPos.Pelvis);group.updateMatrixWorld(true);const w=WP('Pelvis').add(new THREE.Vector3(0,-(drop||0),fwd||0));p.position.copy(p.parent.worldToLocal(w));group.updateMatrixWorld(true);}
/** กระดกข้อมือ + งอนิ้ว (ต่อนิ้ว) + นิ้วโป้ง · องศา + = เข้าหาฝ่ามือ */
function handF(S,wrist,f,thumb){const sg=S==='R'?1:-1;const ax=()=>WP('Index1'+S).sub(WP('Pinky1'+S)).normalize();
  if(wrist){group.updateMatrixWorld(true);spin(bones['Palm'+S],ax(),sg*wrist*Math.PI/180);}
  for(const n of FING){const c=f[n]||0;if(!c)continue;for(const j of [1,2,3]){group.updateMatrixWorld(true);spin(bones[n+j+S],ax(),sg*c*Math.PI/180);}}
  if(thumb){for(const j of [2,3]){group.updateMatrixWorld(true);spin(bones['Thumb'+j+S],WP('Middle1'+S).sub(WP('Palm'+S)).normalize(),sg*thumb*Math.PI/180);}}}
/** พารามิเตอร์มือของข้าง S จากท่า */
function handOf(pose,S){const c=pose['curl'+S]??pose.curl??0;const f={};for(const n of FING)f[n]=(pose['fingers'+S]&&pose['fingers'+S][n]!=null)?pose['fingers'+S][n]:c;
  return {wrist:pose['wrist'+S]??pose.wrist??0,f,thumb:pose['thumb'+S]??(c>=60?40:0)};}
/** จุดอ้างอิงสำหรับวางมือ (reach) */
function refPt(rel){if(rel==='head')return WP('Head');if(rel==='chest')return WP('Chest');if(rel==='pelvis')return WP('Pelvis');if(rel==='knee')return null;return WP('UpperArmL').add(WP('UpperArmR')).multiplyScalar(0.5);}
function solve(pose){resetAll();
  setPelvis(pose.pelvisDrop,pose.pelvisFwd);
  for(const k of ORDER){const w=pose[k];if(w)aim(k,new THREE.Vector3(...w));}
  // ขา: ข้อเท้าไปที่ (ต้นขา + at) หรือคงที่พื้นเดิม (plant) · เข่าชี้ตาม pole
  for(const S of ['L','R']){const L=pose.legs&&pose.legs[S];group.updateMatrixWorld(true);
    const T=L&&L.at?WP('Hip'+S).add(new THREE.Vector3(...L.at)):L&&L.plant?REST_ANK[S].clone():WP('Hip'+S).add(REST_ANK[S].clone().sub(REST_HIP[S]));
    const pole=L&&L.pole?new THREE.Vector3(...L.pole):new THREE.Vector3(0,0,1);
    legIK(S,T,pole);if(L&&L.foot)footTo(S,L.foot);}
  // ประสานมือด้วย IK: วางข้อมือทั้งสองที่จุดเดียวกัน (ฝ่ามือแนบกัน ห่างแนวกลางคนละ gap) + เยื้องครึ่งช่องนิ้ว (stagger) ให้นิ้วสลับกัน
  if(pose.hands){const h=pose.hands;group.updateMatrixWorld(true);
    const base=refPt(h.rel).add(new THREE.Vector3(...h.at));
    const pn=new THREE.Vector3(...(pose.palmL||[-1,0,0])).normalize();
    for(const S of ['L','R']){const sg=S==='L'?1:-1;
      const nS=S==='L'?pn.clone():new THREE.Vector3(-pn.x,pn.y,pn.z);
      const T=base.clone().addScaledVector(nS,-(h.gap??0.02));
      if(h.stagger)T.addScaledVector(new THREE.Vector3(...h.stagger),sg);
      if(h.spread)T.x+=sg*h.spread;
      const pole=new THREE.Vector3(...h.pole);if(S==='R')pole.x=-pole.x;
      ik(S,T,pole);}}
  // วางมือแต่ละข้าง (reach): ข้อมือไปที่ จุดอ้างอิง + at · ศอกชี้ตาม pole
  if(pose.reach)for(const S of ['L','R']){const r=pose.reach[S];if(!r)continue;group.updateMatrixWorld(true);
    const base=r.rel==='hip'?WP('Hip'+S):r.rel==='knee'?WP('Shin'+S):r.rel==='ankle'?WP('LegIK'+S):refPt(r.rel);
    ik(S,base.add(new THREE.Vector3(...r.at)),new THREE.Vector3(...r.pole));}
  for(const S of ['L','R']){
    const want=pose['palm'+S];
    if(want)twist(S,new THREE.Vector3(...want));
    lastPalm[S]=palmN(S);
    const h=handOf(pose,S);handF(S,h.wrist,h.f,h.thumb);
  }
  const out={};for(const k of ALL)out[k]=bones[k].quaternion.clone();return out;}
/**
 * ท่า → ข้อมูลสำหรับเคลื่อนระหว่างท่า: quaternion ลำตัว/สะบัก + ตำแหน่งข้อมือ/ศอกเทียบหัวไหล่ + ทิศฝ่ามือ + มือ/นิ้ว
 * + สะโพก (ยุบลง) + ข้อเท้า/เข่าเทียบต้นขา + ทิศเท้า
 * (ระหว่างท่าเลื่อน "ตำแหน่งมือ/เท้า" แล้วแก้ IK ทุกเฟรม → แขนขาเคลื่อนพร้อมกันแบบคน ไม่เหวี่ยงอ้อม)
 */
function spec(pose){const q=solve(pose);group.updateMatrixWorld(true);
  const o={q:{},wr:{},el:{},pn:{},hd:{},drop:pose.pelvisDrop||0,fwd:pose.pelvisFwd||0,ank:{},kn:{},fq:{}};for(const k of TORSO)o.q[k]=q[k].clone();
  for(const S of ['L','R']){const sh=WP('UpperArm'+S);o.wr[S]=WP('Palm'+S).sub(sh);o.el[S]=WP('Forearm'+S).sub(sh);o.pn[S]=lastPalm[S].clone();o.hd[S]=handOf(pose,S);
    const hp=WP('Hip'+S);o.ank[S]=WP('LegIK'+S).sub(hp);o.kn[S]=WP('Shin'+S).sub(hp);o.fq[S]=bones['LegIK'+S].quaternion.clone();}
  resetAll();return o;}
const lastPalm={};
const L_=THREE.MathUtils.lerp;
/** วางท่าระหว่าง a → b (f 0..1) */
function blend(a,b,f){resetAll();setPelvis(L_(a.drop,b.drop,f),L_(a.fwd,b.fwd,f));
  for(const k of TORSO)bones[k].quaternion.slerpQuaternions(a.q[k],b.q[k],f);
  for(const S of ['L','R']){group.updateMatrixWorld(true);const hp=WP('Hip'+S);
    legIK(S,hp.add(a.ank[S].clone().lerp(b.ank[S],f)),a.kn[S].clone().lerp(b.kn[S],f));
    bones['LegIK'+S].quaternion.slerpQuaternions(a.fq[S],b.fq[S],f);}
  for(const S of ['L','R']){group.updateMatrixWorld(true);const sh=WP('UpperArm'+S);
    const da=a.wr[S].clone().normalize(),db=b.wr[S].clone().normalize();
    const dq=new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(),new THREE.Quaternion().setFromUnitVectors(da,db),f);
    const T=sh.clone().add(da.applyQuaternion(dq).multiplyScalar(L_(a.wr[S].length(),b.wr[S].length(),f)));
    ik(S,T,a.el[S].clone().lerp(b.el[S],f));
    twist(S,a.pn[S].clone().lerp(b.pn[S],f));
    const ha=a.hd[S],hb=b.hd[S];const ff={};for(const n of FING)ff[n]=L_(ha.f[n],hb.f[n],f);
    handF(S,L_(ha.wrist,hb.wrist,f),ff,L_(ha.thumb,hb.thumb,f));}}
function mask(m,areas){const g=m.geometry,si=g.getAttribute('skinIndex'),sw=g.getAttribute('skinWeight'),nz=g.getAttribute('normal');const names=m.skeleton.bones.map(b=>key(b.name));const out=new Float32Array(si.count);
  for(let v=0;v<si.count;v++){let w=0;for(let j=0;j<4;j++){const ar=areas.find(x=>x.bone===names[si.getComponent(v,j)]);if(!ar)continue;const z=nz.getZ(v);
    const side=ar.side==='back'?THREE.MathUtils.clamp(-z*2+.3,0,1):ar.side==='front'?THREE.MathUtils.clamp(z*2+.3,0,1):ar.side==='notFront'?THREE.MathUtils.clamp(-z*2+1.1,0,1):1;w+=sw.getComponent(v,j)*side}out[v]=Math.min(1,w*1.3)}return out}
let cur=null;
/** ขอบเขตทั้งตัวของทุกจังหวะ (หลังหมุนมุมมอง) */
function bounds(motion){group.rotation.y=0;group.position.x=0;const pts=[];
  const keys=motion.keys.map(k=>{solve(k.pose);group.updateMatrixWorld(true);
    for(const n of ['Head','PalmL','PalmR','Middle3L','Middle3R','ForearmL','ForearmR','UpperArmL','UpperArmR','ShinL','ShinR','LegIKL','LegIKR','ToesL','ToesR','Pelvis'])pts.push(WP(n));
    pts.push(WP('Head').add(new THREE.Vector3(0,0.12,0)));return spec(k.pose);});
  const rq=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),motion.view);
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(const p of pts){const v=p.clone().applyQuaternion(rq);x0=Math.min(x0,v.x);x1=Math.max(x1,v.x);y0=Math.min(y0,v.y);y1=Math.max(y1,v.y);}
  // เผื่อปลายนิ้ว/เท้า + เส้นโค้งระหว่างท่า
  return {keys,x0:x0-0.07,x1:x1+0.07,y0:y0-0.04,y1:y1+0.08};}
const TOP=0.12,SIDE=0.06,BOT=0.05,tn=Math.tan(15*Math.PI/180),asp=${W}/${H};
/** ความสูงภาพ (เมตร) ที่ท่านี้ต้องใช้ — ทุกท่าใช้ค่าสูงสุดร่วมกัน → หุ่นขนาดเท่ากันทุกการ์ด */
window.needHv=(motion)=>{const b=bounds(motion);resetAll();return Math.max((b.y1-b.y0)/(1-TOP-BOT),(b.x1-b.x0)/(asp*(1-2*SIDE)));};
window.setup=(motion,Hv)=>{const b=bounds(motion);const keys=b.keys;group.rotation.y=motion.view;
  // ทั้งตัว ขนาดเท่ากันทุกท่า (Hv ร่วม) · วางกึ่งกลางพื้นที่ใต้แถบป้าย
  const mid=(BOT+(1-TOP))/2;
  cam.position.set((b.x0+b.x1)/2,(b.y0+b.y1)/2-(mid-0.5)*Hv,Hv/2/tn);
  if(motion.camera){cam.position.set(0,motion.camera.y,motion.camera.dist);}
  const masks=meshes.map(({m})=>({p:mask(m,motion.primary.areas),a:motion.assist?mask(m,motion.assist.areas):null}));
  let t=0;const spans=motion.keys.map(k=>{const s={start:t,moveEnd:t+k.move,end:t+k.move+k.hold};t=s.end;return s});
  cur={motion,keys,masks,spans,total:t,level:.4};return t;};
function paint(q){const c=new THREE.Color();meshes.forEach(({col},i)=>{const {p,a}=cur.masks[i];for(let v=0;v<p.length;v++){c.copy(BASE).lerp(ASSIST,(a?a[v]:0)*q*.85).lerp(PRIMARY,p[v]*q);col.setXYZ(v,c.r,c.g,c.b)}col.needsUpdate=true})}
// เดินเวลาทีละเฟรม (ความเข้มสีไล่ตามแบบเดียวกับ StretchDemo) → คืน dataURL
window.frame=(t,dt)=>{const {spans,keys,motion}=cur;const i=spans.findIndex(s=>t<s.end);const s=spans[i];const from=keys[(i-1+keys.length)%keys.length],to=keys[i];
  const f=t>=s.moveEnd?1:ease((t-s.start)/(s.moveEnd-s.start));const ry=group.rotation.y;group.rotation.y=0;blend(from,to,f);group.rotation.y=ry;
  const hold=t>=s.moveEnd;const target=motion.keys[i].peak&&hold?1:.4;cur.level+=(target-cur.level)*Math.min(1,dt*4);paint(cur.level);
  r.render(scene,cam);return r.domElement.toDataURL('image/png');};
// ภาพนิ่งซูมที่มือ (ตรวจท่าประสานมือ): ท่าที่ idx จากหลายมุม
window.still=(motion,idx,views)=>{group.rotation.y=0;group.position.x=0;solve(motion.keys[idx].pose);group.updateMatrixWorld(true);
  const c=views.body==='head'?WP('Head').add(new THREE.Vector3(0,0.06,0)):views.body?WP('Chest').add(new THREE.Vector3(0,0.15,0)):WP('PalmL').add(WP('PalmR')).multiplyScalar(0.5);views=views.list||views;const cm=new THREE.PerspectiveCamera(30,${W}/${H},0.01,100);
  const out=views.map(([az,el,dist])=>{const a=az*Math.PI/180,e=el*Math.PI/180;cm.position.set(c.x+Math.sin(a)*Math.cos(e)*dist,c.y+Math.sin(e)*dist,c.z+Math.cos(a)*Math.cos(e)*dist);cm.lookAt(c);paintFlat();r.render(scene,cm);return r.domElement.toDataURL('image/png');});
  return out;};
function paintFlat(){meshes.forEach(({col})=>{for(let v=0;v<col.count;v++)col.setXYZ(v,BASE.r,BASE.g,BASE.b);col.needsUpdate=true})}
// วัดขอบเขตศีรษะ (จุดยอดที่ผูกกับกระดูก Head) เทียบตำแหน่งกระดูก Head · ใช้กำหนดจุดวางมือท่านวดหน้า
window.headBox=()=>{resetAll();group.rotation.y=0;group.updateMatrixWorld(true);const hb=WP('Head');const mn=new THREE.Vector3(1e9,1e9,1e9),mx=mn.clone().multiplyScalar(-1);
  for(const {m} of meshes){const g=m.geometry,si=g.getAttribute('skinIndex'),sw=g.getAttribute('skinWeight'),pos=g.getAttribute('position');const names=m.skeleton.bones.map(b=>key(b.name));
    for(let v=0;v<pos.count;v++){let w=0;for(let j=0;j<4;j++)if(names[si.getComponent(v,j)]==='Head')w+=sw.getComponent(v,j);if(w<0.6)continue;
      const p=new THREE.Vector3().fromBufferAttribute(pos,v).applyMatrix4(m.matrixWorld);mn.min(p);mx.max(p);}}
  return {min:mn.sub(hb).toArray().map(x=>+x.toFixed(3)),max:mx.sub(hb).toArray().map(x=>+x.toFixed(3)),hand:WP('Middle3L').distanceTo(WP('PalmL')).toFixed(3)};};
window.ready=true;
</script></body></html>`;

const files = {
  '/': ['text/html', Buffer.from(HARNESS)],
};
const server = http
  .createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    let file = null;
    if (u === '/model.glb') file = path.join(ROOT, 'assets/models/er_patient_figure.glb');
    else if (u.startsWith('/three/')) file = path.join(ROOT, 'node_modules', u);
    if (files[u]) {
      res.writeHead(200, { 'Content-Type': files[u][0] });
      return res.end(files[u][1]);
    }
    if (!file || !fs.existsSync(file)) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(0);
const port = server.address().port;

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', (e) => console.error('page:', e.message));
await page.goto(`http://localhost:${port}/`);
await page.waitForFunction(() => window.ready, null, { timeout: 60000 });

if (process.env.HEADBOX) {
  console.log(JSON.stringify(await page.evaluate(() => window.headBox())));
  await browser.close();
  server.close();
  process.exit(0);
}
// STILL="ชื่อท่า:ลำดับท่า" STILL_OUT=ไฟล์.png → ภาพนิ่งซูมมือ 4 มุม (หน้า/ข้าง/หลัง/บน) แล้วจบ
if (process.env.STILL) {
  const [nm, ix] = process.env.STILL.split(':');
  // มุม [องศารอบตัว, องศาก้ม/เงย, ระยะ] · STILL_VIEWS='[[0,10,1.1],...]' เปลี่ยนได้
  const views = process.env.STILL_VIEWS ? JSON.parse(process.env.STILL_VIEWS) : [[0, 10, 0.45], [90, 10, 0.45], [180, 10, 0.45], [0, 80, 0.45]];
  const urls = await page.evaluate(([m, i, v]) => window.still(m, i, v), [STRETCH_MOTION[nm], +ix, views]);
  const parts = urls.map((u, i) => {
    const f = path.join(tmp, `still${i}.png`);
    fs.writeFileSync(f, Buffer.from(u.split(',')[1], 'base64'));
    return f;
  });
  execFileSync('python3', ['-c', `import sys
from PIL import Image
ims=[Image.open(f) for f in sys.argv[2:]]
o=Image.new('RGB',(ims[0].width*len(ims),ims[0].height))
for i,im in enumerate(ims): o.paste(im,(i*im.width,0))
o.save(sys.argv[1])`, process.env.STILL_OUT || 'still.png', ...parts]);
  await browser.close();
  server.close();
  process.exit(0);
}

fs.mkdirSync(OUT, { recursive: true });
const ids = [];
// ขนาดหุ่นเท่ากันทุกท่า: ใช้ความสูงภาพที่มากที่สุดในทุกท่า
let HV = 0;
for (const m of Object.values(STRETCH_MOTION)) HV = Math.max(HV, await page.evaluate((x) => window.needHv(x), m));
for (const [name, motion] of Object.entries(STRETCH_MOTION)) {
  const id = motion.id;
  const total = await page.evaluate(([m, hv]) => window.setup(m, hv), [motion, HV]);
  const n = Math.ceil(total / FRAME_MS);
  const dt = FRAME_MS / 1000;
  const dir = fs.mkdtempSync(path.join(tmp, id + '-'));
  // เดินหนึ่งรอบก่อน (ให้ความเข้มสีต่อเนื่องตอนวนกลับ) แล้วค่อยเก็บรอบที่สอง
  for (let i = 0; i < n; i++) await page.evaluate(([t, d]) => void window.frame(t, d), [i * FRAME_MS, dt]);
  for (let i = 0; i < n; i++) {
    const url = await page.evaluate(([t, d]) => window.frame(t, d), [i * FRAME_MS, dt]);
    fs.writeFileSync(path.join(dir, `${String(i).padStart(4, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
  const out = path.join(OUT, `${id}.gif`);
  execFileSync('python3', [
    '-c',
    `import sys,glob
from PIL import Image
fs=sorted(glob.glob(sys.argv[1]+'/*.png'))
ims=[Image.open(f).convert('RGB') for f in fs]
# พื้นที่เรนเดอร์ได้อาจเพี้ยนเล็กน้อย (ค่าแสง/tone mapping) → ปัดพื้นให้เป็นสีพื้นการ์ดเป๊ะ
from PIL import ImageChops
BGC=tuple(int('${BG}'[i:i+2],16) for i in (1,3,5))
def flat(im):
  solid=Image.new('RGB',im.size,im.getpixel((2,2)))
  m=ImageChops.difference(im,solid).convert('L').point(lambda v:255 if v<6 else 0)
  im.paste(Image.new('RGB',im.size,BGC),mask=m);return im
ims=[flat(im) for im in ims]
# จานสีจากหลายเฟรม (ให้มีทั้งสีแดง/ส้มตอนยืดเต็มที่)
smp=ims[::max(1,len(ims)//12)]
strip=Image.new('RGB',(ims[0].width,ims[0].height*len(smp)))
for i,im in enumerate(smp): strip.paste(im,(0,i*im.height))
pal=strip.quantize(colors=128,method=Image.Quantize.MEDIANCUT)
# สีพื้นต้องตรงกับพื้นการ์ดเป๊ะ (median cut เฉลี่ยสีจนพื้นเพี้ยน) → แทนสีที่ใกล้พื้นที่สุดในจานด้วยสีพื้นจริง
bg=tuple(int('${BG}'[i:i+2],16) for i in (1,3,5))
p=pal.getpalette()[:128*3]
k=min(range(128),key=lambda i:sum((p[i*3+j]-bg[j])**2 for j in range(3)))
p[k*3:k*3+3]=list(bg)
pal=Image.new('P',(1,1));pal.putpalette(p)
q=[im.quantize(palette=pal,dither=Image.Dither.NONE) for im in ims]
q[0].save(sys.argv[2],save_all=True,append_images=q[1:],duration=${FRAME_MS},loop=0,optimize=True,disposal=1)`,
    dir,
    out,
  ]);
  console.log(`${name} → assets/stretch/${id}.gif · ${n} เฟรม · ${(total / 1000).toFixed(1)} วิ · ${Math.round(fs.statSync(out).size / 1024)} KB`);
  ids.push(id);
}
await browser.close();
server.close();
fs.rmSync(tmp, { recursive: true, force: true });
