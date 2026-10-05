import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Rect, Text as SvgText } from 'react-native-svg';
import { space } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { SegmentedControl } from './Inputs';
import { Text } from './Text';

/**
 * BodyMap — ระบุตำแหน่งอาการบนร่างกาย (หน้า/หลัง) + ระดับความรุนแรงเป็น heat
 * ใช้ภาพแทนคำ (Recognition over Recall) — ผู้รับบริการไม่ต้องรู้ชื่อกล้ามเนื้อ
 * ทีม UI สามารถเปลี่ยนเป็นภาพ illustration ได้ โดยใช้ region id เดิม
 */

export type BodyView = 'front' | 'back';
export type RegionId =
  | 'head'
  | 'neck'
  | 'shoulder_r'
  | 'shoulder_l'
  | 'chest'
  | 'abdomen'
  | 'upper_back'
  | 'lower_back'
  | 'arm_r'
  | 'arm_l'
  | 'hip'
  | 'thigh_r'
  | 'thigh_l'
  | 'knee_r'
  | 'knee_l'
  | 'calf_r'
  | 'calf_l';

export const regionLabel: Record<RegionId, string> = {
  head: 'ศีรษะ',
  neck: 'คอ',
  shoulder_r: 'บ่า/ไหล่ขวา',
  shoulder_l: 'บ่า/ไหล่ซ้าย',
  chest: 'หน้าอก',
  abdomen: 'ท้อง',
  upper_back: 'หลังส่วนบน',
  lower_back: 'หลังส่วนล่าง/เอว',
  arm_r: 'แขนขวา',
  arm_l: 'แขนซ้าย',
  hip: 'สะโพก',
  thigh_r: 'ต้นขาขวา',
  thigh_l: 'ต้นขาซ้าย',
  knee_r: 'เข่าขวา',
  knee_l: 'เข่าซ้าย',
  calf_r: 'น่องขวา',
  calf_l: 'น่องซ้าย',
};

type Shape = { id: RegionId; kind: 'rect' | 'ellipse' | 'circle'; x: number; y: number; w: number; h: number };

/** geometry ใน viewBox 200×400 — "ซ้ายจอ" = ฝั่งขวาของผู้รับบริการเมื่อมองด้านหน้า */
function shapes(view: BodyView): Shape[] {
  const L = view === 'front' ? 'r' : 'l'; // ฝั่งซ้ายของจอ
  const R = view === 'front' ? 'l' : 'r';
  return [
    { id: 'head', kind: 'circle', x: 100, y: 38, w: 24, h: 24 },
    { id: 'neck', kind: 'rect', x: 90, y: 62, w: 20, h: 16 },
    { id: `shoulder_${L}` as RegionId, kind: 'ellipse', x: 66, y: 88, w: 20, h: 12 },
    { id: `shoulder_${R}` as RegionId, kind: 'ellipse', x: 134, y: 88, w: 20, h: 12 },
    { id: view === 'front' ? 'chest' : 'upper_back', kind: 'rect', x: 72, y: 96, w: 56, h: 56 },
    { id: view === 'front' ? 'abdomen' : 'lower_back', kind: 'rect', x: 76, y: 154, w: 48, h: 44 },
    { id: `arm_${L}` as RegionId, kind: 'rect', x: 34, y: 100, w: 20, h: 118 },
    { id: `arm_${R}` as RegionId, kind: 'rect', x: 146, y: 100, w: 20, h: 118 },
    { id: 'hip', kind: 'rect', x: 72, y: 200, w: 56, h: 32 },
    { id: `thigh_${L}` as RegionId, kind: 'rect', x: 74, y: 234, w: 25, h: 64 },
    { id: `thigh_${R}` as RegionId, kind: 'rect', x: 101, y: 234, w: 25, h: 64 },
    { id: `knee_${L}` as RegionId, kind: 'circle', x: 86, y: 310, w: 11, h: 11 },
    { id: `knee_${R}` as RegionId, kind: 'circle', x: 114, y: 310, w: 11, h: 11 },
    { id: `calf_${L}` as RegionId, kind: 'rect', x: 76, y: 324, w: 21, h: 62 },
    { id: `calf_${R}` as RegionId, kind: 'rect', x: 103, y: 324, w: 21, h: 62 },
  ];
}

export function BodyMap({
  value,
  onPressRegion,
  selected,
  height = 380,
}: {
  /** ระดับอาการต่อ region (0–10) */
  value: Partial<Record<RegionId, number>>;
  onPressRegion?: (id: RegionId) => void;
  selected?: RegionId;
  height?: number;
}) {
  const { colors } = useTheme();
  const [view, setView] = React.useState<BodyView>('back');

  const fill = (id: RegionId) => {
    const v = value[id] ?? 0;
    if (v === 0) return colors.heat.none;
    if (v <= 3) return colors.heat.low;
    if (v <= 6) return colors.heat.mid;
    return colors.heat.high;
  };

  return (
    <View style={{ gap: space[3] }}>
      <SegmentedControl options={['ด้านหน้า', 'ด้านหลัง']} value={view === 'front' ? 'ด้านหน้า' : 'ด้านหลัง'} onChange={(v) => setView(v === 'ด้านหน้า' ? 'front' : 'back')} />
      <View style={{ alignItems: 'center' }}>
        <Svg width={(height * 200) / 400} height={height} viewBox="0 0 200 400">
          <SvgText x={16} y={20} fontSize={10} fill={colors.text.tertiary}>
            {view === 'front' ? 'ขวา' : 'ซ้าย'}
          </SvgText>
          <SvgText x={170} y={20} fontSize={10} fill={colors.text.tertiary}>
            {view === 'front' ? 'ซ้าย' : 'ขวา'}
          </SvgText>
          {shapes(view).map((s) => {
            const isSel = s.id === selected;
            const common = {
              fill: fill(s.id),
              stroke: isSel ? colors.border.focus : colors.border.default,
              strokeWidth: isSel ? 3 : 1.2,
              onPress: () => onPressRegion?.(s.id),
            };
            return (
              <G key={s.id + view}>
                {s.kind === 'circle' ? (
                  <Circle cx={s.x} cy={s.y} r={s.w} {...common} />
                ) : s.kind === 'ellipse' ? (
                  <Ellipse cx={s.x} cy={s.y} rx={s.w} ry={s.h} {...common} />
                ) : (
                  <Rect x={s.x} y={s.y} width={s.w} height={s.h} rx={8} {...common} />
                )}
              </G>
            );
          })}
        </Svg>
      </View>
      <HeatLegend />
    </View>
  );
}

export function HeatLegend() {
  const { colors } = useTheme();
  const items = [
    { c: colors.heat.none, l: 'ไม่มี' },
    { c: colors.heat.low, l: '1–3' },
    { c: colors.heat.mid, l: '4–6' },
    { c: colors.heat.high, l: '7–10' },
  ];
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space[4] }}>
      {items.map((i) => (
        <View key={i.l} style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
          <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: i.c, borderWidth: 1, borderColor: colors.border.default }} />
          <Text variant="labelSm" tone="secondary">
            {i.l}
          </Text>
        </View>
      ))}
    </View>
  );
}
