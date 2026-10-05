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
  type IconName,
} from '../../design-system';
import { HISTORY, useJourney } from '../../state/JourneyContext';
import { TREATMENT_CASES, ARCHIVED_CASES, type TreatmentCase } from '../../data/homeFeed';
import { HistoryBento } from './HomeScreen';

import { useNav } from '../../navigation/types';

/* ============================================================ 19 PROGRESS */

/**
 * ประวัติการรักษา — รายการเรื่องที่ดูแล (กำลังรักษา + รักษาจบแล้ว) · แตะเพื่อดูรายละเอียดแบบ bento
 * เรื่องที่รักษาครบคอร์สแล้วย้ายมาอยู่ที่นี่ (ไม่อยู่บนหน้าแรก)
 */
export function ProgressScreen() {
  const nav = useNav();
  const { colors } = useTheme();
  const { newPatient, promoted } = useJourney();
  const active = [...(newPatient ? [] : TREATMENT_CASES), ...promoted];
  const done = newPatient ? [] : ARCHIVED_CASES;
  const Row = ({ c, finished }: { c: TreatmentCase; finished?: boolean }) => {
    const first = c.visits[0];
    const last = c.visits[c.visits.length - 1];
    const pct = Math.round(((first.painBefore - last.painAfter) / first.painBefore) * 100);
    return (
      <ListItem
        title={c.short}
        subtitle={`${c.visits.length} ครั้ง · ${first.date} – ${last.date}`}
        trailing={<Badge label={`${pct >= 0 ? 'ดีขึ้น' : 'แย่ลง'} ${Math.abs(pct)}%`} tone={pct >= 0 ? 'success' : 'danger'} />}
        onPress={() => nav.navigate('TreatmentHistory', { caseId: c.id })}
        leading={
          <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: finished ? colors.surface.sunken : colors.brand.subtle }}>
            <Icon name={finished ? 'check' : 'activity'} size="sm" color={finished ? colors.text.secondary : colors.brand.primary} />
          </View>
        }
      />
    );
  };
  return (
    <Screen header={<AppBar title="ประวัติการรักษา" />}>
      {active.length ? (
        <>
          <SectionHeader title="กำลังรักษา" />
          <Card style={{ padding: 0, gap: 0 }}>
            {active.map((c, i) => (
              <View key={c.id}>
                {i > 0 ? <Divider inset={72} /> : null}
                <Row c={c} />
              </View>
            ))}
          </Card>
        </>
      ) : null}
      {done.length ? (
        <>
          <SectionHeader title="รักษาจบแล้ว" />
          <Card style={{ padding: 0, gap: 0 }}>
            {done.map((c, i) => (
              <View key={c.id}>
                {i > 0 ? <Divider inset={72} /> : null}
                <Row c={c} finished />
              </View>
            ))}
          </Card>
        </>
      ) : null}
      {!active.length && !done.length ? (
        <Text variant="bodyMd" tone="secondary" align="center">
          ยังไม่มีประวัติการรักษา
        </Text>
      ) : null}
    </Screen>
  );
}

/** รายละเอียดประวัติการรักษาของเรื่องหนึ่ง — bento ชุดเดียวกับที่ AI แสดงในแชท */
export function TreatmentHistoryScreen({ route }: { route: { params: { caseId: string } } }) {
  const nav = useNav();
  const { promoted } = useJourney();
  const c = [...TREATMENT_CASES, ...promoted, ...ARCHIVED_CASES].find((x) => x.id === route.params.caseId);
  if (!c) return null;
  return (
    <Screen header={<AppBar title={c.short} subtitle={c.condition} onBack={() => nav.goBack()} />}>
      <HistoryBento tc={c} />
    </Screen>
  );
}

/* ============================================================ PROFILE */

export function ProfileScreen() {
  const nav = useNav();
  const { client, profile, signOut } = useJourney();
  const [largeText, setLargeText] = React.useState(false);
  return (
    <Screen header={<AppBar title="โปรไฟล์" />}>
      <HStack gap={3}>
        <Avatar initials={client.initials} size={56} />
        <View style={{ flex: 1 }}>
          <Text variant="titleLg">{client.name}</Text>
          <Text variant="bodySm" tone="secondary">
            {client.age} ปี · {client.occupation} · {client.hn}
          </Text>
        </View>
      </HStack>

      <SectionHeader title="ข้อมูลสุขภาพ" action="แก้ไข" />
      <Card style={{ padding: 0, gap: 0 }}>
        <ListItem leadingIcon="activity" title="โรคประจำตัว" subtitle={profile.conditions.join(', ') || 'ไม่มี'} onPress={() => {}} />
        <Divider inset={72} />
        <ListItem leadingIcon="package" title="ยาที่ใช้ประจำ" subtitle={profile.medications.join(', ') || 'ไม่มี'} onPress={() => {}} />
        <Divider inset={72} />
        <ListItem leadingIcon="alert-circle" title="ประวัติแพ้" subtitle={profile.allergies.join(', ') || 'ไม่มี'} onPress={() => {}} />
        <Divider inset={72} />
        <ListItem leadingIcon="link" title="เชื่อมข้อมูลจาก PHR / HIS" subtitle="ดึงข้อมูลจากโรงพยาบาล (ตามสิทธิ)" onPress={() => {}} />
      </Card>

      <SectionHeader title="การตั้งค่า" />
      <Card style={{ padding: 0, gap: 0 }}>
        <ListItem leadingIcon="lock" title="ความเป็นส่วนตัวและความยินยอม" onPress={() => nav.navigate('Privacy')} />
        <Divider inset={72} />
        <ListItem leadingIcon="type" title="ตัวอักษรขนาดใหญ่" subtitle="สำหรับผู้สูงอายุ / KIOSK" chevron={false} trailing={<Switch value={largeText} onChange={setLargeText} label="ตัวอักษรขนาดใหญ่" />} />
        <Divider inset={72} />
        <ListItem leadingIcon="globe" title="ภาษา" subtitle="ไทย / English / 中文 / 日本語" onPress={() => {}} />
        <Divider inset={72} />
        <ListItem leadingIcon="briefcase" title="โหมดผู้ให้บริการ" subtitle="สำหรับผู้ให้บริการนวดและแพทย์แผนไทย" onPress={() => nav.navigate('ProviderTabs')} />
      </Card>
      <Card style={{ padding: 0, gap: 0 }}>
        <ListItem
          leadingIcon="log-out"
          title="ออกจากระบบ"
          chevron={false}
          onPress={() => {
            signOut();
            nav.reset({ index: 0, routes: [{ name: 'Auth' }] });
          }}
        />
      </Card>
      {/* เครดิตตามเงื่อนไข CC BY 4.0 ของโมเดลกายวิภาค */}
      <Text variant="caption" tone="tertiary" align="center">
        โมเดลกายวิภาค 3D: BodyParts3D © The Database Center for Life Science (CC BY 4.0) ดัดแปลงผ่าน human-atlas
      </Text>
    </Screen>
  );
}

/* ============================================================ 20 PRIVACY CENTER */

export function PrivacyScreen() {
  const nav = useNav();
  const { consents, setConsents, audit, log } = useJourney();
  const toggle = (k: keyof typeof consents, label: string) => (v: boolean) => {
    setConsents({ ...consents, [k]: v });
    log('ผู้รับบริการ', `${v ? 'ให้' : 'ถอน'}ความยินยอม: ${label}`);
  };
  return (
    <Screen header={<AppBar title="ความเป็นส่วนตัว" subtitle="Consent & Audit Trail" onBack={() => nav.goBack()} />}>
      <Card>
        <Text variant="titleSm">ความยินยอมของคุณ</Text>
        {(
          [
            ['service', 'ใช้ข้อมูลเพื่อให้บริการ'],
            ['aiProcessing', 'AI ช่วยซักประวัติ/สรุป'],
            ['followUp', 'ติดตามผลหลังบริการ'],
            ['research', 'วิจัย (ไม่ระบุตัวตน)'],
          ] as const
        ).map(([k, label]) => (
          <HStack key={k} justify="space-between" style={{ minHeight: 48 }}>
            <Text variant="bodyMd" style={{ flex: 1 }}>
              {label}
            </Text>
            <Switch value={consents[k]} onChange={toggle(k, label)} label={label} />
          </HStack>
        ))}
      </Card>

      <SectionHeader title="ใครเข้าถึงข้อมูลของคุณ" subtitle="บันทึกทุกการเข้าถึงและการตัดสินใจสำคัญ" />
      <Card style={{ padding: 0, gap: 0 }}>
        {audit.map((a, i) => (
          <View key={i}>
            {i > 0 ? <Divider inset={16} /> : null}
            <ListItem title={a.action} subtitle={a.actor} meta={`วันนี้ ${a.at}`} chevron={false} />
          </View>
        ))}
      </Card>

      <VStack gap={2}>
        <Button label="ดาวน์โหลดข้อมูลของฉัน" variant="secondary" iconLeft="download" />
        <Button label="ขอลบข้อมูล" variant="ghost" iconLeft="trash-2" />
      </VStack>
    </Screen>
  );
}
