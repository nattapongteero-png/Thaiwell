import React from 'react';
import { Animated, PanResponder, PixelRatio, Platform, View, type PointerEvent } from 'react-native';
import { BodySilhouette, useDelayedLoading } from './Skeleton';
import { Asset } from 'expo-asset';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';

/* ผิวหุ่นมี 90,000 สามเหลี่ยม → ยิงรังสีแบบไล่ทุกสามเหลี่ยมช้ามากบน iOS (Hermes) จนแอปค้าง
 * ใช้ BVH (three-mesh-bvh, JS ล้วน) สร้างดัชนีครั้งเดียวตอนโหลดโมเดล → ยิงรังสี/แตะ/หาตำแหน่งจุด เร็วขึ้นหลายสิบเท่า */
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;
import { componentTokens, palette } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Body3D — หุ่น 3D ยืน ผิวหนังตามสรีระจริง (body_male.glb + normal/AO map ที่ bake ไว้ · จาก ThaiWellAI)
 * - จุดปวด/จุดรักษา = ระบายสีลงบนผิวบริเวณนั้นโดยตรง (เช่น ปวดไหล่ → หัวไหล่เป็นสีแดง) ไม่ใช้หมุดวงกลม
 * - ลากซ้าย/ขวาเพื่อหมุนดูรอบตัว · แตะที่ผิวหุ่น → ได้จุด + ส่วนของร่างกาย (หน้าจอใช้ผูกกับ chip อาการ)
 * - พิกัดของหุ่น (MODEL SPACE): เมตร · Y ขึ้น · เท้าที่ y=0 · กลางตัว x=0 · หน้าไป +z · +x = ซ้ายของผู้ป่วย
 *   (ไฟล์ต้นฉบับวางหุ่นไว้ที่ x≈-2.26 → bake ตำแหน่ง node ลง geometry แล้วจัดกลางใหม่ใน bakeModel)
 */

const MODEL = require('../../../assets/models/body_male.glb');
/** แผนที่รายละเอียดผิว (กล้ามเนื้อ/รอยพับ + เงาตามซอก) — ใช้ UV ของ glb */
const NORMAL_MAP = require('../../../assets/models/body_male_normal.jpg');
const AO_MAP = require('../../../assets/models/body_male_ao.jpg');
/**
 * ระยะจากแกนกลางหุ่นถึงขอบขวาสุด (ปลายมือซ้ายของผู้ป่วย) ที่มุมพัก REST_ANGLE ในหน่วยของฉาก (ระนาบ z=0 · รวม perspective)
 * คำนวณจากจุดยอดของโมเดลที่สเกล fitScale · ถ้าเปลี่ยน REST_ANGLE / โมเดล / FIT_HALF_WIDTH ต้องคำนวณใหม่
 */
export const FIGURE_RIGHT_EXTENT = 0.497;
/**
 * หุ่นนี้กางแขน (A-pose) กว้างกว่าเดิม → ถ้าสูง 2 หน่วย มือจะล้นกรอบ canvas (สัดส่วน 232×583)
 * จึงย่อให้ปลายมือ ณ ทุกมุมหมุนไม่เกินครึ่งความกว้าง canvas นี้ (หน่วยของฉาก) แต่ไม่สูงเกิน 2 หน่วย
 */
// canvas สัดส่วน 0.53 (HomeScreen BODY_ASPECT) → ครึ่งความกว้างที่ z=0 ≈ 0.58 หน่วย · เผื่อขอบเล็กน้อย
const FIT_HALF_WIDTH = 0.56;

/**
 * จุดอ้างอิงบนโครงร่าง (เมตร, พิกัดของหุ่น) — วัดจากภาคตัดขวางของ mesh จริง (กึ่งกลางแขน/ขาในแต่ละระดับ)
 * ใช้แยกส่วนของร่างกายจากจุดแตะ (ท่อนที่ใกล้ที่สุด) → ระดับ y ของจุดเชื่อม = เส้นแบ่งส่วน:
 * head = ระดับคาง (ใบหน้าเป็น "ศีรษะ") · neck = โคนคอ · chest = ใต้แนวกล้ามอก · shoulder = ปลายหัวไหล่ (ตัวหุ่นกางแขน)
 */
const LANDMARK = {
  headTop: [0, 1.69, 0.04],
  head: [0, 1.485, 0.04],
  neck: [0, 1.42, 0],
  chest: [0, 1.16, 0.02],
  belly: [0, 1.06, 0.03],
  pelvis: [0, 0.92, 0.02],
  shoulderL: [0.235, 1.34, -0.01],
  shoulderR: [-0.235, 1.34, -0.01],
  elbowL: [0.3, 1.08, 0],
  elbowR: [-0.3, 1.08, 0],
  wristL: [0.375, 0.88, 0.067],
  wristR: [-0.375, 0.88, 0.067],
  handL: [0.42, 0.77, 0.11],
  handR: [-0.42, 0.77, 0.11],
  hipL: [0.09, 0.87, 0.02],
  hipR: [-0.09, 0.87, 0.02],
  kneeL: [0.13, 0.47, -0.01],
  kneeR: [-0.13, 0.47, -0.01],
  ankleL: [0.17, 0.09, -0.055],
  ankleR: [-0.17, 0.09, -0.055],
  toesL: [0.21, 0.015, 0.1],
  toesR: [-0.21, 0.015, 0.1],
  // ส้นเท้า + กลางสะบัก: ท่อนเสริมให้แตะส้นเท้า = เท้า (ไม่ใช่น่อง) · แตะสะบัก = หลัง (ไม่ใช่ไหล่)
  heelL: [0.17, 0.03, -0.08],
  heelR: [-0.17, 0.03, -0.08],
  scapL: [0.1, 1.27, -0.03],
  scapR: [-0.1, 1.27, -0.03],
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
 * ตำแหน่งบนร่างกาย: จุดกลางบนผิว (base, เมตร · ยิงรังสีจากในส่วนนั้นออกไปหาผิว mesh จริง แล้วถอยเข้าใน 4 มม.)
 * dir = ทิศหันออก (ใช้ตัดสินว่าอยู่ด้านหลังไหม / หมุนหุ่นให้เห็น)
 * area = รัศมีบริเวณที่ระบายสี (x, y, z เมตร) — ทรงรีตามรูปร่างส่วนนั้น เช่น หลังกว้างและสูง หัวไหล่เป็นโดม
 */
const PIN_ANCHOR: Record<BodyPin, { base: [number, number, number]; dir: [number, number, number]; area: [number, number, number] }> = {
  head: { base: [0, 1.63, 0.04], dir: [0, 0.35, 1], area: [0.09, 0.075, 0.1] },
  templeLeft: { base: [0.068, 1.61, 0.074], dir: [1, 0, 0.35], area: [0.025, 0.025, 0.025] },
  occiputLeft: { base: [0.032, 1.58, -0.04], dir: [0.4, 0, -1], area: [0.035, 0.035, 0.035] },
  noseLeft: { base: [0.014, 1.55, 0.138], dir: [0.12, 0, 1], area: [0.015, 0.02, 0.02] },
  eyeLeft: { base: [0.034, 1.58, 0.122], dir: [0.3, 0, 1], area: [0.022, 0.016, 0.025] },
  eyeRight: { base: [-0.034, 1.58, 0.122], dir: [-0.3, 0, 1], area: [0.022, 0.016, 0.025] },
  neck: { base: [0, 1.44, 0.079], dir: [0, 0, 1], area: [0.055, 0.05, 0.06] },
  neckBack: { base: [0, 1.47, -0.021], dir: [0, 0, -1], area: [0.055, 0.05, 0.06] },
  shoulderLeft: { base: [0.21, 1.365, -0.01], dir: [0.3, 1, 0], area: [0.06, 0.07, 0.07] },
  shoulderRight: { base: [-0.21, 1.365, -0.01], dir: [-0.3, 1, 0], area: [0.06, 0.07, 0.07] },
  trapLeft: { base: [0.109, 1.418, -0.032], dir: [0.15, 1, -0.2], area: [0.06, 0.045, 0.06] },
  trapRight: { base: [-0.109, 1.418, -0.032], dir: [-0.15, 1, -0.2], area: [0.06, 0.045, 0.06] },
  chest: { base: [0, 1.25, 0.121], dir: [0, 0, 1], area: [0.12, 0.08, 0.08] },
  back: { base: [0, 1.25, -0.082], dir: [0, 0, -1], area: [0.12, 0.12, 0.08] },
  lowerBack: { base: [0, 1.03, -0.054], dir: [0, 0, -1], area: [0.11, 0.08, 0.08] },
  clavicleLeft: { base: [0.095, 1.391, 0.027], dir: [0.2, 0.4, 1], area: [0.03, 0.025, 0.03] },
  clavicleRight: { base: [-0.095, 1.391, 0.027], dir: [-0.2, 0.4, 1], area: [0.03, 0.025, 0.03] },
  kneeBackLeft: { base: [0.13, 0.465, -0.066], dir: [0, 0, -1], area: [0.045, 0.045, 0.05] },
  kneeBackRight: { base: [-0.13, 0.465, -0.066], dir: [0, 0, -1], area: [0.045, 0.045, 0.05] },
  thighBackLeft: { base: [0.11, 0.66, -0.062], dir: [0, 0, -1], area: [0.06, 0.12, 0.05] },
  thighBackRight: { base: [-0.11, 0.66, -0.062], dir: [0, 0, -1], area: [0.06, 0.12, 0.05] },
  templeRight: { base: [-0.068, 1.61, 0.074], dir: [-1, 0, 0.35], area: [0.025, 0.025, 0.025] },
  occiputRight: { base: [-0.032, 1.58, -0.04], dir: [-0.4, 0, -1], area: [0.035, 0.035, 0.035] },
  jaw: { base: [0, 1.49, 0.11], dir: [0, -0.3, 1], area: [0.065, 0.035, 0.06] },
  belly: { base: [0, 1.02, 0.121], dir: [0, 0, 1], area: [0.1, 0.08, 0.06] },
  scapulaLeft: { base: [0.111, 1.27, -0.107], dir: [0.2, 0, -1], area: [0.05, 0.065, 0.05] },
  scapulaRight: { base: [-0.111, 1.27, -0.107], dir: [-0.2, 0, -1], area: [0.05, 0.065, 0.05] },
  ribLeft: { base: [0.135, 1.12, 0.065], dir: [0.7, 0, 0.7], area: [0.05, 0.06, 0.07] },
  ribRight: { base: [-0.135, 1.12, 0.065], dir: [-0.7, 0, 0.7], area: [0.05, 0.06, 0.07] },
  hipLeft: { base: [0.112, 0.88, -0.074], dir: [0.3, 0, -1], area: [0.07, 0.07, 0.06] },
  hipRight: { base: [-0.112, 0.88, -0.074], dir: [-0.3, 0, -1], area: [0.07, 0.07, 0.06] },
  armLeft: { base: [0.271, 1.23, 0.001], dir: [1, 0, 0.2], area: [0.045, 0.1, 0.05] },
  armRight: { base: [-0.271, 1.23, 0.001], dir: [-1, 0, 0.2], area: [0.045, 0.1, 0.05] },
  elbowLeft: { base: [0.327, 1.091, 0], dir: [1, 0, 0], area: [0.04, 0.04, 0.04] },
  elbowRight: { base: [-0.327, 1.091, 0], dir: [-1, 0, 0], area: [0.04, 0.04, 0.04] },
  wristLeft: { base: [0.39, 0.886, 0.067], dir: [1, 0, 0], area: [0.035, 0.035, 0.035] },
  wristRight: { base: [-0.39, 0.886, 0.067], dir: [-1, 0, 0], area: [0.035, 0.035, 0.035] },
  handLeft: { base: [0.431, 0.79, 0.115], dir: [1, 0, 0.3], area: [0.04, 0.06, 0.04] },
  handRight: { base: [-0.431, 0.79, 0.115], dir: [-1, 0, 0.3], area: [0.04, 0.06, 0.04] },
  thighLeft: { base: [0.115, 0.66, 0.102], dir: [0, 0, 1], area: [0.07, 0.12, 0.06] },
  thighRight: { base: [-0.115, 0.66, 0.102], dir: [0, 0, 1], area: [0.07, 0.12, 0.06] },
  kneeLeft: { base: [0.13, 0.47, 0.046], dir: [0, 0, 1], area: [0.05, 0.05, 0.05] },
  kneeRight: { base: [-0.13, 0.47, 0.046], dir: [0, 0, 1], area: [0.05, 0.05, 0.05] },
  shinLeft: { base: [0.155, 0.28, -0.017], dir: [0, 0, 1], area: [0.04, 0.1, 0.04] },
  shinRight: { base: [-0.155, 0.28, -0.017], dir: [0, 0, 1], area: [0.04, 0.1, 0.04] },
  calfLeft: { base: [0.155, 0.32, -0.107], dir: [0, 0, -1], area: [0.05, 0.1, 0.05] },
  calfRight: { base: [-0.155, 0.32, -0.107], dir: [0, 0, -1], area: [0.05, 0.1, 0.05] },
  ankleLeft: { base: [0.2, 0.09, -0.041], dir: [1, 0, 0.3], area: [0.04, 0.035, 0.04] },
  ankleRight: { base: [-0.2, 0.09, -0.041], dir: [-1, 0, 0.3], area: [0.04, 0.035, 0.04] },
  heelLeft: { base: [0.17, 0.018, -0.098], dir: [0, -0.3, -1], area: [0.035, 0.035, 0.035] },
  heelRight: { base: [-0.17, 0.018, -0.098], dir: [0, -0.3, -1], area: [0.035, 0.035, 0.035] },
  footLeft: { base: [0.2, 0.039, 0.069], dir: [0, 1, 0.5], area: [0.04, 0.03, 0.06] },
  footRight: { base: [-0.2, 0.039, 0.069], dir: [0, 1, 0.5], area: [0.04, 0.03, 0.06] },
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
  { from: 'heelL', to: 'toesL', front: R('footL', 'เท้าซ้าย') },
  { from: 'heelR', to: 'toesR', front: R('footR', 'เท้าขวา') },
  { from: 'chest', to: 'scapL', front: R('chest', 'หน้าอก'), back: R('back', 'หลัง') },
  { from: 'chest', to: 'scapR', front: R('chest', 'หน้าอก'), back: R('back', 'หลัง') },
];
/** จุดข้อต่อที่ถือเป็นส่วนเฉพาะ (รัศมีเล็ก, หน่วยเมตร) เช่น เข่า */
const JOINTS: { at: Landmark; radius: number; region: BodyRegion }[] = [
  { at: 'kneeL', radius: 0.075, region: R('kneeL', 'เข่าซ้าย') },
  { at: 'kneeR', radius: 0.075, region: R('kneeR', 'เข่าขวา') },
];

type Picker = (ndcX: number, ndcY: number) => { point: THREE.Vector3; region: BodyRegion | null } | null;
/** ตำแหน่งบนจอ (NDC −1..1) ของจุดบนร่างกาย ตามท่าหุ่นปัจจุบัน */
type Projector = (pin: BodyPin) => { x: number; y: number } | null;
/** จุดใดก็ได้บนผิว (พิกัดเดียวกับ pickAt/marks) → ndc + มองเห็นจากกล้องไหม (ไม่ถูกตัวหุ่นบัง) */
type PointProjector = (p: BodyPoint) => { x: number; y: number; visible: boolean } | null;
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
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSpotPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSpotPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vSpotPos;
uniform int uSpotCount;
float gShorts;
uniform vec3 uSpotCenter[${MAX_SPOTS}];
uniform vec3 uSpotRadius[${MAX_SPOTS}];
uniform vec3 uSpotColor[${MAX_SPOTS}];
`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.95, gShorts);')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
// กางเกงขาสั้น: ระบายลงบนผิวโดยตรง (แนบสรีระพอดี ไม่ลอย) — เอว y≈0.95 · ปลายขา y≈0.67 (ด้านในขาสั้นกว่าเล็กน้อย)
// ขอบข้าง |x|<0.2 = ครอบสะโพก/ต้นขา แต่ไม่โดนมือที่ห้อยข้างตัว (มือเริ่มที่ |x|≈0.33)
float sInX = 1.0 - smoothstep(0.2, 0.215, abs(vSpotPos.x));
float hem = 0.67 + 0.03 * (1.0 - smoothstep(0.03, 0.09, abs(vSpotPos.x)));
float sIn = sInX * smoothstep(hem - 0.004, hem + 0.004, vSpotPos.y) * (1.0 - smoothstep(0.946, 0.954, vSpotPos.y));
gShorts = sIn;
vec3 fabric = SHORTS_COLOR;
// ขอบเอว + ขอบปลายขาเข้มขึ้นเล็กน้อย
float band = smoothstep(0.916, 0.92, vSpotPos.y) + (1.0 - smoothstep(hem + 0.014, hem + 0.018, vSpotPos.y));
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

/** หุ่นที่ bake แล้ว: geometry ในพิกัดของหุ่น (เมตร) — ใช้ร่วมกันทุก canvas */
type BakedModel = {
  body: THREE.BufferGeometry;
  eyes: THREE.BufferGeometry[];
  /** ขนาดกล่องของผิว + จุดกลาง (เมตร) */
  size: THREE.Vector3;
  center: THREE.Vector3;
  /** สเกล (หน่วยของฉากต่อเมตร): สูง 2 หน่วย แต่ย่อลงถ้าแขนกางล้นกรอบ (FIT_HALF_WIDTH) */
  scale: number;
};
const bakedCache = new WeakMap<object, BakedModel>();

/** สีตาตามมุมจากแกนหน้าของลูกตา: ตาขาวนวล · ม่านตาน้ำตาล · รูม่านตาเข้ม (แบบ ThaiWellAI) */
function paintEye(g: THREE.BufferGeometry) {
  g.computeBoundingBox();
  const c = g.boundingBox!.getCenter(new THREE.Vector3());
  const p = g.attributes.position;
  const out = new Float32Array(p.count * 3);
  const sclera = new THREE.Color('#efe6de');
  const iris = new THREE.Color('#6a4a35');
  const irisEdge = new THREE.Color('#3e2a1f');
  const pupil = new THREE.Color('#1b1310');
  const col = new THREE.Color();
  const d = new THREE.Vector3();
  const ramp = (a: number, b: number, x: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  for (let i = 0; i < p.count; i++) {
    const t = d.fromBufferAttribute(p, i).sub(c).normalize().z; // 1 = มองตรงไปข้างหน้า (+z)
    col.copy(sclera).lerp(irisEdge, ramp(0.8, 0.83, t)).lerp(iris, ramp(0.84, 0.9, t)).lerp(pupil, ramp(0.955, 0.97, t));
    out.set([col.r, col.g, col.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
}

/**
 * ไฟล์ glb วาง node ไว้นอกจุดกำเนิด (ตัวหุ่น x≈-2.26 · ลูกตาถูกย่อ+หมุน) → bake transform ของ node ลง geometry
 * แล้วเลื่อนให้กลางตัว x=0 · เท้า y=0 (หน้าหันไป +z อยู่แล้ว) — ทำครั้งเดียวต่อไฟล์
 */
function bakeModel(scene: THREE.Object3D): BakedModel {
  const hit = bakedCache.get(scene);
  if (hit) return hit;
  scene.updateMatrixWorld(true);
  const bodies: THREE.BufferGeometry[] = [];
  const eyes: THREE.BufferGeometry[] = [];
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = (m.geometry as THREE.BufferGeometry).clone();
    g.applyMatrix4(m.matrixWorld);
    (/eye/i.test(m.name) ? eyes : bodies).push(g);
  });
  // ผิว = mesh ที่ใหญ่ที่สุด (LOW)
  bodies.sort((a, b) => b.attributes.position.count - a.attributes.position.count);
  const body = bodies[0];
  body.computeBoundingBox();
  const box0 = body.boundingBox!;
  const shift = new THREE.Vector3(-(box0.min.x + box0.max.x) / 2, -box0.min.y, 0);
  [body, ...eyes].forEach((g) => {
    g.translate(shift.x, shift.y, shift.z);
    g.computeBoundingSphere();
  });
  body.computeBoundingBox();
  eyes.forEach(paintEye);
  const size = body.boundingBox!.getSize(new THREE.Vector3());
  const center = body.boundingBox!.getCenter(new THREE.Vector3());
  // สเกลที่ปลายมือ ณ ทุกมุมหมุน (รวม perspective) ยังอยู่ในกรอบ: จอ = X·k·cz/(cz − Z·k) ≤ FIT_HALF_WIDTH
  // perspective ขึ้นกับ k เล็กน้อย → วนหาค่าซ้ำ 2 รอบก็นิ่ง
  const { cameraZ } = componentTokens.body3d;
  const P = body.attributes.position;
  const reach = (k: number) => {
    let worst = 0;
    // 12 มุม × จุดยอดทุก ๆ 9 จุด (~75k รอบ แทน 1.3 ล้าน) — พอสำหรับหาปลายมือ ไม่ทำให้ iOS ค้างตอนโหลด
    for (let a = 0; a < 12; a++) {
      const c = Math.cos((a * Math.PI) / 6);
      const sn = Math.sin((a * Math.PI) / 6);
      for (let i = 0; i < P.count; i += 9) {
        const x = P.getX(i) - LANDMARK.pelvis[0];
        const z = P.getZ(i) - LANDMARK.pelvis[2];
        worst = Math.max(worst, (Math.abs(x * c + z * sn) * cameraZ) / (cameraZ - (z * c - x * sn) * k));
      }
    }
    return worst;
  };
  let scale = 2 / Math.max(size.y, 0.001);
  for (let it = 0; it < 2; it++) scale = Math.min(2 / Math.max(size.y, 0.001), FIT_HALF_WIDTH / Math.max(reach(scale), 0.001));
  // ดัชนี BVH ของผิว (ใช้ร่วมทุก canvas เพราะ geometry ใช้ร่วมกัน) — สร้างหลังแก้ geometry เสร็จแล้วเท่านั้น
  body.computeBoundsTree();
  const out = { body, eyes, size, center, scale };
  bakedCache.set(scene, out);
  return out;
}

/** normal map + AO map (โหลดครั้งเดียว · ใช้ร่วมกันทุก canvas) — โหลดไม่ได้ → ไม่ใช้ map (หุ่นยังแสดงได้) */
type DetailMaps = { normal: THREE.Texture | null; ao: THREE.Texture | null };
let detailMaps: Promise<DetailMaps> | null = null;
function loadDetailMaps(): Promise<DetailMaps> {
  const one = async (mod: number): Promise<THREE.Texture | null> => {
    try {
      // เว็บใช้ URL ของ asset ได้ทันที · native ดาวน์โหลดลงเครื่องก่อน (TextureLoader ของ r3f/native อ่านไฟล์จาก localUri)
      const asset = Asset.fromModule(mod);
      const uri = Platform.OS === 'web' ? asset.uri : await asset.downloadAsync().then((a) => a.localUri ?? a.uri);
      const tex = await new THREE.TextureLoader().loadAsync(uri);
      tex.flipY = false; // UV แบบ glTF
      tex.colorSpace = THREE.NoColorSpace; // ข้อมูล ไม่ใช่สี
      tex.anisotropy = 4;
      tex.needsUpdate = true;
      return tex;
    } catch {
      return null;
    }
  };
  return (detailMaps ??= Promise.all([one(NORMAL_MAP), one(AO_MAP)]).then(([normal, ao]) => ({ normal, ao })));
}

/**
 * โหลดหุ่นล่วงหน้าตั้งแต่เปิดแอป (แบบ ThaiWellAI: โหลดครั้งเดียว ใช้ร่วมทุกหน้า)
 * → ถึงหน้าแรกหุ่นพร้อมแล้ว ไม่ต้องรอดาวน์โหลด/แปลงไฟล์ · ไฟล์ normal/AO ก็โหลดไปพร้อมกัน
 */
let preloadStarted = false;
export function preloadBody3D() {
  if (preloadStarted) return;
  preloadStarted = true;
  const go = (url: string) => {
    useLoader.preload(GLTFLoader, url);
    loadDetailMaps();
  };
  if (Platform.OS === 'web') go(Asset.fromModule(MODEL).uri);
  else
    Asset.fromModule(MODEL)
      .downloadAsync()
      .then((a) => go(a.localUri ?? a.uri))
      .catch(() => {});
}

function Figure({
  url,
  pins,
  marks,
  markColor,
  rot,
  pickerRef,
  projectorRef,
  pointProjectorRef,
  facerRef,
  onReady,
}: {
  url: string;
  pins: Body3DPin[];
  marks: BodyPoint[];
  markColor?: string;
  /** มุมหมุน (ref ไม่ใช่ state) — ลากแล้วไม่ re-render React ทุกครั้ง */
  rot: React.MutableRefObject<RotState>;
  pickerRef: React.MutableRefObject<Picker | null>;
  projectorRef: React.MutableRefObject<Projector | null>;
  pointProjectorRef: React.MutableRefObject<PointProjector | null>;
  facerRef: React.MutableRefObject<Facer | null>;
  /** วาดเฟรมแรกเสร็จแล้ว (ใช้สลับ canvas บน iOS แบบไม่กะพริบ) */
  onReady?: () => void;
}) {
  const { colors } = useTheme();
  const loaded = useLoader(GLTFLoader, url);
  const baked = React.useMemo(() => bakeModel(loaded.scene), [loaded]);
  const { camera, invalidate } = useThree();
  const groupRef = React.useRef<THREE.Group>(null);
  const visibleCenterRef = React.useRef<((pin: BodyPin) => { ndc: THREE.Vector2; surface: THREE.Vector3 | null } | null) | null>(null);

  const skin = React.useMemo(() => createSkinMaterial(palette.skin.model, palette.garment.base), []);
  const eyeMat = React.useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0 }), []);
  React.useEffect(
    () => () => {
      skin.mat.dispose();
      eyeMat.dispose();
    },
    [skin, eyeMat],
  );
  // รายละเอียดผิว (normal + AO) มาทีหลังได้ — ไม่รอ ไม่ทำให้หุ่นหาย ถ้าโหลดไม่ได้ก็ใช้ผิวเรียบ
  React.useEffect(() => {
    let alive = true;
    loadDetailMaps().then(({ normal, ao }) => {
      if (!alive || (!normal && !ao)) return;
      if (normal) {
        skin.mat.normalMap = normal;
        skin.mat.normalScale.set(1.1, 1.1);
      }
      if (ao) {
        skin.mat.aoMap = ao;
        skin.mat.aoMapIntensity = 0.9;
      }
      skin.mat.needsUpdate = true;
      invalidate();
    });
    return () => {
      alive = false;
    };
  }, [skin, invalidate]);

  /* geometry ใช้ร่วมกัน แต่ mesh/ฉากสร้างใหม่ต่อ canvas — วัตถุ three มีแม่ได้คนเดียว
   * ถ้าใช้ตัวเดียวกันตอนสร้าง canvas ใหม่ (iOS) canvas เก่าที่ถูกถอดจะดึงหุ่นออกไปด้วย → หุ่นหาย */
  const { root, toLocal, skinMeshes } = React.useMemo(() => {
    const scene = new THREE.Group();
    // ผิว = พื้นผิวที่แตะ/วัดขนาดได้ · ลูกตาแยกวัสดุ (ไม่ระบายสี ไม่รับแตะ)
    const body = new THREE.Mesh(baked.body, skin.mat);
    scene.add(body);
    baked.eyes.forEach((g) => scene.add(new THREE.Mesh(g, eyeMat)));
    // จัดหุ่นให้อยู่กลาง (สูงสุด 2 หน่วย — ดู bakeModel) · แกนหมุนแนวตั้งผ่านเชิงกราน = กลางลำตัวจริง → หมุนอยู่กับที่
    const center = baked.center.clone();
    center.x = LANDMARK.pelvis[0];
    center.z = LANDMARK.pelvis[2];
    const k = baked.scale;
    scene.scale.setScalar(k);
    scene.position.set(-center.x * k, -center.y * k, -center.z * k);
    scene.updateMatrixWorld(true);
    /** พิกัดของหุ่น (เมตร) → พิกัดของกลุ่มที่หมุน */
    const local = (v: readonly number[]) => new THREE.Vector3(v[0], v[1], v[2]).multiplyScalar(k).add(scene.position);
    return { root: scene, toLocal: local, skinMeshes: [body] };
  }, [baked, skin, eyeMat]);

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
        color: markColor ? new THREE.Color(markColor) : symptom,
      })),
    ];
    skin.setSpots(spots);
    invalidate();
  }, [pins, marks, markColor, root, skin, colors, invalidate]);


  // ยิงรังสีจากตำแหน่งที่แตะไปหาผิวหุ่นจริง → จุดในพิกัดของหุ่น + ส่วนของร่างกายที่ใกล้ที่สุด
  React.useEffect(() => {
    const raycaster = new THREE.Raycaster();
    raycaster.firstHitOnly = true;
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
      const key = `${pin}|${group.rotation.y.toFixed(3)}|${camera.position.y.toFixed(2)}|${camera.position.z.toFixed(2)}`;
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
    const pointProjector: PointProjector = (p) => {
      const group = groupRef.current;
      if (!group) return null;
      group.updateMatrixWorld(true);
      const world = group.localToWorld(new THREE.Vector3(p.x, p.y, p.z));
      const ndc = world.clone().project(camera);
      // มองเห็น = รังสีจากกล้องไปจุดนั้น ชนผิวหุ่นครั้งแรกที่จุดนั้นเอง (ไม่ใช่ด้านหน้าที่บังอยู่)
      raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
      const hit = raycaster.intersectObjects(skinMeshes, false)[0];
      const visible = !!hit && hit.point.distanceTo(world) < 0.06 * group.scale.x + 0.02;
      return { x: ndc.x, y: ndc.y, visible };
    };
    pointProjectorRef.current = pointProjector;
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
      if (pointProjectorRef.current === pointProjector) pointProjectorRef.current = null;
      if (facerRef.current === facer) facerRef.current = null;
      visibleCenterRef.current = null;
    };
  }, [camera, root, toLocal, skinMeshes, pickerRef, projectorRef, pointProjectorRef, facerRef]);

  // มุมเป้าหมายเปลี่ยน (ลาก/หันหน้า-หลัง) → ปลุก render loop (frameloop demand)
  React.useEffect(() => {
    rot.current.kick = invalidate;
    invalidate();
    return () => {
      rot.current.kick = () => {};
    };
  }, [rot, invalidate]);
  const readyRef = React.useRef(false);
  useFrame(() => {
    if (readyRef.current) return;
    readyRef.current = true;
    // รอให้เฟรมแรกขึ้นจอก่อน แล้วค่อยแจ้ง
    setTimeout(() => onReady?.(), 80);
  });
  // มุมตอนสร้าง canvas (ค่าคงที่ — r3f ตั้งให้ครั้งเดียว) · iOS สร้าง canvas ใหม่ทุกครั้งที่ท่าเปลี่ยน จึงต้องเริ่มที่มุมล่าสุดเลย
  const initialRotation = React.useRef(rot.current.angle).current;
  // วาดเฉพาะเมื่อจำเป็น (frameloop="demand") → ขอเฟรมต่อจนกว่าจะหมุนถึงมุมเป้าหมาย
  // แบบ ThaiWellAI: นิ้วเลื่อน "มุมเป้าหมาย" · หุ่นค่อย ๆ ตามทุกเฟรม (ease) · ปัดแรงแล้วปล่อย = หมุนต่อแล้วค่อย ๆ ช้าลง (momentum)
  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;
    const r = rot.current;
    const f = Math.min(3, dt * 60); // เทียบเป็นจำนวนเฟรม 60fps (เครื่องช้า/เร็วหมุนเท่ากัน)
    if (!r.dragging && Math.abs(r.vel) > 1e-5) {
      r.target += r.vel * f;
      r.vel *= Math.pow(0.93, f);
    }
    const ease = 1 - Math.pow(1 - 0.18, f);
    const d = r.target - g.rotation.y;
    const dT = r.tiltTarget - r.tilt;
    const dZ = r.zoomTarget - r.zoom;
    if (Math.abs(d) < 0.0005 && Math.abs(dT) < 0.0005 && Math.abs(dZ) < 0.0005 && Math.abs(r.vel) <= 1e-5) {
      g.rotation.y = r.target;
      r.angle = r.target;
      return;
    }
    g.rotation.y += d * ease;
    r.angle = g.rotation.y;
    // แบบ ThaiWellAI: กล้องโคจรรอบหุ่น (ก้ม/เงย) + ระยะซูม — หุ่นอยู่กลางเสมอ
    r.tilt += dT * ease;
    r.zoom += dZ * ease;
    const R = componentTokens.body3d.cameraZ * r.zoom;
    camera.position.set(0, Math.sin(r.tilt) * R, Math.cos(r.tilt) * R);
    camera.lookAt(0, 0, 0);
    invalidate();
  });

  return (
    <group ref={groupRef} rotation={[0, initialRotation, 0]}>
      <primitive object={root} />
    </group>
  );
}

/** ขอบเขตก้ม/เงย และซูม */
const TILT_MAX = 0.6;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.4;

/** มุมหมุนของหุ่น: target = มุมที่นิ้วสั่ง · angle = มุมที่วาดอยู่ · vel = แรงเฉื่อยหลังปัด */
interface RotState {
  target: number;
  angle: number;
  vel: number;
  /** มุมก้ม/เงยของกล้อง (เรเดียนจากแนวราบ · + = มองจากด้านบน) และระยะซูม (1 = ปกติ · < 1 = ใกล้) */
  tilt: number;
  tiltTarget: number;
  zoom: number;
  zoomTarget: number;
  dragging: boolean;
  kick: () => void;
  last: { a: number; t: number };
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
  /** ตำแหน่งบนจอของจุดที่แตะเลือก (pickAt) + มองเห็นอยู่ไหม (หมุนไปด้านหลัง = ไม่เห็น) */
  projectPoint: (p: BodyPoint) => { x: number; y: number; visible: boolean } | null;
  /** วัดตำแหน่งบนจอใหม่ (เรียกหลังขยับ/ย่อหุ่นด้วย transform — onLayout ไม่รู้ตัว) */
  remeasure: () => void;
  /** หมุนหุ่นเพิ่ม (เรเดียน) นับจากมุมตอนเริ่มลาก */
  beginRotate: () => void;
  /** dx = หมุนรอบตัว · dy = ก้ม/เงย (เรเดียน นับจากตอนเริ่มลาก) */
  rotateTo: (deltaRad: number, tiltRad?: number) => void;
  /** ซูมด้วยสองนิ้ว: เริ่ม → scale ของนิ้ว (กางออก > 1 = ใกล้ขึ้น) */
  beginZoom: () => void;
  zoomTo: (scale: number) => void;
  /** กลับมุมมองปกติ (ไม่ก้ม/เงย · ไม่ซูม) */
  resetView: () => void;
  /** ปล่อยนิ้ว (ปัดเร็ว = หมุนต่อแบบมีแรงเฉื่อย) */
  endRotate: () => void;
  /** หันหุ่น: front = หน้าตรง · back = หันหลัง (หมุนทางที่ใกล้ที่สุด) */
  face: (side: 'front' | 'back' | 'left' | 'right') => void;
  /** หันหุ่นให้เห็นบริเวณนั้นชัด (หมุนทางที่ใกล้ที่สุด) — คืน false ถ้าหุ่นยังไม่โหลด */
  facePin: (pin: BodyPin) => boolean;
}

/** พารามิเตอร์ pixelStorei เฉพาะ WebGL ที่ expo-gl ไม่รองรับ (UNPACK_FLIP_Y / PREMULTIPLY_ALPHA / COLORSPACE_CONVERSION) */
const WEBGL_ONLY_PIXEL_PARAMS = new Set([0x9240, 0x9241, 0x9243]);
/**
 * native: three เรียก pixelStorei ด้วยค่าข้างบนตอนอัปโหลด texture
 * → expo-gl พิมพ์ log เตือนทุกเฟรม (หลายหมื่นบรรทัด) จนแอปหน่วง/ค้าง · ข้ามไปเลยเพราะไม่มีผลบน native อยู่แล้ว
 */
export function muteWebGLOnlyParams(gl: THREE.WebGLRenderer) {
  const ctx = gl.getContext();
  const pixelStorei = ctx.pixelStorei.bind(ctx);
  ctx.pixelStorei = (pname: number, param: number | boolean) => {
    if (!WEBGL_ONLY_PIXEL_PARAMS.has(pname)) pixelStorei(pname, param as number);
  };
}


/** แสงสะท้อนรอบตัวแบบห้อง (เหมือน human-atlas) — เฉพาะเว็บ เพราะ expo-gl ยังไม่รองรับ render target แบบ float ที่ PMREM ใช้ */
export function RoomEnv() {
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
    /** สีของจุดที่แตะ (เช่น ตามคะแนนปวด) · ไม่ใส่ = สีอาการ */
    markColor?: string;
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
    markColor,
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
  // มุมหมุนเก็บใน ref (ไม่ใช่ state): ลาก 60 ครั้ง/วิ ไม่ทำให้ React วาด Body3D/Canvas ใหม่ทุกครั้ง
  const rot = React.useRef<RotState>({ target: restAngle, angle: restAngle, vel: 0, tilt: 0, tiltTarget: 0, zoom: 1, zoomTarget: 1, dragging: false, kick: () => {}, last: { a: restAngle, t: 0 } });
  const startTilt = React.useRef(0);
  const startZoom = React.useRef(1);
  const setRotationY = React.useCallback((v: number | ((cur: number) => number)) => {
    const r = rot.current;
    r.target = typeof v === 'function' ? v(r.target) : v;
    if (r.dragging) {
      // ความเร็วตอนลาก (เรเดียน/เฟรม) ไว้ปัดต่อ
      const now = Date.now();
      const dt = Math.max(1, now - r.last.t);
      r.vel = r.vel * 0.6 + ((r.target - r.last.a) / dt) * 16.7 * 0.4;
      r.last = { a: r.target, t: now };
    } else r.vel = 0;
    r.kick();
  }, []);
  const startDrag = () => {
    const r = rot.current;
    r.dragging = true;
    r.vel = 0;
    r.last = { a: r.target, t: Date.now() };
  };
  /** ปล่อยนิ้ว: ปัดเร็ว = หมุนต่อ · พักนิ้วก่อนปล่อย = หยุด */
  const endDrag = () => {
    const r = rot.current;
    r.dragging = false;
    if (Date.now() - r.last.t > 80) r.vel = 0;
    r.vel = Math.max(-0.08, Math.min(0.08, r.vel));
    r.kick();
  };
  // skeleton ระหว่างโหลดโมเดล: แสดงเมื่อรอนานเกิน 300ms · เฟรมแรกขึ้นแล้วค่อย ๆ จางหาย
  const [ready, setReady] = React.useState(false);
  const waitLong = useDelayedLoading(!ready);
  const skeletonFade = React.useRef(new Animated.Value(1)).current;
  const [showSkeleton, setShowSkeleton] = React.useState(false);
  const pulse = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    if (!waitLong) return;
    setShowSkeleton(true);
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    a.start();
    return () => a.stop();
  }, [waitLong, pulse]);
  React.useEffect(() => {
    if (!ready || !showSkeleton) return;
    Animated.timing(skeletonFade, { toValue: 0, duration: 260, useNativeDriver: Platform.OS !== 'web' }).start(() => setShowSkeleton(false));
  }, [ready, showSkeleton, skeletonFade]);
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
  rotRef.current = rot.current.target;
  const pickerRef = React.useRef<Picker | null>(null);
  const projectorRef = React.useRef<Projector | null>(null);
  const pointProjectorRef = React.useRef<PointProjector | null>(null);
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
      projectPoint: (p) => {
        const node = boxRef.current as unknown as { getBoundingClientRect?: () => DOMRect } | null;
        const rect = node?.getBoundingClientRect?.() ?? layoutRef.current;
        const v = pointProjectorRef.current?.(p);
        if (!rect || !v) return null;
        return { x: rect.x + ((v.x + 1) / 2) * rect.width, y: rect.y + ((1 - v.y) / 2) * rect.height, visible: v.visible };
      },
      beginRotate: () => {
        startRot.current = rot.current.target;
        startTilt.current = rot.current.tiltTarget;
        startDrag();
      },
      endRotate: () => endDrag(),
      remeasure: () => measure(),
      rotateTo: (d, dy = 0) => {
        setRotationY(startRot.current + d);
        if (dy) {
          const r = rot.current;
          // ลากขึ้น = มองจากด้านล่าง · ลากลง = มองจากด้านบน (จำกัดไม่ให้พลิกหัวกลับ)
          r.tiltTarget = Math.max(-TILT_MAX, Math.min(TILT_MAX, startTilt.current + dy));
          r.kick();
        }
      },
      beginZoom: () => (startZoom.current = rot.current.zoomTarget),
      zoomTo: (scale) => {
        const r = rot.current;
        // นิ้วกางออก (scale > 1) = เข้าใกล้
        r.zoomTarget = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, startZoom.current / scale));
        r.kick();
      },
      resetView: () => {
        const r = rot.current;
        r.tiltTarget = 0;
        r.zoomTarget = 1;
        r.kick();
      },
      face: (side) =>
        setRotationY((cur) => {
          // หน้า · ขวา (ขวาของผู้ป่วยหันมาหากล้อง) · หลัง · ซ้าย
          const target = side === 'back' ? Math.PI - restRef.current : side === 'right' ? Math.PI / 2 : side === 'left' ? -Math.PI / 2 : restRef.current;
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
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,
        onPanResponderGrant: () => {
          moved.current = false;
          startRot.current = rot.current.target;
          startTilt.current = rot.current.tiltTarget;
          startDrag();
        },
        onPanResponderMove: (_, g) => {
          if (Math.abs(g.dx) > 6) moved.current = true;
          setRotationY(startRot.current + g.dx / 80);
          rot.current.tiltTarget = Math.max(-TILT_MAX, Math.min(TILT_MAX, startTilt.current + g.dy / 160));
        },
        onPanResponderRelease: (e) => {
          endDrag();
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
      startRot.current = rot.current.target;
      startDrag();
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
      endDrag();
    },
    onPointerCancel: () => {
      dragX.current = null;
      endDrag();
    },
  };

  return (
    <View ref={boxRef} onLayout={measure} style={{ width, height }} accessibilityLabel="หุ่นร่างกาย 3 มิติ แตะเพื่อระบุตำแหน่งอาการ ลากซ้ายขวาเพื่อหมุน">
      <Canvas
        // เว็บ: วัดขนาดจาก offsetWidth (ไม่รวม transform) — หุ่นถูกย่อด้วย transform จากภายนอก ถ้าวัดแบบรวม transform canvas จะเล็กซ้อนสองชั้น
        resize={{ offsetSize: true }}
        frameloop="demand"
        // ความละเอียด: จอ 3x วาดพิกเซลมากกว่า 2x ถึง 2.25 เท่า แต่ตาแทบไม่เห็นต่าง → จำกัดไว้ (ThaiWellAI: 1.5 บนเว็บ)
        dpr={Platform.OS === 'web' ? [1, 1.5] : Math.min(PixelRatio.get(), 2)}
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
          {url ? <Figure url={url} pins={pins} marks={marks} markColor={markColor} rot={rot} pickerRef={pickerRef} projectorRef={projectorRef} pointProjectorRef={pointProjectorRef} facerRef={facerRef} onReady={() => setReady(true)} /> : null}
        </React.Suspense>
      </Canvas>
      {/* ระหว่างโหลดหุ่น (เกิน 300ms): เงาโครงร่างคน + แสงวิ่ง → จางหายเมื่อเฟรมแรกขึ้น */}
      {showSkeleton ? (
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height, alignItems: 'center', justifyContent: 'center', opacity: skeletonFade }}>
          {/* เงาหุ่นหายใจเข้า-ออก (pulse) แทนแสงวิ่ง — แสงวิ่งจะเป็นแถบสี่เหลี่ยมทับพื้นหลังหน้าแรก */}
          <Animated.View style={{ opacity: pulse }}>
            <BodySilhouette height={height * 0.86} color="rgba(120,128,140,0.2)" />
          </Animated.View>
        </Animated.View>
      ) : null}
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
