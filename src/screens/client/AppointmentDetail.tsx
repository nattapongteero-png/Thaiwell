import React from 'react';
import { kmText } from '../../services/location';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { AppBar, Button, Icon, IconBox, InfoRow, Panel, Screen, TINT, Text, useHideTabs, useTheme, ScreenSkeleton, useScreenData } from '../../design-system';
import { radius, space } from '../../design-system/tokens';
import { serviceMismatch, useAppointment } from '../../state/appointments';
import { NotFoundScreen } from './NotFound';
import { useJourney } from '../../state/JourneyContext';
import { useNav } from '../../navigation/types';
import { readAvailability } from '../../services/clinicBridge';
import { TherapistCard, findTherapist } from './places/TherapistCard';
import { PLACES, callClinic, clinicPhone, openMap } from './PlacesScreen';

/**
 * รายละเอียดนัด — เข้าจากการแตะการ์ดนัดบนหน้าแรก
 * ที่ไหน (นำทาง) · เมื่อไหร่ · คิว · ผู้ให้บริการ · บริการ · เรื่องที่นัด · ก่อนมานวด
 * การกระทำ: เช็กอิน (วันนี้) · แก้ไขนัด (หน้าจอง) · ยกเลิกนัด (ยืนยันก่อน)
 * ⚠️ ต้นแบบ: ยกเลิกนัดของใบการรักษาตัวอย่างเก็บแค่ในเครื่อง (ยังไม่มีระบบนัดจริง)
 */
export function AppointmentDetailScreen({ route }: { route: { params?: { caseId?: string; draftId?: string; looseId?: string } } }) {
  const target = route.params ?? {};
  // โหลดข้อมูลของหน้า (ครั้งแรก) → skeleton
  const loading = useScreenData(`appt-${target.caseId ?? target.draftId ?? target.looseId ?? 'loose'}`);
  const { width: winW } = useWindowDimensions();
  const nav = useNav();
  const { colors } = useTheme();
  useHideTabs(true);
  const { drafts, upsertDraft, cancelAppointment, newPatient, setCareStage, log, removeLooseBooking, cancelBooking } = useJourney();
  const [confirming, setConfirming] = React.useState(false);
  // นัดของเรื่องนี้ (ใบการรักษา / ใบร่าง / จองไว้ก่อนประเมิน)
  const appt = useAppointment(target);
  if (!appt) return <NotFoundScreen title="รายละเอียดนัด" message="นัดนี้ถูกยกเลิกหรือใช้ไปแล้ว" />;
  // คิวที่คลินิกประกาศว่ายังรอ → รออีกกี่คิว
  const waiting = readAvailability()?.queue?.waiting;
  const ahead = appt.queue && waiting ? waiting.filter((x) => x < appt.queue!).length : null;
  const place = PLACES.find((p) => p.name === appt.clinic);
  const draftOf = drafts.find((d) => d.id === target.draftId);
  const mismatch = appt.kind === 'draft' && !appt.red && !draftOf?.keepService ? serviceMismatch(appt.service, draftOf?.caution) : null;

  const cancel = () => {
    // นัดที่ส่งไปคลินิกแล้ว (cloud) → แจ้งหลังบ้านว่าผู้ป่วยยกเลิก
    cancelBooking(appt.target);
    if (appt.kind === 'case' && target.caseId) cancelAppointment(target.caseId);
    else if (appt.kind === 'draft') {
      const draft = drafts.find((d) => d.id === target.draftId);
      if (draft) upsertDraft({ ...draft, stage: 'assessed', booking: undefined });
    } else if (appt.target.looseId) removeLooseBooking(appt.target.looseId);
    // ยังมีนัดของเรื่องอื่นอยู่ → ยังถือว่า "จองแล้ว"
    if (newPatient) setCareStage(drafts.some((d) => d.booking && d.id !== target.draftId) ? 'booked' : 'assessed');
    log('ผู้รับบริการ', `ยกเลิกนัด ${appt.date} ${appt.time}${appt.topic ? ` · ${appt.topic}` : ''}`);
    nav.goBack();
  };

  return (
    <Screen
      header={<AppBar eyebrow="นัดของคุณ" title="รายละเอียดนัด" onBack={() => nav.goBack()} />}
      footer={
        confirming ? (
          // ยืนยันก่อนยกเลิก (ย้อนไม่ได้)
          <View style={{ gap: space[2] }}>
            <Text variant="bodySm" align="center">
              ยกเลิกนัด {appt.date} {appt.time} ใช่ไหม?
            </Text>
            <Button label="ยืนยันยกเลิกนัด" variant="danger" onPress={cancel} />
            <Button label="ไม่ยกเลิก" variant="ghost" onPress={() => setConfirming(false)} />
          </View>
        ) : (
          <View style={{ gap: space[2] }}>
            {appt.today && !appt.red && !appt.pending && !appt.queue ? <Button label="เช็กอิน" iconLeft="maximize" onPress={() => nav.navigate('CheckIn', appt.target)} /> : null}
            {/* เช็กอินแล้ว / ถึงคิว / รับบริการ: เลื่อน-ยกเลิกในแอปไม่ได้แล้ว → ติดต่อคลินิก */}
            {appt.kind === 'case' || appt.queue || appt.stage ? (
              // นัดของการรักษา: เลื่อน/ยกเลิกทำที่คลินิกเท่านั้น (หลังบ้านโรงพยาบาลแก้แล้วแอปแจ้งเตือน)
              <Button label={`ติดต่อคลินิก ${clinicPhone(appt.clinic)}`} iconLeft="phone" variant="secondary" onPress={() => callClinic(appt.clinic)} />
            ) : (
              <>
                {/* นัดที่ยังไม่ได้รักษา (จองเองในแอป) → เลื่อน/ยกเลิกเองได้ */}
                <Button label="เลื่อนนัด" iconLeft="edit-2" variant="secondary" onPress={() => nav.navigate('Booking', { clinic: appt.clinic, ...appt.target })} />
                <Pressable accessibilityRole="button" onPress={() => setConfirming(true)} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Text variant="labelLg" color={colors.status.danger.fg}>
                    ยกเลิกนัด
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        )
      }
    >
      {loading ? (
        <ScreenSkeleton variant="detail" />
      ) : (
      <>
      {/* ที่ไหน · เมื่อไหร่ + คิว ชิดซ้ายต่อกัน (ข้อมูลสำคัญ ขนาดเท่ากัน) · นำทางชิดขวาแถวเดียวกัน */}
      <View style={{ gap: space[4], padding: space[4], borderRadius: 20, backgroundColor: colors.surface.default, borderWidth: 1, borderColor: colors.border.subtle }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <IconBox icon="map-pin" tint={TINT.green} size={44} />
          <View style={{ flex: 1 }}>
            <Text variant="titleSm">{appt.clinic}</Text>
            {place ? (
              <Text variant="bodyXs" tone="secondary">
                {kmText(place)} {place.area}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[6] }}>
          <View>
            <Text variant="bodyXs" tone="secondary">
              {appt.date}
            </Text>
            <Text variant="displayMd" style={{ lineHeight: 44 }}>
              {appt.time}
            </Text>
          </View>
          {appt.queue ? (
            <View>
              <Text variant="bodyXs" tone="secondary">
                คิว
              </Text>
              <Text variant="displayMd" color={colors.brand.primary} style={{ lineHeight: 44 }}>
                {appt.queue}
              </Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          {place && !appt.stage ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`นำทางไป ${appt.clinic}`}
              onPress={() => openMap(place)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, marginBottom: 6, paddingHorizontal: space[3], borderRadius: radius.full, borderWidth: 1, borderColor: colors.border.subtle, backgroundColor: colors.surface.default }}
            >
              <Icon name="navigation" size="xs" color={colors.brand.primary} />
              <Text variant="labelSm" color={colors.brand.primary}>
                นำทาง
              </Text>
            </Pressable>
          ) : null}
        </View>
        {/* วันนัดหลังเช็กอิน (รวมหน้าดูคิวไว้ที่นี่): รออีกกี่คิว → ถึงคิว (เด่น) → กำลังรับบริการ */}
        {/* กำลังรับบริการ → การ์ดผู้ให้บริการพร้อมป้ายสถานะ (แทนแถบข้อความ + ชื่อซ้ำ) */}
        {appt.today && appt.stage === 'in_service' && appt.therapist ? (
          <TherapistCard t={findTherapist(appt.therapist)} compact width={winW - space[4] * 4 - 2} status="กำลังรับบริการ" />
        ) : appt.today && (appt.queue || appt.stage) ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], paddingHorizontal: space[3], paddingVertical: space[2], borderRadius: 14, backgroundColor: appt.stage === 'called' || appt.stage === 'in_service' ? colors.brand.primary : colors.surface.sunken }}>
            <Icon name={appt.stage === 'in_service' ? 'activity' : appt.stage === 'called' ? 'bell' : 'clock'} size="sm" color={appt.stage === 'called' || appt.stage === 'in_service' ? '#FFFFFF' : colors.text.secondary} />
            <Text variant="labelMd" color={appt.stage === 'called' || appt.stage === 'in_service' ? '#FFFFFF' : colors.text.secondary} style={{ flex: 1 }}>
              {appt.stage === 'in_service'
                ? `กำลังรับบริการ${appt.therapist ? ` · ${appt.therapist}` : ''}`
                : appt.stage === 'called'
                  ? 'ถึงคิวแล้ว เชิญเข้ารับบริการ'
                  : ahead
                    ? `รออีก ${ahead} คิว`
                    : 'รอเรียกคิว'}
            </Text>
          </View>
        ) : null}
      </View>

      {/* จองไว้ก่อนประเมิน แล้วผลประเมินต้องการบริการอื่น → เปลี่ยนบริการในนัดนี้ */}
      {mismatch ? (
        <Panel icon="alert-triangle" tint={TINT.amber} title="บริการไม่ตรงผลประเมิน">
          <Text variant="bodySm" tone="secondary">
            {mismatch}
          </Text>
          {/* ไม่บังคับ: เปลี่ยนตามคำแนะนำ หรือใช้แผนเดิม */}
          <Button label="เปลี่ยนตามคำแนะนำ" size="md" onPress={() => nav.navigate('Booking', { clinic: appt.clinic, ...appt.target })} />
          <Button
            label="ใช้แผนเดิม"
            variant="secondary"
            size="md"
            onPress={() => {
              if (draftOf) upsertDraft({ ...draftOf, keepService: true });
              log('ผู้รับบริการ', `คงบริการที่จองไว้ (${appt.service}) แม้ไม่ตรงผลประเมิน`);
            }}
          />
        </Panel>
      ) : null}

      {appt.pending ? (
        <Panel icon="clock" tint={TINT.amber} title="รอคลินิกยืนยัน">
          <Text variant="bodySm" tone="secondary">
            ส่งคำขอจองแล้ว คลินิกจะยืนยันและแจ้งเตือนในแอป ถ้าคิวเต็มคลินิกอาจติดต่อเพื่อเลือกเวลาใหม่
          </Text>
        </Panel>
      ) : null}
      {appt.kind === 'case' && !appt.queue && !appt.stage ? (
        <Text variant="bodySm" tone="secondary">
          ต้องการเลื่อนหรือยกเลิกนัด ติดต่อคลินิก คลินิกจะแก้ไขให้และแจ้งเตือนในแอป
        </Text>
      ) : null}

      <Panel icon="clipboard" tint={TINT.green} title="ข้อมูลนัด">
        {appt.today && appt.stage === 'in_service' ? null : <InfoRow k="ผู้ให้บริการ" v={appt.therapist} />}
        <InfoRow k="บริการ" v={appt.service} />
        <InfoRow k="เรื่องที่นัด" v={appt.topic ?? 'ยังไม่ได้เล่าอาการ'} />
        <InfoRow k="ครั้งที่" v={appt.visit.replace('ครั้งที่ ', '')} />
      </Panel>

      <Panel icon="check-circle" tint={TINT.amber} title="ก่อนมานวด">
        {appt.prep.map((p) => (
          <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: TINT.amber }} />
            <Text variant="bodySm">{p}</Text>
          </View>
        ))}
      </Panel>
      </>
      )}
    </Screen>
  );
}
