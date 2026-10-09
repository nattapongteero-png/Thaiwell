import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootStackParamList = {
  // ผู้รับบริการ (Client) — ก่อนรับบริการ
  ClientTabs: { screen?: keyof ClientTabParamList; params?: object } | undefined;
  /** เข้าสู่ระบบ (Health ID / Google / LINE) */
  Auth: undefined;
  /** หลังเข้าสู่ระบบ: ถามเฉพาะข้อมูลที่ช่องทางนั้นไม่ได้ส่งมา */
  Identity: undefined;
  /** from = signup → ยินยอมแล้วเข้าหน้าแรก (ไม่ใช่เข้าแบบสัมภาษณ์) */
  Consent: { from?: 'signup' } | undefined;
  ElementQuiz: undefined;
  Interview: undefined;
  BodyMap: undefined;
  Assessment: undefined;
  PreSummary: undefined;
  /** เช็กอินนัดของเรื่องไหน (ไม่ระบุ = นัดที่จองไว้ก่อนประเมิน) */
  CheckIn: { caseId?: string; draftId?: string; looseId?: string } | undefined;
  /** ประวัติการรักษาของเรื่องหนึ่ง (bento) */
  TreatmentHistory: { caseId: string };
  /** จองนวด — หน้า stack (ย้อนกลับไปหน้าที่มา · เปิดใหม่ทุกครั้งไม่ค้างค่าเดิม) */
  Booking: { clinic?: string; /** เลือกมาแล้ว */ therapist?: string; day?: string; time?: string; /** royal / royal+compress / relax */ service?: 'royal' | 'royal+compress' | 'relax' | 'compress' | 'foot'; /** จองให้เรื่องไหน (ไม่ระบุ = ให้เลือกในหน้าจอง) */ caseId?: string; draftId?: string; /** เลื่อนนัดเรื่องใหม่นัดนี้ */ looseId?: string } | undefined;
  /** จองนวดสำเร็จ */
  BookingDone: { date: string; time: string; service: string; therapist: string; clinic: string; queue?: string; topic?: string; caution?: string; moved?: boolean; /** คำขอจอง รอคลินิกยืนยัน */ pending?: boolean };
  /** รายละเอียดนัด (แตะการ์ดนัดบนหน้าแรก) — เช็กอิน / แก้ไขนัด / ยกเลิกนัด · caseId = นัดของใบการรักษา · draftId = นัดของใบร่าง */
  AppointmentDetail: { caseId?: string; draftId?: string; looseId?: string } | undefined;
  /** รายละเอียดสถานที่ (คิว · สิทธิ · ผู้ให้บริการ · บริการ) */
  PlaceDetail: { id: string };
  /** reason = เหตุที่ควรพบแพทย์ (จากแชท/ติดตามผล) */
  RedFlag: { reason?: string } | undefined;
  /** การแจ้งเตือน (คลินิกเลื่อน/ยกเลิก/ยืนยันนัด) */
  Notifications: undefined;
  /** บิล/ใบเสร็จจากคลินิก */
  Bills: undefined;
  Course: undefined;
  Bill: { id: string };
  // ผู้รับบริการ — หลังรับบริการ
  PostAssessment: { caseId?: string; draftId?: string; looseId?: string } | undefined;
  /** ประเมินก่อนนวด (กรอกเอง) ของเรื่องที่รักษา */
  PreVisit: { caseId: string };
  SessionResult: { caseId?: string } | undefined;
  FollowUp: undefined;
  /** ไม่ระบุ groupId = หน้ารวมท่ายืด · ระบุ = รายละเอียดท่าของกลุ่มอาการนั้น */
  SelfCare: { groupId?: string } | undefined;
  Privacy: undefined;
  About: undefined;
  ProfileInfo: undefined;
  // ผู้ให้บริการ (Provider) — ระหว่างรับบริการ
  ProviderTabs: undefined;
  ClientBrief: undefined;
  SafetyCheck: undefined;
  CarePlan: undefined;
  ServiceRecord: undefined;
  ProviderDone: undefined;
};

export type ClientTabParamList = { Home: undefined; /** ท่ายืดเหยียด (ฤๅษีดัดตน) */ Stretch: undefined; /** mode doctor = ผลประเมินให้พบแพทย์ก่อน → แสดงโรงพยาบาลใกล้คุณ */ Places: { mode?: 'doctor' } | undefined; History: undefined; Profile: undefined; };
export type ProviderTabParamList = { Queue: undefined; Insights: undefined };

export const useNav = () => useNavigation<NativeStackNavigationProp<RootStackParamList>>();
