/**
 * JOURNEY STATE — ข้อมูลที่ไหลต่อเนื่องตลอด Digital Thai Wellness Journey
 * (Pre-screen → Safety → Care Suggestion → Service Record → Follow-up)
 * Prototype เก็บใน memory; production = Health Profile / Wellness Encounter / Outcome / Consent / Audit (Data Layer)
 */
import { CHIP_PINS } from '../data/homeContent';
import { guideFor } from '../data/treatmentGuides';
import type { TreatmentCase } from '../data/homeFeed';
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
  queue: string;
  /** ครั้งที่เท่าไหร่ของคอร์ส */
  visit: number;
}
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
  radiate?: string;
}

/**
 * ใบร่าง → ใบการรักษา หลังนวดครั้งแรก
 * ⚠️ ต้นแบบ: ชื่อโรคจำลองว่าผู้ให้บริการตั้งให้ (ลมปลายปัตฆาต = รหัสโรคแผนไทยที่พบบ่อยของคอ/บ่า/หลัง, health profile 2568 หน้า 13)
 */
const DIAGNOSIS: Record<string, string> = {
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
    appointment: { today: false, date: 'ศ. 17 ต.ค.', time: d.booking?.time ?? '13:00' },
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
  booking: Booking | null;
  setBooking: (b: Booking | null) => void;
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
  /** นวดครั้งแรกเสร็จ → ใบร่างกลายเป็นใบการรักษา (ชื่อแท็บเดิม · ชื่อโรคจากผู้ให้บริการ) */
  promoteDraft: (draftId: string, painAfter: number) => void;
  /** ออกจากระบบ: ล้างบัญชีและข้อมูลของรอบนี้ทั้งหมด */
  signOut: () => void;
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
  const [elements, setElements] = useState<Record<ElementKey, number>>({ ไฟ: 45, ลม: 25, น้ำ: 20, ดิน: 10 });
  const [audit, setAudit] = useState<AuditEntry[]>([
    { at: '09:02', actor: 'ผู้รับบริการ', action: 'ลงทะเบียนผ่าน MyAtlas' },
  ]);

  const [followUps, setFollowUps] = useState<FollowUpRecord[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [newPatient, setNewPatient] = useState(false);
  const [careStage, setCareStage] = useState<CareStage>('new');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [lastAssess, setLastAssess] = useState<AssessSummary | null>(null);
  const [drafts, setDrafts] = useState<DraftCase[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [promoted, setPromoted] = useState<TreatmentCase[]>([]);
  const signOut = useCallback(() => {
    setAccount(null);
    setNewPatient(false);
    setCareStage('new');
    setBooking(null);
    setLastAssess(null);
    setDrafts([]);
    setActiveDraftId(null);
    setPromoted([]);
    setFollowUps([]);
    setProfile(baseProfile);
    setConsents({ service: false, aiProcessing: false, followUp: true, research: false });
  }, []);
  const promoteDraft = useCallback((draftId: string, painAfter: number) => {
    setDrafts((all) => {
      const d = all.find((x) => x.id === draftId);
      if (!d) return all;
      setPromoted((cs) => [...cs.filter((c) => c.id !== `case-${d.id}`), draftToCase(d, painAfter)]);
      return all.filter((x) => x.id !== draftId);
    });
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
    booking,
    setBooking,
    lastAssess,
    setLastAssess,
    drafts,
    upsertDraft,
    activeDraftId,
    setActiveDraftId,
    promoted,
    promoteDraft,
    signOut,
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
