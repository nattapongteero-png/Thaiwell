import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { fontFamily, radius, space } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/**
 * ชุดการ์ดแบบหลังบ้าน ThaiWellAI (หน้าผู้มารับบริการ) — ใช้ทุกหน้าฝั่งผู้ใช้ให้หน้าบ้าน/หลังบ้านเป็นภาษาเดียวกัน
 * Panel    : การ์ดขาวขอบบาง มุม 20 · หัว = ไอคอนในกล่องสีอ่อน + หัวข้อหนา · ขวา = ชิป/ลิงก์
 *            ข้างในเป็นแถวที่มีไอคอนอยู่แล้ว (RowLink) → ไม่ใส่ไอคอนที่หัว (ไอคอนไม่ซ้อนสองชั้น)
 * StatTile : ช่องสรุปพื้นเทาอ่อน ไม่มีขอบ (ป้ายเล็ก · ค่าใหญ่หนา · หน่วย)
 * InfoRow  : ป้ายซ้าย · ค่าขวา
 * Tag      : ชิปแคปซูลเล็ก
 * RowLink  : แถวกดได้ในการ์ด (ไอคอนกล่องสี · ชื่อ · รายละเอียด · ›)
 */
export const TINT = { green: '#15803D', amber: '#C2782B', red: '#D9534F', violet: '#7C6CD4', blue: '#2F6FA3', slate: '#5F7F86' } as const;

export function Panel({
  icon,
  tint = TINT.green,
  title,
  right,
  children,
  flush,
  style,
}: {
  icon?: IconName;
  tint?: string;
  title?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
  /** เนื้อหาชิดขอบ (เช่น รายการแถว / ภาพ) */
  flush?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View style={[{ borderRadius: 20, backgroundColor: colors.surface.default, borderWidth: 1, borderColor: colors.border.subtle, overflow: 'hidden' }, style]}>
      {title ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], padding: space[4], paddingBottom: flush ? space[2] : 0 }}>
          {icon ? <IconBox icon={icon} tint={tint} /> : null}
          <Text variant="labelLg" style={{ flex: 1 }} accessibilityRole="header">
            {title}
          </Text>
          {right}
        </View>
      ) : null}
      {children ? <View style={flush ? null : { padding: space[4], paddingTop: title ? space[3] : space[4], gap: space[3] }}>{children}</View> : null}
    </View>
  );
}

export function IconBox({ icon, tint = TINT.green, size = 30 }: { icon: IconName; tint?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, alignItems: 'center', justifyContent: 'center', backgroundColor: `${tint}1F` }}>
      <Icon name={icon} size={size > 34 ? 'sm' : 'xs'} color={tint} />
    </View>
  );
}

export function StatTile({ label, value, unit, color, small, style }: { label: string; value: string; unit?: string; color?: string; small?: boolean; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[{ flex: 1, padding: space[3], borderRadius: 16, backgroundColor: colors.surface.sunken, gap: 2 }, style]}>
      <Text variant="bodyXs" tone="secondary" numberOfLines={1}>
        {label}
      </Text>
      <Text numberOfLines={1} style={{ fontFamily: fontFamily.bold, fontSize: small ? 18 : 24, lineHeight: small ? 28 : 34, color: color ?? colors.text.primary }}>
        {value}
      </Text>
      {unit ? (
        <Text variant="bodyXs" tone="tertiary" numberOfLines={1}>
          {unit}
        </Text>
      ) : null}
    </View>
  );
}

export function InfoRow({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space[3] }}>
      <Text variant="bodySm" tone="secondary">
        {k}
      </Text>
      <Text variant="labelMd" color={color} style={{ flexShrink: 1, textAlign: 'right' }}>
        {v}
      </Text>
    </View>
  );
}

/** size md = สูง 30 เท่า ElementPill (วางคู่กันในแถวเดียว) */
export function Tag({ text, tone, size }: { text: string; tone?: 'good' | 'warn' | 'bad'; size?: 'md' }) {
  const { colors } = useTheme();
  const c = tone === 'good' ? [colors.brand.subtle, colors.brand.primary] : tone === 'warn' ? ['#FBEFD5', '#9A6A10'] : tone === 'bad' ? [colors.status.danger.bg, colors.status.danger.fg] : [colors.surface.sunken, colors.text.secondary];
  return (
    <View style={{ paddingHorizontal: size === 'md' ? space[3] : space[2] + 2, height: size === 'md' ? 30 : 26, justifyContent: 'center', borderRadius: radius.full, backgroundColor: c[0] }}>
      <Text variant="labelSm" color={c[1]}>
        {text}
      </Text>
    </View>
  );
}

export function RowLink({
  icon,
  tint = TINT.green,
  title,
  sub,
  right,
  onPress,
  last,
  danger,
}: {
  icon: IconName;
  tint?: string;
  title: string;
  sub?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
  danger?: boolean;
}) {
  const { colors } = useTheme();
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], marginHorizontal: space[4], borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border.subtle }}>
      <IconBox icon={icon} tint={danger ? TINT.red : tint} size={36} />
      <View style={{ flex: 1 }}>
        <Text variant="labelMd" color={danger ? colors.status.danger.fg : undefined}>
          {title}
        </Text>
        {sub ? (
          <Text variant="bodyXs" tone="secondary" numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-right" size="sm" color={colors.text.tertiary} /> : null)}
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => ({ backgroundColor: pressed ? colors.surface.sunken : 'transparent' })}>
      {body}
    </Pressable>
  ) : (
    body
  );
}
