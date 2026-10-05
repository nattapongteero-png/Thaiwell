import React from 'react';
import { Pressable, View } from 'react-native';
import {
  AppBar,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Divider,
  GridRow,
  HStack,
  Icon,
  JourneyStepper,
  ListItem,
  Screen,
  SectionHeader,
  Switch,
  Text,
  PainAreaChart,
  VStack,
  radius,
  space,
  useTheme,
  type IconName, ScreenSkeleton, useScreenData, Panel, StatTile, Tag, RowLink, TINT, ProfileAvatar, ElementPill, BottomSheet, TextField, ReplyChips, InfoRow,
} from '../../design-system';
import { NotFoundScreen } from './NotFound';
import { birthElement, dominantElement } from '../../data/thaiMassageKnowledge';
import { HISTORY, useJourney } from '../../state/JourneyContext';
import { TREATMENT_CASES, ARCHIVED_CASES, type TreatmentCase } from '../../data/homeFeed';
import { PainPill, TreatmentDetailBody, VisitTabs } from './home/TreatmentDetailBody';

import { useNav } from '../../navigation/types';

/* ============================================================ 19 PROGRESS */

/**
 * ประวัติการรักษา — รายการเรื่องที่ดูแล (กำลังรักษา + รักษาจบแล้ว) · แตะเพื่อดูรายละเอียดแบบ bento
 * เรื่องที่รักษาครบคอร์สแล้วย้ายมาอยู่ที่นี่ (ไม่อยู่บนหน้าแรก)
 */
export function ProgressScreen() {
  // โหลดข้อมูลของหน้า (ครั้งแรก) → skeleton
  const loading = useScreenData('history');
  const nav = useNav();
  const { colors } = useTheme();
  // ใบการรักษาชุดเดียวกับหน้าแรก (รวมครั้งที่นวดเพิ่ม/นัดที่เปลี่ยน) · ยังไม่มีครั้งการรักษา = ไม่แสดงในประวัติ
  const { newPatient, cases } = useJourney();
  const active = cases.filter((c) => c.visits.length > 0);
  const done = newPatient ? [] : ARCHIVED_CASES;
  /** การ์ดเรื่องที่รักษา (แบบรายการผู้มารับบริการของหลังบ้าน): ไอคอน · ชื่อ · ครั้ง/ช่วงวัน · ดีขึ้น % · ป้ายคะแนนหลังนวดล่าสุด */
  const Row = ({ c, finished }: { c: TreatmentCase; finished?: boolean }) => {
    const first = c.visits[0];
    const last = c.visits[c.visits.length - 1];
    const pct = Math.round(((first.painBefore - last.painAfter) / first.painBefore) * 100);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${c.short} ${c.visits.length} ครั้ง ดีขึ้น ${pct}% ดูรายละเอียด`}
        onPress={() => nav.navigate('TreatmentHistory', { caseId: c.id })}
        style={({ pressed }) => ({ gap: space[3], padding: space[4], borderRadius: 20, backgroundColor: colors.surface.default, borderWidth: 1, borderColor: colors.border.subtle, opacity: pressed ? 0.85 : 1 })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: finished ? colors.surface.sunken : colors.brand.subtle }}>
            <Icon name={finished ? 'check' : 'activity'} size="sm" color={finished ? colors.text.secondary : colors.brand.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="labelLg">{c.short}</Text>
            <Text variant="bodyXs" tone="secondary">
              {c.plan} · {c.visits.length} ครั้ง
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="labelMd" color={pct >= 0 ? colors.brand.primary : colors.status.danger.fg}>
              {pct >= 0 ? '↘' : '↗'} {Math.abs(pct)}%
            </Text>
            <Text variant="bodyXs" tone="tertiary">
              {pct >= 0 ? 'ดีขึ้น' : 'แย่ลง'}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="bodyXs" tone="tertiary">
            {first.date} – {last.date}
          </Text>
          <PainPill label="หลังล่าสุด" v={last.painAfter} />
        </View>
      </Pressable>
    );
  };
  return (
    <Screen header={<AppBar title="ประวัติการรักษา" />}>
      {loading ? (
        <ScreenSkeleton variant="list" count={3} />
      ) : (
      <>
      {active.length ? (
        <>
          <SectionHeader title="กำลังรักษา" />
          {active.map((c) => (
            <Row key={c.id} c={c} />
          ))}
        </>
      ) : null}
      {done.length ? (
        <>
          <SectionHeader title="รักษาจบแล้ว" />
          {done.map((c) => (
            <Row key={c.id} c={c} finished />
          ))}
        </>
      ) : null}
      {!active.length && !done.length ? (
        <Text variant="bodyMd" tone="secondary" align="center">
          ยังไม่มีประวัติการรักษา
        </Text>
      ) : null}
      </>
      )}
    </Screen>
  );
}

/** รายละเอียดประวัติการรักษาของเรื่องหนึ่ง — หน้าตาเดียวกับ bottom sheet ในแชท (และหน้าผู้มารับบริการของหลังบ้าน) */
export function TreatmentHistoryScreen({ route }: { route: { params: { caseId: string } } }) {
  const nav = useNav();
  const { cases } = useJourney();
  const { colors } = useTheme();
  const c = [...cases, ...ARCHIVED_CASES].find((x) => x.id === route.params.caseId);
  const [visit, setVisit] = React.useState<number | null>(null);
  if (!c) return <NotFoundScreen title="ประวัติการรักษา" />;
  // เนื้อหาเดียวกับ bottom sheet รายละเอียดการรักษาในแชท · แถบเลือกครั้งค้างใต้หัวหน้า
  return (
    <Screen
      header={
        <View style={{ backgroundColor: colors.surface.canvas, paddingBottom: space[2] }}>
          <AppBar title={`รักษา${c.short}`} onBack={() => nav.goBack()} />
          <View style={{ paddingHorizontal: space[4] }}>
            <VisitTabs inset={space[4]} count={c.visits.length} dates={c.visits.map((v) => v.date)} value={visit} onChange={setVisit} />
          </View>
        </View>
      }
    >
      <TreatmentDetailBody tc={c} visit={visit} />
    </Screen>
  );
}

/* ============================================================ PROFILE */

export function ProfileScreen() {
  // โหลดข้อมูลของหน้า (ครั้งแรก) → skeleton
  const loading = useScreenData('profile');
  const nav = useNav();
  const { colors, textScale, setTextScale } = useTheme();
  const { client, profile, setProfile, signOut, elements, newPatient, account, cases, drafts, looseBookings, log } = useJourney();
  const { elementsDone } = useJourney();
  const element = newPatient && account && !elementsDone ? birthElement(account.birthDate) : dominantElement(elements);
  const visits = cases.reduce((n, c) => n + c.visits.length, 0);
  // นัดถัดไปจากทุกที่ (ใบการรักษา · ใบร่าง · จองไว้ก่อนประเมิน) · ยกเลิกแล้ว = ไม่นับ · วันนี้มาก่อน
  const appts = [
    ...cases.filter((c) => c.appointment.date !== '-').map((c) => ({ date: c.appointment.today ? 'วันนี้' : c.appointment.date, time: c.appointment.time })),
    ...drafts.filter((d) => d.booking).map((d) => ({ date: d.booking!.date, time: d.booking!.time })),
    ...looseBookings.map((b) => ({ date: b.date, time: b.time })),
  ];
  const nextAppt = appts.find((a) => a.date === 'วันนี้') ?? appts.find((a) => a.date === 'พรุ่งนี้') ?? appts[0];
  /** แก้ข้อมูลสุขภาพ (กรอกเอง — Health ID ไม่ส่งมา) */
  const [editing, setEditing] = React.useState<null | 'conditions' | 'medications' | 'allergies'>(null);
  const [linking, setLinking] = React.useState(false);
  // ยังไม่ได้กรอก ≠ ไม่มี (ผู้ใช้ใหม่ยังไม่ได้บอก)
  const none = (a: string[]) => a.join(', ') || (profile.healthKnown === false ? 'ยังไม่ได้กรอก' : 'ไม่มี');
  return (
    <Screen header={<AppBar title="โปรไฟล์" />}>
      {loading ? (
        <ScreenSkeleton variant="list" count={4} />
      ) : (
      <>
      {/* หัวโปรไฟล์แบบหลังบ้าน: รูป · ชื่อ · HN/อายุ · ป้ายโรคประจำตัว · ธาตุ */}
      <Panel>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <ProfileAvatar sex={account?.sex ?? 'ชาย'} size={68} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="titleLg">{client.name}</Text>
            <Text variant="bodyXs" tone="secondary">
              {[client.hn, `${client.age} ปี`, client.occupation].filter(Boolean).join(' · ')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {profile.healthKnown === false ? null : <Tag text={profile.conditions.length ? profile.conditions.join(', ') : 'ไม่มีโรคประจำตัว'} tone={profile.conditions.length ? 'warn' : undefined} />}
              {element ? <ElementPill element={element} label={newPatient && !elementsDone ? 'ธาตุเจ้าเรือน' : 'ธาตุปัจจุบัน'} onPress={() => nav.navigate('ElementQuiz')} /> : null}
            </View>
          </View>
        </View>
      </Panel>

      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <StatTile label="รับบริการแล้ว" value={`${visits}`} unit="ครั้ง" />
        <StatTile label="เรื่องที่ดูแล" value={`${cases.length + drafts.length}`} unit="เรื่อง" />
        <StatTile label="นัดถัดไป" value={nextAppt ? nextAppt.time : '-'} unit={nextAppt ? nextAppt.date : 'ยังไม่มี'} small />
      </View>

      {/* แตะแถว = แก้ข้อมูลนั้น (ใช้คัดกรองข้อห้ามก่อนนวด) */}
      <Panel title="ข้อมูลสุขภาพ" flush>
        <RowLink icon="activity" tint={TINT.red} title="โรคประจำตัว" sub={none(profile.conditions)} onPress={() => setEditing('conditions')} />
        <RowLink icon="package" tint={TINT.amber} title="ยาที่ใช้ประจำ" sub={none(profile.medications)} onPress={() => setEditing('medications')} />
        <RowLink icon="alert-circle" tint={TINT.violet} title="ประวัติแพ้" sub={none(profile.allergies)} onPress={() => setEditing('allergies')} />
        {/* ยังไม่เปิดใช้ → บอกตรง ๆ (ไม่มีลูกศรหลอกให้กด) */}
        <RowLink icon="link" tint={TINT.blue} title="เชื่อมข้อมูลจากโรงพยาบาล" sub={profile.phrSource ? `เชื่อมแล้ว · ${profile.phrSource}` : 'ดึงโรคประจำตัว ยา และประวัติแพ้'} onPress={() => setLinking(true)} last />
      </Panel>

      <Panel title="การตั้งค่า" flush>
        <RowLink icon="lock" tint={TINT.slate} title="ความเป็นส่วนตัวและความยินยอม" onPress={() => nav.navigate('Privacy')} />
        <RowLink icon="type" tint={TINT.slate} title="ตัวอักษรขนาดใหญ่" sub="สำหรับผู้สูงอายุ" right={<Switch value={textScale > 1} onChange={(v) => setTextScale(v ? 1.2 : 1)} label="ตัวอักษรขนาดใหญ่" />} />
        <RowLink icon="globe" tint={TINT.slate} title="ภาษา" sub="ไทย" />
        <RowLink icon="briefcase" tint={TINT.slate} title="โหมดผู้ให้บริการ" onPress={() => nav.navigate('ProviderTabs')} last />
      </Panel>

      <Panel flush>
        <RowLink
          icon="log-out"
          title="ออกจากระบบ"
          danger
          last
          onPress={() => {
            signOut();
            nav.reset({ index: 0, routes: [{ name: 'Auth' }] });
          }}
        />
      </Panel>
      <HealthEditSheet
        field={editing}
        value={editing ? profile[editing] : []}
        onClose={() => setEditing(null)}
        onSave={(field, list) => {
          setProfile({ ...profile, [field]: list, healthKnown: true });
          log('ผู้รับบริการ', `แก้ไข${HEALTH_FIELDS[field].title}: ${list.join(', ') || 'ไม่มี'}`);
          setEditing(null);
        }}
      />
      <PhrLinkSheet
        visible={linking}
        onClose={() => setLinking(false)}
        onImport={(src, rec) => {
          // รวมกับที่กรอกเองไว้ (ไม่ทับทิ้ง)
          const merge = (a: string[], b: string[]) => [...a, ...b].filter((x, i, all) => all.indexOf(x) === i);
          setProfile({ ...profile, conditions: merge(profile.conditions, rec.conditions), medications: merge(profile.medications, rec.medications), allergies: merge(profile.allergies, rec.allergies), healthKnown: true, phrSource: src });
          log('ผู้รับบริการ', `เชื่อมประวัติสุขภาพจาก ${src}`);
          setLinking(false);
        }}
      />
      {/* เครดิตตามเงื่อนไข CC BY 4.0 ของโมเดลกายวิภาค */}
      <Text variant="caption" tone="tertiary" align="center">
        โมเดลกายวิภาค 3D: BodyParts3D © The Database Center for Life Science (CC BY 4.0) ดัดแปลงผ่าน human-atlas
      </Text>
      </>
      )}
    </Screen>
  );
}

const HEALTH_FIELDS = {
  conditions: { title: 'โรคประจำตัว', common: ['ความดันโลหิตสูง', 'เบาหวาน', 'โรคหัวใจ', 'กระดูกพรุน', 'ไขมันในเลือดสูง'], placeholder: 'โรคอื่น ๆ' },
  medications: { title: 'ยาที่ใช้ประจำ', common: ['ยาลดความดัน', 'ยาเบาหวาน', 'ยาละลายลิ่มเลือด', 'ยาแก้ปวด'], placeholder: 'ชื่อยาอื่น ๆ' },
  allergies: { title: 'ประวัติแพ้', common: ['แพ้ยา', 'แพ้สมุนไพร', 'แพ้น้ำมันนวด', 'แพ้อาหาร'], placeholder: 'แพ้อะไรอีก' },
} as const;

/** แก้ข้อมูลสุขภาพ: เลือกจากที่พบบ่อย + พิมพ์เพิ่ม · "ไม่มี" = บอกแล้วว่าไม่มี (ต่างจากยังไม่ได้กรอก) */
function HealthEditSheet({ field, value, onClose, onSave }: { field: keyof typeof HEALTH_FIELDS | null; value: string[]; onClose: () => void; onSave: (f: keyof typeof HEALTH_FIELDS, v: string[]) => void }) {
  const [list, setList] = React.useState<string[]>([]);
  const [other, setOther] = React.useState('');
  React.useEffect(() => {
    setList(value);
    setOther('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field]);
  if (!field) return null;
  const f = HEALTH_FIELDS[field];
  const toggle = (o: string) => (o === 'ไม่มี' ? setList([]) : setList((l) => (l.includes(o) ? l.filter((x) => x !== o) : [...l, o])));
  const extra = list.filter((x) => !(f.common as readonly string[]).includes(x));
  return (
    <BottomSheet
      visible
      onClose={onClose}
      title={f.title}
      heightRatio={0.7}
      footer={<Button label="บันทึก" onPress={() => onSave(field, [...list, ...(other.trim() ? [other.trim()] : [])].filter((x, i, a) => a.indexOf(x) === i))} />}
    >
      <ReplyChips options={[...f.common, ...extra, 'ไม่มี']} selected={list.length ? list : ['ไม่มี']} onPick={toggle} />
      <TextField label={f.placeholder} value={other} onChangeText={setOther} placeholder="พิมพ์แล้วกดบันทึก" />
    </BottomSheet>
  );
}

/**
 * เชื่อมประวัติสุขภาพจากโรงพยาบาล (PHR/HIS ตามสิทธิ) — ขอความยินยอม → ดึงข้อมูล → ตรวจแล้วนำเข้าโปรไฟล์
 * ⚠️ ต้นแบบ: ข้อมูลที่ดึงมาเป็นตัวอย่าง (ยังไม่ได้ต่อระบบโรงพยาบาลจริง)
 */
const PHR_SOURCES = [
  { name: 'โรงพยาบาลตามสิทธิบัตรทอง', sub: 'ผ่าน Health ID', rec: { conditions: ['ความดันโลหิตสูง'], medications: ['Amlodipine 5 mg'], allergies: [] as string[] } },
  { name: 'โรงพยาบาลเอกชนที่เคยรักษา', sub: 'ผ่าน PHR', rec: { conditions: [] as string[], medications: [] as string[], allergies: ['แพ้ยา Ibuprofen'] } },
];
function PhrLinkSheet({ visible, onClose, onImport }: { visible: boolean; onClose: () => void; onImport: (src: string, rec: { conditions: string[]; medications: string[]; allergies: string[] }) => void }) {
  const { colors } = useTheme();
  const [src, setSrc] = React.useState(0);
  const [stage, setStage] = React.useState<'pick' | 'loading' | 'review'>('pick');
  React.useEffect(() => {
    if (visible) setStage('pick');
  }, [visible]);
  const s = PHR_SOURCES[src];
  const fetchRec = () => {
    setStage('loading');
    setTimeout(() => setStage('review'), 1200);
  };
  const list = (t: string, v: string[]) => <InfoRow key={t} k={t} v={v.join(', ') || 'ไม่มี'} />;
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="เชื่อมข้อมูลจากโรงพยาบาล"
      heightRatio={0.72}
      footer={
        stage === 'review' ? (
          <Button label="นำเข้าโปรไฟล์" onPress={() => onImport(s.name, s.rec)} />
        ) : (
          <Button label={stage === 'loading' ? 'กำลังดึงข้อมูล…' : 'ยินยอมและดึงข้อมูล'} disabled={stage === 'loading'} onPress={fetchRec} />
        )
      }
    >
      {stage === 'review' ? (
        <Panel title={`พบข้อมูลจาก${s.name}`}>
          {list('โรคประจำตัว', s.rec.conditions)}
          {list('ยาที่ใช้ประจำ', s.rec.medications)}
          {list('ประวัติแพ้', s.rec.allergies)}
          <Text variant="bodyXs" tone="tertiary">
            ตรวจให้ถูกต้องก่อนนำเข้า แก้ไขเองได้ภายหลัง
          </Text>
        </Panel>
      ) : (
        <>
          <Panel flush>
            {PHR_SOURCES.map((x, i) => (
              <RowLink key={x.name} icon="home" tint={TINT.blue} title={x.name} sub={x.sub} last={i === PHR_SOURCES.length - 1} onPress={() => setSrc(i)} right={<Icon name={i === src ? 'check-circle' : 'circle'} size="sm" color={i === src ? colors.brand.primary : colors.text.tertiary} />} />
            ))}
          </Panel>
          <Text variant="bodySm" tone="secondary">
            ดึงเฉพาะโรคประจำตัว ยาที่ใช้ และประวัติแพ้ เพื่อคัดกรองข้อห้ามก่อนนวด ถอนการเชื่อมได้ในหน้าความเป็นส่วนตัว
          </Text>
        </>
      )}
    </BottomSheet>
  );
}

/* ============================================================ 20 PRIVACY CENTER */

export function PrivacyScreen() {
  const nav = useNav();
  const { consents, setConsents, audit, log, signOut, profile, setProfile } = useJourney();
  const [asked, setAsked] = React.useState<null | 'download' | 'delete'>(null);
  const toggle = (k: keyof typeof consents, label: string) => (v: boolean) => {
    setConsents({ ...consents, [k]: v });
    log('ผู้รับบริการ', `${v ? 'ให้' : 'ถอน'}ความยินยอม: ${label}`);
  };
  const items = [
    ['service', 'ใช้ข้อมูลเพื่อให้บริการ', 'user-check'],
    ['aiProcessing', 'AI ช่วยซักประวัติและสรุป', 'cpu'],
    ['followUp', 'ติดตามผลหลังบริการ', 'bell'],
    ['research', 'ใช้เพื่อวิจัย (ไม่ระบุตัวตน)', 'bar-chart-2'],
  ] as const;
  return (
    <Screen header={<AppBar title="ความเป็นส่วนตัว" onBack={() => nav.goBack()} />}>
      <Panel title="ความยินยอมของคุณ" right={<Tag text={`${items.filter(([k]) => consents[k]).length}/${items.length} เปิดอยู่`} tone="good" />} flush>
        {items.map(([k, label, icon], i) => (
          // ข้อที่จำเป็นต่อการให้บริการ → ไม่มีสวิตช์ปิดที่ไม่มีผลจริง (ถอนได้ด้วยการขอลบข้อมูล)
          k === 'service' || k === 'aiProcessing' ? (
            <RowLink key={k} icon={icon} title={label} sub="จำเป็นต่อการใช้บริการ · ถอนได้โดยขอลบข้อมูล" last={i === items.length - 1} right={<Tag text="จำเป็น" />} />
          ) : (
            <RowLink key={k} icon={icon} title={label} last={i === items.length - 1} right={<Switch value={consents[k]} onChange={toggle(k, label)} label={label} />} />
          )
        ))}
      </Panel>

      {/* การเชื่อมข้อมูลกับโรงพยาบาล — ถอนได้ (ข้อมูลที่นำเข้าแล้วยังอยู่ แก้ไขเองได้ในโปรไฟล์) */}
      {profile.phrSource ? (
        <Panel flush>
          <RowLink
            icon="link"
            tint={TINT.blue}
            title={`เชื่อมกับ${profile.phrSource}`}
            sub="ยกเลิกการเชื่อม"
            last
            onPress={() => {
              setProfile({ ...profile, phrSource: undefined });
              log('ผู้รับบริการ', `ยกเลิกการเชื่อมข้อมูลกับ${profile.phrSource}`);
            }}
          />
        </Panel>
      ) : null}

      {/* ใครเข้าถึงข้อมูล: timeline แบบหลังบ้าน */}
      <Panel icon="clock" tint={TINT.violet} title="ใครเข้าถึงข้อมูลของคุณ">
        {audit.map((a, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: space[3] }}>
            <View style={{ alignItems: 'center', width: 12 }}>
              <View style={{ width: 9, height: 9, borderRadius: 5, marginTop: 6, backgroundColor: i === audit.length - 1 ? TINT.violet : '#C8C8C4' }} />
              {i < audit.length - 1 ? <View style={{ flex: 1, width: 1.5, backgroundColor: '#E2E2DF', marginTop: 2 }} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: i < audit.length - 1 ? space[3] : 0 }}>
              <Text variant="bodyXs" tone="secondary">
                วันนี้ {a.at} · {a.actor}
              </Text>
              <Text variant="labelMd">{a.action}</Text>
            </View>
          </View>
        ))}
      </Panel>

      <Panel flush>
        <RowLink
          icon="download"
          tint={TINT.blue}
          title="ดาวน์โหลดข้อมูลของฉัน"
          sub={asked === 'download' ? 'ส่งคำขอแล้ว จะส่งไฟล์ให้ทางอีเมลภายใน 24 ชม.' : undefined}
          onPress={() => {
            setAsked('download');
            log('ผู้รับบริการ', 'ขอดาวน์โหลดข้อมูลของตนเอง');
          }}
        />
        <RowLink icon="trash-2" title="ขอลบข้อมูล" sub="ลบบัญชีและข้อมูลทั้งหมด" danger last onPress={() => setAsked('delete')} />
      </Panel>
      {/* ยืนยันก่อนลบ (ย้อนไม่ได้) */}
      {asked === 'delete' ? (
        <Panel icon="alert-triangle" tint={TINT.red} title="ลบข้อมูลทั้งหมด?">
          <Text variant="bodySm" tone="secondary">
            ประวัติการรักษา นัด และผลประเมินจะถูกลบ และออกจากระบบ
          </Text>
          <Button
            label="ยืนยันลบข้อมูล"
            variant="danger"
            size="md"
            onPress={() => {
              signOut();
              nav.reset({ index: 0, routes: [{ name: 'Auth' }] });
            }}
          />
          <Button label="ไม่ลบ" variant="ghost" size="md" onPress={() => setAsked(null)} />
        </Panel>
      ) : null}
    </Screen>
  );
}
