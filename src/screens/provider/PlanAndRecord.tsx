import React from 'react';
import { Pressable, View } from 'react-native';
import {
  AILabel,
  AppBar,
  Badge,
  Banner,
  BodyMap,
  Button,
  Card,
  ChipGroup,
  Col,
  Divider,
  GridRow,
  HStack,
  Icon,
  IconButton,
  JourneyStepper,
  KeyValue,
  MatchMeter,
  ReasonTrace,
  Screen,
  SectionHeader,
  SegmentedControl,
  SourceList,
  Text,
  TextField,
  VStack,
  radius,
  regionLabel,
  space,
  useTheme,
  type RegionId,
} from '../../design-system';
import { CARE_SUGGESTIONS, PRESSURE, TECHNIQUES } from '../../data/knowledgeBase';
import { useJourney } from '../../state/JourneyContext';
import { procedureGates } from '../../services/safetyEngine';
import { useNav } from '../../navigation/types';

/* ============================================================ 12 AI CARE SUGGESTION */

export function CarePlanScreen() {
  const nav = useNav();
  const { colors } = useTheme();
  const { record, setRecord, log, profile } = useJourney();
  const gates = procedureGates(profile);
  const [selected, setSelected] = React.useState<string>(CARE_SUGGESTIONS[0].id);
  const plan = CARE_SUGGESTIONS.find((p) => p.id === selected)!;

  return (
    <Screen
      header={<AppBar title="แนวทางการดูแล" subtitle="AI Care Suggestion · ผู้ให้บริการเป็นผู้ตัดสินใจ" onBack={() => nav.goBack()} />}
      footer={
        <>
          <Button
            label="อนุมัติแผนนี้และเริ่มบริการ"
            iconLeft="user-check"
            onPress={() => {
              setRecord({ ...record, planId: plan.id, duration: plan.duration, regions: plan.focusAreas, techniques: ['กดจุด', 'คลึง', 'ยืด/ดัด'] });
              log('พท.ป. สมศรี ดีงาม', `อนุมัติแผน: ${plan.title}`);
              nav.navigate('ServiceRecord');
            }}
          />
          <Button label="ไม่ใช้ข้อเสนอแนะ · กำหนดแผนเอง" variant="ghost" onPress={() => nav.navigate('ServiceRecord')} />
        </>
      }
    >
      <JourneyStepper current={2} />
      <Banner tone="ai" title="ข้อเสนอแนะจาก AI — ไม่ใช่คำสั่งการรักษา" message="อ้างอิงจาก Knowledge Base ที่คัดเลือก + ข้อควรระวังจาก Safety Engine + ผลตอบสนองครั้งก่อนของผู้รับบริการ" />

      <Card variant="filled">
        <Text variant="titleSm">หัตถการเสริม</Text>
        {gates.map((g) => (
          <HStack key={g.procedure} gap={2} align="flex-start">
            <Icon name={g.allowed ? 'check-circle' : 'slash'} size="sm" color={g.allowed ? colors.status.success.fg : colors.status.danger.fg} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyMd">
                {g.procedure}: {g.allowed ? 'ทำได้' : `งด (${g.reasons.join(', ')})`}
              </Text>
              <Text variant="labelSm" tone="tertiary">
                อ้างอิง: {g.source}
              </Text>
            </View>
          </HStack>
        ))}
      </Card>

      <SectionHeader title="ตัวเลือกที่อาจเหมาะสม" subtitle={`${CARE_SUGGESTIONS.length} ตัวเลือก · เรียงตามความเหมาะสม`} />
      {CARE_SUGGESTIONS.map((p, i) => {
        const sel = p.id === selected;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: sel }}
            onPress={() => setSelected(p.id)}
            style={{
              borderRadius: radius.lg,
              borderWidth: sel ? 2 : 1,
              borderColor: sel ? colors.border.focus : colors.border.subtle,
              backgroundColor: colors.surface.raised,
              padding: space[4],
              gap: space[3],
            }}
          >
            <HStack justify="space-between" align="flex-start">
              <View style={{ flex: 1, gap: space[1] }}>
                <HStack gap={2}>
                  {i === 0 ? <Badge label="แนะนำ" tone="ai" icon="star" /> : null}
                  <Text variant="labelSm" tone="tertiary">
                    {p.duration} นาที
                  </Text>
                </HStack>
                <Text variant="titleMd">{p.title}</Text>
              </View>
              <Icon name={sel ? 'check-circle' : 'circle'} color={sel ? colors.brand.primary : colors.icon.secondary} />
            </HStack>
            <MatchMeter level={p.match} />
            {sel ? (
              <VStack gap={3}>
                <Text variant="bodyMd" tone="secondary">
                  {p.summary}
                </Text>
                <VStack gap={1}>
                  <Text variant="labelMd">ปรับตามข้อควรระวัง</Text>
                  {p.adjustments.map((a) => (
                    <HStack key={a} gap={2}>
                      <Icon name="alert-triangle" size="sm" color={colors.status.warning.fg} />
                      <Text variant="bodySm">{a}</Text>
                    </HStack>
                  ))}
                </VStack>
                <Divider />
                <Text variant="labelMd">แหล่งอ้างอิง</Text>
                <SourceList sources={p.sources} />
                <ReasonTrace steps={p.trace} />
              </VStack>
            ) : null}
          </Pressable>
        );
      })}

    </Screen>
  );
}

/* ============================================================ 13 SERVICE RECORD */

const ALL_REGIONS = Object.keys(regionLabel) as RegionId[];

export function ServiceRecordScreen() {
  const nav = useNav();
  const { record, setRecord, log } = useJourney();
  const [dictating, setDictating] = React.useState(false);
  const [reaction, setReaction] = React.useState<string[]>(['ผ่อนคลายดี']);

  // record.regions เก็บเป็นชื่อบริเวณ (ตรงกับ regionLabel) — 'ทั้งตัว' = ทุก region
  const treated: Partial<Record<RegionId, number>> = {};
  ALL_REGIONS.forEach((id) => {
    if (record.regions.includes('ทั้งตัว') || record.regions.includes(regionLabel[id])) treated[id] = 5;
  });

  const toggleRegion = (id: RegionId) => {
    const label = regionLabel[id];
    const regions = record.regions.filter((r) => r !== 'ทั้งตัว');
    setRecord({ ...record, regions: regions.includes(label) ? regions.filter((r) => r !== label) : [...regions, label] });
  };

  return (
    <Screen
      header={<AppBar title="บันทึกบริการ" subtitle={`${record.provider} · เริ่ม 10:34`} onBack={() => nav.goBack()} />}
      footer={
        <Button
          label="บันทึกและส่งแบบประเมินหลังนวด"
          iconRight="send"
          onPress={() => {
            log('พท.ป. สมศรี ดีงาม', 'บันทึก Service Record');
            nav.navigate('ProviderDone');
          }}
        />
      }
    >
      <JourneyStepper current={3} />
      <GridRow>
        <Col span={{ compact: 4, medium: 3, expanded: 4 }}>
          <Card>
            <Text variant="titleSm">บริเวณที่ให้บริการ</Text>
            <BodyMap value={treated} onPressRegion={toggleRegion} height={280} />
            <Text variant="bodySm" tone="secondary">
              {record.regions.join(' · ') || 'แตะเพื่อเลือก'}
            </Text>
          </Card>
        </Col>
        <Col span={{ compact: 4, medium: 5, expanded: 8 }}>
          <VStack gap={4}>
            <Card>
              <Text variant="titleSm">เทคนิค</Text>
              <ChipGroup options={TECHNIQUES} value={record.techniques} onChange={(v) => setRecord({ ...record, techniques: v })} multiple />
              <Text variant="titleSm">แรงกด</Text>
              <SegmentedControl options={PRESSURE} value={record.pressure} onChange={(v) => setRecord({ ...record, pressure: v })} />
              <HStack justify="space-between">
                <Text variant="titleSm">ระยะเวลา</Text>
                <HStack gap={1}>
                  <IconButton icon="minus" label="ลดเวลา" variant="outline" onPress={() => setRecord({ ...record, duration: Math.max(15, record.duration - 15) })} />
                  <Text variant="titleLg" style={{ minWidth: 72, textAlign: 'center' }}>
                    {record.duration} น.
                  </Text>
                  <IconButton icon="plus" label="เพิ่มเวลา" variant="outline" onPress={() => setRecord({ ...record, duration: record.duration + 15 })} />
                </HStack>
              </HStack>
            </Card>

            <Card>
              <HStack justify="space-between">
                <Text variant="titleSm">ข้อสังเกต</Text>
                <Button
                  label={dictating ? 'กำลังฟัง…' : 'พูดเพื่อบันทึก'}
                  variant="tertiary"
                  size="sm"
                  iconLeft="mic"
                  fullWidth={false}
                  onPress={() => {
                    setDictating(true);
                    setTimeout(() => {
                      setDictating(false);
                      setRecord({ ...record, notes: 'พบจุดกดเจ็บบริเวณบ่าขวาแนวเส้นพื้นฐาน 2 จุด คลายตัวดีหลังนวด 20 นาที ผู้รับบริการไม่มีอาการชาร้าวลงแขน' });
                    }, 1200);
                  }}
                />
              </HStack>
              <TextField multiline value={record.notes} onChangeText={(t) => setRecord({ ...record, notes: t })} placeholder="พิมพ์หรือกดปุ่มไมค์ — AI จะจัดรูปแบบให้" />
              {record.notes ? <AILabel text="ถอดความจากเสียงโดย AI · ตรวจทานแล้วจึงบันทึก" /> : null}
              <Text variant="titleSm">การตอบสนองระหว่างนวด</Text>
              <ChipGroup options={['ผ่อนคลายดี', 'เจ็บขณะกด', 'เวียนศีรษะ', 'หลับระหว่างนวด']} value={reaction} onChange={setReaction} multiple />
            </Card>
          </VStack>
        </Col>
      </GridRow>
    </Screen>
  );
}

/* ============================================================ 14 PROVIDER DONE */

export function ProviderDoneScreen() {
  const nav = useNav();
  const { colors } = useTheme();
  const { record, acknowledged } = useJourney();
  const plan = CARE_SUGGESTIONS.find((p) => p.id === record.planId);
  return (
    <Screen
      header={<AppBar title="บันทึกเรียบร้อย" onBack={() => nav.goBack()} />}
      footer={
        <>
          <Button label="กลับไปที่คิว" onPress={() => nav.navigate('ProviderTabs')} />
        </>
      }
    >
      <View style={{ alignItems: 'center', gap: 8 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.status.success.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="check" size="xl" color={colors.status.success.fg} />
        </View>
        <Text variant="headlineSm">บันทึกบริการแล้ว</Text>
        <Text variant="bodyMd" tone="secondary" align="center">
          ส่งแบบประเมินหลังนวดไปยัง MyAtlas ของผู้รับบริการแล้ว
        </Text>
      </View>
      <Card>
        <KeyValue label="แผนที่ใช้" value={plan?.title ?? 'กำหนดเอง'} emphasis />
        <KeyValue label="บริเวณ" value={record.regions.join(', ') || '-'} />
        <KeyValue label="เทคนิค" value={record.techniques.join(', ') || '-'} />
        <KeyValue label="แรงกด / เวลา" value={`${record.pressure} · ${record.duration} นาที`} />
        <KeyValue label="ยืนยันความปลอดภัย" value={acknowledged.join(', ') || '-'} />
      </Card>
    </Screen>
  );
}
