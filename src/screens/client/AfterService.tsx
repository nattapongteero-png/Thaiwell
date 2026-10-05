import React from 'react';
import { View } from 'react-native';
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
} from '../../design-system';
import { KH_SOURCES, SYMPTOM_GROUPS } from '../../data/thaiMassageKnowledge';
import { useJourney } from '../../state/JourneyContext';
import { useNav } from '../../navigation/types';

/* ============================================================ 15 POST-SERVICE ASSESSMENT */

export function PostAssessmentScreen() {
  const nav = useNav();
  const { before, setAfter, log, newPatient, setCareStage, drafts, activeDraftId, promoteDraft } = useJourney();
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
            log('ผู้รับบริการ', 'บันทึกแบบประเมินหลังนวด');
            if (newPatient) setCareStage('served');
            // ใบร่างที่มารับบริการ → นวดครั้งแรกแล้ว ผู้ให้บริการตั้งชื่อโรค → กลายเป็นใบการรักษา (แท็บ "รักษา…")
            const d = drafts.find((x) => x.id === activeDraftId);
            if (d) promoteDraft(d.id, pain!);
            nav.navigate('SessionResult');
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

export function SessionResultScreen() {
  const nav = useNav();
  const { colors } = useTheme();
  const { before, after } = useJourney();
  const a = after ?? { pain: 3, stiffness: 3, mobility: 4, stress: 2, sleep: 2 };

  return (
    <Screen
      header={<AppBar title="ผลลัพธ์ครั้งนี้" onBack={() => nav.goBack()} />}
      footer={
        <>
          <Button label="จองครั้งถัดไป" iconLeft="calendar" onPress={() => nav.navigate('ClientTabs', { screen: 'Booking' })} />
          <Button label="กลับหน้าแรก" variant="secondary" onPress={() => nav.reset({ index: 0, routes: [{ name: 'ClientTabs' }] })} />
        </>
      }
    >
      <View style={{ alignItems: 'center', gap: 8 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.status.success.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="award" size="xl" color={colors.status.success.fg} />
        </View>
        <Text variant="headlineSm" align="center">
          อาการดีขึ้นอย่างชัดเจน
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
          ครั้งนี้เน้นคอ–บ่าขวาด้วยแรงกดเบา–ปานกลางตามข้อควรระวังเรื่องความดัน ผลตอบสนองดีใกล้เคียงครั้งก่อน แนะนำยืดคอทุก 1 ชั่วโมงระหว่างทำงาน
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
              <Button label="ดูคำแนะนำ" onPress={() => nav.navigate('RedFlag')} />
            ) : (
              <Button label="จองครั้งถัดไป" iconLeft="calendar" onPress={() => nav.navigate('ClientTabs', { screen: 'Booking' })} />
            )}
            <Button label="กลับหน้าแรก" variant="secondary" onPress={() => nav.reset({ index: 0, routes: [{ name: 'ClientTabs' }] })} />
          </>
        }
      >
        {worse ? (
          <Banner tone="danger" title="แนะนำให้พบแพทย์" message="คลินิกจะติดต่อกลับภายในวันนี้" />
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
            log('ผู้รับบริการ', 'ตอบแบบติดตามผล 3 วัน');
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
export function SelfCareScreen() {
  const nav = useNav();
  const { colors } = useTheme();
  const [groupId, setGroupId] = React.useState('office');
  const [done, setDone] = React.useState<string[]>([]);
  const group = SYMPTOM_GROUPS.find((g) => g.id === groupId)!;
  const isDone = done.includes(group.id);
  // ถ้าท่านั้นไม่ระบุเวลา ใช้หลักการยืดทั่วไปของ CPG (หน้า 152): ค้าง 20–30 วินาที 5–10 ครั้ง วันละ 2 ชุด
  const dosage =
    [group.stretch.hold && `ค้าง ${group.stretch.hold}`, group.stretch.reps && `ทำ ${group.stretch.reps}`].filter(Boolean).join(' · ') ||
    'ค้าง 20–30 วินาที · 5–10 ครั้ง · วันละ 2 ชุด'

  return (
    <Screen header={<AppBar title="ดูแลตนเองที่บ้าน" subtitle="ท่าฤๅษีดัดตนตามกลุ่มอาการ" onBack={() => nav.goBack()} />}>
      <ChipSection
        title="กลุ่มอาการของคุณ"
        options={SYMPTOM_GROUPS.map((g) => g.short)}
        value={[group.short]}
        onChange={(v) => {
          const picked = SYMPTOM_GROUPS.find((g) => g.short === v[v.length - 1]);
          if (picked) setGroupId(picked.id);
        }}
      />

      <Card>
        <Placeholder height={160} label="วิดีโอสาธิตท่า" icon="play-circle" />
        <HStack justify="space-between" align="flex-start">
          <View style={{ flex: 1, gap: space[1] }}>
            <Text variant="titleLg">{group.stretch.name}</Text>
            <Text variant="bodySm" tone="secondary">
              {group.name}
            </Text>
          </View>
          {isDone ? <Icon name="check-circle" color={colors.status.success.fg} /> : null}
        </HStack>
        {dosage ? <Badge label={dosage} tone="brand" icon="clock" /> : null}
        <VStack gap={2}>
          {group.stretch.steps.map((step, i) => (
            <HStack key={step} gap={3} align="flex-start">
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brand.subtle, alignItems: 'center', justifyContent: 'center' }}>
                <Text variant="labelSm" color={colors.brand.onSubtle}>
                  {i + 1}
                </Text>
              </View>
              <Text variant="bodyMd" style={{ flex: 1 }}>
                {step}
              </Text>
            </HStack>
          ))}
        </VStack>
        {group.stretch.benefit ? (
          <Text variant="bodySm" tone="secondary">
            ประโยชน์: {group.stretch.benefit}
          </Text>
        ) : null}
        <Button
          label={isDone ? 'ทำแล้ววันนี้' : 'ทำท่านี้แล้ว'}
          variant={isDone ? 'tertiary' : 'primary'}
          iconLeft={isDone ? 'check' : 'play'}
          size="md"
          onPress={() => setDone(isDone ? done.filter((d) => d !== group.id) : [...done, group.id])}
        />
      </Card>

      <Banner
        tone="info"
        title="ยืดอย่างปลอดภัย"
        message="ยืดช้า ๆ จนรู้สึกตึง ไม่เหวี่ยงหรือขย่ม ไม่กลั้นหายใจ · หยุดถ้าปวดเสียวฉับพลัน · ทำต่อเนื่อง 2 สัปดาห์ (CPG_PCU หน้า 152–153)"
      />
      {group.referSignals ? (
        <Banner tone="warning" title="หยุดทำและพบแพทย์หากมีอาการ" message={group.referSignals.join(' · ')} />
      ) : null}
    </Screen>
  );
}
