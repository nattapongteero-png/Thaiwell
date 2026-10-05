import React from 'react';
import { Pressable, View } from 'react-native';
import { AppBar, Button, Icon, IconBox, InfoRow, Panel, Screen, TINT, Text, useHideTabs, useTheme, ScreenSkeleton, useScreenData } from '../../design-system';
import { radius, space } from '../../design-system/tokens';
import { useAppointment } from '../../state/appointments';
import { NotFoundScreen } from './NotFound';
import { useJourney } from '../../state/JourneyContext';
import { useNav } from '../../navigation/types';
import { PLACES, openMap } from './PlacesScreen';

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
  const nav = useNav();
  const { colors } = useTheme();
  useHideTabs(true);
  const { drafts, upsertDraft, cancelAppointment, newPatient, setCareStage, log, removeLooseBooking } = useJourney();
  const [confirming, setConfirming] = React.useState(false);
  // นัดของเรื่องนี้ (ใบการรักษา / ใบร่าง / จองไว้ก่อนประเมิน)
  const appt = useAppointment(target);
  if (!appt) return <NotFoundScreen title="รายละเอียดนัด" message="นัดนี้ถูกยกเลิกหรือใช้ไปแล้ว" />;
  const place = PLACES.find((p) => p.name === appt.clinic);

  const cancel = () => {
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
            {appt.today && !appt.red ? <Button label="เช็กอิน" iconLeft="maximize" onPress={() => nav.navigate('CheckIn', appt.target)} /> : null}
            {/* เลื่อนนัดของเรื่องเดิม (ไม่ใช่จองเรื่องใหม่) */}
            <Button label="เลื่อนนัด" iconLeft="edit-2" variant="secondary" onPress={() => nav.navigate('Booking', { clinic: appt.clinic, ...appt.target })} />
            <Pressable accessibilityRole="button" onPress={() => setConfirming(true)} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="labelLg" color={colors.status.danger.fg}>
                ยกเลิกนัด
              </Text>
            </Pressable>
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
                {place.km} กม. {place.area}
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
          {place ? (
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
      </View>

      <Panel icon="clipboard" tint={TINT.green} title="ข้อมูลนัด">
        <InfoRow k="ผู้ให้บริการ" v={appt.therapist} />
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
