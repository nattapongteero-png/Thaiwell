import React from 'react';
import { Feather } from '@expo/vector-icons';
import { sizing } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';

/** ใช้ Feather (line icon 2px) — เหมาะกับ wireframe และเปลี่ยนเป็น icon set ของแบรนด์ได้ที่ไฟล์นี้ไฟล์เดียว */
export type IconName = React.ComponentProps<typeof Feather>['name'];

export function Icon({
  name,
  size = 'md',
  color,
}: {
  name: IconName;
  size?: keyof typeof sizing.icon;
  color?: string;
}) {
  const { colors } = useTheme();
  return <Feather name={name} size={sizing.icon[size]} color={color ?? colors.icon.primary} />;
}
