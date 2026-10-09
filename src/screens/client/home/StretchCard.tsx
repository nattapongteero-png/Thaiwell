import React from 'react';
import { Pressable, View } from 'react-native';
import { LoadingImage, Text, fontFamily, stretchGif, useTheme } from '../../../design-system';
import { radius, space } from '../../../design-system/tokens';
import { SYMPTOM_GROUPS } from '../../../data/thaiMassageKnowledge';
import { STRETCH_MOTION } from '../../../data/stretchMotion';

/**
 * การ์ดท่ายืด (แบบหน้ารวมท่ายืด: ภาพเคลื่อนไหว + ป้ายส่วนที่ได้ยืด + ชื่อท่า + กลุ่มอาการ)
 * ใช้ทั้งหน้ารวมท่าและการ์ดท่าที่แนะนำบนหน้าแรก · sub = แทนบรรทัดกลุ่มอาการ (เช่น ทำแล้ววันนี้)
 */
export function StretchCard({ groupId, width, sub, onPress }: { groupId: string; width: number; sub?: string; onPress: () => void }) {
  const { colors } = useTheme();
  const g = SYMPTOM_GROUPS.find((x) => x.id === groupId);
  if (!g) return null;
  const m = STRETCH_MOTION[g.stretch.name];
  const gif = stretchGif(m);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${g.stretch.name} ${g.short}`}
      onPress={onPress}
      style={({ pressed }) => ({ width, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.surface.default, borderWidth: 1, borderColor: colors.border.subtle, opacity: pressed ? 0.85 : 1 })}
    >
      <View style={{ height: width * 0.9, backgroundColor: colors.surface.sunken }}>
        {gif ? <LoadingImage source={gif} resizeMode="contain" silhouette={width * 0.55} style={{ width: '100%', height: '100%' }} /> : null}
        {m ? (
          <View style={{ position: 'absolute', left: space[2], top: space[2], flexDirection: 'row', alignItems: 'center', gap: 4, height: 22, paddingHorizontal: space[2], borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.9)' }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#D93A2B' }} />
            <Text style={{ fontFamily: fontFamily.semibold, fontSize: 11, lineHeight: 17 }}>{m.primary.label}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ padding: space[3], gap: 2 }}>
        <Text variant="labelLg" numberOfLines={1}>
          {g.stretch.name.replace(' 7 ท่า', '')}
        </Text>
        <Text variant="bodyXs" tone="secondary" numberOfLines={1}>
          {sub ?? g.short}
        </Text>
      </View>
    </Pressable>
  );
}
