import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { componentTokens, fontFamily, space } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { IconButton } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/**
 * AppBar — หัวหน้าแบบเดียวกับหลังบ้าน ThaiWellAI (WorkPage / BackLead)
 * [ปุ่มย้อนกลับกลมขาวมีเงา] + [eyebrow ตัวเล็กสีรอง · ชื่อหน้าตัวใหญ่หนา] · ขวา = ปุ่ม action กลม
 * eyebrow / subtitle ไม่แสดงแล้ว (รับไว้เพื่อไม่ต้องแก้ทุกหน้า) — หัวเหมือนกันทุกหน้า
 */
export function AppBar({
  title,
  subtitle,
  eyebrow,
  onBack,
  right,
}: {
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  /** (เดิม) หัวใหญ่ — ตอนนี้ทุกหน้าเป็นหัวใหญ่แล้ว */
  large?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + space[2], paddingBottom: space[3], paddingHorizontal: space[4], backgroundColor: colors.surface.canvas }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 48 }}>
        {onBack ? <RoundButton icon="chevron-left" label="ย้อนกลับ" onPress={onBack} /> : null}
        <View style={{ flex: 1, gap: 2 }}>
          {title ? (
            // 700 · 24 (หลังบ้าน .work__title 28 บนจอใหญ่ / 24 บนจอเล็ก) · lineHeight 1.5 เท่ากันสระไทยถูกตัด
            <Text numberOfLines={1} accessibilityRole="header" style={{ fontFamily: fontFamily.bold, fontSize: 24, lineHeight: 36, letterSpacing: -0.2, color: colors.text.primary }}>
              {title}
            </Text>
          ) : null}
          {/* หัวทุกหน้าเหมือนกัน: ปุ่มย้อนกลับ + ชื่อหน้าเท่านั้น (ไม่มีบรรทัดเล็กบน/ล่าง) — รายละเอียดอยู่ในเนื้อหา */}
        </View>
        {right ? <View style={{ flexDirection: 'row', gap: space[2] }}>{right}</View> : null}
      </View>
    </View>
  );
}

/** ปุ่มกลมขาวมีเงา (ย้อนกลับ / action บนหัวหน้า) — แบบ IconButton variant white ของหลังบ้าน */
export function RoundButton({ icon, label, onPress }: { icon: IconName; label: string; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface.default,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        shadowColor: '#0F172A',
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <Icon name={icon} size="md" color={colors.text.primary} />
    </Pressable>
  );
}

/** ListItem — แถวมาตรฐาน min 56pt, leading / content / trailing */
export function ListItem({
  title,
  subtitle,
  meta,
  leadingIcon,
  leading,
  trailing,
  onPress,
  chevron = !!onPress,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  leadingIcon?: IconName;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
}) {
  const { colors } = useTheme();
  const t = componentTokens.listItem;
  const content = (
    <>
      {leading ??
        (leadingIcon ? (
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface.sunken, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={leadingIcon} />
          </View>
        ) : null)}
      <View style={{ flex: 1, gap: space[0.5] }}>
        <Text variant="titleSm">{title}</Text>
        {subtitle ? (
          <Text variant="bodySm" tone="secondary">
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text variant="labelSm" tone="tertiary">
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing}
      {chevron ? <Icon name="chevron-right" color={colors.icon.secondary} /> : null}
    </>
  );
  const style = { minHeight: t.minHeight, paddingHorizontal: t.paddingX, paddingVertical: t.paddingY, flexDirection: 'row' as const, alignItems: 'center' as const, gap: t.gap };
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [style, { backgroundColor: pressed ? colors.surface.sunken : 'transparent' }]}>
      {content}
    </Pressable>
  ) : (
    <View style={style}>{content}</View>
  );
}
