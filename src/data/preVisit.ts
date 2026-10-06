/**
 * ประเมินก่อนนวด (ครั้งถัดไปของเรื่องที่รักษาอยู่) — ใช้ร่วมกันทั้งแบบฟอร์มและแชท
 * การประเมินของแต่ละครั้งมี 2 ครั้ง: ก่อนนวด (ที่นี่) · หลังนวด (แบบประเมินหลังนวด)
 *
 * งดนวดเฉพาะเกณฑ์ไม่รับเข้าการรักษาใน CPG_PCU หน้า 139:
 *   มีไข้ (2.4.2) · หลังอุบัติเหตุภายใน 48 ชม. (3.3) · อาการทางระบบประสาท ชา/อ่อนแรง (3.1)
 * ไม่ใช้ระดับปวดเป็นเกณฑ์ห้ามนวด (เอกสารไม่มีเกณฑ์ตัวเลข)
 */
import { FU_RISK, type TreatmentCase } from './homeFeed';

export interface PreVisitAnswer {
  pain: number;
  /** อาการหลังนวดครั้งก่อน (FU_ADVERSE) */
  adverse?: string;
  /** ข้อห้ามใหม่ก่อนนวด (FU_RISK) */
  risk?: string;
  red?: boolean;
}

/** ควรงดนวดครั้งนี้ไหม (ตามเกณฑ์ด้านบน) */
export const preVisitRed = (adverse?: string, risk?: string) => adverse === 'ชา/อ่อนแรง' || risk === 'มีไข้' || risk === FU_RISK[2];

/** สรุปผลประเมินก่อนนวด: สถานะ + ครั้งนี้จะรักษาอย่างไร (แผนเดิม ปรับตามอาการวันนี้ · ผู้ให้บริการยืนยันหน้างาน) */
export function preVisitSummary(tc: TreatmentCase, t: PreVisitAnswer, focus?: string) {
  const last = tc.visits[tc.visits.length - 1];
  // เทียบหลังนวดครั้งก่อน (ประเมินเองหลังนวด → ถ้าไม่มีใช้ของคลินิก)
  const prevAfter = last.selfPain ?? last.painAfter;
  const diff = t.pain - prevAfter;
  const red = !!t.red;
  // ข้อควรระวังจากสิ่งที่ผู้ใช้แจ้งเท่านั้น (อาการหลังนวด/ยาใหม่) — ปวดกลับมาไม่ใช่ข้อห้าม
  const caution = !red && ((!!t.adverse && t.adverse !== 'ไม่มี') || (!!t.risk && t.risk !== 'ไม่มี'));
  const status: 'red' | 'caution' | 'ok' = red ? 'red' : caution ? 'caution' : 'ok';
  const label = red ? 'ควรพบแพทย์ก่อนนวด' : caution ? 'นวดได้ มีข้อควรระวัง' : 'นวดได้ตามแผน';
  const plan = red
    ? ['งดนวดครั้งนี้ไว้ก่อน', 'แพทย์ตรวจอาการ แล้วคลินิกจะนัดใหม่ให้']
    : [
        `${tc.plan} · ${tc.areas.map((a) => a.label).join(' ')}`,
        ...(focus ? [`เน้น${focus}`] : []),
        ...(t.adverse === 'ระบม/ช้ำ' ? ['ลดแรงนวดบริเวณที่ระบม'] : []),
        // อาการไม่ดีขึ้นหลังรักษา → แพทย์ประเมินก่อน (CPG_PCU หน้า 139 ข้อ 4.5) · ยังนวดได้
        ...(t.adverse === 'ปวดมากขึ้น' ? ['แพทย์ประเมินก่อนเริ่มนวด'] : []),
        ...(t.risk === 'เริ่มยาใหม่' ? ['แจ้งชื่อยาใหม่กับผู้ให้บริการ'] : []),
      ];
  return { status, label, plan, prevAfter, diff };
}
