/**
 * เนื้อหาหน้าแรก (Figma node 2:597) — ค่าตัวอย่างของผู้ใช้หนึ่งคน
 * ธาตุเจ้าเรือนมาจาก ElementQuiz (JourneyContext.elements) · อาการ/จุดกดมาจาก AI + Knowledge Base
 */
import type { BodyPin } from '../design-system/components/Body3D';

export const HOME_CONTENT = {
  symptoms: ['ปวดคอ', 'ปวดหลัง', 'ปวดไหล่'],
  related: ['ปวดศีรษะ', 'ตึง บ่า ไหล่', 'คัดจมูกซ้าย', 'ตาพร่ามัว'],
  points: ['จุดขมับซ้าย', 'จุดต้นคอ', 'จุดท้ายทอยข้างซ้าย'],
};

/**
 * ตำแหน่งที่ปวดทั้งร่างกาย — จัดกลุ่มตามส่วนของร่างกาย
 * ครอบคลุมกลุ่มอาการที่ CPG แนวทางเวชปฏิบัติแพทย์แผนไทย (PCU) และตำราอ้างอิงฯ ชุดที่ 4 (การนวด) ใช้นวดดูแล
 * เช่น ลมปลายปัตฆาต คอ บ่า ไหล่ สะบัก หลัง เอว สะโพก เข่า (จับโปง) ข้อเท้า ส้นเท้า นิ้ว/มือชา ปวดศีรษะ (ลมปะกัง)
 * ชื่อซ้าย/ขวา = ของผู้ป่วย · ชื่อตรงกับชื่อที่ได้จากการแตะหุ่น (ปวด + ชื่อส่วน) จะได้เป็น chip เดียวกัน
 */
export const SYMPTOM_GROUPS: { title: string; items: [string, BodyPin[]][] }[] = [
  {
    title: 'ศีรษะ คอ',
    items: [
      ['ปวดศีรษะ', ['head']],
      ['ปวดขมับซ้าย', ['templeLeft']],
      ['ปวดขมับขวา', ['templeRight']],
      ['ปวดท้ายทอย', ['occiputLeft', 'occiputRight']],
      ['ปวดกราม', ['jaw']],
      ['ปวดคอ', ['neck']],
      ['ปวดต้นคอ', ['neckBack']],
    ],
  },
  {
    title: 'บ่า ไหล่ สะบัก',
    items: [
      ['ปวดบ่า', ['trapLeft', 'trapRight']],
      ['ปวดไหล่ซ้าย', ['shoulderLeft']],
      ['ปวดไหล่ขวา', ['shoulderRight']],
      ['ปวดสะบักซ้าย', ['scapulaLeft']],
      ['ปวดสะบักขวา', ['scapulaRight']],
    ],
  },
  {
    title: 'ลำตัว',
    items: [
      ['ปวดหลังส่วนบน', ['back']],
      ['ปวดเอว', ['lowerBack']],
      ['ปวดชายโครงซ้าย', ['ribLeft']],
      ['ปวดชายโครงขวา', ['ribRight']],
      ['ปวดท้อง', ['belly']],
      ['ปวดสะโพกซ้าย', ['hipLeft']],
      ['ปวดสะโพกขวา', ['hipRight']],
    ],
  },
  {
    title: 'แขน มือ',
    items: [
      ['ปวดแขนซ้าย', ['armLeft']],
      ['ปวดแขนขวา', ['armRight']],
      ['ปวดข้อศอกซ้าย', ['elbowLeft']],
      ['ปวดข้อศอกขวา', ['elbowRight']],
      ['ปวดข้อมือซ้าย', ['wristLeft']],
      ['ปวดข้อมือขวา', ['wristRight']],
      ['ปวดมือซ้าย', ['handLeft']],
      ['ปวดมือขวา', ['handRight']],
    ],
  },
  {
    title: 'ขา เท้า',
    items: [
      ['ปวดต้นขาซ้าย', ['thighLeft']],
      ['ปวดต้นขาขวา', ['thighRight']],
      ['ปวดเข่าซ้าย', ['kneeLeft']],
      ['ปวดเข่าขวา', ['kneeRight']],
      ['ปวดขาซ้าย', ['shinLeft']],
      ['ปวดขาขวา', ['shinRight']],
      ['ปวดน่องซ้าย', ['calfLeft']],
      ['ปวดน่องขวา', ['calfRight']],
      ['ปวดข้อเท้าซ้าย', ['ankleLeft']],
      ['ปวดข้อเท้าขวา', ['ankleRight']],
      ['ปวดส้นเท้า', ['heelLeft', 'heelRight']],
      ['ปวดเท้าซ้าย', ['footLeft']],
      ['ปวดเท้าขวา', ['footRight']],
    ],
  },
];
/** ทุกตำแหน่ง (ให้ AI เลือกจากข้อความที่พิมพ์) */
export const ALL_SYMPTOMS = [...new Set([...HOME_CONTENT.symptoms, ...SYMPTOM_GROUPS.flatMap((g) => g.items.map(([l]) => l))])];

/** ตำแหน่งหมุดบนหุ่น 3D ของแต่ละ chip */
export const CHIP_PINS: Record<string, BodyPin[]> = {
  ...Object.fromEntries(SYMPTOM_GROUPS.flatMap((g) => g.items)),
  ปวดคอ: ['neck'],
  ปวดหลัง: ['back', 'lowerBack'],
  ปวดไหล่: ['shoulderLeft', 'shoulderRight'],
  ปวดศีรษะ: ['head'],
  คัดจมูกซ้าย: ['noseLeft'],
  ตาพร่ามัว: ['eyeLeft', 'eyeRight'],
  'ตึง บ่า ไหล่': ['trapLeft', 'trapRight', 'shoulderLeft', 'shoulderRight'],
  จุดขมับซ้าย: ['templeLeft'],
  จุดต้นคอ: ['neckBack'],
  จุดท้ายทอยข้างซ้าย: ['occiputLeft'],
};

