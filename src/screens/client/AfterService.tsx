import React from 'react';
import { Image, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import {
  AILabel,
  AppBar,
  Badge,
  Banner,
  BeforeAfterBars,
  Button,
  Card,
  ChipGroup,
  ChipSection,
  Col,
  Divider,
  FaceScale,
  GridRow,
  HStack,
  Icon,
  JourneyStepper,
  Placeholder,
  ProgressBar,
  ScaleSelector,
  Screen,
  SectionHeader,
  StatDelta,
  Text,
  VStack,
  space,
  useTheme,
  StretchDemo,
  stretchGif,
  fontFamily,
  radius,
  LoadingImage, ScreenSkeleton, useScreenData,
  Panel,
  TINT,
  StatTile,
  Tag,
  RowLink,
  ReplyChips,
} from '../../design-system';
import { KH_SOURCES, SYMPTOM_GROUPS } from '../../data/thaiMassageKnowledge';
import { STRETCH_MOTION } from '../../data/stretchMotion';
import { useJourney } from '../../state/JourneyContext';
import { useNav } from '../../navigation/types';
import { NotFoundScreen } from './NotFound';
import { sessionRecord } from './home/TreatmentDetailBody';
import type { TreatmentCase } from '../../data/homeFeed';

/* ============================================================ 15 POST-SERVICE ASSESSMENT */

export function PostAssessmentScreen({ route }: { route?: { params?: { caseId?: string; draftId?: string; looseId?: string } } }) {
  const nav = useNav();
  const { before, setBefore, setAfter, log, newPatient, setCareStage, drafts, promoteDraft, cases, recordCaseVisit, removeLooseBooking, caseToday, setVisitSelfPain, notifyClinic } = useJourney();
  // นวดของเรื่องไหน (ส่งต่อมาจากเช็กอิน) → บันทึกผลลงเรื่องนั้นเท่านั้น
  const target = route?.params ?? {};
  const draft = drafts.find((x) => x.id === target.draftId);
  const tc = cases.find((c) => c.id === target.caseId);
  // เรื่องที่รักษา: คลินิกปิดการรักษาแล้วเสมอ → แบบนี้คือประเมินหลังนวดของครั้งล่าสุด (วันนี้หรือย้อนหลังก็ได้) ไม่สร้างครั้งใหม่
  const closed = tc ? tc.visits[tc.visits.length - 1] : undefined;
  // ก่อนนวด = คะแนนของเรื่องนี้ก่อนนวดครั้งนี้ (ปิดแล้ว = ก่อนนวดที่คลินิกบันทึก · ใบร่าง = ตอนประเมิน · ใบการรักษา = ประเมินก่อนนวด / หลังนวดครั้งก่อน)
  const basePain = closed?.painBefore ?? draft?.pain ?? (tc ? caseToday[tc.id]?.pain ?? tc.visits[tc.visits.length - 1]?.painAfter : undefined) ?? before.pain;
  React.useEffect(() => {
    if (basePain !== before.pain) setBefore({ ...before, pain: basePain });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePain]);
  const [pain, setPain] = React.useState<number | undefined>();
  const [stiff, setStiff] = React.useState<number | undefined>();
  const [relax, setRelax] = React.useState<number | undefined>();
  const [sat, setSat] = React.useState<number | undefined>();
  const [adverse, setAdverse] = React.useState<string[]>(['ไม่มี']);
  const complete = pain !== undefined && stiff !== undefined && relax !== undefined && sat !== undefined;
  const hasAdverse = adverse.some((a) => a !== 'ไม่มี');

  return (
    <Screen
      header={<AppBar title="หลังนวดรู้สึกอย่างไร" onBack={() => nav.goBack()} />}
      footer={
        <Button
          label={closed ? 'บันทึก' : 'ดูผลลัพธ์ของฉัน'}
          iconRight={closed ? undefined : 'arrow-right'}
          disabled={!complete}
          onPress={() => {
            setAfter({ pain: pain!, stiffness: stiff!, mobility: Math.min(5, before.mobility + 2), stress: Math.max(1, before.stress - 2), sleep: before.sleep });
            log('ผู้รับบริการ', `บันทึกแบบประเมินหลังนวด · ปวด ${basePain} → ${pain}`);
            // อาการผิดปกติหลังนวด → บันทึกแจ้งผู้ให้บริการ (ข้อความบนหน้านี้บอกว่าแจ้งแล้ว)
            if (hasAdverse) log('ระบบ → ผู้ให้บริการ', `แจ้งอาการผิดปกติหลังนวด: ${adverse.join(', ')}`);
            if (newPatient) setCareStage('served');
            // คลินิกปิดแล้ว → เก็บเป็นความรู้สึกของผู้ใช้ แล้วกลับหน้าผลลัพธ์เดิม
            if (closed && tc) {
              setVisitSelfPain(tc.id, pain!);
              notifyClinic('ประเมินหลังนวดจากแอป', `${tc.short} ครั้งที่ ${tc.visits.length} · ปวด ${closed.painBefore} → ${pain}${hasAdverse ? ` · ${adverse.join(', ')}` : ''}`);
              return nav.goBack();
            }
            // ใบร่าง → นวดครั้งแรกแล้ว ผู้ให้บริการตั้งชื่อโรค → ใบการรักษา · ใบการรักษา → เพิ่มครั้งการรักษา · จองไว้ก่อนประเมิน → นัดนี้ใช้แล้ว
            if (draft) promoteDraft(draft.id, pain!);
            else if (tc) recordCaseVisit(tc.id, basePain, pain!);
            else if (target.looseId) removeLooseBooking(target.looseId);
            nav.navigate('SessionResult', { caseId: draft ? `case-${draft.id}` : tc?.id });
          }}
        />
      }
    >
      {/* การ์ดชุดเดียวกับหน้าอื่น (Panel) · ตัวเลือกแบบเดียวกับในแชท (ReplyChips) */}
      <Panel title="เทียบกับก่อนนวด">
        <ScaleSelector label="ความปวดตอนนี้" value={pain} onChange={setPain} compareValue={before.pain} minLabel="ไม่ปวด" maxLabel="ปวดมาก" />
        <ScaleSelector label="ความตึงตอนนี้" value={stiff} onChange={setStiff} compareValue={before.stiffness} minLabel="ไม่ตึง" maxLabel="ตึงมาก" />
      </Panel>
      <Panel title="ความผ่อนคลาย">
        <FaceScale value={relax} onChange={setRelax} labels={['ไม่เลย', 'น้อย', 'ปานกลาง', 'มาก', 'มากที่สุด']} />
      </Panel>
      <Panel title="ความพึงพอใจต่อบริการ">
        <FaceScale value={sat} onChange={setSat} labels={['ไม่พอใจ', 'น้อย', 'ปานกลาง', 'พอใจ', 'พอใจมาก']} />
      </Panel>
      <Panel title="มีอาการผิดปกติหลังนวดไหม">
        <ReplyChips
          options={['ไม่มี', 'ระบม/ช้ำ', 'เวียนศีรษะ', 'ปวดมากขึ้น', 'ชา']}
          selected={adverse}
          onPick={(o) =>
            setAdverse((cur) => (o === 'ไม่มี' ? ['ไม่มี'] : cur.includes(o) ? (cur.filter((x) => x !== o && x !== 'ไม่มี').length ? cur.filter((x) => x !== o && x !== 'ไม่มี') : ['ไม่มี']) : [...cur.filter((x) => x !== 'ไม่มี'), o]))
          }
        />
        {hasAdverse ? (
          <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'center' }}>
            <Icon name="alert-triangle" size="xs" color={TINT.amber} />
            <Text variant="bodySm" style={{ flex: 1 }}>
              แจ้งผู้ให้บริการแล้ว ถ้าไม่ดีขึ้นใน 24 ชม. ควรพบแพทย์
            </Text>
          </View>
        ) : null}
      </Panel>
    </Screen>
  );
}

/* ============================================================ 16 SESSION RESULT */

export function SessionResultScreen({ route }: { route?: { params?: { caseId?: string } } }) {
  const nav = useNav();
  const { colors } = useTheme();
  const { before, after, cases } = useJourney();
  const caseId = route?.params?.caseId;
  // ผลของเรื่องที่รักษา = คะแนนที่คลินิกบันทึกตอนปิดการรักษา (ไม่ต้องรอผู้ใช้กรอก)
  const tc = cases.find((c) => c.id === caseId);
  if (tc) return <CaseResult tc={tc} />;
  // ยังไม่มีผลหลังนวด → ไม่แต่งตัวเลขขึ้นเอง
  if (!after) return <NotFoundScreen title="ผลลัพธ์ครั้งนี้" message="ยังไม่มีผลหลังนวด" />;
  const a = after;
  // หัวข้อตามผลจริง (ไม่บอกว่าดีขึ้นทุกครั้ง)
  const diff = before.pain - a.pain;
  const verdict = diff >= 2 ? { t: 'อาการดีขึ้นชัดเจน', icon: 'award' as const, tone: colors.status.success } : diff >= 1 ? { t: 'อาการดีขึ้นเล็กน้อย', icon: 'trending-down' as const, tone: colors.status.success } : diff === 0 ? { t: 'อาการใกล้เคียงเดิม', icon: 'minus' as const, tone: colors.status.warning } : { t: 'ปวดมากขึ้นหลังนวด', icon: 'alert-triangle' as const, tone: colors.status.danger };

  return (
    <Screen
      header={<AppBar title="ผลลัพธ์ครั้งนี้" onBack={() => nav.goBack()} />}
      footer={
        <>
          {/* ปวดมากขึ้น → ให้แพทย์ดูก่อน ไม่ชวนจองต่อ */}
          {diff < 0 ? (
            <Button label="ดูคำแนะนำ" onPress={() => nav.navigate('RedFlag', { reason: 'ปวดมากขึ้นหลังนวด' })} />
          ) : caseId ? null : (
            // เรื่องที่รักษาแล้ว: นัดครั้งถัดไปแพทย์นัดให้ตามแผน (ไม่มีปุ่มจองเอง)
            <Button label="จองนวดครั้งถัดไป" iconLeft="calendar" onPress={() => nav.navigate('Booking')} />
          )}
          {/* กลับหน้าแรก (ไม่ reset → แชทและข้อมูลในหน้าแรกไม่หาย) */}
          <Button label="กลับหน้าแรก" variant="secondary" onPress={() => nav.popTo('ClientTabs', { screen: 'Home' })} />
        </>
      }
    >
      <View style={{ alignItems: 'center', gap: 8 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: verdict.tone.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={verdict.icon} size="xl" color={verdict.tone.fg} />
        </View>
        <Text variant="headlineSm" align="center">
          {verdict.t}
        </Text>
        {caseId ? (
          <Text variant="bodySm" tone="secondary" align="center">
            แพทย์จะนัดครั้งถัดไปตามแผนการรักษา และแจ้งเตือนในแอป
          </Text>
        ) : null}
      </View>

      {/* สรุปตัวเลข (StatTile แบบเดียวกับโปรไฟล์/ประวัติ) */}
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <StatTile label="ความปวด" value={`${before.pain} → ${a.pain}`} unit="/10" color={a.pain < before.pain ? colors.brand.primary : a.pain > before.pain ? colors.status.danger.fg : undefined} />
        <StatTile label="ความตึง" value={`${before.stiffness} → ${a.stiffness}`} unit="/10" color={a.stiffness < before.stiffness ? colors.brand.primary : undefined} />
      </View>

      <Panel title="เทียบก่อน–หลัง">
        <BeforeAfterBars
          data={[
            { label: 'ความปวด (0–10)', before: before.pain, after: a.pain },
            { label: 'ความตึง (0–10)', before: before.stiffness, after: a.stiffness },
            { label: 'การเคลื่อนไหว (1–5)', before: before.mobility, after: a.mobility, max: 5 },
          ]}
        />
      </Panel>

      <Panel title="สรุป" right={<Tag text="ผู้ให้บริการตรวจแล้ว" tone="good" />}>
        <Text variant="bodyMd">
          {`ความปวด ${before.pain} → ${a.pain} ความตึง ${before.stiffness} → ${a.stiffness}`}
          {diff >= 1 ? ' ตอบสนองต่อการนวดดี ทำท่ายืดที่บ้านต่อเนื่อง' : diff === 0 ? ' ผู้ให้บริการจะปรับแผนครั้งถัดไป' : ' แนะนำให้แพทย์ประเมินก่อนนวดครั้งถัดไป'}
        </Text>
      </Panel>

      {/* หลังนวด — ตำราอ้างอิงฯ หน้า 402 (อาหารแสลง · ห้ามบีบ/ดัดส่วนที่เจ็บ) · หน้า 414 (ไม่อาบน้ำทันทีหลังประคบ) */}
      <Panel title="หลังนวด">
        {['งดของมัน ของทอด ของหมักดอง และแอลกอฮอล์', 'ไม่บีบหรือดัดตรงที่เจ็บเอง', 'ไม่อาบน้ำทันทีหลังประคบ'].map((t) => (
          <View key={t} style={{ flexDirection: 'row', gap: space[2], alignItems: 'center' }}>
            <Icon name="check-circle" size="xs" color={colors.brand.primary} />
            <Text variant="bodySm" style={{ flex: 1 }}>
              {t}
            </Text>
          </View>
        ))}
      </Panel>
      <Panel flush>
        <RowLink icon="play" tint={TINT.green} title="ท่าดูแลตัวเอง" sub="ท่ายืดที่บ้านของเรื่องนี้" onPress={() => nav.navigate('SelfCare')} last />
      </Panel>

      <Panel title="การติดตามผล">
        {[
          { t: 'พรุ่งนี้', d: 'เช็กอาการระบม/ข้างเคียง' },
          { t: '3 วัน', d: 'ความปวดและการนอน' },
          { t: '7 วัน', d: 'สรุปผลและนัดครั้งถัดไป' },
        ].map((f, i) => (
          <View key={f.t} style={{ flexDirection: 'row', gap: space[3], alignItems: 'center' }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface.sunken }}>
              <Text variant="labelSm" tone="secondary">
                {i + 1}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="labelMd">{f.t}</Text>
              <Text variant="bodyXs" tone="secondary">
                {f.d}
              </Text>
            </View>
          </View>
        ))}
      </Panel>
    </Screen>
  );
}

/** ผลลัพธ์ของครั้งล่าสุดในเรื่องที่รักษา: ก่อน→หลัง (คลินิก) · เทียบครั้งก่อน · วันนี้ทำอะไร · ความรู้สึกของคุณ · หลังนวด · บิล · ครั้งถัดไป */
function CaseResult({ tc }: { tc: TreatmentCase }) {
  const nav = useNav();
  const { colors } = useTheme();
  const { bills } = useJourney();
  const i = tc.visits.length - 1;
  const v = tc.visits[i];
  const prev = i > 0;
  const r = sessionRecord(tc, i);
  const diff = v.painBefore - v.painAfter;
  const verdict = diff >= 2 ? { t: 'อาการดีขึ้นชัดเจน', icon: 'award' as const, tone: colors.status.success } : diff >= 1 ? { t: 'อาการดีขึ้นเล็กน้อย', icon: 'trending-down' as const, tone: colors.status.success } : diff === 0 ? { t: 'อาการใกล้เคียงเดิม', icon: 'minus' as const, tone: colors.status.warning } : { t: 'ปวดมากขึ้นหลังนวด', icon: 'alert-triangle' as const, tone: colors.status.danger };
  const bill = bills.find((b) => b.caseId === tc.id && b.title.endsWith(`ครั้งที่ ${i + 1}`));
  const finished = tc.course.done >= tc.course.total;
  const tone = (a: number, b: number) => (b < a ? colors.brand.primary : b > a ? colors.status.danger.fg : undefined);
  return (
    <Screen
      header={<AppBar title="ผลลัพธ์ครั้งนี้" onBack={() => nav.goBack()} />}
      footer={
        <>
          {diff < 0 ? <Button label="ดูคำแนะนำ" onPress={() => nav.navigate('RedFlag', { reason: 'ปวดมากขึ้นหลังนวด' })} /> : null}
          <Button label="กลับหน้าแรก" variant={diff < 0 ? 'secondary' : 'primary'} onPress={() => nav.popTo('ClientTabs', { screen: 'Home' })} />
        </>
      }
    >
      <View style={{ alignItems: 'center', gap: 8 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: verdict.tone.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={verdict.icon} size="xl" color={verdict.tone.fg} />
        </View>
        <Text variant="headlineSm" align="center">
          {verdict.t}
        </Text>
        <Text variant="bodySm" tone="secondary" align="center">
          {tc.short} · ครั้งที่ {i + 1} · {v.date}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <StatTile label="ครั้งนี้" value={`${v.painBefore} → ${v.painAfter}`} unit="/10" color={tone(v.painBefore, v.painAfter)} />
        {/* ความคืบหน้าทั้งคอร์ส: ก่อนนวดครั้งแรก → หลังนวดครั้งนี้ */}
        {prev ? <StatTile label="ตั้งแต่ครั้งที่ 1" value={`${tc.visits[0].painBefore} → ${v.painAfter}`} unit="/10" color={tone(tc.visits[0].painBefore, v.painAfter)} /> : null}
      </View>

      {/* บันทึกของคลินิก (หลังบ้าน) */}
      <Panel title="วันนี้ทำอะไร" right={<Tag text="จากคลินิก" tone="good" />}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {r.techniques.map((t) => (
            <Tag key={t} text={t} />
          ))}
        </View>
        <Text variant="bodyMd">{r.note}</Text>
        <Text variant="bodyXs" tone="secondary">
          {r.therapist} · {r.duration} นาที
        </Text>
      </Panel>

      {/* ความรู้สึกของผู้ใช้ = ข้อมูลเสริม (คะแนนหลักคือของคลินิก) */}
      <Panel title="ความรู้สึกของคุณ">
        {v.selfPain !== undefined ? (
          <Text variant="bodyMd">ปวด {v.selfPain}/10</Text>
        ) : (
          <Button label="บอกความรู้สึกหลังนวด" variant="secondary" size="md" onPress={() => nav.navigate('PostAssessment', { caseId: tc.id })} />
        )}
      </Panel>

      <Panel title="หลังนวด">
        {r.advice.map((t) => (
          <View key={t} style={{ flexDirection: 'row', gap: space[2], alignItems: 'center' }}>
            <Icon name="check-circle" size="xs" color={colors.brand.primary} />
            <Text variant="bodySm" style={{ flex: 1 }}>
              {t}
            </Text>
          </View>
        ))}
      </Panel>
      <Panel flush>
        <RowLink icon="play" tint={TINT.green} title="ท่าดูแลตัวเอง" sub={tc.selfCare.title} onPress={() => nav.navigate('SelfCare')} last={!bill} />
        {bill ? (
          <RowLink icon="credit-card" tint={TINT.amber} title={bill.status === 'paid' ? 'ใบเสร็จครั้งนี้' : 'บิลครั้งนี้'} sub={`${bill.total} บาท${bill.status === 'paid' ? '' : ' · รอชำระ'}`} onPress={() => nav.navigate('Bill', { id: bill.id })} last />
        ) : null}
      </Panel>

      <Panel title="ครั้งถัดไป">
        <Text variant="bodySm">{finished ? `ครบคอร์ส ${tc.course.total} ครั้งแล้ว แพทย์จะสรุปผลให้` : `คลินิกจะนัดครั้งที่ ${tc.course.done + 1}/${tc.course.total} ตามแผน และแจ้งเตือนในแอป`}</Text>
      </Panel>
    </Screen>
  );
}

/* ============================================================ 17 FOLLOW-UP */

export function FollowUpScreen() {
  const nav = useNav();
  const { colors } = useTheme();
  const { before, log } = useJourney();
  const [pain, setPain] = React.useState<number | undefined>();
  const [sleep, setSleep] = React.useState<number | undefined>();
  const [issue, setIssue] = React.useState<string[]>([]);
  const [sent, setSent] = React.useState(false);
  const worse = (pain !== undefined && pain >= before.pain + 2) || issue.includes('ชา/อ่อนแรง');

  if (sent) {
    return (
      <Screen
        header={<AppBar title="ติดตามผล" onBack={() => nav.goBack()} />}
        footer={
          <>
            {/* ดีขึ้น → นัดครั้งถัดไป · แย่ลง (ปวด บวม ชา มากขึ้นหลังรักษา = ส่งต่อ, CPG หน้า 139) → พบแพทย์ */}
            {worse ? (
              <Button label="ดูคำแนะนำ" onPress={() => nav.navigate('RedFlag', { reason: issue.includes('ชา/อ่อนแรง') ? 'ชา/อ่อนแรงหลังนวด' : 'ปวดมากขึ้นหลังนวด' })} />
            ) : null}
            <Button label="กลับหน้าแรก" variant="secondary" onPress={() => nav.popTo('ClientTabs', { screen: 'Home' })} />
          </>
        }
      >
        <View style={{ alignItems: 'center', gap: space[2], paddingVertical: space[3] }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: worse ? colors.status.danger.bg : colors.brand.subtle }}>
            <Icon name={worse ? 'alert-triangle' : 'check'} size="lg" color={worse ? colors.status.danger.fg : colors.brand.primary} />
          </View>
          <Text variant="titleLg">{worse ? 'แนะนำให้พบแพทย์' : 'บันทึกแล้ว'}</Text>
          <Text variant="bodySm" tone="secondary" align="center">
            {worse ? 'แจ้งผู้ให้บริการแล้ว คลินิกจะติดต่อกลับภายในวันนี้' : 'ผู้ให้บริการจะใช้ผลนี้วางแผนครั้งถัดไป'}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      header={<AppBar title="ติดตามผลหลังนวด" onBack={() => nav.goBack()} />}
      footer={
        <Button
          label="ส่งคำตอบ"
          disabled={pain === undefined || sleep === undefined}
          onPress={() => {
            log('ผู้รับบริการ', `ตอบแบบติดตามผล 3 วัน · ปวด ${pain}${issue.length ? ` · ${issue.join(', ')}` : ''}`);
            // แย่ลง → แจ้งคลินิกให้ติดต่อกลับ (ข้อความในหน้าผลบอกว่าแจ้งแล้ว)
            if (worse) log('ระบบ → ผู้ให้บริการ', 'ติดตามผล: อาการแย่ลง ขอให้ติดต่อกลับวันนี้');
            setSent(true);
          }}
        />
      }
    >
      <Panel title="ความปวดตอนนี้">
        <ScaleSelector label="" value={pain} onChange={setPain} compareValue={before.pain} />
      </Panel>
      <Panel title="การนอน 3 คืนที่ผ่านมา">
        <FaceScale value={sleep} onChange={setSleep} labels={['แย่มาก', 'ไม่ดี', 'พอใช้', 'ดี', 'ดีมาก']} />
      </Panel>
      <Panel title="มีอาการเหล่านี้ไหม">
        <ReplyChips
          options={['ไม่มี', 'ปวดมากขึ้น', 'ชา/อ่อนแรง', 'บวม/ช้ำ']}
          selected={issue}
          onPick={(o) => setIssue((cur) => (o === 'ไม่มี' ? ['ไม่มี'] : cur.includes(o) ? cur.filter((x) => x !== o) : [...cur.filter((x) => x !== 'ไม่มี'), o]))}
        />
      </Panel>
    </Screen>
  );
}

/* ============================================================ 18 SELF-CARE */

/** ท่าฤๅษีดัดตนตาม 7 กลุ่มอาการ (Knowledge Hub: ยืดเหยียด 7 กลุ่มอาการ) */
/** หลักการยืด (CPG_PCU หน้า 152–153) */
const SAFE_STRETCH = ['ยืดช้า ๆ จนรู้สึกตึง', 'ไม่เหวี่ยงหรือขย่ม', 'หายใจตามปกติ', 'ทำต่อเนื่อง 2 สัปดาห์'];

/**
 * หน้ารวมท่ายืด (แบบ gymnerd: การ์ดภาพเคลื่อนไหว 2 คอลัมน์) — แตะการ์ด = รายละเอียดท่า
 * กรองตามบริเวณ · ป้ายบนการ์ด = ส่วนที่ได้ยืด (สีเดียวกับบนหุ่น)
 */
/** หน้ารวมท่ายืด · tab = เปิดจากแท็บเมนู (ไม่มีปุ่มย้อนกลับ) */
export function StretchListScreen({ tab }: { tab?: boolean } = {}) {
  // โหลดข้อมูลของหน้า (ครั้งแรก) → skeleton
  const loading = useScreenData('stretch-list');
  const nav = useNav();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [area, setArea] = React.useState('ทั้งหมด');
  const AREAS = ['ทั้งหมด', 'คอ บ่า ไหล่', 'หลัง สะโพก', 'มือ แขน', 'ขา เข่า', 'ใบหน้า'];
  const AREA_OF: Record<string, string> = { office: 'คอ บ่า ไหล่', frozen_shoulder: 'คอ บ่า ไหล่', herniated_disc: 'หลัง สะโพก', piriformis: 'หลัง สะโพก', trigger_finger: 'มือ แขน', knee: 'ขา เข่า', paralysis: 'ใบหน้า' };
  const list = SYMPTOM_GROUPS.filter((g) => area === 'ทั้งหมด' || AREA_OF[g.id] === area);
  const colW = (Math.min(width, 480) - space[4] * 2 - space[3]) / 2;
  return (
    <Screen header={<AppBar title="ท่ายืดเหยียด" subtitle="ฤๅษีดัดตน 7 กลุ่มอาการ" onBack={tab ? undefined : () => nav.goBack()} />}>
      {loading ? (
        <ScreenSkeleton variant="grid" count={6} />
      ) : (
      <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space[4] }} contentContainerStyle={{ gap: space[2], paddingHorizontal: space[4] }}>
        {AREAS.map((a) => {
          const on = a === area;
          return (
            <Pressable
              key={a}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setArea(a)}
              style={{ height: 36, paddingHorizontal: space[4], borderRadius: radius.full, justifyContent: 'center', backgroundColor: on ? colors.text.primary : colors.surface.default, borderWidth: 1, borderColor: on ? colors.text.primary : colors.border.subtle }}
            >
              <Text variant="labelMd" color={on ? colors.text.inverse : colors.text.primary}>
                {a}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
        {list.map((g) => {
          const m = STRETCH_MOTION[g.stretch.name];
          const gif = stretchGif(m);
          return (
            <Pressable
              key={g.id}
              accessibilityRole="button"
              accessibilityLabel={`${g.stretch.name} ${g.short}`}
              onPress={() => nav.push('SelfCare', { groupId: g.id })}
              style={({ pressed }) => ({ width: colW, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.surface.default, borderWidth: 1, borderColor: colors.border.subtle, opacity: pressed ? 0.85 : 1 })}
            >
              <View style={{ height: colW * 0.9, backgroundColor: colors.surface.sunken }}>
                {gif ? <LoadingImage source={gif} resizeMode="contain" silhouette={colW * 0.55} style={{ width: '100%', height: '100%' }} /> : null}
                {m ? (
                  <View style={{ position: 'absolute', left: space[2], top: space[2], flexDirection: 'row', alignItems: 'center', gap: 4, height: 22, paddingHorizontal: space[2], borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.9)' }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#D93A2B' }} />
                    <Text style={{ fontFamily: fontFamily.semibold, fontSize: 11, lineHeight: 17 }}>{m.primary.label}</Text>
                  </View>
                ) : null}
              </View>
              <View style={{ padding: space[3], gap: 2 }}>
                <Text variant="labelLg" numberOfLines={1}>
                  {g.stretch.name.replace(' 7 ท่า', '')}
                </Text>
                <Text variant="bodyXs" tone="secondary" numberOfLines={1}>
                  {g.short}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      </>
      )}
    </Screen>
  );
}

export function SelfCareScreen({ route }: { route: { params?: { groupId?: string } } }) {
  if (!route.params?.groupId) return <StretchListScreen />;
  return <StretchDetail groupId={route.params.groupId} />;
}

function StretchDetail({ groupId }: { groupId: string }) {
  // โหลดข้อมูลของหน้า (ครั้งแรก) → skeleton
  const loading = useScreenData(`stretch-${groupId}`);
  const nav = useNav();
  const { colors } = useTheme();
  const [done, setDone] = React.useState<string[]>([]);
  const group = SYMPTOM_GROUPS.find((g) => g.id === groupId);
  if (!group) return <NotFoundScreen title="ท่ายืดเหยียด" message="ไม่พบท่านี้" />;
  const isDone = done.includes(group.id);
  // ถ้าท่านั้นไม่ระบุเวลา ใช้หลักการยืดทั่วไปของ CPG (หน้า 152): ค้าง 20–30 วินาที 5–10 ครั้ง วันละ 2 ชุด
  const dosage =
    [group.stretch.hold && `ค้าง ${group.stretch.hold}`, group.stretch.reps && `ทำ ${group.stretch.reps}`].filter(Boolean).join(' · ') ||
    'ค้าง 20–30 วินาที · 5–10 ครั้ง · วันละ 2 ชุด'

  return (
    <Screen header={<AppBar eyebrow="ท่ายืดเหยียด" title={group.stretch.name.replace(' 7 ท่า', '')} subtitle={group.short} onBack={() => nav.goBack()} />}>
      {loading ? (
        <ScreenSkeleton variant="detail" />
      ) : (
      <>
      {/* ภาพท่า */}
      <Panel>
        {STRETCH_MOTION[group.stretch.name] ? (
          <StretchDemo key={group.id} motion={STRETCH_MOTION[group.stretch.name]} steps={group.stretch.steps} flushTop />
        ) : (
          <Placeholder height={160} label="วิดีโอสาธิตท่า" icon="play-circle" />
        )}
        <View style={{ gap: 2 }}>
          <Text variant="titleLg">{group.stretch.name}</Text>
          <Text variant="bodySm" tone="secondary">
            {group.name}
          </Text>
        </View>
      </Panel>

      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <StatTile label="ค้าง" value={group.stretch.hold ?? '20–30 วิ'} small />
        <StatTile label="ทำ" value={group.stretch.reps ?? '5–10 ครั้ง'} small />
        <StatTile label="ต่อวัน" value="2 ชุด" small />
      </View>

      <Panel icon="list" tint={TINT.green} title="ขั้นตอน" right={<Tag text={`${group.stretch.steps.length} ขั้น`} />}>
        {group.stretch.steps.map((step, i) => (
          <View key={step} style={{ flexDirection: 'row', gap: space[3], alignItems: 'flex-start' }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.brand.subtle, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="labelSm" color={colors.brand.primary}>
                {i + 1}
              </Text>
            </View>
            <Text variant="bodyMd" style={{ flex: 1 }}>
              {step}
            </Text>
          </View>
        ))}
        <Button
          label={isDone ? 'ทำแล้ววันนี้' : 'ทำท่านี้แล้ว'}
          variant={isDone ? 'secondary' : 'primary'}
          iconLeft="check"
          size="md"
          onPress={() => setDone(isDone ? done.filter((d) => d !== group.id) : [...done, group.id])}
        />
      </Panel>

      {group.stretch.benefit ? (
        <Panel icon="heart" tint={TINT.blue} title="ประโยชน์">
          <Text variant="bodyMd">{group.stretch.benefit}</Text>
        </Panel>
      ) : null}

      {/* ยืดอย่างปลอดภัย (CPG_PCU หน้า 152–153) */}
      <Panel icon="shield" tint={TINT.amber} title="ยืดอย่างปลอดภัย">
        {SAFE_STRETCH.map((t) => (
          <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: TINT.amber }} />
            <Text variant="bodySm">{t}</Text>
          </View>
        ))}
      </Panel>
      <Panel icon="alert-triangle" tint={TINT.red} title="หยุดทำและพบแพทย์หาก">
        {['ปวดเสียวฉับพลันขณะยืด', ...(group.referSignals ?? [])].map((t) => (
          <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: TINT.red }} />
            <Text variant="bodySm">{t}</Text>
          </View>
        ))}
      </Panel>
      </>
      )}
    </Screen>
  );
}
