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
function draftToCase(d: DraftCase, painAfter: number): TreatmentCase {
  const areas = d.symptoms.flatMap((sym) => (CHIP_PINS[sym] ?? []).slice(0, 1).map((pin) => ({ label: sym.replace('ปวด', ''), pin, symptom: sym, before: d.pain })));
  const visit = d.booking?.date ?? 'วันนี้';
  return {
    id: `case-${d.id}`,
    condition: DIAGNOSIS[d.symptoms[0]] ?? guideFor(d.symptoms).condition,
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
  /** นวดครั้งแรกเสร็จ → ใบร่างกลายเป็นใบการรักษา (ชื่อแท็บเดิม · ชื่อโรคจากผู้ให้บริการ) */
  promoteDraft: (draftId: string, painAfter: number) => void;
  /** ออกจากระบบ: ล้างบัญชีและข้อมูลของรอบนี้ทั้งหมด */
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
  clinicCloseVisit: (target: { caseId?: string; draftId?: string }) => string | undefined;
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
}

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
  /** ข้อห้ามใหม่ก่อนนวด (ไม่มี / มีไข้ / บาดเจ็บใหม่ / เริ่มยาใหม่) */
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

const initialBefore: Assessment = { pain: 3, stiffness: 7, mobility: 2, stress: 4, sleep: 2 };
const initialRecord: ServiceRecord = { regions: [], techniques: [], pressure: 'ปานกลาง', duration: 60, notes: '', provider: 'พท.ป. สมศรี ดีงาม' };

export function JourneyProvider({ children }: { children: React.ReactNode }) {
  const [scenario, setScenarioState] = useState<Scenario>('caution');
  const [profile, setProfile] = useState<HealthProfile>(baseProfile);
  const [consents, setConsents] = useState<Consents>({ service: false, aiProcessing: false, followUp: true, research: false });
  const [symptoms, setSymptoms] = useState<Partial<Record<RegionId, number>>>({ shoulder_r: 6, neck: 4, upper_back: 3 });
  const [chiefComplaint, setChiefComplaint] = useState('ปวดตึงคอ–บ่าขวา หลังทำงานหน้าคอมพิวเตอร์');
  const [goal, setGoal] = useState('ลดปวด และคลายตึง');
  const [before, setBefore] = useState<Assessment>(initialBefore);
  const [after, setAfter] = useState<Assessment | undefined>();
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [record, setRecord] = useState<ServiceRecord>(initialRecord);
  const [elements, setElementsState] = useState<Record<ElementKey, number>>({ ไฟ: 45, ลม: 25, น้ำ: 20, ดิน: 10 });
  /** ทำแบบประเมินธาตุแล้ว (คนใหม่ยังไม่ทำ = ใช้ธาตุเจ้าเรือนจากวันเกิด ไม่ใช้ค่าตัวอย่าง) */
  const [elementsDone, setElementsDone] = useState(false);
  const setElements = useCallback((e: Record<ElementKey, number>) => {
    setElementsState(e);
    setElementsDone(true);
  }, []);
  const [audit, setAudit] = useState<AuditEntry[]>([
    { at: '09:02', actor: 'ผู้รับบริการ', action: 'ลงทะเบียนผ่าน MyAtlas' },
  ]);

  const [followUps, setFollowUps] = useState<FollowUpRecord[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [newPatient, setNewPatient] = useState(false);
  const [careStage, setCareStage] = useState<CareStage>('new');
  const [looseBookings, setLooseBookings] = useState<LooseBooking[]>([]);
  const addLooseBooking = useCallback((b: Booking) => {
    const id = `nb${Date.now()}`;
    setLooseBookings((all) => [...all, { ...b, id }]);
    return id;
  }, []);
  const updateLooseBooking = useCallback((id: string, b: Booking) => setLooseBookings((all) => all.map((x) => (x.id === id ? { ...b, id } : x))), []);
  const removeLooseBooking = useCallback((id: string) => setLooseBookings((all) => all.filter((x) => x.id !== id)), []);
  const [lastAssess, setLastAssess] = useState<AssessSummary | null>(null);
  const [drafts, setDrafts] = useState<DraftCase[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [promoted, setPromoted] = useState<TreatmentCase[]>([]);
  const [cancelledAppts, setCancelledAppts] = useState<string[]>([]);
  const cancelAppointment = useCallback((caseId: string) => setCancelledAppts((ids) => (ids.includes(caseId) ? ids : [...ids, caseId])), []);
  const [caseAppts, setCaseAppts] = useState<Record<string, CaseAppt>>({});
  // จองใหม่ → ไม่ถือว่ายกเลิกแล้ว
  const setCaseAppointment = useCallback((caseId: string, appt: CaseAppt) => {
    setCaseAppts((m) => ({ ...m, [caseId]: appt }));
    setCancelledAppts((ids) => ids.filter((x) => x !== caseId));
  }, []);
  /** ครั้งที่นวดเพิ่มของใบการรักษา (ต่อท้าย visits เดิม) */
  const [caseVisits, setCaseVisits] = useState<Record<string, TreatmentCase['visits']>>({});
  const queueNo = React.useRef(11);
  const issueQueue = useCallback(() => `A${++queueNo.current}`, []);
  const [caseToday, setCaseTodayState] = useState<Record<string, CaseToday>>({});
  const [apptNotices, setApptNotices] = useState<ApptNotice[]>(SAMPLE_NOTICES);
  const dismissNotice = useCallback((id: string) => setApptNotices((all) => all.map((n) => (n.id === id ? { ...n, read: true } : n))), []);
  const markAllNoticesRead = useCallback(() => setApptNotices((all) => all.map((n) => ({ ...n, read: true }))), []);
  const [bills, setBills] = useState<Bill[]>(SAMPLE_BILLS);
  const requestBooking = useCallback((target: { draftId?: string; looseId?: string }, label: string) => {
    setTimeout(() => {
      const confirm = (b: Booking): Booking => ({ ...b, status: 'confirmed', queue: b.date === 'วันนี้' ? `A${++queueNo.current}` : undefined });
      if (target.draftId) setDrafts((all) => all.map((d) => (d.id === target.draftId && d.booking ? { ...d, booking: confirm(d.booking) } : d)));
      if (target.looseId) setLooseBookings((all) => all.map((b) => (b.id === target.looseId ? { ...confirm(b), id: b.id } : b)));
      const d = new Date();
      setApptNotices((all) => [{ id: `n-ok-${Date.now()}`, ...target, kind: 'confirmed', text: `คลินิกยืนยันนัด ${label}`, at: `วันนี้ ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }, ...all]);
    }, 6000);
  }, []);
  const payBill = useCallback((id: string) => {
    const d = new Date();
    const at = `วันนี้ ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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
  const promoteDraft = useCallback((draftId: string, painAfter: number) => {
    setDrafts((all) => {
      const d = all.find((x) => x.id === draftId);
      if (!d) return all;
      setPromoted((cs) => [...cs.filter((c) => c.id !== `case-${d.id}`), draftToCase(d, painAfter)]);
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
        return {
          ...c,
          visits: [...c.visits, ...extra],
          // ครั้งที่นวดเพิ่ม → มีรอบติดตามผลของครั้งนั้น (ล่าสุดอยู่หน้า)
          pending: [...extra.map((v, i) => ({ id: `sess-${c.id}-${c.visits.length + i + 1}`, date: v.date, plan: c.plan, areas: c.areas })).reverse(), ...c.pending],
          course: { ...c.course, done: Math.min(c.course.total, c.course.done + extra.length) },
          therapist: a?.therapist || c.therapist,
          appointment: cancelled ? { today: false, date: '-', time: '-' } : a ? { today: a.today, date: a.date, time: a.time, queue: a.queue } : c.appointment,
        };
      }),
    [newPatient, promoted, caseAppts, cancelledAppts, caseVisits],
  );
  const nowAt = () => {
    const d = new Date();
    return `วันนี้ ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const clinicCloseVisit = useCallback(
    (target: { caseId?: string; draftId?: string }) => {
      const tc = cases.find((c) => c.id === target.caseId);
      const d = drafts.find((x) => x.id === target.draftId);
      if (!tc && !d) return undefined;
      const caseId = tc?.id ?? `case-${d!.id}`;
      const title = tc?.short ?? d!.title;
      // ก่อนนวด = ประเมินก่อนนวดวันนี้ / หลังนวดครั้งก่อน · หลังนวด = คลินิกบันทึก (จำลอง)
      const painBefore = tc ? caseToday[tc.id]?.pain ?? tc.visits[tc.visits.length - 1].painAfter : d!.pain;
      const painAfter = Math.max(0, painBefore - 2);
      const no = tc ? tc.visits.length + 1 : 1;
      if (tc) recordCaseVisit(tc.id, painBefore, painAfter);
      else promoteDraft(d!.id, painAfter);
      const service = tc ? tc.plan : d!.booking?.service ?? 'นวดไทยเพื่อการรักษา';
      const billId = `b-${caseId}-${no}`;
      setBills((all) => [{ id: billId, caseId, title: `${title} ครั้งที่ ${no}`, date: 'วันนี้', items: [{ name: service, amount: 450 }], total: 450, status: 'pending' }, ...all.filter((b) => b.id !== billId)]);
      setApptNotices((all) => [{ id: `n-bill-${billId}`, caseId, kind: 'bill', billId, text: `บิล${title} ครั้งที่ ${no} รอชำระ 450 บาท`, at: nowAt() }, ...all]);
      // วันถัดไป: ถามอาการหลังนวด (ต้นแบบ: มาหลังจากนี้ 8 วินาที)
      setTimeout(
        () => setApptNotices((all) => [{ id: `n-fu-${caseId}-${no}`, caseId, kind: 'followup', text: `หลังนวด${title}เมื่อวาน อาการเป็นยังไงบ้าง`, at: 'จำลอง: วันถัดไป 09:00' }, ...all]),
        8000,
      );
      return caseId;
    },
    [cases, drafts, caseToday, recordCaseVisit, promoteDraft],
  );
  const setVisitSelfPain = useCallback((caseId: string, pain: number) => {
    const withSelf = (vs: TreatmentCase['visits']) => vs.map((v, i) => (i === vs.length - 1 ? { ...v, selfPain: pain } : v));
    // ครั้งล่าสุดอยู่ในครั้งที่นวดเพิ่ม (ถ้ามี) ไม่เช่นนั้นเป็นครั้งแรกของใบที่มาจากใบร่าง
    if (caseVisits[caseId]?.length) setCaseVisits((m) => ({ ...m, [caseId]: withSelf(m[caseId]) }));
    else setPromoted((cs) => cs.map((c) => (c.id === caseId ? { ...c, visits: withSelf(c.visits) } : c)));
  }, [caseVisits]);

  const sendFollowUp = useCallback(
    async (p: Omit<FollowUpPayload, 'hn' | 'channel'>) => {
      const rec = await submitFollowUp({ ...p, hn: 'TW-000123', channel: 'home-body-map' });
      setFollowUps((all) => [rec, ...all.filter((r) => r.sessionId !== rec.sessionId)]);
      log('ผู้รับบริการ', `ส่งผลติดตามอาการ ${rec.sessionDate}: ${rec.areas.map((a) => `${a.area} ${a.painBefore}→${a.painAfter}`).join(', ')}`);
      return rec;
    },
    [log],
  );

  const value: JourneyState = {
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
