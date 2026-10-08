import React from 'react';
import { Feather } from '@expo/vector-icons';
import { SvgXml } from 'react-native-svg';
import { LUCIDE_ICONS } from './lucideIcons';
import { sizing } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';

/**
 * ไอคอนหลัก = ชุด Lucide (ภาพนิ่ง · ชุดเดียวกับแท็บเมนู) · ใช้ชื่อเดิมของ Feather (ไม่ต้องแก้ที่ใช้)
 * ชื่อที่ไม่มี → Feather
 */
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
  const px = sizing.icon[size];
  const c = color ?? colors.icon.primary;
  // ภาพนิ่ง (animation เล่นเฉพาะไอคอนแท็บเมนูตอนกดเปลี่ยนแท็บ)
  const svg = LUCIDE_ICONS[name];
  if (svg) return <SvgXml xml={svg} width={px} height={px} color={c} />;
  return <Feather name={name} size={px} color={c} />;
}
