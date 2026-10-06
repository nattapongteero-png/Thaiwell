/**
 * GRID, LAYOUT, SIZING & ELEVATION TOKENS
 * ------------------------------------------------------------------
 * Responsive column grid (อิง Material Design layout grid):
 *
 *   breakpoint   width      columns  margin  gutter   ใช้กับ
 *   compact      < 600      4        16      16       มือถือ (ผู้รับบริการ)
 *   medium       600–1023   8        24      24       Tablet (ผู้ให้บริการข้างเตียงนวด)
 *   expanded     ≥ 1024     12       32      24       KIOSK / Web Dashboard
 *
 * ทุกระยะเป็นทวีคูณของ 4pt (spacing scale) เพื่อให้ Figma ↔ Code ตรงกัน
 */
import { space } from './primitives';

export const breakpoints = { compact: 0, medium: 600, expanded: 1024 } as const;
export type Breakpoint = keyof typeof breakpoints;

export const grid: Record<Breakpoint, { columns: number; margin: number; gutter: number; maxContentWidth: number }> = {
  compact: { columns: 4, margin: space[4], gutter: space[4], maxContentWidth: 600 },
  medium: { columns: 8, margin: space[6], gutter: space[6], maxContentWidth: 840 },
  expanded: { columns: 12, margin: space[8], gutter: space[6], maxContentWidth: 1200 },
};

/**
 * Sizing — Fitts's Law
 * min touch target 48dp (Material) / 44pt (Apple HIG) → ใช้ 48 เป็นมาตรฐานของระบบ
 * ปุ่มหลักสูง 56 เพื่อกดง่ายด้วยนิ้วโป้ง (thumb zone)
 */
export const sizing = {
  touchTargetMin: 48,
  control: { sm: 36, md: 48, lg: 56 },
  icon: { xxs: 12, xs: 14, sm: 16, md: 20, lg: 24, xl: 32 },
  avatar: { sm: 32, md: 40, lg: 56 },
  appBar: 56,
  tabBar: 64,
} as const;

/** Elevation 0–3 (shadow สำหรับ iOS + elevation สำหรับ Android) */
export const elevation = {
  0: { shadowColor: '#000', shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
  1: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  2: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  3: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
} as const;
export type ElevationLevel = keyof typeof elevation;
