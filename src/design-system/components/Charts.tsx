import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { radius, space } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { Text } from './Text';

/**
 * CHARTS — เรียบง่าย อ่านได้ใน 3 วินาที
 * ใช้ตำแหน่ง/ความยาว (ไม่ใช่สีอย่างเดียว) + ตัวเลขกำกับเสมอ
 */

export interface MetricPair {
  label: string;
  before: number;
  after: number;
  max?: number;
  /** true = ค่ายิ่งน้อยยิ่งดี (เช่น ความปวด) */
  lowerIsBetter?: boolean;
}

/** StatDelta — ตัวเลขใหญ่ + การเปลี่ยนแปลง (Peak-End Rule: ให้ผู้ใช้เห็น "ผลลัพธ์" ชัด ๆ ตอนจบ) */
export function StatDelta({ label, before, after, lowerIsBetter = true, unit = '' }: { label: string; before: number; after: number; lowerIsBetter?: boolean; unit?: string }) {
  const { colors } = useTheme();
  const diff = after - before;
  const improved = lowerIsBetter ? diff < 0 : diff > 0;
  const c = diff === 0 ? colors.text.secondary : improved ? colors.status.success.fg : colors.status.danger.fg;
  return (
    <View style={{ gap: space[1] }}>
      <Text variant="labelMd" tone="secondary">
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[2] }}>
        <Text variant="bodyMd" tone="tertiary" style={{ textDecorationLine: 'line-through' }}>
          {before}
          {unit}
        </Text>
        <Icon name="arrow-right" size="sm" color={colors.icon.secondary} />
        <Text variant="displayMd">
          {after}
          {unit}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
        <Icon name={diff === 0 ? 'minus' : improved ? 'trending-down' : 'trending-up'} size="sm" color={c} />
        <Text variant="labelMd" color={c}>
          {diff > 0 ? '+' : ''}
          {diff} {diff === 0 ? 'คงที่' : improved ? 'ดีขึ้น' : 'แย่ลง'}
        </Text>
      </View>
    </View>
  );
}

/** BeforeAfterBars — เทียบหลายมิติ ก่อน/หลัง ในแถวเดียว (Law of Similarity: ก่อน = โทนอ่อน, หลัง = โทนเข้ม) */
export function BeforeAfterBars({ data }: { data: MetricPair[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space[4] }}>
      <View style={{ flexDirection: 'row', gap: space[4] }}>
        <LegendDot color={colors.chart.before} label="ก่อนนวด" />
        <LegendDot color={colors.chart.after} label="หลังนวด" />
      </View>
      {data.map((d) => {
        const max = d.max ?? 10;
        return (
          <View key={d.label} style={{ gap: space[1] }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="labelMd">{d.label}</Text>
              <Text variant="labelMd" tone="secondary">
                {d.before} → {d.after}
              </Text>
            </View>
            {[d.before, d.after].map((v, i) => (
              <View key={i} style={{ height: 10, borderRadius: radius.full, backgroundColor: colors.surface.sunken, overflow: 'hidden' }}>
                <View style={{ width: `${(v / max) * 100}%`, height: '100%', borderRadius: radius.full, backgroundColor: i === 0 ? colors.chart.before : colors.chart.after }} />
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text variant="labelSm" tone="secondary">
        {label}
      </Text>
    </View>
  );
}

/** TrendLine — แนวโน้มข้ามครั้ง (Longitudinal outcome) */
export function TrendLine({ points, labels, max = 10, height = 140 }: { points: number[]; labels: string[]; max?: number; height?: number }) {
  const { colors } = useTheme();
  const [w, setW] = React.useState(0);
  const padX = 20;
  const padY = 16;
  const innerW = Math.max(0, w - padX * 2);
  const innerH = height - padY * 2 - 16;
  const xy = points.map((p, i) => ({
    x: padX + (points.length === 1 ? innerW / 2 : (innerW * i) / (points.length - 1)),
    y: padY + innerH - (p / max) * innerH,
  }));
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height }}>
      {w > 0 ? (
        <Svg width={w} height={height}>
          {[0, 0.5, 1].map((g) => (
            <Line key={g} x1={padX} x2={w - padX} y1={padY + innerH * g} y2={padY + innerH * g} stroke={colors.chart.grid} strokeDasharray="4 4" />
          ))}
          <Polyline points={xy.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={colors.chart.trend} strokeWidth={2.5} />
          {xy.map((p, i) => (
            <React.Fragment key={i}>
              <Circle cx={p.x} cy={p.y} r={5} fill={colors.surface.default} stroke={colors.chart.trend} strokeWidth={2} />
              <SvgText x={p.x} y={p.y - 10} fontSize={11} fill={colors.text.primary} textAnchor="middle">
                {points[i]}
              </SvgText>
              <SvgText x={p.x} y={height - 4} fontSize={10} fill={colors.text.tertiary} textAnchor="middle">
                {labels[i]}
              </SvgText>
            </React.Fragment>
          ))}
        </Svg>
      ) : null}
    </View>
  );
}
