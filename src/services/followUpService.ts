/**
 * Follow-up Service — ส่งผลติดตามอาการหลังการรักษา (Pain Score ก่อน/หลัง แยกตามบริเวณ) ไปหลังบ้าน
 * ผู้ให้บริการเห็นในหน้า "คิววันนี้" → ติดตามผลหลังรักษา · ใช้คำนวณ KPI "ตอบ Follow-up" / "มี Before/After"
 *
 * ⚠️ ตอนนี้เป็น mock (หน่วงเวลาเหมือนเรียก API จริง) — เชื่อมระบบจริงให้แก้ที่ FOLLOW_UP_ENDPOINT + submitFollowUp ที่เดียว
 *    รูปแบบ payload ตรงกับที่ API ควรรับ: POST /follow-ups
 */

export const FOLLOW_UP_ENDPOINT = '/api/v1/follow-ups';

/** คะแนนของบริเวณหนึ่ง */
export interface FollowUpAreaScore {
  /** บริเวณที่รักษา (ไทย) */
  area: string;
  /** คะแนนปวดก่อนรักษา (จากคลินิก) */
  painBefore: number;
  /** คะแนนปวดตอนนี้ที่ผู้ใช้ให้ (หลังรักษา) */
  painAfter: number;
}

export interface FollowUpPayload {
  /** HN ผู้รับบริการ */
  hn: string;
  /** รหัสครั้งการรักษาที่ติดตาม */
  sessionId: string;
  /** วันที่รักษา (แสดงผล) */
  sessionDate: string;
  /** คะแนนแยกตามบริเวณ (ส่งเฉพาะบริเวณที่ผู้ใช้ให้คะแนน — ไม่บังคับครบ) */
  areas: FollowUpAreaScore[];
  /** ช่องทางที่ส่ง */
  channel: 'home-body-map';
}

export interface FollowUpRecord extends FollowUpPayload {
  id: string;
  /** เวลาที่หลังบ้านรับ (ISO) */
  receivedAt: string;
  /** สถานะฝั่งผู้ให้บริการ: ต้องติดต่อกลับเมื่อมีบริเวณใดไม่ดีขึ้นหรือปวด ≥ 7 */
  triage: 'ok' | 'review';
}

/** บริเวณนี้ควรให้ผู้ให้บริการติดต่อกลับไหม */
export const needsReview = (a: FollowUpAreaScore) => a.painAfter >= a.painBefore || a.painAfter >= 7;

/** ส่งผลติดตามอาการ → คืน record ที่หลังบ้านบันทึกแล้ว (throw เมื่อส่งไม่สำเร็จ) */
export async function submitFollowUp(payload: FollowUpPayload): Promise<FollowUpRecord> {
  if (!payload.areas.length) throw new Error('ต้องให้คะแนนอย่างน้อย 1 บริเวณ');
  if (payload.areas.some((a) => a.painAfter < 0 || a.painAfter > 10)) throw new Error('คะแนนต้องอยู่ระหว่าง 0–10');
  // mock network round-trip
  await new Promise((r) => setTimeout(r, 700));
  return {
    ...payload,
    id: `fu_${Date.now()}`,
    receivedAt: new Date().toISOString(),
    triage: payload.areas.some(needsReview) ? 'review' : 'ok',
  };
}
