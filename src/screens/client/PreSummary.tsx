import React from 'react';
import { View } from 'react-native';
import {
  AILabel,
  AppBar,
  Badge,
  Banner,
  Button,
  Card,
  Divider,
  HStack,
  Icon,
  JourneyStepper,
  KeyValue,
  ListItem,
  Placeholder,
  Screen,
  SectionHeader,
  Text,
  VStack,
  regionLabel,
  safetyMeta,
  useTheme,
  type RegionId,
} from '../../design-system';
import { useJourney } from '../../state/JourneyContext';
import { useNav } from '../../navigation/types';

/* ============================================================ 07 PRE-SERVICE SUMMARY */

export function PreSummaryScreen() {
  const nav = useNav();
  const { colors } = useTheme();
  const { chiefComplaint, goal, symptoms, before, safety, profile, log, lastAssess } = useJourney();
  // มาจากแชท AI → ใช้ผลประเมินในแชท (ข้อมูลชุดเดียวกับการ์ด) แทนข้อมูลจากแบบฟอร์มเดิม
  const fromChat = !!lastAssess;
  const regions = (Object.entries(symptoms) as [RegionId, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const meta = safetyMeta[safety.level];
  const isRed = safety.level === 'red';

  return (
    <Screen
      header={<AppBar title="สรุปก่อนรับบริการ" onBack={() => nav.goBack()} />}
      footer={
        isRed ? (
          <Button label="ดูคำแนะนำเพื่อความปลอดภัย" variant="danger" iconRight="arrow-right" onPress={() => nav.navigate('RedFlag')} />
        ) : (
          <Button
            label={fromChat ? 'จองนวด' : 'ยืนยันและส่งให้ผู้ให้บริการ'}
            iconRight={fromChat ? 'calendar' : 'send'}
            onPress={() => {
              log('ผู้รับบริการ', 'ยืนยันสรุปและส่งให้ผู้ให้บริการ');
              if (fromChat) nav.navigate('ClientTabs', { screen: 'Booking' });
              else nav.navigate('CheckIn');
            }}
          />
        )
      }
    >
      {fromChat ? null : <JourneyStepper current={1} />}

      {/* Safety status first — Serial position + Von Restorff */}
      <Banner
        tone={meta.tone}
        title={meta.label}
        message={
          safety.level === 'green'
            ? `ตรวจแล้ว ${safety.checkedRules} ข้อ ไม่พบข้อควรระวัง`
            : isRed
              ? 'จากข้อมูลที่ให้มา ไม่แนะนำให้รับบริการนวดในวันนี้ กรุณาดูคำแนะนำ'
              : `พบ ${safety.hits.length} ข้อที่ผู้ให้บริการจะตรวจสอบกับคุณก่อนเริ่มนวด เพื่อปรับวิธีให้เหมาะสม`
        }
      />

      <Card>
        <HStack justify="space-between">
          <Text variant="titleMd">ข้อมูลที่จะส่งให้ผู้ให้บริการ</Text>
          <AILabel text="สรุปโดย AI" />
        </HStack>
        {fromChat && lastAssess ? (
          <>
            <KeyValue label="อาการหลัก" value={lastAssess.symptoms.join(', ') || '-'} emphasis />
            <KeyValue label="ความปวด" value={`${lastAssess.pain}/10`} />
            {lastAssess.cause && lastAssess.cause !== 'ไม่แน่ใจ' ? <KeyValue label="สาเหตุ" value={lastAssess.cause} /> : null}
          </>
        ) : (
          <>
            <KeyValue label="อาการหลัก" value={chiefComplaint} emphasis />
            <KeyValue label="ตำแหน่ง" value={regions.map(([r, v]) => `${regionLabel[r]} (${v})`).join(', ')} />
            <KeyValue label="ความปวด / ตึง" value={`${before.pain}/10 · ${before.stiffness}/10`} />
          </>
        )}
        <KeyValue label="โรคประจำตัว" value={profile.conditions.join(', ') || '-'} />
        <KeyValue label="ยา" value={profile.medications.join(', ') || '-'} />
        {fromChat ? null : <KeyValue label="เป้าหมาย" value={goal} />}
        <Divider />
        <Button label="แก้ไขข้อมูล" variant="ghost" iconLeft="edit-2" fullWidth={false} onPress={() => (fromChat ? nav.goBack() : nav.navigate('BodyMap'))} />
      </Card>

      {safety.hits.length ? (
        <Card>
          <Text variant="titleSm">สิ่งที่ระบบพบ</Text>
          {safety.hits.map((h) => (
            <HStack key={h.ruleId} gap={2} align="flex-start">
              <Icon name={h.level === 'red' ? 'x-octagon' : 'alert-triangle'} size="sm" color={h.level === 'red' ? colors.status.danger.fg : colors.status.warning.fg} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyMd">{h.title}</Text>
                <Text variant="bodySm" tone="secondary">
                  {h.evidence}
                </Text>
              </View>
            </HStack>
          ))}
        </Card>
      ) : null}

    </Screen>
  );
}

/* ============================================================ 08 CHECK-IN */

export function CheckInScreen() {
  const nav = useNav();
  const { booking } = useJourney();
  return (
    <Screen
      header={<AppBar title="เช็กอิน" onBack={() => nav.goBack()} />}
      footer={
        <>
          {/* ต้นแบบ: ข้ามช่วงที่ผู้ให้บริการนวด → ไปหลังรับบริการ */}
          <Button label="จำลอง: นวดเสร็จแล้ว" variant="secondary" onPress={() => nav.navigate('PostAssessment')} />
        </>
      }
    >
      <VStack gap={1} align="center">
        <Text variant="overline" tone="tertiary">
          คิวของคุณ
        </Text>
        <Text variant="displayLg">{booking?.queue ?? 'A12'}</Text>
        <Text variant="bodyMd" tone="secondary">
          {booking ? `${booking.time} · ${booking.therapist}` : 'ห้องนวด 2'}
        </Text>
      </VStack>
      <Placeholder height={200} label="QR สำหรับเช็กอินที่เคาน์เตอร์" icon="maximize" />
      <Card>
        <ListItem leadingIcon="check" title="ส่งข้อมูลอาการให้ผู้ให้บริการแล้ว" chevron={false} />
        <ListItem leadingIcon="activity" title="วัดความดันและชีพจรก่อนนวด" chevron={false} />
        <ListItem leadingIcon="clipboard" title="ตกลงแผนการนวดร่วมกัน" chevron={false} />
      </Card>
    </Screen>
  );
}

/* ============================================================ 07b RED FLAG REFERRAL */

export function RedFlagScreen() {
  const nav = useNav();
  const { colors } = useTheme();
  const { safety, log } = useJourney();
  const reds = safety.hits.filter((h) => h.level === 'red');
  return (
    <Screen
      header={<AppBar title="เพื่อความปลอดภัยของคุณ" onBack={() => nav.goBack()} />}
      footer={
        <>
          <Button
            label="โทร 1669 (ฉุกเฉิน)"
            variant="danger"
            iconLeft="phone"
            onPress={() => log('ผู้รับบริการ', 'กดโทรฉุกเฉิน 1669')}
          />
          <Button label="ปรึกษาแพทย์ออนไลน์ / นัดหมายโรงพยาบาล" variant="secondary" iconLeft="video" />
        </>
      }
    >
      <View style={{ alignItems: 'center', gap: 12, paddingVertical: 8 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.status.danger.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="x-octagon" size="xl" color={colors.status.danger.fg} />
        </View>
        <Text variant="headlineSm" align="center">
          วันนี้ยังไม่แนะนำให้รับบริการนวด
        </Text>
        <Text variant="bodyMd" tone="secondary" align="center">
          ข้อมูลของคุณมีสัญญาณที่ควรได้รับการประเมินโดยแพทย์ก่อน การนวดอาจไม่เหมาะสมในตอนนี้
        </Text>
      </View>

      <Card>
        <Text variant="titleSm">สิ่งที่ระบบพบ</Text>
        {reds.length ? (
          reds.map((h) => (
            <VStack key={h.ruleId} gap={1}>
              <HStack justify="space-between">
                <Text variant="bodyMd">{h.title}</Text>
                <Badge label={h.ruleId} tone="danger" />
              </HStack>
              <Text variant="bodySm" tone="secondary">
                ข้อมูล: {h.evidence}
              </Text>
            </VStack>
          ))
        ) : (
          <Text variant="bodySm" tone="secondary">
            ไม่พบสัญญาณอันตราย
          </Text>
        )}
      </Card>

      <Banner tone="info" title="หากมีอาการต่อไปนี้ ให้โทร 1669 ทันที" message="ชาหรืออ่อนแรงครึ่งซีก พูดไม่ชัด เจ็บแน่นหน้าอก ปวดศีรษะรุนแรงเฉียบพลัน" />

      <SectionHeader title="สถานพยาบาลใกล้คุณ" />
      <Placeholder height={140} label="แผนที่สถานพยาบาลใกล้เคียง" icon="map" />
      <Button label="ส่งสรุปข้อมูลให้แพทย์" variant="ghost" iconLeft="share" fullWidth={false} />
      <Button label="ข้อมูลไม่ถูกต้อง? แก้ไขข้อมูล" variant="ghost" iconLeft="edit-2" fullWidth={false} onPress={() => nav.navigate('Assessment')} />

    </Screen>
  );
}
