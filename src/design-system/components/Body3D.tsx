import React from 'react';
import { PanResponder, Platform, View, type PointerEvent } from 'react-native';
import { Asset } from 'expo-asset';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { componentTokens, palette } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Body3D — หุ่น 3D ยืน ผิวหนังตามสรีระจริง (BodyParts3D 4.0 ผ่าน human-atlas · CC BY 4.0 · สร้างด้วย scripts/build-anatomy-glb.mjs)
 * - จุดปวด/จุดรักษา = ระบายสีลงบนผิวบริเวณนั้นโดยตรง (เช่น ปวดไหล่ → หัวไหล่เป็นสีแดง) ไม่ใช้หมุดวงกลม
 * - ลากซ้าย/ขวาเพื่อหมุนดูรอบตัว · แตะที่ผิวหุ่น → ได้จุด + ส่วนของร่างกาย (หน้าจอใช้ผูกกับ chip อาการ)
 * - พิกัดต้นฉบับ: เมตร · Y ขึ้น · หน้าไป +z · +x = ซ้ายของผู้ป่วย
 */

const MODEL = require('../../../assets/models/anatomy_male.glb');
/** node ผิวหนัง (ผิว + ริมฝีปาก) */
const SKIN_NODES = ['FJ2810', 'FJ2814'];
/**
 * ระยะจากแกนกลางหุ่นถึงขอบขวาสุด (ปลายมือ) ที่มุมพัก REST_ANGLE เมื่อหุ่นสูง 2 หน่วย — ใช้จัดหุ่นชิดขอบขวาของจอ
 * วัดจากภาพหน้าจอจริง · ถ้าเปลี่ยน REST_ANGLE ต้องวัดใหม่
 */
export const FIGURE_RIGHT_EXTENT = 0.34;

/** จุดอ้างอิงบนโครงกระดูก (เมตร, พิกัดต้นฉบับ) — คำนวณจากกระดูกจริงใน BodyParts3D */
const LANDMARK = {
  headTop: [0, 1.7, -0.02],
  head: [0, 1.62, -0.02],
  neck: [0, 1.49, -0.035],
  chest: [0, 1.31, 0.03],
  belly: [0, 1.07, -0.02],
  pelvis: [0, 0.93, -0.03],
  shoulderL: [0.17, 1.4, -0.02],
  shoulderR: [-0.17, 1.4, -0.02],
  elbowL: [0.21, 1.11, -0.02],
  elbowR: [-0.21, 1.11, -0.02],
  wristL: [0.25, 0.89, 0],
  wristR: [-0.25, 0.89, 0],
  handL: [0.27, 0.74, 0.03],
  handR: [-0.27, 0.74, 0.03],
  hipL: [0.09, 0.89, -0.02],
  hipR: [-0.09, 0.89, -0.02],
  kneeL: [0.08, 0.46, 0],
  kneeR: [-0.08, 0.46, 0],
  ankleL: [0.07, 0.07, -0.02],
  ankleR: [-0.07, 0.07, -0.02],
  toesL: [0.09, 0.01, 0.1],
  toesR: [-0.09, 0.01, 0.1],
} satisfies Record<string, [number, number, number]>;
type Landmark = keyof typeof LANDMARK;

/** ตำแหน่งบนร่างกายที่ปักหมุดได้ */
export type BodyPin =
  | 'head'
  | 'templeLeft'
  | 'occiputLeft'
  | 'noseLeft'
  | 'eyeLeft'
  | 'eyeRight'
  | 'neck'
  | 'neckBack'
  | 'shoulderLeft'
  | 'shoulderRight'
  | 'trapLeft'
  | 'trapRight'
  | 'chest'
  | 'back'
  | 'lowerBack'
  | 'templeRight'
  | 'occiputRight'
  | 'jaw'
  | 'scapulaLeft'
  | 'scapulaRight'
  | 'ribLeft'
  | 'ribRight'
  | 'belly'
  | 'hipLeft'
  | 'hipRight'
  | 'armLeft'
  | 'armRight'
  | 'elbowLeft'
  | 'elbowRight'
  | 'wristLeft'
  | 'wristRight'
  | 'handLeft'
  | 'handRight'
  | 'thighLeft'
  | 'thighRight'
  | 'kneeLeft'
  | 'kneeRight'
  | 'shinLeft'
  | 'shinRight'
  | 'calfLeft'
  | 'calfRight'
  | 'ankleLeft'
  | 'ankleRight'
  | 'heelLeft'
  | 'heelRight'
  | 'footLeft'
  | 'footRight'
  | 'clavicleLeft'
  | 'clavicleRight'
  | 'kneeBackLeft'
  | 'kneeBackRight'
  | 'thighBackLeft'
  | 'thighBackRight';

/**
 * ตำแหน่งบนร่างกาย: จุดศูนย์กลางภายใน (base, เมตร) · ทิศหันออก (dir — ใช้ตัดสินว่าอยู่ด้านหลังไหม)
 * area = รัศมีบริเวณที่ระบายสี (x, y, z เมตร) — ทรงรีตามรูปร่างส่วนนั้น เช่น หลังกว้างและสูง หัวไหล่เป็นโดม
 */
const PIN_ANCHOR: Record<BodyPin, { base: [number, number, number]; dir: [number, number, number]; area: [number, number, number] }> = {
  head: { base: [0, 1.65, 0], dir: [0, 0.35, 1], area: [0.09, 0.07, 0.1] },
  templeLeft: { base: [0.064, 1.62, 0.02], dir: [1, 0, 0.35], area: [0.025, 0.025, 0.025] },
  occiputLeft: { base: [0.03, 1.6, -0.115], dir: [0.4, 0, -1], area: [0.035, 0.035, 0.035] },
  noseLeft: { base: [0.012, 1.58, 0.085], dir: [0.12, 0, 1], area: [0.015, 0.02, 0.02] },
  eyeLeft: { base: [0.03, 1.596, 0.04], dir: [0.3, 0, 1], area: [0.018, 0.014, 0.02] },
  eyeRight: { base: [-0.031, 1.596, 0.04], dir: [-0.3, 0, 1], area: [0.018, 0.014, 0.02] },
  neck: { base: [0, 1.48, 0], dir: [0, 0, 1], area: [0.055, 0.05, 0.06] },
  neckBack: { base: [0, 1.48, -0.04], dir: [0, 0, -1], area: [0.055, 0.05, 0.06] },
  shoulderLeft: { base: [0.18, 1.39, -0.02], dir: [0.3, 1, 0], area: [0.06, 0.07, 0.07] },
  shoulderRight: { base: [-0.18, 1.39, -0.02], dir: [-0.3, 1, 0], area: [0.06, 0.07, 0.07] },
  // บ่า = ช่วงระหว่างคอกับปลายไหล่ (กล้ามเนื้อ trapezius)
  trapLeft: { base: [0.09, 1.43, -0.04], dir: [0.15, 1, -0.2], area: [0.06, 0.045, 0.06] },
  trapRight: { base: [-0.09, 1.43, -0.04], dir: [-0.15, 1, -0.2], area: [0.06, 0.045, 0.06] },
  chest: { base: [0, 1.31, 0.05], dir: [0, 0, 1], area: [0.12, 0.08, 0.08] },
  back: { base: [0, 1.29, -0.06], dir: [0, 0, -1], area: [0.12, 0.12, 0.08] },
  lowerBack: { base: [0, 1.06, -0.04], dir: [0, 0, -1], area: [0.11, 0.08, 0.08] },
  // ทั้งร่างกาย (ซ้าย = +x ของผู้ป่วย · ขวา = สะท้อนจากซ้าย)
  // จุดสัญญาณ: ร่องไหปลาร้า (สัญญาณ 4 หัวไหล่) · ใต้พับเข่า (สัญญาณ 4 ขาด้านใน)
  clavicleLeft: { base: [0.09, 1.41, 0.05], dir: [0.2, 0.4, 1], area: [0.03, 0.025, 0.03] },
  clavicleRight: { base: [-0.09, 1.41, 0.05], dir: [-0.2, 0.4, 1], area: [0.03, 0.025, 0.03] },
  kneeBackLeft: { base: [0.08, 0.45, -0.075], dir: [0, 0, -1], area: [0.045, 0.045, 0.05] },
  kneeBackRight: { base: [-0.08, 0.45, -0.075], dir: [0, 0, -1], area: [0.045, 0.045, 0.05] },
  // ต้นขาด้านหลัง (แนวร้าวจากหลังลงขา)
  thighBackLeft: { base: [0.09, 0.68, -0.06], dir: [0, 0, -1], area: [0.06, 0.12, 0.05] },
  thighBackRight: { base: [-0.09, 0.68, -0.06], dir: [0, 0, -1], area: [0.06, 0.12, 0.05] },
  templeRight: { base: [-0.064, 1.62, 0.02], dir: [-1, 0, 0.35], area: [0.025, 0.025, 0.025] },
  occiputRight: { base: [-0.03, 1.6, -0.115], dir: [-0.4, 0, -1], area: [0.035, 0.035, 0.035] },
  jaw: { base: [0, 1.555, 0.06], dir: [0, -0.3, 1], area: [0.05, 0.025, 0.04] },
  belly: { base: [0, 1.07, 0.07], dir: [0, 0, 1], area: [0.1, 0.08, 0.06] },
  scapulaLeft: { base: [0.085, 1.3, -0.08], dir: [0.2, 0, -1], area: [0.05, 0.065, 0.05] },
  scapulaRight: { base: [-0.085, 1.3, -0.08], dir: [-0.2, 0, -1], area: [0.05, 0.065, 0.05] },
  ribLeft: { base: [0.11, 1.17, 0.03], dir: [0.7, 0, 0.7], area: [0.05, 0.06, 0.07] },
  ribRight: { base: [-0.11, 1.17, 0.03], dir: [-0.7, 0, 0.7], area: [0.05, 0.06, 0.07] },
  hipLeft: { base: [0.1, 0.9, -0.07], dir: [0.3, 0, -1], area: [0.07, 0.07, 0.06] },
  hipRight: { base: [-0.1, 0.9, -0.07], dir: [-0.3, 0, -1], area: [0.07, 0.07, 0.06] },
  armLeft: { base: [0.2, 1.26, -0.02], dir: [1, 0, 0.2], area: [0.045, 0.1, 0.05] },
  armRight: { base: [-0.2, 1.26, -0.02], dir: [-1.0, 0, 0.2], area: [0.045, 0.1, 0.05] },
  elbowLeft: { base: [0.21, 1.11, -0.02], dir: [1, 0, 0], area: [0.04, 0.04, 0.04] },
  elbowRight: { base: [-0.21, 1.11, -0.02], dir: [-1.0, 0, 0], area: [0.04, 0.04, 0.04] },
  wristLeft: { base: [0.25, 0.89, 0], dir: [1, 0, 0], area: [0.035, 0.035, 0.035] },
  wristRight: { base: [-0.25, 0.89, 0], dir: [-1.0, 0, 0], area: [0.035, 0.035, 0.035] },
  handLeft: { base: [0.27, 0.76, 0.03], dir: [1, 0, 0.3], area: [0.04, 0.06, 0.04] },
  handRight: { base: [-0.27, 0.76, 0.03], dir: [-1.0, 0, 0.3], area: [0.04, 0.06, 0.04] },
  thighLeft: { base: [0.09, 0.68, 0.03], dir: [0, 0, 1], area: [0.07, 0.12, 0.06] },
  thighRight: { base: [-0.09, 0.68, 0.03], dir: [0, 0, 1], area: [0.07, 0.12, 0.06] },
  kneeLeft: { base: [0.08, 0.46, 0.03], dir: [0, 0, 1], area: [0.05, 0.05, 0.05] },
  kneeRight: { base: [-0.08, 0.46, 0.03], dir: [0, 0, 1], area: [0.05, 0.05, 0.05] },
  shinLeft: { base: [0.075, 0.28, 0.03], dir: [0, 0, 1], area: [0.04, 0.1, 0.04] },
  shinRight: { base: [-0.075, 0.28, 0.03], dir: [0, 0, 1], area: [0.04, 0.1, 0.04] },
  calfLeft: { base: [0.075, 0.3, -0.04], dir: [0, 0, -1], area: [0.05, 0.1, 0.05] },
  calfRight: { base: [-0.075, 0.3, -0.04], dir: [0, 0, -1], area: [0.05, 0.1, 0.05] },
  ankleLeft: { base: [0.07, 0.08, 0], dir: [1, 0, 0.3], area: [0.04, 0.035, 0.04] },
  ankleRight: { base: [-0.07, 0.08, 0], dir: [-1.0, 0, 0.3], area: [0.04, 0.035, 0.04] },
  heelLeft: { base: [0.07, 0.03, -0.05], dir: [0, -0.3, -1], area: [0.035, 0.035, 0.035] },
  heelRight: { base: [-0.07, 0.03, -0.05], dir: [0, -0.3, -1], area: [0.035, 0.035, 0.035] },
  footLeft: { base: [0.085, 0.03, 0.07], dir: [0, 1, 0.5], area: [0.04, 0.03, 0.06] },
  footRight: { base: [-0.085, 0.03, 0.07], dir: [0, 1, 0.5], area: [0.04, 0.03, 0.06] },
};

/** หมุดที่อยู่ด้านหลังหุ่น (มองไม่เห็นจากด้านหน้า) — ใช้หมุนหุ่นให้หันหลังอัตโนมัติ */
export const isBackPin = (pin: BodyPin) => PIN_ANCHOR[pin].dir[2] < 0 && Math.abs(PIN_ANCHOR[pin].dir[0]) < 0.5;

export interface Body3DPin {
  at: BodyPin;
  tone: 'symptom' | 'point';
  /** สีเฉพาะ (เช่น ตามระดับความปวด) — แทนสีตาม tone */
  color?: string;
}

/** จุดบนหุ่นในพิกัดของหุ่น (หมุนตามหุ่น) */
export interface BodyPoint {
  x: number;
  y: number;
  z: number;
}

/** ส่วนของร่างกายที่แยกได้จากการแตะ — ตัดสินจาก "ท่อน" ระหว่างจุดอ้างอิงที่ใกล้จุดแตะที่สุด */
export interface BodyRegion {
  key: string;
  /** ชื่อไทย เช่น "ไหล่ขวา", "หลังส่วนล่าง" */
  label: string;
}

type Segment = { from: Landmark; to: Landmark; front: BodyRegion; back?: BodyRegion };
const R = (key: string, label: string): BodyRegion => ({ key, label });
/** ท่อนร่างกาย (L = ซ้ายของผู้ป่วย) → ส่วนของร่างกาย · back = ชื่อเมื่อแตะด้านหลัง */
const SEGMENTS: Segment[] = [
  { from: 'head', to: 'headTop', front: R('head', 'ศีรษะ') },
  { from: 'neck', to: 'head', front: R('neck', 'คอ'), back: R('neck', 'คอ') },
  { from: 'neck', to: 'shoulderL', front: R('shoulderL', 'ไหล่ซ้าย') },
  { from: 'neck', to: 'shoulderR', front: R('shoulderR', 'ไหล่ขวา') },
  { from: 'shoulderL', to: 'elbowL', front: R('armL', 'แขนซ้าย') },
  { from: 'shoulderR', to: 'elbowR', front: R('armR', 'แขนขวา') },
  { from: 'elbowL', to: 'wristL', front: R('forearmL', 'แขนซ้าย') },
  { from: 'elbowR', to: 'wristR', front: R('forearmR', 'แขนขวา') },
  { from: 'wristL', to: 'handL', front: R('handL', 'มือซ้าย') },
  { from: 'wristR', to: 'handR', front: R('handR', 'มือขวา') },
  { from: 'chest', to: 'neck', front: R('chest', 'หน้าอก'), back: R('back', 'หลัง') },
  { from: 'belly', to: 'chest', front: R('belly', 'ท้อง'), back: R('back', 'หลัง') },
  { from: 'pelvis', to: 'belly', front: R('belly', 'ท้อง'), back: R('lowerBack', 'เอว') },
  { from: 'hipL', to: 'kneeL', front: R('thighL', 'ต้นขาซ้าย') },
  { from: 'hipR', to: 'kneeR', front: R('thighR', 'ต้นขาขวา') },
  { from: 'kneeL', to: 'ankleL', front: R('shinL', 'ขาซ้าย'), back: R('calfL', 'น่องซ้าย') },
  { from: 'kneeR', to: 'ankleR', front: R('shinR', 'ขาขวา'), back: R('calfR', 'น่องขวา') },
  { from: 'ankleL', to: 'toesL', front: R('footL', 'เท้าซ้าย') },
  { from: 'ankleR', to: 'toesR', front: R('footR', 'เท้าขวา') },
];
/** จุดข้อต่อที่ถือเป็นส่วนเฉพาะ (รัศมีเล็ก, หน่วยเมตร) เช่น เข่า */
const JOINTS: { at: Landmark; radius: number; region: BodyRegion }[] = [
  { at: 'kneeL', radius: 0.06, region: R('kneeL', 'เข่าซ้าย') },
  { at: 'kneeR', radius: 0.06, region: R('kneeR', 'เข่าขวา') },
];

type Picker = (ndcX: number, ndcY: number) => { point: THREE.Vector3; region: BodyRegion | null } | null;
/** ตำแหน่งบนจอ (NDC −1..1) ของจุดบนร่างกาย ตามท่าหุ่นปัจจุบัน */
type Projector = (pin: BodyPin) => { x: number; y: number } | null;
/** มุมหมุน (rad) ที่ทำให้บริเวณนั้นหันเข้ากล้อง — null ถ้ายังไม่โหลด/บริเวณหันขึ้นบนล้วน */
type Facer = (pin: BodyPin) => number | null;

/** จำนวนบริเวณที่ระบายสีพร้อมกันได้สูงสุด */
const MAX_SPOTS = 24;
/** รัศมีบริเวณที่ระบายสีเมื่อแตะบนหุ่นเอง (เมตร) */
const TAP_AREA: [number, number, number] = [0.045, 0.045, 0.045];

type Spot = { center: THREE.Vector3; radius: THREE.Vector3; color: THREE.Color };

/**
 * วัสดุผิวที่ระบายสีเป็นบริเวณได้: ผสมสีเข้ากับผิวแบบไล่จางจากกลางบริเวณออกไป (ทรงรี)
 * พิกัดที่ใช้ = พิกัดต้นฉบับของโมเดล (เมตร) จึงติดไปกับหุ่นเวลาหมุน
 */
function createSkinMaterial(color: string, shorts: string) {
  const uniforms = {
    uSpotCount: { value: 0 },
    uSpotCenter: { value: Array.from({ length: MAX_SPOTS }, () => new THREE.Vector3()) },
    uSpotRadius: { value: Array.from({ length: MAX_SPOTS }, () => new THREE.Vector3(1, 1, 1)) },
    uSpotColor: { value: Array.from({ length: MAX_SPOTS }, () => new THREE.Color()) },
  };
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0 });
  mat.defines = { SHORTS_COLOR: `vec3(${new THREE.Color(shorts).toArray().map((v) => v.toFixed(4)).join(', ')})` };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    // บริเวณเป้าที่สคริปต์กดให้แบน (ค่าตรงกับ GROIN ใน scripts/build-anatomy-glb.mjs) → แรเงาตามผิวเรียบ
    // ผิวเดิมที่ถูกกดซ้อนกันจึงดูเป็นผิวเดียว ไม่เห็นรอยรูปทรงเดิม
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSpotPos;\nvarying vec3 vGroinN;\nvarying float vGroinW;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vSpotPos = position;
{
  float ty = clamp((position.y - 0.745) / 0.17, 0.0, 1.0);
  float s = ty * ty * (3.0 - 2.0 * ty);
  float ds = 6.0 * ty * (1.0 - ty) / 0.17;
  float slope = s > 0.0001 ? 0.084 * 0.5 / sqrt(s) * ds : 0.0;
  vGroinN = normalize(normalMatrix * vec3(0.0, -min(slope, 3.0), 1.0));
  float inY = step(0.73, position.y) * (1.0 - smoothstep(0.9, 0.925, position.y)) * step(0.0, position.z);
  vGroinW = inY * (1.0 - smoothstep(0.045, 0.075, abs(position.x)));
}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vSpotPos;
varying vec3 vGroinN;
varying float vGroinW;
uniform int uSpotCount;
float gShorts;
uniform vec3 uSpotCenter[${MAX_SPOTS}];
uniform vec3 uSpotRadius[${MAX_SPOTS}];
uniform vec3 uSpotColor[${MAX_SPOTS}];
`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.95, gShorts);')
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(mix(normal, vGroinN, vGroinW));')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
// กางเกงขาสั้น: ระบายลงบนผิวโดยตรง (แนบสรีระพอดี ไม่ลอย) — เอว y≈0.965 · ปลายขา y≈0.70 (ด้านในขาสั้นกว่าเล็กน้อย)
float sInX = 1.0 - smoothstep(0.19, 0.205, abs(vSpotPos.x));
float hem = 0.705 + 0.025 * (1.0 - smoothstep(0.03, 0.09, abs(vSpotPos.x)));
float sIn = sInX * smoothstep(hem - 0.004, hem + 0.004, vSpotPos.y) * (1.0 - smoothstep(0.962, 0.97, vSpotPos.y));
gShorts = sIn;
vec3 fabric = SHORTS_COLOR;
// ขอบเอว + ขอบปลายขาเข้มขึ้นเล็กน้อย
float band = smoothstep(0.932, 0.936, vSpotPos.y) + (1.0 - smoothstep(hem + 0.014, hem + 0.018, vSpotPos.y));
fabric *= 1.0 - 0.18 * clamp(band, 0.0, 1.0);
diffuseColor.rgb = mix(diffuseColor.rgb, fabric, sIn);
for (int i = 0; i < ${MAX_SPOTS}; i++) {
  if (i >= uSpotCount) break;
  float d = length((vSpotPos - uSpotCenter[i]) / uSpotRadius[i]);
  float w = 1.0 - smoothstep(0.55, 1.0, d);
  diffuseColor.rgb = mix(diffuseColor.rgb, uSpotColor[i], w * 0.88);
}
`,
      );
  };
  // ให้ three สร้าง shader แยกจากวัสดุมาตรฐาน (ไม่ใช้ cache ร่วม)
  mat.customProgramCacheKey = () => 'skin-spots';
  const setSpots = (spots: Spot[]) => {
    const list = spots.slice(0, MAX_SPOTS);
    uniforms.uSpotCount.value = list.length;
    list.forEach((sp, i) => {
      uniforms.uSpotCenter.value[i].copy(sp.center);
      uniforms.uSpotRadius.value[i].copy(sp.radius);
      uniforms.uSpotColor.value[i].copy(sp.color);
    });
  };
  return { mat, setSpots };
}

function Figure({
  url,
  pins,
  marks,
  rotationY,
  pickerRef,
  projectorRef,
  facerRef,
  onReady,
}: {
  url: string;
  pins: Body3DPin[];
  marks: BodyPoint[];
  rotationY: number;
  pickerRef: React.MutableRefObject<Picker | null>;
  projectorRef: React.MutableRefObject<Projector | null>;
  facerRef: React.MutableRefObject<Facer | null>;
  /** วาดเฟรมแรกเสร็จแล้ว (ใช้สลับ canvas บน iOS แบบไม่กะพริบ) */
  onReady?: () => void;
}) {
  const { colors } = useTheme();
  const loaded = useLoader(GLTFLoader, url);
  /* โมเดลจาก useLoader ถูก cache และใช้ร่วมกันทุก canvas — วัตถุ three มีแม่ได้คนเดียว
   * ถ้าใช้ตัวเดียวกันตอนสร้าง canvas ใหม่ (iOS) canvas เก่าที่ถูกถอดจะดึงหุ่นออกไปด้วย → หุ่นหาย
   * จึง clone ฉากต่อ canvas (geometry ใช้ร่วมกัน ไม่เปลืองหน่วยความจำ) */
  const gltf = React.useMemo(() => ({ scene: loaded.scene.clone(true) }), [loaded]);
  const { camera, invalidate } = useThree();
  const groupRef = React.useRef<THREE.Group>(null);
  const visibleCenterRef = React.useRef<((pin: BodyPin) => { ndc: THREE.Vector2; surface: THREE.Vector3 | null } | null) | null>(null);

  const skin = React.useMemo(() => createSkinMaterial(palette.skin.model, palette.garment.base), []);
  React.useEffect(() => () => skin.mat.dispose(), [skin]);

  // ผิว = พื้นผิวที่แตะ/วัดขนาดได้
  const skinMeshes = React.useMemo(() => {
    const list: THREE.Mesh[] = [];
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (SKIN_NODES.includes(m.name)) {
        m.material = skin.mat;
        list.push(m);
      } else m.visible = false;
    });
    return list;
  }, [gltf, skin]);

  const { root, toLocal } = React.useMemo(() => {
    const scene = gltf.scene;
    scene.position.set(0, 0, 0);
    scene.scale.setScalar(1);
    scene.updateMatrixWorld(true);
    // จัดหุ่นให้อยู่กลางและสูง 2 หน่วย (วัดในพิกัดของหุ่นเอง)
    const box = new THREE.Box3();
    skinMeshes.forEach((m) => box.expandByObject(m, true));
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    // แกนหมุนแนวตั้งผ่านเชิงกราน = กลางลำตัวจริง → หมุนอยู่กับที่ ไม่เหวี่ยงออกนอกกรอบ
    center.x = LANDMARK.pelvis[0];
    center.z = LANDMARK.pelvis[2];
    const k = 2 / Math.max(size.y, 0.001);
    scene.scale.setScalar(k);
    scene.position.set(-center.x * k, -center.y * k, -center.z * k);
    scene.updateMatrixWorld(true);
    /** พิกัดต้นฉบับ (เมตร) → พิกัดของหุ่น (กลุ่มที่หมุน) */
    const local = (v: readonly number[]) => new THREE.Vector3(v[0], v[1], v[2]).multiplyScalar(k).add(scene.position);
    return { root: scene, toLocal: local };
  }, [gltf, skinMeshes]);

  // อาการ/จุดรักษา + จุดที่แตะเอง → บริเวณระบายสีบนผิว
  React.useEffect(() => {
    const symptom = new THREE.Color(colors.status.danger.solid);
    const point = new THREE.Color(colors.brand.primary);
    const k = root.scale.x;
    const spots: Spot[] = [
      ...pins.map((p) => ({
        center: new THREE.Vector3(...PIN_ANCHOR[p.at].base),
        radius: new THREE.Vector3(...PIN_ANCHOR[p.at].area),
        color: p.color ? new THREE.Color(p.color) : p.tone === 'symptom' ? symptom : point,
      })),
      // จุดที่แตะ: พิกัดของหุ่น → พิกัดต้นฉบับ (เมตร)
      ...marks.map((m) => ({
        center: new THREE.Vector3(m.x, m.y, m.z).sub(root.position).divideScalar(k),
        radius: new THREE.Vector3(...TAP_AREA),
        color: symptom,
      })),
    ];
    skin.setSpots(spots);
    invalidate();
  }, [pins, marks, root, skin, colors, invalidate]);


  // ยิงรังสีจากตำแหน่งที่แตะไปหาผิวหุ่นจริง → จุดในพิกัดของหุ่น + ส่วนของร่างกายที่ใกล้ที่สุด
  React.useEffect(() => {
    const raycaster = new THREE.Raycaster();
    const classify = (p: THREE.Vector3): BodyRegion | null => {
      const k = root.scale.x;
      for (const j of JOINTS) if (toLocal(LANDMARK[j.at]).distanceTo(p) < j.radius * k) return j.region;
      let best: { d: number; seg: Segment; center: THREE.Vector3 } | null = null;
      for (const seg of SEGMENTS) {
        const line = new THREE.Line3(toLocal(LANDMARK[seg.from]), toLocal(LANDMARK[seg.to]));
        const closest = line.closestPointToPoint(p, true, new THREE.Vector3());
        const d = closest.distanceTo(p);
        if (!best || d < best.d) best = { d, seg, center: closest };
      }
      if (!best) return null;
      // ด้านหน้า/หลัง: หุ่นหันหน้าไปทาง +z ในพิกัดของหุ่น
      return p.z < best.center.z && best.seg.back ? best.seg.back : best.seg.front;
    };
    /**
     * กึ่งกลางของสีที่ "มองเห็น" จริง: ยิงรังสีจากกล้องเป็นตารางรอบจุดกลาง เก็บเฉพาะจุดที่โดนผิวและอยู่ในทรงรีของสี
     * → ndc = ตำแหน่งบนจอเฉลี่ย · surface = จุดบนผิวตรงกลางนั้น (พิกัดต้นฉบับ เมตร)
     */
    /** จุดตัวอย่างบนผิวในทรงรีของสีของแต่ละบริเวณ: ตำแหน่ง · ทิศผิว · น้ำหนัก (ความเข้มสีแบบ shader × พื้นที่) */
    const sampleCache = new Map<BodyPin, { p: THREE.Vector3; n: THREE.Vector3; w: number }[]>();
    const samplesFor = (pin: BodyPin) => {
      const hit = sampleCache.get(pin);
      if (hit) return hit;
      const a = PIN_ANCHOR[pin];
      const reach = Math.max(...a.area);
      const out: { p: THREE.Vector3; n: THREE.Vector3; w: number }[] = [];
      const A = new THREE.Vector3();
      const B = new THREE.Vector3();
      const C = new THREE.Vector3();
      const ctr = new THREE.Vector3();
      const tri = new THREE.Triangle();
      const STEPS = 6;
      for (const m of skinMeshes) {
        const P = m.geometry.attributes.position;
        const idx = m.geometry.index;
        const count = idx ? idx.count : P.count;
        for (let f = 0; f < count; f += 3) {
          A.fromBufferAttribute(P, idx ? idx.getX(f) : f);
          B.fromBufferAttribute(P, idx ? idx.getX(f + 1) : f + 1);
          C.fromBufferAttribute(P, idx ? idx.getX(f + 2) : f + 2);
          ctr.copy(A).add(B).add(C).divideScalar(3);
          const r = Math.max(ctr.distanceTo(A), ctr.distanceTo(B), ctr.distanceTo(C));
          if (Math.hypot(ctr.x - a.base[0], ctr.y - a.base[1], ctr.z - a.base[2]) - r > reach) continue;
          tri.set(A, B, C);
          const n = tri.getNormal(new THREE.Vector3());
          const cell = tri.getArea() / ((STEPS * (STEPS + 1)) / 2);
          for (let u = 0; u < STEPS; u++)
            for (let v = 0; v < STEPS - u; v++) {
              const bu = (u + 1 / 3) / STEPS;
              const bv = (v + 1 / 3) / STEPS;
              const p = A.clone().multiplyScalar(1 - bu - bv).addScaledVector(B, bu).addScaledVector(C, bv);
              const d = Math.hypot((p.x - a.base[0]) / a.area[0], (p.y - a.base[1]) / a.area[1], (p.z - a.base[2]) / a.area[2]);
              if (d >= 1) continue;
              const t = Math.min(1, Math.max(0, (d - 0.55) / 0.45));
              out.push({ p, n, w: (1 - t * t * (3 - 2 * t)) * cell });
            }
        }
      }
      sampleCache.set(pin, out);
      return out;
    };
    const cache = new Map<string, { ndc: THREE.Vector2; surface: THREE.Vector3 | null }>();
    const visibleCenter = (pin: BodyPin) => {
      const group = groupRef.current;
      if (!group) return null;
      group.updateMatrixWorld(true);
      const key = `${pin}|${group.rotation.y.toFixed(3)}`;
      const hitCache = cache.get(key);
      if (hitCache) return hitCache;
      const a = PIN_ANCHOR[pin];
      const k = root.scale.x;
      const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
      const toModel = (w: THREE.Vector3) => w.clone().applyMatrix4(inv).sub(root.position).divideScalar(k);
      /* กึ่งกลางของสีที่ "มองเห็น" บนจอ: จุดตัวอย่างบนผิวสามเหลี่ยมในทรงรีของสี (mesh บางส่วนหยาบ — ขมับมีจุดยอดไม่กี่จุด)
       * → ฉายลงจอแล้วเฉลี่ย ถ่วงด้วยความเข้มสี × พื้นที่ × มุมที่หันเข้ากล้อง
       * จุดตัวอย่างคำนวณครั้งเดียวต่อบริเวณ (ไม่ขึ้นกับมุมหมุน) — ทุกมุมแค่ฉายลงจอ (มือถือวนทั้ง mesh ทุกเฟรมไม่ไหว) */
      const samples = samplesFor(pin);
      const camLocal = toModel(camera.getWorldPosition(new THREE.Vector3()));
      let sx = 0;
      let sy = 0;
      let wsum = 0;
      const view = new THREE.Vector3();
      for (const sm of samples) {
        const facing = sm.n.dot(view.copy(camLocal).sub(sm.p).normalize());
        if (facing <= 0) continue; // หันหนีกล้อง
        const w = sm.w * facing;
        const sc = group.localToWorld(toLocal([sm.p.x, sm.p.y, sm.p.z])).project(camera);
        sx += sc.x * w;
        sy += sc.y * w;
        wsum += w;
      }
      const fallback = wsum > 0 ? null : group.localToWorld(toLocal(a.base)).project(camera);
      const ndc = fallback ? new THREE.Vector2(fallback.x, fallback.y) : new THREE.Vector2(sx / wsum, sy / wsum);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(skinMeshes, false)[0];
      const out = { ndc, surface: hit ? toModel(hit.point) : null };
      cache.set(key, out);
      return out;
    };
    visibleCenterRef.current = visibleCenter;
    const projector: Projector = (pin) => {
      const group = groupRef.current;
      if (!group) return null;
      group.updateMatrixWorld(true);
      const c = visibleCenter(pin);
      return c ? { x: c.ndc.x, y: c.ndc.y } : null;
    };
    projectorRef.current = projector;
    /* ทิศที่บริเวณนั้นหันออก (dir ของหมุด) → มุมหมุนแกน y ที่พาทิศนั้นมาหากล้อง (หุ่นหันหน้า +z)
     * บริเวณที่หันขึ้นบนเป็นหลัก (บ่า/ไหล่) → null = ไม่ต้องหมุน */
    const facer: Facer = (pin) => {
      const [x, y, z] = PIN_ANCHOR[pin].dir;
      const h = Math.hypot(x, z);
      return h / Math.hypot(x, y, z) < 0.4 ? null : -Math.atan2(x, z);
    };
    facerRef.current = facer;
    const picker: Picker = (ndcX, ndcY) => {
      const group = groupRef.current;
      if (!group) return null;
      group.updateMatrixWorld(true);
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const hit = raycaster.intersectObjects(skinMeshes, false)[0];
      if (!hit) return null;
      const point = group.worldToLocal(hit.point.clone());
      return { point, region: classify(point) };
    };
    pickerRef.current = picker;
    return () => {
      // iOS มี canvas ซ้อนกันช่วงสลับ → ล้างเฉพาะของตัวเอง (ไม่ลบของ canvas ใหม่)
      if (pickerRef.current === picker) pickerRef.current = null;
      if (projectorRef.current === projector) projectorRef.current = null;
      if (facerRef.current === facer) facerRef.current = null;
      visibleCenterRef.current = null;
    };
  }, [camera, root, toLocal, skinMeshes, pickerRef, projectorRef, facerRef]);

  // มุมเป้าหมายเปลี่ยน (ลาก/หันหน้า-หลัง) → เริ่มวาดเฟรมใหม่
  React.useEffect(() => invalidate(), [rotationY, invalidate]);
  const readyRef = React.useRef(false);
  useFrame(() => {
    if (readyRef.current) return;
    readyRef.current = true;
    // รอให้เฟรมแรกขึ้นจอก่อน แล้วค่อยแจ้ง
    setTimeout(() => onReady?.(), 80);
  });
  // มุมตอนสร้าง canvas (ค่าคงที่ — r3f ตั้งให้ครั้งเดียว) · iOS สร้าง canvas ใหม่ทุกครั้งที่ท่าเปลี่ยน จึงต้องเริ่มที่มุมล่าสุดเลย
  const initialRotation = React.useRef(rotationY).current;
  // วาดเฉพาะเมื่อจำเป็น (frameloop="demand") → ขอเฟรมต่อจนกว่าจะหมุนถึงมุมเป้าหมาย
  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const d = rotationY - g.rotation.y;
    if (Math.abs(d) < 0.001) {
      g.rotation.y = rotationY;
      return;
    }
    g.rotation.y += d * 0.2;
    invalidate();
  });

  return (
    <group ref={groupRef} rotation={[0, initialRotation, 0]}>
      <primitive object={root} />
    </group>
  );
}

export interface Body3DPick {
  point: BodyPoint;
  region: BodyRegion | null;
}

export interface Body3DHandle {
  /** แตะที่ตำแหน่งบนจอ (pageX/pageY) → จุดบนผิวหุ่น + ส่วนของร่างกาย (null ถ้าไม่โดนหุ่น) */
  pickAt: (pageX: number, pageY: number) => Body3DPick | null;
  /** ตำแหน่งบนจอ (pageX/pageY) ของบริเวณบนร่างกาย ตามท่าหุ่นตอนนี้ — null ถ้าหุ่นยังไม่โหลด */
  projectPin: (pin: BodyPin) => { x: number; y: number } | null;
  /** วัดตำแหน่งบนจอใหม่ (เรียกหลังขยับ/ย่อหุ่นด้วย transform — onLayout ไม่รู้ตัว) */
  remeasure: () => void;
  /** หมุนหุ่นเพิ่ม (เรเดียน) นับจากมุมตอนเริ่มลาก */
  beginRotate: () => void;
  rotateTo: (deltaRad: number) => void;
  /** หันหุ่น: front = หน้าตรง · back = หันหลัง (หมุนทางที่ใกล้ที่สุด) */
  face: (side: 'front' | 'back') => void;
  /** หันหุ่นให้เห็นบริเวณนั้นชัด (หมุนทางที่ใกล้ที่สุด) — คืน false ถ้าหุ่นยังไม่โหลด */
  facePin: (pin: BodyPin) => boolean;
}

/** พารามิเตอร์ pixelStorei เฉพาะ WebGL ที่ expo-gl ไม่รองรับ (UNPACK_FLIP_Y / PREMULTIPLY_ALPHA / COLORSPACE_CONVERSION) */
const WEBGL_ONLY_PIXEL_PARAMS = new Set([0x9240, 0x9241, 0x9243]);
/**
 * native: three เรียก pixelStorei ด้วยค่าข้างบนตอนอัปโหลด texture
 * → expo-gl พิมพ์ log เตือนทุกเฟรม (หลายหมื่นบรรทัด) จนแอปหน่วง/ค้าง · ข้ามไปเลยเพราะไม่มีผลบน native อยู่แล้ว
 */
function muteWebGLOnlyParams(gl: THREE.WebGLRenderer) {
  const ctx = gl.getContext();
  const pixelStorei = ctx.pixelStorei.bind(ctx);
  ctx.pixelStorei = (pname: number, param: number | boolean) => {
    if (!WEBGL_ONLY_PIXEL_PARAMS.has(pname)) pixelStorei(pname, param as number);
  };
}


/** แสงสะท้อนรอบตัวแบบห้อง (เหมือน human-atlas) — เฉพาะเว็บ เพราะ expo-gl ยังไม่รองรับ render target แบบ float ที่ PMREM ใช้ */
function RoomEnv() {
  const { gl, scene, invalidate } = useThree();
  React.useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    gl.toneMappingExposure = 0.95;
    invalidate();
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

/** มุมพักของหุ่น: เอียงตัวราว 17° หน้าหันไปทางฝั่งข้อความ (ซ้ายของจอ) ให้ดูมีมิติ ไม่แบนตรง */
export const REST_ANGLE = -0.3;

export const Body3D = React.forwardRef<
  Body3DHandle,
  {
    /** ตอนนี้มีเฉพาะหุ่นชาย (BodyParts3D) — คงไว้เพื่อรองรับหุ่นหญิงในอนาคต */
    gender?: 'male' | 'female';
    pins?: Body3DPin[];
    /** จุดอาการที่ปักจากการแตะ (พิกัดของหุ่น) — หน้าจอเป็นผู้ถือข้อมูล */
    marks?: BodyPoint[];
    width?: number;
    height?: number;
    /** ระยะกล้อง — ค่าน้อย = หุ่นใหญ่ขึ้น */
    cameraZ?: number;
    /** true = รับแตะ/ลากเอง · false = ให้หน้าจอส่งต่อผ่าน ref (เมื่อหุ่นอยู่ชั้นหลังเนื้อหาที่เลื่อนได้) */
    interactive?: boolean;
    /** มุมพักของหุ่น (เรเดียน) — ค่าเริ่มต้นเอียงตัวเล็กน้อย · 0 = หันหน้าตรง */
    restAngle?: number;
    /** เมื่อ interactive: แตะโดนหุ่น */
    onPick?: (pick: Body3DPick) => void;
  }
>(function Body3D(
  {
    pins = [],
    marks = [],
    width = componentTokens.body3d.width,
    height = componentTokens.body3d.height,
    cameraZ = componentTokens.body3d.cameraZ,
    interactive = true,
    restAngle = REST_ANGLE,
    onPick,
  },
  ref,
) {
  const t = componentTokens.body3d;
  const [rotationY, setRotationY] = React.useState(restAngle);
  // มุมพักเปลี่ยน (เช่น หน้าเริ่มต้นหันตรง → หลังเริ่มประเมินเอียงตัว) → หมุนไปมุมใหม่แบบนุ่ม (ทางที่ใกล้ที่สุด)
  const restRef = React.useRef(restAngle);
  React.useEffect(() => {
    if (restRef.current === restAngle) return;
    restRef.current = restAngle;
    // หันหน้าตรงไปที่มุมพักใหม่ (เลือกรอบที่ใกล้มุมปัจจุบันที่สุด ไม่หมุนเกินครึ่งรอบ)
    setRotationY((cur) => restAngle + Math.round((cur - restAngle) / (2 * Math.PI)) * 2 * Math.PI);
  }, [restAngle]);
  const startRot = React.useRef(0);
  const rotRef = React.useRef(0);
  rotRef.current = rotationY;
  const pickerRef = React.useRef<Picker | null>(null);
  const projectorRef = React.useRef<Projector | null>(null);
  const facerRef = React.useRef<Facer | null>(null);
  const boxRef = React.useRef<View>(null);
  const layoutRef = React.useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const measure = () =>
    boxRef.current?.measureInWindow((x, y, w, h) => {
      layoutRef.current = { x, y, width: w, height: h };
    });

  const pickAt = React.useCallback((pageX: number, pageY: number): Body3DPick | null => {
    const node = boxRef.current as unknown as { getBoundingClientRect?: () => DOMRect } | null;
    // เว็บอ่านตำแหน่งจาก DOM ทันที · native ใช้ตำแหน่งที่วัดไว้
    const rect = node?.getBoundingClientRect?.() ?? layoutRef.current;
    if (!rect || !pickerRef.current) return null;
    const x = pageX - rect.x;
    const y = pageY - rect.y;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
    const res = pickerRef.current((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);
    return res ? { point: { x: res.point.x, y: res.point.y, z: res.point.z }, region: res.region } : null;
  }, []);

  React.useImperativeHandle(
    ref,
    () => ({
      pickAt,
      projectPin: (pin) => {
        const node = boxRef.current as unknown as { getBoundingClientRect?: () => DOMRect } | null;
        const rect = node?.getBoundingClientRect?.() ?? layoutRef.current;
        const v = projectorRef.current?.(pin);
        if (!rect || !v) return null;
        return { x: rect.x + ((v.x + 1) / 2) * rect.width, y: rect.y + ((1 - v.y) / 2) * rect.height };
      },
      beginRotate: () => (startRot.current = rotRef.current),
      remeasure: () => measure(),
      rotateTo: (d) => setRotationY(startRot.current + d),
      face: (side) =>
        setRotationY((cur) => {
          const target = side === 'back' ? Math.PI - restRef.current : restRef.current;
          const turns = Math.round((cur - target) / (2 * Math.PI));
          return target + turns * 2 * Math.PI;
        }),
      facePin: (pin) => {
        const f = facerRef.current;
        if (!f) return false;
        const a = f(pin);
        // หันเกือบเต็ม (85%) ให้ยังเห็นทรงหุ่นเป็นสามมิติ · ไม่มีทิศชัด → กลับมุมพัก
        const target = a === null ? restRef.current : a * 0.85;
        setRotationY((cur) => target + Math.round((cur - target) / (2 * Math.PI)) * 2 * Math.PI);
        return true;
      },
    }),
    [pickAt],
  );

  // เว็บใช้ URL ของ asset ได้ทันที · native ต้องดาวน์โหลด asset ลงเครื่องก่อนแล้วใช้ localUri (GLTFLoader ต้องการ string)
  const [url, setUrl] = React.useState<string | null>(() => (Platform.OS === 'web' ? Asset.fromModule(MODEL).uri : null));
  React.useEffect(() => {
    if (url) return;
    let alive = true;
    Asset.fromModule(MODEL)
      .downloadAsync()
      .then((a) => alive && setUrl(a.localUri ?? a.uri));
    return () => {
      alive = false;
    };
  }, [url]);


  // ------- โหมดรับแตะ/ลากเอง (interactive) -------
  const moved = React.useRef(false);
  const tap = (x: number, y: number) => {
    const res = pickAt(x, y);
    if (res) onPick?.(res);
  };
  const pan = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderGrant: () => {
          moved.current = false;
          startRot.current = rotRef.current;
        },
        onPanResponderMove: (_, g) => {
          if (Math.abs(g.dx) > 6) moved.current = true;
          setRotationY(startRot.current + g.dx / 80);
        },
        onPanResponderRelease: (e) => {
          if (!moved.current) tap(e.nativeEvent.pageX, e.nativeEvent.pageY);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pickAt, onPick],
  );
  const dragX = React.useRef<number | null>(null);
  const webDrag = {
    onPointerDown: (e: PointerEvent) => {
      dragX.current = e.nativeEvent.clientX;
      moved.current = false;
      startRot.current = rotRef.current;
      (e.currentTarget as unknown as Element | null)?.setPointerCapture?.(e.nativeEvent.pointerId);
    },
    onPointerMove: (e: PointerEvent) => {
      if (dragX.current === null) return;
      const dx = e.nativeEvent.clientX - dragX.current;
      if (Math.abs(dx) > 6) moved.current = true;
      setRotationY(startRot.current + dx / 80);
    },
    onPointerUp: (e: PointerEvent) => {
      if (dragX.current !== null && !moved.current) tap(e.nativeEvent.clientX, e.nativeEvent.clientY);
      dragX.current = null;
    },
    onPointerCancel: () => (dragX.current = null),
  };

  return (
    <View ref={boxRef} onLayout={measure} style={{ width, height }} accessibilityLabel="หุ่นร่างกาย 3 มิติ แตะเพื่อระบุตำแหน่งอาการ ลากซ้ายขวาเพื่อหมุน">
      <Canvas
        // เว็บ: วัดขนาดจาก offsetWidth (ไม่รวม transform) — หุ่นถูกย่อด้วย transform จากภายนอก ถ้าวัดแบบรวม transform canvas จะเล็กซ้อนสองชั้น
        resize={{ offsetSize: true }}
        frameloop="demand"
        camera={{ position: [0, 0, cameraZ], fov: t.fov }}
        style={{ width, height, position: 'absolute', left: 0, top: 0 }}
        gl={{ alpha: true, antialias: true }}
        onCreated={({ gl }) => {
          if (Platform.OS !== 'web') muteWebGLOnlyParams(gl);
        }}
      >
        {/* แสงแบบ human-atlas: ฟ้า/พื้น + ไฟหลักอุ่น + ไฟเสริมเย็น */}
        {/* มือถือไม่มี env map → เพิ่มแสงฟ้า/พื้นชดเชย ให้สีใกล้เคียงเว็บ */}
        <hemisphereLight args={[0xffffff, 0xa7acb2, Platform.OS === 'web' ? 1.05 : 2.2]} />
        <directionalLight position={[2, 3, 4]} intensity={2.3} color={0xfffaf4} />
        <directionalLight position={[-3, 1, -2]} intensity={1.8} color={0xe9f0ff} />
        {Platform.OS === 'web' ? <RoomEnv /> : null}
        {/* Suspense ต้องอยู่ใน Canvas เพราะ useLoader suspend ภายใน renderer ของ three */}
        <React.Suspense fallback={null}>
          {url ? <Figure url={url} pins={pins} marks={marks} rotationY={rotationY} pickerRef={pickerRef} projectorRef={projectorRef} facerRef={facerRef} /> : null}
        </React.Suspense>
      </Canvas>
      {interactive ? (
        // ชั้นรับแตะ/ลากวางทับ canvas — canvas กิน pointer event เอง
        <View
          {...(Platform.OS === 'web' ? webDrag : pan.panHandlers)}
          style={[{ position: 'absolute', top: 0, left: 0, width, height }, Platform.OS === 'web' ? ({ touchAction: 'pan-y', cursor: 'crosshair' } as object) : null]}
        />
      ) : null}
    </View>
  );
});
