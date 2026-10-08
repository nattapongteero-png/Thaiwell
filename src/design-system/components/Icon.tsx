import React from 'react';
import { Feather } from '@expo/vector-icons';
import { SvgXml } from 'react-native-svg';
import { LINE_ICONS } from './lineIcons';
import { sizing } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';

/**
 * ไอคอนหลัก = Material Line Icons (line-md · Iconify) ภาพนิ่ง · ชื่อเดิมของ Feather (ไม่ต้องแก้ที่ใช้)
 * ชื่อที่ line-md ไม่มี → Feather (เส้น 2px เหมือนกัน)
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
  const svg = LINE_ICONS[name];
  if (svg) return <SvgXml xml={svg} width={px} height={px} color={c} />;
  return <Feather name={name} size={px} color={c} />;
}
