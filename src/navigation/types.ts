import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootStackParamList = {
  // ผู้รับบริการ (Client) — ก่อนรับบริการ
  ClientTabs: { screen?: keyof ClientTabParamList } | undefined;
  /** เข้าสู่ระบบ (Health ID / Google / LINE) */
  Auth: undefined;
  /** หลังเข้าสู่ระบบ: ถามเฉพาะข้อมูลที่ช่องทางนั้นไม่ได้ส่งมา */
  SignupInfo: { provider: 'healthid' | 'google' | 'line' };
  /** from = signup → ยินยอมแล้วเข้าหน้าแรก (ไม่ใช่เข้าแบบสัมภาษณ์) */
  Consent: { from?: 'signup' } | undefined;
  ElementQuiz: undefined;
  Interview: undefined;
  AIVoice: undefined;
  BodyMap: undefined;
  Assessment: undefined;
  PreSummary: undefined;
  CheckIn: undefined;
  /** ประวัติการรักษาของเรื่องหนึ่ง (bento) */
  TreatmentHistory: { caseId: string };
  /** จองนวดสำเร็จ */
  BookingDone: undefined;
  RedFlag: undefined;
  // ผู้รับบริการ — หลังรับบริการ
  PostAssessment: undefined;
  SessionResult: undefined;
  FollowUp: undefined;
  SelfCare: undefined;
  Privacy: undefined;
  // ผู้ให้บริการ (Provider) — ระหว่างรับบริการ
  ProviderTabs: undefined;
  ClientBrief: undefined;
  SafetyCheck: undefined;
  CarePlan: undefined;
  ServiceRecord: undefined;
  ProviderDone: undefined;
};

export type ClientTabParamList = { Home: undefined; Places: undefined; History: undefined; Profile: undefined; /** เข้าจากสถานที่ / ผลประเมิน (ไม่ใช่แท็บ) */ Booking: { clinic?: string } | undefined };
export type ProviderTabParamList = { Queue: undefined; Insights: undefined };

export const useNav = () => useNavigation<NativeStackNavigationProp<RootStackParamList>>();
