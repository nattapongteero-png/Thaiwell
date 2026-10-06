import React from 'react';
import { useIsFocused, useRoute } from '@react-navigation/native';
import { Animated, Easing, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type PointerEvent } from 'react-native';
import { Gesture, GestureDetector, PanGestureHandler, State, ScrollView as GHScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Polyline, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import {
  AIThreadMessage,
  Body3D,
  ChatComposer,
  GradientPill,
  DayDivider,
  ElementSummary,
  JellyRadio,
  Icon,
  LatticeLoader,
  PainScoreCard,
  DeltaPill,
  ReplyChips,
  useDockHeight,
  useHideTabs,
  useTabAccessory,
  useTabFab,
  Badge,
  AIBall,
  ElementPill,
  EdgeFade,
  ProfileAvatar,
  StageProgress,
  ScrollFadeMask,
  Text,
  UserBubble,
  VStack,
  componentTokens,
  fontFamily,
  palette,
  typeScale,
  radius,
  space,
  useGrid,
  useTheme,
  isBackPin,
  FIGURE_RIGHT_EXTENT,
  REST_ANGLE,
  type Body3DHandle,
  type BodyPoint,
  type BodyRegion,
  stretchGif,
  LoadingImage,
  Bone,
  Shimmer,
  BodySilhouette,
  useScreenData,
  Panel,
  IconBox,
  TINT,
  BottomSheet,
} from '../../design-system';
import { useJourney, type DraftCase } from '../../state/JourneyContext';
import { PLACES, PlacesSheet, callClinic, clinicPhone, nearestClinic, nearestHospital, openMap, rankPlaces } from './PlacesScreen';
import { SERVICES } from './BookingScreen';
import { anyoneSlots, dayLabel, slotsOf, therapistsAt, urgencyOf, type ServiceId } from '../../data/booking';
import { caseClinic, serviceMismatch, useAllAppointments } from '../../state/appointments';
import { ANY_THERAPIST, AnyTherapistCard, THERAPIST_CARD_W, TherapistCard } from './places/TherapistCard';
import { askAI, extractAI, type AIMessage } from '../../services/aiService';
import { classifyTurn, isPlainAnswer, type Turn, type TurnEnums, type TurnFields } from '../../services/chatTurn';
import { askKnowledge, planMassage } from '../../services/knowledgeSearch';
import { buildIntake } from '../../data/massageIntake';
import { guideFor } from '../../data/treatmentGuides';
import { ALL_RADIATE_OPTIONS, radiateFor, radiateOption, radiatePins } from '../../data/radiation';
import { evaluateSafety } from '../../services/safetyEngine';
import { needsReview } from '../../services/followUpService';
import { useNav } from '../../navigation/types';
import { ALL_SYMPTOMS, CHIP_PINS, HOME_CONTENT } from '../../data/homeContent';
import {
  ASSESS_ORDER,
  PRESSURE_OPTIONS,
  RISK_OPTIONS,
  AVOID_OPTIONS,
  CHAT_HISTORY,
  CURRENT_CHAT,
  TREATMENT_CASES,
  type TreatmentCase,
  SHORT_CAUTION,
  healthAnswerToProfile,
  NEW_TOPIC,
  INTENTS,
  ASSESS_ASK,
  DURATION_OPTIONS,
  CAUSE_OPTIONS,
  HEALTH_OPTIONS,
  blankAssessment,
  CASE_INTENTS,
  NEW_TOPIC_INTENT,
  DRAFT_REASSESS_INTENT,
  FU_ADVERSE,
  FU_RISK,
  caseChatSession,
  welcomeSession,
  type ThreadCard,
  type FollowUpArea,
  type PendingSession,
  HOME_SNAPSHOT,
  STAGES,
  askItem,
  assessmentResults,
  newChatSession,
  newChatWithSymptom,
  type AssessStep,
  type Assessment,
  type ChatSession,
  type ThreadItem,
} from '../../data/homeFeed';
import { AssessWidget, AssessmentTracker } from './home/Assessment';
import { BodyPicker, type BodySelection } from './home/BodyPicker';
import { BookingEditSheet } from './home/BookingEditSheet';
import { StretchSheet, TreatmentSheet } from './home/TreatmentSheet';
import { ELEMENT_INFO, SYMPTOM_GROUPS, birthElement, dominantElement, type ElementKey } from '../../data/thaiMassageKnowledge';
import { STRETCH_MOTION } from '../../data/stretchMotion';
import { PillButton, SourceTag, ThreadCardView } from './home/ThreadCards';
import { afterOf } from './home/TreatmentDetailBody';
import { preVisitRed, preVisitSummary } from '../../data/preVisit';

/** Figma: image 1 — 232×583 วางชิดขวา (แทนด้วยหุ่น 3D) */
/** สัดส่วนกว้าง:สูงของกรอบหุ่น (Figma 232:583) */
/** สัดส่วน canvas หุ่น (กว้าง/สูง) — หุ่นกางแขน (A-pose) จึงกว้างกว่ากรอบ Figma 232×583 · ต้องสัมพันธ์กับ FIT_HALF_WIDTH ใน Body3D */
const BODY_ASPECT = 0.53;
/** ใช้พื้นที่ว่างแนวตั้งกี่ % (ปรับขนาดหุ่นที่ค่านี้) */
const BODY_FILL = 0.94;
/** ระยะเว้นเหนือกรอบหุ่น ให้ศีรษะไม่ชิดปุ่มประวัติ/แจ้งเตือนมุมขวาบน */
const BODY_TOP_CLEAR = space[8];
/** ส่วนของร่างกายที่แตะ → chip อาการที่มีอยู่แล้ว (ที่เหลือสร้าง chip ใหม่ "ปวด<ส่วน>") */
const REGION_CHIP: Record<string, string> = {
  neck: 'ปวดคอ-บ่า',
  shoulderL: 'ปวดไหล่',
  shoulderR: 'ปวดไหล่',
  back: 'ปวดหลัง',
  lowerBack: 'ปวดเอว',
  head: 'ปวดศีรษะ',
};
/** Figma: คอลัมน์ข้อมูลด้านซ้ายกว้าง 179 */
const LEFT_COLUMN = 179;
/* bento หน้าแรก: ระยะห่างช่อง + ความสูงแถว (แถวหุ่นยืดเต็มที่เหลือ) */
const BENTO_GAP = 12;
/** หน้าแรก: bento เริ่มที่สัดส่วนนี้ของความสูงจอ (ด้านบนเห็นหุ่นครึ่งบน) */
/** ข้อมูลหน้าแรกเริ่มที่ 60% ของจอ (ขั้นแรก: เห็นหุ่นเกือบทั้งตัว หมุนได้) → ปัดขึ้น = แผ่นข้อมูลขึ้นมาบังหุ่น (ขั้นที่สอง) */
const BENTO_START = 0.6;
/** ระยะในช่อง bento */
const TILE_PAD = space[4];
/** คลินิกของใบการรักษาตัวอย่าง (ยังไม่มีในข้อมูลใบการรักษา) */
const CASE_CLINIC = 'คลินิกแพทย์แผนไทย สาขาสุขุมวิท';
const BENTO_CASE_H = 40;
/** ระยะระหว่างแท็บที่มองเห็นจริง (gap ของ JellyRadio + ขอบพองตัว) — ใช้เป็นระยะปุ่มประเมินใหม่→แท็บแรก และความกว้างช่วงจางตอนเลื่อน */
const TAB_GAP = 12;
/** โหมด focus: หุ่นใหญ่กลางจอ เลื่อนลงพ้นแถบหัวข้อเล็กน้อย */
const FOCUS_SHIFT = 36;
const FOCUS_SCALE = 0.94;
/** ระยะลากแนวนอนที่นับเป็น "หมุน" แทน "แตะ" */
const DRAG_SLOP = 6;
/** เวลาจำลองที่ AI ใช้คิดก่อนตอบ (ยังไม่เชื่อม AI จริง) */
const THINK_MS = 1800;
/**
 * padding ล่างภายใน header (ใต้ข้อความ) = ช่วงที่เนื้อหาเลื่อนผ่านจะจางหาย
 *   ข้อความ header ─ ช่องว่างล้วน (HEADER_CLEAR) ─ ช่วงจาง (FADE_TAIL) ─ เนื้อหาชัดเต็มที่
 * ตอนอยู่บนสุดเนื้อหาเริ่มที่ตำแหน่งเดิม (ติดใต้ header) และไม่จาง — ช่วงว่าง/จางค่อย ๆ ขยายตามระยะเลื่อนจนเต็มที่ HEADER_PADDING_BOTTOM
 */
/** ScrollView ของ gesture handler บน native — ทำงานร่วมกับท่าลากหมุนหุ่นได้ถูกต้อง */
const BodyScrollView = Platform.OS === 'web' ? Animated.ScrollView : Animated.createAnimatedComponent(GHScrollView);
const BODY_TOUCH_LABEL = 'แตะบนตัวหุ่นเพื่อเลือกตำแหน่งที่มีอาการ ลากซ้ายขวาเพื่อหมุน';
const HEADER_CLEAR = 16;
const FADE_TAIL = 28;
const HEADER_PADDING_BOTTOM = HEADER_CLEAR + FADE_TAIL;

/**
 * หน้าแรก — ตาม Figma "screen-4-home" (node 2:597)
 * - ชั้นหลังสุด: หุ่น 3D ตรึงกับจอ ไม่เลื่อน · แตะพื้นที่ว่างที่ตรงกับตัวหุ่นเพื่อปักจุด · ลากซ้าย/ขวาเพื่อหมุน
 * - ชั้นหน้า: เนื้อหาเลื่อนผ่านหน้าหุ่นได้ (สรุปการประเมิน · AI Care Thread)
 * - การประเมิน (อาการ → อาการร่วม → ความปวด → ระยะเวลา) ถามในแชททีละข้อ · ครบแล้วจึงแสดงแนวทางการรักษา & จุดกดบำบัด
 * - ข้อมูลผู้ป่วย (ชื่อ + ธาตุ) ค้างอยู่ด้านบนเสมอ
 * - ช่องแชท AI + tab bar ติดล่าง
 */
/** ไม่มีครั้งค้างติดตามผล (ค่าแทน กันอ่านค่าว่าง) */
const NO_FU_SESSION = { id: 'none', date: '', plan: '', areas: [{ label: '', pin: 'neck', symptom: '', before: 0 }] } as unknown as TreatmentCase['pending'][number];

/** เปลี่ยนตามคำแนะนำ / ใช้แผนเดิม */
const PLAN_CHOICES = ['เปลี่ยนตามคำแนะนำ', 'ใช้แผนเดิม'];

export function HomeScreen() {
  const nav = useNav();
  const { colors } = useTheme();
  const g = useGrid();
  const insets = useSafeAreaInsets();
  const h = componentTokens.homeHeader;
  const { client, before, setBefore, elements } = useJourney();
  const topElement = dominantElement(elements);
  const scrollRef = React.useRef<ScrollView>(null);
  const bodyRef = React.useRef<Body3DHandle>(null);
  /** หุ่นเล็กในการ์ดประเมิน (หน้าแชท) */
  const chatBodyRef = React.useRef<Body3DHandle>(null);
  /** หน้าเลือกจุดจากหุ่น: เปิดอยู่สำหรับคำถามไหน */
  const [picker, setPicker] = React.useState<null | 'symptoms' | 'related'>(null);
  /** สถานที่ทั้งหมด (bottom sheet ในแชทจอง) */
  const [placesOpen, setPlacesOpen] = React.useState(false);
  /** แก้ไขการจองเอง: การ์ดสรุปที่กำลังแก้ */
  const [editing, setEditing] = React.useState<Extract<ThreadCard, { type: 'bookConfirm' }> | null>(null);

  /* ---------- แชท: เริ่มใหม่ในหน้าเดิม + ประวัติแชท ---------- */
  const [sessions, setSessions] = React.useState<ChatSession[]>([CURRENT_CHAT, ...CHAT_HISTORY]);
  /** แชทของแต่ละเรื่อง: ใบการรักษา → key = case id · ใบร่าง → draft.chatId */
  const [caseChats, setCaseChats] = React.useState<Record<string, string>>({});
  const [activeId, setActiveId] = React.useState(CURRENT_CHAT.id);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  /** หน้าจอเริ่มต้น: มีแค่ข้อมูลผู้ป่วย + หุ่น + ปุ่ม "ประเมินคัดกรองโดย AI" · กดแล้วจึงเปิดแชท AI */
  const [started, setStarted] = React.useState(false);
  /** ติดตามผลบนหุ่น: คำตอบของผู้ใช้ (null = ยังไม่ตอบ) */
  /* ---------- ติดตามผลบนหุ่น ----------
   * หน้าแรก: แสดง mark ทุกบริเวณที่เคยรักษา (ดูอย่างเดียว กดไม่ได้) + การ์ด "ติดตามอาการหลังรักษา"
   * กดการ์ด → โหมด focus: widget อื่นหายหมด เหลือหุ่น · พาไปทีละจุด (หมุนหุ่น → เส้นวิ่ง → ป้ายให้คะแนน) → ส่งรวมทีเดียว */
  /** ใบการรักษาที่เลือกดู (แยกตามโรค) — mark บนหุ่น · ผลการรักษา · ติดตามอาการ ตามใบนี้ */
  const [caseIdx, setCaseIdx] = React.useState(0);
  /** คนไข้ใหม่ (สมัครเอง ยังไม่มีใบการรักษา) — หน้าแรกเปลี่ยนตามข้อมูลที่มี: ไม่มีอะไร = แชท · ประเมินแล้ว = ใบร่าง · รักษาแล้ว = ใบการรักษา */
  const { newPatient, setNewPatient, account, careStage, setCareStage, setLastAssess, profile, setProfile, drafts, upsertDraft, setActiveDraftId, promoted, followUps, looseBookings, addLooseBooking, removeLooseBooking, log, markEntered } = useJourney();
  // ถึงหน้าแรกแล้ว → เริ่มจำข้อมูลข้ามการรีเฟรช
  React.useEffect(() => markEntered(), [markEntered]);
  /** หัวข้อ "เรื่องเดิมหรืออาการใหม่" — ถามเฉพาะเมื่อมีใบอยู่แล้ว */
  /** ยังไม่มีข้อมูลอะไรเลย → หน้าแรกคือแชท (คำถามแนะนำ) · ไม่มีปุ่มออกจากแชท */
  // ยังไม่มีใบร่าง/ใบการรักษา
  const noRecords = newPatient && drafts.length === 0 && promoted.length === 0;
  // จองไว้ก่อนประเมิน → หน้าแรกแบบปกติ (หุ่น + แผ่นการ์ด) แสดงเฉพาะข้อมูลนัด · ไม่มีอะไรเลย = หน้าต้อนรับ
  const bookedOnly = noRecords && looseBookings.length > 0;
  const chatHome = noRecords && !looseBookings.length;
  /** ใบการรักษา = ของคนไข้ตัวอย่าง + ใบที่เพิ่งเกิดจากใบร่าง (นวดครั้งแรกแล้ว) */
  // ใบการรักษาชุดเดียวกับทุกหน้า (รวมนัดที่จอง/เลื่อน/ยกเลิก และครั้งที่นวดเพิ่ม)
  const { caseAppts, setCaseAppointment, cancelledAppts, cases, issueQueue, caseToday, setCaseToday, apptNotices, dismissNotice, requestBooking, notifyClinic } = useJourney();
  const allAppts = useAllAppointments();
  // แจ้งเตือน: กระดิ่งบนหัวหน้าแรก (จำนวนที่ยังไม่อ่าน) → หน้ารายการแจ้งเตือน
  const unread = apptNotices.filter((n) => !n.read).length;
  const allTopics = [...cases.map((c) => c.short), ...drafts.map((d) => d.title)];
  /** คนไข้ใหม่: ธาตุกำเนิดจากวันเกิดที่ลงทะเบียน (ยังไม่ได้ทำแบบประเมินธาตุปัจจุบัน) */
  const bornElement = account ? birthElement(account.birthDate) : null;
  /** pill ต่อจากชื่อ: ธาตุกำเนิด (คนไข้ใหม่) หรือธาตุจากแบบประเมิน */
  // คนใหม่: ธาตุเจ้าเรือน (วันเกิด) จนกว่าจะทำแบบประเมินธาตุ → ใช้ผลประเมิน
  const { elementsDone } = useJourney();
  const tagElement = newPatient && !elementsDone ? bornElement : topElement;
  const elementTag = tagElement ? `ธาตุ${tagElement}` : null;
  /* แท็บบนหน้าแรก = ใบการรักษา (คนไข้เดิม) + ใบร่างจากการประเมิน */
  const caseCount = cases.length;
  /* แท็บ = เรื่องที่ดูแลอยู่ (1 แท็บ = 1 เรื่อง = 1 แชท) + "ประเมินคัดกรองใหม่" ท้ายสุด
   * ปุ่มม่วงเปลี่ยนตามแท็บ: รักษา → ติดตามผลกับ AI · ประเมิน → ประเมินคัดกรองอีกครั้ง · ใหม่ → เริ่มประเมินคัดกรอง */
  const selDraft = caseIdx >= caseCount ? drafts[caseIdx - caseCount] ?? null : null;
  const selCase = caseIdx < caseCount;
  // นัดเรื่องใหม่ที่จองไว้ก่อนประเมิน → แท็บละนัด ต่อท้าย · แสดงเฉพาะข้อมูลนัด
  const selLoose = caseIdx >= caseCount + drafts.length ? looseBookings[caseIdx - caseCount - drafts.length] ?? null : null;
  // เพิ่งจองนัดเรื่องใหม่เพิ่ม → หน้าแรกเปิดที่แท็บนัดนั้น
  const looseCount = React.useRef(looseBookings.length);
  React.useEffect(() => {
    if (looseBookings.length > looseCount.current) setCaseIdx(caseCount + drafts.length + looseBookings.length - 1);
    else if (caseIdx >= caseCount + drafts.length + looseBookings.length) setCaseIdx(Math.max(0, caseCount + drafts.length + looseBookings.length - 1));
    looseCount.current = looseBookings.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [looseBookings.length]);
  /** แชทประเมินที่เริ่มจากแท็บนัดเรื่องใหม่ → ประเมินเสร็จ นัดนั้นผูกกับเรื่องที่ประเมิน */
  const looseFor = React.useRef<Record<string, string>>({});
  /** คำตอบข้ออื่นที่ผู้ใช้บอกมาก่อนถึงข้อนั้น (เช่น "ปวดคอ 7 เป็นมา 3 วัน") → ถึงข้อนั้นแล้วข้าม ไม่ถามซ้ำ · แยกตามแชท */
  const prefill = React.useRef<Record<string, Partial<Assessment>>>({});
  /** คำถามที่ค้างก่อนถามยืนยัน (เช่น ร้องเรียน) → ตอบยืนยันแล้วกลับมาถามต่อ */
  const afterChoice = React.useRef<ThreadItem[]>([]);
  const tcase = cases[Math.min(caseIdx, cases.length - 1)] ?? TREATMENT_CASES[0];
  // โหลดข้อมูลของเรื่องที่เลือก (ครั้งแรก) → skeleton ของการ์ดหน้าแรก
  const homeLoading = useScreenData(`home-${selDraft?.id ?? tcase.id}`);
  /* ปุ่มม่วงเป็นทางเดียวที่ประเมิน — มีใบอยู่แล้ว AI ถามก่อนว่าเรื่องเดิมหรืออาการใหม่ · ใบที่กำลังดูอยู่ขึ้นเป็นตัวเลือกแรก */
  const currentTopic = selDraft?.title ?? (newPatient ? undefined : tcase.short);
  const topicOptions = [...(currentTopic ? [currentTopic] : []), ...allTopics.filter((t) => t !== currentTopic), NEW_TOPIC];
  // แท็บบอกเรื่องอยู่แล้ว → ไม่ต้องถาม "เรื่องเดิมหรืออาการใหม่"
  const askTopic = false;
  const fuSessions = tcase.pending;
  /** ลำดับจุดที่พาไปในโหมด focus: ทุกบริเวณของทุกครั้งที่ค้างติดตามในใบนี้ */
  const fuSteps = React.useMemo(() => fuSessions.flatMap((ss, si) => ss.areas.map((_, ai) => ({ si, ai }))), [fuSessions]);
  const [fuStep, setFuStep] = React.useState(0);
  /** คะแนนที่ยืนยันแล้ว (ปล่อยนิ้ว) ต่อบริเวณ — key = sessionId:pin */
  const [fuScores, setFuScores] = React.useState<Record<string, number>>({});
  const [focus, setFocus] = React.useState(false);
  const focusAnim = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(focusAnim, { toValue: focus ? 1 : 0, duration: 380, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }).start();
  }, [focus, focusAnim]);
  const focusOut = { opacity: focusAnim.interpolate({ inputRange: [0, 0.6], outputRange: [1, 0], extrapolate: 'clamp' }) };
  /** ส่งผลแล้ว (รอบนี้) — ป้ายจุดสุดท้ายเปลี่ยนเป็นสรุป */
  const [fuResult, setFuResult] = React.useState<{ reviewArea?: FollowUpArea } | null>(null);
  // เรื่องที่ไม่มีครั้งค้างติดตามผล → ไม่มีขั้นให้ทำ (กันหน้าแรกพังเมื่อ pending ว่าง)
  const fuStepInfo = fuSteps[Math.min(fuStep, fuSteps.length - 1)] ?? { si: 0, ai: 0 };
  const fuSession = fuSessions[fuStepInfo.si] ?? NO_FU_SESSION;
  const fuActive = fuSession.areas[fuStepInfo.ai] ?? NO_FU_SESSION.areas[0];
  const fuKey = (pin: string) => `${fuSession.id}:${pin}`;
  const { sendFollowUp } = useJourney();
  const submitAllFollowUps = async () => {
    const recs = [];
    for (const ss of fuSessions) {
      const areas = ss.areas
        .filter((a) => fuScores[`${ss.id}:${a.pin}`] !== undefined)
        .map((a) => ({ area: a.label, painBefore: a.before, painAfter: fuScores[`${ss.id}:${a.pin}`] }));
      if (areas.length) recs.push({ ss, rec: await sendFollowUp({ sessionId: ss.id, sessionDate: ss.date, areas }) });
    }
    const hit = recs.flatMap(({ ss, rec }) => ss.areas.filter((a) => rec.areas.some((x) => x.area === a.label && needsReview(x))));
    setFuResult({ reviewArea: hit[0] });
  };
  const openFocus = () => {
    setFuStep(0);
    setFuResult(null);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    setFocus(true);
  };
  /** ปุ่ม × ของโหมด focus: ให้ป้ายเล่นแอนิเมชันปิดก่อน (ถ้ามี) แล้วจึงออก */
  const [fuCloseReq, setFuCloseReq] = React.useState(0);
  const exitFocus = () => (areaPt ? setFuCloseReq((n) => n + 1) : setFocus(false));

  /** 0 = หน้าเริ่มต้น (หุ่นใหญ่ กลางจอ หันตรง) → 1 = หลังเริ่มประเมิน (หุ่นชิดขวา เอียงตัว + แชทโผล่) */
  const intro = React.useRef(new Animated.Value(0)).current;
  /** กำลังออกจากแชท (ย้อน transition กลับหน้าเริ่มต้น) */
  const [leaving, setLeaving] = React.useState(false);
  const INTRO_EASE = Easing.bezier(0.22, 1, 0.36, 1);
  React.useEffect(() => {
    if (!started) return;
    Animated.timing(intro, { toValue: 1, duration: 700, easing: INTRO_EASE, useNativeDriver: true }).start(() =>
      // หุ่นถูกย่อ/ขยับด้วย transform → วัดตำแหน่งใหม่ให้การแตะบนหุ่นตรงจุด
      bodyRef.current?.remeasure(),
    );
  }, [started, intro]);
  /** คนที่ยังไม่มีข้อมูล: แตะปุ่ม AI กลางจอ → เข้าแชทที่ AI ถามว่าวันนี้ให้ช่วยเรื่องอะไร (แชทต้อนรับเดิมที่ยังไม่ได้คุย = ใช้ต่อ) */
  /** แตะทางลัดในหน้าต้อนรับ → เข้าแชทแล้วเลือกหัวข้อนั้นให้เลย */
  const pendingIntent = React.useRef<string | null>(null);
  /** ประเมินค้างไว้ (ออกจากแชทก่อนจบ) → กลับมาทำต่อจากข้อเดิม ไม่ต้องตอบใหม่ */
  // ทุกคน (ไม่ใช่แค่คนใหม่): แชทประเมินที่ยังไม่จบ และไม่ใช่แชทของใบที่มีอยู่แล้ว
  const unfinished = sessions.find(
    (c) =>
      c.id !== CURRENT_CHAT.id &&
      c.assess.step !== 'idle' &&
      c.assess.step !== 'done' &&
      c.items.some((m) => m.from === 'user') &&
      !drafts.some((d) => d.chatId === c.id) &&
      !Object.values(caseChats).includes(c.id),
  );
  const startWelcome = (intent?: string, fresh = false) => {
    if (!fresh && intent === INTENTS[0] && unfinished) return openChat(unfinished.id);
    pendingIntent.current = intent ?? null;
    const unused = sessions.find((c) => c.id.startsWith('w') && c.items.length === 1);
    const w = unused ?? welcomeSession();
    if (!unused) setSessions((all) => [w, ...all]);
    setActiveId(w.id);
    setStarted(true);
  };
  const active = sessions.find((c) => c.id === activeId) ?? sessions[0];
  React.useEffect(() => {
    if (!started || !pendingIntent.current || !active.id.startsWith('w')) return;
    // รอแชทเลื่อนเข้าที่ก่อน แล้วค่อยตอบหัวข้อที่แตะมา
    const t = setTimeout(() => {
      const i = pendingIntent.current;
      pendingIntent.current = null;
      if (i) (INTENTS.includes(i) ? pickIntent(i) : send(i));
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, activeId]);
  /** หุ่นซ่อนอยู่จนกว่าจะมีเรื่องเกี่ยวกับร่างกาย: แชทครั้งแรกที่ยังไม่เริ่มประเมิน (คุยเรื่องอื่น เช่น หาที่นวด/ธาตุ ก็ยังไม่มีหุ่น) */
  // (เฟรมแรกก่อนสลับไปแชทต้อนรับ active ยังเป็นแชทตัวอย่าง → นับว่าซ่อน ไม่ให้หุ่นกะพริบ)
  const bodyHidden = chatHome && started && (active.assess.step === 'idle' || active.id === CURRENT_CHAT.id);
  const bodyIn = React.useRef(new Animated.Value(bodyHidden ? 0 : 1)).current;
  React.useEffect(() => {
    Animated.timing(bodyIn, { toValue: bodyHidden ? 0 : 1, duration: 520, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }).start(() => bodyRef.current?.remeasure());
  }, [bodyHidden, bodyIn]);
  const sessionsRef = React.useRef(sessions);
  sessionsRef.current = sessions;
  const thread = active.items;
  /** คำถามประเมินข้อล่าสุด (ถามซ้ำได้หลายครั้ง → แสดงตัวเลือกที่อันล่าสุด) */
  const lastAskId = [...thread].reverse().find((m) => m.ask && m.ask === active.assess.step)?.id;
  /** ตำแหน่งกล่องสรุปการประเมินในแชท: คำถามที่กำลังถาม (ครบแล้ว = การ์ดสรุปอาการ) */
  const trackerAt = (() => {
    const st = active.assess.step;
    if (st === 'idle') return -1;
    for (let k = active.items.length - 1; k >= 0; k--) {
      const it = active.items[k];
      if (st === 'done' ? it.card?.type === 'screening' : it.ask === st) return k;
    }
    return -1;
  })();
  const assess = active.assess;
  /** แก้แชทตาม id (ใช้ id ที่จับไว้ เพื่อให้คำตอบที่มาช้ากลับเข้าแชทเดิมแม้ผู้ใช้สลับแชทแล้ว) */
  const updateSession = (sid: string, fn: (c: ChatSession) => ChatSession) =>
    setSessions((all) =>
      all.map((c) => {
        if (c.id !== sid) return c;
        const next = fn(c);
        // แชทใหม่ตั้งชื่อตามคำตอบแรกของผู้ใช้
        const firstUser = next.items.find((m) => m.from === 'user')?.text;
        return { ...next, title: next.title === 'แชทใหม่' && firstUser ? firstUser : next.title };
      }),
    );
  const setThread = (fn: (t: ThreadItem[]) => ThreadItem[], sid = activeId) => updateSession(sid, (c) => ({ ...c, items: fn(c.items) }));
  const setAssess = (fn: (a: Assessment) => Assessment, sid = activeId) => updateSession(sid, (c) => ({ ...c, assess: fn(c.assess) }));
  const threadY = React.useRef(0);
  const itemY = React.useRef<Record<string, number>>({});
  const scrollToY = (y: number) => setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, y - space[4]), animated: true }), 50);
  const scrollToThread = () => scrollToY(threadY.current);
  const scrollToEnd = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

  /* ---------- อาการที่เลือก = mark บนหุ่น (ข้อมูลชุดเดียวกัน · เก็บแยกตามแชท) ----------
   * sel[label] = null → เลือกจาก chip (ใช้ตำแหน่งมาตรฐานของอาการนั้น)
   * sel[label] = จุด[] → มาจากการแตะบนหุ่น (ใช้ตำแหน่งที่แตะจริง)
   */
  const sel = assess.sel;
  const setSel = (fn: (cur: Record<string, BodyPoint[] | null>) => Record<string, BodyPoint[] | null>) => setAssess((a) => ({ ...a, sel: fn(a.sel) }));
  const setExtraSymptoms = (fn: (ex: string[]) => string[]) => setAssess((a) => ({ ...a, extra: fn(a.extra) }));
  const symptomOptions = [...HOME_CONTENT.symptoms, ...assess.extra];
  const selectedIn = (opts: string[]) => opts.filter((o) => o in sel);
  const onChipsChange = (opts: string[]) => (next: string[]) => {
    // เลือกอาการใหม่ → หันหุ่นให้เห็นตำแหน่งนั้น (อาการด้านหลังเช่น ปวดหลัง → หันหลัง)
    const added = next.find((o) => !(o in sel));
    if (added) {
      const anchors = CHIP_PINS[added] ?? [];
      if (anchors.length) {
        bodyRef.current?.face(anchors.every(isBackPin) ? 'back' : 'front');
        chatBodyRef.current?.face(anchors.every(isBackPin) ? 'back' : 'front');
      }
    }
    setSel((cur) => {
      const out = { ...cur };
      opts.forEach((o) => {
        if (next.includes(o) && !(o in out)) out[o] = null;
        if (!next.includes(o) && o in out) delete out[o];
      });
      return out;
    });
    // chip ที่เกิดจากการแตะหุ่น: ยกเลิกแล้วเอาออกจากรายการ
    setExtraSymptoms((ex) => ex.filter((e) => next.includes(e) || !opts.includes(e)));
  };
  /** เลือกตำแหน่งที่ไม่อยู่ใน chip ด่วน (จากรายการทั้งร่างกาย / AI อ่านจากข้อความ) → เพิ่มเป็น chip + mark + หันหุ่นไปทางนั้น */
  const pickSymptoms = (labels: string[]) => {
    if (!labels.length) return;
    setExtraSymptoms((ex) => [...ex, ...labels.filter((l) => !HOME_CONTENT.symptoms.includes(l) && !ex.includes(l))]);
    setSel((cur) => ({ ...cur, ...Object.fromEntries(labels.filter((l) => !(l in cur)).map((l) => [l, null])) }));
    const first = CHIP_PINS[labels[0]]?.[0];
    if (first) {
      bodyRef.current?.facePin(first);
      chatBodyRef.current?.facePin(first);
    }
  };
  const done = assess.step === 'done';
  // จุดกดบำบัดตามแนวทางล่าสุดในแชท (ตามตำแหน่งที่ปวดจริง)
  const guidePins = React.useMemo(() => {
    const g = [...thread].reverse().find((m) => m.card?.type === 'guideline')?.card;
    return g?.type === 'guideline' ? g.pins ?? [] : [];
  }, [thread]);
  /* สี mark ตามคะแนนปวด (เขียว → เหลือง → แดง แบบเดียวกับ Pain Score) · ยังไม่ได้ตอบระดับปวด = สีอาการเดิม */
  const painAnswered = assess.step === 'done' || ASSESS_ORDER.indexOf(assess.step as (typeof ASSESS_ORDER)[number]) > ASSESS_ORDER.indexOf('pain');
  const symptomColor = painAnswered ? painColorOf(assess.pain) : undefined;
  const pins = React.useMemo(
    () => [
      ...Object.entries(sel)
        .filter(([, pts]) => pts === null)
        .flatMap(([c]) => (CHIP_PINS[c] ?? []).map((at) => ({ at, tone: 'symptom' as const, color: symptomColor }))),
      // จุดกดบำบัดขึ้นบนหุ่นหลังประเมินครบแล้วเท่านั้น
      // บริเวณที่ร้าวไป (อาการเดียวกัน แสดงต่อจากจุดที่ปวด)
      ...radiatePins(assess.radiate, radiateFor(Object.keys(sel))?.symptom).map((at) => ({ at, tone: 'symptom' as const, color: symptomColor })),
      ...(done ? guidePins.map((at) => ({ at, tone: 'point' as const })) : []),
      // หน้าเริ่มต้น: บริเวณที่รักษาครั้งล่าสุด
      // สีตามคะแนนปวดที่ผู้ใช้ให้ (ยังไม่ให้ = สีแบรนด์)
      // หน้าเริ่มต้น: ทุกบริเวณของครั้งที่กำลังติดตาม · สีตามคะแนนที่ให้ (ยังไม่ให้ = สีแบรนด์)
      // หน้าเริ่มต้น: mark ทุกบริเวณที่ค้างติดตาม (ทุกครั้งการรักษา) · สีตามคะแนนที่ให้ (ยังไม่ให้ = สีแบรนด์)
      // ใบร่าง: mark ตรงจุดที่บอกว่าปวด
      // ใบร่าง: สีตามคะแนนปวดที่ประเมินไว้
      ...(!started && selDraft ? selDraft.symptoms.flatMap((c) => (CHIP_PINS[c] ?? []).map((at) => ({ at, tone: 'symptom' as const, color: painColorOf(selDraft.pain) }))) : []),
      ...(!started && selCase
        ? tcase.areas.map((a) => {
            // คะแนนติดตามผลล่าสุด · ยังไม่ให้ = คะแนนหลังนวดครั้งล่าสุด
            const v = fuSessions.map((ss) => fuScores[`${ss.id}:${a.pin}`]).find((x) => x !== undefined) ?? tcase.visits[tcase.visits.length - 1]?.painAfter;
            return { at: a.pin, tone: 'point' as const, color: v === undefined ? undefined : painColorOf(v) };
          })
        : []),
    ],
    [sel, assess.radiate, done, guidePins, started, fuScores, tcase, fuSessions, newPatient, selDraft, selCase, symptomColor],
  );
  const marks = React.useMemo(() => Object.values(sel).flatMap((pts) => pts ?? []), [sel]);

  /** แตะบนหุ่น → เลือก chip ของส่วนนั้น (หรือเพิ่ม chip ใหม่) · แตะจุดเดิม → ยกเลิก · ใช้ได้ระหว่างถามอาการ/อาการร่วม */
  /** โหมด focus: mark ที่อยู่ใกล้ตำแหน่งแตะ (ระยะนิ้ว 44px) → ลำดับขั้น */
  const markStepAt = (pageX: number, pageY: number) => {
    let best = -1;
    let bestD = 44;
    fuSteps.forEach((st, i) => {
      const q = bodyRef.current?.projectPin(fuSessions[st.si].areas[st.ai].pin);
      if (!q) return;
      const d = Math.hypot(q.x - pageX, q.y - pageY);
      if (d < bestD) (bestD = d), (best = i);
    });
    return best;
  };
  const onFocusTap = (pageX: number, pageY: number) => {
    if (fuResult) return;
    const i = markStepAt(pageX, pageY);
    // ข้ามไปจุดที่ยังไม่ถึงไม่ได้ — ย้อนดู/แก้จุดที่ให้คะแนนแล้วได้
    const firstOpen = fuSteps.findIndex((st) => fuScores[`${fuSessions[st.si].id}:${fuSessions[st.si].areas[st.ai].pin}`] === undefined);
    const maxStep = firstOpen === -1 ? fuSteps.length - 1 : firstOpen;
    if (i >= 0 && i !== fuStep && i <= maxStep) setFuStep(i);
  };
  const onBodyTap = (pageX: number, pageY: number) => {
    if (!started) {
      // โหมด focus: แตะ mark = ข้ามไปจุดนั้น · หน้าแรก: แตะตรงที่ปวด = เริ่มประเมินโดยเลือกจุดนั้นไว้ให้
      if (focus) onFocusTap(pageX, pageY);
      // ยังไม่มีข้อมูล → เริ่มด้วยปุ่ม ThaiWell AI กลางจอ (แตะหุ่นไม่เริ่มประเมิน)
      else if (!chatHome) startFromBody(pageX, pageY);
      return;
    }
    // แชท: ไม่แตะเลือกบนหุ่นตรง ๆ แล้ว → ปุ่ม "ชี้จุดบนหุ่น" / แตะหุ่นเล็กในการ์ดประเมิน เปิดหน้าเลือกจุด (BodyPicker)
  };

  /**
   * หน้าแรก: แตะหุ่นตรงที่ปวด → แชทประเมินใหม่ที่ตอบข้อ "ปวดตรงไหน" ไว้แล้ว (จุดที่แตะ) → ถามอาการร้าว/อาการร่วมต่อ
   * เลือกแท็บเรื่องที่รักษาอยู่ → หัวข้อ = เรื่องนั้น (บริเวณเดิม/ใหม่ แยกตามกฎเดิมตอนสรุปผล)
   */
  const startFromBody = (pageX: number, pageY: number) => {
    const pick = bodyRef.current?.pickAt(pageX, pageY);
    if (!pick?.region) return;
    const label = labelOfRegion(pick.region);
    const r = radiateFor([label]);
    const next = r ? ('radiate' as const) : ('related' as const);
    const base = newChatSession();
    const time = nowTimeText();
    const ss: ChatSession = {
      ...base,
      title: `ประเมิน${label}`,
      items: [...base.items, { id: `u${Date.now()}`, day: 'today', from: 'user', text: label, time }, askItem(next, 'รับทราบค่ะ', r ? `${r.symptom}ร้าวไปที่อื่นไหมคะ?` : undefined)],
      assess: { ...blankAssessment(), step: next, sel: { [label]: [pick.point] }, extra: HOME_CONTENT.symptoms.includes(label) ? [] : [label], topic: selCase ? tcase.short : undefined },
    };
    log('ผู้รับบริการ', `แตะหุ่นเริ่มประเมิน: ${label}`);
    setSessions((all) => [ss, ...all]);
    openChat(ss.id);
  };

  /* ---------- จองกับ AI ในแชท: แนะนำสถานที่ตามแนวทาง → เลือกเวลา → ยืนยัน ----------
   * ทางไม่ใช้ AI ยังอยู่: แท็บสถานที่ / หน้าจอง (BookingScreen) · ผลคัดกรองให้พบแพทย์ = ไม่มีปุ่มจอง */
  const latestGuide = () => {
    const g = [...thread].reverse().find((m) => m.card?.type === 'guideline')?.card;
    return g?.type === 'guideline' ? g : null;
  };
  /** วิเคราะห์ก่อนจอง: นัดเรื่องอะไร (ใบประเมินของแชทนี้ / เรื่องที่รักษาอยู่) · เร่งด่วนแค่ไหน (กฎตายตัวจากผลประเมิน) */
  const bookingContext = () => {
    const draft = drafts.find((d) => d.chatId === activeId);
    const ofCase = chatCase();
    const topic = draft?.title ?? (ofCase ? `${ofCase.short} ครั้งที่ ${ofCase.course.done + 1}/${ofCase.course.total}` : undefined) ?? (Object.keys(assess.sel).filter((k) => !HOME_CONTENT.related.includes(k)).join(', ') || 'อาการปวด');
    const safetyCard = [...thread].reverse().find((m) => m.card?.type === 'safety')?.card;
    const level = safetyCard?.type === 'safety' ? safetyCard.level : 'green';
    return { topic, urgency: urgencyOf(assess, level), red: level === 'red' };
  };
  /** บริการที่จองในแชท: เรื่องที่รักษาอยู่ = ตามแผนเดิม · ใบร่าง = ตามแนวทาง (มีประคบ = นวด + ประคบ) → กรองแพทย์ที่ลงตารางรับบริการนี้ */
  const chatService = (): ServiceId => {
    const tc = chatCase();
    const compress = tc ? tc.plan.includes('ประคบ') : (latestGuide()?.methods ?? []).some((m) => m.includes('ประคบ'));
    return compress ? 'royal+compress' : 'royal';
  };
  /** กันแตะซ้ำเร็ว ๆ (ยืนยันจอง/ตอบติดตามผลซ้ำสองครั้งก่อนหน้าจอเปลี่ยน → ข้อความ/การส่งซ้ำ) */
  const tapGuard = React.useRef(0);
  const once =
    <A extends unknown[]>(fn: (...a: A) => void) =>
    (...a: A) => {
      const n = Date.now();
      if (n - tapGuard.current < 900) return;
      tapGuard.current = n;
      fn(...a);
    };
  /** ติดตามผลแล้วมีอาการที่ต้องให้แพทย์ดู (เช่น ชา/อ่อนแรง) → งดจองนวดของเรื่องนั้นจนกว่าแพทย์ตรวจ */
  const [urgentCases, setUrgentCases] = React.useState<Record<string, string>>({});
  /** แชทนี้เป็นของใบการรักษาไหน (ไม่ใช่ใบร่าง/แชทใหม่) */
  const chatCase = () => cases.find((c) => caseChats[c.id] === activeId || c.chatId === activeId);
  /**
   * จองนัดครั้งถัดไปของเรื่องที่รักษาอยู่ — สถานที่เดิม · แนะนำผู้ให้บริการที่ดูแลอยู่ · บริการตามแผนเดิม
   * มีนัดค้าง = เลื่อนนัดนั้น · ไม่มี = จองครั้งถัดไป · ต่อด้วยขั้นตอนจองเดิม (ผู้ให้บริการ → เวลา → ยืนยัน)
   */
  const startCaseBooking = (userText: string) => {
    const tc = chatCase();
    if (!tc) return startBooking(userText);
    const { urgency, red } = bookingContext();
    // ผลล่าสุดให้พบแพทย์ (ประเมิน/ติดตามผล) → ไม่จองนวดต่อ
    if (red || urgentCases[tc.id])
      return aiReply(activeId, userText, () => [{ ...aiText('ยังไม่ควรนวดจนกว่าแพทย์จะตรวจค่ะ', { type: 'action', label: 'ดูคำแนะนำ', to: 'RedFlag' }), source: 'Safety Rule Engine' as const }]);
    const has = tc.appointment.date !== '-';
    // มีนัดของการรักษาแล้ว → ดูนัดได้ · เลื่อน/ยกเลิกทำที่คลินิก (หลังบ้านโรงพยาบาลจัดคิวใหม่แล้วแจ้งกลับในแอป)
    if (has)
      return aiReply(activeId, userText, () => [
        {
          ...aiText(`นัดครั้งที่ ${Math.min(tc.course.total, tc.course.done + 1)}/${tc.course.total} ของคุณค่ะ ถ้าต้องการเลื่อนหรือยกเลิก ติดต่อคลินิก ${clinicPhone(caseClinic(tc))} คลินิกจะจัดคิวใหม่และแจ้งกลับในแอป`, {
            type: 'appointment',
            date: tc.appointment.today ? 'วันนี้' : tc.appointment.date,
            time: tc.appointment.time,
            place: caseClinic(tc),
            therapist: tc.therapist,
            caseId: tc.id,
          }),
          source: 'ระบบนัดหมาย' as const,
        },
      ]);
    // ยังไม่มีนัดครั้งถัดไป → แพทย์นัดให้ตามแผน (ผู้ใช้ไม่จองเองสำหรับเรื่องนี้)
    if (tc.course.done < tc.course.total)
      return aiReply(activeId, userText, () => [
        {
          ...aiText(`นัดครั้งที่ ${tc.course.done + 1}/${tc.course.total} แพทย์จะนัดให้ตามแผนการรักษา และแจ้งเตือนในแอปค่ะ ถ้าต้องการนวดเรื่องอื่นหรือนวดเพื่อสุขภาพ จองเพิ่มได้ที่หน้าสถานที่`, { type: 'action', label: 'ติดต่อคลินิก', to: 'CallClinic' }),
          source: 'ระบบนัดหมาย' as const,
        },
      ]);
    // ครบคอร์สแล้ว (และไม่มีนัดค้าง) → ไม่จอง "ครั้งที่ 7/6"
    if (!has && tc.course.done >= tc.course.total)
      return aiReply(activeId, userText, () => [{ ...aiText(`ครบคอร์ส${tc.short} ${tc.course.total} ครั้งแล้วค่ะ ถ้ายังมีอาการ ประเมินใหม่เพื่อวางแผนต่อได้`, { type: 'action', label: 'ประเมินอาการ', to: 'assess' }), source: 'ระบบนัดหมาย' as const }]);
    // รักษาต่อที่เดิมเท่านั้น
    const place = PLACES.find((p) => p.name === caseClinic(tc)) ?? PLACES[0];
    const service = chatService();
    const list = therapistsAt(place.id, service);
    const mine = list.find((t) => t.name === tc.therapist);
    // ผู้ดูแลเดิมไม่ได้อยู่ที่นี่ → แนะนำแพทย์แผนไทยที่ว่างเร็วสุด 1 คน
    const rec = mine ?? list.find((t) => t.role === 'แพทย์แผนไทย');
    aiReply(activeId, userText, () => [
      {
        ...aiText(
          `${has ? `เลื่อนนัด ${tc.appointment.date} ${tc.appointment.time}` : `จองครั้งที่ ${tc.course.done + 1}/${tc.course.total}`} ที่${place.name}ค่ะ${mine ? ` แนะนำ${mine.name}ที่ดูแลเรื่องนี้อยู่` : rec ? ` แนะนำ${rec.name} ว่างเร็วสุด` : ''}`,
          {
            type: 'therapistPick',
            placeId: place.id,
            service,
            options: list.map((t) => ({ id: t.id, name: t.name, role: t.role, next: slotsOf(t, urgency).labels[0] ?? 'ไม่มีคิวว่าง', recommended: t.id === rec?.id })),
          },
        ),
        source: 'ระบบนัดหมาย' as const,
      },
    ]);
  };
  const startBooking = (userText = 'จองนัดตามแนวทางนี้') =>
    aiReply(activeId, userText, () => {
      const g = latestGuide();
      const { topic, urgency, red } = bookingContext();
      if (red) return [{ ...aiText('ยังไม่ควรนวดจนกว่าแพทย์จะตรวจค่ะ', { type: 'action', label: 'ดูคำแนะนำ', to: 'RedFlag' }), source: 'Safety Rule Engine' as const }];
      // เรื่องนี้จองไว้แล้ว → แสดงนัดเดิม (เลื่อนได้จากการ์ด) ไม่ให้จองซ้อน
      const own = drafts.find((d) => d.chatId === activeId);
      if (own?.booking)
        return [
          {
            ...aiText(`เรื่องนี้มีนัดอยู่แล้วค่ะ ต้องการเปลี่ยนเวลา กดเลื่อนนัดได้เลย`, { type: 'appointment', date: own.booking.date, time: own.booking.time, place: own.booking.clinic, therapist: own.booking.therapist, draftId: own.id }),
            source: 'ระบบนัดหมาย' as const,
          },
        ];
      const ranked = rankPlaces(g?.methods ?? []);
      if (!ranked.length) return [aiText('ใกล้คุณยังไม่มีที่ว่างตรงแนวทางค่ะ ลองดูสถานที่อื่นได้', { type: 'action', label: 'ดูสถานที่ทั้งหมด', to: 'Places' })];
      // คิวแพทย์แผนไทยที่ว่างเร็วสุดของแต่ละที่
      const firstFree = (placeId: string) => {
        const t = therapistsAt(placeId).find((x) => x.role === 'แพทย์แผนไทย');
        return t ? slotsOf(t, urgency).labels[0] ?? '' : '';
      };
      const top = ranked[0];
      return [
        {
          ...aiText(`นัดเรื่อง${topic}ค่ะ ${urgency.label}${urgency.reason ? ` (${urgency.reason})` : ''}\n\nแนะนำ${top.place.name} ${top.reason} ห่าง ${top.place.km} กม.`, {
            type: 'placePick',
            options: ranked.map((r) => ({ id: r.place.id, name: r.place.name, km: r.place.km, reason: r.reason, slot: firstFree(r.place.id) })),
          }),
          source: 'ระบบนัดหมาย' as const,
        },
      ];
    });
  /** เลือกสถานที่ → เลือกผู้ให้บริการ (แพทย์แผนไทยที่ว่างทันตามความเร่งด่วน = แนะนำ) */
  const pickPlace = (placeId: string) => {
    const p = PLACES.find((x) => x.id === placeId);
    if (!p) return;
    const { urgency } = bookingContext();
    const service = chatService();
    const list = therapistsAt(placeId, service);
    // ที่นี่ยังไม่มีตารางผู้ให้บริการให้จองผ่านแชท → ไปจองเองที่หน้าจอง
    if (!list.length)
      return aiReply(activeId, p.name, () => [
        { ...aiText(`${p.name}ยังจองผ่านแชทไม่ได้ค่ะ${p.therapy ? '' : ' และไม่มีแพทย์แผนไทย เหมาะกับนวดเพื่อสุขภาพ'} จองเองที่หน้าจองได้`, { type: 'action', label: 'ไปหน้าจอง', to: 'Booking' }), source: 'ระบบนัดหมาย' as const },
      ]);
    const recId = list.find((t) => t.role === 'แพทย์แผนไทย' && slotsOf(t, urgency).recommended)?.id ?? list.find((t) => t.role === 'แพทย์แผนไทย')?.id;
    aiReply(activeId, p.name, () => [
      {
        ...aiText('เลือกผู้ให้บริการและเวลาได้เลยค่ะ', {
          type: 'therapistPick',
          placeId,
          service,
          options: list.map((t) => ({ id: t.id, name: t.name, role: t.role, next: slotsOf(t, urgency).labels[0] ?? 'ไม่มีคิวว่าง', recommended: t.id === recId })),
        }),
        source: 'ระบบนัดหมาย' as const,
      },
    ]);
  };
  /** เลือกผู้ให้บริการ → เวลาว่างของคนนั้น (ช่องที่ทันตามความเร่งด่วนขึ้นก่อน) */
  const pickTherapist = (placeId: string, therapistId: string) => {
    const t = therapistsAt(placeId).find((x) => x.id === therapistId);
    if (!t) return;
    const { urgency } = bookingContext();
    const { labels, recommended } = slotsOf(t, urgency);
    const ordered = recommended ? [recommended, ...labels.filter((l) => l !== recommended)] : labels;
    const note = t.role === 'หมอนวด' ? ' หมอนวดดูแลนวดเพื่อสุขภาพ ถ้าต้องการรักษาแนะนำแพทย์แผนไทยค่ะ' : '';
    const text = recommended
      ? `แนะนำ ${recommended} ทันตาม${urgency.label.replace('ควรนวด', 'ที่ควรนวด')}ค่ะ${note}`
      : urgency.withinDays !== null
        ? `${t.name}ยังไม่มีคิว${urgency.label.replace('ควรนวด', '')} เร็วสุด ${labels[0] ?? '-'} ลองผู้ให้บริการหรือสถานที่อื่นได้ค่ะ${note}`
        : `เลือกเวลาที่สะดวกได้เลยค่ะ${note}`;
    aiReply(activeId, t.name, () => [{ ...aiText(text, { type: 'slotPick', placeId, therapistId, options: ordered }), source: 'ระบบนัดหมาย' as const }]);
  };
  /** แตะเวลาในการ์ดผู้ให้บริการ (แบบหน้าจอง) → สรุปยืนยันเลย · ไม่ระบุแพทย์ = จัดคนที่ว่างช่วงนั้น (แพทย์แผนไทยก่อน) */
  const pickCardSlot = (placeId: string, service: ServiceId | undefined, therapistId: string, day: string, time: string) => {
    const any = therapistId === ANY_THERAPIST;
    const t = any ? anyoneSlots(placeId, service).find((f) => dayLabel(f.day) === day && f.time === time)?.who[0] : therapistsAt(placeId).find((x) => x.id === therapistId);
    if (!t) return;
    pickSlot(placeId, t.id, `${day} ${time}`, `${any ? 'ไม่ระบุแพทย์' : t.name} · ${day} ${time}`);
  };
  const pickSlot = (placeId: string, therapistId: string, when: string, userText = when) => {
    const p = PLACES.find((x) => x.id === placeId);
    const t = therapistsAt(placeId).find((x) => x.id === therapistId);
    if (!p || !t) return;
    const time = when.split(' ').pop() ?? '';
    const day = when.slice(0, when.length - time.length).trim();
    const g = latestGuide();
    // บริการตามแนวทาง: มีประคบ = นวด + ประคบ · หมอนวด = นวดผ่อนคลาย
    const tc = chatCase();
    // เรื่องที่รักษาอยู่ = บริการตามแผนเดิม
    const service = tc ? tc.plan : t.role === 'หมอนวด' ? SERVICES.find((x) => x.value === 'relax')!.label : (g?.methods ?? []).some((m) => m.includes('ประคบ')) ? SERVICES[1].label : SERVICES[0].label;
    aiReply(activeId, userText, () => [
      { ...aiText('ตรวจสอบก่อนยืนยันนะคะ', { type: 'bookConfirm', placeId, therapistId, name: p.name, day, time, service, therapist: t.name, topic: bookingContext().topic }), source: 'ระบบนัดหมาย' as const },
    ]);
  };
  const confirmBooking = (c: Extract<ThreadCard, { type: 'bookConfirm' }>) => {
    const tc = chatCase();
    // เวลาชนกับนัดอื่นของเรา (ไม่นับนัดเดิมของเรื่องนี้) → ไม่จองซ้อน ให้เลือกเวลาใหม่
    const own = tc ? `c:${tc.id}` : `d:${drafts.find((d) => d.chatId === activeId)?.id}`;
    const clash = allAppts.find((a) => a.key !== own && a.date === c.day && a.time === c.time);
    if (clash) return aiReply(activeId, 'ยืนยันจอง', () => [{ ...aiText(`${c.day} ${c.time} มีนัด${clash.topic}อยู่แล้วค่ะ กดแก้ไขการจองเพื่อเลือกเวลาอื่น`), source: 'ระบบนัดหมาย' as const }]);
    if (tc) {
      const moved = tc.appointment.date !== '-';
      const today = c.day === 'วันนี้';
      setCaseAppointment(tc.id, { today, date: c.day, time: c.time, queue: today ? issueQueue() : undefined, clinic: c.name, therapist: c.therapist });
      log('ผู้รับบริการ', `${moved ? 'เลื่อนนัด' : 'จองนัด'}ในแชท ${tc.short} ${c.day} ${c.time}`);
      return aiReply(activeId, 'ยืนยันจอง', () => [
        { ...aiText(`${moved ? 'เลื่อนนัดแล้ว' : 'จองแล้ว'}ค่ะ ${c.day} ${c.time} กับ ${c.therapist}\n\nก่อนมานวด: ${tc.prep.join(' ')}`), source: 'ระบบนัดหมาย' as const },
      ]);
    }
    const draft = drafts.find((d) => d.chatId === activeId);
    // เลขคิวออกเฉพาะนัดวันนี้
    // จองจากแอป = คำขอจอง → รอคลินิกยืนยัน (เลขคิวออกตอนยืนยัน)
    const bk = { date: c.day, time: c.time, service: c.service, therapist: c.therapist, clinic: c.name, visit: 1, status: 'pending' as const };
    // นัดผูกกับใบของแชทนี้ · ไม่มีใบ (ไม่ควรเกิด) → เก็บเป็นนัดที่ยังไม่ผูก
    if (draft) {
      upsertDraft({ ...draft, stage: 'booked', booking: bk });
      setActiveDraftId(draft.id);
      requestBooking({ draftId: draft.id }, `${c.day} ${c.time}`);
    } else requestBooking({ looseId: addLooseBooking(bk) }, `${c.day} ${c.time}`);
    // จองแล้ว → ปุ่ม "จองนัดตามแนวทางนี้" ในแชทนี้หายไป
    setThread((t) => t.map((m) => (m.card?.type === 'guideline' ? { ...m, card: { ...m.card, booked: true } } : m)));
    if (newPatient) setCareStage('booked');
    log('ผู้รับบริการ', `จองนวดในแชท ${c.day} ${c.time} · ${c.name}`);
    // เตรียมตัวตามผลคัดกรอง (เหมือนหน้าจองเสร็จ)
    const caution = draft?.caution ?? '';
    const prep = [...(/ความดัน|อบ/.test(caution) ? ['วัดความดันก่อนนวด'] : []), ...(profile.conditions.includes('เบาหวาน') ? ['ตรวจน้ำตาลก่อนนวด'] : []), 'งดอาหารหนักก่อนนวด 30 นาที', 'ใส่เสื้อผ้าหลวมสบาย'];
    aiReply(activeId, 'ยืนยันจอง', () => [
      { ...aiText(`ส่งคำขอจอง ${c.day} ${c.time} ที่${c.name} แล้วค่ะ รอคลินิกยืนยัน จะแจ้งเตือนในแอป ส่งข้อมูลประเมินให้ผู้ให้บริการแล้ว\n\nก่อนมานวด: ${prep.join(' ')}`), source: 'ระบบนัดหมาย' as const },
      aiText('ระหว่างรอนัด ลองท่ายืดเบา ๆ ได้ค่ะ', { type: 'action', label: 'ดูท่ายืด', to: 'SelfCare' }),
    ]);
  };

  /* ---------- เลือกจุดจากหุ่น (BodyPicker) ---------- */
  const labelOfRegion = (r: BodyRegion) => REGION_CHIP[r.key] ?? `ปวด${r.label}`;
  /** จุดที่เคยแตะเลือกไว้ (มีพิกัด) → เปิดหน้าเลือกพร้อมจุดเดิม */
  const pickedPoints = (): BodySelection => Object.fromEntries(Object.entries(sel).filter((e): e is [string, BodyPoint[]] => Array.isArray(e[1]) && e[1].length > 0));
  const canPick = assess.step === 'symptoms' || assess.step === 'related';
  const openPicker = () => canPick && setPicker(assess.step as 'symptoms' | 'related');
  /** ยืนยันจุด → แทนจุดที่เลือกจากหุ่นชุดเดิม · ชื่อที่ไม่อยู่ในตัวเลือกด่วนเพิ่มเป็น chip · ส่งเป็นคำตอบของข้อนั้นให้ AI ทำต่อ */
  const confirmPicker = (picked: BodySelection) => {
    const labels = Object.keys(picked);
    setPicker(null);
    if (!labels.length) return;
    setSel((cur) => ({ ...Object.fromEntries(Object.entries(cur).filter(([, v]) => !Array.isArray(v))), ...picked }));
    setExtraSymptoms((ex) => [...ex.filter((e) => !(e in pickedPoints()) || labels.includes(e)), ...labels.filter((l) => !HOME_CONTENT.symptoms.includes(l) && !HOME_CONTENT.related.includes(l) && !ex.includes(l))]);
    // หันหุ่นเล็กไปด้านที่เลือก (จุดส่วนใหญ่อยู่ด้านหลัง → หันหลัง)
    const pts = Object.values(picked).flat();
    chatBodyRef.current?.face(pts.filter((q) => q.z < 0).length > pts.length / 2 ? 'back' : 'front');
    answerStep(labels.join(', '));
  };

  /** AI คิดสักครู่ (LatticeLoader) แล้วแทนที่ด้วยข้อความตอบ */
  const aiReply = (sid: string, userText: string, reply: () => ThreadItem[], userExtra?: Partial<ThreadItem>) => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const aiId = `a${Date.now()}`;
    setThread(
      (t) => [
        ...t,
        { id: `u${Date.now()}`, day: 'today', from: 'user', text: userText, time, ...userExtra },
        { id: aiId, day: 'today', from: 'ai', source: 'AI Interview', time, thinking: 'working' },
      ],
      sid,
    );
    scrollToEnd();
    setTimeout(() => {
      // คำนวณคำตอบนอก state updater — reply() มีการ set state อื่น (ขั้นถัดไป/ใบร่าง) ซึ่งทำใน updater ไม่ได้
      const items = reply();
      setThread((t) => t.flatMap((m) => (m.id === aiId ? items : [m])), sid);
      scrollToEnd();
    }, THINK_MS);
  };

  /** ตอบหัวข้อประเมินปัจจุบัน → ถามหัวข้อถัดไป · ครบแล้ว → สรุป + แนวทางการรักษา */
  const answerStep = (answer: string, patch?: Partial<Assessment>, userExtra?: Partial<ThreadItem>, fromStep?: AssessStep) => {
    const sid = activeId;
    // แก้ข้อเดียวจากข้อมูลชุดเดิม → กลับไปหน้าทบทวน (ไม่ถามข้อถัดไป)
    if (assess.editing && !fromStep) {
      setAssess((a) => ({ ...a, ...patch, step: 'review', editing: false }), sid);
      // เหลือการ์ดทบทวนใบล่าสุดใบเดียว
      setThread((t) => t.filter((m) => m.card?.type !== 'review'), sid);
      aiReply(sid, answer, () => [reviewItem('แก้แล้วค่ะ มีข้ออื่นอีกไหม หรือยืนยันได้เลย')], userExtra);
      return;
    }
    const i = ASSESS_ORDER.indexOf((fromStep ?? assess.step) as (typeof ASSESS_ORDER)[number]);
    let nextStep: (typeof ASSESS_ORDER)[number] | undefined = ASSESS_ORDER[i + 1];
    // ประเมินซ้ำเรื่องเดิม: ใช้คำตอบโรคประจำตัวชุดเดิม ไม่ถามซ้ำ
    if (nextStep === 'health' && assess.reuseHealth !== undefined) {
      nextStep = ASSESS_ORDER[ASSESS_ORDER.indexOf('health') + 1];
      patch = { ...patch, health: assess.reuseHealth };
    }
    // ข้อที่ผู้ใช้บอกมาแล้วในข้อความก่อนหน้า → ใช้คำตอบนั้น ข้ามไปข้อถัดไป
    const pf = prefill.current[sid] ?? {};
    const skipped: string[] = [];
    while (nextStep && nextStep !== 'symptoms' && nextStep !== 'related' && pf[nextStep as keyof Assessment] !== undefined) {
      const k = nextStep as keyof Assessment;
      patch = { ...patch, [k]: pf[k] };
      skipped.push(k === 'pain' ? `ปวด ${pf.pain}/10` : String(pf[k]));
      delete pf[k];
      nextStep = ASSESS_ORDER[ASSESS_ORDER.indexOf(nextStep) + 1];
      if (nextStep === 'health' && assess.reuseHealth !== undefined) {
        nextStep = ASSESS_ORDER[ASSESS_ORDER.indexOf('health') + 1];
        patch = { ...patch, health: assess.reuseHealth };
      }
    }
    const lead = skipped.length ? `รับทราบค่ะ (${skipped.join(' · ')})` : 'รับทราบค่ะ';
    const step = nextStep ?? ('done' as const);
    const after = { ...assess, ...patch, step };
    // functional update — ไม่ทับ sel ที่เพิ่งเลือกจาก chip/หุ่นในจังหวะเดียวกัน
    setAssess((a) => ({ ...a, ...patch, step }), sid);
    if (!nextStep) setBefore({ ...before, pain: after.pain });
    const withAppt = active.stage !== undefined;
    aiReply(sid, answer, () => {
      if (nextStep === 'radiate') return radiateOrNext(sid, undefined, lead);
      if (nextStep) return [askItem(nextStep, lead)];
      // อาการที่เลือกไว้ล่าสุดของแชทนั้น (อ่านตอนตอบกลับ ไม่ใช่ตอนกด)
      const sel = Object.keys(sessionsRef.current.find((c) => c.id === sid)?.assess.sel ?? {});
      const sym = sel.filter((k) => !HOME_CONTENT.related.includes(k));
      const rel = sel.filter((k) => HOME_CONTENT.related.includes(k));
      // คำตอบโรคประจำตัว/ยา → บันทึกลงโปรไฟล์ แล้วตรวจด้วย safetyEngine ตัวเดียวกับหน้ารายละเอียด (ไม่ให้ผลขัดกัน)
      const ans = healthAnswerToProfile(after.health);
      const nextProfile = {
        ...profile,
        conditions: ans.conditions,
        medications: ans.medications,
        healthKnown: true,
        // ข้อห้ามช่วงนี้ → กฎใน safetyEngine (ผ่าตัด/บาดเจ็บ/ไข้/ตั้งครรภ์/แผล)
        surgeryWithin1Month: after.risk === RISK_OPTIONS[0],
        injuryWithin48h: after.risk === RISK_OPTIONS[1],
        pregnant: after.risk === RISK_OPTIONS[3],
        flags: { ...profile.flags, acuteInfection: after.risk === RISK_OPTIONS[2], openWoundOrSkinInfection: after.risk === RISK_OPTIONS[4] },
        // คนไข้ใหม่ยังไม่ได้วัดสัญญาณชีพ (วัดที่คลินิกก่อนนวด)
        ...(newPatient ? { bp: undefined, temperature: undefined, pulse: undefined } : null),
      };
      setProfile(nextProfile);
      const ev = evaluateSafety(nextProfile);
      const amber = ev.hits.find((h) => h.level === 'amber');
      // อาการร้าว: ร้าวเลยเข่า/ร้าวชาลงแขน = ข้อควรระวัง · ชา/อ่อนแรง = พบแพทย์ก่อน (data/radiation.ts)
      const ro = radiateOption(after.radiate);
      // โรคติดต่อ = รอหายก่อน (เลื่อนนัด) · มีประจำเดือน = นวดได้ แต่งดนวดท้อง (ข้อควรระวัง)
      const contagious = after.risk === 'โรคติดต่อ';
      const period = after.risk === 'มีประจำเดือน';
      const roHit = [
        ...(ro?.level ? [{ id: ro.level === 'red' ? 'RF-NERVE' : 'CA-NERVE', title: ro.note ?? ro.label, evidence: ro.label, source: ro.source ?? 'CPG หน้า 139' }] : []),
        ...(contagious ? [{ id: 'RF-INFECT', title: 'โรคติดต่อ ควรรอหายก่อนนวด', evidence: after.risk!, source: 'แบบคัดกรองคลินิก' }] : []),
        ...(period ? [{ id: 'CA-PERIOD', title: 'มีประจำเดือน งดนวดท้อง', evidence: after.risk!, source: 'แบบคัดกรองคลินิก' }] : []),
      ];
      const level = ev.level === 'red' || ro?.level === 'red' || contagious ? 'red' : ev.level === 'amber' || ro?.level === 'amber' || period ? 'amber' : 'green';
      const caution = [amber ? SHORT_CAUTION[amber.ruleId] ?? amber.title : ro?.level === 'amber' ? ro.note : undefined, period ? 'งดนวดท้อง' : undefined, after.avoid && after.avoid !== 'ไม่มี' ? `ไม่นวด${after.avoid}` : undefined].filter(Boolean).join(' · ') || undefined;
      const results = assessmentResults(after, sym, rel, withAppt, {
        level,
        items: [...roHit, ...ev.hits.map((h) => ({ id: h.ruleId, title: h.title, evidence: h.evidence, source: h.source }))],
        caution,
      });
      // ส่งต่อสรุปให้หน้าจอง/หน้าแรก · คนไข้ใหม่ → ขั้นที่ 1 เสร็จ
      const safetyCard = results.find((r) => r.card?.type === 'safety')?.card;
      const guide = results.find((r) => r.card?.type === 'guideline')?.card;
      setLastAssess({
        symptoms: sym,
        pain: after.pain,
        cause: after.cause,
        caution: guide?.type === 'guideline' ? guide.caution : undefined,
        red: safetyCard?.type === 'safety' && safetyCard.level === 'red',
      });
      if (careStage === 'new') setCareStage('assessed');
      /* ใบร่าง: เรื่องเดิม = อัปเดตใบเดิม (เก็บคะแนนครั้งก่อน) · อาการใหม่ = ใบใหม่ · เรื่องของใบการรักษา = บันทึกในใบนั้น ไม่สร้างใบร่าง */
      const toCase = cases.find((c) => c.short === after.topic);
      /* ประเมินใหม่ในเรื่องที่รักษาอยู่:
       *   บริเวณเดิม → บันทึกในเรื่องนั้น = อาการก่อนนวดครั้งถัดไป + แจ้งแพทย์ทบทวนแผน (แพทย์ตัดสิน คลินิกเลื่อน/ปรับนัดให้)
       *   คนละบริเวณ → แยกเป็นเรื่องใหม่ (ใบร่าง จองแยกได้)
       *   ควรพบแพทย์ → แนะนำงดนวดนัดของเรื่องนี้ไว้ก่อน + แจ้งคลินิก */
      const core = (x: string) => x.replace(/^ปวด/, '').split(/[-\s,/]+/).filter(Boolean);
      const sameArea = !!toCase && sym.some((x) => toCase.areas.some((a) => core(a.symptom).some((w) => core(x).some((y) => y.includes(w) || w.includes(y)))));
      const splitOff = !!toCase && !newPatient && !sameArea && sym.length > 0;
      const topic = splitOff ? undefined : after.topic;
      if (toCase && !newPatient && !splitOff) {
        const red = level === 'red';
        const hasAppt = toCase.appointment.date !== '-';
        setCaseToday(toCase.id, { pain: after.pain, risk: after.risk, red });
        if (red) setUrgentCases((m) => ({ ...m, [toCase.id]: `ผลประเมิน${toCase.short}` }));
        log('ระบบ → ผู้ให้บริการ', `ประเมินใหม่ ${toCase.short}: ${sym.join(', ')} ปวด ${after.pain}/10${red ? ' · ควรพบแพทย์ก่อนนวด' : level === 'amber' ? ' · มีข้อควรระวัง' : ''} · ขอแพทย์ทบทวนแผน`);
        const appt = hasAppt ? `นัด ${toCase.appointment.date} ${toCase.appointment.time}` : 'นัดครั้งถัดไป';
        return [
          ...results,
          {
            id: `r-case-${Date.now()}`,
            day: 'today' as const,
            from: 'ai' as const,
            text: red
              ? `แนะนำงดนวด${appt}ไว้ก่อนค่ะ แจ้งคลินิกแล้ว คลินิกจะติดต่อเลื่อนนัดให้`
              : `บันทึกในเรื่อง${toCase.short}แล้วค่ะ ใช้เป็นอาการก่อนนวด${appt} และแจ้งแพทย์ให้ทบทวนแผนแล้ว ถ้าปรับแผน คลินิกจะแจ้งในแอป`,
            card: red ? ({ type: 'action', label: 'ติดต่อคลินิก', to: 'CallClinic' } as const) : undefined,
            source: 'AI Interview' as const,
            time: results[0]?.time,
          },
        ];
      }
      if (splitOff) results.push({ id: `r-split-${Date.now()}`, day: 'today', from: 'ai', text: `อาการนี้คนละบริเวณกับเรื่อง${toCase!.short} จึงแยกเป็นเรื่องใหม่ค่ะ จองแยกได้`, source: 'AI Interview', time: results[0]?.time });
      // เรื่องเดิม = หัวข้อเดียวกัน หรืออาการชุดเดียวกัน (ไม่สร้างใบซ้ำ)
      const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
      const old = drafts.find((d) => d.title === topic) ?? drafts.find((d) => same(d.symptoms, sym));
      const id = old?.id ?? `d${Date.now()}`;
      // นัดเรื่องใหม่ที่จองไว้ก่อนประเมิน → ผูกกับใบใหม่ที่เพิ่งประเมิน แล้วไม่ถือเป็นนัดลอยอีก (ไม่ไปติดใบถัดไปซ้ำ)
      // นัดที่เลือกไว้ตอนเริ่มประเมิน (แท็บนัดนั้น) · มีนัดเดียว = นัดนั้น · หลายนัดแต่ไม่ได้ระบุ = ไม่เดา
      const lid = looseFor.current[sid] ?? (looseBookings.length === 1 ? looseBookings[0].id : undefined);
      const loose = !old && lid ? looseBookings.find((b) => b.id === lid) : undefined;
      if (loose) removeLooseBooking(loose.id);
      // มีนัดอยู่แล้ว → แสดงนัดนั้น (ผลประเมินส่งให้ผู้ให้บริการของนัดนี้) แทนการเสนอให้จองใหม่
      const bk = old?.booking ?? loose;
      const red = safetyCard?.type === 'safety' && safetyCard.level === 'red';
      // จองไว้ก่อนประเมิน แต่บริการไม่ตรงผลประเมิน (เช่น นวดผ่อนคลาย แต่ต้องนวดรักษา) → บอกและให้เปลี่ยนได้ในนัดเดิม
      const mismatch = !red && bk ? serviceMismatch(bk.service, [caution, guide?.type === 'guideline' ? guide.caution : ''].filter(Boolean).join(' ')) : null;
      if (mismatch) log('ระบบ → ผู้ให้บริการ', `นัด ${bk!.date} ${bk!.time}: ${mismatch}`);
      const withBooking: ThreadItem[] = bk
        ? [
            ...results.map((r) => (r.card?.type === 'guideline' ? { ...r, card: { ...r.card, booked: true } } : r)),
            {
              id: `r-bk-${Date.now()}`,
              day: 'today' as const,
              from: 'ai' as const,
              text: red
                ? 'คุณมีนัดนวดอยู่ แต่ควรพบแพทย์ก่อน แนะนำเลื่อนนัดออกไปค่ะ'
                : mismatch
                  ? `${mismatch}ค่ะ`
                  : 'นัดที่จองไว้ค่ะ ส่งผลประเมินให้ผู้ให้บริการแล้ว',
              card: { type: 'appointment' as const, date: bk.date, time: bk.time, place: bk.clinic, therapist: bk.therapist, service: bk.service, draftId: id, warn: mismatch ?? undefined },
              source: 'ระบบนัดหมาย' as const,
              time: results[0]?.time,
            },
            // ไม่บังคับ: ถามก่อนว่าจะเปลี่ยนตามคำแนะนำ หรือใช้แผนเดิม
            ...(mismatch
              ? [
                  {
                    id: `r-plan-${Date.now()}`,
                    day: 'today' as const,
                    from: 'ai' as const,
                    text: mismatch.includes('ควรนวดเพื่อรักษา') ? 'ต้องการเปลี่ยนเป็นนวดเพื่อรักษาตามคำแนะนำไหมคะ? ถ้าใช้แผนเดิมก็ได้ จะเป็นนวดเพื่อสุขภาพ' : 'ต้องการเปลี่ยนบริการตามคำแนะนำไหมคะ? ถ้าใช้แผนเดิม ผู้ให้บริการจะงดประคบให้',
                    card: { type: 'planChoice' as const, draftId: id, clinic: bk.clinic },
                    source: 'ระบบนัดหมาย' as const,
                    time: results[0]?.time,
                  },
                ]
              : []),
          ]
        : results;
      upsertDraft({
        id,
        title: sym.join(', ') || old?.title || 'อาการใหม่',
        symptoms: sym,
        pain: after.pain,
        prevPain: old?.pain,
        duration: after.duration,
        cause: after.cause,
        caution,
        red: level === 'red',
        stage: old?.stage ?? (loose ? 'booked' : 'assessed'),
        booking: old?.booking ?? loose,
        chatId: sid,
        health: after.health,
        risk: after.risk,
        pressure: after.pressure,
        avoid: after.avoid,
        radiate: after.radiate,
      });
      setActiveDraftId(id);
      // หน้าแรกเปิดที่ใบนี้
      setCaseIdx(caseCount + (old ? drafts.indexOf(old) : drafts.length));
      return withBooking;
    }, userExtra);
  };

  /** ออกจากแชท → ย้อนกลับหน้าเริ่มต้น (หุ่นใหญ่กลางจอ หันตรง + ปุ่มเริ่มประเมิน) · แชทยังเก็บไว้ในประวัติ */
  const exitChat = () => {
    if (leaving) return;
    setLeaving(true);
    setHistoryOpen(false);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    Animated.timing(intro, { toValue: 0, duration: 600, easing: INTRO_EASE, useNativeDriver: true }).start(() => {
      setStarted(false);
      setLeaving(false);
      bodyRef.current?.remeasure();
    });
  };

  /** แชทใหม่: อยู่หน้าแรกเดิม เริ่มประเมินใหม่ในบทสนทนาใหม่ · แชทเดิมย้ายไปอยู่ในประวัติ */
  /** แชทของแต่ละเรื่อง: ใบการรักษา → key = case id · ใบร่าง → draft.chatId */
  /** รักษา → ติดตามผลกับ AI: แชทของเรื่องนั้น (มีอยู่แล้วเปิดต่อ · ยังไม่มีสร้างพร้อมสรุปสั้น ๆ) */
  /**
   * ติดตามผลกับ AI — AI มีข้อมูลการรักษาของเรื่องนี้ครบ
   * ยังไม่ได้ให้ข้อมูลหลังรักษา → AI ถามบังคับก่อน (คะแนนปวดทุกจุด + อาการผิดปกติ) แล้ววิเคราะห์ ส่งให้ผู้ให้บริการ และบอกแผนต่อไป
   * ให้ข้อมูลครบแล้ว → สรุปผลแล้วถามว่าอยากทราบอะไร
   */
  const followCaseChat = () => {
    const last = tcase.visits[tcase.visits.length - 1];
    const unsent = tcase.pending.some((ss) => !followUps.some((f) => f.sessionId === ss.id));
    const hasAppt = tcase.appointment.date !== '-';
    // มีนัดครั้งถัดไปและยังไม่ได้ประเมินก่อนนวด → ถามก่อน (ไม่มีติดตามผลรายวัน)
    const needAsk = !caseToday[tcase.id] && hasAppt;
    const askItems = (): ThreadItem[] =>
      [
        {
          id: `fu-intro-${Date.now()}`,
          day: 'today' as const,
          from: 'ai' as const,
          source: 'AI Interview' as const,
          time: nowTimeText(),
          // มีนัดถัดไป = ประเมินก่อนนวด (คะแนนวันนี้ = ก่อนนวดของครั้งถัดไป) · ไม่มีนัด = ติดตามผลหลังนวด
          text: hasAppt ? `ก่อนนวดครั้งที่ ${tcase.course.done + 1} (${tcase.appointment.date} ${tcase.appointment.time}) ขอถามอาการวันนี้ก่อนนะคะ ผู้ให้บริการจะเห็นก่อนถึงคิว` : `ก่อนอื่นขอติดตามผลหลังนวดครั้งล่าสุด (${last.date}) นะคะ`,
        },
        unsent ? fuAskItem(firstUnsent()) : preAskItem(),
      ].filter(Boolean) as ThreadItem[];
    const id = caseChats[tcase.id] ?? tcase.chatId;
    if (id && sessions.some((c) => c.id === id)) {
      // แชทเดิม: ยังไม่ได้ประเมินรอบนี้ และไม่ได้ค้างคำถามอยู่ → ถามต่อท้ายในแชทเดิม
      const items = sessions.find((c) => c.id === id)!.items;
      const lastType = items[items.length - 1]?.card?.type;
      if (needAsk && lastType !== 'fuAsk' && lastType !== 'fuAdverse' && lastType !== 'fuRisk') setThread((t) => [...t, ...askItems()], id);
      return openChat(id);
    }
    const ss = needAsk
      ? { ...caseChatSession(`รักษา${tcase.short}`, ''), items: askItems() }
      : caseChatSession(`รักษา${tcase.short}`, `เรื่อง${tcase.short} รักษามาแล้ว ${tcase.visits.length} ครั้ง ล่าสุด (${last.date}) ปวด ${last.painBefore} → ${last.painAfter}`);
    setSessions((all) => [ss, ...all]);
    setCaseChats((m) => ({ ...m, [tcase.id]: ss.id }));
    openChat(ss.id);
  };
  /**
   * ปุ่ม "ถาม AI" (แถวแท็บเรื่อง) — AI ทักตามแท็บที่เลือก แล้วให้เลือกว่าจะทำอะไร · ประเมินเรื่องใหม่มีทุกครั้ง
   * เรื่องที่รักษา: ประเมินก่อนนวด (มีนัด) · ดูผลการรักษา · นัดครั้งถัดไป · ใบร่าง: ประเมินอีกครั้ง · ไม่มีเรื่อง/นัดเรื่องใหม่: เริ่มประเมิน
   */
  const menuItem = (text: string, options: string[]): ThreadItem => ({ id: `menu-${Date.now()}`, day: 'today', from: 'ai', source: 'AI Interview', time: nowTimeText(), text, card: { type: 'intents', options } });
  const openAI = () => {
    if (selCase) {
      const hasAppt = tcase.appointment.date !== '-';
      const item = menuItem(`เรื่อง${tcase.short} อยากให้ช่วยเรื่องไหนคะ?`, [...(hasAppt ? [CASE_INTENTS[0]] : []), CASE_INTENTS[1], CASE_INTENTS[2], NEW_TOPIC_INTENT]);
      const id = caseChats[tcase.id] ?? tcase.chatId;
      if (id && sessions.some((c) => c.id === id)) {
        setThread((t) => [...t.filter((m) => m.card?.type !== 'intents' || m !== t[t.length - 1]), item], id);
        return openChat(id);
      }
      const ss = { ...caseChatSession(`รักษา${tcase.short}`, ''), items: [item] };
      setSessions((all) => [ss, ...all]);
      setCaseChats((m) => ({ ...m, [tcase.id]: ss.id }));
      return openChat(ss.id);
    }
    if (selDraft) {
      const item = menuItem(`เรื่อง${selDraft.title} อยากให้ช่วยเรื่องไหนคะ?`, [DRAFT_REASSESS_INTENT, NEW_TOPIC_INTENT]);
      const id = selDraft.chatId && sessions.some((c) => c.id === selDraft.chatId) ? selDraft.chatId : null;
      if (id) {
        setThread((t) => [...t, item], id);
        return openChat(id);
      }
      const ss: ChatSession = { ...newChatSession(), title: `ประเมิน${selDraft.title}`, items: [item], assess: { ...blankAssessment(), step: 'done' } };
      setSessions((all) => [ss, ...all]);
      upsertDraft({ ...selDraft, chatId: ss.id });
      return openChat(ss.id);
    }
    if (unfinished) return openChat(unfinished.id);
    // ยังไม่มีข้อมูล → แชทต้อนรับ (AI ถามว่าวันนี้สนใจเรื่องอะไร)
    if (chatHome) return startWelcome();
    newChat();
  };
  /** มาจากเช็กอิน "ประเมินก่อนนวด" → เปิดเรื่องนั้นแล้วเริ่มถามในแชทของเรื่องนั้น */
  const route = useRoute<{ key: string; name: string; params?: { assessCase?: string } }>();
  const assessFor = React.useRef<string | null>(null);
  React.useEffect(() => {
    const id = route.params?.assessCase;
    if (!id) return;
    const i = cases.findIndex((c) => c.id === id);
    if (i >= 0) {
      assessFor.current = id;
      setCaseIdx(i);
    }
    nav.setParams({ assessCase: undefined } as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.assessCase]);
  React.useEffect(() => {
    if (assessFor.current && assessFor.current === tcase.id) {
      assessFor.current = null;
      followCaseChat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tcase.id, route.params?.assessCase]);
  /** ประเมินก่อนนวด (ติดตามผลส่งครบแล้ว แต่มีนัดถัดไป) — ถามคะแนนวันนี้เทียบครั้งล่าสุด */
  const preAskItem = (): ThreadItem => {
    const last = tcase.visits[tcase.visits.length - 1];
    return {
      id: `fu-pre-${Date.now()}`,
      day: 'today',
      from: 'ai',
      source: 'AI Interview',
      time: nowTimeText(),
      text: `ครั้งล่าสุด (${last.date}) ปวด ${last.painBefore} → ${last.painAfter}/10 วันนี้อาการ${tcase.short}ปวดเท่าไหร่คะ?`,
      card: { type: 'fuAsk', sessionId: `pre-${tcase.id}`, pin: '', label: `อาการ${tcase.short}`, before: last.painAfter },
    };
  };
  /** คะแนนวันนี้ที่ตอบล่าสุด (ใช้เป็น "ก่อนนวด" ของครั้งถัดไป) · อาการหลังนวดที่ตอบ (รอถามข้อห้ามใหม่) */
  const lastFuScore = React.useRef<number | null>(null);
  const pendingAdverse = React.useRef('ไม่มี');
  /** ผลประเมินก่อนนวด (การ์ดสรุป: วันนี้เป็นอย่างไร + ครั้งนี้จะรักษาอย่างไร) · เช็กอินได้เมื่อนัดวันนี้ */
  const preResultItems = (fc: TreatmentCase, focus?: string, urgent?: boolean): ThreadItem[] => [
    { id: `pre-r-${Date.now()}`, day: 'today', from: 'ai', source: 'AI Interview', time: nowTimeText(), text: `ผลประเมินก่อนนวดครั้งที่ ${fc.course.done + 1} ค่ะ ส่งให้ผู้ให้บริการแล้ว`, card: { type: 'preResult', caseId: fc.id, focus } },
    ...(fc.appointment.today && !urgent ? [{ id: `pre-c-${Date.now()}`, day: 'today' as const, from: 'ai' as const, source: 'AI Interview' as const, time: nowTimeText(), text: '', card: { type: 'action' as const, label: 'เช็กอิน', to: 'CheckIn' as const } }] : []),
  ];
  /**
   * ติดตามผล = ประเมินอาการโดยรวมของการรักษาครั้งนั้น (ไม่ใช่ทีละจุด) — วัดแบบเดียวกับตอนประเมินก่อนรักษา จึงเทียบกันได้
   * CPG หน้า 157: ประเมินความปวดก่อนและหลังการรักษา · ยังไม่ดีขึ้นค่อยถามว่าตรงไหนยังปวด
   */
  const sessionBefore = (ss: (typeof fuSessions)[number]) => tcase.visits.find((v) => v.date === ss.date)?.painBefore ?? Math.max(...ss.areas.map((a) => a.before));
  /** ครั้งแรกที่ยังไม่ได้ส่งผลติดตาม */
  const firstUnsent = () => Math.max(0, fuSessions.findIndex((ss) => !followUps.some((f) => f.sessionId === ss.id)));
  /** คำถามคะแนนปวดโดยรวมของครั้งที่ k */
  const fuAskItem = (k: number): ThreadItem | null => {
    const ss = fuSessions[k];
    if (!ss) return null;
    const before = sessionBefore(ss);
    return {
      id: `fu-ask-${k}-${Date.now()}`,
      day: 'today',
      from: 'ai',
      source: 'AI Interview',
      time: nowTimeText(),
      // บอกว่าคะแนนหลังนวดที่คลินิกมีแล้ว → ที่ถามคือ "วันนี้" (ไม่ใช่ถามซ้ำ)
      text: (() => {
        const atClinic = tcase.visits.find((v) => v.date === ss.date)?.painAfter;
        return `หลังนวดวันที่ ${ss.date} ปวด ${before} → ${atClinic ?? '-'}/10 วันนี้อาการ${tcase.short}ปวดเท่าไหร่คะ?`;
      })(),
      card: { type: 'fuAsk', sessionId: ss.id, pin: '', label: `อาการ${tcase.short}`, before },
    };
  };
  /** ตอบคะแนนจุดหนึ่ง → จุดถัดไป · ครบแล้ว → ถามอาการผิดปกติ (ใช้ทั้งแตะและพิมพ์ตอบ) */
  const fuScoreItems = (card: Extract<ThreadCard, { type: 'fuAsk' }>, v: number): ThreadItem[] => {
    // คะแนนโดยรวม → ใช้สีกับ mark ทุกบริเวณของครั้งนั้นบนหุ่นด้วย
    const ss = fuSessions.find((x) => x.id === card.sessionId);
    lastFuScore.current = v;
    // ประเมินก่อนนวด (ไม่ใช่รอบติดตามผลของครั้งไหน) → ถามอาการผิดปกติต่อเลย
    if (card.sessionId.startsWith('pre-'))
      return [{ id: `fu-adv-${Date.now()}`, day: 'today', from: 'ai', source: 'AI Interview', time: nowTimeText(), text: 'หลังนวดครั้งก่อนมีอาการผิดปกติไหมคะ?', card: { type: 'fuAdverse' } }];
    setFuScores((m) => ({ ...m, [`${card.sessionId}:overall`]: v, ...Object.fromEntries((ss?.areas ?? []).map((a) => [`${card.sessionId}:${a.pin}`, v])) }));
    const k = fuSessions.findIndex((x) => x.id === card.sessionId);
    const next = fuSessions.slice(k + 1).some((x) => !followUps.some((f) => f.sessionId === x.id)) ? fuAskItem(k + 1) : null;
    return next
      ? [next]
      : [{ id: `fu-adv-${Date.now()}`, day: 'today', from: 'ai', source: 'AI Interview', time: nowTimeText(), text: 'หลังนวดมีอาการผิดปกติไหมคะ?', card: { type: 'fuAdverse' } }];
  };
  const answerFuScore = (card: Extract<ThreadCard, { type: 'fuAsk' }>, v: number) => aiReply(activeId, `${card.label} ปวด ${v}/10`, () => fuScoreItems(card, v));
  const answerFuAdverse = (opt: string) => {
    const fc = chatCase() ?? tcase;
    // มีนัดครั้งถัดไป → ถามข้อห้ามใหม่ก่อนนวด (ไข้/บาดเจ็บ/ยาใหม่) ก่อนสรุป
    if (fc.appointment.date !== '-' && opt !== 'ชา/อ่อนแรง') {
      pendingAdverse.current = opt;
      return aiReply(activeId, opt === 'ไม่มี' ? 'ไม่มีอาการผิดปกติ' : opt, () => [
        { id: `fu-risk-${Date.now()}`, day: 'today', from: 'ai', source: 'AI Interview', time: nowTimeText(), text: 'ก่อนนวดครั้งถัดไป มีข้อใดต่อไปนี้ไหมคะ?', card: { type: 'fuRisk' } },
      ]);
    }
    return aiReplyAsync(activeId, opt === 'ไม่มี' ? 'ไม่มีอาการผิดปกติ' : opt, () => fuAdverseItems(opt));
  };
  const answerFuRisk = (risk: string) => aiReplyAsync(activeId, risk === 'ไม่มี' ? 'ไม่มีข้อใดเลย' : risk, () => fuAdverseItems(pendingAdverse.current, risk));
  /** ครบแล้ว → วิเคราะห์ ส่งผลให้ผู้ให้บริการ และบอกแผนต่อไป */
  const fuAdverseItems = async (opt: string, risk = 'ไม่มี'): Promise<ThreadItem[]> => {
    // เรื่องของแชทนี้ (ไม่ใช่เรื่องที่เปิดอยู่บนหน้าแรก)
    const fc = chatCase() ?? tcase;
    // ส่งเป็นคะแนนโดยรวมค่าเดียวต่อครั้งการรักษา
    const scored = fc.pending.map((ss) => ({
      ss,
      areas: fuScores[`${ss.id}:overall`] === undefined ? [] : [{ area: 'โดยรวม', painBefore: sessionBefore(ss), painAfter: fuScores[`${ss.id}:overall`] }],
    }));
    for (const { ss, areas } of scored) if (areas.length) await sendFollowUp({ sessionId: ss.id, sessionDate: ss.date, areas });
    const all = scored.flatMap((x) => x.areas);
    // ประเมินก่อนนวด (ไม่มีรอบติดตามผลค้าง) → เทียบกับหลังนวดครั้งล่าสุด
    const lastVisit = fc.visits[fc.visits.length - 1];
    const today = lastFuScore.current ?? (all.length ? all[all.length - 1].painAfter : lastVisit.painAfter);
    if (!all.length) all.push({ area: 'โดยรวม', painBefore: lastVisit.painBefore, painAfter: today });
    const before = all.reduce((n, a) => n + a.painBefore, 0) / Math.max(1, all.length);
    const after = all.reduce((n, a) => n + a.painAfter, 0) / Math.max(1, all.length);
    const pct = Math.round(((before - after) / Math.max(1, before)) * 100);
    // งดนวดเฉพาะเกณฑ์ไม่รับเข้าการรักษาใน CPG_PCU หน้า 139: ไข้ (2.4.2) · หลังอุบัติเหตุภายใน 48 ชม. (3.3) · อาการทางระบบประสาท ชา/อ่อนแรง (3.1)
    // ไม่ใช้ระดับปวดเป็นเกณฑ์ห้ามนวด (เอกสารไม่มีเกณฑ์ตัวเลข — ปวดมากยังรักษาได้ตามปกติ)
    const riskRed = risk === 'มีไข้' || risk === FU_RISK[2];
    const urgent = preVisitRed(opt, risk);
    const notBetter = opt === 'ปวดมากขึ้น' || all.some((a) => a.painAfter >= a.painBefore);
    // อาการวันนี้ = ก่อนนวดของครั้งถัดไป → การ์ดหน้าแรก/เช็กอิน/ผู้ให้บริการใช้ค่าเดียวกัน
    setCaseToday(fc.id, { pain: today, adverse: opt, risk, red: urgent });
    log('ระบบ → ผู้ให้บริการ', `ก่อนนวด${fc.short}: วันนี้ปวด ${today}/10 · หลังนวดครั้งก่อน ${opt}${risk !== 'ไม่มี' ? ` · ${risk}` : ''}`);
    lastFuScore.current = null;
    if (urgent) {
      // แจ้งผู้ให้บริการจริง (ไม่ใช่แค่ข้อความ) + งดจองนวดเรื่องนี้จนกว่าแพทย์ตรวจ
      const why = riskRed ? `${risk}ก่อนนวด` : 'ชา/อ่อนแรงหลังนวด';
      log('ระบบ → ผู้ให้บริการ', `ติดตามผล${fc.short}: ${why} — ขอให้ทบทวนก่อนนวดครั้งถัดไป`);
      setUrgentCases((m) => ({ ...m, [fc.id]: why }));
    }
    const next = fc.course.done < fc.course.total && fc.appointment.date !== '-' ? `ครั้งที่ ${fc.course.done + 1}/${fc.course.total} ${fc.appointment.date} ${fc.appointment.time}` : '';
    const analysis: ThreadItem = urgent
      ? { id: `fu-r-${Date.now()}`, day: 'today', from: 'ai', source: 'Safety Rule Engine', time: nowTimeText(), text: riskRed ? `${risk}ควรงดนวดก่อนค่ะ แนะนำเลื่อนนัดและพบแพทย์ ส่งให้ผู้ให้บริการแล้ว` : 'มีอาการที่ควรให้แพทย์ตรวจก่อนนวดครั้งถัดไปค่ะ ส่งให้ผู้ให้บริการแล้ว', card: { type: 'action', label: 'ดูคำแนะนำ', to: 'RedFlag' } }
      : notBetter
        ? // ยังไม่ดีขึ้น → ถามว่าตรงไหนยังปวด (ให้ผู้ให้บริการเน้นครั้งหน้า)
          { id: `fu-r-${Date.now()}`, day: 'today', from: 'ai', source: 'AI Interview', time: nowTimeText(), text: 'อาการยังไม่ดีขึ้นค่ะ ตรงไหนยังปวดอยู่บ้างคะ? ผู้ให้บริการจะเน้นให้ครั้งหน้า', card: { type: 'fuWhere', options: [...fc.areas.map((a) => a.label), 'ปวดเท่า ๆ กัน'] } }
        : { id: `fu-r-${Date.now()}`, day: 'today', from: 'ai', source: 'AI Interview', time: nowTimeText(), text: `วันนี้ปวด ${today}/10 ดีขึ้น ${pct}% จากก่อนรักษาค่ะ ส่งให้ผู้ให้บริการแล้ว${risk === 'เริ่มยาใหม่' ? ' (แจ้งเรื่องยาใหม่ด้วย)' : ''} นวดต่อตามแผน${next ? ` · ${next}` : ''}` };
    if (!urgent && notBetter) return [analysis];
    // ประเมินก่อนนวด (มีนัดครั้งถัดไป) → สรุปผลประเมิน + ครั้งนี้จะรักษาอย่างไร (ไม่ชวนดูผลการรักษาย้อนหลัง)
    if (fc.appointment.date !== '-') return [...(urgent ? [analysis] : []), ...preResultItems(fc, undefined, urgent)];
    return [
      analysis,
      // ต้องพบแพทย์ → ไม่เสนอเลื่อน/จองนัดนวด
      { id: `fu-q-${Date.now()}`, day: 'today', from: 'ai', source: 'AI Interview', time: nowTimeText(), text: 'อยากทราบอะไรเพิ่มคะ?', card: { type: 'intents', options: urgent ? CASE_INTENTS.filter((o) => o !== 'นัดครั้งถัดไป') : CASE_INTENTS } },
    ];
  };
  /** ตอบว่าตรงไหนยังปวด → ส่งให้ผู้ให้บริการ */
  const fuWhereItems = (where: string): ThreadItem[] => {
    const fc = chatCase() ?? tcase;
    // ก่อนนวดครั้งถัดไป → สรุปผลประเมิน (เน้นบริเวณที่บอก)
    if (fc.appointment.date !== '-') {
      log('ระบบ → ผู้ให้บริการ', `ก่อนนวด${fc.short}: ยังปวด ${where}`);
      return preResultItems(fc, where === 'ปวดเท่า ๆ กัน' ? undefined : where);
    }
    return [
    {
      id: `fu-w-${Date.now()}`,
      day: 'today',
      from: 'ai',
      source: 'AI Interview',
      time: nowTimeText(),
      // เพิ่งประเมินเสร็จ → ไม่ชวนประเมินซ้ำ แค่ยืนยันว่าส่งให้ผู้ให้บริการแล้ว
      text: `ส่งให้ผู้ให้บริการแล้วค่ะ${where === 'ปวดเท่า ๆ กัน' ? ' ผู้ให้บริการจะปรับแผนครั้งหน้า' : ` จะเน้น${where}ครั้งหน้า`}`,
    },
    // ทางไปต่อ (ไม่มี "อาการตอนนี้" — เพิ่งประเมินไป)
    { id: `fu-q-${Date.now()}`, day: 'today', from: 'ai', source: 'AI Interview', time: nowTimeText(), text: 'อยากทราบอะไรเพิ่มคะ?', card: { type: 'intents', options: CASE_INTENTS.filter((o) => o !== CASE_INTENTS[0]) } },
  ];
  };
  const answerFuWhere = (where: string) => aiReply(activeId, where, () => fuWhereItems(where));
  /** ประเมิน → ประเมินคัดกรองอีกครั้ง: ต่อในแชทเดิมของเรื่องนั้น ใช้คำตอบโรคประจำตัวชุดเดิม ถามเฉพาะอาการตอนนี้ */
  /** ข้อความ AI + การ์ดทบทวนข้อมูลชุดเดิม (เหลือการ์ดล่าสุดใบเดียว) */
  const reviewItem = (text: string): ThreadItem => ({ id: `review-${Date.now()}`, day: 'today', from: 'ai', source: 'AI Interview', time: nowTimeText(), text, card: { type: 'review' } });
  const withReview = (items: ThreadItem[], text: string) => [...items.filter((m) => m.card?.type !== 'review'), reviewItem(text)];
  /**
   * ประเมินคัดกรองอีกครั้ง = แก้จากข้อมูลชุดเดิม: แสดงคำตอบครั้งก่อนครบทุกข้อ
   * แตะข้อที่อยากแก้ (AI ถามเฉพาะข้อนั้น) หรือพิมพ์คุยกับ AI · ไม่มีอะไรเปลี่ยนก็กดยืนยันได้เลย
   */
  const reassessDraft = (d: DraftCase) => {
    const prevAssess: Assessment = {
      ...blankAssessment(),
      step: 'review',
      sel: Object.fromEntries(d.symptoms.map((x) => [x, null])),
      pain: d.pain,
      duration: d.duration,
      cause: d.cause,
      health: d.health,
      risk: d.risk,
      pressure: d.pressure,
      avoid: d.avoid,
      radiate: d.radiate,
      topic: d.title,
      reuseHealth: d.health,
    };
    const text = 'ข้อมูลที่ประเมินไว้ครั้งก่อนค่ะ แตะข้อที่อยากแก้ หรือพิมพ์บอกได้เลย';
    const id = d.chatId && sessions.some((c) => c.id === d.chatId) ? d.chatId : null;
    if (id) {
      updateSession(id, (c) => ({ ...c, assess: prevAssess, items: withReview(c.items, text) }));
      openChat(id);
    } else {
      const ss: ChatSession = { ...newChatSession(), title: `ประเมิน${d.title}`, items: [reviewItem(text)], assess: prevAssess };
      setSessions((all) => [ss, ...all]);
      upsertDraft({ ...d, chatId: ss.id });
      openChat(ss.id);
    }
    scrollToEnd();
  };
  /** การ์ดสรุปอาการ → "แก้ไข": ทบทวนคำตอบชุดนี้ในแชทเดิม (แตะแก้ทีละข้อ แล้วยืนยันใหม่) */
  const editAssessment = () => {
    // ผลของแชทนี้เป็นใบไหน → แก้แล้วอัปเดตใบเดิม (ไม่สร้างใบซ้ำ)
    const linked = drafts.find((d) => d.chatId === activeId);
    setAssess((a) => ({ ...a, step: 'review', editing: false, reuseHealth: a.health, topic: linked?.title ?? a.topic }));
    setThread((t) => t.filter((m) => m.card?.type !== 'review'));
    aiReply(activeId, 'แก้ไขข้อมูล', () => [reviewItem('แตะข้อที่อยากแก้ หรือพิมพ์บอกได้เลยค่ะ')]);
  };
  /** การ์ดสรุปอาการ → "คุยเพิ่ม": คุยต่อในแชทนี้ */
  const talkMore = () => reply('คุยเพิ่ม', 'อยากเล่าเพิ่มหรือถามเรื่องไหนคะ พิมพ์หรือพูดได้เลยค่ะ');
  /** แตะแก้ข้อหนึ่ง → AI ถามเฉพาะข้อนั้น */
  const editStep = (st: Exclude<AssessStep, 'done' | 'idle' | 'review' | 'topic'>) => {
    // แก้อาการ → อาการร้าวเดิมไม่ใช้แล้ว (ถามใหม่ได้จากหน้าทบทวน)
    setAssess((a) => ({ ...a, step: st, editing: true, ...(st === 'symptoms' ? { radiate: undefined, sel: Object.fromEntries(Object.entries(a.sel).filter(([k]) => HOME_CONTENT.related.includes(k))) } : null) }));
    aiReply(activeId, `แก้${ASSESS_ASK[st].label}`, () => [askItem(st, 'ได้ค่ะ')]);
  };
  /** ยืนยันข้อมูลชุดนี้ → สรุปผล (เหมือนตอบครบ) */
  // ถามต่อเฉพาะข้อที่ยังไม่มีคำตอบ (เช่น ใบเก่าก่อนมีคำถามข้อห้ามนวด/แรงนวด) · ครบแล้ว = สรุปผลเลย
  const confirmReview = () => {
    const missing = (['risk', 'pressure', 'avoid'] as const).find((k) => !assess[k]);
    answerStep('ยืนยันข้อมูลนี้', {}, undefined, missing ? ASSESS_ORDER[ASSESS_ORDER.indexOf(missing) - 1] : 'avoid');
  };
  const newChat = () => {
    // มีการประเมินที่ทำค้างไว้ → ทำต่อจากเดิม (ไม่เริ่มใหม่ให้ต้องตอบซ้ำ)
    if (unfinished) return openChat(unfinished.id);
    setStarted(true);
    bodyRef.current?.face('front');
    const blank = active.title === 'แชทใหม่' && !active.items.some((m) => m.from === 'user') && (active.assess.step === 'topic') === askTopic;
    let sid = active.id;
    if (!blank) {
      const next = newChatSession(askTopic, currentTopic);
      setSessions((all) => [next, ...all]);
      setActiveId(next.id);
      sid = next.id;
    }
    // เริ่มจากแท็บนัดเรื่องใหม่ → ประเมินนี้เป็นของนัดนั้น
    if (selLoose) looseFor.current[sid] = selLoose.id;
    scrollToThread();
  };
  /** ติดตามผลบนหุ่น: "ยังปวด" → เริ่มประเมินโดยกรอกอาการบริเวณนั้นให้แล้ว (ข้ามข้อแรก) */
  const restartFromArea = (a: FollowUpArea = fuActive) => {
    const next = newChatWithSymptom(a.symptom, `${a.label} ยังปวดอยู่ (ต่อจากการรักษา ${fuSession.date})`, fuScores[fuKey(a.pin)]);
    setStarted(true);
    setSessions((all) => [next, ...all]);
    setActiveId(next.id);
    scrollToThread();
  };
  const openChat = (id: string) => {
    setStarted(true);
    bodyRef.current?.face('front');
    setActiveId(id);
    setHistoryOpen(false);
    scrollToThread();
  };
  /** แตะหัวข้อในสรุปการประเมิน → เลื่อนไปที่คำถามนั้น (done → ผลแนวทางการรักษา) */
  const jumpTo = (step: AssessStep) => {
    const target = step === 'done' ? thread.find((m) => m.card?.type === 'guideline') : [...thread].reverse().find((m) => m.ask === step);
    const y = target ? itemY.current[target.id] : undefined;
    if (y !== undefined) scrollToY(threadY.current + y);
  };
  // ไมค์ในช่องแชท → โหมดคุยด้วยเสียง (ref: AI Receptionist)
  const openVoice = () => nav.navigate('AIVoice');
  // ยังไม่เชื่อม AI จริง — ตอบกลับตัวอย่างเพื่อแสดง concept
  /* ---------- หน้าแรกแบบแชท (ยังไม่มีข้อมูลอะไรเลย) ---------- */
  const startAssess = (userText: string) => {
    // ประเมินจากแชทของเรื่องที่รักษาอยู่ → บันทึกในเรื่องนั้น (ไม่สร้างใบร่างใหม่)
    const caseId = Object.keys(caseChats).find((k) => caseChats[k] === activeId);
    const ofCase = cases.find((c) => c.id === caseId);
    setAssess((a) => ({ ...a, step: 'symptoms', topic: ofCase?.short ?? a.topic }));
    aiReply(activeId, userText, () => [askItem('symptoms', 'ได้เลยค่ะ')]);
  };
  const reply = (userText: string, text: string, action?: Extract<ThreadCard, { type: 'action' }>) =>
    aiReply(activeId, userText, () => [{ id: `a${Date.now()}`, day: 'today', from: 'ai', source: 'AI Interview', time: nowTimeText(), text, card: action }]);
  /** คำถามแนะนำ → แต่ละข้อพาไปคนละเส้น */
  const pickIntent = (label: string) => {
    const born = account ? birthElement(account.birthDate) : null;
    // ปุ่ม "ถาม AI": เริ่มเรื่องใหม่ (แชทใหม่ ถามว่าเรื่องเดิมหรืออาการใหม่) · ใบร่าง → ทบทวนผลประเมินเดิม
    if (label === NEW_TOPIC_INTENT) return newChat();
    if (label === DRAFT_REASSESS_INTENT) {
      const d = drafts.find((x) => x.chatId === activeId) ?? selDraft;
      return d ? reassessDraft(d) : startAssess(label);
    }
    // แชทของเรื่องที่รักษาอยู่
    if (CASE_INTENTS.includes(label)) {
      const last = tcase.visits[tcase.visits.length - 1];
      if (label === CASE_INTENTS[0]) {
        // ประเมินวันนี้ไปแล้ว → สรุปผลเดิม (ไม่ถามซ้ำ) · ยังไม่ได้ประเมิน → ถามแบบสั้น (ปวดวันนี้ · อาการหลังนวด · ข้อห้ามใหม่)
        const done = caseToday[tcase.id];
        if (done && tcase.appointment.date !== '-') return aiReply(activeId, label, () => preResultItems(tcase, undefined, done.red));
        if (done)
          return aiReply(activeId, label, () => [
            aiText(
              `วันนี้ประเมินไปแล้วค่ะ ปวด ${done.pain}/10${done.adverse && done.adverse !== 'ไม่มี' ? ` · หลังนวด${done.adverse}` : ''}${done.risk && done.risk !== 'ไม่มี' ? ` · ${done.risk}` : ''} ส่งให้ผู้ให้บริการแล้ว ถ้ามีอาการใหม่ เล่าเพิ่มได้เลย`,
            ),
          ]);
        return aiReply(activeId, label, () => [preAskItem()]);
      }
      if (label === CASE_INTENTS[1])
        return aiReply(activeId, label, () => [
          { id: `h-${Date.now()}`, day: 'today', from: 'ai', source: 'AI Interview', time: nowTimeText(), text: `ผลการรักษา${tcase.short}ค่ะ`, card: { type: 'history', caseId: tcase.id } },
        ]);
      return startCaseBooking(label);
    }
    switch (INTENTS.indexOf(label)) {
      case 0:
        return startAssess(label);
      case 1:
        {
          // จากตารางจริงของที่ใกล้สุด (ไม่ใช่ข้อความตายตัว)
          const near = nearestClinic();
          return reply(
            label,
            near ? `ใกล้คุณมี${near.name} ${near.km} กม.${near.slots.length ? ` คิวว่างวันนี้ ${near.slots.join(' และ ')}` : ' วันนี้คิวเต็มแล้ว'}ค่ะ` : 'ยังไม่พบคลินิกใกล้คุณค่ะ',
            { type: 'action', label: 'ดูสถานที่ทั้งหมด', to: 'Places' },
          );
        }
      case 2:
        return reply(
          label,
          born ? `ธาตุกำเนิดของคุณคือ${ELEMENT_INFO[born].label} ${ELEMENT_INFO[born].advice.replace('\n', ' ')}` : 'ทำแบบประเมินสั้น ๆ เพื่อดูธาตุของคุณได้ค่ะ',
          { type: 'action', label: 'ดูธาตุปัจจุบัน', to: 'ElementQuiz' },
        );
      default:
        return aiReplyAsync(activeId, label, () => knowledgeReply('นวดไทยช่วยบรรเทาอาการอะไรได้บ้าง', { type: 'action', label: 'ประเมินอาการ', to: 'assess' }));
    }
  };
  const runAction = (to: Extract<ThreadCard, { type: 'action' }>['to']) =>
    to === 'assess'
      ? startAssess('ประเมินอาการ')
      : to === 'Booking'
        ? nav.navigate('Booking', chatCase() ? { caseId: chatCase()!.id } : drafts.find((d) => d.chatId === activeId) ? { draftId: drafts.find((d) => d.chatId === activeId)!.id } : undefined)
        : to === 'History'
          ? chatCase()
            ? setSheetCaseId(chatCase()!.id)
            : nav.navigate('ClientTabs', { screen: 'History' })
          : to === 'Places'
          ? nav.navigate('ClientTabs', { screen: 'Places' })
          : to === 'CheckIn'
          ? nav.navigate('CheckIn', { caseId: (chatCase() ?? tcase).id })
          : to === 'CallClinic'
          ? (log('ผู้รับบริการ', 'โทรหาคลินิกเรื่องนัด'), callClinic(chatCase() ? caseClinic(chatCase()!) : undefined))
          : to === 'RedFlag'
          ? nav.navigate('RedFlag', { reason: (chatCase() && urgentCases[chatCase()!.id]) || `ผลประเมิน${bookingContext().topic}` })
          : to === 'SelfCare'
          ? setSheetStretch(chatCase()?.selfCare.groupId ?? stretchGroupFor(Object.keys(assess.sel)))
          : nav.navigate('ElementQuiz');

  /* ---------- AI (Gemma) ในแชท ----------
   * ข้อความที่พิมพ์เอง → เข้าใจแล้วทำต่อตามบริบท: ยังไม่เริ่ม = แยกว่าอยากทำอะไร · กำลังถาม = แปลงเป็นคำตอบของข้อนั้น
   * หน้าทบทวน = แก้ข้อมูลตามที่เล่า · นอกนั้น = ตอบคำถามจากข้อมูลการรักษาของผู้ใช้
   * ความปลอดภัยยังตัดสินด้วย safetyEngine เหมือนเดิม (AI ไม่ตัดสิน) */
  const aiFail = 'ตอนนี้ติดต่อผู้ช่วยไม่ได้ ลองใหม่อีกครั้งค่ะ';
  /** แสดงข้อความผู้ใช้ + กำลังคิด → รอผลจาก AI แล้วแทนที่ */
  const aiReplyAsync = (sid: string, userText: string, produce: () => Promise<ThreadItem[]>, userExtra?: Partial<ThreadItem>) => {
    const time = nowTimeText();
    const aiId = `a${Date.now()}`;
    setThread((t) => [...t, { id: `u${Date.now()}`, day: 'today', from: 'user', text: userText, time, ...userExtra }, { id: aiId, day: 'today', from: 'ai', source: 'AI Interview', time, thinking: 'working' }], sid);
    scrollToEnd();
    produce()
      .catch((): ThreadItem[] => [{ id: `e${Date.now()}`, day: 'today', from: 'ai', source: 'AI Interview', time: nowTimeText(), text: aiFail }])
      .then((items) => {
        setThread((t) => t.flatMap((m) => (m.id === aiId ? items : [m])), sid);
        scrollToEnd();
      });
  };
  const aiText = (text: string, card?: ThreadCard): ThreadItem => ({ id: `a${Date.now()}${Math.random()}`, day: 'today', from: 'ai', source: 'AI Interview', time: nowTimeText(), text, card });
  /** ข้อมูลของผู้ใช้ที่ AI รู้ (ข้อมูลตัวอย่างในต้นแบบ) */
  const aiContext = () =>
    [
      `ชื่อ: ${client.name}${elementTag ? ` · ${elementTag}` : ''}`,
      `โรคประจำตัว: ${profile.conditions.join(', ') || 'ไม่มี'} · ยา: ${profile.medications.join(', ') || 'ไม่มี'}`,
      ...cases.map((c) => {
        const l = c.visits[c.visits.length - 1];
        const fu = followUps.filter((f) => c.pending.some((p) => p.id === f.sessionId)).flatMap((f) => f.areas.map((a) => `${a.area} ${a.painBefore}→${a.painAfter}`));
        return `เรื่องที่รักษา "${c.short}" (${c.condition}): ${c.plan} ครั้งที่ ${c.course.done}/${c.course.total} · ล่าสุด ${l.date} ปวด ${l.painBefore}→${l.painAfter}${fu.length ? ` · ติดตามหลังนวด ${fu.join(', ')}` : ''} · นัดถัดไป ${c.appointment.date} ${c.appointment.time} · ผู้ให้บริการ ${c.therapist}`;
      }),
      ...drafts.map((d) => `ผลประเมิน "${d.title}" (ยังไม่ได้รักษา): ปวด ${d.pain}/10 เป็นมา ${d.duration ?? '-'} ${d.booking ? `นัด ${d.booking.date} ${d.booking.time}` : 'ยังไม่ได้จอง'}`),
      // แชทนี้: ประเมินอยู่/ประเมินแล้ว + ผลคัดกรองและแนวทางในแชท
      ...(Object.keys(assess.sel).length ? [`แชทนี้ประเมิน: ${Object.keys(assess.sel).join(', ')}${assess.radiate ? ` · ${assess.radiate}` : ''} · ปวด ${assess.pain}/10${assess.duration ? ` · เป็นมา ${assess.duration}` : ''}${assess.risk ? ` · ข้อห้ามนวด ${assess.risk}` : ''}`] : []),
      ...thread.flatMap((m) =>
        m.card?.type === 'safety'
          ? [`ผลคัดกรอง: ${m.card.level === 'green' ? 'ไม่พบข้อห้าม' : m.card.level === 'red' ? 'พบข้อห้าม ให้พบแพทย์ก่อน' : 'มีข้อควรระวัง'} ${m.card.items.map((x) => x.title).join(', ')}`]
          : m.card?.type === 'guideline'
            ? [`แนวทาง: ${m.card.condition ?? ''} ${m.card.methods.join(', ')}${m.card.points.length ? ` จุด ${m.card.points.join(', ')}` : ''}`]
            : [],
      ),
    ].join('\n');
  const aiHistory = (): AIMessage[] => thread.filter((m) => m.text && !m.thinking).slice(-6).map((m) => ({ role: m.from === 'user' ? 'user' : 'assistant', content: m.text! }));

  /** คำถามความรู้ → ค้นคลังความรู้ (knowledge hub ในแอป) แล้วตอบพร้อมแหล่งอ้างอิง */
  const knowledgeReply = async (q: string, extra?: ThreadCard): Promise<ThreadItem[]> => {
    const r = await askKnowledge(q, `โรคประจำตัว ${profile.conditions.join(', ') || 'ไม่มี'}`);
    return [
      { ...aiText(r.answer, r.refs.length ? { type: 'sources', refs: r.refs } : undefined), source: 'Knowledge Hub' },
      ...(extra ? [aiText('', extra)] : []),
    ];
  };
  /**
   * ขอแผนการนวด: รวมข้อมูลแรกรับ (ตอบในแชท + บัญชี + ประวัติ + ผลคัดกรอง) → ค้นคลังความรู้ → AI จัดแผนทีละช่วง
   * ข้อมูลที่ใช้แสดงในการ์ดด้วย (ผู้ใช้/ผู้ให้บริการเห็นว่า AI คิดจากอะไร)
   */
  const requestPlan = (userText = 'ขอแผนการนวด') =>
    aiReplyAsync(activeId, userText, async () => {
      const keys = Object.keys(assess.sel);
      const sym = keys.filter((k) => !HOME_CONTENT.related.includes(k));
      const rel = keys.filter((k) => HOME_CONTENT.related.includes(k));
      const safetyCard = [...thread].reverse().find((m) => m.card?.type === 'safety')?.card;
      const safety = safetyCard?.type === 'safety' ? { level: safetyCard.level, items: safetyCard.items.map((x) => x.title) } : { level: 'green' as const, items: [] };
      // ยังไม่ได้ประเมิน / พบข้อห้าม → ไม่วางแผนนวด
      if (!sym.length || assess.step !== 'done') return [aiText('วางแผนการนวดได้หลังประเมินอาการครบค่ะ', { type: 'action', label: 'ประเมินอาการ', to: 'assess' })];
      if (safety.level === 'red') return [{ ...aiText('ยังไม่ควรนวดจนกว่าแพทย์จะตรวจค่ะ จึงยังไม่วางแผนการนวด', { type: 'action', label: 'ดูคำแนะนำ', to: 'RedFlag' }), source: 'Safety Rule Engine' }];
      const intake = buildIntake({
        age: client.age,
        sex: account?.sex,
        occupation: newPatient ? undefined : client.occupation,
        assess,
        symptoms: sym,
        related: rel,
        conditions: profile.conditions,
        medications: profile.medications,
        allergies: profile.allergies,
        bp: profile.bp,
        pulse: profile.pulse,
        history: cases.map((c) => `${c.condition} ${c.plan} ${c.course.done} ครั้ง ปวด ${c.visits[0].painBefore}→${c.visits[c.visits.length - 1].painAfter}`).join(', '),
        safety,
      });
      const g = guideFor(sym, assess.radiate);
      const r = await planMassage(intake, g, sym, profile.conditions);
      return [{ ...aiText('แผนการนวดจากข้อมูลของคุณค่ะ ผู้ให้บริการจะปรับอีกครั้งหน้างาน', { type: 'massagePlan', intake, plan: r.plan, refs: r.refs }), source: 'Knowledge Hub' }];
    });
  /** พิมพ์ถามเอง: เรื่องของตัวเอง (นัด ผลรักษา) → ตอบจากข้อมูลผู้ใช้ · ความรู้ทั่วไป → ค้นคลังความรู้ */
  const freeAnswer = async (text: string, about?: 'personal' | 'knowledge'): Promise<ThreadItem[]> => {
    if (about) return about === 'knowledge' ? knowledgeReply(text) : [aiText(await askAI(text, aiContext(), aiHistory()))];
    const r = await extractAI<{ kind: 'personal' | 'knowledge' }>(
      'จำแนกคำถาม: personal = ถามเรื่องของผู้ใช้เอง (นัด ผลการรักษา ประวัติ คะแนนปวด ผู้ให้บริการ) · knowledge = ถามความรู้ (นวดไทย ข้อห้าม ข้อควรระวัง ประคบ อบ สมุนไพร ท่ายืด โรค/อาการตามแพทย์แผนไทย ธาตุ)',
      text,
      { type: 'object', properties: { kind: { type: 'string', enum: ['personal', 'knowledge'] } }, required: ['kind'] },
    ).catch(() => ({ kind: 'personal' as const }));
    return r.kind === 'knowledge' ? knowledgeReply(text) : [aiText(await askAI(text, aiContext(), aiHistory()))];
  };

  /** ข้อความ → ตำแหน่งที่ปวด (เลือกจากรายการทั้งร่างกาย · ซ้าย/ขวาตามที่ผู้ใช้บอก) */
  const SYMPTOM_PROMPT = `เลือกตำแหน่งที่ปวดที่ผู้ใช้พูดถึงจริงจาก: ${ALL_SYMPTOMS.join(', ')} · ถ้าบอกข้าง (ซ้าย/ขวา) ให้เลือกข้างนั้น ถ้าไม่บอกข้างและมีให้เลือกทั้งสองข้าง ให้เลือกทั้งสองข้าง · ใช้คำพ้องได้ เช่น บั้นเอว/หลังล่าง = ปวดเอว, ซี่โครง = ชายโครง, ก้น = สะโพก, คอ/บ่า/คอบ่าไหล่ = ปวดคอ-บ่า, ขา (ไม่บอกส่วนหรือข้าง) = ปวดขา, หลัง = ปวดหลัง · ห้ามเดา ไม่ตรงเลย = []`;
  /** คำใบ้ต่อข้อ: คำตอบที่ไม่ตรงตัวเลือก (ปฏิเสธ/ใกล้เคียง/ไม่รู้) */
  const STEP_HINT: Record<string, string> = {
    duration: ' · ระยะเวลาที่ไม่ตรงตัวให้เลือกที่ใกล้เคียงที่สุด (เช่น 2 อาทิตย์ = 1 สัปดาห์, 3 เดือน = เกิน 1 เดือน)',
    cause: ' · บอกสาเหตุที่ไม่ตรงตัวเลือกให้เลือกที่ใกล้ที่สุด · ไม่รู้/ไม่มี = ไม่แน่ใจ',
    health: ' · ปฏิเสธ (ไม่มี ไม่เป็นอะไร แข็งแรงดี) = ไม่มี · ความดัน = ความดันสูง',
    risk: ' · ปฏิเสธ (ไม่มี ไม่มีข้อไหนตรง ไม่เป็น ปกติดี) = ไม่มี · ไข้ ไม่สบาย = มีไข้ · ท้อง = ตั้งครรภ์',
    pressure: ' · แรง ๆ/หนักมือ = หนัก · เบา ๆ = เบา · กลาง ๆ = ปานกลาง · แล้วแต่หมอ/ไม่รู้ = ให้ผู้ให้บริการเลือก',
    radiate: ' · ไม่ร้าว/ปวดที่เดียว = ไม่ร้าว · ร้าวถึงน่อง เท้า หรือนิ้วเท้า = ร้าวเลยเข่า · อ่อนแรง ยกขา/แขนไม่ขึ้น = ตัวเลือกที่มีคำว่าอ่อนแรง (ชาอย่างเดียวไม่ใช่)',
  };
  /** กำลังถามข้อหนึ่งอยู่ แต่ผู้ใช้พิมพ์ตอบเอง → AI แปลงเป็นคำตอบของข้อนั้น (แปลงไม่ได้ = ถามซ้ำพร้อมตัวเลือก) */
  const stepOpts = (): Record<string, string[]> => ({ topic: topicOptions, symptoms: [...new Set([...ALL_SYMPTOMS, ...symptomOptions])], related: [...HOME_CONTENT.related, 'ไม่มี'], duration: DURATION_OPTIONS, cause: CAUSE_OPTIONS, health: HEALTH_OPTIONS, risk: RISK_OPTIONS, pressure: PRESSURE_OPTIONS, avoid: AVOID_OPTIONS, radiate: radiateFor(Object.keys(assess.sel))?.options ?? ALL_RADIATE_OPTIONS });
  /** ข้อมูลข้ออื่นที่บอกมาในข้อความเดียวกัน → เก็บไว้ข้ามตอนถึงข้อนั้น · คืนสรุปสั้น ๆ */
  const keepPrefill = (st: AssessStep, f: TurnFields): string[] => {
    const extra: Partial<Assessment> = {};
    (['pain', 'duration', 'cause', 'health', 'risk', 'pressure', 'avoid', 'radiate'] as const).forEach((k) => {
      if (k !== st && f[k] !== null && f[k] !== undefined) (extra as Record<string, unknown>)[k] = f[k];
    });
    // ข้อที่ผ่านมาแล้วไม่เก็บ (ถ้าจะแก้ = ขอแก้คำตอบ)
    const at = ASSESS_ORDER.indexOf(st as (typeof ASSESS_ORDER)[number]);
    Object.keys(extra).forEach((k) => ASSESS_ORDER.indexOf(k as (typeof ASSESS_ORDER)[number]) < at && delete (extra as Record<string, unknown>)[k]);
    if (!Object.keys(extra).length) return [];
    prefill.current[activeId] = { ...prefill.current[activeId], ...extra };
    return Object.entries(extra).map(([k, v]) => (k === 'pain' ? `ปวด ${v}/10` : String(v)));
  };
  const answerStepByText = async (st: Exclude<AssessStep, 'done' | 'idle' | 'review' | 'topic'>, text: string, turn?: Turn) => {
    const opts = stepOpts();
    const noted = turn ? keepPrefill(st, turn.fields) : [];
    try {
      // คัดแยกแล้วได้คำตอบของข้อนี้มาเลย → ไม่ต้องถาม AI ซ้ำ
      if (turn) {
        if (st === 'pain' && turn.fields.pain !== null) return answerStep(text, { pain: turn.fields.pain }, { pain: turn.fields.pain });
        const v = turn.option ?? (turn.fields as unknown as Record<string, string | null>)[st];
        if (st !== 'pain' && st !== 'symptoms' && st !== 'related' && typeof v === 'string' && opts[st].includes(v)) return answerStep(text, { [st]: v } as Partial<Assessment>);
        if (st === 'symptoms' && turn.fields.symptoms?.length) {
          pickSymptoms(turn.fields.symptoms);
          return answerStep(text);
        }
      }
      if (st === 'pain') {
        const r = await extractAI<{ pain: number | null }>('ดึงระดับความปวด 0–10 จากข้อความ ถ้าไม่ได้บอกให้เป็น null', text, { type: 'object', properties: { pain: { type: ['integer', 'null'], minimum: 0, maximum: 10 } }, required: ['pain'] });
        if (r.pain !== null) return answerStep(text, { pain: r.pain }, { pain: r.pain });
      } else if (st === 'symptoms' || st === 'related') {
        const r = await extractAI<{ items: string[] }>(
          st === 'related'
            ? `ผู้ใช้กำลังตอบว่ามีอาการร่วมไหม เลือกจาก: ${opts[st].join(', ')} · ถ้าบอกว่าไม่มี/ไม่มีอาการอื่น ให้ตอบ ["ไม่มี"] · เลือกเฉพาะที่ผู้ใช้พูดถึงจริง ห้ามเดา · ไม่เกี่ยวเลย = []`
            : SYMPTOM_PROMPT,
          text, { type: 'object', properties: { items: { type: 'array', items: { type: 'string', enum: opts[st] } } }, required: ['items'] });
        if (r.items.length) {
          const picked = r.items.filter((x) => x !== 'ไม่มี');
          if (picked.length) {
            if (st === 'symptoms') pickSymptoms(picked);
            else setSel((cur) => ({ ...cur, ...Object.fromEntries(picked.map((x) => [x, null])) }));
          }
          return answerStep(text);
        }
      } else {
        const r = await extractAI<{ value: string | null }>(`เลือกคำตอบที่ตรงกับข้อความจาก: ${opts[st].join(', ')}${STEP_HINT[st] ?? ''} ถ้าไม่เกี่ยวเลยให้เป็น null`, text, { type: 'object', properties: { value: { type: ['string', 'null'], enum: [...opts[st], null] } }, required: ['value'] });
        if (r.value) return answerStep(text, { [st]: r.value } as Partial<Assessment>);
      }
    } catch {
      /* ตกไปถามซ้ำ */
    }
    // ไม่ได้ตอบข้อนี้ แต่บอกข้ออื่นมา → จดไว้ แล้วถามข้อนี้ต่อ
    aiReply(activeId, text, () => [askItem(st, noted.length ? `จดไว้แล้วค่ะ (${noted.join(' · ')})` : 'ขอโทษค่ะ ไม่แน่ใจคำตอบ')]);
  };

  /** หน้าทบทวนข้อมูลชุดเดิม: เล่าว่าอะไรเปลี่ยน → AI แก้ให้ */
  const editReviewByText = (text: string) => {
    setThread((t) => t.filter((m) => m.card?.type !== 'review'));
    aiReplyAsync(activeId, text, async () => {
      type Edit = { symptoms: string[] | null; radiate: string | null; pain: number | null; duration: string | null; cause: string | null; health: string | null; risk: string | null; pressure: string | null; avoid: string | null };
      const r = await extractAI<Edit>(
        `ดึงเฉพาะข้อมูลที่ผู้ใช้บอกว่าเปลี่ยน ข้อที่ไม่ได้พูดถึงให้เป็น null · symptoms = ตำแหน่งที่ปวดชุดใหม่ทั้งหมด (เลือกจาก: ${ALL_SYMPTOMS.join(', ')}) · ระยะเวลาที่ไม่ตรงตัวเลือกให้เลือกที่ใกล้ที่สุด`,
        text,
        {
          type: 'object',
          properties: {
            symptoms: { type: ['array', 'null'], items: { type: 'string', enum: ALL_SYMPTOMS } },
            radiate: { type: ['string', 'null'], enum: [...ALL_RADIATE_OPTIONS, null] },
            pain: { type: ['integer', 'null'], minimum: 0, maximum: 10 },
            duration: { type: ['string', 'null'], enum: [...DURATION_OPTIONS, null] },
            cause: { type: ['string', 'null'], enum: [...CAUSE_OPTIONS, null] },
            health: { type: ['string', 'null'], enum: [...HEALTH_OPTIONS, null] },
            risk: { type: ['string', 'null'], enum: [...RISK_OPTIONS, null] },
            pressure: { type: ['string', 'null'], enum: [...PRESSURE_OPTIONS, null] },
            avoid: { type: ['string', 'null'], enum: [...AVOID_OPTIONS, null] },
          },
          required: ['symptoms', 'radiate', 'pain', 'duration', 'cause', 'health', 'risk', 'pressure', 'avoid'],
        },
      );
      const patch: Partial<Assessment> = {};
      const done: string[] = [];
      if (r.symptoms?.length) {
        // อาการชุดใหม่แทนชุดเดิม (เก็บอาการร่วมไว้)
        setSel((cur) => ({ ...Object.fromEntries(Object.entries(cur).filter(([k]) => HOME_CONTENT.related.includes(k))), ...Object.fromEntries(r.symptoms!.map((x) => [x, null])) }));
        setExtraSymptoms(() => r.symptoms!.filter((x) => !HOME_CONTENT.symptoms.includes(x)));
        done.push(`อาการ ${r.symptoms.join(', ')}`);
      }
      if (r.radiate) (patch.radiate = r.radiate), done.push(`อาการร้าว ${r.radiate}`);
      if (r.risk) (patch.risk = r.risk), done.push(`ข้อห้ามนวด ${r.risk}`);
      if (r.pressure) (patch.pressure = r.pressure), done.push(`แรงนวด ${r.pressure}`);
      if (r.avoid) (patch.avoid = r.avoid), done.push(r.avoid === 'ไม่มี' ? 'นวดได้ทุกส่วน' : `ไม่นวด${r.avoid}`);
      if (r.pain !== null) (patch.pain = r.pain), done.push(`ความปวด ${r.pain}/10`);
      if (r.duration) (patch.duration = r.duration), done.push(`ระยะเวลา ${r.duration}`);
      if (r.cause) (patch.cause = r.cause), done.push(`สาเหตุ ${r.cause}`);
      if (r.health) (patch.health = r.health), (patch.reuseHealth = r.health), done.push(`โรคประจำตัว ${r.health}`);
      setAssess((a) => ({ ...a, ...patch }));
      return [reviewItem(done.length ? `แก้ให้แล้วค่ะ: ${done.join(' · ')} มีข้ออื่นอีกไหม หรือยืนยันได้เลย` : 'ยังไม่เจอข้อที่เปลี่ยนค่ะ แตะข้อที่ต้องการแก้ได้เลย')];
    });
  };

  /** หลังได้อาการ: อาการนั้นมีรูปแบบการร้าว → ถามว่าร้าวไปไหน · ไม่มี → ข้ามไปอาการร่วม (อ่านอาการล่าสุดของแชท ณ ตอนตอบ) */
  const radiateOrNext = (sid: string, picked?: string[], lead = 'รับทราบค่ะ'): ThreadItem[] => {
    const syms = picked ?? Object.keys(sessionsRef.current.find((c) => c.id === sid)?.assess.sel ?? {}).filter((k) => !HOME_CONTENT.related.includes(k));
    const r = radiateFor(syms);
    setAssess((a) => ({ ...a, step: r ? 'radiate' : 'related' }), sid);
    return r ? [askItem('radiate', lead, `${r.symptom}ร้าวไปที่อื่นไหมคะ?`)] : [askItem('related', lead)];
  };
  /** ติดตามผล: พิมพ์คะแนนปวด → บันทึกเหมือนแตะ · ไม่เจอตัวเลข = ถามซ้ำ */
  const answerFuByText = (card: Extract<ThreadCard, { type: 'fuAsk' }>, text: string) =>
    aiReplyAsync(activeId, text, async () => {
      const r = await extractAI<{ pain: number | null }>('ดึงระดับความปวดตอนนี้ 0–10 จากข้อความ (หายแล้ว = 0) ถ้าไม่ได้บอกให้เป็น null', text, {
        type: 'object',
        properties: { pain: { type: ['integer', 'null'], minimum: 0, maximum: 10 } },
        required: ['pain'],
      });
      if (r.pain === null) return [{ ...aiText(`ขอเป็นตัวเลข 0–10 นะคะ ${card.label}ตอนนี้ปวดเท่าไหร่คะ?`, card) }];
      return fuScoreItems(card, r.pain);
    });
  const answerFuAdverseByText = (text: string) =>
    aiReplyAsync(activeId, text, async () => {
      const r = await extractAI<{ value: string | null }>(`ผู้ใช้ตอบว่าหลังนวดมีอาการผิดปกติไหม เลือกจาก: ${FU_ADVERSE.join(', ')} · ปกติดี/ไม่มีอะไร = ไม่มี · ไม่เกี่ยว = null`, text, {
        type: 'object',
        properties: { value: { type: ['string', 'null'], enum: [...FU_ADVERSE, null] } },
        required: ['value'],
      });
      if (!r.value) return [aiText('หลังนวดมีอาการผิดปกติไหมคะ?', { type: 'fuAdverse' })];
      return fuAdverseItems(r.value);
    });
  /** บริการที่จองไม่ตรงผลประเมิน: ผู้ใช้เลือกเอง — เปลี่ยนตามคำแนะนำ (หน้าเปลี่ยนบริการของนัดเดิม) / ใช้แผนเดิม (คงนัด ไม่เตือนซ้ำ) */
  const pickPlanChoice = (c: Extract<ThreadCard, { type: 'planChoice' }>, o: string) => {
    const d = drafts.find((x) => x.id === c.draftId);
    if (o === PLAN_CHOICES[0]) {
      aiReply(activeId, o, () => [aiText('เลือกบริการและเวลาใหม่ได้เลยค่ะ นัดใหม่จะแทนนัดเดิม')]);
      return nav.navigate('Booking', { draftId: c.draftId, clinic: c.clinic });
    }
    if (d) upsertDraft({ ...d, keepService: true });
    log('ผู้รับบริการ', `คงบริการที่จองไว้ (${d?.booking?.service ?? ''}) แม้ไม่ตรงผลประเมิน`);
    aiReply(activeId, o, () => [aiText('คงนัดเดิมค่ะ แจ้งผู้ให้บริการแล้ว เปลี่ยนภายหลังได้ที่รายละเอียดนัด')]);
  };
  /** ข้อห้ามใหม่ก่อนนวด: พิมพ์ตอบ (เช่น "ตัวร้อนนิดหน่อย") → เลือกจากตัวเลือก · ไม่เกี่ยว = ถามซ้ำ */
  const answerFuRiskByText = (text: string) =>
    aiReplyAsync(activeId, text, async () => {
      const r = await extractAI<{ value: string | null }>(`ผู้ใช้ตอบว่าก่อนนวดครั้งถัดไปมีข้อห้ามใหม่ไหม เลือกจาก: ${FU_RISK.join(', ')} · ตัวร้อน/เป็นไข้ = มีไข้ · ล้ม/เคล็ด/บาดเจ็บภายใน 2 วัน = บาดเจ็บภายใน 2 วัน · บาดเจ็บนานกว่า 2 วัน = ไม่มี · ได้ยาใหม่ = เริ่มยาใหม่ · ปกติดี = ไม่มี · ไม่เกี่ยว = null`, text, {
        type: 'object',
        properties: { value: { type: ['string', 'null'], enum: [...FU_RISK, null] } },
        required: ['value'],
      });
      if (!r.value) return [aiText('ก่อนนวดครั้งถัดไป มีข้อใดต่อไปนี้ไหมคะ?', { type: 'fuRisk' })];
      return fuAdverseItems(pendingAdverse.current, r.value);
    });
  /** เรื่องเดิมหรืออาการใหม่: พิมพ์ตอบ → เลือกจากตัวเลือก */
  const answerTopicByText = (text: string) =>
    aiReplyAsync(activeId, text, async () => {
      const r = await extractAI<{ value: string | null }>(`ผู้ใช้ตอบว่าเป็นเรื่องเดิมเรื่องไหน หรืออาการใหม่ เลือกจาก: ${topicOptions.join(', ')} · ไม่ชัด = null`, text, {
        type: 'object',
        properties: { value: { type: ['string', 'null'], enum: [...topicOptions, null] } },
        required: ['value'],
      });
      if (!r.value) return [askItem('topic', 'ขอโทษค่ะ ไม่แน่ใจคำตอบ')];
      setAssess((a) => ({ ...a, topic: r.value!, step: 'symptoms' }));
      return [askItem('symptoms', 'รับทราบค่ะ')];
    });

  /** ยังไม่เริ่มอะไร: AI แยกว่าอยากทำอะไร แล้วพาไปเส้นนั้น */
  const routeByText = (text: string, turn?: Turn) =>
    aiReplyAsync(activeId, text, async () => {
      const r = await extractAI<{ intent: 'assess' | 'places' | 'element' | 'plan' | 'question' }>(
        'จำแนกเจตนา: assess = เล่าอาการ/ปวด/ไม่สบาย · places = หาที่นวด/จองนวด · element = ธาตุ · plan = ขอแผนการนวด/แผนการรักษา · question = ถามทั่วไป',
        text,
        { type: 'object', properties: { intent: { type: 'string', enum: ['assess', 'places', 'element', 'plan', 'question'] } }, required: ['intent'] },
      );
      // แผนการนวดต้องมีข้อมูลจากการประเมินก่อน
      if (r.intent === 'plan') return [aiText('วางแผนการนวดได้หลังประเมินอาการค่ะ ใช้เวลาไม่กี่นาที', { type: 'action', label: 'ประเมินอาการ', to: 'assess' })];
      if (r.intent === 'assess') {
        // แชทของเรื่องที่รักษาอยู่ → บันทึกในเรื่องนั้น (เหมือนกดประเมินจากแชทนั้น)
        const ofCase = cases.find((c) => c.id === Object.keys(caseChats).find((k) => caseChats[k] === activeId));
        if (ofCase) setAssess((a) => ({ ...a, topic: ofCase.short }));
        // เล่าอาการมาในข้อความแรกเลย (เช่น "ปวดคอมาก") → เก็บอาการแล้วถามข้อถัดไป ไม่ถามซ้ำ
        const sym = await extractAI<{ items: string[] }>(SYMPTOM_PROMPT, text, {
          type: 'object',
          properties: { items: { type: 'array', items: { type: 'string', enum: ALL_SYMPTOMS } } },
          required: ['items'],
        }).catch(() => ({ items: [] as string[] }));
        if (sym.items.length) {
          pickSymptoms(sym.items);
          // บอกข้ออื่นมาด้วย (ปวดเท่าไหร่ เป็นมานานแค่ไหน …) → เก็บไว้ ถึงข้อนั้นแล้วข้าม
          if (turn) keepPrefill('symptoms', turn.fields);
          return radiateOrNext(activeId, sym.items, `รับทราบค่ะ ${sym.items.join(', ')}`);
        }
        setAssess((a) => ({ ...a, step: 'symptoms' }));
        return [askItem('symptoms', 'ได้เลยค่ะ')];
      }
      if (r.intent === 'places') return [aiText('ใกล้คุณมีคลินิกที่ว่างวันนี้ค่ะ', { type: 'action', label: 'ดูสถานที่ทั้งหมด', to: 'Places' })];
      if (r.intent === 'element') return [aiText(await askAI(text, aiContext())), aiText('', { type: 'action', label: 'ดูธาตุปัจจุบัน', to: 'ElementQuiz' })];
      return freeAnswer(text);
    });

  /** เดิม: ส่งข้อความไปตามสถานะของแชท (ใช้เมื่อเป็นคำตอบของข้อที่ค้าง หรือคัดแยกแล้วว่าเป็นคำตอบ) */
  const routeAnswer = (text: string, turn?: Turn) => {
    const st = assess.step;
    // แชทของเรื่องที่รักษาอยู่: พิมพ์ขอจอง/เลื่อนนัด → นัดของเรื่องนี้ (คลินิกนัดให้)
    if (chatCase() && /จอง|นัด|เลื่อน/.test(text) && !/ยกเลิก/.test(text)) return startCaseBooking(text);
    const lastCard = thread[thread.length - 1]?.card;
    if (lastCard?.type === 'fuAsk') return turn?.fields.pain != null ? answerFuScore(lastCard, turn.fields.pain) : answerFuByText(lastCard, text);
    if (lastCard?.type === 'fuAdverse') return turn?.option ? answerFuAdverse(turn.option) : answerFuAdverseByText(text);
    if (lastCard?.type === 'fuRisk') return turn?.option ? answerFuRisk(turn.option) : answerFuRiskByText(text);
    if (lastCard?.type === 'fuWhere') return aiReply(activeId, text, () => fuWhereItems(text));
    // การ์ดที่ปกติให้แตะ: พิมพ์ตอบตรงตัวเลือก → ทำเหมือนแตะ
    const opt = turn?.option ?? (lastCard ? cardOptions(lastCard).find((o) => o === text.trim()) : undefined);
    if (opt && lastCard?.type === 'planChoice') return pickPlanChoice(lastCard, opt);
    if (opt && lastCard?.type === 'intents') return pickIntent(opt);
    if (opt && lastCard?.type === 'slotPick') return pickSlot(lastCard.placeId, lastCard.therapistId, opt, text);
    if (opt && lastCard?.type === 'choice') return pickChoice(lastCard, opt);
    if (st === 'topic') return answerTopicByText(text);
    if (st === 'idle') return routeByText(text, turn);
    if (st === 'review') return editReviewByText(text);
    if (st !== 'done') return answerStepByText(st, text, turn);
    // ประเมินครบแล้วพิมพ์ขอแผน → วางแผนการนวดจากข้อมูลแรกรับ · ขอจอง → จองกับ AI ในแชท
    if (/แผน(การ)?(นวด|รักษา)/.test(text)) return requestPlan(text);
    if (latestGuide() && /จอง|นัด(นวด)?(ได้|หน่อย|ให้)/.test(text)) return startBooking(text);
    aiReplyAsync(activeId, text, () => freeAnswer(text, turn?.about));
  };

  /** ตัวเลือกของการ์ดที่รอคำตอบ */
  const cardOptions = (c: ThreadCard): string[] =>
    c.type === 'fuAsk' ? PAIN_CHIPS : c.type === 'fuAdverse' ? FU_ADVERSE : c.type === 'fuRisk' ? FU_RISK : c.type === 'planChoice' ? PLAN_CHOICES : c.type === 'fuWhere' || c.type === 'intents' || c.type === 'slotPick' || c.type === 'choice' ? c.options : [];
  /** การ์ดที่ยังรอผู้ใช้ตอบ (ข้อความล่าสุดเท่านั้น) */
  const WAITING: ThreadCard['type'][] = ['fuAsk', 'fuAdverse', 'fuRisk', 'fuWhere', 'planChoice', 'intents', 'slotPick', 'therapistPick', 'placePick', 'bookConfirm', 'choice'];
  /** คำถามที่ค้างอยู่ตอนนี้: การ์ดที่รอตอบ / ข้อประเมิน / หน้าทบทวน · ไม่มี = คุยต่ออิสระ */
  const pendingNow = (): { label: string; options: string[]; item?: ThreadItem } | null => {
    const last = thread[thread.length - 1];
    if (last?.card && WAITING.includes(last.card.type)) return { label: last.text ?? '', options: cardOptions(last.card), item: last };
    const st = assess.step;
    if (st === 'idle' || st === 'done') return null;
    if (st === 'review') return { label: 'ทบทวนคำตอบชุดเดิม แก้ข้อไหน หรือยืนยัน', options: [], item: [...thread].reverse().find((m) => m.card?.type === 'review') };
    const item = [...thread].reverse().find((m) => m.ask === st);
    return { label: item?.text ?? ASSESS_ASK[st].text, options: stepOpts()[st] ?? [], item };
  };
  /** ถามแทรก/เปลี่ยนเรื่องแล้ว → ถามข้อที่ค้างซ้ำ (การ์ดและตัวเลือกเดิม) */
  const resumeItems = (lead: string): ThreadItem[] => {
    const p = pendingNow();
    if (!p) return [];
    if (assess.step === 'review' && !p.item?.card) return [reviewItem(lead)];
    if (p.item?.card?.type === 'review') return [reviewItem(`${lead} แก้ข้อไหน หรือยืนยันได้เลย`)];
    // ข้อประเมิน → ถามใหม่ด้วยคำถามเดิม (ไม่ติดข้อความนำของรอบก่อน)
    const st = assess.step;
    if (p.item?.ask && st !== 'idle' && st !== 'done' && st !== 'review') {
      const r = st === 'radiate' ? radiateFor(Object.keys(assess.sel)) : null;
      return [askItem(st, lead, r ? `${r.symptom}ร้าวไปที่อื่นไหมคะ?` : undefined)];
    }
    if (p.item) return [{ ...p.item, id: `re-${Date.now()}`, time: nowTimeText(), thinking: undefined, text: `${lead}\n${p.item.text ?? ''}`.trim() }];
    return assess.step !== 'idle' && assess.step !== 'done' ? [askItem(assess.step, lead)] : [];
  };
  /** เริ่มประเมินใหม่ในแชทนี้ (แชทของเรื่องที่รักษา → หัวข้อ = เรื่องนั้น) · บอกอาการมาแล้ว → ข้ามข้ออาการ */
  const beginAssess = async (turn: Turn, text: string): Promise<ThreadItem[]> => {
    const ofCase = chatCase();
    setAssess((a) => ({ ...blankAssessment(), topic: ofCase?.short ?? a.topic }));
    // ตัวคัดแยกไม่ได้ดึงอาการมา → ใช้ตัวอ่านตำแหน่งที่ปวดโดยเฉพาะ (ชุดเดียวกับข้อความแรก)
    const sym = turn.fields.symptoms?.length
      ? turn.fields.symptoms
      : (await extractAI<{ items: string[] }>(SYMPTOM_PROMPT, text, { type: 'object', properties: { items: { type: 'array', items: { type: 'string', enum: ALL_SYMPTOMS }, maxItems: 6 } }, required: ['items'] }).catch(() => ({ items: [] as string[] }))).items;
    if (!sym.length) return [askItem('symptoms', 'ได้เลยค่ะ')];
    pickSymptoms(sym);
    keepPrefill('symptoms', turn.fields);
    // คำถามอาการร้าวบอกชื่ออาการอยู่แล้ว → ไม่ต้องทวนซ้ำ
    return radiateOrNext(activeId, sym, radiateFor(sym) ? 'รับทราบค่ะ' : `รับทราบค่ะ ${sym.join(', ')}`);
  };
  /** การ์ดถามยืนยัน → เลือกแล้วทำต่อ */
  const pickChoice = (c: Extract<ThreadCard, { type: 'choice' }>, o: string) => {
    const tc = chatCase();
    if (o === c.options[0]) {
      log('ระบบ → ผู้ให้บริการ', `ผู้รับบริการแจ้ง${tc ? ` (${tc.short})` : ''}: ${c.payload}`);
      notifyClinic('ผู้รับบริการร้องเรียนผ่านแอป', `${tc ? `${tc.short}: ` : ''}${c.payload}`);
      return aiReply(activeId, o, () => [aiText('แจ้งคลินิกแล้วค่ะ คลินิกจะติดต่อกลับ ถ้าอาการแย่ลงเร็ว โทรหาคลินิกได้เลย', { type: 'action', label: 'ติดต่อคลินิก', to: 'CallClinic' }), ...afterChoice.current]);
    }
    aiReply(activeId, o, () => [aiText('ได้ค่ะ ไม่แจ้ง ถ้าเปลี่ยนใจพิมพ์บอกได้เลย'), ...afterChoice.current]);
  };

  /**
   * ข้อความที่พิมพ์เอง → คัดแยกก่อน (ตอบ / ถามแทรก / แก้คำตอบ / หยุด / เปลี่ยนเรื่อง / ร้องเรียน / ไม่ชัด) แล้วค่อยทำต่อ
   * คำตอบสั้น ๆ ของข้อที่ค้างอยู่ไม่ต้องคัดแยก (เร็วเหมือนเดิม)
   */
  const send = (text: string) => {
    // อาการฉุกเฉิน → เตือนทันที ไม่รอ AI (กฎตายตัว)
    if (EMERGENCY.test(text)) return reply(text, 'อาการนี้อาจเป็นภาวะฉุกเฉิน โทร 1669 หรือไปโรงพยาบาลทันทีค่ะ ยังไม่ควรนวด', { type: 'action', label: 'ดูคำแนะนำ', to: 'RedFlag' });
    const pend = pendingNow();
    const lastCard = thread[thread.length - 1]?.card;
    // ตอบข้อประเมิน/ติดตามผลแบบสั้น ๆ → ส่งเข้าข้อนั้นเลย
    const shortOk = !lastCard || !WAITING.includes(lastCard.type) || ['fuAsk', 'fuAdverse', 'fuRisk', 'fuWhere'].includes(lastCard.type) || cardOptions(lastCard).includes(text.trim());
    if (pend && shortOk && isPlainAnswer(text, pend.options)) return routeAnswer(text);
    triage(text, pend);
  };
  const triage = (text: string, pend: ReturnType<typeof pendingNow>) => {
    const sid = activeId;
    const time = nowTimeText();
    const uId = `u${Date.now()}`;
    const aId = `t${Date.now()}`;
    setThread((t) => [...t, { id: uId, day: 'today', from: 'user', text, time }, { id: aId, day: 'today', from: 'ai', source: 'AI Interview', time, thinking: 'working' }], sid);
    scrollToEnd();
    const put = (items: ThreadItem[]) => {
      setThread((t) => t.flatMap((m) => (m.id === aId ? items : [m])), sid);
      scrollToEnd();
    };
    // ส่งต่อให้ตัวจัดการเดิม (ตัวนั้นใส่ข้อความผู้ใช้เอง) → เอาของชั่วคราวออก
    const handOff = (turn?: Turn) => {
      setThread((t) => t.filter((m) => m.id !== uId && m.id !== aId), sid);
      routeAnswer(text, turn);
    };
    const ENUMS: TurnEnums = { symptoms: ALL_SYMPTOMS, duration: DURATION_OPTIONS, cause: CAUSE_OPTIONS, health: HEALTH_OPTIONS, risk: RISK_OPTIONS, pressure: PRESSURE_OPTIONS, avoid: AVOID_OPTIONS, radiate: ALL_RADIATE_OPTIONS };
    classifyTurn(text, pend, ENUMS, SYMPTOM_PROMPT)
      .then(async (turn) => {
        const tc = chatCase();
        const st = assess.step;
        const assessing = st !== 'idle' && st !== 'done';
        // AI สงสัยอาการอันตราย (กฎจับคำไม่เจอ) → เตือนพบแพทย์ แจ้งผู้ให้บริการ แล้วค่อยทำต่อ (ไม่ตัดสินแทนระบบคัดกรอง)
        if (turn.danger) {
          log('ระบบ → ผู้ให้บริการ', `AI พบข้อความที่อาจเป็นอาการอันตราย: ${text}`);
          return put([
            aiText('อาการที่เล่ามาควรให้แพทย์ตรวจก่อนนวดค่ะ ถ้าเป็นเฉียบพลันหรือรุนแรง โทร 1669', { type: 'action', label: 'ดูคำแนะนำ', to: 'RedFlag' }),
            ...resumeItems('ถ้าไม่ใช่อาการเฉียบพลัน ตอบข้อนี้ต่อได้ค่ะ'),
          ]);
        }
        switch (turn.kind) {
          case 'question':
            return put([...(await freeAnswer(text, turn.about)), ...resumeItems('กลับมาที่คำถามค่ะ')]);
          case 'pause':
            return put([aiText(assessing ? 'ได้ค่ะ เก็บคำตอบไว้แล้ว กลับมาทำต่อจากข้อนี้ได้ทุกเมื่อ' : 'ได้ค่ะ กลับมาคุยต่อได้ทุกเมื่อ')]);
          case 'complaint':
            // ถามก่อนว่าจะให้แจ้งคลินิกไหม (ไม่แจ้งเอง) · ตอบแล้วกลับไปคำถามที่ค้าง
            afterChoice.current = resumeItems('กลับมาที่คำถามค่ะ');
            return put([
              aiText(`ขอโทษที่เป็นแบบนี้ค่ะ ${tc ? `ให้แจ้งคลินิกของเรื่อง${tc.short}ไหมคะ` : 'ให้แจ้งคลินิกไหมคะ'}`, { type: 'choice', kind: 'complaint', options: ['แจ้งคลินิก', 'ไม่ต้อง'], payload: text }),
            ]);
          case 'change': {
            if (st === 'review' || st === 'done' && !tc) {
              // หลังประเมิน/หน้าทบทวน: แก้แล้วกลับไปหน้าทบทวน (ยืนยันใหม่เพื่อสรุปผล)
              if (st === 'done') setAssess((a) => ({ ...a, step: 'review', editing: false, reuseHealth: a.health }));
              setThread((t) => t.filter((m) => m.id !== uId && m.id !== aId), sid);
              return editReviewByText(text);
            }
            if (!assessing) return put(await freeAnswer(text, turn.about));
            const f = turn.fields;
            const patch: Partial<Assessment> = {};
            const done: string[] = [];
            (['pain', 'duration', 'cause', 'health', 'risk', 'pressure', 'avoid', 'radiate'] as const).forEach((k) => {
              if (f[k] === null || f[k] === undefined) return;
              (patch as Record<string, unknown>)[k] = f[k];
              done.push(k === 'pain' ? `ปวด ${f.pain}/10` : String(f[k]));
            });
            if (f.symptoms?.length) {
              setSel((cur) => ({ ...Object.fromEntries(Object.entries(cur).filter(([k]) => HOME_CONTENT.related.includes(k))), ...Object.fromEntries(f.symptoms!.map((x) => [x, null])) }));
              done.push(f.symptoms.join(', '));
            }
            // ข้อที่ยังไม่ถึง → เก็บไว้ข้ามตอนถึง · ข้อที่ผ่านแล้ว → แก้เลย
            keepPrefill(st, f);
            setAssess((a) => ({ ...a, ...patch }));
            return put(resumeItems(done.length ? `แก้ให้แล้วค่ะ (${done.join(' · ')})` : 'อยากแก้ข้อไหนคะ พิมพ์บอกได้เลย เช่น "ปวด 5"'));
          }
          case 'switch': {
            const to = turn.switchTo;
            if (to === 'booking' || to === 'cancel') {
              if (tc) return handOff(turn);
              if (!assessing) return handOff(turn);
              return put([aiText('ประเมินให้ครบก่อน จะได้นัดบริการที่ตรงกับอาการค่ะ หรือไปหน้าจองเลยก็ได้', { type: 'action', label: 'ไปหน้าจอง', to: 'Booking' }), ...resumeItems('หรือตอบข้อนี้ต่อค่ะ')]);
            }
            if (to === 'places') return put([aiText('ดูสถานที่ใกล้คุณได้เลยค่ะ', { type: 'action', label: 'ดูสถานที่ทั้งหมด', to: 'Places' }), ...resumeItems('หรือตอบข้อนี้ต่อค่ะ')]);
            // ยังไม่ได้ตอบข้อแรก → เริ่มจากที่เล่ามาได้เลย
            if (to === 'assess' && st === 'symptoms') return put(await beginAssess(turn, text));
            if (to === 'assess' && assessing) return put([aiText('ตอบข้อนี้ให้จบก่อน แล้วเริ่มเรื่องใหม่ได้ที่ "แชทใหม่" ค่ะ'), ...resumeItems('')]);
            // อยากประเมินใหม่ (เช่น ในแชทของเรื่องที่รักษาอยู่) → เริ่มประเมินเลย ผลไปตามกฎของเรื่องนั้น (บริเวณเดิม/ใหม่)
            if (to === 'assess') return put(await beginAssess(turn, text));
            return handOff(turn);
          }
          case 'unclear':
            if (pend) return put(resumeItems('ขอโทษค่ะ ยังไม่แน่ใจ เลือกจากตัวเลือก หรือเล่าเพิ่มอีกนิดได้ไหมคะ'));
            return handOff(turn);
          default: {
            // ตอบการ์ดที่ต้องแตะ (เลือกผู้ให้บริการ/สถานที่/ยืนยันจอง) → ชี้ให้แตะ
            const lc = thread[thread.length - 1]?.card;
            if (lc && ['therapistPick', 'placePick', 'bookConfirm'].includes(lc.type)) return put(resumeItems('แตะเลือกจากการ์ดได้เลยค่ะ'));
            return handOff(turn);
          }
        }
      })
      // คัดแยกไม่ได้ (AI ล่ม) → ทำแบบเดิม
      .catch(() => handOff());
  };
  /* ดูเพิ่มเติมจากแชท → bottom sheet: รายละเอียดการรักษา · ท่ายืด */
  const [sheetCaseId, setSheetCaseId] = React.useState<string | null>(null);
  const [sheetStretch, setSheetStretch] = React.useState<string | null>(null);
  const dockH = useDockHeight();
  // คุยกับ AI (ไม่ใช่แชทหน้าแรกครั้งแรก) / ให้คะแนนบนหุ่น → ซ่อน tab menu ให้โฟกัส · ออกแล้วกลับมา
  useHideTabs(started || focus);

  // หุ่น 3D ใหญ่ที่สุดเท่าพื้นที่ว่างจริงของจอ: จากใต้ขอบบนลงถึงขอบบนของช่องแชท/tab (ส่วนบนของ dock เป็น fade โปร่ง)
  // ไม่เล็กกว่ากรอบ Figma 232×583 · กว้างตามสัดส่วนหุ่น (เผื่อแขนตอนหมุน)
  const { height: winH, width: winW } = useWindowDimensions();
  // ความสูง dock ตอนมีช่องแชท: ก่อนเริ่มยังไม่มีช่องแชทให้วัด → ใช้ค่าประมาณ (หลังเริ่มใช้ค่าที่วัดจริง)
  const chatDockH = started ? dockH : insets.bottom + componentTokens.dock.marginBottom + space[12] + space[10] + space[2] + componentTokens.composerV2.height;
  const bodyH = Math.max(componentTokens.body3d.height, Math.round((winH - insets.top - space[4] - BODY_TOP_CLEAR - chatDockH + space[8]) * BODY_FILL));
  const bodyW = Math.round(bodyH * BODY_ASPECT);
  // ให้ขอบขวาของ "ตัวหุ่น" (ไม่ใช่กรอบ canvas) ห่างขอบจอเท่ากระดิ่ง (space[5])
  const { fov, cameraZ } = componentTokens.body3d;
  const pxPerUnit = bodyH / (2 * cameraZ * Math.tan(((fov / 2) * Math.PI) / 180));
  const bodyRight = space[5] - (bodyW / 2 - FIGURE_RIGHT_EXTENT * pxPerUnit);

  /* หน้าเริ่มต้น: หุ่นใหญ่ขึ้น อยู่กลางจอ (จากใต้รูปโปรไฟล์ลงถึงเหนือปุ่มเริ่มประเมิน)
   * canvas วาดที่ขนาดใหญ่ (intro) เสมอ → ตอนเริ่มประเมินย่อลงด้วย transform (คมชัด ไม่ต้องสร้าง canvas ใหม่) */
  const ctaDockH = insets.bottom + componentTokens.dock.marginBottom + space[12] + componentTokens.voice.cta;
  const introTop = insets.top + space[4];
  const introH = Math.max(bodyH, Math.round(winH - introTop - ctaDockH + space[6]));
  const introW = Math.round(introH * BODY_ASPECT);
  const bodyTop = insets.top + space[4] + BODY_TOP_CLEAR;
  const colW = Math.min(winW, g.maxContentWidth);
  const bodyLeft = (winW - colW) / 2 + colW - bodyRight - bodyW;
  const k = bodyH / introH;
  const dx = bodyLeft + bodyW / 2 - winW / 2;
  const dy = bodyTop + bodyH / 2 - (introTop + introH / 2);
  // ลูกแก้วไมค์ในช่องแชท (ตำแหน่งกลางลูกแก้วจากขอบซ้ายของ dock + ขนาด)
  const dockW = Math.min(winW - componentTokens.dock.marginX * 2, g.maxContentWidth);
  const orbD = componentTokens.orb.md;
  const orbX = 6 + orbD / 2; // ChatComposer: paddingHorizontal 6 แล้วตามด้วยลูกแก้ว
  // แชท/การ์ดประเมินค่อย ๆ โผล่ขึ้นตามหลังหุ่นเล็กน้อย
  const reveal = {
    opacity: intro.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0, 1] }),
    transform: [{ translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
  };

  // คำแนะนำ + ช่องแชท AI ลอยเหนือ tab menu ใน dock เดียวกัน
  // ปุ่ม AI อยู่ในแถวแท็บเรื่อง ("ถาม AI" · openAI) — ไม่มีปุ่มลอยมุมขวาแล้ว
  useTabFab(null, [started]);
  /* ---------- ทางลัดเหนือช่องแชท (ตามบริบท) ---------- */
  const SC = { pre: CASE_INTENTS[0], result: CASE_INTENTS[1], appt: CASE_INTENTS[2], stretch: 'ท่ายืดวันนี้', fresh: NEW_TOPIC_INTENT, plan: 'ขอแผนการนวด', book: 'จองนัด', edit: 'แก้ไขข้อมูล' };
  const shortcuts: string[] = (() => {
    const lastItem = thread[thread.length - 1];
    if (!lastItem || lastItem.thinking) return [];
    // มีคำถาม/ตัวเลือกรอตอบในแชท → คำตอบอยู่ในแชทแล้ว
    const waiting = lastItem.from === 'ai' && ((!!lastItem.card && WAITING.includes(lastItem.card.type)) || lastItem.card?.type === 'review' || (!!lastItem.ask && lastItem.ask === assess.step));
    if (waiting || (assess.step !== 'idle' && assess.step !== 'done')) return [];
    const cc = chatCase();
    // ไม่เสนอสิ่งที่เพิ่งทำไป (เพิ่งกด "ดูผลการรักษา" → ไม่ขึ้นซ้ำ)
    const justDid = [...thread].reverse().find((m) => m.from === 'user')?.text;
    const fresh = (opts: string[]) => opts.filter((o) => o !== justDid);
    if (cc) {
      const hasAppt = cc.appointment.date !== '-';
      return fresh([
        ...(hasAppt && !caseToday[cc.id] ? [SC.pre] : []),
        SC.result,
        ...(urgentCases[cc.id] ? [] : [SC.appt]),
        SC.stretch,
        SC.fresh,
      ]);
    }
    // ประเมินเสร็จแล้ว (ใบร่างของแชทนี้)
    const d = drafts.find((x) => x.chatId === activeId);
    if (d && assess.step === 'done') return fresh([...(d.red ? [] : [SC.plan]), ...(!d.booking && !d.red ? [SC.book] : []), SC.edit]);
    return [];
  })();
  const pickShortcut = (o: string) => {
    const cc = chatCase();
    if (o === SC.stretch) return setSheetStretch(cc?.selfCare.groupId ?? stretchGroupFor(Object.keys(assess.sel)));
    if (o === SC.plan) return requestPlan();
    if (o === SC.book) return startBooking();
    if (o === SC.edit) return editAssessment();
    return pickIntent(o);
  };
  useTabAccessory(
    !started ? null : (
    <View style={{ width: '100%', maxWidth: g.maxContentWidth, alignSelf: 'center' }}>
    <Animated.View style={[{ gap: space[2] }, reveal]} pointerEvents={leaving ? 'none' : 'auto'}>
      {/* ทางลัดเหนือช่องแชท: เสริมแชท ไม่ซ้ำแชท — ซ่อนเมื่อข้อความล่าสุดมีตัวเลือก/คำถามรอตอบ · แสดงเมื่อคุยจบแล้ว ตามเรื่องของแชทนี้ */}
      {/* ชิดขอบจอทั้งสองข้าง: ตัวเลือกเลื่อนออกนอกจอได้ ไม่ถูกตัดที่ระยะขอบของ dock */}
      {shortcuts.length ? (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -componentTokens.dock.marginX }}
        contentContainerStyle={{ gap: space[2], paddingHorizontal: componentTokens.dock.marginX }}
      >
        <ReplyChips options={shortcuts} onPick={pickShortcut} />
      </ScrollView>
      ) : null}
      <ChatComposer onSend={send} onVoice={openVoice} />
    </Animated.View>
    </View>
    ),
    [g.maxContentWidth, activeId, active.title, active.items.length, started, leaving, dockW, focus, chatHome, caseIdx, drafts, caseChats, sessions, urgentCases, shortcuts.join('|'), assess.step, caseToday],
  );

  /* ---------- หน้าเริ่มต้น: ป้ายชี้บริเวณที่รักษาครั้งล่าสุดบนหุ่น ---------- */
  const [areaPt, setAreaPt] = React.useState<{ x: number; y: number } | null>(null);
  const rootRef = React.useRef<View>(null);
  const rootOffset = React.useRef({ x: 0, y: 0 });
  // ปิดป้าย / เริ่มแชท → เก็บเส้น + หุ่นกลับหันหน้าตรง
  React.useEffect(() => {
    if (started) setFocus(false);
  }, [started]);
  React.useEffect(() => {
    if (focus) return;
    setAreaPt(null);
    if (!started) bodyRef.current?.face('front');
  }, [focus, started]);
  // ขั้นใหม่ → เก็บเส้น/ป้ายเดิม แล้วรอวัดตำแหน่งจุดใหม่หลังหุ่นหมุนเข้าที่
  React.useEffect(() => setAreaPt(null), [fuStep]);
  React.useEffect(() => {
    if (started || !focus) return;
    // หันหุ่นไปหาบริเวณนั้น → รอหมุนเข้าที่ (ได้ตำแหน่งเดิม 2 ครั้งติด) แล้วจึงส่งตำแหน่งให้เส้นวิ่ง
    // ครั้งแรกที่เปิดป้าย: ส่งตำแหน่งเมื่อหุ่นนิ่งแล้วเท่านั้น (เส้นไม่ไล่ตามหุ่นที่กำลังหมุน)
    let n = 0;
    let same = 0;
    let last: { x: number; y: number } | null = null;
    // หันหุ่นให้เห็นบริเวณที่เลือกชัด (เช่น หลัง → หันหลัง) — ลองซ้ำจนหุ่นโหลดเสร็จ
    let faced = bodyRef.current?.facePin(fuActive.pin) ?? false;
    const id = setInterval(() => {
      if (!faced) faced = bodyRef.current?.facePin(fuActive.pin) ?? false;
      // ตำแหน่งจากหุ่นเป็นพิกัดหน้าต่าง → แปลงเป็นพิกัดของหน้าจอนี้ (เส้นวาดในหน้าจอนี้)
      // native: วัดตำแหน่งหุ่น + หน้าจอใหม่ทุกครั้ง (Android มี status bar / หุ่นอาจเพิ่งขยับ)
      bodyRef.current?.remeasure();
      rootRef.current?.measureInWindow((x, y) => (rootOffset.current = { x, y }));
      const w = bodyRef.current?.projectPin(fuActive.pin);
      const p = w && Platform.OS !== 'web' ? { x: w.x - rootOffset.current.x, y: w.y - rootOffset.current.y } : w;
      if (p) {
        same = last && Math.abs(last.x - p.x) < 1 && Math.abs(last.y - p.y) < 1 ? same + 1 : 0;
        last = p;
        if ((faced && same >= 2) || n >= 40) setAreaPt((cur) => (cur && Math.abs(cur.x - p.x) < 1 && Math.abs(cur.y - p.y) < 1 ? cur : p));
      }
      if ((faced && same >= 2) || ++n > 40) clearInterval(id);
    }, 120);
    return () => clearInterval(id);
  }, [started, focus, winW, winH, fuActive.pin]);
  const introOut = {
    opacity: intro.interpolate({ inputRange: [0, 0.4], outputRange: [1, 0], extrapolate: 'clamp' }),
    transform: [{ translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) }],
  };

  /* ---------- header ข้อมูลผู้ป่วยค้างด้านบน ---------- */
  const scrollY = React.useRef(new Animated.Value(0)).current;
  const [headerH, setHeaderH] = React.useState(200);
  // 0 = อยู่บนสุด (ไม่มีช่วงจาง) → 1 = เลื่อนเกิน HEADER_PADDING_BOTTOM (ช่วงว่าง + จางเต็มที่)
  const [fadeT, setFadeT] = React.useState(0);
  React.useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      const t = Math.round(Math.min(1, Math.max(0, value / HEADER_PADDING_BOTTOM)) * 20) / 20;
      setFadeT((cur) => (cur === t ? cur : t));
    });
    return () => scrollY.removeListener(id);
  }, [scrollY]);
  const headerBottom = insets.top + headerH;

  /* ---------- หน้าแรกแบบ 2 ขั้น (bottom sheet) ----------
   * ขั้น 1: ข้อมูลอยู่ล่าง เห็นหุ่น หมุนได้ · ขั้น 2: ปัดขึ้น → แผ่นข้อมูลขึ้นมาชิดใต้หัว บังหุ่น แล้วเลื่อนรายการต่อได้
   * ปล่อยนิ้วค้างระหว่างกลาง → ดีดไปขั้นที่ใกล้ตามทิศที่ปัด · ปัดลงจากบนสุดของรายการ → กลับขั้น 1 */
  const sheetTopRef = React.useRef(0);
  const snapTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastY = React.useRef(0);
  const dirUp = React.useRef(true);
  const dragging = React.useRef(false);
  /** ตัดสินใจขั้นปลายทาง: ปัดเร็ว = ไปตามทิศ · ปัดช้า = เกิน 20% ของระยะในทิศที่ปัด ก็ไปต่อเอง ไม่งั้นเด้งกลับ */
  const sheetTarget = (y: number, top: number, vy = 0) => {
    // ทิศดูจากการเลื่อนจริง (เครื่องแต่ละระบบให้เครื่องหมาย velocity ไม่เหมือนกัน) · ปัดเร็ว = ไปตามทิศเลย
    const fast = Math.abs(vy) > 0.3;
    return dirUp.current ? (fast || y > top * 0.2 ? top : 0) : fast || y < top * 0.8 ? 0 : top;
  };
  /** ขั้น 2 แล้วหรือยัง — มือถือ: ขั้น 1 ปิดการเลื่อนของ ScrollView ให้ gesture ของแผ่นข้อมูลคุมเอง (ปล่อยนิ้วแล้วเด้งแน่นอน) */
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const sheetOpenRef = React.useRef(false);
  const setOpen = React.useCallback((v: boolean) => {
    if (sheetOpenRef.current === v) return;
    sheetOpenRef.current = v;
    setSheetOpen(v);
  }, []);
  const snapSheet = React.useCallback((vy = 0, force = false) => {
    const top = sheetTopRef.current;
    const y = lastY.current;
    if (!top || y <= 2 || y >= top - 2 || (dragging.current && !force)) return;
    const to = sheetTarget(y, top, vy);
    setOpen(to === top);
    scrollRef.current?.scrollTo({ y: to, animated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** ขั้น 2 (แผ่นข้อมูลบังหุ่น) → ลากบนการ์ดไม่หมุนหุ่นที่อยู่ด้านหลัง */
  const sheetUp = () => sheetOpenRef.current || (sheetTopRef.current > 0 && lastY.current > sheetTopRef.current * 0.5);
  const sheetUpRef = React.useRef(sheetUp);
  React.useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      dirUp.current = value > lastY.current ? true : value < lastY.current ? false : dirUp.current;
      lastY.current = value;
      // ถึงขั้นไหนแล้ว (กลับถึงบนสุด = ขั้น 1 · เลื่อนถึงจุดหยุด = ขั้น 2)
      if (Platform.OS !== 'web') return; // มือถือ: ขั้นของแผ่นข้อมูลคุมด้วย transform ไม่ใช่ระยะเลื่อน
      const top = sheetTopRef.current;
      if (top && value <= 2) setOpen(false);
      else if (top && value >= top - 2) setOpen(true);
      // กันค้างกลางทาง (เว็บ): เลื่อนหยุดนิ่ง 120ms และไม่ได้แตะจออยู่ → เด้งไปขั้นที่ควรไป
      // (เว็บล้อเมาส์ไม่มีจังหวะปล่อยนิ้ว · มือถือบางครั้งแรงเฉื่อยถูกขัดจนไม่มีเหตุการณ์ "หยุด" ส่งมา)
      if (snapTimer.current) clearTimeout(snapTimer.current);
      snapTimer.current = setTimeout(() => snapSheet(), 120);
    });
    return () => scrollY.removeListener(id);
  }, [scrollY, snapSheet, setOpen]);

  /* ---------- หน้าแรกแบบ bento: หุ่นใหญ่กลางจอเหมือนเดิม (ชั้นหลัง) · ช่องข้อมูลเรียงสองคอลัมน์ ----------
   * ซ้าย = ข้อมูลหลักเรียงตามความสำคัญ · ขวา = ปล่อยว่างส่วนบนให้เห็นหุ่นและ mark · ช่องประกอบชิดล่าง (ทับแค่ช่วงขา) */
  const bentoW = Math.min(winW, g.maxContentWidth) - space[5] * 2;
  /* bento เริ่มราวกลางจอ → ช่วงบนว่างให้เห็นหุ่นครึ่งบน (หัว ไหล่ ลำตัว) · ส่วนที่เหลือเลื่อนขึ้นมาดูได้ */
  const bentoGap = Math.max(0, Math.round(winH * BENTO_START) - headerBottom - space[4]);
  /* ขั้น 2 = แผ่นข้อมูลขึ้นมาหยุดใต้แท็บเรื่อง โดยการ์ดแถวแรกอยู่พ้นแถบจาง (ไม่ชิด/ไม่ซ้อนแท็บ)
   * แถบจางใต้หัวสูง HEADER_PADDING_BOTTOM · bento เว้นจากหัว space[4] → เลื่อนน้อยกว่า bentoGap เท่าส่วนต่าง */
  // ขั้น 2: การ์ดแถวแรกอยู่ใต้หัว SHEET_GAP (กรอบแผ่น + ขีดจับอยู่ในช่องนี้ · การ์ดที่เลื่อนจางหายใต้ขีดจับ)
  const SHEET_GAP = 36;
  const sheetTop = started ? 0 : Math.max(0, bentoGap - (SHEET_GAP - space[4]));
  sheetTopRef.current = sheetTop;
  /* มือถือ: แผ่นข้อมูลขยับด้วย transform บน native thread (ไม่ผ่าน JS ทุกเฟรม · ไม่ re-render หน้าแรกระหว่างลาก → ไม่กระตุก)
   * sheetBase = ขั้นปัจจุบัน (0 / sheetTop) · sheetDrag = ระยะนิ้วลาก (Animated.event native) · sheetOffset = ตำแหน่งจริง (หนีบในช่วง)
   * ปล่อยนิ้ว: ปัดเร็ว หรือเกิน 20% = ไปขั้นถัดไป ไม่งั้นเด้งกลับ (spring native) · ขั้น 2 เลื่อนรายการด้วย ScrollView ตามปกติ */
  const NATIVE_SHEET = Platform.OS !== 'web';
  const sheetBase = React.useRef(new Animated.Value(0)).current;
  const sheetDrag = React.useRef(new Animated.Value(0)).current;
  const sheetOffset = React.useMemo(
    () => Animated.add(sheetBase, Animated.multiply(sheetDrag, -1)).interpolate({ inputRange: [0, Math.max(1, sheetTop)], outputRange: [0, Math.max(1, sheetTop)], extrapolate: 'clamp' }),
    [sheetBase, sheetDrag, sheetTop],
  );
  const sheetAt = React.useRef(0);
  const moveSheet = React.useCallback(
    (to: number, from?: number) => {
      if (from !== undefined) sheetBase.setValue(from);
      sheetDrag.setValue(0);
      sheetAt.current = to;
      setOpen(to > 0);
      Animated.spring(sheetBase, { toValue: to, stiffness: 320, damping: 32, mass: 0.9, useNativeDriver: true }).start();
    },
    [sheetBase, sheetDrag, setOpen],
  );
  const onSheetDrag = React.useMemo(() => Animated.event([{ nativeEvent: { translationY: sheetDrag } }], { useNativeDriver: true }), [sheetDrag]);
  const onSheetState = (e: { nativeEvent: { state: number; translationY: number; velocityY: number } }) => {
    const { state, translationY: ty, velocityY: vy } = e.nativeEvent;
    if (state !== State.END && state !== State.CANCELLED && state !== State.FAILED) return;
    const cur = Math.min(sheetTop, Math.max(0, sheetAt.current - ty));
    const up = vy < -350 || (vy <= 350 && cur > sheetTop * 0.2);
    moveSheet(up ? sheetTop : 0, cur);
  };
  // เริ่มแชท / ขนาดจอเปลี่ยน → กลับขั้น 1
  React.useEffect(() => {
    if (!NATIVE_SHEET) return;
    sheetBase.setValue(0);
    sheetDrag.setValue(0);
    sheetAt.current = 0;
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, sheetTop]);
  /** ความคืบหน้าของแผ่นข้อมูล (0 = ขั้น 1 → sheetTop = ขั้น 2) — มือถือใช้ transform · เว็บใช้ระยะเลื่อน */
  const sheetProgress = NATIVE_SHEET ? sheetOffset : scrollY;
  // เผื่อที่ปุ่ม AI ลอย (FAB) เหนือ tab menu ให้ช่องล่างสุดเลื่อนพ้นปุ่ม
  const fabClear = componentTokens.dock.height + space[3];
  // หน้าแรก: หุ่นเริ่มใต้แถบหัวข้อ (ไม่ทับชื่อ/แท็บ) · ช่วงล่างอยู่หลัง bento
  /* ตำแหน่งหุ่น 3 แบบ: หน้าแรก (ใหญ่กลางจอ) ↔ โหมด focus (เลื่อนลงพ้นแถบหัวข้อ) ↔ ชิดขวา (แชท)
   * = (1−intro)·lerp(ช่อง, focus, focusAnim) + intro·แชท */
  const notIntro = intro.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const mix = (home: number, foc: number, chat: number, base = 0) =>
    Animated.add(
      Animated.multiply(notIntro, focusAnim.interpolate({ inputRange: [0, 1], outputRange: [home - base, foc - base] })),
      intro.interpolate({ inputRange: [0, 1], outputRange: [base, chat] }),
    );
  const homeShift = Math.max(0, headerBottom - introTop);
  const bodyTransform = [
    { translateX: mix(0, 0, dx) },
    { translateY: mix(homeShift, FOCUS_SHIFT, dy) },
    { scale: mix(1, FOCUS_SCALE, k) },
  ];
  const maskClearUntil = headerBottom - FADE_TAIL + fadeT * (FADE_TAIL + HEADER_CLEAR);

  /* ---------- ส่งต่อการแตะ/ลากบนพื้นที่ว่างไปที่หุ่น (หุ่นอยู่ชั้นหลังตัวเลื่อน) ---------- */
  const start = React.useRef<{ x: number; y: number } | null>(null);
  const moved = React.useRef(false);
  // เว็บ: pointer event ตรง ๆ (touch-action: pan-y ให้นิ้วเลื่อนหน้าได้)
  const webTouchLayer = {
    onPointerDown: (e: PointerEvent) => {
      // เมาส์: กันไม่ให้การลากหมุนไปคลุมเลือกข้อความ (นิ้วยังเลื่อนหน้าได้ตาม touch-action)
      if (e.nativeEvent.pointerType === 'mouse') (e.nativeEvent as unknown as { preventDefault?: () => void }).preventDefault?.();
      start.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
      moved.current = false;
      bodyRef.current?.beginRotate();
    },
    onPointerMove: (e: PointerEvent) => {
      if (!start.current) return;
      const dx = e.nativeEvent.clientX - start.current.x;
      if (Math.abs(dx) > DRAG_SLOP) moved.current = true;
      if (moved.current && !sheetUp()) bodyRef.current?.rotateTo(dx / 80);
    },
    onPointerUp: (e: PointerEvent) => {
      if (start.current && !moved.current) onBodyTap(e.nativeEvent.clientX, e.nativeEvent.clientY);
      start.current = null;
      bodyRef.current?.endRotate();
    },
    onPointerCancel: () => {
      start.current = null;
      bodyRef.current?.endRotate();
    },
  };
  // iOS/Android: gesture handler แยก "ลากแนวนอน = หมุนหุ่น" ออกจาก "ลากแนวตั้ง = เลื่อนหน้า"
  // (ระบบ responder เดิมถูก ScrollView ของ iOS แย่งการลากไปทุกครั้ง หุ่นจึงหมุนไม่ได้)
  const onBodyTapRef = React.useRef(onBodyTap);
  onBodyTapRef.current = onBodyTap;
  const nativeGesture = React.useMemo(() => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      .activeOffsetX([-DRAG_SLOP, DRAG_SLOP])
      .failOffsetY([-DRAG_SLOP * 2, DRAG_SLOP * 2])
      .onStart(() => bodyRef.current?.beginRotate())
      .onUpdate((e) => !sheetUpRef.current() && bodyRef.current?.rotateTo(e.translationX / 80))
      .onFinalize(() => bodyRef.current?.endRotate());
    const tap = Gesture.Tap()
      .runOnJS(true)
      .maxDistance(DRAG_SLOP)
      .onEnd((e, ok) => ok && onBodyTapRef.current(e.absoluteX, e.absoluteY));
    // สองนิ้วถ่าง/หุบ = ซูมหุ่น (แบบ ThaiWellAI) · ลากขึ้น-ลงยังเป็นการเลื่อนหน้า
    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onStart(() => bodyRef.current?.beginZoom())
      .onUpdate((e) => bodyRef.current?.zoomTo(e.scale));
    return Gesture.Simultaneous(pinch, Gesture.Race(pan, tap));
  }, []);

  const content = { width: '100%' as const, maxWidth: g.maxContentWidth, alignSelf: 'center' as const, paddingHorizontal: space[5] };

  return (
    <View ref={rootRef} style={{ flex: 1, backgroundColor: colors.surface.canvas }}>
      {/* ชั้นหลังสุด: หุ่น 3D ตรึงกับจอ · ยังไม่มีอะไรเกี่ยวกับร่างกาย (แชทครั้งแรก) = ซ่อน → เริ่มถามอาการแล้วค่อยเลื่อนเข้ามา */}
      <Animated.View
        pointerEvents="none"
        // แชท: หุ่นใหญ่จางออก (หุ่นย้ายไปอยู่ในการ์ดประเมิน)
        // ขั้น 2 (ปัดแผ่นข้อมูลขึ้น): หุ่นจางหายตามระยะที่แผ่นเลื่อนขึ้น → ไม่มีหัวหุ่นโผล่ในช่องว่างใต้ส่วนหัว
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: Animated.multiply(
              Animated.multiply(bodyIn, intro.interpolate({ inputRange: [0, 0.6], outputRange: [1, 0], extrapolate: 'clamp' })),
              started ? 1 : sheetProgress.interpolate({ inputRange: [sheetTop * 0.35, Math.max(1, sheetTop * 0.9)], outputRange: [1, 0], extrapolate: 'clamp' }),
            ),
            transform: [{ translateX: bodyIn.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) }],
          },
        ]}
      >
      <Animated.View
        pointerEvents="none"
        // ยังไม่มีข้อมูล → ซ่อนหุ่น (หน้าแรกมีแค่ปุ่ม AI) · คงไว้ในหน้า ไม่ต้องโหลดใหม่ตอนเข้าแชท
        style={{ position: 'absolute', top: introTop, left: (winW - introW) / 2, width: introW, height: introH, transform: bodyTransform, opacity: chatHome && !started ? 0 : 1 }}
      >
        <Body3D ref={bodyRef} pins={pins} marks={marks} markColor={symptomColor} interactive={false} width={introW} height={introH} restAngle={started && !leaving ? REST_ANGLE : 0} />
      </Animated.View>
      </Animated.View>

      {/* ชั้นกลาง: เนื้อหาเลื่อนผ่านหน้าหุ่น · จางหายที่ขอบล่างของ header ด้วย mask (โปร่งจนเห็นหุ่น ไม่ใช่แผ่นทับ) */}
      {/* กรอบแผ่นข้อมูล (พื้น + ขอบโค้ง + ขีดจับ) — ไม่อยู่ในรายการที่เลื่อน: ขึ้นตามแผ่นจนถึงขั้น 2 แล้วค้างใต้แท็บ
       * ขั้น 2 เลื่อนเฉพาะการ์ดข้างใน (การ์ดจางหายใต้ขีดจับ) · ขั้น 1 พื้นโปร่ง เห็นหุ่น */}
      {!started && sheetTop > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: headerBottom + space[4] + bentoGap - space[5],
            height: winH,
            transform: [{ translateY: sheetProgress.interpolate({ inputRange: [0, Math.max(1, sheetTop)], outputRange: [0, -Math.max(1, sheetTop)], extrapolate: 'clamp' }) }],
          }}
        >
          <Animated.View
            style={{
              ...StyleSheet.absoluteFillObject,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              backgroundColor: colors.surface.canvas,
              opacity: sheetProgress.interpolate({ inputRange: [sheetTop * 0.2, Math.max(1, sheetTop)], outputRange: [0, 1], extrapolate: 'clamp' }),
              shadowColor: '#0F172A',
              shadowOpacity: 0.08,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: -6 },
            }}
          />
          <View style={{ alignSelf: 'center', marginTop: 6, width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border.strong }} />
        </Animated.View>
      ) : null}
      {/* ขั้น 2: การ์ดที่เลื่อนขึ้นจางหายพอดีใต้ขีดจับ (ไม่ทับขีดจับ / ไม่ขึ้นไปถึงแท็บ) */}
      <ScrollFadeMask clearUntil={sheetOpen && !started ? headerBottom + SHEET_GAP - 4 : maskClearUntil} ramp={sheetOpen && !started ? 4 : FADE_TAIL}>
      <PanGestureHandler
        enabled={NATIVE_SHEET && !started && !sheetOpen && sheetTop > 0}
        activeOffsetY={[-8, 8]}
        failOffsetX={[-14, 14]}
        onGestureEvent={onSheetDrag}
        onHandlerStateChange={onSheetState}
      >
      {/* มือถือ: ทั้งชั้นเนื้อหาเลื่อนขึ้นด้วย transform (ยาวเกินจอเท่าระยะเลื่อน เพื่อขั้น 2 ขอบล่างยังชิดจอ) */}
      <Animated.View
        style={[
          { flex: 1 },
          NATIVE_SHEET && !started ? { marginBottom: -sheetTop, transform: [{ translateY: Animated.multiply(sheetOffset, -1) }] } : null,
        ]}
      >
      <BodyScrollView
        // มือถือ ขั้น 1: แผ่นข้อมูลขยับด้วย PanGestureHandler (ไม่ใช่การเลื่อนของ ScrollView) · ขั้น 2 / แชท / เว็บ = เลื่อนปกติ
        scrollEnabled={!NATIVE_SHEET || started || sheetOpen}
        ref={scrollRef as never}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => (dragging.current = true)}
        // มือถือ: ปล่อยนิ้วปุ๊บ เด้งไปขั้นที่ควรไปทันที (ไม่ต้องลากเองจนสุด) · เกินขั้น 2 = เลื่อนรายการตามปกติ
        // ปล่อยนิ้วระหว่างขั้น → เด้งไปขั้นปลายทางทันที (ตามแรงปัด/ระยะ 20%) · ค้างกลางทางหลังแรงเฉื่อย → เด้งเช่นกัน
        onScrollEndDrag={(e) => {
          dragging.current = false;
          const y = e.nativeEvent.contentOffset.y;
          lastY.current = y;
          // มือถือ ขั้น 2: อยู่บนสุดของรายการแล้วดึงลงต่อ (เด้งเกินขอบ) → กลับขั้น 1
          if (NATIVE_SHEET) {
            // iOS เด้งเกินขอบได้ (y ติดลบ) · Android ไม่เด้ง → อยู่บนสุดแล้วลากลง = กลับขั้น 1
            if (!started && sheetOpenRef.current && (y < -36 || (Platform.OS === 'android' && y <= 1 && !dirUp.current))) moveSheet(0);
            return;
          }
          snapSheet(e.nativeEvent.velocity?.y ?? 0, true);
        }}
        // สำรอง: ยกนิ้วแล้วแน่ ๆ (บางครั้ง onScrollEndDrag ไม่มา → สถานะ "กำลังลาก" ค้าง แผ่นข้อมูลไม่เด้ง)
        onTouchEnd={() => (dragging.current = false)}
        onTouchCancel={() => (dragging.current = false)}
        onMomentumScrollEnd={(e) => {
          lastY.current = e.nativeEvent.contentOffset.y;
          if (!NATIVE_SHEET) snapSheet();
        }}
        // เว็บ: ขั้น 2 ต้องเลื่อนได้ถึงจุดที่แผ่นข้อมูลชิดใต้หัว แม้ข้อมูลสั้น → เผื่อความสูงขั้นต่ำ
        contentContainerStyle={{ minHeight: started || NATIVE_SHEET ? undefined : winH + bentoGap, paddingTop: headerBottom, paddingBottom: dockH + space[4] + (started ? 0 : fabClear) }}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: 'transparent' }}
      >
        {/* พื้นที่ว่างทั้งหมดของเนื้อหา = ชั้นรับแตะ/ลาก ส่งต่อให้หุ่น */}
        {Platform.OS === 'web' ? (
          <View
            {...webTouchLayer}
            accessibilityLabel={BODY_TOUCH_LABEL}
            style={[StyleSheet.absoluteFill, { touchAction: 'pan-y', cursor: 'crosshair' } as object]}
          />
        ) : (
          <GestureDetector gesture={nativeGesture}>
            <View accessibilityLabel={BODY_TOUCH_LABEL} style={StyleSheet.absoluteFill} />
          </GestureDetector>
        )}

        {/* เนื้อหาที่เลื่อนผ่านหน้าหุ่น */}
        <View pointerEvents="box-none" style={[content, { gap: space[4], paddingTop: space[4] }]}>
          {/* หน้าเริ่มต้น (ก่อนเริ่มประเมิน) — ตาม Figma screen-4-home (40:731)
           * การ์ดอยู่ในพื้นที่เลื่อนเดียวกับแชท → เลื่อนผ่านใต้ header (ชื่อ + ธาตุ ตรึงไว้) แล้วจางหายแบบเดียวกัน */}
          {!started || leaving ? (
            <Animated.View pointerEvents={started ? 'none' : 'box-none'} style={[introOut, { marginTop: bentoGap }]}>
              <Animated.View pointerEvents={focus ? 'none' : 'box-none'} style={focusOut}>
                {chatHome ? (
                  // ยังไม่มีข้อมูล: แผ่นการ์ดต้อนรับ (โครงเดียวกับหน้าแรกปกติ — หุ่น · ThaiWell AI · การ์ด)
                  <WelcomeBento
                    width={bentoW}
                    element={account ? birthElement(account.birthDate) : null}
                    onStart={(i) => startWelcome(i)}
                    onPlace={(id) => nav.navigate('PlaceDetail', { id })}
                    onPlaces={() => nav.navigate('ClientTabs', { screen: 'Places' })}
                    onElement={() => nav.navigate('ElementQuiz')}
                    onStretch={(groupId) => nav.navigate('SelfCare', { groupId })}
                  />
                ) : homeLoading ? (
                  <BentoSkeleton width={bentoW} />
                ) : selLoose ? (
                  <BookingBento width={bentoW} booking={selLoose} onCheckIn={() => nav.navigate('CheckIn', { looseId: selLoose.id })} onEdit={() => nav.navigate('AppointmentDetail', { looseId: selLoose.id })} />
                ) : selDraft ? (
                  <DraftBento
                    width={bentoW}
                    draft={selDraft}
                    tabs={null}
                    onBook={(clinic) => {
                      setActiveDraftId(selDraft.id);
                      // จองให้ใบนี้ (ไม่เดาจากใบล่าสุด)
                      nav.navigate('Booking', { ...(clinic ? { clinic } : null), draftId: selDraft.id });
                    }}
                    onPlaces={(mode) => nav.navigate('ClientTabs', { screen: 'Places', params: mode ? { mode } : undefined } as never)}
                    onOpen={() => nav.navigate('AppointmentDetail', { draftId: selDraft.id })}
                    onCheckIn={() => nav.navigate('CheckIn', { draftId: selDraft.id })}
                    onRedFlag={() => nav.navigate('RedFlag', { reason: `ผลประเมิน${selDraft.title}` })}
                    onFollowUp={() => nav.navigate('FollowUp')}
                    onSelfCare={(groupId) => nav.navigate('SelfCare', groupId ? { groupId } : undefined)}
                  />
                ) : caseIdx >= cases.length ? null : (
                <HomeBento
                  width={bentoW}
                  caseIdx={caseIdx}
                  tcase={tcase}
                  tabs={null}
                  onCheckIn={() => nav.navigate('CheckIn', { caseId: tcase.id })}
                  // Pain Score / แผนการรักษา → รายละเอียดการรักษาของเรื่องนี้ (bottom sheet เดียวกับในแชท)
                  onHistory={() => setSheetCaseId(tcase.id)}
                  onFollowUp={followCaseChat}
                  onSelfCare={(groupId) => nav.navigate('SelfCare', groupId ? { groupId } : undefined)}
                  onEdit={() => nav.navigate('Booking', { caseId: tcase.id, clinic: caseClinic(tcase) })}
                  onOpen={() => nav.navigate('AppointmentDetail', { caseId: tcase.id })}
                  onBook={() => nav.navigate('Booking', { caseId: tcase.id, clinic: caseClinic(tcase) })}
                  onPreVisit={() => nav.navigate('PreVisit', { caseId: tcase.id })}
                />
                )}
              </Animated.View>
            </Animated.View>
          ) : null}
          {/* สรุปการประเมิน (แทน chip/กราฟเดิม — ตัวคำถามอยู่ในแชท) · แสดงเมื่อเริ่มประเมินแล้ว */}

        </View>

        {/* AI Care Thread — ทุกขั้นของการดูแลอยู่ในบทสนทนาเดียว (แสดงหลังกดเริ่มประเมิน) */}
        {started ? (
        <Animated.View
          pointerEvents="box-none"
          style={[content, { marginTop: space[8], gap: space[5] }, reveal]}
          onLayout={(e) => (threadY.current = e.nativeEvent.layout.y)}
        >
          <VStack gap={3}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
              <VStack gap={1} style={{ flex: 1 }}>
                <Text variant="titleLg">คุยกับผู้ช่วย ThaiWell</Text>
                <Text variant="bodyXs" tone="secondary" numberOfLines={1}>
                  {active.title}
                </Text>
              </VStack>
            </View>
            {active.stage !== undefined ? <StageProgress stages={STAGES} current={done ? active.stage : 0} /> : null}
          </VStack>
          {thread.map((m, i) => (
            <View key={m.id} style={{ gap: space[5] }} onLayout={(e) => (itemY.current[m.id] = e.nativeEvent.layout.y)}>
              {i === 0 || thread[i - 1].day !== m.day ? <DayDivider label={m.day === 'last' ? 'ครั้งที่แล้ว · 30 ส.ค.' : active.date} /> : null}
              {/* สรุปการประเมินเลื่อนตามคำถามปัจจุบัน: อยู่เหนือคำถามที่กำลังถาม (ครบแล้ว → เหนือผลสรุป) — เห็นว่าถึงขั้นไหนโดยไม่ต้องเลื่อนขึ้น */}
              {i === trackerAt ? (
                <AssessmentTracker
                  assess={assess}
                  symptoms={selectedIn(symptomOptions)}
                  related={selectedIn(HOME_CONTENT.related)}
                  width="100%"
                  onJump={jumpTo}
                  body={({ width: bw, height: bh }) => (
                    // หุ่นแสดงจุดที่เลือก (สูงเท่ารายการคำตอบ) · ตอนถามว่าปวดตรงไหน/อาการร่วม แตะเพื่อเปิดหน้าเลือกจุด
                    <Pressable
                      accessibilityRole={canPick ? 'button' : undefined}
                      accessibilityLabel={canPick ? 'ชี้จุดบนร่างกาย' : 'หุ่นแสดงจุดที่เลือก'}
                      disabled={!canPick}
                      onPress={openPicker}
                      style={{ width: bw, height: bh }}
                    >
                      <View pointerEvents="none" style={{ flex: 1 }}>
                        <Body3D ref={chatBodyRef} pins={pins} marks={marks} markColor={symptomColor} interactive={false} width={bw} height={bh} restAngle={0} />
                      </View>
                      {canPick ? (
                        <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space[2], height: 24, borderRadius: radius.full, backgroundColor: colors.text.primary }}>
                          <Icon name="target" size="xs" color={colors.text.inverse} />
                          <Text variant="caption" color={colors.text.inverse}>
                            แตะเพื่อชี้จุด
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
                  )}
                />
              ) : null}
              {m.from === 'user' ? (
                m.pain !== undefined ? (
                  // คำตอบความปวด = การ์ด Pain Score ฝั่งผู้ใช้ (ชิดขวา)
                  <View pointerEvents="none" style={{ alignSelf: 'flex-end' }}>
                    <PainScoreCard value={m.pain} chart />
                  </View>
                ) : (
                  <UserBubble text={m.text ?? ''} />
                )
              ) : (
                <AIThreadMessage
                  text={m.text}
                  time={m.thinking === 'working' ? undefined : m.time}
                  header={m.thinking === 'working' ? <LatticeLoader status="working" /> : undefined}
                >
                  {/* ถามซ้ำหลังถามแทรก → ตัวเลือกอยู่ที่คำถามล่าสุดอันเดียว */}
                  {m.ask && m.ask === assess.step && m.id === lastAskId ? (
                    <AssessWidget
                      step={m.ask}
                      assess={assess}
                      symptoms={symptomOptions}
                      related={HOME_CONTENT.related}
                      selectedIn={selectedIn}
                      onChips={onChipsChange}
                      onPain={(v) => setAssess((a) => ({ ...a, pain: v }))}
                      onNext={answerStep}
                      topics={topicOptions}
                      radiate={radiateFor(Object.keys(assess.sel))?.options}
                      onPickBody={openPicker}
                      onOther={(l) => {
                        pickSymptoms([l]);
                        answerStep(l);
                      }}
                    />
                  ) : null}
                  {m.card?.type === 'history' ? (
                    <HistoryBento
                      tc={cases.find((c) => c.id === (m.card as Extract<ThreadCard, { type: 'history' }>).caseId) ?? tcase}
                      // ในแชท: ดูเพิ่มเติม = bottom sheet (ไม่ออกจากแชท)
                      onAll={() => setSheetCaseId((m.card as Extract<ThreadCard, { type: 'history' }>).caseId)}
                      onSelfCare={(groupId) => groupId && setSheetStretch(groupId)}
                    />
                  ) : m.card?.type === 'fuAsk' ? (
                    // ตอบได้เฉพาะคำถามล่าสุด
                    i === thread.length - 1 ? <ReplyChips options={PAIN_CHIPS} onPick={once((o: string) => answerFuScore(m.card as Extract<ThreadCard, { type: 'fuAsk' }>, Number(o)))} /> : null
                  ) : m.card?.type === 'placePick' ? (
                    <PlacePickCard
                      options={m.card.options}
                      active={i === thread.length - 1}
                      onPick={pickPlace}
                      onAll={() => setPlacesOpen(true)}
                    />
                  ) : m.card?.type === 'therapistPick' ? (
                    <TherapistPickCard card={m.card} active={i === thread.length - 1} onPick={once(pickCardSlot)} />
                  ) : m.card?.type === 'slotPick' ? (
                    i === thread.length - 1 ? (
                      <ReplyChips
                        options={m.card.options}
                        onPick={(o) => {
                          const c = m.card as Extract<ThreadCard, { type: 'slotPick' }>;
                          pickSlot(c.placeId, c.therapistId, o);
                        }}
                      />
                    ) : null
                  ) : m.card?.type === 'bookConfirm' ? (
                    <BookConfirmCard card={m.card} active={i === thread.length - 1} onConfirm={once(confirmBooking)} onChange={() => setEditing(m.card as Extract<ThreadCard, { type: 'bookConfirm' }>)}
                    />
                  ) : m.card?.type === 'fuWhere' ? (
                    i === thread.length - 1 ? <ReplyChips options={m.card.options} onPick={answerFuWhere} /> : null
                  ) : m.card?.type === 'preResult' ? (
                    <PreVisitResult tc={cases.find((c) => c.id === (m.card as Extract<ThreadCard, { type: 'preResult' }>).caseId) ?? tcase} focus={m.card.focus} />
                  ) : m.card?.type === 'choice' ? (
                    i === thread.length - 1 ? <ReplyChips options={m.card.options} onPick={once((o: string) => pickChoice(m.card as Extract<ThreadCard, { type: 'choice' }>, o))} /> : null
                  ) : m.card?.type === 'planChoice' ? (
                    i === thread.length - 1 ? <ReplyChips options={PLAN_CHOICES} onPick={once((o: string) => pickPlanChoice(m.card as Extract<ThreadCard, { type: 'planChoice' }>, o))} /> : null
                  ) : m.card?.type === 'fuRisk' ? (
                    i === thread.length - 1 ? <ReplyChips options={FU_RISK} onPick={once(answerFuRisk)} /> : null
                  ) : m.card?.type === 'fuAdverse' ? (
                    i === thread.length - 1 ? <ReplyChips options={FU_ADVERSE} onPick={once(answerFuAdverse)} /> : null
                  ) : m.card?.type === 'review' ? (
                    <ReviewCard assess={assess} onEdit={editStep} onConfirm={confirmReview} active={assess.step === 'review'} />
                  ) : m.card?.type === 'intents' ? (
                    // ตัวเลือกเก่าในแชทกดซ้ำไม่ได้ (เฉพาะข้อความล่าสุด)
                    i === thread.length - 1 ? <IntentChips options={m.card.options} onPick={once(pickIntent)} /> : null
                  ) : m.card?.type === 'massagePlan' ? (
                    <View style={{ gap: space[2] }}>
                      <MassagePlanCard card={m.card} />
                      <SourcesCard refs={m.card.refs} />
                    </View>
                  ) : m.card?.type === 'sources' ? (
                    <SourcesCard refs={m.card.refs} />
                  ) : m.card?.type === 'action' ? (
                    <PillButton label={m.card.label} icon="arrow-right" onPress={() => runAction((m.card as Extract<ThreadCard, { type: 'action' }>).to)} />
                  ) : m.card ? (
                    <ThreadCardView card={m.card} onEditAssessment={editAssessment} onTalkMore={talkMore} onPlan={() => requestPlan()} onBook={() => startBooking()} />
                  ) : null}
                  {m.thinking === 'working' ? null : <SourceTag source={m.source} confirmedBy={m.confirmedBy} />}
                </AIThreadMessage>
              )}
            </View>
          ))}
        </Animated.View>
        ) : null}
      </BodyScrollView>
      </Animated.View>
      </PanGestureHandler>
      </ScrollFadeMask>
      {/* ยังไม่มีข้อมูล: ลูกแก้ว ThaiWell AI กลางจอ + ข้อความชวน (ทางเริ่มเดียว) · จางเมื่อดึงแผ่นการ์ดขึ้น/เข้าแชท */}
      {chatHome && !started && sheetTop > 0 ? (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: headerBottom + space[2],
            height: Math.max(0, bentoGap - space[5] - space[2]),
            alignItems: 'center',
            justifyContent: 'center',
            opacity: sheetProgress.interpolate({ inputRange: [0, Math.max(1, sheetTop * 0.5)], outputRange: [1, 0], extrapolate: 'clamp' }),
          }}
        >
          <WelcomeHero height={Math.max(0, bentoGap - space[5] - space[2])} onPress={openAI} />
        </Animated.View>
      ) : null}

      {/* header ข้อมูลผู้ป่วย (ชื่อ + ธาตุ): ตรึงกับจอ ไม่ขยับตามการเลื่อน · ไม่มีพื้นทับ จึงเห็นหุ่นด้านหลังเสมอ */}
      <Animated.View
        pointerEvents={focus ? 'none' : 'box-none'}
        style={[{ position: 'absolute', top: insets.top, left: 0, right: 0, zIndex: 10, elevation: 10 }, focusOut]}
      >
          <View pointerEvents="box-none" style={[content, { paddingTop: space[4] }]} onLayout={(e) => setHeaderH(Math.round(e.nativeEvent.layout.height))}>
          <View pointerEvents="box-none" style={{ gap: space[4] }}>
            {/* โปรไฟล์ / ประวัติ อยู่ใน tab menu แล้ว → header เหลือแค่ปุ่มออกจากแชท (ตอนคุยกับ AI) */}
            {/* แจ้งเตือน (คลินิกเลื่อน/ยกเลิกนัด ฯลฯ) — ชิดขวาแถวเดียวกับโปรไฟล์ · จุดแดง = ยังไม่ได้อ่าน */}
            {!started ? (
              // กึ่งกลางแนวตั้งเดียวกับรูปโปรไฟล์
              <View pointerEvents="box-none" style={{ position: 'absolute', top: (componentTokens.homeHeader.avatar - componentTokens.homeHeader.bell) / 2, right: 0, zIndex: 2 }}>
                <HeaderAction icon="bell" label={`การแจ้งเตือน${unread ? ` ${unread} รายการใหม่` : ''}`} onPress={() => nav.navigate('Notifications')} badge={unread} />
              </View>
            ) : null}
            {started ? (
              <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, right: 0, zIndex: 2, flexDirection: 'row', gap: space[2] }}>
                {/* แชทก่อนหน้า (กลับไปคุย/ประเมินต่อในแชทเดิมได้) */}
                {sessions.length > 1 ? <HeaderAction icon="clock" label="แชทก่อนหน้า" onPress={() => setHistoryOpen(true)} /> : null}
                <HeaderAction icon="x" label="ออกจากแชท" onPress={exitChat} />
              </View>
            ) : null}
            {/* แถวแรก: รูปโปรไฟล์ + สวัสดีค่ะ/ชื่อ · บรรทัดถัดไป: ธาตุเป็น pill เล็ก (แตะดูรายละเอียดธาตุ) */}
            <View pointerEvents="box-none" style={{ gap: space[2], alignSelf: 'flex-start' }}>
            <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <ProfileAvatar sex={account?.sex || (newPatient ? 'หญิง' : 'ชาย')} />
              <View pointerEvents="none" style={{ gap: 2 }}>
                <Text variant="bodyBase" tone="secondary">
                  สวัสดีค่ะ,
                </Text>
                <Text variant="titleXl" accessibilityRole="header">
                  {client.name}
                </Text>
              </View>
            </View>
              <View pointerEvents="box-none" style={{ flexDirection: 'row' }}>
                {/* pill ธาตุแบบ back-office: ไอคอนสีธาตุ + ป้าย + ชื่อธาตุ · ธาตุกำเนิด (คนไข้ใหม่) = ธาตุเจ้าเรือน · จากแบบประเมิน = ธาตุปัจจุบัน */}
                {tagElement ? (
                  <ElementPill element={tagElement} label={newPatient && !elementsDone ? 'ธาตุเจ้าเรือน' : 'ธาตุปัจจุบัน'} onPress={() => nav.navigate('ElementQuiz')} />
                ) : null}
              </View>
            </View>
            {/* แท็บเรื่องที่ดูแล — ตรึงใน header (เลื่อนดูช่องล่าง ๆ ก็ยังรู้ว่าดูเรื่องไหน และสลับได้ทันที) */}
            {/* แถวแท็บมีปุ่ม "ถาม AI" → แสดงเสมอเมื่อมีข้อมูล (จองไว้นัดเดียวก็แสดง) */}
            {!started || leaving ? (
              <CaseTabs cases={cases.map((c) => c.short)} drafts={drafts.map((d) => d.title)} extras={looseBookings.map((b) => b.service.split(' · ')[0])} value={caseIdx} onChange={setCaseIdx} onNew={chatHome ? undefined : openAI} />
            ) : null}
          </View>
          </View>
      </Animated.View>

      {/* โหมด focus: แถบบนสุด (× ออก · หัวข้อ · ความคืบหน้า) */}
      {!started ? (
        <Animated.View
          pointerEvents={focus ? 'box-none' : 'none'}
          style={{ position: 'absolute', top: insets.top, left: 0, right: 0, zIndex: 20, elevation: 20, opacity: focusAnim }}
        >
          <View style={[content, { paddingTop: space[4], flexDirection: 'row', alignItems: 'center', gap: space[3] }]}>
            <HeaderAction icon="x" label="ออกจากการติดตามอาการ" onPress={exitFocus} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="titleSm">ติดตามอาการหลังรักษา</Text>
              <Text variant="caption" tone="secondary">
                {fuResult ? 'ส่งผลเรียบร้อย' : `จุดที่ ${fuStep + 1}/${fuSteps.length}`}
              </Text>
            </View>
          </View>
          {/* ความคืบหน้า: ขีดละจุด (ให้คะแนนแล้ว = สีตามคะแนน) */}
          <View style={[content, { flexDirection: 'row', gap: space[1], paddingTop: space[3] }]}>
            {fuSteps.map((st, i) => {
              const ss = fuSessions[st.si];
              const v = fuScores[`${ss.id}:${ss.areas[st.ai].pin}`];
              return (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: v !== undefined ? painColorOf(v) : i === fuStep ? colors.text.primary : colors.border.default,
                  }}
                />
              );
            })}
          </View>
        </Animated.View>
      ) : null}

      {!started && focus && areaPt ? (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          {/* แตะนอกป้าย: โดน mark อื่น → ข้ามไปจุดนั้น */}
          <Pressable accessibilityLabel="เลือกจุดบนหุ่น" style={StyleSheet.absoluteFill} onPress={(e) => onFocusTap(e.nativeEvent.pageX, e.nativeEvent.pageY)} />
          <StepCallout
            key={`${fuSession.id}:${fuActive.pin}`}
            point={areaPt}
            top={insets.top + space[4] + componentTokens.homeHeader.avatar + space[10]}
            right={space[5]}
            session={fuSession}
            area={fuActive}
            score={fuScores[fuKey(fuActive.pin)]}
            onScore={(v) => setFuScores((m) => ({ ...m, [fuKey(fuActive.pin)]: v }))}
            isLast={fuStep === fuSteps.length - 1}
            canSubmit={fuSteps.every((st, i) => i === fuStep || fuScores[`${fuSessions[st.si].id}:${fuSessions[st.si].areas[st.ai].pin}`] !== undefined)}
            onNext={() => setFuStep((i) => Math.min(i + 1, fuSteps.length - 1))}
            onSubmit={submitAllFollowUps}
            result={fuResult}
            onAssess={restartFromArea}
            closeRequest={fuCloseReq}
            onClose={() => setFocus(false)}
          />
        </View>
      ) : null}

      <ChatHistorySheet
        open={historyOpen}
        sessions={sessions}
        activeId={activeId}
        onClose={() => setHistoryOpen(false)}
        onPick={openChat}
        onNew={() => {
          setHistoryOpen(false);
          newChat();
        }}
      />
      <TreatmentSheet tc={cases.find((c) => c.id === sheetCaseId) ?? null} visible={!!sheetCaseId} onClose={() => setSheetCaseId(null)} />
      <StretchSheet groupId={sheetStretch} visible={!!sheetStretch} onClose={() => setSheetStretch(null)} />
      <BookingEditSheet
        visible={editing !== null}
        lockedService={chatCase() ? chatService() : undefined}
        lockedPlaceId={chatCase() ? PLACES.find((p) => p.name === caseClinic(chatCase()!))?.id : undefined}
        initial={editing ? { placeId: editing.placeId, therapistId: editing.therapistId, day: editing.day, time: editing.time, service: editing.service } : null}
        onClose={() => setEditing(null)}
        onSave={(b) => {
          // บันทึกกลับไปที่การ์ดสรุปใบเดิม (ไม่ต้องคุยกับ AI)
          const old = editing;
          setEditing(null);
          setThread((t) => t.map((m) => (m.card === old ? { ...m, card: { ...old!, ...b } } : m)));
        }}
      />
      <PlacesSheet
        visible={placesOpen}
        recommendedId={rankPlaces(latestGuide()?.methods ?? [])[0]?.place.id}
        onClose={() => setPlacesOpen(false)}
        onPick={(id) => {
          setPlacesOpen(false);
          pickPlace(id);
        }}
      />
      <BodyPicker
        visible={picker !== null}
        title={picker === 'related' ? 'แตะจุดที่มีอาการร่วม' : 'แตะจุดที่ปวด'}
        initial={pickedPoints()}
        labelOf={labelOfRegion}
        onClose={() => setPicker(null)}
        onConfirm={confirmPicker}
      />
    </View>
  );
}

/** เส้นแนวโน้มเล็ก ๆ (คะแนนปวด 0–10 · ต่ำ = ดี) */
function Sparkline({ values, color, width = 136, height = 28 }: { values: number[]; color: string; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const pad = 3;
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - (v / 10) * (height - pad * 2); // ปวดมาก = สูง · เส้นลง = ดีขึ้น
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const last = values.length - 1;
  return (
    <Svg width={width} height={height}>
      <Polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={x(last)} cy={y(values[last])} r={3.5} fill={color} />
    </Svg>
  );
}

/** ช่องของ bento (สไตล์ Figma text-stack: ขาวโปร่ง ขอบขาว มุม 16) */
/** ช่อง bento · ป้ายหัวการ์ดทุกช่องใช้ bodyXs สีรอง (12/18 ปกติ) ให้เท่ากันทุกการ์ด — ค่า/เนื้อหาใช้ตัวใหญ่กว่าได้ */
function Tile({ children, style, onPress, accessibilityLabel }: { children: React.ReactNode; style?: object; onPress?: () => void; accessibilityLabel?: string }) {
  const t = componentTokens.statCard;
  const base = { padding: TILE_PAD, borderRadius: radius.lg, backgroundColor: t.bg, borderWidth: 1, borderColor: t.border, overflow: 'hidden' as const };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [base, style, { opacity: pressed ? 0.85 : 1 }]}>
      {children}
    </Pressable>
  );
}

/** ปุ่มแคปซูลในช่อง bento (ช่องทั้งช่องกดได้ → ปุ่มเป็นแค่ภาพ) */
function TilePill({ icon, label, dark = true }: { icon: React.ComponentProps<typeof Icon>['name']; label: string; dark?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        minHeight: 34,
        paddingHorizontal: space[3],
        borderRadius: radius.full,
        backgroundColor: dark ? colors.text.primary : colors.surface.default,
        borderWidth: dark ? 0 : 1,
        borderColor: colors.border.subtle,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space[1],
      }}
    >
      <Icon name={icon} size="xs" color={dark ? colors.text.inverse : colors.text.primary} />
      {/* ฟอนต์ไทยดูสูงกว่าไอคอน ~1pt → ขยับลงให้อยู่กึ่งกลาง */}
      <Text variant="labelSm" color={dark ? colors.text.inverse : colors.text.primary} numberOfLines={1} style={{ transform: [{ translateY: 1 }] }}>
        {label}
      </Text>
    </View>
  );
}

/** วันที่นัดชิดขวา รูปแบบเดียวกับคิว: "พฤ. 9 ต.ค." → ป้าย พฤ. + ค่า 9 ต.ค. · คำอื่น (พรุ่งนี้) → ป้าย วัน */
function DateBlock({ date }: { date: string }) {
  const m = date.match(/^(\S+\.)\s+(.+)$/);
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Text variant="bodyXs" tone="secondary">
        {m ? m[1] : 'วัน'}
      </Text>
      <Text variant="titleXl" numberOfLines={1}>
        {m ? m[2] : date}
      </Text>
    </View>
  );
}

/** ปุ่มนำทาง (ไอคอนอย่างเดียว outline) — วางคู่เช็กอินเฉพาะนัดวันนี้ */
function NavIconButton({ clinic }: { clinic: string }) {
  const { colors } = useTheme();
  const place = PLACES.find((p) => p.name === clinic);
  if (!place) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`นำทางไป ${clinic}`}
      onPress={() => openMap(place)}
      hitSlop={6}
      style={({ pressed }) => ({ width: 34, height: 34, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border.subtle, backgroundColor: colors.surface.default, opacity: pressed ? 0.7 : 1 })}
    >
      <Icon name="navigation" size="xs" color={colors.text.primary} />
    </Pressable>
  );
}

/** ประเมินซ้ำ: ข้อมูลชุดเดิมทีละข้อ แตะ "แก้" เพื่อเปลี่ยน · ยืนยันเมื่อพร้อม */
function ReviewCard({
  assess,
  onEdit,
  onConfirm,
  active,
}: {
  assess: Assessment;
  onEdit: (st: Exclude<AssessStep, 'done' | 'idle' | 'review' | 'topic'>) => void;
  onConfirm: () => void;
  active: boolean;
}) {
  const { colors } = useTheme();
  const keys = Object.keys(assess.sel);
  const sym = keys.filter((k) => !HOME_CONTENT.related.includes(k));
  const rel = keys.filter((k) => HOME_CONTENT.related.includes(k));
  const rows: { st: Exclude<AssessStep, 'done' | 'idle' | 'review' | 'topic'>; value: string }[] = [
    { st: 'symptoms', value: sym.join(', ') || '—' },
    ...(radiateFor(sym) || assess.radiate ? [{ st: 'radiate' as const, value: assess.radiate ?? '—' }] : []),
    { st: 'related', value: rel.join(', ') || 'ไม่มี' },
    { st: 'pain', value: `${assess.pain}/10` },
    { st: 'duration', value: assess.duration ?? '—' },
    { st: 'cause', value: assess.cause ?? '—' },
    { st: 'health', value: assess.health ?? '—' },
    { st: 'risk', value: assess.risk ?? '—' },
    { st: 'pressure', value: assess.pressure ?? '—' },
    { st: 'avoid', value: assess.avoid ?? '—' },
  ];
  return (
    <View style={{ gap: space[3], padding: space[4], borderRadius: radius.lg, backgroundColor: colors.surface.default, borderWidth: 1, borderColor: colors.border.subtle }}>
      {rows.map((r, i) => (
        <View key={r.st} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingTop: i ? space[3] : 0, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border.subtle }}>
          <View style={{ flex: 1 }}>
            <Text variant="caption" tone="tertiary">
              {ASSESS_ASK[r.st].label}
            </Text>
            <Text variant="labelMd">{r.value}</Text>
          </View>
          {active ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`แก้${ASSESS_ASK[r.st].label}`} onPress={() => onEdit(r.st)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="edit-2" size="xs" color={colors.brand.primary} />
              <Text variant="labelSm" color={colors.brand.primary}>
                แก้
              </Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      {active ? <PillButton label="ยืนยันข้อมูลนี้" icon="check" onPress={onConfirm} /> : null}
    </View>
  );
}

/**
 * ผลการรักษาของเรื่องหนึ่ง (แชท → "ดูผลการรักษา") — ตอบคำถาม "รักษาแล้วได้ผลไหม" ตามลำดับที่ผู้ใช้อยากรู้
 * 1) ภาพรวมทั้งคอร์ส: ก่อนครั้งแรก → หลังครั้งล่าสุด + กราฟแนวโน้ม (จุดเทา = ครั้งที่ยังไม่ถึง)
 * 2) ครั้งล่าสุด (คะแนนของคลินิก) · อาการตอนนี้ (ติดตามผล/ประเมินก่อนนวด — ผลคงอยู่ไหม)
 * 3) แต่ละครั้ง (ล่าสุดก่อน) → ดูรายละเอียดทั้งหมด
 * ไม่ใส่: ท่ายืด (มีตัวเลือกแยก) · จุดที่นวด · ผู้ให้บริการ (อยู่ในรายละเอียด)
 */
export function HistoryBento({ tc, onAll }: { tc: TreatmentCase; onAll?: () => void; onSelfCare?: (groupId?: string) => void }) {
  const { colors } = useTheme();
  const { followUps, caseToday } = useJourney();
  const [width, setWidth] = React.useState(0);
  const halfW = (width - BENTO_GAP) / 2;
  const first = tc.visits[0];
  const last = tc.visits[tc.visits.length - 1];
  // อาการตอนนี้: ประเมินก่อนนวดวันนี้ > ผลติดตามหลังนวดครั้งล่าสุด (เฉลี่ยทุกจุด) · ไม่มี = ยังไม่ได้บอก
  const latestSession = tc.pending[0];
  const fu = latestSession ? followUps.find((f) => f.sessionId === latestSession.id) : undefined;
  const fuPain = fu?.areas.length ? Math.round(fu.areas.reduce((n, a) => n + a.painAfter, 0) / fu.areas.length) : undefined;
  const now = caseToday[tc.id]?.pain ?? fuPain;
  const remain = tc.course.total - tc.course.done;
  // ชุดเดียวกับหน้าแรก: ครั้งล่าสุดที่ยังไม่ประเมินหลังนวด = ยังไม่มีคะแนน → ล่าสุดที่มีคะแนนคือครั้งก่อนหน้า
  const trend = trendValues(tc);
  const latest = [...trend].reverse().find((v) => v !== undefined) ?? first.painBefore;
  if (!width) return <View style={{ alignSelf: 'stretch' }} onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))} />;
  const big = (v: number) => (
    <Text variant="displayXl" style={{ fontSize: 32, lineHeight: 42 }} color={painColorOf(v)}>
      {v}
    </Text>
  );
  return (
    <View style={{ alignSelf: 'stretch', gap: BENTO_GAP }} onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}>
      {/* 1) ภาพรวมทั้งคอร์ส */}
      <Tile style={{ gap: space[2] }}>
        <TileTitle title="ตั้งแต่เริ่มรักษา" meta={`${tc.course.done}/${tc.course.total} ครั้ง${remain > 0 ? ` · เหลือ ${remain}` : ''}`} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          {big(first.painBefore)}
          <Icon name="arrow-right" size="sm" color={colors.text.tertiary} />
          {big(latest)}
          <Text variant="titleXs" tone="secondary">
            /10
          </Text>
          <View style={{ marginLeft: 'auto' }}>
            <DeltaPill before={first.painBefore} after={latest} />
          </View>
        </View>
        <View style={{ height: 96, marginHorizontal: -TILE_PAD, marginBottom: -TILE_PAD }}>
          <CourseTrend values={trend} total={tc.course.total} />
        </View>
      </Tile>

      {/* 2) ครั้งล่าสุด · อาการตอนนี้ */}
      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: BENTO_GAP }}>
        <Tile style={{ width: halfW, gap: space[1] }}>
          <TileTitle title="ครั้งล่าสุด" meta={last.date} />
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[1] }}>
            <Text variant="titleXl">
              {last.painBefore} → {last.selfPain ?? '–'}
            </Text>
            <Text variant="labelSm" tone="secondary">
              /10
            </Text>
          </View>
          <Text variant="bodyXs" tone="secondary" numberOfLines={1}>
            ก่อน → หลังนวด
          </Text>
        </Tile>
        <Tile style={{ width: halfW, gap: space[1] }}>
          <TileTitle title="อาการตอนนี้" />
          {now !== undefined ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[1] }}>
                <Text variant="titleXl" color={painColorOf(now)}>
                  {now}
                </Text>
                <Text variant="labelSm" tone="secondary">
                  /10
                </Text>
              </View>
              {/* เทียบหลังนวดครั้งล่าสุด: ผลคงอยู่ไหม */}
              <Text variant="bodyXs" tone="secondary" numberOfLines={1}>
                {now <= last.painAfter ? 'ผลยังคงอยู่' : `ปวดกลับมา +${now - last.painAfter}`}
              </Text>
            </>
          ) : (
            <Text variant="bodyXs" tone="secondary">
              ยังไม่ได้บอกอาการหลังนวด
            </Text>
          )}
        </Tile>
      </View>

      {/* 3) แต่ละครั้ง (ล่าสุดก่อน) */}
      <Tile style={{ gap: space[2] }} onPress={onAll} accessibilityLabel={onAll ? 'ดูรายละเอียดการรักษาทั้งหมด' : undefined}>
        <TileTitle title="แต่ละครั้ง" />
        {[...tc.visits].reverse().map((v, k) => {
          const no = tc.visits.length - k;
          const va = afterOf(tc, no - 1);
          const d = va === undefined ? null : v.painBefore - va;
          return (
            <View key={`${no}-${v.date}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <Text variant="bodySm" style={{ width: 64 }}>
                ครั้งที่ {no}
              </Text>
              <Text variant="bodyXs" tone="tertiary" style={{ flex: 1 }} numberOfLines={1}>
                {v.date}
              </Text>
              <Text variant="labelSm">
                {v.painBefore} → <Text variant="labelSm" color={va === undefined ? colors.text.tertiary : painColorOf(va)}>{va ?? '–'}</Text>
              </Text>
              <Text variant="bodyXs" tone={d !== null && d > 0 ? undefined : 'tertiary'} color={d !== null && d > 0 ? colors.brand.primary : undefined} style={{ width: 28, textAlign: 'right' }}>
                {d === null ? '' : d > 0 ? `-${d}` : d === 0 ? '0' : `+${-d}`}
              </Text>
            </View>
          );
        })}
        {onAll ? (
          <Text variant="labelSm" color={colors.brand.primary}>
            ดูรายละเอียดทั้งหมด
          </Text>
        ) : null}
      </Tile>
    </View>
  );
}

const PAIN_CHIPS = Array.from({ length: 11 }, (_, i) => `${i}`);
/** อาการฉุกเฉินในข้อความ → เตือนทันทีโดยไม่รอ AI (สัญญาณเตือนหลอดเลือดสมอง/หัวใจ — หน้า RedFlag) */
const EMERGENCY = /เจ็บหน้าอก|แน่นหน้าอก|หายใจไม่ออก|หายใจลำบาก|หายใจไม่ทัน|อ่อนแรงครึ่ง|แขนขาอ่อนแรงข้างเดียว|ชาครึ่งซีก|ปากเบี้ยว|หน้าเบี้ยว|พูดไม่ชัด|พูดลำบาก|ชักกระตุก|หมดสติ|ปวดหัวรุนแรงเฉียบพลัน|ปวดศีรษะรุนแรงเฉียบพลัน/;

const nowTimeText = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** คำถามแนะนำในแชท — ข้อแรกเด่น (พื้นเข้ม) ที่เหลือพื้นอ่อน · แตะ = ถามเรื่องนั้น */
/** แผนการนวดจาก AI: ข้อควรระวัง → ทีละช่วง → หลังนวด · ข้อมูลที่ใช้วางแผนพับไว้ */
function MassagePlanCard({ card }: { card: Extract<ThreadCard, { type: 'massagePlan' }> }) {
  const { colors } = useTheme();
  const [showIntake, setShowIntake] = React.useState(false);
  const { plan } = card;
  const row = (icon: React.ComponentProps<typeof Icon>['name'], color: string, text: string) => (
    <View key={text} style={{ flexDirection: 'row', gap: space[2], alignItems: 'flex-start' }}>
      <Icon name={icon} size="xs" color={color} />
      <Text variant="bodySm" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
  return (
    <View style={{ gap: space[4], padding: space[4], borderRadius: radius.lg, backgroundColor: colors.surface.default, borderWidth: 1, borderColor: colors.border.subtle }}>
      <View style={{ gap: space[1] }}>
        <Text variant="titleSm">แผนการนวด</Text>
        <Text variant="bodySm" tone="secondary">
          {plan.style} {plan.minutes}
        </Text>
      </View>
      <Text variant="bodySm">{plan.summary}</Text>
      {plan.cautions.length ? <View style={{ gap: space[2] }}>{plan.cautions.map((c) => row('alert-triangle', colors.status.warning.fg, c))}</View> : null}
      {plan.phases.map((ph, i) => (
        <View key={ph.title} style={{ gap: space[2] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <View style={{ width: 22, height: 22, borderRadius: radius.full, backgroundColor: colors.brand.subtle, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="labelSm" style={{ color: colors.brand.primary }}>
                {i + 1}
              </Text>
            </View>
            <Text variant="labelMd" style={{ flex: 1 }}>
              {ph.title}
            </Text>
            <Text variant="labelSm" tone="secondary">
              {ph.minutes}
            </Text>
          </View>
          <View style={{ gap: space[1], paddingLeft: 30 }}>
            {ph.steps.map((st) => (
              <Text key={st} variant="bodySm" tone="secondary">
                {st}
              </Text>
            ))}
          </View>
        </View>
      ))}
      {plan.aftercare.length ? (
        <View style={{ gap: space[2] }}>
          <Text variant="labelMd">หลังนวด</Text>
          {plan.aftercare.map((a) => row('check-circle', colors.brand.primary, a))}
        </View>
      ) : null}
      <Pressable accessibilityRole="button" onPress={() => setShowIntake((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
        <Text variant="labelMd" style={{ color: colors.brand.primary }}>
          ข้อมูลที่ใช้วางแผน
        </Text>
        <Icon name={showIntake ? 'chevron-up' : 'chevron-down'} size="xs" color={colors.brand.primary} />
      </Pressable>
      {showIntake ? (
        <View style={{ gap: space[2] }}>
          {card.intake.map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row', gap: space[3] }}>
              <Text variant="bodyXs" tone="secondary" style={{ width: 120 }}>
                {k}
              </Text>
              <Text variant="bodyXs" style={{ flex: 1 }}>
                {v}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** สถานที่ที่ AI แนะนำ (ตามแนวทาง) — ที่แรก = แนะนำ · แตะเพื่อเลือก · ดูทั้งหมด = เลือกเองในแท็บสถานที่ */
function PlacePickCard({ options, active, onPick, onAll }: { options: Extract<ThreadCard, { type: 'placePick' }>['options']; active: boolean; onPick: (id: string) => void; onAll: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space[2] }}>
      {options.map((o, i) => (
        <Pressable
          key={o.id}
          accessibilityRole="button"
          accessibilityLabel={`เลือก ${o.name}`}
          disabled={!active}
          onPress={() => onPick(o.id)}
          style={({ pressed }) => ({
            gap: space[1],
            padding: space[3],
            borderRadius: radius.lg,
            backgroundColor: colors.surface.default,
            borderWidth: i === 0 ? 2 : 1,
            borderColor: i === 0 ? colors.brand.primary : colors.border.subtle,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <Text variant="labelMd" style={{ flex: 1 }} numberOfLines={1}>
              {o.name}
            </Text>
            {i === 0 ? <Badge label="แนะนำ" tone="brand" /> : null}
          </View>
          <Text variant="caption" tone="secondary">
            {o.km} กม. ว่าง {o.slot}
          </Text>
          <Text variant="caption" tone="tertiary">
            {o.reason}
          </Text>
        </Pressable>
      ))}
      <Pressable accessibilityRole="button" onPress={onAll} style={{ alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' }}>
        <Text variant="labelMd" color={colors.brand.primary}>
          ดูสถานที่ทั้งหมด
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * เลือกผู้ให้บริการ + เวลา — การ์ดชุดเดียวกับหน้าจอง (เลื่อนแนวนอน) · แตะเวลา = เลือกทั้งคนและเวลา
 * เฉพาะคนที่ลงตารางรับบริการนี้ · คนที่ AI แนะนำขึ้นก่อน (ป้ายแนะนำ) · ไม่ระบุแพทย์ = รวมคิวว่างทุกคน
 */
function TherapistPickCard({
  card,
  active,
  onPick,
}: {
  card: Extract<ThreadCard, { type: 'therapistPick' }>;
  active: boolean;
  onPick: (placeId: string, service: ServiceId | undefined, therapistId: string, day: string, time: string) => void;
}) {
  const [sel, setSel] = React.useState<{ id: string; day: string; time: string } | null>(null);
  const rec = card.options.find((o) => o.recommended)?.id;
  const staff = therapistsAt(card.placeId, card.service).filter((t) => card.options.some((o) => o.id === t.id));
  const ordered = [...staff.filter((t) => t.id === rec), ...staff.filter((t) => t.id !== rec)];
  const pick = (id: string) => (day: string, time: string) => {
    if (!active) return;
    setSel({ id, day, time });
    onPick(card.placeId, card.service, id, day, time);
  };
  const recCard = ordered[0]?.id === rec ? ordered[0] : null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={THERAPIST_CARD_W + space[3]} decelerationRate="fast" contentContainerStyle={{ gap: space[3], paddingRight: space[4] }} style={{ marginRight: -space[4], opacity: active || sel ? 1 : 0.6 }}>
      {recCard ? <TherapistCard t={recCard} badge="แนะนำ" selected={sel?.id === recCard.id ? sel : null} onPick={pick(recCard.id)} /> : null}
      <AnyTherapistCard slots={anyoneSlots(card.placeId, card.service)} selected={sel?.id === ANY_THERAPIST ? sel : null} onPick={pick(ANY_THERAPIST)} />
      {ordered
        .filter((t) => t !== recCard)
        .map((t) => (
          <TherapistCard key={t.id} t={t} selected={sel?.id === t.id ? sel : null} onPick={pick(t.id)} />
        ))}
    </ScrollView>
  );
}

/**
 * สรุปการจองในแชท — เรียงตามสิ่งที่ผู้ใช้ต้องรู้ก่อน:
 * 1) เมื่อไหร่ + ที่ไหน (ต้องไปให้ถูกที่ถูกเวลา · นำทางได้) → 2) ใครดูแล → 3) บริการ/เรื่องที่นัด → ยืนยัน
 */
function BookConfirmCard({ card, active, onConfirm, onChange }: { card: Extract<ThreadCard, { type: 'bookConfirm' }>; active: boolean; onConfirm: (c: Extract<ThreadCard, { type: 'bookConfirm' }>) => void; onChange: () => void }) {
  const { colors } = useTheme();
  const place = PLACES.find((p) => p.id === card.placeId);
  const role = therapistsAt(card.placeId).find((t) => t.id === card.therapistId)?.role;
  const detail = (icon: React.ComponentProps<typeof Icon>['name'], label: string, value: string, sub?: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface.sunken }}>
        <Icon name={icon} size="sm" color={colors.text.secondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="caption" tone="tertiary">
          {label}
        </Text>
        <Text variant="labelMd" numberOfLines={1}>
          {value}
        </Text>
        {sub ? (
          <Text variant="caption" tone="secondary">
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );
  return (
    <View style={{ borderRadius: 24, backgroundColor: colors.surface.default, borderWidth: 1, borderColor: colors.border.subtle, overflow: 'hidden' }}>
      {/* 1) ที่ไหน + เมื่อไหร่ · ปุ่มนำทางอยู่แถวเวลา ให้ชื่อคลินิกได้เต็มบรรทัด */}
      <View style={{ padding: space[4], gap: space[3], backgroundColor: colors.brand.subtle }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <View style={{ width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface.default }}>
            <Icon name="map-pin" size="sm" color={colors.brand.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="labelLg" numberOfLines={2}>
              {card.name}
            </Text>
            {place ? (
              <Text variant="caption" tone="secondary">
                {place.km} กม. {place.area}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: space[2] }}>
            <Text variant="displayMd" style={{ lineHeight: 44 }}>
              {card.time}
            </Text>
            <Text variant="labelLg" color={colors.brand.primary}>
              {card.day}
            </Text>
          </View>
          {place ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`นำทางไป ${card.name}`}
              onPress={() => openMap(place)}
              hitSlop={6}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 28, paddingHorizontal: space[2] + 2, borderRadius: radius.full, backgroundColor: colors.surface.default }}
            >
              <Icon name="navigation" size="xs" color={colors.brand.primary} />
              <Text variant="caption" color={colors.brand.primary} style={{ fontFamily: fontFamily.semibold }}>
                นำทาง
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* 2) ใครดูแล · 3) บริการ / เรื่องที่นัด */}
      <View style={{ padding: space[4], gap: space[3] }}>
        {detail('user', 'ผู้ให้บริการ', card.therapist, role)}
        {detail('activity', 'บริการ', card.service)}
        {detail('file-text', 'เรื่องที่นัด', card.topic)}
        {active ? (
          <View style={{ flexDirection: 'row', gap: space[2], paddingTop: space[1] }}>
            <PillButton label="ยืนยันจอง" icon="check" onPress={() => onConfirm(card)} />
            <PillButton label="แก้ไขการจอง" icon="edit-2" tone="light" onPress={onChange} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** แหล่งอ้างอิงจากคลังความรู้ — แตะเพื่อดูข้อความต้นฉบับของหน้านั้น */
function SourcesCard({ refs }: { refs: Extract<ThreadCard, { type: 'sources' }>['refs'] }) {
  const { colors } = useTheme();
  const [open, setOpen] = React.useState<number | null>(null);
  return (
    <View style={{ gap: space[2] }}>
      {refs.map((r, i) => (
        <Pressable
          key={`${r.f}${r.p}`}
          accessibilityRole="button"
          accessibilityLabel={`อ้างอิง ${i + 1} ${r.f} หน้า ${r.p}`}
          onPress={() => setOpen(open === i ? null : i)}
          style={{ gap: space[2], padding: space[3], borderRadius: radius.md, backgroundColor: colors.surface.default, borderWidth: 1, borderColor: colors.border.subtle }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <Icon name="book-open" size="xs" color={colors.brand.primary} />
            <Text variant="labelSm" style={{ flex: 1 }} numberOfLines={1}>
              [{i + 1}] {r.f}
            </Text>
            <Text variant="labelSm" tone="secondary">
              หน้า {r.p}
            </Text>
            <Icon name={open === i ? 'chevron-up' : 'chevron-down'} size="xs" color={colors.text.tertiary} />
          </View>
          {open === i ? (
            <Text variant="bodySm" tone="secondary">
              {r.quote}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

function IntentChips({ options, onPick }: { options: string[]; onPick: (o: string) => void }) {
  return (
    <View style={{ gap: space[2], alignItems: 'flex-start' }}>
      {options.map((o, i) => (
        <PillButton key={o} label={o} tone={i === 0 ? 'dark' : 'light'} onPress={() => onPick(o)} />
      ))}
    </View>
  );
}

/**
 * แท็บเดียว ชื่อบอกประเภทเอง: "รักษา…" = ใบการรักษา (นวดแล้ว · ชื่อโรค) · "ประเมิน…" = ใบร่าง (ยังไม่รักษา · ชื่ออาการ)
 * value = index รวม (ใบการรักษาก่อน แล้วต่อด้วยใบร่าง) · อาการใหม่ → ปุ่มม่วงด้านล่าง
 */
function CaseTabs({ cases, drafts, extras = [], value, onChange, onNew }: { cases: string[]; drafts: string[]; extras?: string[]; value: number; onChange: (i: number) => void; onNew?: () => void }) {
  const { colors } = useTheme();
  const items = [...cases.map((c) => `รักษา${c}`), ...drafts.map((d) => `ประเมิน${d}`), ...extras];
  // แท็บที่เลือกต้องเห็นเสมอ (เช่น เพิ่งจอง/ประเมินแล้วเปิดแท็บท้ายสุด) → เลื่อนแถบตามตำแหน่งแท็บ
  const scroll = React.useRef<ScrollView>(null);
  const size = React.useRef({ content: 0, view: 0 });
  const follow = React.useCallback(() => {
    const max = size.current.content - size.current.view;
    if (max <= 0 || items.length < 2) return;
    scroll.current?.scrollTo({ x: Math.round((max * value) / (items.length - 1)), animated: true });
  }, [value, items.length]);
  // เปลี่ยนแท็บตอนหน้าแรกถูกซ่อน (เช่น อยู่หน้าจอง) → เลื่อนอีกครั้งตอนกลับมาเห็นหน้า
  const focused = useIsFocused();
  React.useEffect(() => {
    if (!focused) return;
    const t = setTimeout(follow, 120);
    return () => clearTimeout(t);
  }, [follow, focused]);
  if (!items.length && !onNew) return null;
  // ปุ่มประเมินใหม่ตรึงไว้ทางซ้าย (ไม่เลื่อน) · เลื่อนเฉพาะแท็บ และจางที่ขอบตอนเลื่อนผ่าน
  // ระยะปุ่ม→แท็บแรก = ระยะระหว่างแท็บ (space[2]) — JellyRadio มี margin ติดลบเผื่อแอนิเมชันพองตัว จึงชดเชยใน padding
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: BENTO_CASE_H, marginRight: -space[5] }}>
        {onNew ? (
          // ThaiWell AI: คุยเรื่องของแท็บที่เลือก หรือเริ่มประเมินเรื่องใหม่ (ตรึงซ้าย ไม่เลื่อนตามแท็บ)
          <AIButton label={`ThaiWell AI${items[value] ? ` เรื่อง${items[value]}` : ''}`} onPress={onNew} />
        ) : null}
      {items.length ? (
        <EdgeFade horizontal top={onNew ? TAB_GAP - 2 : 0} bottom={space[5]}>
          <ScrollView
            ref={scroll}
            horizontal
            showsHorizontalScrollIndicator={false}
            onLayout={(e) => {
              size.current.view = e.nativeEvent.layout.width;
              follow();
            }}
            onContentSizeChange={(w) => {
              size.current.content = w;
              follow();
            }}
            contentContainerStyle={{ minHeight: BENTO_CASE_H, alignItems: 'center', paddingLeft: onNew ? TAB_GAP + 3 : 0, paddingRight: space[5] }}
          >
            <JellyRadio items={items} value={value} onChange={onChange} size="md" gap={space[2]} swell={0.06} barge={2} shrink={0.02} accessibilityLabel="เลือกเรื่องที่ดูแล" />
          </ScrollView>
        </EdgeFade>
      ) : null}
    </View>
  );
}

/** จองไว้ก่อนประเมิน — แผ่นการ์ดแสดงเฉพาะข้อมูลนัดที่มี (นัด · ผู้ให้บริการ · บริการ) */
/**
 * การ์ดนัดครั้งแรก (เต็มแถว) — รูปแบบเดียวกับ "นัดครั้งที่ N" หลังรักษาแล้ว (HomeBento)
 * เวลา (ซ้าย) · คิว/วันที่ (ขวา) → ขั้นที่ต้องทำ → ปุ่ม
 */
function FirstVisitCard({
  booking: b,
  steps,
  onCheckIn,
  onOpen,
}: {
  booking: { date: string; time: string; clinic: string; queue?: string; status?: 'pending' | 'confirmed' };
  /** ขั้นเพิ่มเติมของนัดนี้ (เช่น ก่อนมานวด) */
  steps?: React.ReactNode;
  onCheckIn: () => void;
  onOpen: () => void;
}) {
  const { colors } = useTheme();
  const today = b.date === 'วันนี้';
  const pending = b.status === 'pending';
  return (
    <Tile style={{ gap: space[3] }} onPress={onOpen} accessibilityLabel={`นัดครั้งที่ 1 ${b.date} ${b.time}${b.queue ? ` คิว ${b.queue}` : ''} ดูรายละเอียด`}>
      <TileTitle title="นัดครั้งที่ 1" meta={b.clinic} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
        <View>
          <Text variant="bodyXs" tone="secondary">
            {today ? 'วันนี้' : 'เวลา'}
          </Text>
          <Text variant="titleXl">{b.time}</Text>
        </View>
        {today ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="bodyXs" tone="secondary">
              คิว
            </Text>
            <Text variant="titleXl" color={b.queue ? colors.brand.primary : colors.text.tertiary}>
              {b.queue ?? '–'}
            </Text>
          </View>
        ) : (
          <DateBlock date={b.date} />
        )}
      </View>
      <View style={{ gap: space[2] }}>
        <StepRow done={!pending} text={pending ? 'รอคลินิกยืนยันนัด' : 'คลินิกยืนยันนัดแล้ว'} />
        <StepRow done={!!b.queue} text={b.queue ? `ได้คิว ${b.queue}` : 'รับเลขคิวเมื่อเช็กอินวันนัด'} />
        {steps}
      </View>
      {pending ? (
        <Pressable accessibilityRole="button" accessibilityLabel="รายละเอียดนัด" onPress={onOpen}>
          <TilePill icon="clock" label="รอคลินิกยืนยัน" dark={false} />
        </Pressable>
      ) : today ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          {/* เช็กอินแล้ว (ได้คิว) → ดูคิว */}
          <Pressable accessibilityRole="button" accessibilityLabel={b.queue ? 'ดูคิว' : 'เช็กอิน'} onPress={onCheckIn} style={{ flex: 1 }}>
            <TilePill icon={b.queue ? 'eye' : 'maximize'} label={b.queue ? 'ดูคิว' : 'เช็กอิน'} />
          </Pressable>
          <NavIconButton clinic={b.clinic} />
        </View>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel="รายละเอียดนัด" onPress={onOpen}>
          <TilePill icon="file-text" label="รายละเอียด" dark={false} />
        </Pressable>
      )}
    </Tile>
  );
}

function BookingBento({ width, booking: b, onCheckIn, onEdit }: { width: number; booking: { date: string; time: string; clinic: string; therapist: string; service: string; queue?: string; status?: 'pending' | 'confirmed' }; onCheckIn: () => void; onEdit: () => void }) {
  const halfW = (width - BENTO_GAP) / 2;
  const [svc, mins] = b.service.split(' · ');
  return (
    <View style={{ gap: BENTO_GAP }}>
      <FirstVisitCard booking={b} onCheckIn={onCheckIn} onOpen={onEdit} />
      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: BENTO_GAP }}>
        <Tile style={{ width: halfW, gap: space[1] }}>
          <TileTitle title="ผู้ให้บริการ" />
          <Text variant="bodySm" numberOfLines={2}>
            {b.therapist}
          </Text>
        </Tile>
        <Tile style={{ width: halfW, gap: space[1] }}>
          <TileTitle title="บริการ" meta={mins} />
          <Text variant="bodySm" numberOfLines={2}>
            {svc}
          </Text>
        </Tile>
      </View>
    </View>
  );
}

/**
 * หน้าแรกของคนที่ยังไม่มีข้อมูล — บอกว่าแอปทำอะไร แล้วพาไปขั้นแรก
 * 1) แอปนี้คืออะไร (หนึ่งประโยค) → 2) ปุ่มหลัก: ประเมินอาการกับ AI → 3) ใช้งานอย่างไร 3 ขั้น → 4) ทางลัดเรื่องอื่น (เข้าแชทพร้อมหัวข้อ)
 */
/**
 * แผ่นการ์ดของผู้ใช้ใหม่ (ยังไม่มีข้อมูล) — ข้อมูลจริงที่ใช้ได้ทันที ไม่ใช่แค่ทางลัด
 * คลินิกใกล้คุณ (คิวว่างวันนี้) · ธาตุเจ้าเรือน (จากวันเกิด) · ท่ายืดแนะนำ · อาการที่นวดไทยช่วยได้ (แตะ = เริ่มประเมินอาการนั้น)
 */
function WelcomeBento({
  width,
  element,
  onStart,
  onPlace,
  onPlaces,
  onElement,
  onStretch,
}: {
  width: number;
  element: ElementKey | null;
  onStart: (intent?: string) => void;
  onPlace: (id: string) => void;
  onPlaces: () => void;
  onElement: () => void;
  onStretch: (groupId: string) => void;
}) {
  const { colors } = useTheme();
  const halfW = (width - BENTO_GAP) / 2;
  const near = nearestClinic();
  const info = element ? ELEMENT_INFO[element] : null;
  // 3 กลุ่มที่มารับบริการแพทย์แผนไทยมากที่สุด (Health Profile 2568 หน้า 13) + ปวดศีรษะ (ลมปะกัง — CPG_PCU หน้า 139 ข้อ 2.1)
  const common = ['ปวดคอ-บ่า', 'ปวดหลัง', 'ปวดขา', 'ปวดศีรษะ'];
  return (
    <View style={{ gap: BENTO_GAP }}>
      {/* 1) คลินิกใกล้คุณ */}
      {near ? (
        <Tile style={{ gap: space[2] }} onPress={() => onPlace(near.id)} accessibilityLabel={`คลินิกใกล้คุณ ${near.name} ${near.km} กม.`}>
          <TileTitle title="คลินิกใกล้คุณ" meta={`${near.km} กม.`} />
          <Text variant="bodyMd" numberOfLines={1}>
            {near.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <Text variant="bodyXs" tone="secondary">
              ว่างวันนี้
            </Text>
            {near.slots.slice(0, 3).map((t) => (
              <View key={t} style={{ paddingHorizontal: space[2], height: 24, justifyContent: 'center', borderRadius: radius.full, backgroundColor: colors.brand.subtle }}>
                <Text variant="labelSm" color={colors.brand.primary} style={{ transform: [{ translateY: 1 }] }}>
                  {t}
                </Text>
              </View>
            ))}
            <Pressable accessibilityRole="button" accessibilityLabel="ดูสถานที่ทั้งหมด" onPress={onPlaces} hitSlop={8} style={{ marginLeft: 'auto' }}>
              <Text variant="labelSm" color={colors.brand.primary}>
                ดูทั้งหมด
              </Text>
            </Pressable>
          </View>
        </Tile>
      ) : null}

      {/* 2) ธาตุเจ้าเรือน · ท่ายืดแนะนำ */}
      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: BENTO_GAP }}>
        <Tile style={{ width: halfW, gap: space[2] }} onPress={onElement} accessibilityLabel={info ? `ธาตุเจ้าเรือน ${info.label}` : 'ธาตุเจ้าเรือน'}>
          <TileTitle title="ธาตุเจ้าเรือน" />
          {info && element ? (
            <>
              <Text variant="titleSm">{info.label}</Text>
              <Text variant="bodyXs" tone="secondary" numberOfLines={3}>
                {info.advice.replace('\n', ' ')}
              </Text>
            </>
          ) : (
            <Text variant="bodyXs" tone="secondary">
              ทำแบบประเมินสั้น ๆ เพื่อดูธาตุของคุณ
            </Text>
          )}
          <Text variant="labelSm" color={colors.brand.primary} style={{ marginTop: 'auto' }}>
            ดูธาตุปัจจุบัน
          </Text>
        </Tile>
        <View style={{ width: halfW }}>
          <SelfCareTile groupId="office" title="ยืดคอ-บ่า" onPress={() => onStretch('office')} />
        </View>
      </View>

      {/* 3) อาการที่นวดไทยช่วยได้ → แตะเริ่มประเมินอาการนั้น */}
      <Tile style={{ gap: space[3] }}>
        <TileTitle title="นวดไทยช่วยอาการไหนได้" meta="แตะเพื่อเริ่มประเมิน" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          {common.map((sym) => (
            <Pressable
              key={sym}
              accessibilityRole="button"
              accessibilityLabel={`เริ่มประเมิน ${sym}`}
              onPress={() => onStart(sym)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space[1], height: 34, paddingHorizontal: space[3], borderRadius: radius.full, borderWidth: 1, borderColor: colors.border.subtle, backgroundColor: pressed ? colors.surface.sunken : colors.surface.default })}
            >
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#D93A2B' }} />
              <Text variant="labelSm" style={{ transform: [{ translateY: 1 }] }}>
                {sym.replace('-', ' ')}
              </Text>
            </Pressable>
          ))}
        </View>
      </Tile>
    </View>
  );
}

/** skeleton ของการ์ดหน้าแรก — วางตำแหน่ง/สัดส่วนเดียวกับ HomeBento (นัด · Pain Score | แผน · ดูแลตัวเอง · ก่อนมานวด) */
function BentoSkeleton({ width }: { width: number }) {
  const halfW = (width - BENTO_GAP) / 2;
  const t = componentTokens.statCard;
  const tile = (h: number, children: React.ReactNode) => (
    <View style={{ height: h, padding: TILE_PAD, gap: space[2], borderRadius: radius.lg, backgroundColor: t.bg, borderWidth: 1, borderColor: t.border, overflow: 'hidden' }}>{children}</View>
  );
  return (
    <View accessibilityLabel="กำลังโหลด" style={{ flexDirection: 'row', gap: BENTO_GAP }}>
      <View style={{ width: halfW, gap: BENTO_GAP }}>
        {tile(150, <><Bone w="80%" h={12} /><Bone w="45%" h={26} /><Bone h={40} r={20} style={{ marginTop: 'auto' }} /></>)}
        {tile(190, <><Bone w="50%" h={12} /><View style={{ flexDirection: 'row', gap: space[3] }}><Bone w={44} h={34} /><Bone w={44} h={34} /></View><Bone w="55%" h={22} r={11} /><Bone h={44} style={{ marginTop: 'auto' }} /></>)}
        {tile(140, <><Bone w="70%" h={14} /><Bone w="60%" h={20} r={10} /><Bone h={40} r={20} style={{ marginTop: 'auto' }} /></>)}
      </View>
      <View style={{ width: halfW, gap: BENTO_GAP }}>
        {tile(150, <><Bone w="55%" h={12} /><Bone w="60%" h={26} /><Bone h={6} r={3} /><Bone w="70%" h={12} /><Bone w="55%" h={12} /></>)}
        <View style={{ height: 190, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: t.bg, borderWidth: 1, borderColor: t.border }}>
          <Shimmer style={{ height: 120, alignItems: 'center', justifyContent: 'center' }}>
            <BodySilhouette height={80} />
          </Shimmer>
          <View style={{ padding: TILE_PAD, paddingTop: space[3], gap: space[2] }}>
            <Bone w="45%" h={12} />
            <Bone w="70%" h={14} />
          </View>
        </View>
        {tile(140, <><Bone w="45%" h={12} /><Bone w="85%" h={14} /><Bone w="75%" h={14} /></>)}
      </View>
    </View>
  );
}

/** กลุ่มอาการ (ยืดเหยียด 7 กลุ่มอาการ) ของท่ายืดที่แนะนำ ตามอาการที่ประเมิน */
const stretchGroupFor = (symptoms: string[]) => {
  const has = (re: RegExp) => symptoms.some((x) => re.test(x));
  return has(/นิ้ว/) ? 'trigger_finger' : has(/ไหล่ติด/) ? 'frozen_shoulder' : has(/คอ|บ่า|ไหล่|สะบัก/) ? 'office' : has(/สะโพก|ก้น/) ? 'piriformis' : has(/หลัง|เอว/) ? 'herniated_disc' : has(/เข่า|ขา/) ? 'knee' : 'office';
};

/**
 * ดูแลตัวเอง — ภาพท่ายืดเคลื่อนไหว (GIF) เต็มความกว้างช่อง + ชื่อท่า + ปุ่มเล่น
 * ท่าที่ไม่มีภาพ (เช่น ฝึกหายใจ) → แถวเดียวแบบเดิม
 */
function SelfCareTile({ groupId, title, done, onPress }: { groupId?: string; title: string; done?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const group = SYMPTOM_GROUPS.find((g) => g.id === groupId);
  const motion = group ? STRETCH_MOTION[group.stretch.name] : undefined;
  const gif = stretchGif(motion);
  const name = group ? group.stretch.name.replace(' 7 ท่า', '') : title;
  const play = (
    <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? colors.brand.subtle : colors.text.primary }}>
      <Icon name={done ? 'check' : 'play'} size="xs" color={done ? colors.brand.primary : colors.text.inverse} />
    </View>
  );
  const label = (
    <View style={{ flex: 1 }}>
      {/* หัวการ์ดแบบเดียวกับการ์ดอื่น: หัวข้อตัวหนา · รายละเอียดตัวเล็ก */}
      <Text variant="labelMd" numberOfLines={1}>
        ดูแลตัวเอง
      </Text>
      <Text variant="bodyXs" tone="secondary" numberOfLines={1}>
        {done ? `${name} · ทำแล้ววันนี้` : name}
      </Text>
    </View>
  );
  return (
    <Tile style={{ padding: 0 }} onPress={onPress} accessibilityLabel={`ดูแลตัวเอง ${name}${motion ? ` ช่วย${motion.primary.label}` : ''}`}>
      <View style={{ height: 120, overflow: 'hidden', backgroundColor: colors.surface.sunken }}>
        {/* เห็นหุ่นเต็มตัวทุกจังหวะ (ชูแขนก็ไม่หลุดขอบ) · ขนาดเท่ากับหน้ารวมท่า */}
        {gif ? <LoadingImage source={gif} resizeMode="contain" silhouette={84} style={{ width: '100%', height: '100%' }} /> : null}
        {motion ? (
          <View style={{ position: 'absolute', left: space[2], top: space[2], flexDirection: 'row', alignItems: 'center', gap: 4, height: 22, paddingHorizontal: space[2], borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.9)' }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#D93A2B' }} />
            <Text style={{ fontFamily: fontFamily.semibold, fontSize: 11, lineHeight: 17 }}>{motion.primary.label}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], padding: TILE_PAD, paddingTop: space[3] }}>
        {label}
        {play}
      </View>
    </Tile>
  );
}

/**
 * ใบร่าง (ประเมินกับ AI แล้ว ยังไม่มีการรักษา) — ช่องเดียวกับใบการรักษา เปลี่ยนแค่เนื้อหา
 * นัด → ยังไม่ได้จอง + จองนวด (มีข้อห้าม → พบแพทย์ก่อน) · ผลการรักษา → ผลประเมิน (ค่าตั้งต้น)
 * แผนการรักษา → แนวทางที่แนะนำ (รอผู้ให้บริการยืนยัน) · ดูแลตัวเอง/ก่อนมานวด → ตามอาการและข้อควรระวัง
 * แถวล่าง → นวดแล้วเท่านั้น (ติดตามผล) · ประเมินซ้ำผ่านปุ่มม่วง แล้ว AI ถามว่าเรื่องเดิมหรือใหม่
 */
function DraftBento({
  width,
  draft: d,
  tabs,
  onBook,
  onCheckIn,
  onRedFlag,
  onFollowUp,
  onSelfCare,
  onPlaces,
  onOpen,
}: {
  width: number;
  draft: DraftCase;
  tabs: React.ReactNode;
  /** จองนวด (ระบุสถานที่ = จองที่แนะนำ) */
  onBook: (clinic?: string) => void;
  /** ดูสถานที่ทั้งหมด · doctor = โรงพยาบาลใกล้คุณ */
  onPlaces: (mode?: 'doctor') => void;
  /** แตะการ์ดนัด → หน้ารายละเอียดนัด */
  onOpen: () => void;
  onCheckIn: () => void;
  onRedFlag: () => void;
  onFollowUp: () => void;
  /** groupId = เปิดท่าของเรื่องนี้ตรง ๆ · ไม่ระบุ = หน้ารวมท่า */
  onSelfCare: (groupId?: string) => void;
}) {
  const { colors } = useTheme();
  const halfW = (width - BENTO_GAP) / 2;
  const b = d.booking;
  const served = d.stage === 'served';
  const prep = [...(d.caution?.includes('ความดัน') || d.caution?.includes('อบ') ? ['วัดความดันก่อนนวด'] : []), 'งดอาหารหนัก 30 นาที'];
  const near = nearestClinic();
  const hospital = nearestHospital();
  const booked = !!b && !d.red && !served;

  return (
    <View style={{ gap: BENTO_GAP }}>
      {tabs}

      {/* จองแล้ว → การ์ดนัดเต็มแถว แบบเดียวกับหลังรักษา (นัดครั้งที่ N) */}
      {booked ? <FirstVisitCard booking={b!} onCheckIn={onCheckIn} onOpen={onOpen} steps={<StepRow text={prep.join(' · ')} />} /> : null}

      {/* จองแล้ว → แผนการรักษาซ้าย · ผลประเมินขวา (ลำดับเดียวกับหลังนวด) */}
      <View style={{ flexDirection: booked ? 'row-reverse' : 'row', alignItems: 'stretch', gap: BENTO_GAP }}>
        <View style={{ width: halfW, gap: BENTO_GAP }}>
          {/* นัด */}
          {booked ? null : d.red ? (
            <Tile style={{ gap: space[2] }} onPress={onRedFlag} accessibilityLabel="ควรพบแพทย์ก่อน">
              <TileTitle title="นัด" />
              <Text variant="titleSm" color={colors.status.danger.fg}>
                ควรพบแพทย์ก่อน
              </Text>
              <TilePill icon="alert-triangle" label="ดูคำแนะนำ" />
              {/* มีนัดค้างอยู่ → ยังเข้าไปเลื่อน/ยกเลิกได้ */}
              {b ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`จัดการนัด ${b.date} ${b.time}`} onPress={onOpen}>
                  <Text variant="labelSm" color={colors.status.danger.fg}>
                    มีนัด {b.date} {b.time} · เลื่อน/ยกเลิก
                  </Text>
                </Pressable>
              ) : null}
            </Tile>
          ) : b ? (
            <Tile style={{ gap: space[2] }} onPress={served ? undefined : onOpen} accessibilityLabel={`นัด ${b.date} ${b.time} ดูรายละเอียด`}>
              <View style={{ gap: space[2] }}>
                <TileTitle title={served ? 'นวดแล้ว' : 'นัดของคุณ'} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
                  <View>
                    <Text variant="bodyXs" tone="secondary" numberOfLines={1}>
                      {b.date === 'วันนี้' ? 'วันนี้' : b.clinic}
                    </Text>
                    <Text variant="titleXl">{b.time}</Text>
                  </View>
                  {b.date !== 'วันนี้' ? <DateBlock date={b.date} /> : null}
                </View>
              </View>
              {/* แตะการ์ด = รายละเอียดนัด (แก้ไข/ยกเลิก) · ปุ่ม = เช็กอิน */}
              {/* บริการที่จองไม่ตรงผลประเมิน → เตือนบนการ์ด (แตะการ์ด = รายละเอียดนัด เปลี่ยนบริการได้) */}
              {!served && !d.keepService && serviceMismatch(b.service, d.caution) ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="alert-triangle" size="xs" color={colors.status.warning.fg} />
                  <Text variant="caption" color={colors.status.warning.fg} numberOfLines={1}>
                    บริการไม่ตรงผลประเมิน
                  </Text>
                </View>
              ) : null}
              {!served && b.status === 'pending' ? (
                // คำขอจอง ยังรอคลินิกยืนยัน → ยังเช็กอินไม่ได้
                <TilePill icon="clock" label="รอคลินิกยืนยัน" dark={false} />
              ) : served ? null : b.date === 'วันนี้' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                  <Pressable accessibilityRole="button" accessibilityLabel="เช็กอิน" onPress={onCheckIn} style={{ flex: 1 }}>
                    <TilePill icon="maximize" label="เช็กอิน" />
                  </Pressable>
                  <NavIconButton clinic={b.clinic} />
                </View>
              ) : (
                // เช็กอินได้เฉพาะวันนัด · วันอื่น = จัดการนัด
                <TilePill icon="edit-2" label="จัดการนัด" dark={false} />
              )}
            </Tile>
          ) : (
            // ยังไม่ได้จอง → แนะนำที่ใกล้ที่สุด (มีแพทย์แผนไทย + บัตรทอง + คิวว่าง) จองได้เลย หรือดูที่อื่น
            <Tile style={{ gap: space[2] }} onPress={() => onBook(near.name)} accessibilityLabel={`จองที่ ${near.name}`}>
              <View style={{ gap: 2 }}>
                <TileTitle title="แนะนำใกล้คุณ" />
                <Text variant="bodySm" numberOfLines={2}>
                  {near.name}
                </Text>
                <Text variant="bodyXs" tone="tertiary">
                  {near.km} กม. ว่าง {near.slots[0]}
                </Text>
              </View>
              {/* ปุ่มหลัก (จองที่นี่) + ปุ่มรองวงกลม (ดูที่อื่น · ไอคอนแผนที่) แถวเดียวกัน */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                <View style={{ flex: 1 }}>
                  <TilePill icon="calendar" label="จองที่นี่" />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="ดูที่อื่น"
                  onPress={() => onPlaces()}
                  hitSlop={4}
                  style={({ pressed }) => ({
                    width: 34,
                    height: 34,
                    borderRadius: radius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.surface.default,
                    borderWidth: 1,
                    borderColor: colors.border.subtle,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Icon name="map" size="xs" color={colors.text.primary} />
                </Pressable>
              </View>
            </Tile>
          )}

          {/* ผลประเมิน = การ์ด Pain Score ตัวเดียวกับในแชท (ดูอย่างเดียว) · หลังนวดแสดงคะแนนหลังนวด */}
          <View pointerEvents="none" style={{ flex: 1 }}>
            {served && d.after !== undefined ? (
              <PainScoreCard value={d.after} before={d.pain} stageLabel="หลังนวด" title="ผลครั้งที่ 1" strongTitle padding={TILE_PAD} chart width={halfW} />
            ) : (
              <PainScoreCard value={d.pain} stageLabel="ก่อนรักษา" title="ผลประเมิน" strongTitle padding={TILE_PAD} chart width={halfW} />
            )}
          </View>
        </View>

        <View style={{ width: halfW, gap: BENTO_GAP }}>
          {/* ควรพบแพทย์ก่อน → แนวทาง · นอกนั้น = แผนการรักษา แบบเดียวกับหลังนวด (ยังไม่นวด = 0 ครั้ง จุดเทาทั้งคอร์ส) */}
          {d.red ? (
            <Tile style={{ gap: space[1] }}>
              <TileTitle title="แนวทาง" />
              <Text variant="titleSm">ตรวจกับแพทย์ก่อน</Text>
            </Tile>
          ) : (
            <PlanTile width={halfW} plan="นวดราชสำนัก" done={served ? 1 : 0} total={6} values={served && d.after !== undefined ? [d.after] : []} note={d.caution} />
          )}

          {d.red ? (
            // ควรพบแพทย์ก่อน → ทางไปต่อ: โรงพยาบาลใกล้คุณ (นำทาง) หรือดูทั้งหมด
            <Tile style={{ flex: 1, gap: space[2] }} onPress={() => onPlaces('doctor')} accessibilityLabel="พบแพทย์ใกล้คุณ">
              <View style={{ gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] }}>
                  <Text variant="labelMd">พบแพทย์ใกล้คุณ</Text>
                  <Text variant="labelMd" color={colors.brand.primary}>
                    ดูทั้งหมด
                  </Text>
                </View>
                <Text variant="bodySm" numberOfLines={2}>
                  {hospital.name}
                </Text>
                <Text variant="bodyXs" tone="tertiary">
                  {hospital.km} กม.
                </Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={`นำทางไป ${hospital.name}`} onPress={() => openMap(hospital)}>
                <TilePill icon="navigation" label="นำทาง" />
              </Pressable>
            </Tile>
          ) : (
            <>
              {/* ดูแลตัวเอง ระหว่างรอนัด */}
              <SelfCareTile groupId={stretchGroupFor(d.symptoms)} title="ยืดเหยียด" onPress={() => onSelfCare(stretchGroupFor(d.symptoms))} />
              {/* ก่อนมานวด (จองแล้ว → อยู่ในการ์ดนัด) */}
              {booked ? null : (
                <Tile style={{ flex: 1, gap: space[2] }}>
                  <TileTitle title="ก่อนมานวด" />
                  {prep.map((it) => (
                    <View key={it} style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
                      <Icon name="check-circle" size="xs" color={colors.brand.primary} />
                      <Text variant="bodySm" style={{ flex: 1 }} numberOfLines={2}>
                        {it}
                      </Text>
                    </View>
                  ))}
                </Tile>
              )}
            </>
          )}
        </View>
      </View>

      {/* แถวล่าง: นวดแล้วเท่านั้น → ติดตามผลหลังนวด (ประเมินอาการซ้ำ = ปุ่มม่วง) */}
      {served ? (
        <Tile style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }} onPress={onFollowUp} accessibilityLabel="อัปเดตอาการวันนี้">
          <View style={{ flex: 1 }}>
            <Text variant="labelMd">อาการวันนี้</Text>
            <Text variant="bodyXs" tone="secondary">
              หลังนวดดีขึ้นต่อไหม
            </Text>
          </View>
          <TilePill icon="edit-3" label="อัปเดตอาการ" />
        </Tile>
      ) : null}
    </View>
  );
}

/**
 * หน้าแรกแบบ bento — หุ่นใหญ่กลางจออยู่ชั้นหลังเหมือนเดิม · ช่องข้อมูลสองคอลัมน์
 * 1) แถบใบการรักษา (แยกตามโรค) เต็มแถว — คุมทุกช่องด้านล่าง + mark บนหุ่น
 * 2) กลาง: ซ้าย = นัดของใบนี้ (+ เช็กอินถ้าวันนี้) · ผลการรักษา | ขวา = แผนการรักษา (คอร์สถึงไหน) · ดูแลตัวเองวันนี้ · ก่อนมานวด
 * 3) ล่างเต็มแถว (ใกล้นิ้ว): ติดตามอาการ — จำนวนจุด + ชื่อจุด (ตรงกับ mark) + ปุ่มประเมิน
 * หุ่นอยู่ชั้นหลัง (ช่องโปร่ง) · จุดที่รักษาบอกในช่องติดตามอาการ · ธาตุเป็นข้อมูลส่วนบุคคล → อยู่ใน header ต่อจากชื่อ
 */
function HomeBento({
  width,
  caseIdx,
  tcase,
  tabs,
  onCheckIn,
  onHistory,
  onFollowUp,
  onSelfCare,
  onEdit,
  onOpen,
  onBook,
  onPreVisit,
}: {
  /** ประเมินก่อนนวด (แบบฟอร์ม) */
  onPreVisit: () => void;
  width: number;
  caseIdx: number;
  tcase: TreatmentCase;
  tabs: React.ReactNode;
  onCheckIn: () => void;
  onHistory: () => void;
  onFollowUp: () => void;
  /** groupId = เปิดท่าของเรื่องนี้ตรง ๆ · ไม่ระบุ = หน้ารวมท่า */
  onSelfCare: (groupId?: string) => void;
  /** แก้ไขนัด (เลื่อน/เปลี่ยน) — ปุ่มรองแบบ outline */
  onEdit: () => void;
  /** แตะการ์ดนัด → หน้ารายละเอียดนัด */
  onOpen: () => void;
  /** ยกเลิกนัดแล้ว → จองใหม่ */
  onBook: () => void;
}) {
  const { colors } = useTheme();
  const { followUps, cancelledAppts, caseAppts } = useJourney();
  // ไม่มีนัด = ยกเลิกแล้ว หรือยังไม่ได้จองครั้งถัดไป (เช่น เพิ่งนวดครั้งแรก) → ปุ่มจองนัด
  const cancelled = cancelledAppts.includes(tcase.id) || tcase.appointment.date === '-';
  const clinic = caseClinic(tcase);
  const tc: TreatmentCase = tcase;
  const ap = tc.appointment;
  const halfW = (width - BENTO_GAP) / 2;

  // ผลการรักษาของใบนี้ = ก่อน/หลังของครั้งล่าสุด (คงไว้เสมอ ไม่ถูกแทนด้วยคะแนนวันนี้)
  const last = tc.visits[tc.visits.length - 1];
  const after = last.painAfter;
  // อาการวันนี้ (ประเมินก่อนนวดครั้งถัดไป / อัปเดตอาการ) — แยกจากผลของครั้งที่นวดไปแล้ว
  const { caseToday } = useJourney();
  const today = caseToday[tc.id];
  const hasNext = !cancelled && ap.date !== '-';
  const pending = tc.pending.filter((ss) => !followUps.some((f) => f.sessionId === ss.id));
  // เพิ่งนวดวันนี้ → ติดตามผลวันถัดไป (ผลคงอยู่ไหม)
  const justServed = last.date === 'วันนี้';

  const nav = useNav();
  const { bills } = useJourney();
  const nextNo = Math.min(tc.course.total, tc.course.done + 1);
  const finished = tc.course.done >= tc.course.total && !hasNext;
  // บิลของเรื่องนี้: รอชำระก่อน · ไม่มี = ใบเสร็จล่าสุด
  const bill = bills.find((b) => b.caseId === tc.id && b.status === 'pending') ?? bills.find((b) => b.caseId === tc.id);
  const preDone = !!today;
  // ประเมินหลังนวดครั้งล่าสุดแล้วหรือยัง: บอกความรู้สึกหลังนวด / ส่งผลติดตาม / ประเมินก่อนนวดครั้งถัดไป (ถามอาการหลังนวดครั้งก่อนแล้ว)
  const needPost = last.selfPain === undefined;

  return (
    <View style={{ gap: BENTO_GAP }}>
      {/* 1) ใบการรักษา + ใบร่าง — เต็มแถว */}
      {tabs}

      {/* 2) ครั้งถัดไป (เต็มแถว): นัด + ประเมินก่อนนวด + ก่อนมานวด อยู่ด้วยกัน — ทุกอย่างของ "ครั้งที่ N" ในการ์ดเดียว
       * ไม่มีนัด → รอคลินิกนัดตามแผน + อัปเดตอาการหลังนวด */}
      <Tile
        style={{ gap: space[3] }}
        onPress={hasNext ? onOpen : undefined}
        accessibilityLabel={hasNext ? `นัดครั้งที่ ${nextNo} ${ap.today ? `วันนี้ ${ap.time} คิว ${ap.queue}` : `${ap.date} ${ap.time}`} ดูรายละเอียด` : `ครั้งที่ ${nextNo} ยังไม่มีนัด`}
      >
        <TileTitle title={finished ? 'ครบคอร์สแล้ว' : hasNext ? `นัดครั้งที่ ${nextNo}` : `ครั้งที่ ${nextNo}`} meta={hasNext ? clinic : cancelledAppts.includes(tcase.id) ? 'คลินิกยกเลิกนัด' : finished ? undefined : 'รอคลินิกนัดตามแผน'} />
        {hasNext ? (
          <>
            {/* เวลา (ซ้าย) · คิว/วันที่ (ขวา) */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
              <View>
                <Text variant="bodyXs" tone="secondary">
                  {ap.today ? 'วันนี้' : 'เวลา'}
                </Text>
                <Text variant="titleXl">{ap.time}</Text>
              </View>
              {ap.today ? (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="bodyXs" tone="secondary">
                    คิว
                  </Text>
                  <Text variant="titleXl" color={colors.brand.primary}>
                    {ap.queue ?? '–'}
                  </Text>
                </View>
              ) : (
                <DateBlock date={ap.date} />
              )}
            </View>
            {/* สิ่งที่ต้องทำก่อนครั้งนี้ */}
            <View style={{ gap: space[2] }}>
              <StepRow done={preDone} warn={today?.red} text={today ? (today.red ? `ปวด ${today.pain}/10 · ควรพบแพทย์ก่อนนวด` : `ประเมินแล้ว · ปวด ${today.pain}/10`) : 'ประเมินอาการก่อนนวด'} />
              <StepRow text={tc.prep.join(' · ')} />
            </View>
            {/* ยังไม่ประเมิน = ประเมิน (หลัก) · ประเมินแล้ว + วันนี้ = เช็กอิน (หลัก) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <Pressable accessibilityRole="button" accessibilityLabel={preDone ? 'ดูผลประเมินก่อนนวด' : 'ประเมินก่อนนวด'} onPress={onPreVisit} style={{ flex: 1 }}>
                <TilePill icon={preDone ? 'eye' : 'edit-3'} label={preDone ? 'ดูผลประเมิน' : 'ประเมิน'} dark={!preDone} />
              </Pressable>
              {ap.today ? (
                <>
                  <Pressable accessibilityRole="button" accessibilityLabel="เช็กอิน" onPress={onCheckIn} style={{ flex: 1 }}>
                    <TilePill icon="maximize" label="เช็กอิน" dark={preDone} />
                  </Pressable>
                  <NavIconButton clinic={clinic} />
                </>
              ) : (
                <Pressable accessibilityRole="button" accessibilityLabel="รายละเอียดนัด" onPress={onOpen} style={{ flex: 1 }}>
                  <TilePill icon="file-text" label="รายละเอียด" dark={false} />
                </Pressable>
              )}
            </View>
          </>
        ) : (
          <>
            {/* ยังไม่มีนัด: นวดครั้งล่าสุดแล้ว → คลินิกนัดครั้งถัดไปตามแผน (การประเมินมีแค่ก่อน/หลังนวด ไม่มีติดตามรายวัน) */}
            <StepRow done text={`นวดครั้งที่ ${tc.visits.length} แล้ว · ${last.date}`} />
            <StepRow text="คลินิกจะนัดครั้งถัดไป และแจ้งเตือนในแอป" />
          </>
        )}
      </Tile>

      {/* 3) ผลการรักษาที่ผ่านมา: คอร์สถึงไหน (ซ้าย) · ผลครั้งล่าสุด (ขวา) */}
      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: BENTO_GAP }}>
        <PlanTile width={halfW} plan={tc.plan} done={tc.course.done} total={tc.course.total} values={trendValues(tc)} onPress={onHistory} />
        <Pressable accessibilityRole="button" accessibilityLabel={`ผลครั้งที่ ${tc.visits.length} ปวด ${last.painBefore} เหลือ ${after} ดูรายละเอียดการรักษา`} onPress={onHistory}>
          <View pointerEvents={needPost ? 'box-none' : 'none'}>
            <PainScoreCard
              // หลัง = คะแนนที่ผู้ใช้ประเมินหลังนวด · ยังไม่ประเมิน = ว่าง (–)
              value={last.selfPain ?? last.painBefore}
              missing={last.selfPain === undefined}
              before={last.painBefore}
              stageLabel="หลังนวด"
              title={`ผลครั้งที่ ${tc.visits.length}`}
              strongTitle
              padding={TILE_PAD}
              subtitle={last.date}
              chart
              width={halfW}
              // ยังไม่ได้ประเมินหลังนวดครั้งนี้ → ปุ่มแทน pill เปอร์เซ็นต์ → แบบประเมินหลังนวด (วันนี้หรือย้อนหลังก็ได้)
              action={needPost ? { label: 'ประเมินหลังนวด', onPress: () => nav.navigate('PostAssessment', { caseId: tc.id }) } : undefined}
            />
          </View>
        </Pressable>
      </View>

      {/* 4) ระหว่างรอครั้งถัดไป: ท่าดูแลตัวเอง · บิล/ใบเสร็จ · ติดต่อคลินิก */}
      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: BENTO_GAP }}>
        <View style={{ width: halfW }}>
          <SelfCareTile groupId={tc.selfCare.groupId} title={tc.selfCare.title} done={tc.selfCare.doneToday} onPress={() => onSelfCare(tc.selfCare.groupId)} />
        </View>
        <View style={{ width: halfW, gap: BENTO_GAP }}>
          {bill ? (
            <Tile style={{ flex: 1, gap: space[2], justifyContent: 'space-between' }} onPress={() => nav.navigate('Bill', { id: bill.id })} accessibilityLabel={`${bill.status === 'pending' ? 'บิลรอชำระ' : 'ใบเสร็จ'} ${bill.total} บาท`}>
              <TileTitle title={bill.status === 'pending' ? 'รอชำระ' : 'ใบเสร็จล่าสุด'} />
              <View>
                <Text variant="titleSm" color={bill.status === 'pending' ? TINT.amber : undefined}>
                  {bill.total} บาท
                </Text>
                <Text variant="bodyXs" tone="secondary" numberOfLines={1}>
                  {bill.title.replace(/^.*(ครั้งที่ \d+)$/, '$1')} · {bill.date}
                </Text>
              </View>
            </Tile>
          ) : null}
          <Tile style={{ flex: 1, gap: space[1], justifyContent: 'space-between' }} onPress={() => callClinic(clinic)} accessibilityLabel={`โทรหา ${clinic}`}>
            <TileTitle title="ติดต่อคลินิก" />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
              <Icon name="phone" size="xs" color={colors.brand.primary} />
              <Text variant="bodyXs" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
                {clinicPhone(clinic)}
              </Text>
            </View>
          </Tile>
        </View>
      </View>
    </View>
  );
}

/**
 * ผลประเมินก่อนนวดครั้งถัดไป (ในแชท): วันนี้เป็นอย่างไร → ครั้งนี้จะรักษาอย่างไร
 * สถานะตามกฎเดียวกับเช็กอิน: ควรพบแพทย์ (red) / มีข้อควรระวัง / นวดได้ตามแผน
 */
function PreVisitResult({ tc, focus }: { tc: TreatmentCase; focus?: string }) {
  const { colors } = useTheme();
  const { caseToday } = useJourney();
  const t = caseToday[tc.id];
  if (!t) return null;
  // เกณฑ์/แผนชุดเดียวกับแบบฟอร์มประเมินก่อนนวด
  const sum = preVisitSummary(tc, t, focus);
  const last = { painAfter: sum.prevAfter };
  const diff = sum.diff;
  const status = { label: sum.label, icon: sum.status === 'red' ? ('alert-triangle' as const) : sum.status === 'caution' ? ('alert-circle' as const) : ('check-circle' as const), tone: sum.status === 'red' ? colors.status.danger : sum.status === 'caution' ? colors.status.warning : colors.status.success };
  const plan = sum.plan;
  return (
    <View style={{ alignSelf: 'stretch', gap: BENTO_GAP }}>
      <Tile style={{ gap: space[3] }}>
        <TileTitle title={`ก่อนนวดครั้งที่ ${tc.course.done + 1}`} meta={tc.appointment.date !== '-' ? `${tc.appointment.date} ${tc.appointment.time}` : undefined} />
        {/* สถานะ */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1], alignSelf: 'flex-start', paddingHorizontal: space[2], height: 26, borderRadius: radius.full, backgroundColor: status.tone.bg }}>
          <Icon name={status.icon} size="xs" color={status.tone.fg} />
          <Text variant="labelSm" color={status.tone.fg}>
            {status.label}
          </Text>
        </View>
        {/* วันนี้ เทียบหลังนวดครั้งก่อน */}
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyXs" tone="secondary">
              วันนี้ปวด
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
              <Text variant="titleXl" color={painColorOf(t.pain)}>
                {t.pain}
              </Text>
              <Text variant="labelSm" tone="secondary">
                /10
              </Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyXs" tone="secondary">
              หลังนวดครั้งก่อน
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
              <Text variant="titleXl">{last.painAfter}</Text>
              <Text variant="labelSm" tone="secondary">
                /10 {diff > 0 ? `· ปวดกลับมา +${diff}` : '· ผลยังคงอยู่'}
              </Text>
            </View>
          </View>
        </View>
        {/* อาการหลังนวด/ข้อห้ามใหม่ (แสดงเฉพาะที่มี) */}
        {(t.adverse && t.adverse !== 'ไม่มี') || (t.risk && t.risk !== 'ไม่มี') ? (
          <Text variant="bodySm" color={t.red ? colors.status.danger.fg : colors.status.warning.fg}>
            {[t.adverse && t.adverse !== 'ไม่มี' ? `หลังนวดครั้งก่อน${t.adverse}` : '', t.risk && t.risk !== 'ไม่มี' ? t.risk : ''].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
      </Tile>
      <Tile style={{ gap: space[2] }}>
        <TileTitle title={t.red ? 'ครั้งนี้' : 'ครั้งนี้จะได้รับ'} meta={t.red ? undefined : 'ผู้ให้บริการยืนยันหน้างาน'} />
        {plan.map((it) => (
          <StepRow key={it} text={it} done={!t.red} warn={t.red} />
        ))}
        {!t.red && tc.prep.length ? <StepRow text={`ก่อนมา: ${tc.prep.join(' · ')}`} /> : null}
      </Tile>
    </View>
  );
}

/** ค่าบนกราฟแนวโน้ม: ครั้งก่อน ๆ = หลังนวด · ครั้งล่าสุด = คะแนนที่ผู้ใช้ประเมินหลังนวด (ยังไม่ประเมิน = ยังไม่มีคะแนน) — ตรงกับการ์ด Pain Score */
/**
 * การ์ดแผนการรักษา (ใช้ทั้งก่อนและหลังนวดครั้งแรก): จำนวนครั้ง/ทั้งคอร์ส + กราฟแนวโน้มความปวด · รูปแบบนวดขวาบน
 * note = ข้อควรระวังจากผลประเมิน (ถ้ามี)
 */
function PlanTile({ width, plan, done, total, values, note, onPress }: { width: number; plan: string; done: number; total: number; values: (number | undefined)[]; note?: string; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Tile style={{ width, gap: space[2] }} onPress={onPress} accessibilityLabel={`แผนการรักษา ${done} จาก ${total} ครั้ง${onPress ? ' ดูรายละเอียดการรักษา' : ''}`}>
      {/* รูปแบบการรักษาชิดขวาบน · ที่ว่างแคบ → ตัด "นวด" นำหน้า (หัวการ์ดบอกอยู่แล้วว่าเป็นแผนการรักษา) */}
      <TileTitle title="แผนการรักษา" meta={plan.replace(/^นวด/, '')} />
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[1] }}>
        {/* ตัวเลขขนาดเดียวกับ Pain Score ข้าง ๆ (40) */}
        <Text variant="displayXl" style={{ fontSize: 40, lineHeight: 52 }}>
          {done}
        </Text>
        {/* "ครั้ง" มีสระ/วรรณยุกต์ซ้อน 2 ชั้นด้านบน → เผื่อ lineHeight ไม่ให้ ้ ถูกตัด */}
        <Text variant="titleXs" tone="secondary" style={{ lineHeight: 30 }}>
          /{total} ครั้ง
        </Text>
        <Text variant="bodyXs" tone="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>
          {total > done ? `· เหลือ ${total - done}` : '· ครบแล้ว'}
        </Text>
      </View>
      {note ? (
        <Text variant="caption" color={colors.status.warning.fg} numberOfLines={2} style={{ marginTop: -space[2] }}>
          {note}
        </Text>
      ) : null}
      {/* แนวโน้มความปวดหลังนวดทั้งคอร์ส: เต็มพื้นที่ที่เหลือ ชิดขอบซ้าย-ขวา-ล่าง · นวดแล้ว = สีตามระดับปวด · ยังไม่ถึง = เทา */}
      <View style={{ flex: 1, marginHorizontal: -TILE_PAD, marginBottom: -TILE_PAD, marginTop: -space[2] }}>
        <CourseTrend values={values} total={total} />
      </View>
    </Tile>
  );
}

const trendValues = (tc: TreatmentCase) => tc.visits.slice(0, tc.course.total).map((_, i) => afterOf(tc, i));

/** กราฟแนวโน้มความปวดย่อ (การ์ดแผนการรักษา): เส้น + พื้นไล่จางของครั้งที่นวดแล้ว · จุดเทาของครั้งที่ยังไม่ถึง (วางบนเส้นฐาน) */
function CourseTrend({ values, total }: { values: (number | undefined)[]; total: number }) {
  const { colors } = useTheme();
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const { w } = size;
  const H = size.h;
  // แกน Y (0 · 5 · 10) ชิดซ้ายตรงขอบเนื้อหาการ์ด · จุดเริ่มหลังตัวเลขแกน · ล่างเว้นให้จุดเทาไม่ชนขอบการ์ด
  const PAD = TILE_PAD;
  const AXIS = 16;
  const L = PAD + AXIS;
  const T = 8;
  const B = 12;
  const x = (i: number) => L + 6 + (total > 1 ? (i * (w - L - 6 - PAD)) / (total - 1) : (w - L - 6 - PAD) / 2);
  const y = (v: number) => T + ((10 - v) / 10) * (H - T - B);
  // เส้นเฉพาะครั้งที่มีคะแนน (ต่อเนื่องจากครั้งแรก)
  const n = values.findIndex((v) => v === undefined);
  const scored = (n === -1 ? values : values.slice(0, n)) as number[];
  const pts = scored.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const area = scored.length > 1 ? `M${x(0)},${y(0)} L${scored.map((v, i) => `${x(i)},${y(v)}`).join(' L')} L${x(scored.length - 1)},${y(0)} Z` : '';
  return (
    <View onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} style={{ flex: 1, minHeight: 56 }}>
      {w > 0 && H > 0 ? (
        <Svg width={w} height={H}>
          <Defs>
            <LinearGradient id="ct" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.brand.primary} stopOpacity={0.24} />
              <Stop offset="1" stopColor={colors.brand.primary} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>
          {/* แกน Y: เส้นประ + ตัวเลข 0 · 5 · 10 (แบบกราฟในหน้ารายละเอียด) */}
          {[0, 5, 10].map((g) => (
            <React.Fragment key={g}>
              <Line x1={L} x2={w - PAD} y1={y(g)} y2={y(g)} stroke={colors.border.subtle} strokeDasharray="3 4" />
              <SvgText fontFamily={fontFamily.medium} x={PAD} y={y(g) + 3.5} fontSize={10} fill={colors.text.tertiary}>
                {g}
              </SvgText>
            </React.Fragment>
          ))}
          {area ? <Path d={area} fill="url(#ct)" /> : null}
          {scored.length > 1 ? <Polyline points={pts} fill="none" stroke={colors.brand.primary} strokeWidth={2.5} strokeLinejoin="round" /> : null}
          {Array.from({ length: total }, (_, i) => {
            const v = values[i];
            // นวดแล้วแต่ยังไม่ประเมิน = วงเทาโปร่งบนเส้นฐาน · ยังไม่ถึง = จุดเทา
            if (i < values.length && v === undefined) return <Circle key={i} cx={x(i)} cy={y(0)} r={4} fill="#FFFFFF" stroke={colors.border.default} strokeWidth={2.5} />;
            return v !== undefined ? (
              <Circle key={i} cx={x(i)} cy={y(v)} r={5} fill="#FFFFFF" stroke={painColorOf(v)} strokeWidth={3} />
            ) : (
              <Circle key={i} cx={x(i)} cy={y(0)} r={4} fill={colors.border.default} />
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}

/**
 * หน้าแรกผู้ใช้ใหม่ (ยังไม่มีข้อมูล): ลูกแก้ว AI + แสงออโรร่าหมุนรอบ · ข้อความชวน · ปุ่มดำ · สิ่งที่ AI ช่วยได้
 * แตะลูกแก้วหรือปุ่ม = เริ่มคุยกับ ThaiWell AI · ขนาดลูกแก้วปรับตามพื้นที่ (จอเล็กไม่ล้น)
 */
function WelcomeHero({ height, onPress }: { height: number; onPress: () => void }) {
  const { colors } = useTheme();
  const orb = Math.round(Math.max(72, Math.min(120, height - 270)));
  // แสงออโรร่า 2 ชั้น หมุนสวนทางกันคนละความเร็ว → แสงฟุ้งเปลี่ยนรูปตลอด ไม่ซ้ำจังหวะ
  const spin = React.useRef([new Animated.Value(0), new Animated.Value(0)]).current;
  React.useEffect(() => {
    const loops = spin.map((v, i) => Animated.loop(Animated.timing(v, { toValue: 1, duration: i === 0 ? 9000 : 14000, easing: Easing.linear, useNativeDriver: true })));
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [spin]);
  const halo = Math.round(orb * 2);
  const features: { icon: React.ComponentProps<typeof Icon>['name']; text: string }[] = [
    { icon: 'activity', text: 'ประเมินอาการ' },
    { icon: 'heart', text: 'ท่ายืดแนะนำ' },
    { icon: 'map-pin', text: 'คลินิกใกล้คุณ' },
  ];
  return (
    <View style={{ alignItems: 'center', gap: space[4], paddingHorizontal: space[5] }}>
      <Pressable accessibilityRole="button" accessibilityLabel="ThaiWell AI" onPress={onPress} style={({ pressed }) => ({ width: orb, height: orb, alignItems: 'center', justifyContent: 'center', marginBottom: space[3], transform: [{ scale: pressed ? 0.96 : 1 }] })}>
        {/* แสงออโรร่าหลังลูกแก้ว: ก้อนแสงสีชุด AI ขอบจาง (radial) วางเยื้องศูนย์ แล้วหมุนช้า ๆ */}
        {spin.map((v, layer) => (
          <Animated.View
            key={layer}
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: halo,
              height: halo,
              opacity: layer === 0 ? 0.9 : 0.7,
              transform: [{ rotate: v.interpolate({ inputRange: [0, 1], outputRange: layer === 0 ? ['0deg', '360deg'] : ['360deg', '0deg'] }) }],
            }}
          >
            <Svg width={halo} height={halo}>
              <Defs>
                {AI_GRAD.map((c, i) => (
                  <RadialGradient key={c} id={`au${layer}${i}`} cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor={c} stopOpacity={0.55} />
                    <Stop offset="1" stopColor={c} stopOpacity={0} />
                  </RadialGradient>
                ))}
              </Defs>
              {AI_GRAD.map((c, i) => {
                // ก้อนแสงรอบศูนย์กลาง ชั้นที่สองเหลื่อมมุม 45° · รัศมีพอให้ล้นขอบลูกแก้วเป็นแสงฟุ้ง
                const a = ((i * 90 + layer * 45) * Math.PI) / 180;
                const d = halo * 0.14;
                return <Circle key={c} cx={halo / 2 + Math.cos(a) * d} cy={halo / 2 + Math.sin(a) * d} r={halo * 0.34} fill={`url(#au${layer}${i})`} />;
              })}
            </Svg>
          </Animated.View>
        ))}
        <View style={{ borderRadius: orb / 2, shadowColor: '#8B6BFF', shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 8 }}>
          <AIBall size={orb} />
        </View>
      </Pressable>
      <View style={{ alignItems: 'center', gap: space[1] }}>
        <Text variant="headlineSm" align="center">
          ปวดเมื่อยตรงไหน ให้ AI ช่วยดู
        </Text>
        <Text variant="bodyBase" tone="secondary" align="center">
          ตอบไม่กี่ข้อ รู้ว่าควรนวดแบบไหน
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="เริ่มคุยกับ ThaiWell AI" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
        <View style={{ height: 48, paddingHorizontal: space[6], borderRadius: radius.full, backgroundColor: colors.text.primary, flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Icon name="message-circle" size="sm" color={colors.text.inverse} />
          <Text variant="labelMd" color={colors.text.inverse} style={{ transform: [{ translateY: 1 }] }}>
            เริ่มคุยกับ ThaiWell AI
          </Text>
        </View>
      </Pressable>
      {/* สิ่งที่ AI ช่วยได้ */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
        {features.map((f) => (
          <View key={f.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name={f.icon} size="xs" color={colors.brand.primary} />
            <Text variant="bodyXs" tone="secondary" style={{ transform: [{ translateY: 1 }] }}>
              {f.text}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * ปุ่ม ThaiWell AI — พื้นพาสเทลอ่อน + ขอบบางไล่สีชุดเดียวกับลูกแก้ว AI · ตัวอักษรเข้ม · เงาม่วงจาง
 * แสงวิ่งผ่านเบา ๆ ทุก 4 วินาที · สูง 38 เท่าแท็บที่เลือก
 */
const AI_GRAD = ['#2FD39A', '#3AA8FF', '#8B6BFF', '#E45BD1'];
const AI_PASTEL = ['#E6FAF2', '#E8F3FF', '#EFEAFF', '#FBEAF7'];
function AIButton({ label, onPress }: { label: string; onPress?: () => void }) {
  const { colors } = useTheme();
  const [w, setW] = React.useState(0);
  const H = 38;
  const sweep = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(3000),
        Animated.timing(sweep, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: H / 2,
        shadowColor: '#8B6BFF',
        shadowOpacity: 0.2,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: H, borderRadius: H / 2, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: space[2], paddingLeft: 4, paddingRight: space[3] + 2 }}>
        {w > 0 ? (
          <Svg width={w} height={H} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="aiFill" x1="0" y1="0" x2="1" y2="0">
                {AI_PASTEL.map((c, i) => (
                  <Stop key={c} offset={i / (AI_PASTEL.length - 1)} stopColor={c} />
                ))}
              </LinearGradient>
              <LinearGradient id="aiStroke" x1="0" y1="0" x2="1" y2="0.6">
                {AI_GRAD.map((c, i) => (
                  <Stop key={c} offset={i / (AI_GRAD.length - 1)} stopColor={c} />
                ))}
              </LinearGradient>
            </Defs>
            <Rect x={0.75} y={0.75} width={w - 1.5} height={H - 1.5} rx={(H - 1.5) / 2} fill="url(#aiFill)" stroke="url(#aiStroke)" strokeWidth={1.5} />
          </Svg>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: AI_PASTEL[1] }]} />
        )}
        {/* แสงวิ่งผ่าน (เบา) */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -6,
            bottom: -6,
            width: 26,
            backgroundColor: 'rgba(255,255,255,0.7)',
            transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-40, Math.max(40, w + 20)] }) }, { rotate: '20deg' }],
          }}
        />
        <AIBall size={30} />
        <Text variant="labelMd" color={colors.text.primary} style={{ fontFamily: fontFamily.semibold, transform: [{ translateY: 1 }] }}>
          ThaiWell AI
        </Text>
      </View>
    </Pressable>
  );
}

/** หัวการ์ดในหน้าแรก — รูปแบบเดียวกันทุกการ์ด: หัวข้อตัวหนา (labelMd) ซ้าย · ข้อมูลประกอบตัวเล็กขวา */
function TileTitle({ title, meta }: { title: string; meta?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space[1] }}>
      <Text variant="labelMd" numberOfLines={1} style={{ flexShrink: 0 }}>
        {title}
      </Text>
      {meta ? (
        <Text variant="bodyXs" tone="tertiary" numberOfLines={1} style={{ flexShrink: 1, textAlign: 'right' }}>
          {meta}
        </Text>
      ) : null}
    </View>
  );
}

/** แถวสิ่งที่ต้องทำก่อนนวด: ทำแล้ว = ✓ สีแบรนด์ · ยัง = วงกลม · ต้องระวัง = สีแดง */
function StepRow({ text, done, warn }: { text: string; done?: boolean; warn?: boolean }) {
  const { colors } = useTheme();
  const c = warn ? colors.status.danger.fg : done ? colors.brand.primary : colors.text.tertiary;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
      <Icon name={warn ? 'alert-triangle' : done ? 'check-circle' : 'circle'} size="xs" color={c} />
      <Text variant="bodySm" style={{ flex: 1 }} color={warn ? c : undefined} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

/**
 * ติดตามผลบนหุ่น (Figma 133:1951 + เส้น 133:1963): ป้ายชิดขวา + เส้นชี้ไปบริเวณที่รักษาครั้งล่าสุด
 * ไม่ใช่แค่ป้ายบอกตำแหน่ง — ถามต่อว่าบริเวณนี้เป็นอย่างไร แล้วทำต่อได้ทันที:
 * - "ยังปวด" → เริ่มประเมินโดยกรอกอาการบริเวณนี้ให้แล้ว
 * - "ดีขึ้นแล้ว" → บันทึกผลติดตาม + แนะนำท่ายืดป้องกันกลับมาปวด
 */
const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
const CALLOUT_W = 148;
/** ความสูง label 2 บรรทัด (labelSm lineHeight × 2) — ใช้กำหนดความสูงตัวเลขคะแนน */
const LABEL2_H = typeScale.labelSm.lineHeight * 2;
/** ตัวเลขคะแนน: ขนาดที่ความสูงตัวเลขจริงเท่ากับ LABEL2_H · lineHeight เผื่อพอไม่ให้ iOS ตัด */
const SCORE_FONT = 28;
/** แถบคะแนน: ความสูงพื้นที่แตะ · ขีดคะแนนก่อนนวดอยู่กึ่งกลางแนวตั้งของแถบ (ยื่นบน-ล่างเท่ากัน) */
const BAR_AREA_H = 24;
const TICK_H = 18;
const SCORE_LINE = 42;

/** สีตามระดับปวด 0–10 (เขียว → เหลือง → แดง) */
function painColorOf(v: number) {
  const mix = (x: string, y: string, k: number) => {
    const a = [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
    const b = [1, 3, 5].map((i) => parseInt(y.slice(i, i + 2), 16));
    return '#' + a.map((c, i) => Math.round(c + (b[i] - c) * k).toString(16).padStart(2, '0')).join('');
  };
  const t = Math.max(0, Math.min(1, v / 10));
  return t < 0.5 ? mix(palette.pain.low, palette.pain.mid, t / 0.5) : mix(palette.pain.mid, palette.pain.high, (t - 0.5) / 0.5);
}

/**
 * ป้ายให้คะแนนทีละจุดในโหมด focus — เส้นวิ่งออกจาก mark → ป้ายโผล่ → ให้คะแนน → ถัดไป (ป้ายหาย เส้นหดกลับ แล้วไปจุดใหม่)
 * จุดสุดท้าย: ส่งผลทุกจุดที่ให้คะแนนไปหลังบ้านทีเดียว → สรุปผล
 * - แถบมีขีดบอกคะแนนก่อนนวด · ไม่ตั้งค่าเริ่มต้น · ต้องให้คะแนนครบทุกจุด (ข้ามไม่ได้)
 */
function StepCallout({
  point,
  top,
  right,
  session,
  area,
  score: committed,
  onScore,
  isLast,
  canSubmit,
  onNext,
  onSubmit,
  result,
  onAssess,
  closeRequest,
  onClose,
}: {
  point: { x: number; y: number };
  top: number;
  right: number;
  session: PendingSession;
  area: FollowUpArea;
  score: number | undefined;
  onScore: (v: number) => void;
  isLast: boolean;
  /** มีอย่างน้อย 1 จุดที่ให้คะแนนแล้ว (ทุกครั้งการรักษา) */
  canSubmit: boolean;
  onNext: () => void;
  onSubmit: () => Promise<void>;
  result: { reviewArea?: FollowUpArea } | null;
  onAssess: (a: FollowUpArea) => void;
  /** เปลี่ยนค่า = ขอปิด (ออกจากโหมด focus) */
  closeRequest: number;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { width: winW, height: winH } = useWindowDimensions();
  const [status, setStatus] = React.useState<'idle' | 'sending' | 'error'>('idle');

  /* ระหว่างลาก: อัปเดตเฉพาะแถบ/ตัวเลขในป้าย (draft) · ปล่อยนิ้วแล้วจึงยืนยันให้สีบนหุ่นเปลี่ยน */
  const [draft, setDraft] = React.useState<number | null>(null);
  const score: number | null = draft ?? committed ?? null;
  const draftRef = React.useRef(draft);
  draftRef.current = draft;

  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const chipLeft = winW - right - size.w;
  // ป้ายอยู่ใต้จุดลงมาเล็กน้อย (ไม่บังสีบนหุ่น) · เส้น: จุด → แนวนอนถึงกึ่งกลางป้าย → ลงตรงจบที่ขอบบนป้าย
  const [boxTop] = React.useState(() => Math.max(top, point.y + space[8]));
  const cardMidX = chipLeft + size.w / 2;
  const lineLen = Math.max(0, boxTop - point.y) + Math.abs(cardMidX - point.x);
  const draw = React.useRef(new Animated.Value(0)).current;
  const cardIn = React.useRef(new Animated.Value(0)).current;
  const sizeReady = size.w > 0;
  React.useEffect(() => {
    if (!sizeReady) return; // รอรู้ขนาดป้ายก่อน (ตำแหน่งปลายเส้น)
    Animated.timing(draw, { toValue: 1, duration: 460, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: false }).start(({ finished }) => {
      if (finished) Animated.spring(cardIn, { toValue: 1, stiffness: 260, damping: 22, mass: 0.9, useNativeDriver: true }).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizeReady]);
  /** ป้ายหายก่อน แล้วเส้นหดกลับเข้า mark → then */
  const leaving = React.useRef(false);
  const leave = (then: () => void) => {
    if (leaving.current) return;
    leaving.current = true;
    Animated.timing(cardIn, { toValue: 0, duration: 160, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
      Animated.timing(draw, { toValue: 0, duration: 260, easing: Easing.bezier(0.4, 0, 1, 1), useNativeDriver: false }).start(() => then());
    });
  };
  const firstCloseReq = React.useRef(closeRequest);
  React.useEffect(() => {
    if (closeRequest !== firstCloseReq.current) leave(onClose);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeRequest]);

  // แถบคะแนน: แตะ/ลากเลือก 0–10
  const barW = CALLOUT_W - space[3] * 2;
  const pick = (x: number) => setDraft(Math.round(Math.max(0, Math.min(1, x / barW)) * 10));
  const commit = () => {
    const v = draftRef.current;
    if (v !== null && v !== committed) onScore(v);
  };
  const submit = async () => {
    setStatus('sending');
    try {
      await onSubmit();
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  };
  const done = !!result;

  return (
    <>
      {sizeReady ? (
        // iOS: pointerEvents ของ Svg เองไม่กันการแตะ → ครอบด้วย View ที่ไม่รับแตะ
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width={winW} height={winH} style={{ position: 'absolute', left: 0, top: 0 }}>
            <AnimatedPolyline
              points={`${point.x},${point.y} ${cardMidX},${point.y} ${cardMidX},${boxTop}`}
              fill="none"
              stroke={colors.text.primary}
              strokeWidth={1}
              strokeDasharray={[lineLen, lineLen]}
              strokeDashoffset={draw.interpolate({ inputRange: [0, 1], outputRange: [lineLen, 0] })}
            />
          </Svg>
        </View>
      ) : null}
      <Animated.View
        onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        style={{
          opacity: cardIn,
          transform: [
            { translateY: cardIn.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) },
            { scale: cardIn.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
          ],
          position: 'absolute',
          top: boxTop,
          right,
          width: CALLOUT_W,
          gap: space[1] + 2,
          padding: space[3],
          borderRadius: radius.lg,
          backgroundColor: componentTokens.statCard.bg,
          borderWidth: 1,
          borderColor: componentTokens.statCard.border,
        }}
      >
        <Text variant="caption" tone="secondary">
          รักษา {session.date}
        </Text>
        <Text variant="titleSm">{area.label}</Text>

        <View style={{ gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text variant="labelSm">หลังนวด</Text>
              <Text variant="labelSm">ปวดเท่าไหร่?</Text>
            </View>
            {score === null ? (
              <View style={{ height: LABEL2_H, justifyContent: 'center' }}>
                <Text variant="titleMd" tone="tertiary">
                  –
                </Text>
              </View>
            ) : (
              // กล่องสูงเท่า label 2 บรรทัด · ตัวเลขใช้ lineHeight เต็ม (ฟอนต์ไทยเผื่อที่บน-ล่างมาก) แล้วดึงขอบเข้า → ไม่ถูกตัด
              <View style={{ height: LABEL2_H, justifyContent: 'center', overflow: 'visible' }}>
                <Text
                  variant="displayMd"
                  color={painColorOf(score)}
                  style={{ fontSize: SCORE_FONT, lineHeight: SCORE_LINE, marginVertical: -(SCORE_LINE - LABEL2_H) / 2 }}
                >
                  {score}
                </Text>
              </View>
            )}
          </View>
          {/* แถบสีเขียว→แดง แตะหรือลากเพื่อให้คะแนน */}
          <View
            accessibilityRole="adjustable"
            accessibilityLabel={`คะแนนความปวดตอนนี้ ${area.label}`}
            accessibilityValue={{ min: 0, max: 10, now: score ?? 0 }}
            onStartShouldSetResponder={() => !done && status !== 'sending'}
            onMoveShouldSetResponder={() => !done && status !== 'sending'}
            onResponderTerminationRequest={() => false}
            onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
            onResponderMove={(e) => pick(e.nativeEvent.locationX)}
            onResponderRelease={commit}
            onResponderTerminate={commit}
            style={{ height: BAR_AREA_H, justifyContent: 'center', opacity: done ? 0.5 : 1 }}
          >
            <Svg width={barW} height={10} pointerEvents="none">
              <Defs>
                <LinearGradient id="areaPain" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={palette.pain.low} />
                  <Stop offset="0.5" stopColor={palette.pain.mid} />
                  <Stop offset="1" stopColor={palette.pain.high} />
                </LinearGradient>
              </Defs>
              <Rect x={0} y={0} width={barW} height={10} rx={5} fill="url(#areaPain)" />
            </Svg>
            {/* ตำแหน่งคะแนนก่อนนวด (ขีดอ้างอิง) */}
            <View pointerEvents="none" style={{ position: 'absolute', left: (area.before / 10) * barW - 1, top: (BAR_AREA_H - TICK_H) / 2, width: 2, height: TICK_H, borderRadius: 1, backgroundColor: colors.text.tertiary }} />
            {score !== null ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: (score / 10) * barW - 9,
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: painColorOf(score),
                  borderWidth: 3,
                  borderColor: colors.surface.default,
                }}
              />
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="caption" tone="tertiary">
              0
            </Text>
            <Text variant="caption" tone="tertiary">
              10
            </Text>
          </View>
        </View>

        {done ? (
          // ส่งแล้ว: สรุป + ถ้ามีจุดที่ไม่ดีขึ้น ชวนประเมินเพิ่ม
          <View style={{ gap: space[2] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
              <Icon name="check-circle" size="xs" color={colors.brand.primary} />
              <Text variant="labelSm" color={colors.brand.primary}>
                ส่งแล้ว
              </Text>
            </View>
            {result?.reviewArea ? <SmallButton label="ประเมินอาการเพิ่ม" onPress={() => onAssess(result.reviewArea as FollowUpArea)} dark /> : null}
            <SmallButton label="เสร็จสิ้น" onPress={() => leave(onClose)} dark={!result?.reviewArea} />
          </View>
        ) : (
          <View style={{ gap: space[1] }}>
            {isLast ? (
              <SmallButton label={status === 'sending' ? 'กำลังส่ง…' : 'ส่งผลทั้งหมด'} onPress={submit} dark disabled={!canSubmit || score === null || status === 'sending'} />
            ) : (
              // ต้องให้คะแนนทุกจุด — ยังไม่เลือกคะแนน = ปุ่มกดไม่ได้ (ข้ามไม่ได้)
              <SmallButton label="ถัดไป" onPress={() => leave(onNext)} dark disabled={score === null} />
            )}
            {status === 'error' ? (
              <Text variant="caption" color={colors.status.danger.fg}>
                ส่งไม่สำเร็จ ลองอีกครั้ง
              </Text>
            ) : null}
          </View>
        )}
      </Animated.View>
    </>
  );
}

/** ปุ่มแคปซูลเล็กในป้ายบนหุ่น */
function SmallButton({ label, onPress, dark, disabled }: { label: string; onPress: () => void; dark?: boolean; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 32,
        paddingHorizontal: space[2],
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: dark ? colors.text.primary : colors.surface.default,
        borderWidth: dark ? 0 : 1,
        borderColor: colors.border.subtle,
        opacity: disabled ? 0.6 : pressed ? 0.85 : 1,
      })}
    >
      <Text variant="labelSm" numberOfLines={1} color={dark ? colors.text.inverse : colors.text.primary}>
        {label}
      </Text>
    </Pressable>
  );
}

/** ปุ่มไอคอนกลมข้างหัวข้อแชท (hit area 44) */
function HeaderAction({ icon, label, onPress, badge }: { icon: React.ComponentProps<typeof Icon>['name']; label: string; onPress: () => void; /** จำนวนรายการใหม่ (> 0 = จุดแดงมุมขวาบน) */ badge?: number }) {
  const { colors } = useTheme();
  const size = componentTokens.homeHeader.bell;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: radius.full,
        backgroundColor: colors.surface.default,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon name={icon} size="sm" color={colors.text.primary} />
      {badge ? (
        // จำนวนใหม่: วงสีแดงของแอป (TINT.red) ขอบสีพื้น ตัวเลขหนา — ไม่ใช้แดงเข้มของระบบ
        <View style={{ position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: TINT.red, borderWidth: 2, borderColor: colors.surface.canvas }}>
          <Text color="#FFFFFF" style={{ fontFamily: fontFamily.semibold, fontSize: 10, lineHeight: 13 }}>
            {badge > 9 ? '9+' : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}


/** แผ่นประวัติแชท — เลื่อนขึ้นจากล่าง อยู่บนหน้าแรกเดิม (ไม่เปลี่ยนหน้า) */
function ChatHistorySheet({
  open,
  sessions,
  activeId,
  onClose,
  onPick,
  onNew,
}: {
  open: boolean;
  sessions: ChatSession[];
  activeId: string;
  onClose: () => void;
  onPick: (id: string) => void;
  onNew: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const g = useGrid();
  const preview = (c: ChatSession) => [...c.items].reverse().find((m) => m.text && m.thinking !== 'working')?.text ?? '';
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityLabel="ปิด" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(17,24,39,0.32)' }} />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: '75%',
          alignSelf: 'center',
          width: '100%',
          maxWidth: g.maxContentWidth,
          backgroundColor: colors.surface.default,
          borderTopLeftRadius: componentTokens.dock.surfaceRadius,
          borderTopRightRadius: componentTokens.dock.surfaceRadius,
          paddingTop: space[2],
          paddingBottom: insets.bottom + space[4],
        }}
      >
        <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border.default }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[5], paddingVertical: space[3] }}>
          <Text variant="titleMd" accessibilityRole="header">
            ประวัติแชท
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onNew}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[1],
              minHeight: 36,
              paddingHorizontal: space[3],
              borderRadius: radius.full,
              backgroundColor: colors.brand.primary,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Icon name="edit" size="xs" color={colors.text.inverse} />
            <Text variant="labelSm" color={colors.text.inverse}>
              แชทใหม่
            </Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: space[3] }}>
          {sessions.map((c) => {
            const on = c.id === activeId;
            return (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => onPick(c.id)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space[3],
                  padding: space[3],
                  borderRadius: radius.lg,
                  backgroundColor: on ? colors.brand.subtle : pressed ? colors.surface.sunken : 'transparent',
                })}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: on ? colors.brand.primary : colors.surface.sunken,
                  }}
                >
                  <Icon name="message-circle" size="sm" color={on ? colors.text.inverse : colors.text.secondary} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                    <Text variant="labelMd" numberOfLines={1} style={{ flex: 1 }}>
                      {c.title}
                    </Text>
                    <Text variant="caption" tone="tertiary">
                      {on ? 'กำลังคุย' : c.date}
                    </Text>
                  </View>
                  <Text variant="bodyXs" tone="secondary" numberOfLines={1}>
                    {preview(c)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}
