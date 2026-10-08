/**
 * นัดหนึ่งนัด "เป็นของเรื่องไหน" — ทุกหน้าที่เกี่ยวกับนัด (จอง · รายละเอียดนัด · เช็กอิน · หลังนวด) ส่งเป้าหมายนี้ต่อกัน
 * caseId = ใบการรักษา · draftId = ใบร่าง (ประเมินแล้ว) · ไม่ระบุ = นัดที่จองไว้ก่อนประเมิน (ยังไม่ผูกกับเรื่องไหน)
 * → ไม่เดาจาก "ใบที่เพิ่งประเมินล่าสุด" อีก (เคยทำให้นัด/การรับบริการไปลงผิดใบ)
 */
import { useJourney } from './JourneyContext';
import type { TreatmentCase } from '../data/homeFeed';
import { isoToLabel, labelToISO } from '../services/clinicBridge';

export type ApptTarget = { caseId?: string; draftId?: string; /** นัดเรื่องใหม่ที่ยังไม่ได้ประเมิน */ looseId?: string };

export interface ApptView {
  kind: 'case' | 'draft' | 'loose';
  target: ApptTarget;
  clinic: string;
  date: string;
  time: string;
  today: boolean;
  queue?: string;
  therapist: string;
  service: string;
  /** เรื่องที่นัด (ไม่มี = ยังไม่ได้เล่าอาการ) */
  topic?: string;
  visit: string;
  prep: string[];
  /** มีผลประเมินให้ผู้ให้บริการแล้ว */
  assessed: boolean;
  /** ผลประเมินให้พบแพทย์ก่อน */
  red: boolean;
  /** คำขอจองจากแอป ยังรอคลินิกยืนยัน (ยังเช็กอินไม่ได้) */
  pending: boolean;
  /** ที่คลินิกวันนี้ (cloud): เช็กอินแล้ว · ถึงคิว · กำลังรับบริการ */
  stage?: 'checked_in' | 'called' | 'in_service';
  /** เวลาที่คลินิกเริ่มรับบริการ (ISO) */
  startedAt?: string;
}

export const CASE_CLINIC_DEFAULT = 'คลินิกแพทย์แผนไทย สาขาสุขุมวิท';
/** สถานที่ของเรื่องที่รักษาอยู่ — นัดครั้งถัดไปต้องที่เดิม (ประวัติ/แผนการรักษาอยู่ที่นั่น) */
export const caseClinic = (c: Pick<TreatmentCase, 'clinic'>) => c.clinic || CASE_CLINIC_DEFAULT;

/**
 * บริการที่จองไว้ ไม่ตรงกับผลประเมิน (เช่น จองนวดเพื่อสุขภาพไว้ก่อนประเมิน แต่อาการต้องนวดเพื่อรักษา) → ข้อความเตือน · ตรง = null
 * นวดเพื่อสุขภาพ = หมอนวด (ไม่ใช่การรักษา) · ผลประเมินให้งดประคบ/อบ แต่จองแบบมีประคบ
 */
export function serviceMismatch(service: string | undefined, caution?: string): string | null {
  if (!service) return null;
  // นวดเพื่อการรักษา = "เพื่อการรักษา" / "ร่วมประคบ" · นอกนั้น (เพื่อสุขภาพ · นวดเท้า · ประคบอย่างเดียว) ไม่ใช่การนวดรักษา
  if (!/เพื่อการรักษา|ร่วมประคบ/.test(service)) return `จอง${service.split(' · ')[0]}ไว้ แต่อาการนี้ควรนวดเพื่อรักษากับแพทย์แผนไทย`;
  if (service.includes('ประคบ') && /ประคบ|อบ/.test(caution ?? '')) return 'จองแบบมีประคบไว้ แต่ผลประเมินให้งดประคบ/อบร้อน';
  return null;
}

/** นัดทุกนัดของผู้ใช้ (ใช้กันจองเวลาชนกัน) · key = เป้าหมายของนัดนั้น */
export function useAllAppointments() {
  const { cases, drafts, looseBookings } = useJourney();
  return [
    ...cases.filter((c) => c.appointment.date !== '-').map((c) => ({ key: `c:${c.id}`, topic: `รักษา${c.short}`, clinic: caseClinic(c), date: c.appointment.today ? 'วันนี้' : c.appointment.date, time: c.appointment.time })),
    ...drafts.filter((d) => d.booking).map((d) => ({ key: `d:${d.id}`, topic: d.title, clinic: d.booking!.clinic, date: d.booking!.date, time: d.booking!.time })),
    ...looseBookings.map((b) => ({ key: `l:${b.id}`, topic: b.course ? `คอร์ส${b.course.name}` : 'นัดเรื่องใหม่', clinic: b.clinic, date: b.date, time: b.time })),
  ];
}
const BASE_PREP = ['งดอาหารหนักก่อนนวด 30 นาที', 'ใส่เสื้อผ้าหลวมสบาย'];

/** นัดของเป้าหมาย (null = ไม่มีนัด) */
export function useAppointment(t?: ApptTarget | null): ApptView | null {
  const { cases, drafts, looseBookings } = useJourney();
  if (t?.caseId) {
    const tc = cases.find((c) => c.id === t.caseId);
    if (!tc || tc.appointment.date === '-') return null;
    const today = tc.appointment.today || tc.appointment.date === 'วันนี้';
    return {
      kind: 'case',
      target: { caseId: tc.id },
      clinic: caseClinic(tc),
      date: today ? 'วันนี้' : tc.appointment.date,
      time: tc.appointment.time,
      today,
      queue: today ? tc.appointment.queue : undefined,
      therapist: tc.therapist,
      service: tc.plan,
      topic: `รักษา${tc.short}`,
      visit: `ครั้งที่ ${Math.min(tc.course.total, tc.course.done + 1)} / ${tc.course.total}`,
      prep: tc.prep,
      assessed: true,
      red: false,
      pending: false,
      stage: today ? tc.appointment.stage : undefined,
      startedAt: today ? tc.appointment.startedAt : undefined,
    };
  }
  if (t?.draftId) {
    const d = drafts.find((x) => x.id === t.draftId);
    if (!d?.booking) return null;
    const b = d.booking;
    return {
      kind: 'draft',
      target: { draftId: d.id },
      clinic: b.clinic,
      date: b.date,
      time: b.time,
      today: b.date === 'วันนี้',
      queue: b.date === 'วันนี้' ? b.queue : undefined,
      therapist: b.therapist,
      service: b.service,
      topic: d.title,
      visit: 'ครั้งแรก',
      prep: [...(d.caution?.includes('ความดัน') || d.caution?.includes('อบ') ? ['วัดความดันก่อนนวด'] : []), ...BASE_PREP],
      assessed: true,
      red: d.red,
      pending: b.status === 'pending',
      stage: b.stage,
      startedAt: b.startedAt,
    };
  }
  // นัดเรื่องใหม่: ระบุ looseId · ไม่ระบุ = นัดแรก (มีนัดเดียว)
  const booking = t?.looseId ? looseBookings.find((b) => b.id === t.looseId) : looseBookings[0];
  if (!booking) return null;
  return {
    kind: 'loose',
    target: { looseId: booking.id },
    clinic: booking.clinic,
    date: booking.date,
    time: booking.time,
    today: booking.date === 'วันนี้',
    queue: booking.date === 'วันนี้' ? booking.queue : undefined,
    therapist: booking.therapist,
    service: booking.service,
    // นัดตามคอร์สที่คลินิกลงให้
    topic: booking.course ? `คอร์ส${booking.course.name}` : undefined,
    visit: booking.course ? `ครั้งที่ ${booking.course.no} / ${booking.course.total}` : 'ครั้งแรก',
    prep: BASE_PREP,
    assessed: !!booking.course,
    red: false,
    pending: booking.status === 'pending',
    stage: booking.stage,
    startedAt: booking.startedAt,
  };
}

/**
 * แก้ผลประเมินได้ถึงเมื่อไหร่ — ผู้ให้บริการใช้ผลล่าสุดก่อนเช็กอิน
 * null = แก้ได้ (ยังไม่ถึงคลินิก) · checked_in = ล็อก แจ้งอาการเพิ่มได้ · in_service = ล็อกทั้งหมด (แจ้งผู้ให้บริการโดยตรง) · done = นวดแล้ว เป็นบันทึก
 */
export type AssessLock = null | 'checked_in' | 'in_service' | 'done';
export function assessLock(appt?: { stage?: 'checked_in' | 'called' | 'in_service'; queue?: string } | null, served?: boolean): AssessLock {
  if (served) return 'done';
  if (!appt) return null;
  if (appt.stage === 'called' || appt.stage === 'in_service') return 'in_service';
  if (appt.stage === 'checked_in' || appt.queue) return 'checked_in';
  return null;
}
/** ข้อความบอกผู้ใช้ว่าทำไมแก้ไม่ได้ */
export const ASSESS_LOCK_TEXT: Record<Exclude<AssessLock, null>, string> = {
  checked_in: 'เช็กอินแล้ว ผู้ให้บริการได้รับผลประเมินแล้วค่ะ ถ้าอาการเปลี่ยน แจ้งอาการเพิ่มได้',
  in_service: 'กำลังรับบริการอยู่ค่ะ มีอาการเพิ่ม แจ้งผู้ให้บริการได้โดยตรง',
  done: 'ผลประเมินครั้งนี้ใช้ในการนวดแล้ว เก็บเป็นบันทึกค่ะ ถ้ามีอาการใหม่ ประเมินเรื่องใหม่ได้',
};

/** ประเมินก่อนนวดเปิดให้ทำได้กี่วันก่อนนัด (เร็วกว่านี้ อาการอาจไม่ตรงกับวันที่มานวด) */
export const PREVISIT_OPEN_DAYS = 1;
const dayDiff = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d).getTime() - t.getTime()) / 86400000);
};
/** ประเมินก่อนนวดของนัดนี้ยังไม่เปิด → ป้ายวันที่เปิด ("พรุ่งนี้" / "พฤ. 9 ต.ค.") · เปิดแล้ว = null */
export function preVisitOpensOn(dateLabel: string): string | null {
  if (!dateLabel || dateLabel === '-') return null;
  const iso = labelToISO(dateLabel);
  if (dayDiff(iso) <= PREVISIT_OPEN_DAYS) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const open = new Date(y, m - 1, d - PREVISIT_OPEN_DAYS);
  return isoToLabel(`${open.getFullYear()}-${String(open.getMonth() + 1).padStart(2, '0')}-${String(open.getDate()).padStart(2, '0')}`);
}

/**
 * นัดครั้งแรก: ประเมินไว้ก่อนช่วงเปิด (เช่น ประเมินวันนี้ แต่นัดสัปดาห์หน้า) → ถึงช่วงก่อนนัดต้องยืนยันอาการสั้น ๆ อีกครั้ง
 * ประเมิน/ยืนยันภายในช่วงแล้ว = ไม่ต้อง · ไม่รู้วันที่ประเมิน (ข้อมูลเก่า) = ไม่บังคับ
 */
export function needsConfirm(dateLabel: string | undefined, assessedOn?: string, confirmedOn?: string): boolean {
  if (!dateLabel || dateLabel === '-' || !assessedOn) return false;
  if (preVisitOpensOn(dateLabel)) return false;
  const [y, m, d] = labelToISO(dateLabel).split('-').map(Number);
  const o = new Date(y, m - 1, d - PREVISIT_OPEN_DAYS);
  const openISO = `${o.getFullYear()}-${String(o.getMonth() + 1).padStart(2, '0')}-${String(o.getDate()).padStart(2, '0')}`;
  return assessedOn < openISO && !(confirmedOn && confirmedOn >= openISO);
}
