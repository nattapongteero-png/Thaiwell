import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { componentTokens, space } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { VoiceRibbon } from './VoiceRibbon';

/**
 * แถบเสียงแทนช่องพิมพ์ในแชท — ริบบิ้นบอกระดับเสียง + สถานะ + ปุ่ม (พิมพ์ · ไมค์ · เสียงคำตอบ)
 * คำตอบยังขึ้นในแชทเป็นการ์ด/ข้อความแบบเดิม แถบนี้แค่ฟังและพูด
 */
export type VoiceDockMode = 'listening' | 'busy' | 'speaking' | 'paused' | 'error';

export function VoiceDock({
  mode,
  status,
  level,
  muted,
  onMain,
  onKeyboard,
  onMute,
}: {
  mode: VoiceDockMode;
  status: string;
  /** ระดับเสียง 0–1 */
  level: number;
  muted: boolean;
  onMain: () => void;
  onKeyboard: () => void;
  onMute: () => void;
}) {
  const { colors } = useTheme();
  const busy = mode === 'busy';
  const main: { icon: IconName; label: string } =
    mode === 'listening' ? { icon: 'arrow-up', label: 'ส่งที่พูด' } : mode === 'speaking' ? { icon: 'mic', label: 'ขัดแล้วพูด' } : { icon: 'mic', label: 'พูด' };
  return (
    <View
      style={{
        borderRadius: 32,
        backgroundColor: colors.glass.strong,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        paddingTop: space[1],
        paddingBottom: space[2],
        paddingHorizontal: space[2],
        shadowColor: '#0F172A',
        shadowOpacity: 0.1,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 4,
      }}
    >
      {/* แตะริบบิ้น = ปุ่มหลัก (ส่งที่พูด / ขัดแล้วพูด) */}
      <Pressable accessibilityRole="button" accessibilityLabel={main.label} disabled={busy} onPress={onMain}>
        <VoiceRibbon level={level} style={{ height: 64 }} />
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <Round icon="type" label="พิมพ์แทน" onPress={onKeyboard} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 20 }}>
          {busy ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <ActivityIndicator size="small" color={colors.text.tertiary} />
              <Text variant="labelMd" tone="tertiary" numberOfLines={1}>
                {status}
              </Text>
            </View>
          ) : (
            <Text variant="labelMd" numberOfLines={1} color={mode === 'error' ? colors.status.danger.fg : mode === 'listening' ? colors.text.primary : colors.text.tertiary}>
              {status}
            </Text>
          )}
        </View>
        <Round icon={muted ? 'volume-x' : 'volume-2'} label={muted ? 'เปิดเสียงคำตอบ' : 'ปิดเสียงคำตอบ'} onPress={onMute} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={main.label}
          disabled={busy}
          onPress={onMain}
          style={({ pressed }) => ({
            width: componentTokens.orb.md,
            height: componentTokens.orb.md,
            borderRadius: componentTokens.orb.md / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.text.primary,
            opacity: busy ? 0.35 : pressed ? 0.85 : 1,
          })}
        >
          <Icon name={main.icon} size="md" color={colors.text.inverse} />
        </Pressable>
      </View>
    </View>
  );
}

function Round({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  const d = componentTokens.orb.md;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({ width: d, height: d, borderRadius: d / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.surface.sunken : colors.surface.default, borderWidth: 1, borderColor: colors.border.subtle })}
    >
      <Icon name={icon} size="md" color={colors.text.primary} />
    </Pressable>
  );
}
