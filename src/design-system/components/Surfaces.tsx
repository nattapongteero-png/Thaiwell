import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { componentTokens, elevation, radius, space, type ElevationLevel } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  elevation?: ElevationLevel;
  variant?: 'elevated' | 'outlined' | 'filled';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** Card — Law of Common Region: จัดกลุ่มข้อมูลที่เกี่ยวข้องไว้ในกรอบเดียวกัน */
export function Card({ children, onPress, elevation: lvl = 1, variant = 'outlined', style, accessibilityLabel }: CardProps) {
  const { colors } = useTheme();
  const base: ViewStyle = {
    borderRadius: componentTokens.card.radius,
    padding: componentTokens.card.padding,
    gap: componentTokens.card.gap,
    backgroundColor: variant === 'filled' ? colors.surface.sunken : colors.surface.raised,
    borderWidth: variant === 'outlined' ? 1 : 0,
    borderColor: colors.border.subtle,
    ...(variant === 'elevated' ? elevation[lvl] : null),
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [base, { opacity: pressed ? 0.9 : 1 }, style]}
    >
      {children}
    </Pressable>
  );
}

export function Divider({ inset = 0, vertical }: { inset?: number; vertical?: boolean }) {
  const { colors } = useTheme();
  return vertical ? (
    <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: colors.border.subtle }} />
  ) : (
    <View style={{ height: 1, marginLeft: inset, backgroundColor: colors.border.subtle }} />
  );
}

/** SectionHeader — หัวข้อ section + action ขวา (Serial Position: สิ่งสำคัญอยู่ต้น section) */
export function SectionHeader({
  title,
  subtitle,
  action,
  onAction,
  overline,
}: {
  title: string;
  subtitle?: string;
  overline?: string;
  action?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[2] }}>
      <View style={{ flex: 1, gap: space[0.5] }}>
        {overline ? (
          <Text variant="overline" tone="tertiary">
            {overline.toUpperCase()}
          </Text>
        ) : null}
        <Text variant="titleLg" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySm" tone="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={12}>
          <Text variant="labelMd" color={colors.text.link}>
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Placeholder — กล่องกากบาทแบบ wireframe แทนรูป/วิดีโอ/แผนที่ */
export function Placeholder({ height = 160, label, icon }: { height?: number; label?: string; icon?: IconName }) {
  const { colors } = useTheme();
  const [w, setW] = React.useState(0);
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ height, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.wire.placeholder, justifyContent: 'center', alignItems: 'center' }}
    >
      {w > 0 ? (
        <Svg width={w} height={height} style={{ position: 'absolute' }}>
          <Rect x={0.5} y={0.5} width={w - 1} height={height - 1} rx={radius.md} fill="none" stroke={colors.wire.placeholderStroke} />
          <Line x1={0} y1={0} x2={w} y2={height} stroke={colors.wire.placeholderStroke} />
          <Line x1={w} y1={0} x2={0} y2={height} stroke={colors.wire.placeholderStroke} />
        </Svg>
      ) : null}
      <View style={{ alignItems: 'center', gap: space[1], backgroundColor: colors.wire.placeholder, padding: space[2], borderRadius: radius.sm }}>
        {icon ? <Icon name={icon} color={colors.text.tertiary} /> : null}
        {label ? (
          <Text variant="labelSm" tone="tertiary">
            {label}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function Avatar({ initials, size = 40 }: { initials: string; size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.brand.subtle,
        borderWidth: 1,
        borderColor: colors.border.default,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant={size > 44 ? 'titleMd' : 'labelMd'} color={colors.brand.onSubtle}>
        {initials}
      </Text>
    </View>
  );
}

/** KeyValue — แถวข้อมูล label : value (ใช้ใน summary) */
export function KeyValue({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'flex-start' }}>
      <Text variant="bodySm" tone="secondary" style={{ width: 112 }}>
        {label}
      </Text>
      <Text variant={emphasis ? 'titleSm' : 'bodyMd'} style={{ flex: 1 }}>
        {value}
      </Text>
    </View>
  );
}
