/**
 * จองนัดกับ AI — ข้อมูลตารางผู้ให้บริการ + วิเคราะห์ความเร่งด่วน
 * ------------------------------------------------------------------
 * ความเร่งด่วนคิดด้วยกฎตายตัวจากผลประเมิน (ไม่ให้ AI เดา เพราะเกี่ยวกับความปลอดภัย) — AI แค่อธิบายผล
 *   ควรนวดภายใน 2 วัน: ปวด ≥ 7 · มีข้อควรระวังจากผลคัดกรอง · ปวดร้าว
 *   ภายใน 7 วัน: ปวด 4–6 · เพิ่งเป็น (ไม่เกิน 1 สัปดาห์)
 *   ไม่เร่ง: ปวดน้อย เป็นมานาน (เรื้อรังคงที่)
 *   ผลคัดกรองให้พบแพทย์ก่อน → ไม่จองนวด (จัดการที่แชท)
 * ⚠️ ต้นแบบ: ตารางผู้ให้บริการเป็นข้อมูลตัวอย่าง · เกณฑ์ความเร่งด่วนยังไม่ได้ให้แพทย์แผนไทยตรวจ
 */

/** ประเภทบริการ (ตรงกับ SERVICES ในหน้าจอง) */
export type ServiceId = 'royal' | 'royal+compress' | 'relax';
export const SERVICE_SHORT: Record<ServiceId, string> = { royal: 'นวดราชสำนัก', 'royal+compress': 'นวด + ประคบ', relax: 'ผ่อนคลาย' };

/** ช่วงเวลาที่ผู้ให้บริการลงตารางไว้ + บริการที่รับในช่วงนั้น (แบบ shift.services ของหลังบ้าน ThaiWellAI) */
export interface FreeSlot {
  /** offset วันจากวันนี้ */
  day: number;
  time: string;
  services: ServiceId[];
}

export interface Therapist {
  id: string;
  name: string;
  /** แพทย์แผนไทย = นวดเพื่อรักษาได้ (health profile 2568 หน้า 34) · หมอนวด = ผ่อนคลาย/ดูแลทั่วไป */
  role: 'แพทย์แผนไทย' | 'หมอนวด';
  /** ช่วงว่างที่ลงตารางไว้ (แต่ละช่วงรับบริการต่างกันได้) */
  free: FreeSlot[];
  /** ข้อมูลแนะนำตัว (ตัวอย่าง) — ใช้เลือกผู้ให้บริการ */
  sex?: 'ชาย' | 'หญิง';
  years?: number;
  /** ดูแลเรื่องไหนเป็นพิเศษ */
  focus?: string[];
}

const R: ServiceId = 'royal';
const RC: ServiceId = 'royal+compress';
const X: ServiceId = 'relax';

/** ตารางผู้ให้บริการแต่ละสถานที่ (id ตรงกับ PLACES) · แพทย์ลงเองว่าช่วงไหนรับบริการอะไร */
export const THERAPIST_SCHEDULE: Record<string, Therapist[]> = {
  skv: [
    { id: 'malee', name: 'พท.ป. มาลี ใจดี', role: 'แพทย์แผนไทย', sex: 'หญิง', years: 8, focus: ['คอ บ่า ไหล่', 'ออฟฟิศซินโดรม'], free: [{ day: 0, time: '15:30', services: [R, RC] }, { day: 1, time: '13:00', services: [R] }, { day: 1, time: '15:00', services: [RC] }, { day: 3, time: '10:30', services: [R, X] }] },
    { id: 'anan', name: 'พท.ป. อนันต์ สุขใจ', role: 'แพทย์แผนไทย', sex: 'ชาย', years: 12, focus: ['ปวดหลัง', 'ข้อเข่า'], free: [{ day: 0, time: '17:00', services: [RC] }, { day: 2, time: '09:00', services: [R, RC] }, { day: 4, time: '14:00', services: [R] }] },
    { id: 'somjai', name: 'คุณสมใจ รักษ์ไทย', role: 'หมอนวด', sex: 'หญิง', years: 5, focus: ['นวดผ่อนคลาย'], free: [{ day: 0, time: '13:00', services: [X] }, { day: 1, time: '17:00', services: [X] }, { day: 2, time: '10:30', services: [X] }] },
  ],
  ari: [
    { id: 'pim', name: 'พท.ป. พิมพ์ชนก แสงดี', role: 'แพทย์แผนไทย', sex: 'หญิง', years: 6, focus: ['ไหล่ติด', 'นิ้วล็อก'], free: [{ day: 1, time: '10:30', services: [R, RC] }, { day: 3, time: '13:00', services: [X] }, { day: 5, time: '13:00', services: [R] }] },
    { id: 'chai', name: 'คุณชัย มือเบา', role: 'หมอนวด', sex: 'ชาย', years: 4, focus: ['นวดผ่อนคลาย'], free: [{ day: 0, time: '17:00', services: [X] }, { day: 2, time: '15:00', services: [X] }] },
  ],
  // ร้านนวดทั่วไป: ไม่มีแพทย์แผนไทย → รับเฉพาะนวดผ่อนคลาย
  spa: [
    { id: 'noi', name: 'คุณน้อย ใจเย็น', role: 'หมอนวด', sex: 'หญิง', years: 9, focus: ['นวดผ่อนคลาย', 'นวดเท้า'], free: [{ day: 0, time: '14:00', services: [X] }, { day: 1, time: '11:00', services: [X] }] },
  ],
};

/** ช่วงว่างของผู้ให้บริการที่รับบริการนั้น (ไม่ระบุบริการ = ทุกช่วง) เรียงตามเวลา */
export const freeFor = (t: Therapist, service?: ServiceId | null) =>
  t.free.filter((f) => !service || f.services.includes(service)).sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));

const WEEKDAY = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
/** offset วัน → ป้ายวัน (วันนี้ / พรุ่งนี้ / ศ. 9 ต.ค.) */
export const dayLabel = (offset: number) => {
  if (offset === 0) return 'วันนี้';
  if (offset === 1) return 'พรุ่งนี้';
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${WEEKDAY[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]}`;
};

export interface Urgency {
  /** ควรนวดภายในกี่วัน (null = ไม่เร่ง) */
  withinDays: number | null;
  label: string;
  reason: string;
}

export function urgencyOf(a: { pain: number; duration?: string; radiate?: string }, safety: 'green' | 'amber' | 'red'): Urgency {
  const radiating = !!a.radiate && a.radiate !== 'ไม่ร้าว';
  if (a.pain >= 7 || safety === 'amber' || radiating) {
    const why = [a.pain >= 7 ? `ปวด ${a.pain}/10` : '', radiating ? 'มีอาการร้าว' : '', safety === 'amber' ? 'มีข้อควรระวัง' : ''].filter(Boolean).join(' ');
    return { withinDays: 2, label: 'ควรนวดภายใน 2 วัน', reason: why };
  }
  const recent = !!a.duration && /วันนี้|2–3 วัน|1 สัปดาห์/.test(a.duration);
  if (a.pain >= 4 || recent) return { withinDays: 7, label: 'ควรนวดภายในสัปดาห์นี้', reason: [a.pain >= 4 ? `ปวด ${a.pain}/10` : '', recent ? 'เพิ่งเป็น' : ''].filter(Boolean).join(' ') };
  return { withinDays: null, label: 'นัดวันที่สะดวกได้เลย', reason: 'อาการไม่รุนแรง' };
}

/** ผู้ให้บริการของสถานที่ เรียง: แพทย์แผนไทยก่อน (นวดเพื่อรักษา) → ว่างเร็วสุด */
/** service = เฉพาะคนที่ลงตารางรับบริการนั้นไว้ (และ free เหลือเฉพาะช่วงที่รับบริการนั้น) */
export function therapistsAt(placeId: string, service?: ServiceId | null) {
  return (THERAPIST_SCHEDULE[placeId] ?? [])
    .map((t) => ({ ...t, free: freeFor(t, service) }))
    .filter((t) => !service || t.free.length)
    .sort((a, b) => (a.role === b.role ? Math.min(...a.free.map((f) => f.day)) - Math.min(...b.free.map((f) => f.day)) : a.role === 'แพทย์แผนไทย' ? -1 : 1));
}

/** ไม่ระบุแพทย์: รวมช่วงว่างของทุกคนที่รับบริการนั้น (เวลาซ้ำกันนับครั้งเดียว) · who = คนที่ว่างช่วงนั้น เรียงแพทย์แผนไทยก่อน */
export function anyoneSlots(placeId: string, service?: ServiceId | null) {
  const map = new Map<string, FreeSlot & { who: Therapist[] }>();
  for (const t of therapistsAt(placeId, service))
    for (const f of t.free) {
      const k = `${f.day}|${f.time}`;
      const cur = map.get(k);
      if (cur) cur.who.push(t);
      else map.set(k, { ...f, who: [t] });
    }
  return [...map.values()].sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
}

/** เวลาว่างของผู้ให้บริการ เป็นป้าย "พรุ่งนี้ 13:00" · ช่องแรกที่ทันตามความเร่งด่วน = แนะนำ */
export function slotsOf(t: Therapist, u: Urgency) {
  const sorted = [...t.free].sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
  const inTime = sorted.filter((f) => u.withinDays === null || f.day <= u.withinDays);
  return { labels: sorted.map((f) => `${dayLabel(f.day)} ${f.time}`), recommended: inTime[0] ? `${dayLabel(inTime[0].day)} ${inTime[0].time}` : null };
}
