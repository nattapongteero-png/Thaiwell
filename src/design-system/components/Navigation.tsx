import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { componentTokens, space } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { IconButton } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/** AppBar — รูปแบบเดียวกับ iOS/Android (Jakob's Law): ย้อนกลับซ้าย · ชื่อหน้า · action ขวา */
export function AppBar({
  title,
  subtitle,
  onBack,
  right,
  large,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  large?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: colors.surface.default,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
      }}
    >
      <View style={{ minHeight: componentTokens.appBar.height, flexDirection: 'row', alignItems: 'center', paddingHorizontal: componentTokens.appBar.paddingX }}>
        {onBack ? <IconButton icon="chevron-left" label="ย้อนกลับ" onPress={onBack} /> : <View style={{ width: space[2] }} />}
        <View style={{ flex: 1, paddingHorizontal: space[1] }}>
          {!large ? (
            <>
              <Text variant="titleMd" numberOfLines={1} accessibilityRole="header">
                {title}
              </Text>
              {subtitle ? (
                <Text variant="labelSm" tone="secondary" numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row' }}>{right}</View>
      </View>
      {large ? (
        <View style={{ paddingHorizontal: space[4], paddingBottom: space[3] }}>
          <Text variant="headlineMd" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="bodySm" tone="secondary">
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
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
