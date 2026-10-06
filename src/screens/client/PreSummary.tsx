import React from 'react';
import { Linking, View } from 'react-native';
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
 Panel, TINT, Tag, fontFamily, space } from '../../design-system';
import { useJourney } from '../../state/JourneyContext';
import { useNav } from '../../navigation/types';
import { useAppointment } from '../../state/appointments';
import { NotFoundScreen } from './NotFound';

/* ============================================================ 07 PRE-SERVICE SUMMARY */

export function PreSummaryScreen() {
  const nav = useNav();
  const { colors } = useTheme();
  const { chiefComplaint, goal, symptoms, before, safety, profile, log, lastAssess } = useJourney();
  // มาจากแชท AI → ใช้ผลประเมินในแชท (ข้อมูลชุดเดียวกับการ์ด) แทนข้อมูลจากแบบฟอร์มเดิม
  const fromChat = !!lastAssess;
  const regions = (Object.entries(symptoms) as [RegionId, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  // มาจากแชท → ผลความปลอดภัยของแชทนั้น (ไม่ใช่จากโปรไฟล์อย่างเดียว)
  const level = fromChat && lastAssess?.red ? 'red' : fromChat && lastAssess?.caution && safety.level === 'green' ? 'amber' : safety.level;
  const meta = safetyMeta[level];
  const isRed = level === 'red';

  return (
    <Screen
      header={<AppBar title="สรุปก่อนรับบริการ" onBack={() => nav.goBack()} />}
      footer={
        isRed ? (
          <Button label="ดูคำแนะนำเพื่อความปลอดภัย" variant="danger" iconRight="arrow-right" onPress={() => nav.navigate('RedFlag', lastAssess?.red ? { reason: `ผลประเมิน${lastAssess.symptoms.join(', ')}` } : undefined)} />
        ) : (
          <Button
            label={fromChat ? 'จองนวด' : 'ยืนยันและส่งให้ผู้ให้บริการ'}
            iconRight={fromChat ? 'calendar' : 'send'}
            onPress={() => {
              log('ผู้รับบริการ', 'ยืนยันสรุปและส่งให้ผู้ให้บริการ');
              // ส่งแบบฟอร์มแล้ว → จองนัด (เช็กอินต้องมีนัดก่อน)
              nav.navigate('Booking');
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
          // ยังไม่ได้บอกโรคประจำตัว/ยา → ไม่บอกว่า "ไม่พบข้อควรระวัง"
          profile.healthKnown === false
            ? 'ยังไม่มีข้อมูลโรคประจำตัวและยา ผู้ให้บริการจะซักเพิ่มก่อนนวด'
            : level === 'amber' && lastAssess?.caution && safety.level === 'green'
            ? lastAssess.caution
            : safety.level === 'green'
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

export function CheckInScreen({ route }: { route?: { params?: { caseId?: string; draftId?: string; looseId?: string } } }) {
  const nav = useNav();
  const { colors } = useTheme();
  const target = route?.params ?? {};
  // นัดของเรื่องที่แตะมา (ไม่ใช่นัดล่าสุดที่จอง)
  const appt = useAppointment(target);
  const { caseToday, clinicCloseVisit } = useJourney();
  if (!appt) return <NotFoundScreen title="เช็กอิน" message="ยังไม่มีนัดสำหรับเช็กอิน" />;
  // ต้นแบบ: ข้ามช่วงนวด → คลินิกปิดการรักษาในหลังบ้าน (ครั้งใหม่ + คะแนนของคลินิก + บิล) → หน้าผลลัพธ์ของเรื่องนี้
  // นัดเรื่องใหม่ที่ยังไม่ได้เล่าอาการ (ไม่มีใบ) → แบบประเมินหลังนวดแบบเดิม
  const finish = () => {
    const caseId = appt.target.looseId ? undefined : clinicCloseVisit(appt.target);
    if (caseId) nav.navigate('SessionResult', { caseId });
    else nav.navigate('PostAssessment', appt.target);
  };
  // เรื่องที่รักษาอยู่: ต้องประเมินอาการก่อนนวดครั้งนี้ (คะแนนวันนี้ + อาการหลังนวดครั้งก่อน + ข้อห้ามใหม่)
  const pre = target.caseId ? caseToday[target.caseId] : undefined;
  const needPre = appt.kind === 'case' && !pre;
  const blocked = appt.red || !!pre?.red;
  return (
    <Screen
      header={<AppBar title="เช็กอิน" onBack={() => nav.goBack()} />}
      footer={
        appt.today && !blocked && !appt.pending ? (
          <>
            {/* ยังไม่ได้เล่าอาการ / ยังไม่ได้ประเมินก่อนนวดครั้งนี้ → ทำก่อน (ผู้ให้บริการเห็นก่อนถึงคิว) */}
            {appt.assessed ? null : <Button label="เล่าอาการก่อนเข้ารับบริการ" onPress={() => nav.popTo('ClientTabs', { screen: 'Home' })} />}
            {needPre ? <Button label="ประเมินก่อนนวด" onPress={() => nav.popTo('ClientTabs', { screen: 'Home', params: { assessCase: target.caseId } })} /> : null}
            {/* ต้นแบบ: ข้ามช่วงที่ผู้ให้บริการนวด → ไปหลังรับบริการ (ของเรื่องนี้) */}
            <Button label="จำลอง: นวดเสร็จแล้ว" variant="secondary" onPress={finish} />
          </>
        ) : (
          <Button label="กลับ" variant="secondary" onPress={() => nav.goBack()} />
        )
      }
    >
      {blocked ? (
        <Panel icon="alert-triangle" tint={TINT.red} title="ควรพบแพทย์ก่อนนวด">
          <Text variant="bodySm" tone="secondary">
            ผลประเมินมีสัญญาณที่ต้องให้แพทย์ตรวจก่อน แนะนำเลื่อนนัดนี้
          </Text>
          <Button label="ดูคำแนะนำ" variant="secondary" size="md" onPress={() => nav.navigate('RedFlag', { reason: appt.topic })} />
        </Panel>
      ) : appt.pending ? (
        // คำขอจองยังไม่ได้รับการยืนยัน → ยังเช็กอินไม่ได้
        <Panel icon="clock" tint={TINT.amber} title="รอคลินิกยืนยันนัด">
          <Text variant="bodySm" tone="secondary">
            {appt.date} {appt.time} · {appt.clinic} จะแจ้งเตือนในแอปเมื่อยืนยันแล้ว
          </Text>
        </Panel>
      ) : !appt.today ? (
        // เช็กอินได้เฉพาะวันนัด
        <Panel icon="calendar" tint={TINT.amber} title="เช็กอินได้ในวันนัด">
          <Text variant="bodySm" tone="secondary">
            นัดของคุณ {appt.date} {appt.time} · {appt.clinic}
          </Text>
        </Panel>
      ) : (
        <>
          {/* คิว + QR แบบการ์ดหลังบ้าน */}
          <Panel>
            <View style={{ alignItems: 'center', gap: 2 }}>
              <Text variant="bodyXs" tone="secondary">
                {appt.queue ? 'คิวของคุณ' : 'นัดวันนี้'}
              </Text>
              <Text style={{ fontFamily: fontFamily.bold, fontSize: 56, lineHeight: 72, color: colors.brand.primary }}>{appt.queue ?? appt.time}</Text>
              <Text variant="bodySm" tone="secondary">
                {[appt.queue ? appt.time : '', appt.therapist].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <View style={{ alignSelf: 'center', width: 190, height: 190, borderRadius: 20, backgroundColor: colors.surface.sunken, alignItems: 'center', justifyContent: 'center', gap: space[2] }}>
              <Icon name="maximize" size="xl" color={colors.text.secondary} />
              <Text variant="bodyXs" tone="secondary">
                แสดง QR นี้ที่เคาน์เตอร์
              </Text>
            </View>
          </Panel>
          <Panel icon="list" tint={TINT.green} title="ขั้นตอนวันนี้">
            {(
              [
                // ส่งข้อมูลแล้วจริงเฉพาะเมื่อเล่าอาการแล้ว
                appt.kind === 'case'
                  ? [pre ? `ประเมินก่อนนวดแล้ว · วันนี้ปวด ${pre.pain}/10` : 'ประเมินอาการก่อนนวด', !!pre]
                  : [appt.assessed ? 'ส่งข้อมูลอาการให้ผู้ให้บริการแล้ว' : 'เล่าอาการให้ผู้ให้บริการ', appt.assessed],
                ['วัดความดันและชีพจรก่อนนวด', false],
                ['ตกลงแผนการนวดร่วมกัน', false],
              ] as [string, boolean][]
            ).map(([t, ok], i) => (
              <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: ok ? colors.brand.primary : colors.surface.sunken }}>
                  {ok ? <Icon name="check" size="xs" color="#FFFFFF" /> : <Text variant="labelSm" tone="secondary">{i + 1}</Text>}
                </View>
                <Text variant="bodyMd" tone={ok ? 'primary' : 'secondary'}>
                  {t}
                </Text>
              </View>
            ))}
          </Panel>
        </>
      )}
    </Screen>
  );
}

/* ============================================================ 07b RED FLAG REFERRAL */

export function RedFlagScreen({ route }: { route?: { params?: { reason?: string } } }) {
  const nav = useNav();
  const { colors } = useTheme();
  const { safety, log, lastAssess, drafts } = useJourney();
  const reds = safety.hits.filter((h) => h.level === 'red');
  // เหตุที่ส่งมา (แชท/ติดตามผล) + ผลประเมินที่ให้พบแพทย์ + กฎความปลอดภัยจากโปรไฟล์ → ไม่ขึ้น "ไม่พบสัญญาณ" ใต้หัวข้อที่บอกว่าไม่ควรนวด
  const reasons = [
    ...(route?.params?.reason ? [route.params.reason] : []),
    ...drafts.filter((d) => d.red).map((d) => `ผลประเมิน${d.title}`),
    ...(lastAssess?.red && !drafts.some((d) => d.red) ? [`ผลประเมิน${lastAssess.symptoms.join(', ')}`] : []),
  ].filter((x, i, all) => all.indexOf(x) === i);
  const call1669 = () => {
    log('ผู้รับบริการ', 'โทรฉุกเฉิน 1669');
    Linking.openURL('tel:1669').catch(() => {});
  };
  return (
    <Screen
      header={<AppBar title="เพื่อความปลอดภัยของคุณ" onBack={() => nav.goBack()} />}
      footer={
        <>
          <Button label="โทร 1669 (ฉุกเฉิน)" variant="danger" iconLeft="phone" onPress={call1669} />
          {/* ไปหาโรงพยาบาล/ศูนย์สาธารณสุขใกล้คุณ (นำทาง/โทรได้จากหน้ารายละเอียด) */}
          <Button label="หาโรงพยาบาลใกล้คุณ" variant="secondary" iconLeft="map-pin" onPress={() => nav.popTo('ClientTabs', { screen: 'Places', params: { mode: 'doctor' } })} />
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

      {reasons.length || reds.length ? (
        <Panel title="สิ่งที่ระบบพบ">
          {reasons.map((r) => (
            <Text key={r} variant="bodyMd">
              {r}
            </Text>
          ))}
          {reds.map((h) => (
            <VStack key={h.ruleId} gap={1}>
              <HStack justify="space-between">
                <Text variant="bodyMd">{h.title}</Text>
                <Tag text={h.ruleId} tone="bad" />
              </HStack>
              <Text variant="bodySm" tone="secondary">
                ข้อมูล: {h.evidence}
              </Text>
            </VStack>
          ))}
        </Panel>
      ) : null}

      <Panel icon="phone" tint={TINT.red} title="โทร 1669 ทันทีถ้ามีอาการเหล่านี้">
        <Text variant="bodySm" tone="secondary">
          ชาหรืออ่อนแรงครึ่งซีก พูดไม่ชัด เจ็บแน่นหน้าอก ปวดศีรษะรุนแรงเฉียบพลัน
        </Text>
      </Panel>
    </Screen>
  );
}
