import React from 'react';
import { Pressable, View } from 'react-native';
import { BottomSheet, Button, Icon, Text, useTheme } from '../../../design-system';
import { radius, space } from '../../../design-system/tokens';
import { PLACES } from '../PlacesScreen';
import { SERVICES } from '../BookingScreen';
import { dayLabel, freeFor, therapistsAt, type ServiceId } from '../../../data/booking';

/**
 * แก้ไขการจองเอง (manual) — เลือกสถานที่ → ผู้ให้บริการ → วันเวลา → บริการ แล้วบันทึกกลับไปที่การ์ดสรุป
 * แก้ข้อมูลที่มีตัวเลือกชัดเจน = แตะเลือกเอง เร็วและไม่ต้องให้ AI ตีความ (AI ใช้ช่วยวิเคราะห์/แนะนำ)
 */
export interface BookingDraft {
  placeId: string;
  therapistId: string;
  day: string;
  time: string;
  service: string;
}

export function BookingEditSheet({
  visible,
  initial,
  onClose,
  onSave,
  lockedService,
  lockedPlaceId,
}: {
  visible: boolean;
  initial: BookingDraft | null;
  onClose: () => void;
  onSave: (b: BookingDraft & { name: string; therapist: string }) => void;
  /** เรื่องที่รักษาอยู่: บริการตามแผนเดิม (เปลี่ยนไม่ได้) → แสดงเฉพาะคนที่รับบริการนี้ */
  lockedService?: ServiceId;
  /** เรื่องที่รักษาอยู่: ต้องที่เดิม (เปลี่ยนสถานที่ไม่ได้) */
  lockedPlaceId?: string;
}) {
  const { colors } = useTheme();
  const [d, setD] = React.useState<BookingDraft | null>(initial);
  React.useEffect(() => {
    if (visible) setD(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  if (!d) return null;

  // บริการที่จอง → กรองสถานที่/ผู้ให้บริการ/เวลา ให้ตรงตารางที่แพทย์ลงไว้ (เหมือนหน้าจอง)
  const sid: ServiceId | undefined = lockedService ?? SERVICES.find((x) => x.label === d.service)?.value;
  const places = PLACES.filter((p) => p.kind === 'clinic' && therapistsAt(p.id, sid).length && (!lockedPlaceId || p.id === lockedPlaceId));
  const therapists = therapistsAt(d.placeId, sid);
  const t = therapists.find((x) => x.id === d.therapistId);
  const slots = (t ? freeFor(t, sid) : []).map((f) => ({ day: dayLabel(f.day), time: f.time }));
  const slotOk = slots.some((s) => s.day === d.day && s.time === d.time);
  const ready = !!t && slotOk;

  /** เปลี่ยนสถานที่/ผู้ให้บริการ → เลือกคนแรก/เวลาแรกที่ว่างให้ใหม่ (ของเดิมอาจไม่มีที่นี่) */
  const setPlace = (placeId: string) => {
    const nt = therapistsAt(placeId, sid)[0];
    const f = nt?.free.slice().sort((a, b) => a.day - b.day)[0];
    setD({ ...d, placeId, therapistId: nt?.id ?? '', day: f ? dayLabel(f.day) : '', time: f?.time ?? '' });
  };
  const setTherapist = (therapistId: string) => {
    const nt = therapists.find((x) => x.id === therapistId);
    const keep = nt?.free.some((f) => dayLabel(f.day) === d.day && f.time === d.time);
    const f = nt?.free.slice().sort((a, b) => a.day - b.day)[0];
    setD({ ...d, therapistId, ...(keep || !f ? null : { day: dayLabel(f.day), time: f.time }) });
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={{ gap: space[2] }}>
      <Text variant="labelMd" tone="secondary">
        {title}
      </Text>
      {children}
    </View>
  );
  const Chip = ({ label, on, onPress, sub }: { label: string; on: boolean; onPress: () => void; sub?: string }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{
        paddingHorizontal: space[3],
        paddingVertical: space[2],
        borderRadius: radius.lg,
        borderWidth: on ? 2 : 1,
        borderColor: on ? colors.brand.primary : colors.border.subtle,
        backgroundColor: on ? colors.brand.subtle : colors.surface.default,
      }}
    >
      <Text variant="labelMd" color={on ? colors.brand.primary : colors.text.primary}>
        {label}
      </Text>
      {sub ? (
        <Text variant="caption" tone="secondary">
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="แก้ไขการจอง"
      heightRatio={0.82}
      footer={
        <Button
          label="บันทึก"
          disabled={!ready}
          onPress={() => onSave({ ...d, name: PLACES.find((p) => p.id === d.placeId)?.name ?? '', therapist: t?.name ?? '' })}
        />
      }
    >
      <Section title="สถานที่">
        <View style={{ gap: space[2] }}>
          {places.map((p) => (
            <Chip key={p.id} label={p.name} sub={`${p.km} กม. ${p.area}`} on={p.id === d.placeId} onPress={() => setPlace(p.id)} />
          ))}
        </View>
      </Section>
      <Section title="ผู้ให้บริการ">
        <View style={{ gap: space[2] }}>
          {therapists.map((x) => (
            <Pressable
              key={x.id}
              accessibilityRole="button"
              accessibilityState={{ selected: x.id === d.therapistId }}
              onPress={() => setTherapist(x.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[3],
                padding: space[3],
                borderRadius: radius.lg,
                borderWidth: x.id === d.therapistId ? 2 : 1,
                borderColor: x.id === d.therapistId ? colors.brand.primary : colors.border.subtle,
                backgroundColor: x.id === d.therapistId ? colors.brand.subtle : colors.surface.default,
              }}
            >
              <Icon name="user" size="sm" color={x.role === 'แพทย์แผนไทย' ? colors.brand.primary : colors.text.secondary} />
              <View style={{ flex: 1 }}>
                <Text variant="labelMd">{x.name}</Text>
                <Text variant="caption" tone="secondary">
                  {x.role}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </Section>
      <Section title="วันเวลา">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          {slots.map((s) => (
            <Chip key={`${s.day}${s.time}`} label={s.time} sub={s.day} on={s.day === d.day && s.time === d.time} onPress={() => setD({ ...d, day: s.day, time: s.time })} />
          ))}
        </View>
      </Section>
      <Section title="บริการ">
        {lockedService ? (
          <Text variant="bodyMd">{d.service} (ตามแผนการรักษา)</Text>
        ) : (
          <View style={{ gap: space[2] }}>
            {SERVICES.map((sv) => (
              <Chip
                key={sv.value}
                label={sv.label}
                on={sv.label === d.service}
                onPress={() => {
                  // คนเดิมไม่รับบริการใหม่ → เลือกคนแรกที่รับให้ใหม่
                  const ok = therapistsAt(d.placeId, sv.value).find((x) => x.id === d.therapistId);
                  const nt = ok ?? therapistsAt(d.placeId, sv.value)[0];
                  const f = nt ? freeFor(nt, sv.value)[0] : undefined;
                  const keep = nt && freeFor(nt, sv.value).some((x) => dayLabel(x.day) === d.day && x.time === d.time);
                  setD({ ...d, service: sv.label, therapistId: nt?.id ?? '', ...(keep || !f ? null : { day: dayLabel(f.day), time: f.time }) });
                }}
              />
            ))}
          </View>
        )}
      </Section>
    </BottomSheet>
  );
}
