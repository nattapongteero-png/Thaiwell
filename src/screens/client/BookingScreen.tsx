import React from 'react';
import { View } from 'react-native';
import { AppBar, Badge, Button, Card, ChipSection, Icon, ListItem, RadioGroup, Screen, SectionHeader, Text, VStack, useHideTabs, useTheme } from '../../design-system';
import { radius, space } from '../../design-system/tokens';
import { useJourney } from '../../state/JourneyContext';
import { useNav } from '../../navigation/types';

/* ============================================================ จองนวด
 * ต่อจากการประเมินกับ AI: สรุปอาการ + ข้อควรระวัง → เลือกบริการ (แนะนำจากแนวทาง) → วันเวลา → ผู้ให้บริการ → ยืนยัน
 * สิทธิบัตรทองครอบคลุม นวด ประคบ อบ ฟื้นฟูหลังคลอด (health profile 2568 หน้า 21)
 * ระดับผู้ให้บริการ: นวดเพื่อบำบัดโรค = ผู้ประกอบวิชาชีพแพทย์แผนไทย (health profile 2568 หน้า 34)
 */

const SERVICES = [
  { value: 'royal', label: 'นวดไทยแบบราชสำนัก · 60 นาที', uc: true },
  { value: 'royal+compress', label: 'นวดราชสำนัก + ประคบ · 90 นาที', uc: true },
  { value: 'relax', label: 'นวดผ่อนคลาย · 90 นาที', uc: false },
];
const THERAPISTS = [
  { value: 'malee', label: 'พท.ป. มาลี ใจดี', description: 'แพทย์แผนไทย' },
  { value: 'somjai', label: 'คุณสมใจ รักษ์ไทย', description: 'หมอนวดระดับ 2' },
];
const DAYS = ['วันนี้', 'พรุ่งนี้', 'ศ. 3 ต.ค.', 'ส. 4 ต.ค.'];
const TIMES = ['10:30', '13:00', '15:30', '17:00'];
const CLINIC = 'คลินิกแพทย์แผนไทย สาขาสุขุมวิท';

export function BookingScreen({ route }: { route?: { params?: { clinic?: string } } }) {
  const nav = useNav();
  // เลือกมาจากหน้าสถานที่ → ใช้สถานที่นั้น
  const clinic = route?.params?.clinic ?? CLINIC;
  // หน้าจองไม่ใช่แท็บ → ซ่อน tab menu (มีปุ่มยืนยันด้านล่างแทน)
  useHideTabs(true);
  const { colors } = useTheme();
  const { log, lastAssess, booking, setBooking, newPatient, careStage, setCareStage, drafts, activeDraftId, upsertDraft } = useJourney();
  const draft = drafts.find((d) => d.id === activeDraftId);
  // จองครั้งถัดไป = ครั้งก่อน + 1
  const visit = booking && careStage === 'served' ? booking.visit + 1 : booking?.visit ?? 1;
  const recommended = lastAssess?.caution?.includes('อบ') || !lastAssess ? 'royal' : 'royal+compress';
  const [service, setService] = React.useState(recommended);
  const [therapist, setTherapist] = React.useState('malee');
  const [day, setDay] = React.useState<string[]>([]);
  const [time, setTime] = React.useState<string[]>([]);
  const ready = day.length === 1 && time.length === 1;

  const confirm = () => {
    const svc = SERVICES.find((s) => s.value === service)!;
    const th = THERAPISTS.find((t) => t.value === therapist)!;
    const bk = { date: day[0], time: time[0], service: svc.label, therapist: th.label, clinic, queue: 'A12', visit };
    setBooking(bk);
    // นัดผูกกับใบร่างที่จอง → ช่องนัดบนหน้าแรกของใบนั้น
    if (draft) upsertDraft({ ...draft, stage: 'booked', booking: bk });
    if (newPatient) setCareStage('booked');
    log('ผู้รับบริการ', `จองนวด ${day[0]} ${time[0]} · ${svc.label}`);
    nav.navigate('BookingDone');
  };

  return (
    <Screen
      header={<AppBar onBack={() => nav.goBack()} title={visit > 1 ? `จองครั้งที่ ${visit}` : 'จองนวด'} subtitle={clinic} />}
      footer={<Button label={ready ? `ยืนยัน ${day[0]} ${time[0]}` : 'เลือกวันและเวลา'} disabled={!ready} onPress={confirm} />}
    >
      {/* จากการประเมินกับ AI — ผู้ให้บริการเห็นข้อมูลนี้ก่อนถึงคิว */}
      {lastAssess ? (
        <Card>
          <Text variant="labelMd">จากการประเมิน</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[1] }}>
            {lastAssess.symptoms.map((s) => (
              <Badge key={s} label={s} tone="neutral" />
            ))}
            <Badge label={`ปวด ${lastAssess.pain}/10`} tone="neutral" />
          </View>
          {lastAssess.caution ? (
            <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'center' }}>
              <Icon name="alert-triangle" size="xs" color={colors.status.warning.fg} />
              <Text variant="bodySm">{lastAssess.caution}</Text>
            </View>
          ) : null}
        </Card>
      ) : (
        <Card>
          <Text variant="bodySm" tone="secondary">
            ยังไม่ได้เล่าอาการ
          </Text>
          <Button label="ประเมินกับ AI ก่อน" variant="secondary" size="md" onPress={() => nav.navigate('ClientTabs', { screen: 'Home' })} />
        </Card>
      )}

      <SectionHeader title="บริการ" />
      <RadioGroup
        options={SERVICES.map((s) => ({ value: s.value, label: s.label, description: [s.value === recommended && lastAssess ? 'แนะนำจากการประเมิน' : '', s.uc ? 'ใช้สิทธิบัตรทองได้' : ''].filter(Boolean).join(' · ') || undefined }))}
        value={service}
        onChange={setService}
      />

      <Card>
        <ChipSection title="วัน" options={DAYS} value={day} onChange={(v) => setDay(v.slice(-1))} />
        <ChipSection title="เวลา" options={TIMES} value={time} onChange={(v) => setTime(v.slice(-1))} />
      </Card>

      <SectionHeader title="ผู้ให้บริการ" />
      <RadioGroup options={THERAPISTS} value={therapist} onChange={setTherapist} />
    </Screen>
  );
}

/** จองสำเร็จ — รายละเอียดนัด + เตรียมตัวก่อนมา */
export function BookingDoneScreen() {
  const nav = useNav();
  const { colors } = useTheme();
  const { booking, lastAssess } = useJourney();
  if (!booking) return null;
  // ก่อนมานวด: ตามข้อควรระวังจากการประเมิน + ทั่วไป (ไม่นวดภายใน 30 นาทีหลังอาหาร — ตำราอ้างอิงฯ หน้า 402)
  const prep = [
    ...(lastAssess?.caution?.includes('ความดัน') || lastAssess?.caution?.includes('อบ') ? ['วัดความดันก่อนนวด'] : []),
    'งดอาหารหนักก่อนนวด 30 นาที',
    'ใส่เสื้อผ้าหลวมสบาย',
  ];
  return (
    <Screen
      header={<AppBar title="จองแล้ว" />}
      footer={<Button label="กลับหน้าแรก" onPress={() => nav.reset({ index: 0, routes: [{ name: 'ClientTabs' }] })} />}
    >
      <VStack gap={2} align="center" style={{ paddingVertical: space[4] }}>
        <View style={{ width: 64, height: 64, borderRadius: radius.full, backgroundColor: colors.brand.subtle, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="check" size="lg" color={colors.brand.primary} />
        </View>
        <Text variant="titleLg">
          {booking.date} {booking.time}
        </Text>
        <Text variant="bodySm" tone="secondary">
          {booking.service}
        </Text>
      </VStack>
      <Card>
        <ListItem leadingIcon="user" title={booking.therapist} chevron={false} />
        <ListItem leadingIcon="map-pin" title={booking.clinic} chevron={false} />
      </Card>
      <Card>
        <Text variant="labelMd">ก่อนมานวด</Text>
        {prep.map((p) => (
          <View key={p} style={{ flexDirection: 'row', gap: space[2], alignItems: 'center' }}>
            <Icon name="check-circle" size="xs" color={colors.brand.primary} />
            <Text variant="bodySm">{p}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
