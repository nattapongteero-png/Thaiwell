/**
 * ท่าฤๅษีดัดตนแบบเคลื่อนไหว (วนซ้ำ) — แนวคิดจาก gymnerd/ExerciseDB: หุ่นทำท่าวนไปเรื่อย ๆ
 * และระบายสีส่วนที่ได้ยืด (หลัก = แดง · เสริม = ส้ม) ให้เห็นว่าท่านี้ช่วยตรงไหน
 *
 * ท่าทาง = "ทิศของแต่ละท่อน" ในพิกัดของหุ่น (Y ขึ้น · +z หน้า · +x = ซ้ายของหุ่น) เช่น UpperArmL [0,1,0] = ต้นแขนซ้ายชี้ขึ้น
 * ท่อนที่ไม่ระบุ = ท่ายืนพัก · ฝั่งขวาสะท้อนจากซ้ายอัตโนมัติถ้าระบุ mirror
 * ส่วนที่ได้ยืด = กระดูกของหุ่น (skin weight) + ด้านหน้า/หลัง → ระดับ "บริเวณ" ไม่ใช่กล้ามเนื้อรายมัด
 * แก้ข้อมูลในไฟล์นี้แล้วรัน scripts/render-stretch-gifs.mjs เพื่อสร้าง GIF ใหม่ (StretchDemo แสดง GIF + ป้ายขั้นตอนตามเวลาเดียวกัน)
 * ⚠️ ต้นแบบ: ท่าทางจัดตามขั้นตอนใน CPG (ข้อความใน thaiMassageKnowledge) ยังไม่ได้ให้แพทย์แผนไทยตรวจท่า
 */
export type Vec3 = [number, number, number];
export type SegmentName = 'Belly' | 'Chest' | 'Neck' | 'CollarL' | 'CollarR' | 'UpperArmL' | 'ForearmL' | 'UpperArmR' | 'ForearmR';
export type Pose = Partial<Record<SegmentName, Vec3>> & {
  /** ทิศที่ฝ่ามือหัน (normal ของฝ่ามือ) — บิดปลายแขน/ข้อมือให้ตรง เช่น ประสานมือ = ฝ่ามือหันเข้าหากัน */
  palmL?: Vec3;
  palmR?: Vec3;
  /** งอนิ้วเข้าหาฝ่ามือ (องศาต่อข้อ · 3 ข้อ) เช่น ประสานมือ ~50 · กำมือ ~80 */
  curl?: number;
  /** กระดกข้อมือเข้าหาฝ่ามือ (องศา) */
  wrist?: number;
  /**
   * ประสานมือด้วย IK (แทนการกำหนดทิศแขน): ข้อมือทั้งสองมาอยู่ที่ at (เมตร จากกึ่งกลางไหล่)
   * ฝ่ามือแนบกัน ห่างแนวกลางคนละ gap · เยื้องมือซ้าย/ขวาสวนกันตาม stagger (ครึ่งช่องนิ้ว) ให้นิ้วสอดสลับกัน
   * pole = ทิศที่ศอกชี้ (ของแขนซ้าย · ขวาสะท้อนเอง)
   */
  hands?: { at: Vec3; pole: Vec3; gap?: number; stagger?: Vec3; /** ข้อมือแยกออกข้างละเท่านี้ (เมตร) เช่น วางมือบนศีรษะ */ spread?: number; rel?: Ref };
  /** วางมือแต่ละข้าง: ข้อมือไปที่ จุดอ้างอิง + at (เมตร) · ศอกชี้ตาม pole (ทิศโลก) */
  reach?: Partial<Record<'L' | 'R', { at: Vec3; rel?: Ref | 'hip' | 'knee' | 'ankle'; pole: Vec3 }>>;
  /** สะโพกยุบลง (เมตร · นั่ง/ย่อเข่า) และเลื่อนไปข้างหน้า */
  pelvisDrop?: number;
  pelvisFwd?: number;
  /** ขา: ข้อเท้าไปที่ ต้นขา + at หรือคงที่พื้นเดิม (plant) · เข่าชี้ตาม pole · foot = ทิศปลายเท้า */
  legs?: Partial<Record<'L' | 'R', { at?: Vec3; plant?: boolean; pole?: Vec3; foot?: Vec3 }>>;
  /** มือรายข้าง (ทับค่ารวม): งอนิ้ว · งอรายนิ้ว (องศา − = กางแอ่นไปหลัง) · กระดกข้อมือ · นิ้วโป้ง */
  curlL?: number;
  curlR?: number;
  fingersL?: Partial<Record<'Index' | 'Middle' | 'Ring' | 'Pinky', number>>;
  fingersR?: Partial<Record<'Index' | 'Middle' | 'Ring' | 'Pinky', number>>;
  wristL?: number;
  wristR?: number;
  thumbL?: number;
  thumbR?: number;
};
/** จุดอ้างอิงสำหรับวางมือ: กึ่งกลางไหล่ (ค่าเริ่มต้น) · ศีรษะ · อก · เชิงกราน */
type Ref = 'shoulder' | 'head' | 'chest' | 'pelvis';

export interface MotionKey {
  pose: Pose;
  /** เวลาเคลื่อนเข้าท่านี้ (ms) */
  move: number;
  /** ค้างท่า (ms) */
  hold: number;
  /** ขั้นตอนที่ตรงกับท่านี้ (index ของ stretch.steps) · ไม่ระบุ = ท่าพัก */
  step?: number;
  /** ช่วงที่ได้ยืดเต็มที่ → สีชัดขึ้น */
  peak?: boolean;
}

export interface BoneArea {
  bone: string;
  /** เฉพาะด้านหน้า/หลังของกระดูกนั้น (เช่น Chest ด้านหลัง = สะบัก) · notFront = บน+ข้าง+หลัง (เช่น บ่า) */
  side?: 'front' | 'back' | 'notFront';
}

export interface StretchMotion {
  /** ชื่อไฟล์ภาพ assets/stretch/<id>.gif (สร้างด้วย scripts/render-stretch-gifs.mjs) */
  id: string;
  keys: MotionKey[];
  /** มุมมอง (เรเดียน หมุนรอบแกนตั้ง) ให้เห็นส่วนที่ได้ยืดชัดที่สุด · 0 = หน้าตรง · π = หลังตรง */
  view: number;
  /** ตั้งกล้องเอง (ทับการจัดอัตโนมัติ) */
  camera?: { y: number; dist: number };
  /** ส่วนที่ได้ยืดหลัก (แดง) */
  primary: { label: string; areas: BoneArea[] };
  /** ส่วนที่ได้ช่วย (ส้ม) */
  assist?: { label: string; areas: BoneArea[] };
}

const mirror = (v: Vec3): Vec3 => [-v[0], v[1], v[2]];
/** ทิศของท่อนแขนซ้าย (+ ฝ่ามือ/นิ้ว) → สร้างคู่ขวาแบบสะท้อน (x กลับด้าน) */
const both = (upper: Vec3, fore: Vec3, hand?: { palm: Vec3; curl: number }): Pose => ({
  UpperArmL: upper,
  ForearmL: fore,
  UpperArmR: mirror(upper),
  ForearmR: mirror(fore),
  ...(hand ? { palmL: hand.palm, palmR: mirror(hand.palm), curl: hand.curl } : null),
});
/** ยกสะบัก/ไหปลาร้าตามแขน (คนจริงยกแขนสูง สะบักหมุนขึ้นด้วย ไม่งั้นหัวไหล่ยุบ) · ค่า = ทิศไหปลาร้าซ้าย */
const shrug = (c: Vec3): Pose => ({ CollarL: c, CollarR: mirror(c) });
/** ประสานมือ: ฝ่ามือแนบกัน นิ้วสอดสลับกันแล้วงอโอบหลังมืออีกข้าง (ไม่ใช่หลังมือชนกัน) */
const clasp = (at: Vec3, pole: Vec3, stagger: Vec3): Pose => ({ hands: { at, pole, gap: 0.02, stagger }, palmL: [-1, 0, 0], palmR: [1, 0, 0], curl: 60 });
/** เหยียดแขนตรงไปข้างหน้า มือประสาน (จุดมือไกลกว่าระยะแขน → แขนเหยียดสุด ไม่งอศอก) */
const CLASP_FRONT: Pose = { ...clasp([0, -0.03, 0.7], [1, -0.4, 0], [0, 0.005, 0]), ...shrug([0.98, 0.1, 0.12]) };
/** ชูแขนตรงเหนือศีรษะ แขนแนบหู มือประสาน + ยกสะบัก */
const CLASP_UP: Pose = { ...clasp([0, 0.75, 0.04], [1, 0, -0.2], [0, 0, 0.005]), ...shrug([0.92, 0.36, -0.05]) };
/** วางมือที่ประสานบนกลางศีรษะ: ข้อมือแยกข้าง ฝ่ามือคว่ำลงบนศีรษะ นิ้วสอดกันตรงกลาง ศอกกางออกข้าง */
const CLASP_HEAD: Pose = {
  hands: { at: [0, 0.43, 0], pole: [1, 0.2, -0.2], gap: 0, spread: 0.06, stagger: [0, 0, 0.005] },
  palmL: [-0.35, -1, 0],
  palmR: [0.35, -1, 0],
  wrist: 40,
  curl: 30,
  ...shrug([0.95, 0.25, -0.05]),
};
/** มือจับเอวด้านข้าง (ฝ่ามือแนบเอว ศอกกางออกข้าง-ไปหลังเล็กน้อย) */
const HANDS_ON_WAIST: Pose = { hands: { at: [0, -0.45, 0], pole: [1, 0, -0.5], gap: 0, spread: 0.17 }, palmL: [-1, 0, 0], palmR: [1, 0, 0], curl: 15 };
/** กำมือสองข้างชนกันแนบหลังเอว ศอกกางออกข้าง (ภาพต้นฉบับข้อ 4) */
const FISTS_BEHIND: Pose = { hands: { at: [0, -0.34, -0.2], pole: [1, 0.15, -0.1], gap: 0, spread: 0.06 }, palmL: [0, 0, 1], palmR: [0, 0, 1], curl: 85 };
/** ประสานมือระดับอก ศอกกางออกข้างแนวระดับ (ภาพต้นฉบับท่าแก้เกียจข้อ 1) */
const CLASP_CHEST: Pose = { hands: { at: [0, -0.12, 0.36], pole: [1, -0.1, -0.45], gap: 0.02, stagger: [0, 0.005, 0] }, palmL: [-1, 0, 0], palmR: [1, 0, 0], curl: 45 };
/** กางแขนเฉียงขึ้น (ตัว V) ฝ่ามือหันไปข้างหน้า (ภาพต้นฉบับท่าชูหัตถ์ข้อ 2) */
const ARMS_V: Pose = { ...both([0.62, 0.78, 0.05], [0.55, 0.83, 0.08], { palm: [0, 0, 1], curl: 0 }), ...shrug([0.95, 0.25, -0.05]) };
/** กางแขนออกข้างระดับไหล่ ฝ่ามือดันออก นิ้วชี้ขึ้น (ภาพต้นฉบับท่าชูหัตถ์ข้อ 3) */
const ARMS_SIDE_PUSH: Pose = { ...both([1, 0.05, 0.08], [1, 0.08, 0.1], { palm: [1, 0, 0.2], curl: 0 }), wrist: -55 };

/* ---------- ท่านั่ง/ขา (ตามภาพต้นฉบับ) ---------- */
/** นั่งขัดสมาธิ: สะโพกลงถึงพื้น ขาซ้ายพับไปใต้เข่าขวา */
const SIT_CROSS: Pose = {
  pelvisDrop: 0.85,
  legs: {
    L: { at: [-0.34, -0.06, 0.3], pole: [1, 0.3, 0.5], foot: [-0.5, 0, 0.8] },
    R: { at: [0.34, -0.03, 0.44], pole: [-1, 0.3, 0.5], foot: [0.5, 0, 0.8] },
  },
};
/** วางมือบนเข่า (ท่าพักตอนนั่ง) */
const HANDS_ON_KNEES: Pose = {
  reach: { L: { rel: 'knee', at: [0.02, 0.07, 0.02], pole: [1, 0, -0.4] }, R: { rel: 'knee', at: [-0.02, 0.07, 0.02], pole: [-1, 0, -0.4] } },
  palmL: [0, -1, 0],
  palmR: [0, -1, 0],
  curl: 20,
};
/** วางมือบนตัก/หน้าขาใกล้สะโพก (ท่าพักแบบครึ่งตัว: มือไม่ลงไปถึงเข่า) */
const HANDS_IN_LAP: Pose = {
  reach: { L: { rel: 'hip', at: [-0.02, 0.1, 0.22], pole: [1, -0.4, -0.4] }, R: { rel: 'hip', at: [0.02, 0.1, 0.22], pole: [-1, -0.4, -0.4] } },
  palmL: [0, -1, 0],
  palmR: [0, -1, 0],
  curl: 20,
};
/** นั่ง + ท่าแขน */
const sit = (p: Pose): Pose => ({ ...SIT_CROSS, ...p });
/** นั่งเหยียดขาทั้งสองไปข้างหน้า (ท่าแก้เข่าขัด) · toesUp = กระดกปลายเท้า */
const sitLong = (toesUp: boolean): Pose => ({
  pelvisDrop: 0.85,
  legs: {
    L: { at: [0.03, -0.04, 0.95], pole: [0, 1, 0], foot: toesUp ? [0, 0.95, 0.3] : [0, 0.55, 0.85] },
    R: { at: [-0.03, -0.04, 0.95], pole: [0, 1, 0], foot: toesUp ? [0, 0.95, 0.3] : [0, 0.55, 0.85] },
  },
});
/** นั่งเหยียดขาข้างหนึ่ง พับอีกข้าง (ท่ายิงธนู) · side = ขาที่เหยียด */
const sitArcher = (side: 'L' | 'R'): Pose => {
  const sg = side === 'L' ? 1 : -1;
  const ext = { at: [0.28 * sg, -0.04, 0.9] as Vec3, pole: [0, 1, 0] as Vec3, foot: [0.25 * sg, 0.9, 0.35] as Vec3 };
  const fold = { at: [0.3 * sg, -0.05, 0.3] as Vec3, pole: [-1 * sg, 0.35, 0.45] as Vec3, foot: [0.6 * sg, 0, 0.6] as Vec3 };
  return { pelvisDrop: 0.85, legs: side === 'L' ? { L: ext, R: fold } : { R: ext, L: fold } };
};
/** ท่ายิงธนู: แขนข้าง bow เหยียดออกข้าง (กำมือ) · อีกข้างดึงสายมาไว้ที่อก · ระยะ 0..1 */
const archerArms = (bow: 'L' | 'R', k: number): Pose => {
  const sg = bow === 'L' ? 1 : -1;
  const b = bow,
    s = bow === 'L' ? 'R' : 'L';
  return {
    reach: {
      [b]: { at: [sg * (0.05 + 0.73 * k), -0.12 + 0.1 * k, 0.24 - 0.12 * k], pole: [sg, -0.6, -0.3] },
      [s]: { at: [sg * (-0.05 - 0.15 * k), -0.12 + 0.02 * k, 0.24 - 0.1 * k], pole: [-sg, 0.1, -0.6] },
    },
    palmL: [0, -1, 0],
    palmR: [0, -1, 0],
    curl: 88,
    Neck: [sg * 0.15 * k, 1, 0.1],
  };
};
/** นั่งชันเข่า (ท่าอวดแหวนเพชร): เข่าขวาตั้ง ขาซ้ายพับราบ */
const SIT_KNEE_UP: Pose = {
  pelvisDrop: 0.8,
  legs: {
    R: { at: [-0.04, -0.12, 0.42], pole: [-0.1, 1, 0.3], foot: [0, 0, 1] },
    L: { at: [-0.3, -0.06, 0.25], pole: [1, 0.25, 0.5], foot: [-0.5, 0, 0.8] },
  },
};
/** ยืนกางขาเล็กน้อย (ท่าดำรงกายอายุยืน) · squat = ย่อเข่า (เท้าอยู่ที่เดิม) */
const standWide = (squat: number): Pose => ({
  pelvisDrop: squat,
  legs: {
    L: { at: [0.1, -0.93 + squat, 0], pole: [0.6, 0, 1], foot: [0.25, 0, 1] },
    R: { at: [-0.1, -0.93 + squat, 0], pole: [-0.6, 0, 1], foot: [-0.25, 0, 1] },
  },
  ...(squat ? { Belly: [0, 1, 0.12] as Vec3 } : null),
});
/** กำมือซ้อนกันหน้าอก มือซ้ายอยู่บนมือขวา ศอกกางออกข้าง */
const FISTS_STACKED: Pose = {
  reach: { L: { at: [0, -0.19, 0.27], pole: [1, -0.2, -0.3] }, R: { at: [0, -0.28, 0.27], pole: [-1, -0.2, -0.3] } },
  palmL: [-1, 0, 0],
  palmR: [1, 0, 0],
  curl: 88,
};
/** มือวางบนหน้าขา / เลื่อนลงหน้าแข้ง (ท่าแก้เข่าขัด) */
const handsOnThighs = (to: 'thigh' | 'shin'): Pose => ({
  reach:
    to === 'thigh'
      ? { L: { rel: 'hip', at: [0, 0.09, 0.3], pole: [1, -0.3, -0.5] }, R: { rel: 'hip', at: [0, 0.09, 0.3], pole: [-1, -0.3, -0.5] } }
      : { L: { rel: 'ankle', at: [0, 0.1, -0.22], pole: [1, 0.3, -0.2] }, R: { rel: 'ankle', at: [0, 0.1, -0.22], pole: [-1, 0.3, -0.2] } },
  palmL: [0, -1, 0],
  palmR: [0, -1, 0],
  curl: 35,
});
/** วางมือสองข้างบนใบหน้า/ศีรษะ (ท่านวดหน้า) · at = จุดของมือซ้าย เทียบฐานศีรษะ (ขวาสะท้อนเอง) */
const face = (at: Vec3, palm: Vec3, opt?: { curl?: number; pole?: Vec3; only?: 'L' | 'R'; atR?: Vec3 }): Pose => {
  const pole = opt?.pole ?? [1, -0.4, 0.2];
  const r: Pose['reach'] = {};
  if (opt?.only !== 'R') r.L = { rel: 'head', at, pole };
  if (opt?.only !== 'L') r.R = { rel: 'head', at: opt?.atR ?? mirror(at), pole: mirror(pole) };
  return { reach: r, palmL: palm, palmR: mirror(palm), curl: opt?.curl ?? 10 };
};

export const STRETCH_MOTION: Record<string, StretchMotion> = {
  // คอ บ่า ไหล่ (Office syndrome) · CPG: ประสานมือ → เหยียดแขนตรง → ยืดขึ้นเหนือศีรษะ → วางมือบนศีรษะ
  ท่าแก้เกียจ: {
    id: 'kae-kiat',
    // ด้านข้างเฉียงหลัง: เห็นแขนที่เหยียด/ยก (เห็นมือประสานด้านข้าง) + คอ บ่า สะบักด้านหลังที่ได้ยืด
    view: Math.PI - 1.15,
    // เอว → มือที่ชูเหนือศีรษะ (ขาไม่ได้ใช้)
    // ตามเอกสาร: ประสานมือ → เหยียดแขนตรง (มือประสานเหยียดออก) → ยืดขึ้นเหนือศีรษะ → วางมือที่ประสานบนศีรษะ
    keys: [
      // ยืนทำ (ท่านี้ใช้แค่แขน · เอกสารสาธิตท่านั่ง แต่ยืนหรือนั่งก็ได้)
      { pose: {}, move: 900, hold: 400 },
      { pose: CLASP_CHEST, move: 1000, hold: 700, step: 0 },
      { pose: CLASP_FRONT, move: 1000, hold: 1000, step: 1, peak: true },
      { pose: { ...CLASP_UP, Neck: [0, 1, 0.08] }, move: 1200, hold: 1500, step: 2, peak: true },
      { pose: CLASP_HEAD, move: 1100, hold: 1400, step: 3, peak: true },
      // คลายมือ ลดแขนลงทางข้าง (ไม่ลากมือผ่านหน้า) แล้ววนกลับท่าพัก
      { pose: both([1, 0.25, 0.1], [1, 0.35, 0.1]), move: 900, hold: 0 },
    ],
    primary: { label: 'คอ บ่า', areas: [{ bone: 'CollarL', side: 'notFront' }, { bone: 'CollarR', side: 'notFront' }, { bone: 'Neck', side: 'notFront' }] },
    assist: { label: 'ไหล่ สะบัก', areas: [{ bone: 'UpperArmL' }, { bone: 'UpperArmR' }, { bone: 'Chest', side: 'back' }] },
  },
  // หลัง/เอว (หมอนรองกระดูก) · CPG: ชูมือทางข้างขึ้นเหนือศีรษะ ประสานมือ → กางมือลงจับเอว → กำมือชนกันด้านหลังเอว
  ท่าชูหัตถ์วาดหลัง: {
    id: 'chu-hat-wat-lang',
    // ด้านหลังเฉียงข้าง: เห็นเอวด้านหลัง + มือที่กำชนกันหลังเอว + แขนที่ชู
    view: Math.PI - 1.0,
    // สะโพก (มือกำหลังเอว) → มือที่ชูเหนือศีรษะ
    // ตามเอกสาร: ชูมือทางข้างขึ้นเหนือศีรษะ ประสานมือ → กางแขนเฉียง (V) → กางออกข้างลำตัว → ลดลงจับเอว → กำมือชนกันหลังเอว
    keys: [
      { pose: sit(HANDS_IN_LAP), move: 900, hold: 400 },
      { pose: sit(both([1, 0.1, 0], [1, 0.15, 0])), move: 900, hold: 0, step: 0 },
      { pose: sit({ ...CLASP_UP, Chest: [0, 1, -0.1] }), move: 1000, hold: 1400, step: 0, peak: true },
      { pose: sit(ARMS_V), move: 900, hold: 500, step: 1 },
      { pose: sit(ARMS_SIDE_PUSH), move: 900, hold: 800, step: 1 },
      { pose: sit(HANDS_ON_WAIST), move: 1000, hold: 800, step: 1 },
      { pose: sit({ ...FISTS_BEHIND, Chest: [0, 1, 0.05] }), move: 1100, hold: 1500, step: 2, peak: true },
    ],
    primary: { label: 'หลังล่าง เอว', areas: [{ bone: 'Belly', side: 'back' }, { bone: 'Pelvis', side: 'back' }] },
    assist: { label: 'ไหล่ สะบัก', areas: [{ bone: 'Chest', side: 'back' }, { bone: 'UpperArmL' }, { bone: 'UpperArmR' }] },
  },
  // หัวไหล่ติด · เอกสาร: นั่งเหยียดขาซ้าย พับขาขวา มือทั้งสองทำท่าเหมือนยิงธนู แล้วสลับขาทำเช่นเดียวกัน
  ท่ายิงธนู: {
    id: 'ying-thanu',
    view: 0.55,
    keys: [
      { pose: { ...sitArcher('L'), ...HANDS_IN_LAP }, move: 900, hold: 500, step: 0 },
      { pose: { ...sitArcher('L'), ...archerArms('L', 0) }, move: 900, hold: 400, step: 1 },
      { pose: { ...sitArcher('L'), ...archerArms('L', 0.45) }, move: 700, hold: 300, step: 1 },
      { pose: { ...sitArcher('L'), ...archerArms('L', 1) }, move: 800, hold: 1400, step: 1, peak: true },
      { pose: { ...sitArcher('R'), ...archerArms('R', 0) }, move: 1300, hold: 400, step: 2 },
      { pose: { ...sitArcher('R'), ...archerArms('R', 0.45) }, move: 700, hold: 300, step: 2 },
      { pose: { ...sitArcher('R'), ...archerArms('R', 1) }, move: 800, hold: 1400, step: 2, peak: true },
    ],
    primary: { label: 'หัวไหล่', areas: [{ bone: 'UpperArmL' }, { bone: 'UpperArmR' }, { bone: 'CollarL' }, { bone: 'CollarR' }] },
    assist: { label: 'สะบัก แขน', areas: [{ bone: 'Chest', side: 'back' }, { bone: 'ForearmL' }, { bone: 'ForearmR' }] },
  },
  // นิ้วล็อก · เอกสาร: นั่งชันเข่า เหยียดแขนตรง กางฝ่ามือซ้ายขึ้น ใช้มือขวาดัดฝ่ามือซ้าย → กางมือซ้ายออก พับนิ้วลงทีละนิ้วจนครบ → หักข้อมือ แขนเหยียดขณะกำมือ → สลับข้าง
  ท่าอวดแหวนเพชร: {
    id: 'uad-waen-phet',
    view: 0.75,
    keys: [
      { pose: { ...SIT_KNEE_UP, reach: { L: { rel: 'hip', at: [-0.02, 0.1, 0.22], pole: [1, -0.4, -0.4] }, R: { rel: 'knee', at: [-0.02, 0.07, 0.02], pole: [-1, 0, -0.4] } }, palmL: [0, -1, 0], palmR: [0, -1, 0], curl: 20 }, move: 900, hold: 400, step: 0 },
      // มือขวาดัดฝ่ามือซ้าย (ฝ่ามือซ้ายหงาย นิ้วแอ่นไปหลัง)
      {
        pose: {
          ...SIT_KNEE_UP,
          reach: { L: { at: [0.1, -0.06, 0.7], pole: [1, -0.3, 0] }, R: { at: [0.06, -0.01, 0.76], pole: [-1, -0.2, 0] } },
          palmL: [0, 1, 0],
          palmR: [0, -1, 0.3],
          fingersL: { Index: -25, Middle: -25, Ring: -25, Pinky: -25 },
          wristL: -35,
          curlR: 45,
        },
        move: 1000,
        hold: 1300,
        step: 1,
        peak: true,
      },
      // กางมือซ้ายออก (ฝ่ามือดันไปหน้า) · มือขวาวางเข่า
      { pose: { ...SIT_KNEE_UP, reach: { L: { at: [0.16, 0.02, 0.72], pole: [1, -0.3, 0] }, R: { rel: 'knee', at: [-0.02, 0.07, 0.02], pole: [-1, 0, -0.4] } }, palmL: [0, 0, 1], palmR: [0, -1, 0], wristL: -60, curlR: 20 }, move: 900, hold: 500, step: 2 },
      ...(['Index', 'Middle', 'Ring', 'Pinky'] as const).map((_, i, arr) => ({
        pose: {
          ...SIT_KNEE_UP,
          reach: { L: { at: [0.16, 0.02, 0.72] as Vec3, pole: [1, -0.3, 0] as Vec3 }, R: { rel: 'knee' as const, at: [-0.02, 0.07, 0.02] as Vec3, pole: [-1, 0, -0.4] as Vec3 } },
          palmL: [0, 0, 1] as Vec3,
          palmR: [0, -1, 0] as Vec3,
          wristL: -60,
          curlR: 20,
          fingersL: Object.fromEntries(arr.map((n, j) => [n, j <= i ? 85 : 0])),
        },
        move: 450,
        hold: 250,
        step: 2,
      })),
      // หักข้อมือลง แขนเหยียดตรง กำมือ
      { pose: { ...SIT_KNEE_UP, reach: { L: { at: [0.16, -0.02, 0.74], pole: [1, -0.3, 0] }, R: { rel: 'knee', at: [-0.02, 0.07, 0.02], pole: [-1, 0, -0.4] } }, palmL: [0, -1, 0], palmR: [0, -1, 0], curlL: 88, thumbL: 45, wristL: 55, curlR: 20 }, move: 900, hold: 1300, step: 3, peak: true },
    ],
    primary: { label: 'นิ้ว ฝ่ามือ', areas: [{ bone: 'PalmL' }, { bone: 'Index1L' }, { bone: 'Middle1L' }, { bone: 'Ring1L' }, { bone: 'Pinky1L' }, { bone: 'Index2L' }, { bone: 'Middle2L' }, { bone: 'Ring2L' }, { bone: 'Pinky2L' }] },
    assist: { label: 'ข้อมือ แขน', areas: [{ bone: 'ForearmL' }] },
  },
  // ปวดสะโพกร้าวลงขา · เอกสาร: ยืน กำมือทั้งสองข้าง มือซ้ายอยู่บนมือขวา → ย่อเข่าลง แขม่วท้อง ขมิบก้น แล้วค่อย ๆ ยืดตัวกลับ ทำซ้ำ 3–5 รอบ
  ท่าดำรงกายอายุยืน: {
    id: 'damrong-kai',
    // หลังเฉียงข้าง: เห็นสะโพก/ก้นที่ได้ยืด + การย่อเข่า
    view: Math.PI - 0.9,
    keys: [
      { pose: standWide(0), move: 900, hold: 300 },
      { pose: { ...standWide(0), ...FISTS_STACKED }, move: 900, hold: 600, step: 0 },
      { pose: { ...standWide(0.3), ...FISTS_STACKED }, move: 1400, hold: 1500, step: 1, peak: true },
      { pose: { ...standWide(0), ...FISTS_STACKED }, move: 1400, hold: 400, step: 1 },
    ],
    primary: { label: 'สะโพก ก้น', areas: [{ bone: 'Pelvis', side: 'back' }, { bone: 'HipL', side: 'back' }, { bone: 'HipR', side: 'back' }] },
    assist: { label: 'ต้นขา', areas: [{ bone: 'HipL', side: 'front' }, { bone: 'HipR', side: 'front' }] },
  },
  // ปวดเข่า · เอกสาร: นั่งเหยียดขา มือวางหน้าขา → กระดกปลายเท้า บีบนวดต้นขาลงถึงหน้าแข้ง → แอ่นอก แหงนหน้าขึ้น ค้าง 10 วิ → นวดกลับขึ้นต้นขา
  ท่าแก้เข่าขัด: {
    id: 'kae-khao-khat',
    view: 1.2,
    keys: [
      { pose: { ...sitLong(false), ...handsOnThighs('thigh') }, move: 900, hold: 600, step: 0 },
      { pose: { ...sitLong(true), ...handsOnThighs('shin'), Belly: [0, 0.75, 0.66], Chest: [0, 0.55, 0.84], Neck: [0, 0.5, 0.87] }, move: 1600, hold: 900, step: 1, peak: true },
      // แอ่นอก แหงนหน้าขึ้น (มือเลื่อนมาที่เข่า ลำตัวกลับตั้ง)
      {
        pose: { ...sitLong(true), reach: { L: { rel: 'knee', at: [0, 0.08, 0.05], pole: [1, -0.2, -0.5] }, R: { rel: 'knee', at: [0, 0.08, 0.05], pole: [-1, -0.2, -0.5] } }, palmL: [0, -1, 0], palmR: [0, -1, 0], curl: 35, Belly: [0, 0.93, 0.36], Chest: [0, 0.99, -0.08], Neck: [0, 0.78, -0.62] },
        move: 1000,
        hold: 1600,
        step: 2,
        peak: true,
      },
      { pose: { ...sitLong(false), ...handsOnThighs('thigh') }, move: 1600, hold: 500, step: 3 },
    ],
    primary: { label: 'เข่า', areas: [{ bone: 'ShinL' }, { bone: 'ShinR' }] },
    assist: { label: 'ต้นขา', areas: [{ bone: 'HipL' }, { bone: 'HipR' }] },
  },
  // อัมพฤกษ์ อัมพาต (ฟื้นฟู) · เอกสาร: นวดกล้ามเนื้อใบหน้า 7 ท่า
  'ท่านวดกล้ามเนื้อใบหน้า 7 ท่า': {
    id: 'nuad-na',
    view: 0.35,
    keys: [
      { pose: {}, move: 800, hold: 200 },
      // จุด = ข้อมือ เทียบกระดูกศีรษะ (ศีรษะกว้าง ±0.106 · สูง −0.03..0.26 · หน้าสุด z 0.165 · มือยาว ~0.19)
      // 1 เสยผม: ปิดหน้า → ลูบขึ้นกลางศีรษะ → ท้ายทอย
      { pose: face([0.045, 0.0, 0.21], [0, 0, -1], { pole: [1, -1, 0.3] }), move: 800, hold: 250, step: 0, peak: true },
      { pose: face([0.05, 0.25, 0.13], [0, -1, 0], { pole: [1, 0.2, 0.3] }), move: 600, hold: 150, step: 0, peak: true },
      { pose: face([0.09, 0.22, -0.1], [0, -0.3, 1], { pole: [1, 0.4, 0.2] }), move: 600, hold: 250, step: 0, peak: true },
      // 2 ทาแป้ง: ข้างจมูก → หน้าผาก → แก้ม
      { pose: face([0.065, -0.06, 0.2], [-0.3, 0, -1], { pole: [1, -1, 0.3] }), move: 600, hold: 150, step: 1, peak: true },
      { pose: face([0.12, 0.15, 0.15], [-0.3, 0, -1], { pole: [1, 0.1, 0.1] }), move: 500, hold: 150, step: 1, peak: true },
      { pose: face([0.08, -0.06, 0.17], [-0.6, 0, -0.8], { pole: [1, -1, 0.2] }), move: 500, hold: 250, step: 1, peak: true },
      // 3 เช็ดปาก: มือขวาปิดปาก → ลูบไปหูซ้าย
      { pose: face([0, 0, 0], [0, 0, -1], { only: 'R', atR: [-0.1, -0.02, 0.18], pole: [1, -0.5, 0.3] }), move: 600, hold: 150, step: 2, peak: true },
      { pose: face([0, 0, 0], [0, 0, -1], { only: 'R', atR: [0.0, 0.05, 0.15], pole: [1, -0.2, 0.3] }), move: 600, hold: 250, step: 2, peak: true },
      // 4 เช็ดคาง: มือขวารองใต้คาง → ลูบไปหูซ้าย
      { pose: face([0, 0, 0], [0, 1, 0], { only: 'R', atR: [-0.1, -0.07, 0.12], pole: [1, -0.5, 0.3] }), move: 600, hold: 150, step: 3, peak: true },
      { pose: face([0, 0, 0], [0, 1, 0], { only: 'R', atR: [0.0, -0.05, 0.11], pole: [1, -0.2, 0.3] }), move: 600, hold: 250, step: 3, peak: true },
      // 5 กดใต้คาง: กำมือสองข้าง นิ้วโป้งดันใต้คาง
      { pose: face([0.045, -0.08, 0.16], [-1, 0.3, 0], { curl: 80, pole: [1, -1, 0] }), move: 700, hold: 400, step: 4, peak: true },
      // 6 ถูหน้าหูและหลังหู
      { pose: face([0.17, 0.03, 0.04], [-1, 0, 0], { pole: [1, -0.6, 0.2] }), move: 600, hold: 200, step: 5, peak: true },
      { pose: face([0.17, 0.03, -0.04], [-1, 0, 0], { pole: [1, -0.6, 0] }), move: 400, hold: 200, step: 5, peak: true },
      // 7 ตบท้ายทอย: ฝ่ามือปิดหู นิ้วชี้ไปท้ายทอย
      { pose: face([0.17, 0.1, 0.0], [-1, 0, 0], { pole: [1, 0.5, 0.6] }), move: 600, hold: 500, step: 6, peak: true },
    ],
    primary: { label: 'ใบหน้า', areas: [{ bone: 'Head', side: 'front' }] },
    assist: { label: 'ศีรษะ ท้ายทอย', areas: [{ bone: 'Head', side: 'back' }, { bone: 'Neck' }] },
  },
};
