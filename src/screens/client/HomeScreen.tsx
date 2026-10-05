import React from 'react';
import { Animated, Easing, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type PointerEvent } from 'react-native';
import { Gesture, GestureDetector, ScrollView as GHScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Polyline, Rect, Stop } from 'react-native-svg';
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
  ReplyChips,
  useDockHeight,
  useHideTabs,
  useTabAccessory,
  useTabFab,
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
} from '../../design-system';
import { useJourney, type DraftCase } from '../../state/JourneyContext';
import { askAI, extractAI, type AIMessage } from '../../services/aiService';
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
  FU_ADVERSE,
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
import { ELEMENT_INFO, birthElement, dominantElement } from '../../data/thaiMassageKnowledge';
import { PillButton, SourceTag, ThreadCardView } from './home/ThreadCards';

/** Figma: image 1 — 232×583 วางชิดขวา (แทนด้วยหุ่น 3D) */
/** สัดส่วนกว้าง:สูงของกรอบหุ่น (Figma 232:583) */
const BODY_ASPECT = 232 / 583;
/** ใช้พื้นที่ว่างแนวตั้งกี่ % (ปรับขนาดหุ่นที่ค่านี้) */
const BODY_FILL = 0.94;
/** ระยะเว้นเหนือกรอบหุ่น ให้ศีรษะไม่ชิดปุ่มประวัติ/แจ้งเตือนมุมขวาบน */
const BODY_TOP_CLEAR = space[8];
/** ส่วนของร่างกายที่แตะ → chip อาการที่มีอยู่แล้ว (ที่เหลือสร้าง chip ใหม่ "ปวด<ส่วน>") */
const REGION_CHIP: Record<string, string> = {
  neck: 'ปวดคอ',
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
const BENTO_START = 0.5;
/** ระยะในช่อง bento */
const TILE_PAD = space[4];
const BENTO_CASE_H = 40;
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

  /* ---------- แชท: เริ่มใหม่ในหน้าเดิม + ประวัติแชท ---------- */
  const [sessions, setSessions] = React.useState<ChatSession[]>([CURRENT_CHAT, ...CHAT_HISTORY]);
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
  const { newPatient, setNewPatient, account, careStage, setCareStage, setLastAssess, profile, setProfile, drafts, upsertDraft, setActiveDraftId, promoted, followUps } = useJourney();
  /** หัวข้อ "เรื่องเดิมหรืออาการใหม่" — ถามเฉพาะเมื่อมีใบอยู่แล้ว */
  /** ยังไม่มีข้อมูลอะไรเลย → หน้าแรกคือแชท (คำถามแนะนำ) · ไม่มีปุ่มออกจากแชท */
  const chatHome = newPatient && drafts.length === 0 && careStage === 'new';
  /** ใบการรักษา = ของคนไข้ตัวอย่าง + ใบที่เพิ่งเกิดจากใบร่าง (นวดครั้งแรกแล้ว) */
  const cases = React.useMemo(() => [...(newPatient ? [] : TREATMENT_CASES), ...promoted], [newPatient, promoted]);
  const allTopics = [...cases.map((c) => c.short), ...drafts.map((d) => d.title)];
  /** คนไข้ใหม่: ธาตุกำเนิดจากวันเกิดที่ลงทะเบียน (ยังไม่ได้ทำแบบประเมินธาตุปัจจุบัน) */
  const bornElement = account ? birthElement(account.birthDate) : null;
  /** pill ต่อจากชื่อ: ธาตุกำเนิด (คนไข้ใหม่) หรือธาตุจากแบบประเมิน */
  const tagElement = newPatient ? bornElement : topElement;
  const elementTag = tagElement ? `ธาตุ${tagElement}` : null;
  /* แท็บบนหน้าแรก = ใบการรักษา (คนไข้เดิม) + ใบร่างจากการประเมิน */
  const caseCount = cases.length;
  /* แท็บ = เรื่องที่ดูแลอยู่ (1 แท็บ = 1 เรื่อง = 1 แชท) + "ประเมินคัดกรองใหม่" ท้ายสุด
   * ปุ่มม่วงเปลี่ยนตามแท็บ: รักษา → ติดตามผลกับ AI · ประเมิน → ประเมินคัดกรองอีกครั้ง · ใหม่ → เริ่มประเมินคัดกรอง */
  const selDraft = caseIdx >= caseCount ? drafts[caseIdx - caseCount] ?? null : null;
  const selCase = caseIdx < caseCount;
  const tcase = cases[Math.min(caseIdx, cases.length - 1)] ?? TREATMENT_CASES[0];
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
  const fuStepInfo = fuSteps[Math.min(fuStep, fuSteps.length - 1)];
  const fuSession = fuSessions[fuStepInfo.si];
  const fuActive = fuSession.areas[fuStepInfo.ai];
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
  React.useEffect(() => {
    if (!chatHome || started) return;
    const w = welcomeSession();
    setSessions((all) => [w, ...all]);
    setActiveId(w.id);
    setStarted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatHome]);
  const active = sessions.find((c) => c.id === activeId) ?? sessions[0];
  /** หุ่นซ่อนอยู่จนกว่าจะมีเรื่องเกี่ยวกับร่างกาย: แชทครั้งแรกที่ยังไม่เริ่มประเมิน (คุยเรื่องอื่น เช่น หาที่นวด/ธาตุ ก็ยังไม่มีหุ่น) */
  // (เฟรมแรกก่อนสลับไปแชทต้อนรับ active ยังเป็นแชทตัวอย่าง → นับว่าซ่อน ไม่ให้หุ่นกะพริบ)
  const bodyHidden = chatHome && (active.assess.step === 'idle' || active.id === CURRENT_CHAT.id);
  const bodyIn = React.useRef(new Animated.Value(bodyHidden ? 0 : 1)).current;
  React.useEffect(() => {
    Animated.timing(bodyIn, { toValue: bodyHidden ? 0 : 1, duration: 520, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }).start(() => bodyRef.current?.remeasure());
  }, [bodyHidden, bodyIn]);
  const sessionsRef = React.useRef(sessions);
  sessionsRef.current = sessions;
  const thread = active.items;
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
      if (anchors.length) bodyRef.current?.face(anchors.every(isBackPin) ? 'back' : 'front');
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
    if (first) bodyRef.current?.facePin(first);
  };
  const done = assess.step === 'done';
  // จุดกดบำบัดตามแนวทางล่าสุดในแชท (ตามตำแหน่งที่ปวดจริง)
  const guidePins = React.useMemo(() => {
    const g = [...thread].reverse().find((m) => m.card?.type === 'guideline')?.card;
    return g?.type === 'guideline' ? g.pins ?? [] : [];
  }, [thread]);
  const pins = React.useMemo(
    () => [
      ...Object.entries(sel)
        .filter(([, pts]) => pts === null)
        .flatMap(([c]) => (CHIP_PINS[c] ?? []).map((at) => ({ at, tone: 'symptom' as const }))),
      // จุดกดบำบัดขึ้นบนหุ่นหลังประเมินครบแล้วเท่านั้น
      // บริเวณที่ร้าวไป (อาการเดียวกัน แสดงต่อจากจุดที่ปวด)
      ...radiatePins(assess.radiate, radiateFor(Object.keys(sel))?.symptom).map((at) => ({ at, tone: 'symptom' as const })),
      ...(done ? guidePins.map((at) => ({ at, tone: 'point' as const })) : []),
      // หน้าเริ่มต้น: บริเวณที่รักษาครั้งล่าสุด
      // สีตามคะแนนปวดที่ผู้ใช้ให้ (ยังไม่ให้ = สีแบรนด์)
      // หน้าเริ่มต้น: ทุกบริเวณของครั้งที่กำลังติดตาม · สีตามคะแนนที่ให้ (ยังไม่ให้ = สีแบรนด์)
      // หน้าเริ่มต้น: mark ทุกบริเวณที่ค้างติดตาม (ทุกครั้งการรักษา) · สีตามคะแนนที่ให้ (ยังไม่ให้ = สีแบรนด์)
      // ใบร่าง: mark ตรงจุดที่บอกว่าปวด
      ...(!started && selDraft ? selDraft.symptoms.flatMap((c) => (CHIP_PINS[c] ?? []).map((at) => ({ at, tone: 'symptom' as const }))) : []),
      ...(!started && selCase
        ? tcase.areas.map((a) => {
            const v = fuSessions.map((ss) => fuScores[`${ss.id}:${a.pin}`]).find((x) => x !== undefined);
            return { at: a.pin, tone: 'point' as const, color: v === undefined ? undefined : painColorOf(v) };
          })
        : []),
    ],
    [sel, assess.radiate, done, guidePins, started, fuScores, tcase, fuSessions, newPatient, selDraft, selCase],
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
      // หน้าแรก: หุ่นดูอย่างเดียว · โหมด focus: แตะ mark = ข้ามไปจุดนั้น
      if (focus) onFocusTap(pageX, pageY);
      return;
    }
    if (assess.step !== 'symptoms' && assess.step !== 'related') return;
    const res = bodyRef.current?.pickAt(pageX, pageY);
    if (!res) return;
    const near = (a: BodyPoint, b: BodyPoint) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < componentTokens.body3d.pinRadius * 3;
    const hitLabel = Object.keys(sel).find((k) => (sel[k] ?? []).some((pt) => near(pt, res.point)));
    if (hitLabel) {
      const rest = (sel[hitLabel] ?? []).filter((pt) => !near(pt, res.point));
      setSel((cur) => {
        const out = { ...cur };
        if (rest.length) out[hitLabel] = rest;
        else delete out[hitLabel];
        return out;
      });
      if (!rest.length) setExtraSymptoms((ex) => ex.filter((e) => e !== hitLabel));
      return;
    }
    if (!res.region) return;
    const label = REGION_CHIP[res.region.key] ?? `ปวด${res.region.label}`;
    if (!HOME_CONTENT.symptoms.includes(label) && !HOME_CONTENT.related.includes(label)) {
      setExtraSymptoms((ex) => (ex.includes(label) ? ex : [...ex, label]));
    }
    setSel((cur) => ({ ...cur, [label]: [...(cur[label] ?? []), res.point] }));
    // แตะบนหุ่น = ตอบคำถามนั้นทันที เหมือนแตะ chip
    answerStep(label);
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
    const step = nextStep ?? ('done' as const);
    const after = { ...assess, ...patch, step };
    // functional update — ไม่ทับ sel ที่เพิ่งเลือกจาก chip/หุ่นในจังหวะเดียวกัน
    setAssess((a) => ({ ...a, ...patch, step }), sid);
    if (!nextStep) setBefore({ ...before, pain: after.pain });
    const withAppt = active.stage !== undefined;
    aiReply(sid, answer, () => {
      if (nextStep === 'radiate') return radiateOrNext(sid);
      if (nextStep) return [askItem(nextStep, 'รับทราบค่ะ')];
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
      const roHit = ro?.level ? [{ id: ro.level === 'red' ? 'RF-NERVE' : 'CA-NERVE', title: ro.note ?? ro.label, evidence: ro.label, source: ro.source ?? 'CPG หน้า 139' }] : [];
      const level = ev.level === 'red' || ro?.level === 'red' ? 'red' : ev.level === 'amber' || ro?.level === 'amber' ? 'amber' : 'green';
      const caution = amber ? SHORT_CAUTION[amber.ruleId] ?? amber.title : ro?.level === 'amber' ? ro.note : undefined;
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
      const topic = after.topic;
      const toCase = cases.find((c) => c.short === topic);
      if (toCase && !newPatient) {
        return [
          ...results,
          { id: `r-case-${Date.now()}`, day: 'today' as const, from: 'ai' as const, text: `บันทึกในใบ${toCase.short}แล้วค่ะ ผู้ให้บริการจะเห็นก่อนนวดครั้งถัดไป`, source: 'AI Interview' as const, time: results[0]?.time },
        ];
      }
      const old = drafts.find((d) => d.title === topic);
      const id = old?.id ?? `d${Date.now()}`;
      upsertDraft({
        id,
        title: sym.join(', ') || old?.title || 'อาการใหม่',
        symptoms: sym,
        pain: after.pain,
        prevPain: old?.pain,
        duration: after.duration,
        cause: after.cause,
        caution,
        red: level === 'red' || (rel.length > 0 && !rel.includes('ไม่มี')),
        stage: old?.stage ?? 'assessed',
        booking: old?.booking,
        chatId: sid,
        health: after.health,
        risk: after.risk,
        pressure: after.pressure,
        radiate: after.radiate,
      });
      setActiveDraftId(id);
      // หน้าแรกเปิดที่ใบนี้
      setCaseIdx(caseCount + (old ? drafts.indexOf(old) : drafts.length));
      return results;
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
  const [caseChats, setCaseChats] = React.useState<Record<string, string>>({});
  /** รักษา → ติดตามผลกับ AI: แชทของเรื่องนั้น (มีอยู่แล้วเปิดต่อ · ยังไม่มีสร้างพร้อมสรุปสั้น ๆ) */
  /**
   * ติดตามผลกับ AI — AI มีข้อมูลการรักษาของเรื่องนี้ครบ
   * ยังไม่ได้ให้ข้อมูลหลังรักษา → AI ถามบังคับก่อน (คะแนนปวดทุกจุด + อาการผิดปกติ) แล้ววิเคราะห์ ส่งให้ผู้ให้บริการ และบอกแผนต่อไป
   * ให้ข้อมูลครบแล้ว → สรุปผลแล้วถามว่าอยากทราบอะไร
   */
  const followCaseChat = () => {
    const id = caseChats[tcase.id] ?? tcase.chatId;
    if (id && sessions.some((c) => c.id === id)) return openChat(id);
    const last = tcase.visits[tcase.visits.length - 1];
    const sentAll = tcase.pending.every((ss) => followUps.some((f) => f.sessionId === ss.id));
    const ss = sentAll
      ? caseChatSession(`รักษา${tcase.short}`, `เรื่อง${tcase.short} รักษามาแล้ว ${tcase.visits.length} ครั้ง ล่าสุดปวด ${last.painBefore} → ${last.painAfter}`)
      : {
          ...caseChatSession(`รักษา${tcase.short}`, ''),
          items: [
            { id: `fu-intro-${Date.now()}`, day: 'today' as const, from: 'ai' as const, source: 'AI Interview' as const, time: nowTimeText(), text: `ก่อนอื่นขอติดตามผลหลังนวดครั้งล่าสุด (${last.date}) นะคะ` },
            fuAskItem(firstUnsent()),
          ].filter(Boolean) as ThreadItem[],
        };
    setSessions((all) => [ss, ...all]);
    setCaseChats((m) => ({ ...m, [tcase.id]: ss.id }));
    openChat(ss.id);
  };
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
      text: `${fuSessions.length > 1 ? `นวดวันที่ ${ss.date} ` : ''}อาการ${tcase.short}โดยรวมตอนนี้ปวดเท่าไหร่คะ? ก่อนนวด ${before}/10`,
      card: { type: 'fuAsk', sessionId: ss.id, pin: '', label: `อาการ${tcase.short}`, before },
    };
  };
  /** ตอบคะแนนจุดหนึ่ง → จุดถัดไป · ครบแล้ว → ถามอาการผิดปกติ (ใช้ทั้งแตะและพิมพ์ตอบ) */
  const fuScoreItems = (card: Extract<ThreadCard, { type: 'fuAsk' }>, v: number): ThreadItem[] => {
    // คะแนนโดยรวม → ใช้สีกับ mark ทุกบริเวณของครั้งนั้นบนหุ่นด้วย
    const ss = fuSessions.find((x) => x.id === card.sessionId);
    setFuScores((m) => ({ ...m, [`${card.sessionId}:overall`]: v, ...Object.fromEntries((ss?.areas ?? []).map((a) => [`${card.sessionId}:${a.pin}`, v])) }));
    const k = fuSessions.findIndex((x) => x.id === card.sessionId);
    const next = fuSessions.slice(k + 1).some((x) => !followUps.some((f) => f.sessionId === x.id)) ? fuAskItem(k + 1) : null;
    return next
      ? [next]
      : [{ id: `fu-adv-${Date.now()}`, day: 'today', from: 'ai', source: 'AI Interview', time: nowTimeText(), text: 'หลังนวดมีอาการผิดปกติไหมคะ?', card: { type: 'fuAdverse' } }];
  };
  const answerFuScore = (card: Extract<ThreadCard, { type: 'fuAsk' }>, v: number) => aiReply(activeId, `${card.label} ปวด ${v}/10`, () => fuScoreItems(card, v));
  const answerFuAdverse = (opt: string) => aiReplyAsync(activeId, opt === 'ไม่มี' ? 'ไม่มีอาการผิดปกติ' : opt, () => fuAdverseItems(opt));
  /** ครบแล้ว → วิเคราะห์ ส่งผลให้ผู้ให้บริการ และบอกแผนต่อไป */
  const fuAdverseItems = async (opt: string): Promise<ThreadItem[]> => {
    // ส่งเป็นคะแนนโดยรวมค่าเดียวต่อครั้งการรักษา
    const scored = fuSessions.map((ss) => ({
      ss,
      areas: fuScores[`${ss.id}:overall`] === undefined ? [] : [{ area: 'โดยรวม', painBefore: sessionBefore(ss), painAfter: fuScores[`${ss.id}:overall`] }],
    }));
    for (const { ss, areas } of scored) if (areas.length) await sendFollowUp({ sessionId: ss.id, sessionDate: ss.date, areas });
    const all = scored.flatMap((x) => x.areas);
    const before = all.reduce((n, a) => n + a.painBefore, 0) / Math.max(1, all.length);
    const after = all.reduce((n, a) => n + a.painAfter, 0) / Math.max(1, all.length);
    const pct = Math.round(((before - after) / Math.max(1, before)) * 100);
    const urgent = opt === 'ชา/อ่อนแรง' || all.some((a) => a.painAfter >= 8);
    const notBetter = opt === 'ปวดมากขึ้น' || all.some((a) => a.painAfter >= a.painBefore);
    const next = tcase.course.done < tcase.course.total ? `ครั้งที่ ${tcase.course.done + 1}/${tcase.course.total} ${tcase.appointment.date} ${tcase.appointment.time}` : '';
    const analysis: ThreadItem = urgent
      ? { id: `fu-r-${Date.now()}`, day: 'today', from: 'ai', source: 'Safety Rule Engine', time: nowTimeText(), text: 'มีอาการที่ควรให้แพทย์ตรวจก่อนนวดครั้งถัดไปค่ะ ส่งให้ผู้ให้บริการแล้ว', card: { type: 'action', label: 'ดูคำแนะนำ', to: 'RedFlag' } }
      : notBetter
        ? // ยังไม่ดีขึ้น → ถามว่าตรงไหนยังปวด (ให้ผู้ให้บริการเน้นครั้งหน้า)
          { id: `fu-r-${Date.now()}`, day: 'today', from: 'ai', source: 'AI Interview', time: nowTimeText(), text: 'อาการยังไม่ดีขึ้นค่ะ ตรงไหนยังปวดอยู่บ้างคะ? ผู้ให้บริการจะเน้นให้ครั้งหน้า', card: { type: 'fuWhere', options: [...tcase.areas.map((a) => a.label), 'ปวดเท่า ๆ กัน'] } }
        : { id: `fu-r-${Date.now()}`, day: 'today', from: 'ai', source: 'AI Interview', time: nowTimeText(), text: `ดีขึ้น ${pct}% ค่ะ ส่งผลให้ผู้ให้บริการแล้ว แนะนำนวดต่อตามแผน${next ? ` · ${next}` : ''}` };
    if (!urgent && notBetter) return [analysis];
    return [
      analysis,
      { id: `fu-q-${Date.now()}`, day: 'today', from: 'ai', source: 'AI Interview', time: nowTimeText(), text: 'อยากทราบอะไรเพิ่มคะ?', card: { type: 'intents', options: CASE_INTENTS } },
    ];
  };
  /** ตอบว่าตรงไหนยังปวด → ส่งให้ผู้ให้บริการ */
  const fuWhereItems = (where: string): ThreadItem[] => [
    {
      id: `fu-w-${Date.now()}`,
      day: 'today',
      from: 'ai',
      source: 'AI Interview',
      time: nowTimeText(),
      text: `ส่งให้ผู้ให้บริการแล้วค่ะ${where === 'ปวดเท่า ๆ กัน' ? '' : ` จะเน้น${where}ครั้งหน้า`} แนะนำประเมินอาการเพิ่มก่อนนัดถัดไป`,
      card: { type: 'action', label: 'ประเมินอาการ', to: 'assess' },
    },
  ];
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
    const missing = (['risk', 'pressure'] as const).find((k) => !assess[k]);
    answerStep('ยืนยันข้อมูลนี้', {}, undefined, missing ? ASSESS_ORDER[ASSESS_ORDER.indexOf(missing) - 1] : 'pressure');
  };
  const newChat = () => {
    setStarted(true);
    bodyRef.current?.face('front');
    const blank = active.title === 'แชทใหม่' && !active.items.some((m) => m.from === 'user') && (active.assess.step === 'topic') === askTopic;
    if (!blank) {
      const next = newChatSession(askTopic, currentTopic);
      setSessions((all) => [next, ...all]);
      setActiveId(next.id);
    }
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
    // แชทของเรื่องที่รักษาอยู่
    if (CASE_INTENTS.includes(label)) {
      const last = tcase.visits[tcase.visits.length - 1];
      if (label === CASE_INTENTS[0]) {
        setAssess((a) => ({ ...a, step: 'symptoms', topic: tcase.short }));
        return aiReply(activeId, label, () => [askItem('symptoms', 'ได้เลยค่ะ')]);
      }
      if (label === CASE_INTENTS[1])
        return aiReply(activeId, label, () => [
          { id: `h-${Date.now()}`, day: 'today', from: 'ai', source: 'AI Interview', time: nowTimeText(), text: `ประวัติการรักษา${tcase.short}ค่ะ`, card: { type: 'history', caseId: tcase.id } },
        ]);
      return reply(label, `นัดถัดไป ${tcase.appointment.date} ${tcase.appointment.time} ค่ะ`, { type: 'action', label: 'เลื่อนนัด', to: 'Booking' });
    }
    switch (INTENTS.indexOf(label)) {
      case 0:
        return startAssess(label);
      case 1:
        return reply(label, 'ใกล้คุณมีคลินิกแพทย์แผนไทย สาขาสุขุมวิท 1.2 กม. คิวว่างวันนี้ 13:00 และ 15:30 ค่ะ', { type: 'action', label: 'ดูสถานที่ทั้งหมด', to: 'Places' });
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
        ? nav.navigate('ClientTabs', { screen: 'Booking' })
        : to === 'History'
          ? nav.navigate('ClientTabs', { screen: 'History' })
          : to === 'Places'
          ? nav.navigate('ClientTabs', { screen: 'Places' })
          : to === 'RedFlag'
          ? nav.navigate('RedFlag')
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
  const freeAnswer = async (text: string): Promise<ThreadItem[]> => {
    const r = await extractAI<{ kind: 'personal' | 'knowledge' }>(
      'จำแนกคำถาม: personal = ถามเรื่องของผู้ใช้เอง (นัด ผลการรักษา ประวัติ คะแนนปวด ผู้ให้บริการ) · knowledge = ถามความรู้ (นวดไทย ข้อห้าม ข้อควรระวัง ประคบ อบ สมุนไพร ท่ายืด โรค/อาการตามแพทย์แผนไทย ธาตุ)',
      text,
      { type: 'object', properties: { kind: { type: 'string', enum: ['personal', 'knowledge'] } }, required: ['kind'] },
    ).catch(() => ({ kind: 'personal' as const }));
    return r.kind === 'knowledge' ? knowledgeReply(text) : [aiText(await askAI(text, aiContext(), aiHistory()))];
  };

  /** ข้อความ → ตำแหน่งที่ปวด (เลือกจากรายการทั้งร่างกาย · ซ้าย/ขวาตามที่ผู้ใช้บอก) */
  const SYMPTOM_PROMPT = `เลือกตำแหน่งที่ปวดที่ผู้ใช้พูดถึงจริงจาก: ${ALL_SYMPTOMS.join(', ')} · ถ้าบอกข้าง (ซ้าย/ขวา) ให้เลือกข้างนั้น ถ้าไม่บอกข้างและมีให้เลือกทั้งสองข้าง ให้เลือกทั้งสองข้าง · ใช้คำพ้องได้ เช่น บั้นเอว/หลังล่าง = ปวดเอว, ซี่โครง = ชายโครง, ก้น = สะโพก, ไหล่ (ไม่บอกข้าง) = ปวดไหล่, หลัง = ปวดหลัง · ห้ามเดา ไม่ตรงเลย = []`;
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
  const answerStepByText = async (st: Exclude<AssessStep, 'done' | 'idle' | 'review' | 'topic'>, text: string) => {
    const opts: Record<string, string[]> = { symptoms: [...new Set([...ALL_SYMPTOMS, ...symptomOptions])], related: [...HOME_CONTENT.related, 'ไม่มี'], duration: DURATION_OPTIONS, cause: CAUSE_OPTIONS, health: HEALTH_OPTIONS, risk: RISK_OPTIONS, pressure: PRESSURE_OPTIONS, radiate: radiateFor(Object.keys(assess.sel))?.options ?? ALL_RADIATE_OPTIONS };
    try {
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
    aiReply(activeId, text, () => [askItem(st, 'ขอโทษค่ะ ไม่แน่ใจคำตอบ')]);
  };

  /** หน้าทบทวนข้อมูลชุดเดิม: เล่าว่าอะไรเปลี่ยน → AI แก้ให้ */
  const editReviewByText = (text: string) => {
    setThread((t) => t.filter((m) => m.card?.type !== 'review'));
    aiReplyAsync(activeId, text, async () => {
      type Edit = { symptoms: string[] | null; radiate: string | null; pain: number | null; duration: string | null; cause: string | null; health: string | null; risk: string | null; pressure: string | null };
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
          },
          required: ['symptoms', 'radiate', 'pain', 'duration', 'cause', 'health', 'risk', 'pressure'],
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
  const routeByText = (text: string) =>
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
          return radiateOrNext(activeId, sym.items, `รับทราบค่ะ ${sym.items.join(', ')}`);
        }
        setAssess((a) => ({ ...a, step: 'symptoms' }));
        return [askItem('symptoms', 'ได้เลยค่ะ')];
      }
      if (r.intent === 'places') return [aiText('ใกล้คุณมีคลินิกที่ว่างวันนี้ค่ะ', { type: 'action', label: 'ดูสถานที่ทั้งหมด', to: 'Places' })];
      if (r.intent === 'element') return [aiText(await askAI(text, aiContext())), aiText('', { type: 'action', label: 'ดูธาตุปัจจุบัน', to: 'ElementQuiz' })];
      return freeAnswer(text);
    });

  const send = (text: string) => {
    const st = assess.step;
    // อาการฉุกเฉิน → เตือนทันที ไม่รอ AI (กฎตายตัว)
    if (EMERGENCY.test(text)) return reply(text, 'อาการนี้อาจเป็นภาวะฉุกเฉิน โทร 1669 หรือไปโรงพยาบาลทันทีค่ะ ยังไม่ควรนวด', { type: 'action', label: 'ดูคำแนะนำ', to: 'RedFlag' });
    // ติดตามผลหลังนวด: พิมพ์ตอบแทนการแตะ
    const lastCard = thread[thread.length - 1]?.card;
    if (lastCard?.type === 'fuAsk') return answerFuByText(lastCard, text);
    if (lastCard?.type === 'fuAdverse') return answerFuAdverseByText(text);
    if (lastCard?.type === 'fuWhere') return aiReply(activeId, text, () => fuWhereItems(text));
    if (st === 'topic') return answerTopicByText(text);
    if (st === 'idle') return routeByText(text);
    if (st === 'review') return editReviewByText(text);
    if (st !== 'done') return answerStepByText(st, text);
    // ประเมินเสร็จแล้ว / แชทของเรื่องที่รักษา → ถามอะไรก็ได้ AI ตอบจากข้อมูลของผู้ใช้
    // ประเมินครบแล้วพิมพ์ขอแผน → วางแผนการนวดจากข้อมูลแรกรับ
    if (st === 'done' && /แผน(การ)?(นวด|รักษา)/.test(text)) return requestPlan(text);
    aiReplyAsync(activeId, text, () => freeAnswer(text));
  };
  const dockH = useDockHeight();
  // คุยกับ AI (ไม่ใช่แชทหน้าแรกครั้งแรก) / ให้คะแนนบนหุ่น → ซ่อน tab menu ให้โฟกัส · ออกแล้วกลับมา
  useHideTabs((started && !chatHome) || focus);

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
  // ก่อนเริ่ม: ปุ่ม AI ม่วงไล่สี (ref: AI Receptionist "Call Now") เป็นปุ่มลอย (FAB) มุมขวาเหนือ tab menu
  useTabFab(
    !started ? (
      <Animated.View pointerEvents={focus ? 'none' : 'auto'} style={[{ flex: 1 }, focusOut]}>
        <GradientPill
          label=""
          accessibilityLabel={selCase ? 'ติดตามผลกับ AI' : selDraft ? 'ประเมินคัดกรองอีกครั้ง' : 'เริ่มประเมินคัดกรอง'}
          icon={selCase ? 'message-circle' : 'activity'}
          onPress={selCase ? followCaseChat : selDraft ? () => reassessDraft(selDraft) : newChat}
        />
      </Animated.View>
    ) : null,
    [started, focus, caseIdx, drafts, caseChats, sessions],
  );
  useTabAccessory(
    !started ? null : (
    <View style={{ width: '100%', maxWidth: g.maxContentWidth, alignSelf: 'center' }}>
    <Animated.View style={[{ gap: space[2] }, reveal]} pointerEvents={leaving ? 'none' : 'auto'}>
      {/* ชิดขอบจอทั้งสองข้าง: ตัวเลือกเลื่อนออกนอกจอได้ ไม่ถูกตัดที่ระยะขอบของ dock */}
      {/* คนที่ยังไม่มีข้อมูล: คำถามแนะนำอยู่ในแชทแล้ว → ไม่มีทางลัดของคนไข้เดิม (ผลก่อน–หลัง / เลื่อนนัด) */}
      {chatHome ? null : (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -componentTokens.dock.marginX }}
        contentContainerStyle={{ gap: space[2], paddingHorizontal: componentTokens.dock.marginX }}
      >
        <ReplyChips
          options={HOME_SNAPSHOT.suggestions}
          // ผลก่อน–หลัง = การ์ดผลการรักษาชุดเดียวกับหน้าแรก (ไม่ให้ AI เล่าเป็นข้อความ)
          onPick={(o) => (o === 'เล่าอาการใหม่' ? newChat() : o === 'ผลก่อน–หลัง' ? pickIntent(CASE_INTENTS[1]) : send(o))}
        />
      </ScrollView>
      )}
      <ChatComposer onSend={send} onVoice={openVoice} />
    </Animated.View>
      {/* ปุ่มเริ่มประเมิน "หด" เข้าไปเป็นลูกแก้วไมค์ในช่องแชท (และขยายกลับตอนออกจากแชท) */}
      {dockW > 0 ? (
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            position: 'absolute',
            left: 0,
            width: dockW,
            bottom: (componentTokens.composerV2.height - componentTokens.voice.cta) / 2,
            opacity: intro.interpolate({ inputRange: [0, 0.45, 0.7], outputRange: [1, 1, 0] }),
            transform: [
              // เริ่มจาก FAB (มุมขวา เหนือ tab menu) → เลื่อนลงแถวแชทแล้วหดไปเป็นลูกแก้วไมค์ทางซ้ายของช่องแชท
              { translateY: intro.interpolate({ inputRange: [0, 0.7], outputRange: [-(componentTokens.dock.height + space[3] + (componentTokens.dock.height - componentTokens.composerV2.height) / 2), 0], extrapolate: 'clamp' }) },
              { translateX: intro.interpolate({ inputRange: [0, 0.7], outputRange: [dockW / 2 - componentTokens.voice.cta / 2, orbX - dockW / 2], extrapolate: 'clamp' }) },
              { scaleX: intro.interpolate({ inputRange: [0, 0.7], outputRange: [componentTokens.voice.cta / dockW, orbD / dockW], extrapolate: 'clamp' }) },
              { scaleY: intro.interpolate({ inputRange: [0, 0.7], outputRange: [1, orbD / componentTokens.voice.cta], extrapolate: 'clamp' }) },
            ],
          }}
        >
          <GradientPill label="" onPress={() => {}} />
        </Animated.View>
      ) : null}
    </View>
    ),
    [g.maxContentWidth, activeId, active.title, active.items.length, started, leaving, dockW, focus, chatHome, caseIdx, drafts, caseChats, sessions],
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

  /* ---------- หน้าแรกแบบ bento: หุ่นใหญ่กลางจอเหมือนเดิม (ชั้นหลัง) · ช่องข้อมูลเรียงสองคอลัมน์ ----------
   * ซ้าย = ข้อมูลหลักเรียงตามความสำคัญ · ขวา = ปล่อยว่างส่วนบนให้เห็นหุ่นและ mark · ช่องประกอบชิดล่าง (ทับแค่ช่วงขา) */
  const bentoW = Math.min(winW, g.maxContentWidth) - space[5] * 2;
  /* bento เริ่มราวกลางจอ → ช่วงบนว่างให้เห็นหุ่นครึ่งบน (หัว ไหล่ ลำตัว) · ส่วนที่เหลือเลื่อนขึ้นมาดูได้ */
  const bentoGap = Math.max(0, Math.round(winH * BENTO_START) - headerBottom - space[4]);
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
      if (moved.current) bodyRef.current?.rotateTo(dx / 80);
    },
    onPointerUp: (e: PointerEvent) => {
      if (start.current && !moved.current) onBodyTap(e.nativeEvent.clientX, e.nativeEvent.clientY);
      start.current = null;
    },
    onPointerCancel: () => (start.current = null),
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
      .onUpdate((e) => bodyRef.current?.rotateTo(e.translationX / 80));
    const tap = Gesture.Tap()
      .runOnJS(true)
      .maxDistance(DRAG_SLOP)
      .onEnd((e, ok) => ok && onBodyTapRef.current(e.absoluteX, e.absoluteY));
    return Gesture.Race(pan, tap);
  }, []);

  const content = { width: '100%' as const, maxWidth: g.maxContentWidth, alignSelf: 'center' as const, paddingHorizontal: space[5] };

  return (
    <View ref={rootRef} style={{ flex: 1, backgroundColor: colors.surface.canvas }}>
      {/* ชั้นหลังสุด: หุ่น 3D ตรึงกับจอ · ยังไม่มีอะไรเกี่ยวกับร่างกาย (แชทครั้งแรก) = ซ่อน → เริ่มถามอาการแล้วค่อยเลื่อนเข้ามา */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { opacity: bodyIn, transform: [{ translateX: bodyIn.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) }] }]}
      >
      <Animated.View
        pointerEvents="none"
        style={{ position: 'absolute', top: introTop, left: (winW - introW) / 2, width: introW, height: introH, transform: bodyTransform }}
      >
        <Body3D ref={bodyRef} pins={pins} marks={marks} interactive={false} width={introW} height={introH} restAngle={started && !leaving ? REST_ANGLE : 0} />
      </Animated.View>
      </Animated.View>

      {/* ชั้นกลาง: เนื้อหาเลื่อนผ่านหน้าหุ่น · จางหายที่ขอบล่างของ header ด้วย mask (โปร่งจนเห็นหุ่น ไม่ใช่แผ่นทับ) */}
      <ScrollFadeMask clearUntil={maskClearUntil} ramp={FADE_TAIL}>
      <BodyScrollView
        ref={scrollRef as never}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: headerBottom, paddingBottom: dockH + space[4] + (started ? 0 : fabClear) }}
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
                {selDraft ? (
                  <DraftBento
                    width={bentoW}
                    draft={selDraft}
                    tabs={null}
                    onBook={() => {
                      setActiveDraftId(selDraft.id);
                      nav.navigate('ClientTabs', { screen: 'Booking' });
                    }}
                    onCheckIn={() => nav.navigate('CheckIn')}
                    onRedFlag={() => nav.navigate('RedFlag')}
                    onFollowUp={() => nav.navigate('FollowUp')}
                    onSelfCare={() => nav.navigate('SelfCare')}
                  />
                ) : caseIdx >= cases.length ? null : (
                <HomeBento
                  width={bentoW}
                  caseIdx={caseIdx}
                  tcase={tcase}
                  tabs={null}
                  onCheckIn={() => nav.navigate('CheckIn')}
                  onHistory={() => nav.navigate('ClientTabs', { screen: 'History' })}
                  onFollowUp={followCaseChat}
                  onSelfCare={() => nav.navigate('SelfCare')}
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
                  width={LEFT_COLUMN}
                  onJump={jumpTo}
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
                  {m.ask && m.ask === assess.step ? (
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
                      onOther={(l) => {
                        pickSymptoms([l]);
                        answerStep(l);
                      }}
                    />
                  ) : null}
                  {m.card?.type === 'history' ? (
                    <HistoryBento
                      tc={cases.find((c) => c.id === (m.card as Extract<ThreadCard, { type: 'history' }>).caseId) ?? tcase}
                      onAll={() => nav.navigate('ClientTabs', { screen: 'History' })}
                    />
                  ) : m.card?.type === 'fuAsk' ? (
                    // ตอบได้เฉพาะคำถามล่าสุด
                    i === thread.length - 1 ? <ReplyChips options={PAIN_CHIPS} onPick={(o) => answerFuScore(m.card as Extract<ThreadCard, { type: 'fuAsk' }>, Number(o))} /> : null
                  ) : m.card?.type === 'fuWhere' ? (
                    i === thread.length - 1 ? <ReplyChips options={m.card.options} onPick={answerFuWhere} /> : null
                  ) : m.card?.type === 'fuAdverse' ? (
                    i === thread.length - 1 ? <ReplyChips options={FU_ADVERSE} onPick={answerFuAdverse} /> : null
                  ) : m.card?.type === 'review' ? (
                    <ReviewCard assess={assess} onEdit={editStep} onConfirm={confirmReview} active={assess.step === 'review'} />
                  ) : m.card?.type === 'intents' ? (
                    <IntentChips options={m.card.options} onPick={pickIntent} />
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
                    <ThreadCardView card={m.card} onEditAssessment={editAssessment} onTalkMore={talkMore} onPlan={() => requestPlan()} />
                  ) : null}
                  {m.thinking === 'working' ? null : <SourceTag source={m.source} confirmedBy={m.confirmedBy} />}
                </AIThreadMessage>
              )}
            </View>
          ))}
        </Animated.View>
        ) : null}
      </BodyScrollView>
      </ScrollFadeMask>

      {/* header ข้อมูลผู้ป่วย (ชื่อ + ธาตุ): ตรึงกับจอ ไม่ขยับตามการเลื่อน · ไม่มีพื้นทับ จึงเห็นหุ่นด้านหลังเสมอ */}
      <Animated.View
        pointerEvents={focus ? 'none' : 'box-none'}
        style={[{ position: 'absolute', top: insets.top, left: 0, right: 0, zIndex: 10, elevation: 10 }, focusOut]}
      >
          <View pointerEvents="box-none" style={[content, { paddingTop: space[4] }]} onLayout={(e) => setHeaderH(Math.round(e.nativeEvent.layout.height))}>
          <View pointerEvents="box-none" style={{ gap: space[4] }}>
            {/* โปรไฟล์ / ประวัติ อยู่ใน tab menu แล้ว → header เหลือแค่ปุ่มออกจากแชท (ตอนคุยกับ AI) */}
            {started && !chatHome ? (
              <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, right: 0, zIndex: 2 }}>
                <HeaderAction icon="x" label="ออกจากแชท" onPress={exitChat} />
              </View>
            ) : null}
            {/* ชื่อ + ธาตุเป็น pill เล็กบรรทัดถัดจากชื่อ (ข้อมูลส่วนบุคคล · แตะดูรายละเอียดธาตุ) */}
            <View pointerEvents="box-none" style={{ gap: 2, alignSelf: 'flex-start' }}>
              <Text variant="bodyBase" tone="secondary" pointerEvents="none">
                สวัสดีค่ะ,
              </Text>
              <Text variant="titleXl" accessibilityRole="header" pointerEvents="none">
                {client.name}
              </Text>
              {/* บรรทัดถัดจากชื่อ */}
              <View pointerEvents="box-none" style={{ flexDirection: 'row', paddingTop: space[1] }}>
                {elementTag ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={elementTag}
                    onPress={() => nav.navigate('ElementQuiz')}
                    style={({ pressed }) => ({
                      height: componentTokens.elementTag.height,
                      paddingHorizontal: space[3],
                      borderRadius: radius.full,
                      // สีตามธาตุ
                      backgroundColor: componentTokens.elementTag[tagElement!].bg,
                      justifyContent: 'center',
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text variant="labelSm" color={componentTokens.elementTag[tagElement!].fg}>
                      {elementTag}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
            {/* แท็บเรื่องที่ดูแล — ตรึงใน header (เลื่อนดูช่องล่าง ๆ ก็ยังรู้ว่าดูเรื่องไหน และสลับได้ทันที) */}
            {!started || leaving ? (
              <CaseTabs cases={cases.map((c) => c.short)} drafts={drafts.map((d) => d.title)} value={caseIdx} onChange={setCaseIdx} onNew={newChat} />
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
      <Text variant="labelSm" color={dark ? colors.text.inverse : colors.text.primary} numberOfLines={1}>
        {label}
      </Text>
    </View>
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
 * ประวัติการรักษาของเรื่องหนึ่ง แบบ bento ในแชท/หน้าประวัติ
 * ผลการรักษา (การ์ด Pain Score เดียวกับหน้าแรก) · คอร์สถึงไหน · รายครั้ง · จุดที่นวด · ผู้ให้บริการ
 */
export function HistoryBento({ tc, onAll }: { tc: TreatmentCase; onAll?: () => void }) {
  const { colors } = useTheme();
  const { followUps } = useJourney();
  // กว้างตามที่วางจริง (ในแชทมีคอลัมน์รูป AI · ในหน้าประวัติเต็มจอ)
  const [width, setWidth] = React.useState(0);
  const halfW = (width - BENTO_GAP) / 2;
  // คะแนนหลังนวดที่ส่งผลติดตามแล้ว = ค่าล่าสุดจริง
  const sent = followUps.filter((f) => tc.pending.some((ss) => ss.id === f.sessionId)).flatMap((f) => f.areas);
  const sentAfter = sent.length ? Math.round(sent.reduce((n, a) => n + a.painAfter, 0) / sent.length) : undefined;
  const last = tc.visits[tc.visits.length - 1];
  const lastAfter = sentAfter ?? last.painAfter;
  if (!width) return <View style={{ alignSelf: 'stretch' }} onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))} />;
  return (
    <View style={{ alignSelf: 'stretch', gap: BENTO_GAP }} onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}>
      {/* ผลการรักษา = การ์ด Pain Score ชุดเดียวกับหน้าแรก (ครั้งล่าสุด: ก่อนรักษา → หลังนวด/ผลติดตาม) · คอร์ส */}
      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: BENTO_GAP }}>
        <View pointerEvents="none" style={{ width: halfW }}>
          <PainScoreCard value={lastAfter} before={last.painBefore} stageLabel="หลังนวด" chart width={halfW} />
        </View>
        <Tile style={{ width: halfW, gap: space[2] }}>
          <Text variant="caption" tone="secondary">
            คอร์สการรักษา
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[1] }}>
            <Text variant="titleXl">{tc.course.done}</Text>
            <Text variant="labelSm" tone="secondary">
              / {tc.course.total} ครั้ง
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 3 }}>
            {Array.from({ length: tc.course.total }, (_, i) => (
              <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < tc.course.done ? colors.brand.primary : colors.border.default }} />
            ))}
          </View>
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            ครั้งล่าสุด {last.date}
          </Text>
          {/* การดูแลตัวเองระหว่างคอร์ส: ทำท่าที่บ้านกี่วันตั้งแต่เริ่มรักษา */}
          {tc.selfCare.days ? (
            <View style={{ marginTop: 'auto', gap: space[2], paddingTop: space[3], borderTopWidth: 1, borderTopColor: colors.border.subtle }}>
              <View>
                <Text variant="caption" tone="secondary">
                  ดูแลตัวเองที่บ้าน
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[1] }}>
                  <Text variant="titleLg">{tc.selfCare.daysDone ?? 0}</Text>
                  <Text variant="labelSm" tone="secondary">
                    / {tc.selfCare.days} วัน
                  </Text>
                </View>
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border.default, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round(((tc.selfCare.daysDone ?? 0) / tc.selfCare.days) * 100)}%`, height: 6, borderRadius: 3, backgroundColor: colors.brand.primary }} />
              </View>
              <Text variant="caption" tone="tertiary" numberOfLines={1}>
                {tc.selfCare.title}
              </Text>
            </View>
          ) : null}
        </Tile>
      </View>

      {/* รายครั้ง (ล่าสุดก่อน) */}
      <Tile style={{ gap: space[2] }}>
        <Text variant="caption" tone="secondary">
          แต่ละครั้ง
        </Text>
        {[...tc.visits].reverse().map((v) => (
          <View key={v.date} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <Text variant="labelSm" style={{ width: 64 }}>
              {v.date}
            </Text>
            {/* แถบก่อน (เทา) → หลัง (สีแบรนด์) */}
            <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.border.default, overflow: 'hidden' }}>
              <View style={{ width: `${(v.painAfter / 10) * 100}%`, height: 8, borderRadius: 4, backgroundColor: colors.brand.primary }} />
            </View>
            <Text variant="caption" tone="secondary" style={{ width: 44, textAlign: 'right' }}>
              {v.painBefore} → {v.painAfter}
            </Text>
          </View>
        ))}
      </Tile>

      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: BENTO_GAP }}>
        {/* จุดที่นวด */}
        <Tile style={{ width: halfW, gap: space[2] }}>
          <Text variant="caption" tone="secondary">
            จุดที่นวด
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {tc.areas.map((a) => (
              <View key={a.pin} style={{ paddingHorizontal: space[2], height: 22, borderRadius: radius.full, backgroundColor: colors.surface.sunken, justifyContent: 'center' }}>
                <Text variant="caption">{a.label}</Text>
              </View>
            ))}
          </View>
        </Tile>
        {/* ผู้ให้บริการ */}
        <Tile style={{ width: halfW, gap: 2 }} onPress={onAll} accessibilityLabel={onAll ? 'ดูประวัติทั้งหมด' : undefined}>
          <Text variant="caption" tone="secondary">
            ผู้ให้บริการ
          </Text>
          <Text variant="labelSm" numberOfLines={2}>
            {tc.therapist}
          </Text>
          {onAll ? (
            <Text variant="caption" color={colors.brand.primary} style={{ marginTop: 'auto' }}>
              ดูประวัติทั้งหมด
            </Text>
          ) : null}
        </Tile>
      </View>
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
function CaseTabs({ cases, drafts, value, onChange, onNew }: { cases: string[]; drafts: string[]; value: number; onChange: (i: number) => void; onNew?: () => void }) {
  const { colors } = useTheme();
  const items = [...cases.map((c) => `รักษา${c}`), ...drafts.map((d) => `ประเมิน${d}`)];
  if (!items.length && !onNew) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -space[5] }}
      contentContainerStyle={{ minHeight: BENTO_CASE_H, alignItems: 'center', gap: space[2], paddingHorizontal: space[5] }}
    >
      {/* ประเมินใหม่ = ปุ่มเริ่มประเมิน (ไม่ใช่แท็บ) → แตะแล้วเข้าหน้าประเมินในแชททันที · อยู่หน้าสุด ไอคอน + ขอบเส้นประสีแบรนด์ */}
      {onNew ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="ประเมินคัดกรองใหม่"
          onPress={onNew}
          style={({ pressed }) => ({
            height: 36,
            paddingHorizontal: space[3],
            borderRadius: radius.full,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: colors.brand.primary,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[1],
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Icon name="plus" size="xs" color={colors.brand.primary} />
          <Text variant="labelMd" color={colors.brand.primary}>
            ประเมินใหม่
          </Text>
        </Pressable>
      ) : null}
      {items.length ? (
        <JellyRadio items={items} value={value} onChange={onChange} size="md" gap={space[2]} swell={0.06} barge={2} shrink={0.02} accessibilityLabel="เลือกเรื่องที่ดูแล" />
      ) : null}
    </ScrollView>
  );
}

/** ท่ายืดตามกลุ่มอาการที่ประเมิน (ยืดเหยียด 7 กลุ่มอาการ) */
const stretchFor = (symptoms: string[]) =>
  symptoms.some((x) => /คอ|บ่า|ไหล่/.test(x)) ? 'ยืดคอ-บ่า' : symptoms.some((x) => /หลัง/.test(x)) ? 'ยืดหลัง' : 'ยืดเหยียดทั้งตัว';

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
}: {
  width: number;
  draft: DraftCase;
  tabs: React.ReactNode;
  onBook: () => void;
  onCheckIn: () => void;
  onRedFlag: () => void;
  onFollowUp: () => void;
  onSelfCare: () => void;
}) {
  const { colors } = useTheme();
  const halfW = (width - BENTO_GAP) / 2;
  const b = d.booking;
  const served = d.stage === 'served';
  const prep = [...(d.caution?.includes('ความดัน') || d.caution?.includes('อบ') ? ['วัดความดันก่อนนวด'] : []), 'งดอาหารหนัก 30 นาที'];
  // ขั้นของใบนี้: ประเมิน → จอง → รับบริการ → ติดตามผล
  const stepIdx = served ? 3 : d.stage === 'booked' ? 2 : 1;
  const painTone = d.pain >= 7 ? colors.status.danger.fg : d.pain >= 4 ? colors.status.warning.fg : colors.status.success.fg;

  return (
    <View style={{ gap: BENTO_GAP }}>
      {tabs}

      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: BENTO_GAP }}>
        <View style={{ width: halfW, gap: BENTO_GAP }}>
          {/* นัด */}
          {d.red ? (
            <Tile style={{ gap: space[2] }} onPress={onRedFlag} accessibilityLabel="ควรพบแพทย์ก่อน">
              <Text variant="caption" tone="secondary">
                นัด
              </Text>
              <Text variant="titleSm" color={colors.status.danger.fg}>
                ควรพบแพทย์ก่อน
              </Text>
              <TilePill icon="alert-triangle" label="ดูคำแนะนำ" />
            </Tile>
          ) : b ? (
            <Tile style={{ gap: space[2] }} onPress={served ? undefined : onCheckIn} accessibilityLabel={`นัด ${b.date} ${b.time}`}>
              <View>
                <Text variant="caption" tone="secondary">
                  {served ? 'นวดแล้ว' : 'นัดของคุณ'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[2] }}>
                  <Text variant="titleXl">{b.time}</Text>
                  <Text variant="labelSm" tone="secondary">
                    {b.date}
                  </Text>
                </View>
              </View>
              {served ? null : <TilePill icon="maximize" label="เช็กอิน" />}
            </Tile>
          ) : (
            <Tile style={{ gap: space[2] }} onPress={onBook} accessibilityLabel="จองนวด">
              <View>
                <Text variant="caption" tone="secondary">
                  ยังไม่ได้จอง
                </Text>
                <Text variant="titleSm">คิวว่างพรุ่งนี้ 13:00</Text>
              </View>
              <TilePill icon="calendar" label="จองนวด" />
            </Tile>
          )}

          {/* ผลประเมิน = การ์ด Pain Score ตัวเดียวกับในแชท (ดูอย่างเดียว) · หลังนวดแสดงคะแนนหลังนวด */}
          <View pointerEvents="none" style={{ flex: 1 }}>
            {served && d.after !== undefined ? (
              <PainScoreCard value={d.after} before={d.pain} stageLabel="หลังนวด" chart width={halfW} />
            ) : (
              <PainScoreCard value={d.pain} stageLabel="ก่อนรักษา" chart width={halfW} />
            )}
          </View>
        </View>

        <View style={{ width: halfW, gap: BENTO_GAP }}>
          {/* แนวทางที่แนะนำ + ขั้นของใบนี้ */}
          <Tile style={{ gap: space[3] }}>
            <View>
              <Text variant="caption" tone="secondary">
                {d.red ? 'แนวทาง' : 'แนวทางที่แนะนำ'}
              </Text>
              <Text variant="titleSm">{d.red ? 'ตรวจกับแพทย์ก่อน' : 'นวดราชสำนัก 60 นาที'}</Text>
              {d.caution ? (
                <Text variant="caption" color={colors.status.warning.fg}>
                  {d.caution}
                </Text>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < stepIdx ? colors.brand.primary : i === stepIdx ? colors.text.primary : colors.border.default }} />
              ))}
            </View>
          </Tile>

          {d.red ? null : (
            <>
              {/* ดูแลตัวเอง ระหว่างรอนัด */}
              <Tile style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }} onPress={onSelfCare} accessibilityLabel={`ดูแลตัวเอง ${stretchFor(d.symptoms)}`}>
                <View style={{ flex: 1 }}>
                  <Text variant="caption" tone="secondary">
                    ดูแลตัวเอง
                  </Text>
                  <Text variant="labelSm" numberOfLines={1}>
                    {stretchFor(d.symptoms)}
                  </Text>
                </View>
                <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.text.primary }}>
                  <Icon name="play" size="xs" color={colors.text.inverse} />
                </View>
              </Tile>
              {/* ก่อนมานวด */}
              <Tile style={{ flex: 1, gap: space[2] }}>
                <Text variant="caption" tone="secondary">
                  ก่อนมานวด
                </Text>
                {prep.map((it) => (
                  <View key={it} style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
                    <Icon name="check-circle" size="xs" color={colors.brand.primary} />
                    <Text variant="caption" style={{ flex: 1 }} numberOfLines={2}>
                      {it}
                    </Text>
                  </View>
                ))}
              </Tile>
            </>
          )}
        </View>
      </View>

      {/* แถวล่าง: นวดแล้วเท่านั้น → ติดตามผลหลังนวด (ประเมินอาการซ้ำ = ปุ่มม่วง) */}
      {served ? (
        <Tile style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }} onPress={onFollowUp} accessibilityLabel="ติดตามผลหลังนวด">
          <View style={{ flex: 1 }}>
            <Text variant="titleSm">หลังนวดเป็นอย่างไร</Text>
            <Text variant="caption" tone="secondary">
              ให้คะแนนอาการ
            </Text>
          </View>
          <TilePill icon="edit-3" label="ให้คะแนน" />
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
}: {
  width: number;
  caseIdx: number;
  tcase: TreatmentCase;
  tabs: React.ReactNode;
  onCheckIn: () => void;
  onHistory: () => void;
  onFollowUp: () => void;
  onSelfCare: () => void;
}) {
  const { colors } = useTheme();
  const { followUps } = useJourney();
  const tc: TreatmentCase = tcase;
  const ap = tc.appointment;
  const halfW = (width - BENTO_GAP) / 2;

  // ผลการรักษาของใบนี้: ครั้งล่าสุด (ถ้าส่งผลติดตามแล้ว ใช้คะแนนหลังนวดที่ผู้ใช้ส่ง)
  const sentRecs = followUps.filter((f) => tc.pending.some((ss) => ss.id === f.sessionId));
  const avg = (xs: number[]) => Math.round(xs.reduce((x, y) => x + y, 0) / xs.length);
  const last = tc.visits[tc.visits.length - 1];
  const sentAfter = sentRecs.length ? avg(sentRecs.flatMap((r) => r.areas.map((x) => x.painAfter))) : undefined;
  const after = sentAfter ?? last.painAfter;

  // ติดตามอาการของใบนี้
  const pending = tc.pending.filter((ss) => !followUps.some((f) => f.sessionId === ss.id));
  const pendingAreas = pending.reduce((n, ss) => n + ss.areas.length, 0);

  return (
    <View style={{ gap: BENTO_GAP }}>
      {/* 1) ใบการรักษา + ใบร่าง — เต็มแถว */}
      {tabs}

      {/* 2) กลาง */}
      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: BENTO_GAP }}>
        <View style={{ width: halfW, gap: BENTO_GAP }}>
          {/* นัดของใบนี้ */}
          <Tile
            style={{ gap: space[2] }}
            onPress={ap.today ? onCheckIn : undefined}
            accessibilityLabel={ap.today ? `นัดวันนี้ ${ap.time} คิว ${ap.queue} เช็กอิน` : `นัดถัดไป ${ap.date} ${ap.time}`}
          >
            {/* เวลา (ซ้าย) · คิว (ขวา) รูปแบบเดียวกัน: ป้ายเล็กด้านบน + ค่าขนาดเดียวกัน */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
              <View>
                <Text variant="caption" tone="secondary">
                  {ap.today ? 'นัดวันนี้' : 'นัดถัดไป'}
                </Text>
                {ap.today ? (
                  <Text variant="titleXl">{ap.time}</Text>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[2] }}>
                    <Text variant="titleXl">{ap.time}</Text>
                    <Text variant="labelSm" tone="secondary">
                      {ap.date}
                    </Text>
                  </View>
                )}
              </View>
              {ap.today ? (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="caption" tone="secondary">
                    คิว
                  </Text>
                  <Text variant="titleXl" color={colors.brand.primary}>
                    {ap.queue}
                  </Text>
                </View>
              ) : null}
            </View>
            {ap.today ? <TilePill icon="maximize" label="เช็กอิน" /> : null}
          </Tile>

          {/* ผลการรักษาของใบนี้ = การ์ด Pain Score แบบเดียวกับใบร่าง: หลังนวด (ตัวใหญ่) เทียบก่อนรักษา · แตะดูประวัติ */}
          <Pressable accessibilityRole="button" accessibilityLabel={`ผลการรักษา ปวด ${last.painBefore} เหลือ ${after} ดูประวัติ`} onPress={onHistory} style={{ flex: 1 }}>
            <View pointerEvents="none" style={{ flex: 1 }}>
              <PainScoreCard value={after} before={last.painBefore} stageLabel="หลังนวด" chart width={halfW} />
            </View>
          </Pressable>
        </View>

        {/* ขวา: แผนการรักษา · ดูแลตัวเองวันนี้ · ก่อนมานวด */}
        <View style={{ width: halfW, gap: BENTO_GAP }}>
          {/* แผนการรักษา: คอร์สถึงไหนแล้ว + ผู้ให้บริการ */}
          <Tile style={{ gap: space[3] }}>
            <View>
              <Text variant="caption" tone="secondary">
                แผนการรักษา
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[1] }}>
                <Text variant="titleXl">ครั้งที่ {tc.course.done}</Text>
                <Text variant="labelSm" tone="secondary">
                  / {tc.course.total}
                </Text>
              </View>
            </View>
            {/* ขีดละครั้ง: ทำแล้ว = สีแบรนด์ */}
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {Array.from({ length: tc.course.total }, (_, i) => (
                <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < tc.course.done ? colors.brand.primary : colors.border.default }} />
              ))}
            </View>
            <View>
              <Text variant="caption" numberOfLines={1}>
                {tc.plan}
              </Text>
              <Text variant="caption" tone="tertiary" numberOfLines={1}>
                {tc.therapist}
              </Text>
            </View>
          </Tile>

          {/* ดูแลตัวเองวันนี้ (ท่าของโรคนี้) — แถวเดียว: ชื่อท่า + ปุ่มเล่นกลม */}
          <Tile style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }} onPress={onSelfCare} accessibilityLabel={`ดูแลตัวเองวันนี้ ${tc.selfCare.title}`}>
            <View style={{ flex: 1 }}>
              <Text variant="caption" tone="secondary">
                {tc.selfCare.doneToday ? 'ทำแล้ววันนี้' : 'ดูแลตัวเอง'}
              </Text>
              <Text variant="labelSm" numberOfLines={1}>
                {tc.selfCare.title}
              </Text>
            </View>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: tc.selfCare.doneToday ? colors.brand.subtle : colors.text.primary,
              }}
            >
              <Icon name={tc.selfCare.doneToday ? 'check' : 'play'} size="xs" color={tc.selfCare.doneToday ? colors.brand.primary : colors.text.inverse} />
            </View>
          </Tile>

          {/* ก่อนมานวด — ยืดเต็มความสูงคอลัมน์ที่เหลือ */}
          <Tile style={{ flex: 1, gap: space[2] }}>
            <Text variant="caption" tone="secondary">
              ก่อนมานวด
            </Text>
            {tc.prep.map((it) => (
              <View key={it} style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
                <Icon name="check-circle" size="xs" color={colors.brand.primary} />
                <Text variant="caption" style={{ flex: 1 }} numberOfLines={2}>
                  {it}
                </Text>
              </View>
            ))}
          </Tile>
        </View>
      </View>

      {/* 3) ติดตามผล — ให้คะแนนอาการโดยรวมของการรักษาครั้งนั้น (ไม่ใช่ทีละจุด) · ชิป = บริเวณที่รักษา (ตรงกับ mark บนหุ่น) */}
      <Tile style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }} onPress={onFollowUp} accessibilityLabel="ติดตามผลหลังนวด">
        <View style={{ flex: 1, gap: space[1] }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[1] }}>
            {pending.length ? (
              <Text variant="titleSm">หลังนวดเป็นอย่างไร</Text>
            ) : (
              <>
                <Icon name="check-circle" size="xs" color={colors.brand.primary} />
                <Text variant="labelSm" color={colors.brand.primary}>
                  ส่งผลติดตามครบแล้ว
                </Text>
              </>
            )}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {tc.areas.map((a) => (
              <View key={a.pin} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space[2], height: 22, borderRadius: radius.full, backgroundColor: colors.surface.sunken }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: sentAfter === undefined ? colors.brand.primary : painColorOf(sentAfter) }} />
                <Text variant="caption">{a.label}</Text>
              </View>
            ))}
          </View>
        </View>
        <TilePill icon={pending.length ? 'edit-3' : 'eye'} label={pending.length ? 'ให้คะแนน' : 'ดูผล'} dark={!!pending.length} />
      </Tile>
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
function HeaderAction({ icon, label, onPress }: { icon: React.ComponentProps<typeof Icon>['name']; label: string; onPress: () => void }) {
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
