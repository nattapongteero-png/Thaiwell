/**
 * นัดหนึ่งนัด "เป็นของเรื่องไหน" — ทุกหน้าที่เกี่ยวกับนัด (จอง · รายละเอียดนัด · เช็กอิน · หลังนวด) ส่งเป้าหมายนี้ต่อกัน
 * caseId = ใบการรักษา · draftId = ใบร่าง (ประเมินแล้ว) · ไม่ระบุ = นัดที่จองไว้ก่อนประเมิน (ยังไม่ผูกกับเรื่องไหน)
 * → ไม่เดาจาก "ใบที่เพิ่งประเมินล่าสุด" อีก (เคยทำให้นัด/การรับบริการไปลงผิดใบ)
 */
import { useJourney } from './JourneyContext';
import type { TreatmentCase } from '../data/homeFeed';

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
    ...looseBookings.map((b) => ({ key: `l:${b.id}`, topic: 'นัดเรื่องใหม่', clinic: b.clinic, date: b.date, time: b.time })),
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
    visit: 'ครั้งแรก',
    prep: BASE_PREP,
    assessed: false,
    red: false,
    pending: booking.status === 'pending',
  };
}
