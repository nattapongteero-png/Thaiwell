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
} from '../../design-system';
import { KH_SOURCES, SYMPTOM_GROUPS } from '../../data/thaiMassageKnowledge';
import { STRETCH_MOTION } from '../../data/stretchMotion';
import { useJourney } from '../../state/JourneyContext';
import { useNav } from '../../navigation/types';
import { NotFoundScreen } from './NotFound';

/* ============================================================ 15 POST-SERVICE ASSESSMENT */

export function PostAssessmentScreen({ route }: { route?: { params?: { caseId?: string; draftId?: string; looseId?: string } } }) {
  const nav = useNav();
  const { before, setBefore, setAfter, log, newPatient, setCareStage, drafts, promoteDraft, cases, recordCaseVisit, removeLooseBooking } = useJourney();
  // นวดของเรื่องไหน (ส่งต่อมาจากเช็กอิน) → บันทึกผลลงเรื่องนั้นเท่านั้น
  const target = route?.params ?? {};
  const draft = drafts.find((x) => x.id === target.draftId);
  const tc = cases.find((c) => c.id === target.caseId);
  // ก่อนนวด = คะแนนของเรื่องนี้ (ใบร่าง = ตอนประเมิน · ใบการรักษา = ก่อนนวดครั้งล่าสุด)
  const basePain = draft?.pain ?? tc?.visits[tc.visits.length - 1]?.painBefore ?? before.pain;
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
      header={<AppBar title="หลังนวดรู้สึกอย่างไร" subtitle="เทียบกับก่อนนวด" onBack={() => nav.goBack()} />}
      footer={
        <Button
          label="ดูผลลัพธ์ของฉัน"
          iconRight="arrow-right"
          disabled={!complete}
          onPress={() => {
            setAfter({ pain: pain!, stiffness: stiff!, mobility: Math.min(5, before.mobility + 2), stress: Math.max(1, before.stress - 2), sleep: before.sleep });
            log('ผู้รับบริการ', `บันทึกแบบประเมินหลังนวด · ปวด ${basePain} → ${pain}`);
            // อาการผิดปกติหลังนวด → บันทึกแจ้งผู้ให้บริการ (ข้อความบนหน้านี้บอกว่าแจ้งแล้ว)
            if (hasAdverse) log('ระบบ → ผู้ให้บริการ', `แจ้งอาการผิดปกติหลังนวด: ${adverse.join(', ')}`);
            if (newPatient) setCareStage('served');
            // ใบร่าง → นวดครั้งแรกแล้ว ผู้ให้บริการตั้งชื่อโรค → ใบการรักษา · ใบการรักษา → เพิ่มครั้งการรักษา · จองไว้ก่อนประเมิน → นัดนี้ใช้แล้ว
            if (draft) promoteDraft(draft.id, pain!);
            else if (tc) recordCaseVisit(tc.id, basePain, pain!);
            else if (target.looseId) removeLooseBooking(target.looseId);
            nav.navigate('SessionResult', { caseId: draft ? `case-${draft.id}` : tc?.id });
          }}
        />
      }
    >
      <Card>
        <ScaleSelector label="ความปวดตอนนี้" value={pain} onChange={setPain} compareValue={before.pain} minLabel="ไม่ปวด" maxLabel="ปวดมาก" />
        <ScaleSelector label="ความตึงตอนนี้" value={stiff} onChange={setStiff} compareValue={before.stiffness} minLabel="ไม่ตึง" maxLabel="ตึงมาก" />
      </Card>
      <Card>
        <Text variant="titleSm">ความผ่อนคลาย</Text>
        <FaceScale value={relax} onChange={setRelax} labels={['ไม่เลย', 'น้อย', 'ปานกลาง', 'มาก', 'มากที่สุด']} />
        <Text variant="titleSm">ความพึงพอใจต่อบริการ</Text>
        <FaceScale value={sat} onChange={setSat} labels={['ไม่พอใจ', 'น้อย', 'ปานกลาง', 'พอใจ', 'พอใจมาก']} />
      </Card>
      <Card>
        <Text variant="titleSm">มีอาการผิดปกติหลังนวดไหม</Text>
        <ChipGroup
          options={['ไม่มี', 'ระบม/ช้ำ', 'เวียนศีรษะ', 'ปวดมากขึ้น', 'ชา']}
          value={adverse}
          multiple
          onChange={(v) => {
            const added = v.find((x) => !adverse.includes(x));
            setAdverse(added === 'ไม่มี' ? ['ไม่มี'] : v.filter((x) => x !== 'ไม่มี').length ? v.filter((x) => x !== 'ไม่มี') : ['ไม่มี']);
          }}
        />
        {hasAdverse ? <Banner tone="warning" title="ผู้ให้บริการจะได้รับแจ้งทันที" message="หากอาการไม่ดีขึ้นภายใน 24 ชม. ระบบจะแนะนำให้พบแพทย์" /> : null}
      </Card>
    </Screen>
  );
}

/* ============================================================ 16 SESSION RESULT */

export function SessionResultScreen({ route }: { route?: { params?: { caseId?: string } } }) {
  const nav = useNav();
  const { colors } = useTheme();
  const { before, after } = useJourney();
  const caseId = route?.params?.caseId;
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
          ) : (
            <Button label="จองครั้งถัดไป" iconLeft="calendar" onPress={() => nav.navigate('Booking', caseId ? { caseId } : undefined)} />
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
      </View>

      <GridRow>
        <Col span={2}>
          <Card>
            <StatDelta label="ความปวด" before={before.pain} after={a.pain} />
          </Card>
        </Col>
        <Col span={2}>
          <Card>
            <StatDelta label="ความตึง" before={before.stiffness} after={a.stiffness} />
          </Card>
        </Col>
      </GridRow>

      <Card>
        <Text variant="titleSm">เทียบก่อน–หลัง</Text>
        <BeforeAfterBars
          data={[
            { label: 'ความปวด (0–10)', before: before.pain, after: a.pain },
            { label: 'ความตึง (0–10)', before: before.stiffness, after: a.stiffness },
            { label: 'การเคลื่อนไหว (1–5)', before: before.mobility, after: a.mobility, max: 5 },
          ]}
        />
      </Card>

      <Card variant="filled">
        <AILabel text="สรุปโดย AI · ผู้ให้บริการตรวจแล้ว" />
        <Text variant="bodyMd">
          {`ความปวด ${before.pain} → ${a.pain} ความตึง ${before.stiffness} → ${a.stiffness}`}
          {diff >= 1 ? ' ตอบสนองต่อการนวดดี ทำท่ายืดที่บ้านต่อเนื่อง' : diff === 0 ? ' ผู้ให้บริการจะปรับแผนครั้งถัดไป' : ' แนะนำให้แพทย์ประเมินก่อนนวดครั้งถัดไป'}
        </Text>
      </Card>

      {/* หลังนวด — ตำราอ้างอิงฯ หน้า 402 (อาหารแสลง · ห้ามบีบ/ดัดส่วนที่เจ็บ) · หน้า 414 (ไม่อาบน้ำทันทีหลังประคบ) */}
      <SectionHeader title="หลังนวด" />
      <Card>
        {['งดของมัน ของทอด ของหมักดอง และแอลกอฮอล์', 'ไม่บีบหรือดัดตรงที่เจ็บเอง', 'ไม่อาบน้ำทันทีหลังประคบ'].map((t) => (
          <HStack key={t} gap={2}>
            <Icon name="check-circle" size="xs" color={colors.brand.primary} />
            <Text variant="bodySm" style={{ flex: 1 }}>
              {t}
            </Text>
          </HStack>
        ))}
        <Button label="ท่าดูแลตัวเอง" variant="ghost" iconLeft="play" fullWidth={false} onPress={() => nav.navigate('SelfCare')} />
      </Card>

      <SectionHeader title="การติดตามผล" />
      <Card>
        {[
          { t: 'พรุ่งนี้', d: 'เช็กอาการระบม/ข้างเคียง', done: false },
          { t: '3 วัน', d: 'ความปวดและการนอน', done: false },
          { t: '7 วัน', d: 'สรุปผลและแนะนำนัดถัดไป', done: false },
        ].map((f, i) => (
          <HStack key={f.t} gap={3}>
            <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.border.default, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="labelSm">{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="titleSm">{f.t}</Text>
              <Text variant="bodySm" tone="secondary">
                {f.d}
              </Text>
            </View>
          </HStack>
        ))}
      </Card>
    </Screen>
  );
}

/* ============================================================ 17 FOLLOW-UP */

export function FollowUpScreen() {
  const nav = useNav();
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
            ) : (
              <Button label="จองครั้งถัดไป" iconLeft="calendar" onPress={() => nav.navigate('Booking')} />
            )}
            <Button label="กลับหน้าแรก" variant="secondary" onPress={() => nav.popTo('ClientTabs', { screen: 'Home' })} />
          </>
        }
      >
        {worse ? (
          <Banner tone="danger" title="แนะนำให้พบแพทย์" message="แจ้งผู้ให้บริการแล้ว คลินิกจะติดต่อกลับภายในวันนี้" />
        ) : (
          <Banner tone="success" title="บันทึกแล้ว" message="ผู้ให้บริการจะใช้ผลนี้วางแผนครั้งถัดไป" />
        )}
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
      <ProgressBar value={((pain !== undefined ? 1 : 0) + (sleep !== undefined ? 1 : 0) + (issue.length ? 1 : 0)) / 3} label="ความคืบหน้า" />
      <Card>
        <Text variant="overline" tone="tertiary">
          คำถามที่ 1
        </Text>
        <ScaleSelector label="ความปวดตอนนี้" value={pain} onChange={setPain} compareValue={before.pain} />
      </Card>
      <Card>
        <Text variant="overline" tone="tertiary">
          คำถามที่ 2
        </Text>
        <Text variant="titleSm">การนอน 3 คืนที่ผ่านมา</Text>
        <FaceScale value={sleep} onChange={setSleep} labels={['แย่มาก', 'ไม่ดี', 'พอใช้', 'ดี', 'ดีมาก']} />
      </Card>
      <Card>
        <Text variant="overline" tone="tertiary">
          คำถามที่ 3
        </Text>
        <Text variant="titleSm">มีอาการเหล่านี้ไหม</Text>
        <ChipGroup options={['ไม่มี', 'ปวดมากขึ้น', 'ชา/อ่อนแรง', 'บวม/ช้ำ']} value={issue} onChange={setIssue} multiple />
      </Card>
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
