import React from 'react';
import { View } from 'react-native';
import {
  AppBar,
  BodyMap,
  Button,
  Card,
  ChipGroup,
  Col,
  FaceScale,
  GridRow,
  HStack,
  IconButton,
  JourneyStepper,
  ScaleSelector,
  Screen,
  SectionHeader,
  Text,
  VStack,
  regionLabel,
  type RegionId,
} from '../../design-system';
import { useJourney } from '../../state/JourneyContext';
import { useNav } from '../../navigation/types';

/* ============================================================ 05 BODY MAP */

export function BodyMapScreen() {
  const nav = useNav();
  const { symptoms, setSymptoms } = useJourney();
  const [selected, setSelected] = React.useState<RegionId | undefined>('shoulder_r');
  const [quality, setQuality] = React.useState<string[]>(['ตึง']);
  const active = (Object.entries(symptoms) as [RegionId, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

  return (
    <Screen
      header={<AppBar title="ตำแหน่งที่มีอาการ" subtitle="แตะบนภาพเพื่อเพิ่ม/แก้ไข" onBack={() => nav.goBack()} />}
      footer={<Button label={`ยืนยัน ${active.length} ตำแหน่ง`} iconRight="arrow-right" disabled={!active.length} onPress={() => nav.navigate('Assessment')} />}
    >
      <JourneyStepper current={0} />
      <GridRow>
        <Col span={{ compact: 4, medium: 4, expanded: 6 }}>
          <Card>
            <BodyMap value={symptoms} selected={selected} onPressRegion={setSelected} height={360} />
          </Card>
        </Col>
        <Col span={{ compact: 4, medium: 4, expanded: 6 }}>
          <VStack gap={4}>
            {selected ? (
              <Card variant="elevated">
                <HStack justify="space-between">
                  <Text variant="titleMd">{regionLabel[selected]}</Text>
                  <IconButton
                    icon="trash-2"
                    label="ลบตำแหน่งนี้"
                    onPress={() => {
                      const s = { ...symptoms };
                      delete s[selected];
                      setSymptoms(s);
                    }}
                  />
                </HStack>
                <ScaleSelector label="ระดับความปวด" value={symptoms[selected] ?? 0} onChange={(v) => setSymptoms({ ...symptoms, [selected]: v })} minLabel="ไม่ปวด" maxLabel="ปวดมากที่สุด" />
                <Text variant="labelMd">ลักษณะอาการ</Text>
                <ChipGroup options={['ตึง', 'ปวดตื้อ', 'ปวดร้าว', 'ชา', 'ปวดแปล๊บ']} value={quality} onChange={setQuality} multiple />
              </Card>
            ) : (
              <Text variant="bodyMd" tone="secondary">
                แตะบริเวณบนภาพเพื่อระบุอาการ
              </Text>
            )}

            <SectionHeader title="ตำแหน่งที่เลือก" subtitle="เรียงจากอาการมากไปน้อย" />
            <View style={{ gap: 8 }}>
              {active.map(([id, v]) => (
                <HStack key={id} justify="space-between">
                  <Text variant="bodyMd" onPress={() => setSelected(id)}>
                    • {regionLabel[id]}
                  </Text>
                  <Text variant="titleSm">{v}/10</Text>
                </HStack>
              ))}
            </View>
          </VStack>
        </Col>
      </GridRow>
    </Screen>
  );
}

/* ============================================================ 06 WELLNESS ASSESSMENT */

export function AssessmentScreen() {
  const nav = useNav();
  const { before, setBefore, symptoms, log } = useJourney();
  const maxPain = Math.max(0, ...Object.values(symptoms).map((v) => v ?? 0));

  React.useEffect(() => {
    if (maxPain && before.pain !== maxPain) setBefore({ ...before, pain: maxPain });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen
      header={<AppBar title="ประเมินสุขภาวะก่อนนวด" subtitle="Baseline สำหรับเปรียบเทียบหลังนวด" onBack={() => nav.goBack()} />}
      footer={
        <Button
          label="ดูสรุปก่อนรับบริการ"
          iconRight="arrow-right"
          onPress={() => {
            log('ผู้รับบริการ', 'บันทึก Wellness Assessment (ก่อนนวด)');
            nav.navigate('PreSummary');
          }}
        />
      }
    >
      <JourneyStepper current={0} />

      <Card>
        <Text variant="overline" tone="tertiary">
          1 / 3 · ร่างกาย
        </Text>
        <ScaleSelector label="ความปวด (สูงสุด)" value={before.pain} onChange={(v) => setBefore({ ...before, pain: v })} minLabel="ไม่ปวด" maxLabel="ปวดมาก" />
        <ScaleSelector label="ความตึง" value={before.stiffness} onChange={(v) => setBefore({ ...before, stiffness: v })} minLabel="ไม่ตึง" maxLabel="ตึงมาก" />
      </Card>

      <Card>
        <Text variant="overline" tone="tertiary">
          2 / 3 · การเคลื่อนไหว
        </Text>
        <Text variant="titleSm">หันคอ/ยกแขนได้สะดวกแค่ไหน</Text>
        <FaceScale value={before.mobility} onChange={(v) => setBefore({ ...before, mobility: v })} labels={['ติดขัดมาก', 'ติดขัด', 'พอได้', 'คล่อง', 'ปกติ']} />
      </Card>

      <Card>
        <Text variant="overline" tone="tertiary">
          3 / 3 · จิตใจและการพักผ่อน
        </Text>
        <Text variant="titleSm">ความเครียดช่วงนี้</Text>
        <FaceScale value={6 - before.stress} onChange={(v) => setBefore({ ...before, stress: 6 - v })} labels={['เครียดมาก', 'เครียด', 'ปานกลาง', 'สบาย', 'ผ่อนคลาย']} />
        <Text variant="titleSm">คุณภาพการนอน</Text>
        <FaceScale value={before.sleep} onChange={(v) => setBefore({ ...before, sleep: v })} labels={['แย่มาก', 'ไม่ดี', 'พอใช้', 'ดี', 'ดีมาก']} />
      </Card>

    </Screen>
  );
}
