import React from 'react';
import { Pressable, View } from 'react-native';
import { Text, painColor, useTheme } from '../../../design-system';
import { radius, space } from '../../../design-system/tokens';

/** คำอธิบายระดับปวด (ช่วงเดียวกับสเกล 0–10 ที่ใช้ทั้งแอป) */
const painWord = (v: number) => (v === 0 ? 'ไม่ปวด' : v <= 3 ? 'ปวดน้อย' : v <= 6 ? 'ปวดปานกลาง' : v <= 8 ? 'ปวดมาก' : 'ปวดมากที่สุด');

/**
 * เลือกระดับปวด 0–10 แบบแตะง่าย — ตัวเลขที่เลือกแสดงใหญ่พร้อมคำอธิบาย · เทียบกับคะแนนครั้งก่อน
 * ปุ่มสองแถว (0–5 · 6–10) สูงพอสำหรับนิ้ว · เลือกแล้วเป็นสีตามระดับปวด · ครั้งก่อนมีจุดเล็กใต้ตัวเลข (ไม่ใช่กรอบที่ดูเหมือนเลือกแล้ว)
 */
export function PainPicker({ value, onChange, compareValue, compareLabel }: { value?: number; onChange: (v: number) => void; compareValue?: number; compareLabel?: string }) {
  const { colors } = useTheme();
  const diff = value !== undefined && compareValue !== undefined ? value - compareValue : null;
  const cell = (v: number) => {
    const on = value === v;
    const c = painColor(v);
    return (
      <Pressable
        key={v}
        accessibilityRole="radio"
        accessibilityState={{ selected: on }}
        accessibilityLabel={`ปวด ${v} ${painWord(v)}`}
        onPress={() => onChange(v)}
        style={({ pressed }) => ({
          flex: 1,
          height: 52,
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: on ? c : colors.surface.default,
          borderWidth: on ? 0 : 1,
          borderColor: colors.border.subtle,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text variant="titleSm" color={on ? '#FFFFFF' : colors.text.primary}>
          {v}
        </Text>
        {/* คะแนนครั้งก่อน = จุดเล็กใต้ตัวเลข */}
        {compareValue === v && !on ? <View style={{ position: 'absolute', bottom: 6, width: 5, height: 5, borderRadius: 3, backgroundColor: colors.text.tertiary }} /> : null}
      </Pressable>
    );
  };
  return (
    <View style={{ gap: space[3] }}>
      {/* ค่าที่เลือก (ใหญ่) · ยังไม่เลือก = ชวนแตะ */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space[2] }}>
        {value !== undefined ? (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[2] }}>
            <Text variant="displayMd" color={painColor(value)} style={{ lineHeight: 50 }}>
              {value}
            </Text>
            <Text variant="titleSm" tone="secondary">
              /10 · {painWord(value)}
            </Text>
          </View>
        ) : (
          <Text variant="bodyMd" tone="tertiary">
            แตะตัวเลขด้านล่าง
          </Text>
        )}
        {compareValue !== undefined ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="bodyXs" tone="tertiary">
              {compareLabel ?? 'ครั้งก่อน'}
            </Text>
            <Text variant="labelMd" tone="secondary">
              {compareValue}/10
              {diff !== null ? (diff < 0 ? ` · ดีขึ้น ${-diff}` : diff > 0 ? ` · เพิ่ม ${diff}` : ' · เท่าเดิม') : ''}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: space[2] }}>{[0, 1, 2, 3, 4, 5].map(cell)}</View>
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        {[6, 7, 8, 9, 10].map(cell)}
        {/* ช่องว่างให้ปุ่มแถวล่างกว้างเท่าแถวบน */}
        <View style={{ flex: 1 }} />
      </View>
    </View>
  );
}
