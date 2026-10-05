import React from 'react';
import { View } from 'react-native';
import {
  AILabel,
  AppBar,
  Avatar,
  Badge,
  Banner,
  BodyMap,
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  GridRow,
  HStack,
  Icon,
  JourneyStepper,
  ReasonTrace,
  SafetyTag,
  Screen,
  Text,
  TextField,
  VStack,
  regionLabel,
  useTheme,
  type IconName,
  type RegionId,
} from '../../design-system';
import { HISTORY, useJourney } from '../../state/JourneyContext';
import { useNav } from '../../navigation/types';

/* ============================================================ 10 PROVIDER SUMMARY */

function BriefBlock({ icon, title, children, tone }: { icon: IconName; title: string; children: React.ReactNode; tone?: string }) {
  const { colors } = useTheme();
  return (
    <Card>
      <HStack gap={2}>
        <Icon name={icon} size="md" color={tone ?? colors.icon.primary} />
        <Text variant="overline" color={tone ?? colors.text.secondary}>
          {title}
        </Text>
      </HStack>
      {children}
    </Card>
  );
}

export function ClientBriefScreen() {
  const nav = useNav();
  const { colors } = useTheme();
  const { client, chiefComplaint, symptoms, before, profile, goal, safety, log } = useJourney();
  const regions = (Object.entries(symptoms) as [RegionId, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const last = HISTORY[HISTORY.length - 1];

  React.useEffect(() => {
    log('พท.ป. สมศรี ดีงาม', 'เปิดดู Provider Summary');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen
      header={<AppBar title="สรุปผู้รับบริการ" subtitle="Provider Summary · อ่านจบใน ~30 วินาที" onBack={() => nav.goBack()} right={<SafetyTag level={safety.level} solid />} />}
      footer={<Button label="ตรวจสอบความปลอดภัย" iconRight="shield" onPress={() => nav.navigate('SafetyCheck')} />}
    >
      <HStack gap={3}>
        <Avatar initials={client.initials} size={56} />
        <View style={{ flex: 1 }}>
          <Text variant="titleLg">{client.name}</Text>
          <Text variant="bodySm" tone="secondary">
            {client.age} ปี · {client.occupation} · ครั้งที่ {HISTORY.length + 1}
          </Text>
        </View>
        <AILabel text="สรุปโดย AI" />
      </HStack>

      <GridRow>
        <Col span={{ compact: 4, medium: 5, expanded: 8 }}>
          <VStack gap={3}>
            {/* 1. Red Flags / Health risks — บนสุดเสมอ */}
            <BriefBlock icon="alert-triangle" title="RED FLAGS / ข้อควรระวัง" tone={safety.level === 'red' ? colors.status.danger.fg : colors.status.warning.fg}>
              {safety.hits.length ? (
                safety.hits.map((h) => (
                  <HStack key={h.ruleId} gap={2} align="flex-start">
                    <Badge label={h.ruleId} tone={h.level === 'red' ? 'danger' : 'warning'} />
                    <Text variant="bodyMd" style={{ flex: 1 }}>
                      {h.title} — <Text variant="bodySm" tone="secondary">{h.evidence}</Text>
                    </Text>
                  </HStack>
                ))
              ) : (
                <Text variant="bodyMd">ไม่พบ</Text>
              )}
            </BriefBlock>

            {/* 2. Current complaint */}
            <BriefBlock icon="target" title="CURRENT COMPLAINT">
              <Text variant="titleMd">{chiefComplaint}</Text>
              <Text variant="bodyMd">
                ปวด {before.pain}/10 · ตึง {before.stiffness}/10 · 3 วัน · ปัจจัย: ใช้คอมพิวเตอร์นาน
              </Text>
              <Text variant="bodySm" tone="secondary">
                ตำแหน่ง: {regions.map(([r, v]) => `${regionLabel[r]} ${v}`).join(' · ')}
              </Text>
            </BriefBlock>

            {/* 3. Health risks */}
            <BriefBlock icon="activity" title="HEALTH PROFILE">
              <Text variant="bodyMd">
                โรค: {profile.conditions.join(', ') || '-'} · ยา: {profile.medications.join(', ') || '-'} · แพ้: {profile.allergies.join(', ') || 'ไม่มี'}
              </Text>
              {profile.bp ? (
                <Text variant="bodySm" tone="secondary">
                  BP วันนี้ {profile.bp.sys}/{profile.bp.dia} mmHg · T {profile.temperature}°C
                </Text>
              ) : null}
            </BriefBlock>

            {/* 4. Goal */}
            <BriefBlock icon="flag" title="GOAL">
              <Text variant="bodyMd">{goal}</Text>
            </BriefBlock>

            {/* 5. Questions to ask */}
            <BriefBlock icon="help-circle" title="ควรถามเพิ่ม (AI แนะนำ)">
              <Text variant="bodyMd">• ปวดร้าวลงแขนหรือมีชาปลายนิ้วร่วมด้วยหรือไม่</Text>
              <Text variant="bodyMd">• ทานยาความดันเช้านี้แล้วหรือยัง</Text>
              <Text variant="bodyMd">• ชอบแรงกดระดับไหน</Text>
              <ReasonTrace
                steps={[
                  { kind: 'input', text: 'ตำแหน่งคอ–บ่า + อาการตึง → ต้องแยกอาการทางเส้นประสาท' },
                  { kind: 'rule', text: 'CA-01 ความดันสูง → ยืนยันการทานยา' },
                ]}
              />
            </BriefBlock>
          </VStack>
        </Col>
        <Col span={{ compact: 4, medium: 3, expanded: 4 }}>
          <VStack gap={3}>
            <Card>
              <Text variant="overline" tone="secondary">
                BODY MAP
              </Text>
              <BodyMap value={symptoms} height={260} />
            </Card>
            <Card variant="filled">
              <Text variant="overline" tone="secondary">
                ครั้งก่อน ({last.date})
              </Text>
              <Text variant="bodyMd">{last.plan}</Text>
              <Text variant="bodySm" tone="secondary">
                ปวด {last.painBefore} → {last.painAfter} · ไม่มีอาการข้างเคียง
              </Text>
            </Card>
          </VStack>
        </Col>
      </GridRow>

    </Screen>
  );
}

/* ============================================================ 11 SAFETY CHECK */

export function SafetyCheckScreen() {
  const nav = useNav();
  const { colors } = useTheme();
  const { safety, acknowledged, setAcknowledged, log, profile, setProfile } = useJourney();
  const [bp, setBp] = React.useState(profile.bp ? `${profile.bp.sys}/${profile.bp.dia}` : '');
  const [pulse, setPulse] = React.useState(profile.pulse ? String(profile.pulse) : '');
  const [temp, setTemp] = React.useState(profile.temperature ? String(profile.temperature) : '');
  /** ค่าที่วัดซ้ำถูกส่งเข้า Rule Engine ทันที */
  const remeasure = (next: { bp?: string; pulse?: string; temp?: string }) => {
    const b = (next.bp ?? bp).match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
    const pl = parseInt(next.pulse ?? pulse, 10);
    const t = parseFloat(next.temp ?? temp);
    setProfile({
      ...profile,
      bp: b ? { sys: +b[1], dia: +b[2] } : profile.bp,
      pulse: Number.isFinite(pl) ? pl : profile.pulse,
      temperature: Number.isFinite(t) ? t : profile.temperature,
    });
  };
  const isRed = safety.level === 'red';
  const allAck = safety.hits.every((h) => acknowledged.includes(h.ruleId));

  return (
    <Screen
      header={<AppBar title="ตรวจสอบความปลอดภัย" subtitle={`Safety Rule Engine · ตรวจ ${safety.checkedRules} กฎ`} onBack={() => nav.goBack()} />}
      footer={
        isRed ? (
          <>
            <Button
              label="หยุดบริการและส่งต่อแพทย์"
              variant="danger"
              iconLeft="x-octagon"
              disabled={!allAck}
              onPress={() => {
                log('พท.ป. สมศรี ดีงาม', 'ยืนยัน Red Flag · หยุดบริการ · ส่งต่อแพทย์');
                nav.navigate('ProviderTabs');
              }}
            />
            <Text variant="labelSm" tone="tertiary" align="center">
              การ override Red Flag ต้องให้แพทย์แผนไทยผู้รับผิดชอบอนุมัติ พร้อมบันทึกเหตุผล
            </Text>
          </>
        ) : (
          <Button
            label={allAck ? 'ยืนยัน · ดูแนวทางการดูแล' : `ยืนยันให้ครบ (${acknowledged.length}/${safety.hits.length})`}
            iconRight="arrow-right"
            disabled={!allAck}
            onPress={() => {
              log('พท.ป. สมศรี ดีงาม', `ยืนยันข้อควรระวัง ${safety.hits.map((h) => h.ruleId).join(', ') || '-'}`);
              nav.navigate('CarePlan');
            }}
          />
        )
      }
    >
      <JourneyStepper current={1} />
      {isRed ? (
        <Banner tone="danger" title="พบ Red Flag — ไม่ควรให้บริการเวลเนส" message="ยืนยันข้อมูลกับผู้รับบริการ แล้วแนะนำพบแพทย์ตามระบบส่งต่อ" />
      ) : safety.level === 'amber' ? (
        <Banner tone="warning" title={`มีข้อควรระวัง ${safety.hits.length} ข้อ`} message="ให้บริการได้ โดยปรับวิธีตามคำแนะนำ — กรุณายืนยันทีละข้อ" />
      ) : (
        <Banner tone="success" title="ไม่พบข้อควรระวัง" />
      )}

      {safety.hits.map((h) => (
        <Card key={h.ruleId}>
          <HStack justify="space-between">
            <HStack gap={2}>
              <Badge label={h.ruleId} tone={h.level === 'red' ? 'danger' : 'warning'} solid />
              <Text variant="titleMd">{h.title}</Text>
            </HStack>
          </HStack>
          <Text variant="bodySm" tone="secondary">
            ข้อมูลต้นทาง: {h.evidence}
          </Text>
          <HStack gap={1}>
            <Icon name="book-open" size="xs" color={colors.text.tertiary} />
            <Text variant="labelSm" tone="tertiary">
              อ้างอิง: {h.source}
            </Text>
          </HStack>
          <HStack gap={2} align="flex-start">
            <Text variant="labelMd">แนวปฏิบัติ:</Text>
            <Text variant="bodyMd" style={{ flex: 1 }}>
              {h.action}
            </Text>
          </HStack>
          <Divider />
          <Checkbox
            label={h.level === 'red' ? 'ยืนยันข้อมูลกับผู้รับบริการแล้ว' : 'รับทราบและจะปฏิบัติตาม'}
            checked={acknowledged.includes(h.ruleId)}
            onChange={(v) => setAcknowledged(v ? [...acknowledged, h.ruleId] : acknowledged.filter((x) => x !== h.ruleId))}
          />
        </Card>
      ))}

      <Card>
        <Text variant="titleSm">สัญญาณชีพก่อนเริ่มนวด</Text>
        <TextField
          label="ความดันโลหิต (mmHg)"
          value={bp}
          onChangeText={(v) => {
            setBp(v);
            remeasure({ bp: v });
          }}
          keyboardType="numbers-and-punctuation"
          iconLeft="heart"
          helper="กรณีเกิน 160/100 ให้นอนพัก 30 นาทีแล้ววัดซ้ำ (CPG_PCU หน้า 139)"
        />
        <HStack gap={3}>
          <View style={{ flex: 1 }}>
            <TextField
              label="ชีพจร (ครั้ง/นาที)"
              value={pulse}
              onChangeText={(v) => {
                setPulse(v);
                remeasure({ pulse: v });
              }}
              keyboardType="number-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              label="อุณหภูมิ (°C)"
              value={temp}
              onChangeText={(v) => {
                setTemp(v);
                remeasure({ temp: v });
              }}
              keyboardType="decimal-pad"
            />
          </View>
        </HStack>
        <Text variant="labelSm" tone="tertiary">
          ตรวจชีพจรและอัตราการหายใจก่อนนวด (ตำราอ้างอิงฯ หน้า 393)
        </Text>
      </Card>

    </Screen>
  );
}
