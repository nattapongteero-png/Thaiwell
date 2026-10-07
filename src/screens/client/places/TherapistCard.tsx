import React from 'react';
import { Pressable, View } from 'react-native';
import { Icon, ProfileAvatar, Tag, Text, useTheme } from '../../../design-system';
import { space } from '../../../design-system/tokens';
import { dayLabel, type FreeSlot, type Therapist } from '../../../data/booking';

export const THERAPIST_CARD_W = 248;
const CARD_W = THERAPIST_CARD_W;
/** ค่า id ของตัวเลือก "ไม่ระบุแพทย์" */
export const ANY_THERAPIST = 'any';

type Sel = { day: string; time: string } | null;

/**
 * การ์ดผู้ให้บริการ: รูป · ชื่อ · บทบาท (แพทย์แผนไทย = นวดเพื่อรักษา) · ประสบการณ์ · ถนัดเรื่องไหน · คิวว่างที่เลือกได้
 * t.free = ช่วงที่ลงตารางไว้ (กรองตามบริการมาแล้วจาก therapistsAt)
 * ⚠️ ต้นแบบ: ข้อมูลแนะนำตัวเป็นตัวอย่าง
 */
export function TherapistCard({ t, selected, onPick, badge, compact }: { t: Therapist; selected?: Sel; onPick?: (day: string, time: string) => void; /** เช่น แนะนำ (จาก AI) */ badge?: string; /** ดูข้อมูลอย่างเดียว (หน้าคลินิก) — ไม่มีคิวให้เลือก */ compact?: boolean }) {
  const { colors } = useTheme();
  const doctor = t.role === 'แพทย์แผนไทย';
  return (
    <Frame selected={!!selected}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <ProfileAvatar sex={t.sex} size={52} photo={t.photo} />
        <View style={{ flex: 1 }}>
          <Text variant="labelLg" numberOfLines={1}>
            {t.name}
          </Text>
          <Text variant="bodyXs" color={doctor ? colors.brand.primary : colors.text.secondary}>
            {doctor ? 'แพทย์แผนไทย · นวดเพื่อรักษา' : 'หมอนวด · นวดเพื่อสุขภาพ'}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {badge ? <Tag text={badge} tone="warn" /> : null}
        {t.years ? <Tag text={`ประสบการณ์ ${t.years} ปี`} /> : null}
        {(t.focus ?? []).map((f) => (
          <Tag key={f} text={f} tone="good" />
        ))}
      </View>
      {compact || !onPick ? null : <Slots slots={[...t.free].sort((a, b) => a.day - b.day || a.time.localeCompare(b.time))} who={t.name} selected={selected ?? null} onPick={onPick} />}
    </Frame>
  );
}

/** ไม่ระบุแพทย์: รวมคิวว่างของทุกคนที่รับบริการนี้ · ระบบจัดคนที่ว่างให้ตอนยืนยัน */
export function AnyTherapistCard({ slots, selected, onPick }: { slots: FreeSlot[]; selected: Sel; onPick: (day: string, time: string) => void }) {
  const { colors } = useTheme();
  return (
    <Frame selected={!!selected}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface.sunken }}>
          <Icon name="users" size="md" color={colors.text.secondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="labelLg" numberOfLines={1}>
            ไม่ระบุแพทย์
          </Text>
          <Text variant="bodyXs" tone="secondary">
            จัดผู้ที่ว่างให้
          </Text>
        </View>
      </View>
      <Slots slots={slots} who="ไม่ระบุแพทย์" selected={selected} onPick={onPick} />
    </Frame>
  );
}

function Frame({ selected, children }: { selected: boolean; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: CARD_W, gap: space[3], padding: space[4], borderRadius: 20, backgroundColor: colors.surface.default, borderWidth: selected ? 2 : 1, borderColor: selected ? colors.brand.primary : colors.border.subtle }}>
      {children}
    </View>
  );
}

function Slots({ slots, who, selected, onPick }: { slots: FreeSlot[]; who: string; selected: Sel; onPick: (day: string, time: string) => void }) {
  const { colors } = useTheme();
  const list = slots.map((f) => ({ day: dayLabel(f.day), time: f.time }));
  return (
    <View style={{ gap: space[2] }}>
      <Text variant="bodyXs" tone="secondary">
        คิวว่าง
      </Text>
      {list.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {list.map((sl) => {
            const on = selected?.day === sl.day && selected?.time === sl.time;
            return (
              <Pressable
                key={`${sl.day}${sl.time}`}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${who} ${sl.day} ${sl.time}`}
                onPress={() => onPick(sl.day, sl.time)}
                style={{ paddingHorizontal: space[2] + 2, paddingVertical: 6, borderRadius: 12, alignItems: 'center', backgroundColor: on ? colors.text.primary : colors.surface.sunken }}
              >
                <Text variant="labelMd" color={on ? colors.text.inverse : colors.text.primary}>
                  {sl.time}
                </Text>
                <Text variant="caption" color={on ? 'rgba(255,255,255,0.75)' : colors.text.tertiary}>
                  {sl.day}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text variant="bodySm" tone="tertiary">
          ยังไม่มีคิวว่าง
        </Text>
      )}
    </View>
  );
}
