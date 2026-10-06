/**
 * JOURNEY STATE — ข้อมูลที่ไหลต่อเนื่องตลอด Digital Thai Wellness Journey
 * (Pre-screen → Safety → Care Suggestion → Service Record → Follow-up)
 * Prototype เก็บใน memory; production = Health Profile / Wellness Encounter / Outcome / Consent / Audit (Data Layer)
 */
import { CHIP_PINS } from '../data/homeContent';
import { guideFor } from '../data/treatmentGuides';
import { TREATMENT_CASES, type TreatmentCase } from '../data/homeFeed';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { RegionId } from '../design-system/components/BodyMap';
import type { ElementKey } from '../data/thaiMassageKnowledge';
import { evaluateSafety, type HealthProfile, type SafetyResult } from '../services/safetyEngine';
import { submitFollowUp, type FollowUpPayload, type FollowUpRecord } from '../services/followUpService';
import { noticeOf, notify, setupNotifications } from '../services/notify';
import { birthToISO, clinicOnline, clinicTherapistId, isCloud, isoToLabel, labelToISO, listenClinic, sendBooking, sendCancel, sendCheckIn, sendNote, sendPayment, serviceCodeOf, todayISO, type ClinicEvent, type ClinicPatient, type ClinicRequest } from '../services/clinicBridge';

export interface Assessment {
  pain: number;
  stiffness: number;
  mobility: number; // 1–5
  stress: number; // 1–5
  sleep: number; // 1–5
}

export interface ServiceRecord {
  planId?: string;
  regions: string[];
  techniques: string[];
  pressure: string;
  duration: number;
  notes: string;
  provider: string;
}

export interface AuditEntry {
  at: string;
  actor: string;
  action: string;
}

export interface Consents {
  service: boolean; // จำเป็น
  aiProcessing: boolean; // จำเป็นสำหรับ AI Interview
  followUp: boolean;
  research: boolean; // ไม่บังคับ (ข้อมูลไม่ระบุตัวตน)
}

const baseProfile: HealthProfile = {
  age: 34,
  conditions: ['ความดันโลหิตสูง'],
  medications: ['Amlodipine 5 mg'],
  allergies: [],
  pregnant: false,
  surgeryWithin1Month: false,
  injuryWithin48h: false,
  bp: { sys: 148, dia: 92 },
  bpSymptoms: false,
  temperature: 36.6,
  pulse: 78,
  flags: { dvt: false, openWoundOrSkinInfection: false, unhealedFracture: false, cancerSite: false, acuteInfection: false },
  symptoms: { suddenNumbnessOrWeakness: false, slurredSpeechOrFacialDroop: false, chestTightOrBreathless: false, unilateralCalfSwelling: false },
};

const redFlagProfile: HealthProfile = {
  ...baseProfile,
  bp: { sys: 186, dia: 112 },
  symptoms: { ...baseProfile.symptoms, suddenNumbnessOrWeakness: true },
};

export type Scenario = 'caution' | 'redflag';

/** คนไข้ใหม่เดินไปถึงขั้นไหน: ยังไม่ทำอะไร → ประเมินกับ AI แล้ว → จองแล้ว → รับบริการแล้ว (ติดตามผล) */
export type CareStage = 'new' | 'assessed' | 'booked' | 'served';
/** นัดที่จอง */
export interface Booking {
  date: string;
  time: string;
  service: string;
  therapist: string;
  clinic: string;
  /** เลขคิว (ออกเฉพาะนัดวันนี้) */
  queue?: string;
  /** ครั้งที่เท่าไหร่ของคอร์ส */
  visit: number;
  /** จองจากแอป = คำขอจอง รอเจ้าหน้าที่คลินิกยืนยัน (หลังบ้าน: คำขอจองคิว) · ไม่ระบุ = ยืนยันแล้ว */
  status?: 'pending' | 'confirmed';
}
export type LooseBooking = Booking & { id: string };
/** สรุปจากการประเมินกับ AI (ใช้ต่อในหน้าจอง / หน้าแรก / ผู้ให้บริการ) */
export interface AssessSummary {
  symptoms: string[];
  pain: number;
  cause?: string;
  caution?: string;
  red: boolean;
}

/**
 * ใบร่าง — เกิดจากการประเมินกับ AI (ยังไม่มีการรักษา) · ใช้ช่อง bento เดียวกับใบการรักษา
 * ประเมินซ้ำเรื่องเดิม = อัปเดตใบเดิม · อาการใหม่ = ใบใหม่ · นวดครั้งแรกแล้ว ผู้ให้บริการตั้งชื่อโรค → ใบจริง
 */
export interface DraftCase {
  id: string;
  /** ชื่อแท็บ = อาการที่เล่า */
  title: string;
  symptoms: string[];
  pain: number;
  /** คะแนนจากการประเมินครั้งก่อน (ประเมินซ้ำเรื่องเดิม) */
  prevPain?: number;
  duration?: string;
  cause?: string;
  caution?: string;
  red: boolean;
  stage: 'assessed' | 'booked' | 'served';
  booking?: Booking;
  /** คะแนนปวดหลังนวด */
  after?: number;
  /** แชทของเรื่องนี้ (ประเมินซ้ำต่อในแชทเดิม) */
  chatId?: string;
  /** คำตอบโรคประจำตัว/ยาครั้งก่อน (ประเมินซ้ำไม่ต้องถามใหม่) */
  health?: string;
  /** ข้อห้ามนวด / แรงนวดที่ตอบไว้ (ประเมินซ้ำไม่ต้องถามใหม่) */
  risk?: string;
  pressure?: string;
  /** บริเวณที่ไม่ต้องการให้นวด */
  avoid?: string;
  radiate?: string;
  /** ผู้ใช้เลือกคงบริการที่จองไว้ แม้ไม่ตรงผลประเมิน (ไม่บังคับเปลี่ยน · ไม่เตือนซ้ำ) */
  keepService?: boolean;
}

/**
 * ใบร่าง → ใบการรักษา หลังนวดครั้งแรก
 * ⚠️ ต้นแบบ: ชื่อโรคจำลองว่าผู้ให้บริการตั้งให้ (ลมปลายปัตฆาต = รหัสโรคแผนไทยที่พบบ่อยของคอ/บ่า/หลัง, health profile 2568 หน้า 13)
 */
const DIAGNOSIS: Record<string, string> = {
  'ปวดคอ-บ่า': 'ลมปลายปัตฆาตสัญญาณ 4 หลัง/คอ',
  ปวดขา: 'ลมปลายปัตฆาตขา',
  ปวดคอ: 'ลมปลายปัตฆาต สัญญาณ 4 (คอ)',
  ปวดหลัง: 'ลมปลายปัตฆาต สัญญาณ 3 (หลัง)',
  ปวดไหล่: 'ลมปลายปัตฆาต (ไหล่)',
};
function draftToCase(d: DraftCase, painAfter: number, diagnosis?: string): TreatmentCase {
  const areas = d.symptoms.flatMap((sym) => (CHIP_PINS[sym] ?? []).slice(0, 1).map((pin) => ({ label: sym.replace('ปวด', ''), pin, symptom: sym, before: d.pain })));
  const visit = d.booking?.date ?? 'วันนี้';
  return {
    id: `case-${d.id}`,
    // ชื่อโรคจากผู้ให้บริการจริง (cloud) ถ้ามี · ไม่มี = จำลอง
    condition: diagnosis ?? DIAGNOSIS[d.symptoms[0]] ?? guideFor(d.symptoms).condition,
    short: d.title,
    plan: 'นวดราชสำนัก',
    areas,
    visits: [{ date: visit, painBefore: d.pain, painAfter }],
    // ติดตามอาการหลังนวดครั้งแรก (โหมด focus บนหุ่น)
    pending: [{ id: `sess-${d.id}`, date: visit, plan: 'นวดราชสำนัก', areas }],
    // รักษาต่อที่เดิมเท่านั้น
    clinic: d.booking?.clinic,
    // นัดครั้งถัดไปยังไม่ได้จอง (ไม่สร้างนัดขึ้นเอง) → การ์ดนัดขึ้น "จองนัด"
    appointment: { today: false, date: '-', time: '-' },
    prep: d.caution?.includes('ความดัน') || d.caution?.includes('อบ') ? ['วัดความดันก่อนนวด', 'งดอาหารหนัก 30 นาที'] : ['งดอาหารหนัก 30 นาที'],
    course: { done: 1, total: 6 },
    therapist: d.booking?.therapist ?? 'พท.ป. มาลี ใจดี',
    selfCare: { title: d.symptoms.some((x) => /หลัง/.test(x)) ? 'ยืดหลัง' : 'ยืดคอ-บ่า', minutes: 5, doneToday: false },
    chatId: d.chatId,
  };
}

/** ช่องทางเข้าสู่ระบบ — แต่ละช่องทางได้ข้อมูลมาไม่เท่ากัน */
export type AuthProvider = 'healthid' | 'google' | 'line';
/** บัญชีที่สมัครในต้นแบบ (null = ใช้คนไข้ตัวอย่างที่มีประวัติการรักษาแล้ว) */
export interface Account {
  provider: AuthProvider;
  name: string;
  birthDate: string;
  sex: string;
  /** ยืนยันตัวตนแล้ว (Health ID) */
  verified: boolean;
}

interface JourneyState {
  client: { name: string; initials: string; age: number; occupation: string; hn: string };
  scenario: Scenario;
  setScenario: (s: Scenario) => void;
  consents: Consents;
  setConsents: (c: Consents) => void;
  profile: HealthProfile;
  setProfile: (p: HealthProfile) => void;
  symptoms: Partial<Record<RegionId, number>>;
  setSymptoms: (s: Partial<Record<RegionId, number>>) => void;
  chiefComplaint: string;
  setChiefComplaint: (s: string) => void;
  goal: string;
  setGoal: (s: string) => void;
  before: Assessment;
  setBefore: (a: Assessment) => void;
  after?: Assessment;
  setAfter: (a: Assessment) => void;
  safety: SafetyResult;
  acknowledged: string[];
  setAcknowledged: (ids: string[]) => void;
  record: ServiceRecord;
  setRecord: (r: ServiceRecord) => void;
  /** ธาตุเจ้าเรือนปัจจุบัน (% ต่อธาตุ) */
  elements: Record<ElementKey, number>;
  setElements: (e: Record<ElementKey, number>) => void;
  elementsDone: boolean;
  audit: AuditEntry[];
  log: (actor: string, action: string) => void;
  /** ผลติดตามอาการที่ส่งไปหลังบ้านแล้ว (ล่าสุดอยู่หน้า) */
  followUps: FollowUpRecord[];
  /** ส่งผลติดตามอาการ → บันทึกเมื่อหลังบ้านรับแล้ว */
  sendFollowUp: (p: Omit<FollowUpPayload, 'hn' | 'channel'>) => Promise<FollowUpRecord>;
  reset: () => void;
  /** บัญชีที่สมัครใหม่ (null = คนไข้ตัวอย่างเดิม) */
  account: Account | null;
  setAccount: (a: Account | null) => void;
  /** ยังไม่มีข้อมูลการรักษา → หน้าแรกแบบเริ่มต้นใช้งาน */
  newPatient: boolean;
  setNewPatient: (v: boolean) => void;
  careStage: CareStage;
  setCareStage: (s: CareStage) => void;
  /** นัดเรื่องใหม่ที่จองไว้ก่อนประเมิน (ยังไม่ผูกกับเรื่องไหน) — มีได้หลายนัด */
  looseBookings: LooseBooking[];
  addLooseBooking: (b: Booking) => string;
  updateLooseBooking: (id: string, b: Booking) => void;
  removeLooseBooking: (id: string) => void;
  lastAssess: AssessSummary | null;
  setLastAssess: (a: AssessSummary | null) => void;
  drafts: DraftCase[];
  /** เพิ่มใบใหม่ หรือแก้ใบเดิม (id ตรงกัน) */
  upsertDraft: (d: DraftCase) => void;
  /** ใบร่างที่กำลังจอง/รับบริการ */
  activeDraftId: string | null;
  setActiveDraftId: (id: string | null) => void;
  /** ใบการรักษาที่เกิดจากใบร่าง (นวดครั้งแรกแล้ว ผู้ให้บริการตั้งชื่อโรค) */
  promoted: TreatmentCase[];
  /** นัดของใบการรักษาที่ผู้ใช้ยกเลิกแล้ว (case id) — หน้าแรกเปลี่ยนเป็น "ยังไม่มีนัด" */
  cancelledAppts: string[];
  cancelAppointment: (caseId: string) => void;
  /** นัดของใบการรักษาที่จอง/เลื่อนใหม่ (แทนนัดตัวอย่าง) · ต้นแบบ: เก็บในเครื่อง */
  caseAppts: Record<string, CaseAppt>;
  setCaseAppointment: (caseId: string, appt: CaseAppt) => void;
  /** นวดครั้งแรกเสร็จ → ใบร่างกลายเป็นใบการรักษา (ชื่อแท็บเดิม · ชื่อโรคจากผู้ให้บริการ — ส่งมาจริงได้ผ่าน cloud) */
  promoteDraft: (draftId: string, painAfter: number, diagnosis?: string) => void;
  /** ออกจากระบบ: ล้างบัญชีและข้อมูลของรอบนี้ทั้งหมด */
  /** เปิดแอปแล้วมีข้อมูลที่บันทึกไว้ (เคยเข้าใช้งาน) → ข้ามหน้าเข้าสู่ระบบ */
  resumed: boolean;
  /** ถึงหน้าแรกแล้ว → เริ่มจำข้อมูลข้ามการเปิดแอปใหม่ */
  markEntered: () => void;
  signOut: () => void;
  /**
   * ใบการรักษาที่ใช้แสดงทุกหน้า (หน้าแรก · ประวัติ · โปรไฟล์ · นัด · AI) — ตัวอย่าง + ใบจากใบร่าง
   * รวมนัดที่จอง/เลื่อน · นัดที่ยกเลิก (= ไม่มีนัด) · ครั้งที่นวดเพิ่ม → ทุกหน้าเห็นข้อมูลชุดเดียวกัน
   */
  cases: TreatmentCase[];
  /** นวดครั้งนี้ของใบการรักษาเสร็จ → เพิ่มครั้งการรักษา · นับคอร์ส · นัดนี้ใช้ไปแล้ว */
  recordCaseVisit: (caseId: string, painBefore: number, painAfter: number) => void;
  /**
   * คลินิกปิดการรักษาครั้งนี้ในหลังบ้าน (เช็กเอาต์/ออกบิล) → แอปได้ครั้งใหม่ + คะแนนหลังนวดของคลินิก + บิล
   * ไม่ขึ้นกับว่าผู้ใช้กรอกแบบประเมินหลังนวดหรือไม่ · คืน id ใบการรักษา
   * ⚠️ ต้นแบบ: จำลองคะแนนของคลินิก + แจ้งเตือนติดตามผลวันถัดไป (มาหลังจากนี้ไม่กี่วินาที)
   */
  clinicCloseVisit: (target: { caseId?: string; draftId?: string }, clinicPainAfter?: number, opts?: CloseOpts) => string | undefined;
  /** แจ้งหลังบ้านคลินิก (เมื่อเปิดอยู่ในเบราว์เซอร์เดียวกัน — ต้นแบบ) */
  notifyClinic: (title: string, body: string) => void;
  /** ความรู้สึกหลังนวดที่ผู้ใช้บอกเอง (ครั้งล่าสุด) — แสดงคู่กับคะแนนของคลินิก */
  setVisitSelfPain: (caseId: string, pain: number) => void;
  /** ออกเลขคิว (เฉพาะนัดวันนี้) */
  issueQueue: () => string;
  /**
   * อาการล่าสุดก่อนนวดครั้งถัดไปของแต่ละเรื่อง (ประเมินก่อนนวด / อัปเดตอาการ) — ผู้ให้บริการเห็นก่อนถึงคิว
   * ใช้เป็นคะแนน "ก่อน" ของครั้งที่จะนวด · นวดเสร็จแล้วล้าง (รอบหน้าประเมินใหม่)
   */
  caseToday: Record<string, CaseToday>;
  setCaseToday: (caseId: string, v: CaseToday) => void;
  /** แจ้งเตือนจากคลินิก: เลื่อน/ยกเลิกนัดของการรักษา (ผู้ใช้เปลี่ยนเองไม่ได้ — หลังบ้านโรงพยาบาลแก้แล้วแจ้งมา) */
  apptNotices: ApptNotice[];
  /** อ่านแล้ว (ยังอยู่ในรายการ) */
  dismissNotice: (id: string) => void;
  markAllNoticesRead: () => void;
  /** บิล/ใบเสร็จจากคลินิก (หลังบ้านส่งบิลมาให้จ่ายในแอป · จ่ายแล้วได้ใบเสร็จ) */
  bills: Bill[];
  payBill: (id: string) => void;
  /** ส่งคำขอจองไปคลินิก (ต้นแบบ: จำลองว่าเจ้าหน้าที่ยืนยันหลังไม่กี่วินาที แล้วแจ้งเตือนในแอป) */
  requestBooking: (target: { draftId?: string; looseId?: string }, label: string) => void;
  /** เช็กอินที่คลินิก — นัดที่จองผ่าน cloud: คลินิกออกเลขคิวแล้วส่งกลับมา */
  checkIn: (target: { draftId?: string; looseId?: string }) => void;
  /** ยกเลิกนัดที่ส่งไปคลินิกแล้ว (แจ้งหลังบ้าน) */
  cancelBooking: (target: { draftId?: string; looseId?: string }) => void;
  /** นัดนี้เชื่อมกับหลังบ้านผ่าน cloud (คลินิกเป็นคนปิดการรักษา/ออกบิล — ไม่ต้องจำลอง) · คืน id ใน cloud */
  cloudRefOf: (target: { draftId?: string; looseId?: string }) => string | undefined;
}

/** คำขอจองที่ส่งไปหลังบ้าน → เรื่องไหนในแอป (+ ใบการรักษาที่เกิดหลังนวดเสร็จ สำหรับบิล/ใบเสร็จที่ตามมา) */
/** ปิดการรักษาจากคลินิก: bill=false ไม่จำลองบิล · record = บันทึกการรักษาจริงจากหลังบ้าน */
type CloseOpts = { bill?: boolean; diagnosis?: string; record?: TreatmentCase['visits'][number]['record'] };
type BridgeRef = { draftId?: string; looseId?: string; label: string; patientId?: string; caseId?: string; title?: string };

export interface Bill {
  id: string;
  caseId?: string;
  title: string;
  /** วันที่รับบริการ */
  date: string;
  items: { name: string; amount: number }[];
  total: number;
  status: 'pending' | 'paid';
  receiptNo?: string;
  paidAt?: string;
  /** นัดใน cloud ที่บิลนี้มาจาก (จ่ายในแอปแล้วแจ้งคลินิก) */
  cloudRef?: string;
}
const SAMPLE_BILLS: Bill[] = [
  { id: 'b-lung-3', caseId: 'case-lung', title: 'รักษาภูมิแพ้ ครั้งที่ 3', date: '16 ส.ค.', items: [{ name: 'นวดหน้า ศีรษะ ไหล่', amount: 350 }, { name: 'ลูกประคบสมุนไพร', amount: 50 }], total: 400, status: 'pending' },
  { id: 'b-office-5', caseId: 'case-office', title: 'รักษาออฟฟิศซินโดรม ครั้งที่ 5', date: '30 ส.ค.', items: [{ name: 'นวดไทยเพื่อการรักษา', amount: 450 }], total: 450, status: 'paid', receiptNo: 'RC2569-000123', paidAt: '30 ส.ค. 12:20' },
];

export interface ApptNotice {
  id: string;
  /** แจ้งเตือนของเรื่องไหน (ใบการรักษา / ใบร่าง / นัดเรื่องใหม่) */
  caseId?: string;
  draftId?: string;
  looseId?: string;
  /**
   * จากหลังบ้านคลินิก: moved เลื่อนนัด · cancelled ยกเลิกนัด · confirmed ยืนยันนัด · rejected ปฏิเสธคำขอจอง · reminder เตือนก่อนถึงนัด
   * noshow ไม่มาตามนัด · waitlist มีคิวว่าง · bill บิลรอชำระ · receipt ใบเสร็จ · followup ชวนอัปเดตอาการหลังนวด
   */
  kind: 'moved' | 'cancelled' | 'confirmed' | 'rejected' | 'reminder' | 'noshow' | 'waitlist' | 'bill' | 'receipt' | 'followup';
  /** บิล/ใบเสร็จที่เกี่ยวข้อง */
  billId?: string;
  text: string;
  /** เวลาที่คลินิกแจ้ง */
  at: string;
  read?: boolean;
}
/** ตัวอย่าง: คลินิกเลื่อนนัดรักษาภูมิแพ้ (ข้อมูลจริงมาจากหลังบ้าน ThaiWellAI เมื่อเจ้าหน้าที่ "ยืนยันนัดใหม่" / "ยกเลิกนัด") */
const SAMPLE_NOTICES: ApptNotice[] = [{ id: 'n-lung-moved', caseId: 'case-lung', kind: 'moved', text: 'คลินิกเลื่อนนัดรักษาภูมิแพ้ จาก พ. 8 ต.ค. 13:00 เป็น พฤ. 9 ต.ค. 14:00', at: 'วันนี้ 08:15' },
  { id: 'n-lung-bill', caseId: 'case-lung', kind: 'bill', billId: 'b-lung-3', text: 'บิลรักษาภูมิแพ้ ครั้งที่ 3 รอชำระ 400 บาท', at: 'วันนี้ 08:00' },
  { id: 'n-office-reminder', caseId: 'case-office', kind: 'reminder', text: 'วันนี้ 10:30 มีนัดรักษาออฟฟิศซินโดรม อย่าลืมประเมินก่อนนวด', at: 'วันนี้ 07:00' },
  { id: 'n-office-confirmed', caseId: 'case-office', kind: 'confirmed', text: 'คลินิกยืนยันนัดรักษาออฟฟิศซินโดรม วันนี้ 10:30', at: 'เมื่อวาน 17:40', read: true },
  { id: 'n-office-receipt', caseId: 'case-office', kind: 'receipt', billId: 'b-office-5', text: 'ใบเสร็จรักษาออฟฟิศซินโดรม ครั้งที่ 5 · 450 บาท', at: '30 ส.ค. 12:20', read: true },
];

export interface CaseToday {
  pain: number;
  /** อาการหลังนวดครั้งก่อน (ไม่มี / ระบม / ปวดมากขึ้น / ชา-อ่อนแรง) */
  adverse?: string;
  /** ข้อห้ามใหม่ก่อนนวด (ไม่มี / มีไข้ / บาดเจ็บภายใน 2 วัน / เริ่มยาใหม่) */
  risk?: string;
  /** ควรพบแพทย์ก่อนนวดครั้งถัดไป */
  red?: boolean;
}

/** นัดของใบการรักษา (จองในแชท) */
export interface CaseAppt {
  today: boolean;
  date: string;
  time: string;
  queue?: string;
  clinic: string;
  therapist: string;
}

const Ctx = createContext<JourneyState | null>(null);

/* ---------- จำข้อมูลแอปข้ามการเปิดใหม่ (เว็บ · ต้นแบบ) ----------
 * เก็บบัญชี การจอง เรื่องที่รักษา นัด แจ้งเตือน บิล และคำขอที่ส่งไปหลังบ้าน → เปิดใหม่ยังรับข้อมูลจากคลินิกต่อได้
 * ออกจากระบบ = ล้างทั้งหมด */
const APP_STATE_KEY = 'thaiwell.app.v1';
const appStore = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};
const SAVED: Record<string, unknown> | null = (() => {
  try {
    const raw = appStore()?.getItem(APP_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
})();
/** ค่าที่บันทึกไว้ (ถ้าเคยเข้าใช้งานแล้ว) ไม่มี = ค่าเริ่มต้น */
const saved = <T,>(key: string, fallback: T): T => (SAVED?.entered && SAVED[key] !== undefined ? (SAVED[key] as T) : fallback);

const initialBefore: Assessment = { pain: 3, stiffness: 7, mobility: 2, stress: 4, sleep: 2 };
const initialRecord: ServiceRecord = { regions: [], techniques: [], pressure: 'ปานกลาง', duration: 60, notes: '', provider: 'พท.ป. สมศรี ดีงาม' };

export function JourneyProvider({ children }: { children: React.ReactNode }) {
  const [scenario, setScenarioState] = useState<Scenario>('caution');
  const [profile, setProfile] = useState<HealthProfile>(() => saved('profile', baseProfile));
  const [consents, setConsents] = useState<Consents>(() => saved('consents', { service: false, aiProcessing: false, followUp: true, research: false }));
  const [symptoms, setSymptoms] = useState<Partial<Record<RegionId, number>>>({ shoulder_r: 6, neck: 4, upper_back: 3 });
  const [chiefComplaint, setChiefComplaint] = useState('ปวดตึงคอ–บ่าขวา หลังทำงานหน้าคอมพิวเตอร์');
  const [goal, setGoal] = useState('ลดปวด และคลายตึง');
  const [before, setBefore] = useState<Assessment>(initialBefore);
  const [after, setAfter] = useState<Assessment | undefined>();
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [record, setRecord] = useState<ServiceRecord>(initialRecord);
  const [elements, setElementsState] = useState<Record<ElementKey, number>>(() => saved('elements', { ไฟ: 45, ลม: 25, น้ำ: 20, ดิน: 10 }));
  /** ทำแบบประเมินธาตุแล้ว (คนใหม่ยังไม่ทำ = ใช้ธาตุเจ้าเรือนจากวันเกิด ไม่ใช้ค่าตัวอย่าง) */
  const [elementsDone, setElementsDone] = useState(() => saved('elementsDone', false));
  const setElements = useCallback((e: Record<ElementKey, number>) => {
    setElementsState(e);
    setElementsDone(true);
  }, []);
  const [audit, setAudit] = useState<AuditEntry[]>([
    { at: '09:02', actor: 'ผู้รับบริการ', action: 'ลงทะเบียนผ่าน MyAtlas' },
  ]);

  const [followUps, setFollowUps] = useState<FollowUpRecord[]>(() => saved('followUps', []));
  const [account, setAccount] = useState<Account | null>(() => saved('account', null));
  const [newPatient, setNewPatient] = useState(() => saved('newPatient', false));
  const [careStage, setCareStage] = useState<CareStage>(() => saved('careStage', 'new'));
  const [looseBookings, setLooseBookings] = useState<LooseBooking[]>(() => saved('looseBookings', []));
  const addLooseBooking = useCallback((b: Booking) => {
    const id = `nb${Date.now()}`;
    setLooseBookings((all) => [...all, { ...b, id }]);
    return id;
  }, []);
  const updateLooseBooking = useCallback((id: string, b: Booking) => setLooseBookings((all) => all.map((x) => (x.id === id ? { ...b, id } : x))), []);
  const removeLooseBooking = useCallback((id: string) => setLooseBookings((all) => all.filter((x) => x.id !== id)), []);
  const [lastAssess, setLastAssess] = useState<AssessSummary | null>(() => saved('lastAssess', null));
  const [drafts, setDrafts] = useState<DraftCase[]>(() => saved('drafts', []));
  const [activeDraftId, setActiveDraftId] = useState<string | null>(() => saved('activeDraftId', null));
  const [promoted, setPromoted] = useState<TreatmentCase[]>(() => saved('promoted', []));
  const [cancelledAppts, setCancelledAppts] = useState<string[]>(() => saved('cancelledAppts', []));
  const cancelAppointment = useCallback((caseId: string) => setCancelledAppts((ids) => (ids.includes(caseId) ? ids : [...ids, caseId])), []);
  const [caseAppts, setCaseAppts] = useState<Record<string, CaseAppt>>(() => saved('caseAppts', {}));
  // จองใหม่ → ไม่ถือว่ายกเลิกแล้ว
  const setCaseAppointment = useCallback((caseId: string, appt: CaseAppt) => {
    setCaseAppts((m) => ({ ...m, [caseId]: appt }));
    setCancelledAppts((ids) => ids.filter((x) => x !== caseId));
  }, []);
  /** ครั้งที่นวดเพิ่มของใบการรักษา (ต่อท้าย visits เดิม) */
  const [caseVisits, setCaseVisits] = useState<Record<string, TreatmentCase['visits']>>(() => saved('caseVisits', {}));
  /** คะแนนหลังนวดที่ผู้ใช้ประเมินเอง: ครั้งที่ n ของแต่ละเรื่อง */
  const [selfPains, setSelfPains] = useState<Record<string, { n: number; v: number }>>(() => saved('selfPains', {}));
  /** บันทึกการรักษาจริงจากคลินิก: "caseId:ลำดับครั้ง" */
  const [visitRecords, setVisitRecords] = useState<Record<string, NonNullable<CloseOpts['record']>>>(() => saved('visitRecords', {}));
  const queueNo = React.useRef(saved('queueNo', 11));
  const issueQueue = useCallback(() => `A${++queueNo.current}`, []);
  const [caseToday, setCaseTodayState] = useState<Record<string, CaseToday>>(() => saved('caseToday', {}));
  const [apptNotices, setApptNotices] = useState<ApptNotice[]>(() => saved('apptNotices', SAMPLE_NOTICES));
  const dismissNotice = useCallback((id: string) => setApptNotices((all) => all.map((n) => (n.id === id ? { ...n, read: true } : n))), []);
  const markAllNoticesRead = useCallback(() => setApptNotices((all) => all.map((n) => ({ ...n, read: true }))), []);
  const [bills, setBills] = useState<Bill[]>(() => saved('bills', SAMPLE_BILLS));
  /* ---------- สะพานไปหลังบ้าน (ต้นแบบ) ---------- */
  const latest = React.useRef({ drafts, looseBookings, account, profile, bills });
  latest.current = { drafts, looseBookings, account, profile, bills };
  /** คำขอจองที่ส่งไปหลังบ้าน → เรื่องไหนในแอป */
  const bridgeRefs = React.useRef<Record<string, BridgeRef>>(saved('bridgeRefs', {}));
  /** ผู้ป่วยในหลังบ้าน → เรื่องที่รักษาในแอป (เกิดตอนนวดครั้งแรกเสร็จ) · แผนที่มาก่อนมีเรื่อง → เก็บไว้ใช้ทีหลัง */
  const bridgedCase = React.useRef<Record<string, string>>(saved('bridgedCase', {}));
  const pendingPlan = React.useRef<Record<string, Extract<ClinicEvent, { type: 'plan' }>>>(saved('pendingPlan', {}));
  const patientOf = (): ClinicPatient => {
    const { account: acc, profile: pf } = latest.current;
    const name = acc ? acc.name : 'สมศักดิ์ รักดี';
    const key = Array.from(name).reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(36);
    return { id: `app-p-${key}`, hn: `APP-${key.slice(-4).toUpperCase()}`, name: acc ? `คุณ${acc.name}` : 'คุณสมศักดิ์ รักดี', gender: acc?.sex === 'หญิง' ? 'หญิง' : 'ชาย', age: pf.age, phone: '-', conditions: pf.conditions, complaint: '', painHistory: [], registeredOn: todayISO(), birthDate: birthToISO(acc?.birthDate) };
  };
  const notifyClinic = useCallback((title: string, body: string) => {
    sendNote(title, `${patientOf().name} · ${body}`, patientOf().id, patientOf().name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** ส่งคำขอจอง + แบบประเมินก่อนรับบริการ ไปหลังบ้าน (รูปแบบ BookingRequest ของหลังบ้าน) */
  const sendRequest = (target: { draftId?: string; looseId?: string }, label: string) => {
    const { drafts: ds, looseBookings: ls, profile: pf } = latest.current;
    const d = ds.find((x) => x.id === target.draftId);
    const b = d?.booking ?? ls.find((x) => x.id === target.looseId);
    if (!b) return false;
    const patient = { ...patientOf(), complaint: d ? d.title : 'นวดเพื่อสุขภาพ', painHistory: d ? [{ date: todayISO(), score: d.pain }] : [] };
    const risk = d?.risk ?? '';
    const id = `app-${Date.now().toString(36)}`;
    const request: ClinicRequest = {
      id,
      patientId: patient.id,
      serviceId: serviceCodeOf(b.service),
      // ผู้บำบัดของหลังบ้าน (จองจากตารางจริง → ชื่อตรงกัน · ไม่ระบุ = คนแรกที่ว่างรอบนั้น)
      therapistId: clinicTherapistId(b.therapist, labelToISO(b.date), b.time, serviceCodeOf(b.service)) ?? (/s2|s3|s5/.test(serviceCodeOf(b.service)) ? 't2' : 't1'),
      date: labelToISO(b.date),
      start: b.time,
      painScore: d?.pain ?? 0,
      screening: { fever: /ไข้/.test(risk), highBP: pf.conditions.some((c) => /ความดัน/.test(c)), menstruation: /ประจำเดือน/.test(risk), pregnant: /ตั้งครรภ์/.test(risk), recentSurgery: /ผ่าตัด/.test(risk), contagious: /โรคติดต่อ/.test(risk) },
      intake: d
        ? {
            at: new Date().toISOString(),
            goal: /รักษา|ประคบ/.test(b.service) ? 'นวดเพื่อการรักษา' : 'นวดเพื่อสุขภาพ',
            complaint: d.title,
            pain: d.pain,
            duration: d.duration ?? '-',
            focusAreas: d.symptoms,
            avoidAreas: d.avoid && d.avoid !== 'ไม่มี' ? [d.avoid] : [],
            conditions: pf.conditions,
            medications: pf.medications,
            bloodThinner: pf.medications.some((m) => /ละลายลิ่มเลือด|warfarin|aspirin/i.test(m)),
            skin: /แผล|ผื่น/.test(risk) ? 'มีแผลหรือผื่น' : 'ปกติ',
            numbness: /ชา|อ่อนแรง/.test(d.radiate ?? ''),
            fever: /ไข้/.test(risk),
            pregnant: /ตั้งครรภ์/.test(risk) ? true : null,
            pressure: d.pressure === 'หนัก' || d.pressure === 'เบา' ? d.pressure : 'ปานกลาง',
            injury: /บาดเจ็บ/.test(risk) ? risk : undefined,
            surgery: /ผ่าตัด/.test(risk) ? risk : undefined,
          }
        : undefined,
      note: d?.caution,
      submittedAt: new Date().toISOString(),
      serviceLabel: b.service,
    };
    bridgeRefs.current[id] = { ...target, label, patientId: patient.id };
    sendBooking(request, patient);
    return true;
  };
  const requestBooking = useCallback((target: { draftId?: string; looseId?: string }, label: string) => {
    // หลังบ้านเปิดอยู่ → รอเจ้าหน้าที่อนุมัติจริง · ไม่ได้เปิด → จำลองการยืนยัน
    // (รอให้ใบร่าง/นัดที่เพิ่งสร้างเข้า state ก่อน)
    if (clinicOnline()) {
      setTimeout(() => sendRequest(target, label), 300);
      return;
    }
    setTimeout(() => {
      const confirm = (b: Booking): Booking => ({ ...b, status: 'confirmed', queue: b.date === 'วันนี้' ? `A${++queueNo.current}` : undefined });
      if (target.draftId) setDrafts((all) => all.map((d) => (d.id === target.draftId && d.booking ? { ...d, booking: confirm(d.booking) } : d)));
      if (target.looseId) setLooseBookings((all) => all.map((b) => (b.id === target.looseId ? { ...confirm(b), id: b.id } : b)));
      const d = new Date();
      setApptNotices((all) => [{ id: `n-ok-${Date.now()}`, ...target, kind: 'confirmed', text: `คลินิกยืนยันนัด ${label}`, at: `วันนี้ ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }, ...all]);
    }, 6000);
  }, []);
  /** id ของคำขอจองใน cloud/สะพาน ที่ผูกกับเรื่องนี้ */
  const refOf = (target: { draftId?: string; looseId?: string }) =>
    Object.keys(bridgeRefs.current).find((k) => {
      const t = bridgeRefs.current[k];
      return (!!target.draftId && t.draftId === target.draftId) || (!!target.looseId && t.looseId === target.looseId);
    });
  const cloudRefOf = useCallback((target: { draftId?: string; looseId?: string }) => (isCloud() ? refOf(target) : undefined), []);
  const checkIn = useCallback((target: { draftId?: string; looseId?: string }) => {
    const ref = refOf(target);
    if (ref) sendCheckIn(ref, patientOf().name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const cancelBooking = useCallback((target: { draftId?: string; looseId?: string }) => {
    const ref = refOf(target);
    if (!ref) return;
    sendCancel(ref, patientOf().name);
    delete bridgeRefs.current[ref];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // รับเหตุการณ์จากหลังบ้าน: อนุมัติ/ปฏิเสธ · นวดเสร็จ · ยกเลิก/ไม่มา · (cloud) คิว · เริ่มบริการ · บิล · ใบเสร็จ
  const onClinic = React.useRef<(events: ClinicEvent[]) => void>(() => {});
  React.useEffect(() => {
    void setupNotifications();
    return listenClinic((ev) => {
      onClinic.current(ev);
      // เด้งแจ้งเตือนบนเครื่องทุกครั้งที่คลินิกส่งข้อมูลมา
      for (const e of ev) {
        const n = noticeOf(e);
        if (n) void notify(...n);
      }
    });
  }, []);
  const nowAtLabel = () => {
    const d = new Date();
    return `วันนี้ ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const payBill = useCallback((id: string) => {
    const d = new Date();
    const at = `วันนี้ ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    // บิลจากคลินิก (cloud) → แจ้งหลังบ้านว่าชำระแล้ว (บิลในระบบคลินิกปิดเอง)
    const cr = latest.current.bills.find((b) => b.id === id)?.cloudRef;
    if (cr) sendPayment(cr, patientOf().name);
    setBills((all) => all.map((b) => (b.id === id ? { ...b, status: 'paid', paidAt: at, receiptNo: `RC2569-${String(124 + all.indexOf(b)).padStart(6, '0')}` } : b)));
    // บิลนี้จ่ายแล้ว → แจ้งเตือนบิลถือว่าอ่านแล้ว
    setApptNotices((all) => all.map((n) => (n.billId === id ? { ...n, read: true } : n)));
  }, []);
  const setCaseToday = useCallback((caseId: string, v: CaseToday) => setCaseTodayState((m) => ({ ...m, [caseId]: v })), []);
  const recordCaseVisit = useCallback((caseId: string, painBefore: number, painAfter: number) => {
    // นวดครั้งนี้แล้ว → ประเมินก่อนนวดรอบนี้ใช้ไปแล้ว
    setCaseTodayState((m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== caseId)));
    setCaseVisits((m) => ({ ...m, [caseId]: [...(m[caseId] ?? []), { date: 'วันนี้', painBefore, painAfter }] }));
    // นัดนี้ใช้แล้ว → ยังไม่มีนัดครั้งถัดไป
    setCaseAppts((m) => ({ ...m, [caseId]: { today: false, date: '-', time: '-', clinic: m[caseId]?.clinic ?? '', therapist: m[caseId]?.therapist ?? '' } }));
  }, []);
  const signOut = useCallback(() => {
    // ล้างข้อมูลที่จำไว้ + คำขอที่ส่งไปหลังบ้าน
    try {
      appStore()?.removeItem(APP_STATE_KEY);
    } catch {
      /* ignore */
    }
    setEntered(false);
    bridgeRefs.current = {};
    bridgedCase.current = {};
    pendingPlan.current = {};
    setVisitRecords({});
    setAccount(null);
    setNewPatient(false);
    setCareStage('new');
    setLooseBookings([]);
    setLastAssess(null);
    setDrafts([]);
    setActiveDraftId(null);
    setPromoted([]);
    setCancelledAppts([]);
    setCaseAppts({});
    setFollowUps([]);
    setProfile(baseProfile);
    setConsents({ service: false, aiProcessing: false, followUp: true, research: false });
    // ไม่ให้ข้อมูลของบัญชีก่อนหน้าค้าง (บันทึกการเข้าถึง · ธาตุ · คะแนนก่อน/หลัง · ฯลฯ)
    setCaseVisits({});
    setSelfPains({});
    setCaseTodayState({});
    setApptNotices(SAMPLE_NOTICES);
    setBills(SAMPLE_BILLS);
    setAudit([{ at: '09:02', actor: 'ผู้รับบริการ', action: 'ลงทะเบียนผ่าน MyAtlas' }]);
    setElementsState({ ไฟ: 45, ลม: 25, น้ำ: 20, ดิน: 10 });
    setElementsDone(false);
    setBefore(initialBefore);
    setAfter(undefined);
    setAcknowledged([]);
    setRecord(initialRecord);
    setScenarioState('caution');
  }, []);
  const promoteDraft = useCallback((draftId: string, painAfter: number, diagnosis?: string) => {
    setDrafts((all) => {
      const d = all.find((x) => x.id === draftId);
      if (!d) return all;
      setPromoted((cs) => [...cs.filter((c) => c.id !== `case-${d.id}`), draftToCase(d, painAfter, diagnosis)]);
      return all.filter((x) => x.id !== draftId);
    });
    // ใบร่างนี้ไม่มีแล้ว → ไม่ให้การจองครั้งถัดไปไปผูกกับใบที่หายไป
    setActiveDraftId((id) => (id === draftId ? null : id));
  }, []);
  const upsertDraft = useCallback(
    (d: DraftCase) => setDrafts((all) => (all.some((x) => x.id === d.id) ? all.map((x) => (x.id === d.id ? d : x)) : [...all, d])),
    [],
  );
  const log = useCallback((actor: string, action: string) => {
    const d = new Date();
    const at = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    setAudit((a) => [{ at, actor, action }, ...a]);
  }, []);

  const setScenario = useCallback((s: Scenario) => {
    setScenarioState(s);
    setProfile(s === 'redflag' ? redFlagProfile : baseProfile);
    setAcknowledged([]);
  }, []);

  const reset = useCallback(() => {
    setScenario('caution');
    setConsents({ service: false, aiProcessing: false, followUp: true, research: false });
    setAfter(undefined);
    setAcknowledged([]);
    setRecord(initialRecord);
    setBefore(initialBefore);
  }, [setScenario]);

  const safety = useMemo(() => evaluateSafety(profile), [profile]);

  const cases = useMemo(
    () =>
      [...(newPatient ? [] : TREATMENT_CASES), ...promoted].map((c) => {
        const extra = caseVisits[c.id] ?? [];
        const a = caseAppts[c.id];
        const cancelled = cancelledAppts.includes(c.id);
        const sp = selfPains[c.id];
        const visits = [...c.visits, ...extra].map((v, i) => (visitRecords[`${c.id}:${i}`] ? { ...v, record: visitRecords[`${c.id}:${i}`] } : v));
        return {
          ...c,
          // คะแนนหลังนวดที่ผู้ใช้ประเมินเอง → ครั้งล่าสุด
          visits: sp && sp.n === visits.length ? visits.map((v, i) => (i === visits.length - 1 ? { ...v, selfPain: sp.v } : v)) : visits,
          // ครั้งที่นวดเพิ่ม → มีรอบติดตามผลของครั้งนั้น (ล่าสุดอยู่หน้า)
          pending: [...extra.map((v, i) => ({ id: `sess-${c.id}-${c.visits.length + i + 1}`, date: v.date, plan: c.plan, areas: c.areas })).reverse(), ...c.pending],
          course: { ...c.course, done: Math.min(c.course.total, c.course.done + extra.length) },
          therapist: a?.therapist || c.therapist,
          appointment: cancelled ? { today: false, date: '-', time: '-' } : a ? { today: a.today, date: a.date, time: a.time, queue: a.queue } : c.appointment,
        };
      }),
    [newPatient, promoted, caseAppts, cancelledAppts, caseVisits, selfPains, visitRecords],
  );
  const nowAt = () => {
    const d = new Date();
    return `วันนี้ ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const clinicCloseVisit = useCallback(
    (target: { caseId?: string; draftId?: string }, clinicPainAfter?: number, opts?: CloseOpts) => {
      const tc = cases.find((c) => c.id === target.caseId);
      const d = drafts.find((x) => x.id === target.draftId);
      if (!tc && !d) return undefined;
      const caseId = tc?.id ?? `case-${d!.id}`;
      const title = tc?.short ?? d!.title;
      // ก่อนนวด = ประเมินก่อนนวดวันนี้ / หลังนวดครั้งก่อน · หลังนวด = คลินิกบันทึก (จำลอง)
      const painBefore = tc ? caseToday[tc.id]?.pain ?? tc.visits[tc.visits.length - 1].painAfter : d!.pain;
      // คะแนนจากหลังบ้าน (นวดเสร็จ) · ไม่มี = จำลอง
      const painAfter = clinicPainAfter ?? Math.max(0, painBefore - 2);
      const no = tc ? tc.visits.length + 1 : 1;
      if (tc) recordCaseVisit(tc.id, painBefore, painAfter);
      else promoteDraft(d!.id, painAfter, opts?.diagnosis);
      // คะแนนจากหลังบ้าน = ผู้ป่วยเลือกเองที่คลินิก (ขั้นประเมินหลังนวด) → นับเป็นการประเมินหลังนวดของครั้งนี้ ไม่ต้องประเมินซ้ำในแอป
      if (clinicPainAfter !== undefined) setSelfPains((m) => ({ ...m, [caseId]: { n: no, v: clinicPainAfter } }));
      // บันทึกการรักษาจริงจากคลินิก → แสดงในรายละเอียดครั้งนั้นแทนข้อมูลตัวอย่าง
      if (opts?.record) setVisitRecords((m) => ({ ...m, [`${caseId}:${no - 1}`]: opts.record! }));
      // cloud: คลินิกเป็นคนออกบิลจริง (มาทีหลังเป็นเหตุการณ์ bill) → ไม่จำลองบิล
      if (opts?.bill !== false) {
        const service = tc ? tc.plan : d!.booking?.service ?? 'นวดไทยเพื่อการรักษา';
        const billId = `b-${caseId}-${no}`;
        setBills((all) => [{ id: billId, caseId, title: `${title} ครั้งที่ ${no}`, date: 'วันนี้', items: [{ name: service, amount: 450 }], total: 450, status: 'pending' }, ...all.filter((b) => b.id !== billId)]);
        setApptNotices((all) => [{ id: `n-bill-${billId}`, caseId, kind: 'bill', billId, text: `บิล${title} ครั้งที่ ${no} รอชำระ 450 บาท`, at: nowAt() }, ...all]);
      }
      // การประเมินมีแค่ก่อนนวดและหลังนวด (ไม่มีติดตามผลรายวัน) → หลังนวดผู้ใช้ประเมินเองจากหน้าผลลัพธ์/หน้าแรก
      return caseId;
    },
    [cases, drafts, caseToday, recordCaseVisit, promoteDraft],
  );
  const setVisitSelfPain = useCallback((caseId: string, pain: number) => {
    // คะแนนหลังนวดของครั้งล่าสุด (นับจากจำนวนครั้ง ณ ตอนประเมิน → ครั้งใหม่ไม่รับค่าเก่า)
    const n = cases.find((c) => c.id === caseId)?.visits.length ?? 0;
    setSelfPains((m) => ({ ...m, [caseId]: { n, v: pain } }));
  }, [cases]);

  const sendFollowUp = useCallback(
    async (p: Omit<FollowUpPayload, 'hn' | 'channel'>) => {
      const rec = await submitFollowUp({ ...p, hn: 'TW-000123', channel: 'home-body-map' });
      setFollowUps((all) => [rec, ...all.filter((r) => r.sessionId !== rec.sessionId)]);
      log('ผู้รับบริการ', `ส่งผลติดตามอาการ ${rec.sessionDate}: ${rec.areas.map((a) => `${a.area} ${a.painBefore}→${a.painAfter}`).join(', ')}`);
      return rec;
    },
    [log],
  );

  /** แผนจากคลินิก → นัดครั้งถัดไปของเรื่องนั้น + จำนวนครั้งของคอร์ส */
  const applyPlan = (caseId: string, e: Extract<ClinicEvent, { type: 'plan' }>) => {
    const tc = cases.find((c) => c.id === caseId);
    // จำนวนครั้งของคอร์ส + แผนที่แพทย์อนุมัติ (แสดงในรายละเอียดเรื่องนั้น)
    const clinicPlan = e.summary ? { summary: e.summary, sessions: e.course?.total ?? 0, frequency: e.frequency ?? '', homeCare: e.homeCare ?? [] } : undefined;
    setPromoted((cs) =>
      cs.map((c) => (c.id === caseId ? { ...c, course: e.course ? { ...c.course, total: Math.max(e.course.total, c.course.done) } : c.course, clinicPlan: clinicPlan ?? c.clinicPlan } : c)),
    );
    // แผนจาก cloud: สรุปแผน + จำนวนครั้ง (นัดครั้งถัดไปคลินิกลงให้ทีหลัง)
    if (!e.next && e.summary) setApptNotices((all) => [{ id: `n-plan-${e.id}`, caseId, kind: 'confirmed', text: `คลินิกส่งแผนการรักษา: ${e.summary}${e.course ? ` · ${e.course.total} ครั้ง` : ''}${e.frequency ? ` (${e.frequency})` : ''}`, at: nowAtLabel() }, ...all.filter((n) => n.id !== `n-plan-${e.id}`)]);
    if (!e.next) return;
    const date = isoToLabel(e.next.date);
    setCaseAppointment(caseId, { today: date === 'วันนี้', date, time: e.next.start, clinic: tc?.clinic ?? '', therapist: e.next.therapist, queue: date === 'วันนี้' ? `A${++queueNo.current}` : undefined });
    const no = (tc?.visits.length ?? 1) + 1;
    setApptNotices((all) => [{ id: `n-plan-${e.id}`, caseId, kind: 'confirmed', text: `คลินิกนัดครั้งที่ ${no} ตามแผนการรักษา ${date} ${e.next!.start}${e.next!.therapist ? ` · ${e.next!.therapist}` : ''}`, at: nowAtLabel() }, ...all]);
  };
  /** คลินิกปิดการรักษาของนัดที่ส่งจากแอป → ใบการรักษา · คืน case id (จำไว้ที่ ref ให้บิล/ใบเสร็จที่ตามมา) */
  const closeFromClinic = (ref: string, t: BridgeRef, e: { painBefore: number; painAfter?: number } | undefined, opts?: CloseOpts) => {
    let caseId: string | undefined;
    const title = t.draftId ? latest.current.drafts.find((d) => d.id === t.draftId)?.title : 'นวดเพื่อสุขภาพ';
    if (t.draftId) caseId = clinicCloseVisit({ draftId: t.draftId }, e?.painAfter, opts);
    else if (t.looseId) {
      // นัดที่จองก่อนประเมิน → เป็นเรื่องที่รักษาด้วย (ไว้รับแผน/ครั้งต่อไปจากคลินิก)
      const lb = latest.current.looseBookings.find((b) => b.id === t.looseId);
      if (lb) {
        const { id: _drop, ...booking } = lb;
        const painBefore = e?.painBefore ?? 5;
        const d: DraftCase = { id: `d-${t.looseId}`, title: 'นวดเพื่อสุขภาพ', symptoms: [], pain: painBefore, red: false, stage: 'booked', booking: { ...booking, status: 'confirmed' } };
        setDrafts((all) => [...all, d]);
        promoteDraft(d.id, e?.painAfter ?? painBefore, opts?.diagnosis);
        setLooseBookings((all) => all.filter((b) => b.id !== t.looseId));
        caseId = `case-${d.id}`;
        if (e?.painAfter !== undefined) setSelfPains((m) => ({ ...m, [`case-${d.id}`]: { n: 1, v: e.painAfter! } }));
        if (opts?.record) setVisitRecords((m) => ({ ...m, [`case-${d.id}:0`]: opts.record! }));
      }
      setApptNotices((all) => [{ id: `n-done-${ref}`, kind: 'confirmed', text: `คลินิกบันทึกการนวดแล้ว ${t.label}`, at: nowAtLabel() }, ...all]);
    }
    if (caseId) bridgeRefs.current[ref] = { ...t, caseId, title: title ?? t.label };
    return caseId;
  };
  onClinic.current = (events) => {
    for (const e of events) {
      if (e.type === 'plan') {
        const caseId = bridgedCase.current[e.patientId];
        if (caseId) applyPlan(caseId, e);
        else pendingPlan.current[e.patientId] = e;
        continue;
      }
      if (e.type === 'visit') {
        // นวดครั้งต่อไปตามแผน → ครั้งใหม่ของเรื่องนั้น (คะแนนหลังนวดของคลินิก + บิล)
        const caseId = bridgedCase.current[e.patientId];
        if (caseId) clinicCloseVisit({ caseId }, e.painAfter);
        continue;
      }
      const t = bridgeRefs.current[e.ref];
      if (!t) continue;
      const target = { draftId: t.draftId, looseId: t.looseId };
      const unbook = () => {
        if (t.draftId) setDrafts((all) => all.map((d) => (d.id === t.draftId ? { ...d, booking: undefined, stage: 'assessed' } : d)));
        if (t.looseId) setLooseBookings((all) => all.filter((b) => b.id !== t.looseId));
      };
      // นัดที่จบแล้ว (ปฏิเสธ/นวดเสร็จ/ยกเลิก) ถูกเอาออก → แจ้งเตือนไม่ผูกกับนัดนั้น (ไม่อย่างนั้นถูกกรองทิ้ง)
      const note = (kind: ApptNotice['kind'], text: string) => setApptNotices((all) => [{ id: `n-${e.type}-${e.id}`, ...(e.type === 'approved' ? target : {}), kind, text, at: nowAtLabel() }, ...all]);
      if (e.type === 'queue') {
        // คลินิกออกเลขคิว (หลังเช็กอิน) / เรียกคิว → แสดงที่นัด + แจ้งเตือน
        const withQueue = (b: Booking): Booking => ({ ...b, queue: e.queue || b.queue });
        if (t.draftId) setDrafts((all) => all.map((d) => (d.id === t.draftId && d.booking ? { ...d, booking: withQueue(d.booking) } : d)));
        if (t.looseId) setLooseBookings((all) => all.map((b) => (b.id === t.looseId ? { ...withQueue(b), id: b.id } : b)));
        note('reminder', e.called ? `ถึงคิว ${e.queue} แล้ว เชิญเข้ารับบริการ` : `เช็กอินแล้ว ได้คิว ${e.queue} · รอเรียกคิวในแอป`);
        continue;
      }
      if (e.type === 'started') {
        note('reminder', `เริ่มรับบริการแล้ว ${t.label}`);
        continue;
      }
      if (e.type === 'bill' || e.type === 'receipt') {
        // คลินิกส่งบิล / ใบเสร็จ (จ่ายที่คลินิก) — ยังไม่ได้ผลการนวดมาก่อน → ปิดการรักษาให้ก่อน
        const caseId = t.caseId ?? closeFromClinic(e.ref, t, undefined, { bill: false });
        const title = `${t.title ?? t.label} ครั้งที่ 1`;
        const billId = `cb-${e.ref}`;
        if (e.type === 'bill') {
          setBills((all) => [{ id: billId, caseId, title, date: 'วันนี้', items: [{ name: e.items.join(' + ') || 'ค่าบริการ', amount: e.amount }], total: e.amount, status: 'pending', cloudRef: e.ref }, ...all.filter((b) => b.id !== billId)]);
          setApptNotices((all) => [{ id: `n-${e.id}`, caseId, kind: 'bill', billId, text: `บิล${title} รอชำระ ${e.amount} บาท`, at: nowAtLabel() }, ...all]);
        } else {
          const paid = { status: 'paid' as const, paidAt: nowAtLabel(), receiptNo: e.receiptNo };
          setBills((all) => (all.some((b) => b.id === billId) ? all.map((b) => (b.id === billId ? { ...b, ...paid } : b)) : [{ id: billId, caseId, title, date: 'วันนี้', items: [{ name: 'ค่าบริการ', amount: e.amount }], total: e.amount, cloudRef: e.ref, ...paid }, ...all]));
          setApptNotices((all) => [{ id: `n-${e.id}`, caseId, kind: 'receipt', billId, text: `ชำระที่คลินิกแล้ว ${e.amount} บาท · ใบเสร็จ${title}`, at: nowAtLabel() }, ...all]);
        }
        continue;
      }
      if (e.type === 'approved') {
        // คลินิกอาจย้ายวัน/เวลา/ผู้ให้บริการ → ใช้ค่าที่คลินิกยืนยัน · cloud: เลขคิวมาจากคลินิกตอนเช็กอิน (ไม่ออกเอง)
        const date = isoToLabel(e.date);
        const confirm = (b: Booking): Booking => ({ ...b, date, time: e.start, therapist: e.therapist || b.therapist, status: 'confirmed', queue: e.cloud ? b.queue : date === 'วันนี้' ? `A${++queueNo.current}` : undefined });
        if (t.draftId) setDrafts((all) => all.map((d) => (d.id === t.draftId && d.booking ? { ...d, booking: confirm(d.booking) } : d)));
        if (t.looseId) setLooseBookings((all) => all.map((b) => (b.id === t.looseId ? { ...confirm(b), id: b.id } : b)));
        note('confirmed', `คลินิกยืนยันนัด ${date} ${e.start}${e.therapist ? ` · ${e.therapist}` : ''}`);
      } else if (e.type === 'rejected') {
        unbook();
        note('rejected', `คลินิกไม่สามารถรับนัด ${t.label}${e.reason ? ` · ${e.reason}` : ''}`);
      } else if (e.type === 'completed') {
        // นวดเสร็จ: ใบร่าง → ใบการรักษา (คะแนนหลังนวดของคลินิก + บิล) · นัดเรื่องใหม่ที่ยังไม่ประเมิน → ปิดนัด
        const caseId = closeFromClinic(e.ref, t, e, e.cloud ? { bill: false, diagnosis: e.record?.diagnoses?.[0], record: e.record } : undefined);
        // ผลการรักษาจากคลินิก (cloud): คำแนะนำหลังนวด → แจ้งเตือน
        if (e.cloud && e.record?.advice) note('followup', `คำแนะนำจากผู้ให้บริการ: ${e.record.advice}`);
        if (caseId && t.patientId) {
          bridgedCase.current[t.patientId] = caseId;
          // แผนที่คลินิกลงไว้ก่อน → ใส่ให้เรื่องนี้ (รอ state ของเรื่องใหม่เข้าที่)
          const pp = pendingPlan.current[t.patientId];
          if (pp) {
            delete pendingPlan.current[t.patientId];
            setTimeout(() => onClinic.current([pp]), 300);
          }
        }
      } else {
        unbook();
        note(e.type === 'absent' ? 'noshow' : 'cancelled', e.type === 'absent' ? `คลินิกบันทึกว่าไม่มาตามนัด ${t.label}` : `คลินิกยกเลิกนัด ${t.label}`);
      }
      // อนุมัติแล้วยังรอผลการนวด → จำไว้ · cloud: นวดเสร็จแล้วยังมีบิล/ใบเสร็จ/แผนตามมา → จำต่อ · จบแล้ว (ปฏิเสธ/ยกเลิก) → ลบ
      if (e.type !== 'approved' && !(e.type === 'completed' && e.cloud)) delete bridgeRefs.current[e.ref];
    }
  };

  /** เข้าใช้งานแล้ว (ถึงหน้าแรก) → เปิดใหม่กลับมาที่เดิม */
  const [entered, setEntered] = useState(() => !!SAVED?.entered);
  const markEntered = useCallback(() => setEntered(true), []);
  React.useEffect(() => {
    const st = appStore();
    if (!entered || !st) return;
    const t = setTimeout(() => {
      try {
        st.setItem(
          APP_STATE_KEY,
          JSON.stringify({
            entered, profile, consents, elements, elementsDone, followUps, account, newPatient, careStage, looseBookings, lastAssess, drafts, activeDraftId, promoted,
            cancelledAppts, caseAppts, caseVisits, selfPains, visitRecords, caseToday, apptNotices, bills, queueNo: queueNo.current,
            bridgeRefs: bridgeRefs.current, bridgedCase: bridgedCase.current, pendingPlan: pendingPlan.current,
          }),
        );
      } catch {
        /* storage full / unavailable */
      }
    }, 300);
    return () => clearTimeout(t);
  });

  const value: JourneyState = {
    resumed: !!SAVED?.entered,
    markEntered,
    client: account
      ? { name: `คุณ${account.name}`, initials: account.name.slice(0, 2), age: profile.age, occupation: '', hn: 'TW-NEW' }
      : { name: 'คุณสมศักดิ์ รักดี', initials: 'สศ', age: profile.age, occupation: 'พนักงานออฟฟิศ', hn: 'TW-000123' },
    scenario,
    setScenario,
    consents,
    setConsents,
    profile,
    setProfile,
    symptoms,
    setSymptoms,
    chiefComplaint,
    setChiefComplaint,
    goal,
    setGoal,
    before,
    setBefore,
    after,
    setAfter,
    safety,
    acknowledged,
    setAcknowledged,
    record,
    setRecord,
    elements,
    setElements,
    elementsDone,
    audit,
    log,
    followUps,
    sendFollowUp,
    reset,
    account,
    setAccount,
    newPatient,
    setNewPatient,
    careStage,
    setCareStage,
    looseBookings,
    addLooseBooking,
    updateLooseBooking,
    removeLooseBooking,
    lastAssess,
    setLastAssess,
    drafts,
    upsertDraft,
    activeDraftId,
    setActiveDraftId,
    promoted,
    promoteDraft,
    cancelledAppts,
    cancelAppointment,
    caseAppts,
    setCaseAppointment,
    signOut,
    cases,
    recordCaseVisit,
    clinicCloseVisit,
    notifyClinic,
    setVisitSelfPain,
    issueQueue,
    caseToday,
    setCaseToday,
    // แจ้งเตือนเฉพาะเรื่องที่มีอยู่จริงของคนนี้ (คนใหม่ไม่เห็นของคนไข้ตัวอย่าง)
    apptNotices: apptNotices.filter((n) => (n.caseId ? cases.some((c) => c.id === n.caseId) : n.draftId ? drafts.some((d) => d.id === n.draftId) : n.looseId ? looseBookings.some((b) => b.id === n.looseId) : true)),
    dismissNotice,
    markAllNoticesRead,
    // บิลเฉพาะเรื่องของคนนี้ (คนใหม่ไม่เห็นของคนไข้ตัวอย่าง)
    bills: bills.filter((b) => !b.caseId || cases.some((c) => c.id === b.caseId)),
    payBill,
    requestBooking,
    checkIn,
    cancelBooking,
    cloudRefOf,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useJourney() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useJourney must be used inside <JourneyProvider>');
  return c;
}

/** ประวัติผลลัพธ์ย้อนหลัง (Longitudinal) — mock */
export const HISTORY = [
  { date: '14 มิ.ย.', label: 'ครั้งที่ 1', painBefore: 8, painAfter: 6, plan: 'นวดเพื่อผ่อนคลาย 90 น.' },
  { date: '28 มิ.ย.', label: 'ครั้งที่ 2', painBefore: 8, painAfter: 5, plan: 'นวดราชสำนัก 60 น.' },
  { date: '12 ก.ค.', label: 'ครั้งที่ 3', painBefore: 7, painAfter: 5, plan: 'นวดราชสำนัก 60 น.' },
  { date: '2 ส.ค.', label: 'ครั้งที่ 4', painBefore: 7, painAfter: 4, plan: 'นวดเฉพาะส่วน + ประคบ' },
  { date: '16 ส.ค.', label: 'ครั้งที่ 5', painBefore: 6, painAfter: 4, plan: 'นวดราชสำนัก 60 น.' },
  { date: '30 ส.ค.', label: 'ครั้งที่ 6', painBefore: 6, painAfter: 3, plan: 'นวดราชสำนัก 60 น.' },
];
