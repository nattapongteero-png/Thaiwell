import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { AreaChart, type LineChartRenderer } from 'react-native-chart-kit/v2';
import { fontFamily, palette } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';

export interface PainPoint {
  label: string;
  before: number;
  after: number;
}

/**
 * PainAreaChart — แนวโน้ม Pain Score ข้ามครั้ง (ก่อนนวด vs หลังนวด)
 * ใช้ AreaChart ของ ChartKit (react-native-chart-kit/v2, MIT, วาดด้วย react-native-svg)
 * สี/ฟอนต์มาจาก design token: ก่อนนวด = chart.before (เทา), หลังนวด = brand.primary (teal) พื้นไล่สี
 * แตะ/ลากบนกราฟเพื่อดูค่าแต่ละครั้ง (crosshair + tooltip)
 */
export function PainAreaChart({ data, height = 260 }: { data: PainPoint[]; height?: number }) {
  const { colors } = useTheme();
  const [width, setWidth] = React.useState(0);
  return (
    <View onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))} style={{ height }}>
      {width > 0 ? (
        <AreaChart
          data={data as unknown as Record<string, unknown>[]}
          xKey="label"
          width={width}
          height={height}
          curve="monotone"
          yDomain={[0, 10]}
          series={[
            {
              yKey: 'before',
              label: 'ก่อนนวด',
              color: colors.chart.before,
              strokeWidth: 2,
              strokeDasharray: [5, 4],
              areaFill: { fromColor: colors.chart.before, toColor: colors.chart.before, fromOpacity: 0.25, toOpacity: 0 },
            },
            {
              yKey: 'after',
              label: 'หลังนวด',
              color: colors.brand.primary,
              strokeWidth: 3,
              areaFill: { fromColor: colors.brand.primary, toColor: colors.brand.primary, fromOpacity: 0.35, toOpacity: 0 },
            },
          ]}
          interaction={{ mode: 'scrub', selectionPersistence: 'persist', deselectOnOutsidePress: false }}
          defaultSelectedIndex={data.length - 1}
          dots={{ visible: true, radius: 4, fill: colors.surface.default, strokeWidth: 2 }}
          activeDot={{ radius: 6, strokeWidth: 3 }}
          crosshair={{ color: colors.border.strong, strokeWidth: 1, strokeDasharray: [4, 4], opacity: 0.6 }}
          tooltip={{ shared: true, anchor: 'point', placement: 'above', offset: 12, borderRadius: 12, backgroundColor: colors.surface.default, borderColor: colors.border.subtle, textColor: colors.text.primary, labelColor: colors.text.secondary }}
          legend={{ position: 'bottom', align: 'center' }}
          showVerticalGridLines={false}
          formatYLabel={(v) => `${Math.round(v)}`}
          theme={{
            background: 'transparent',
            plotBackground: 'transparent',
            grid: colors.chart.grid,
            axis: colors.border.subtle,
            text: colors.text.secondary,
            mutedText: colors.text.tertiary,
            typography: { fontFamily: fontFamily.regular, axisLabelSize: 11, legendLabelSize: 12 },
          }}
          accessibilityLabel="กราฟคะแนนปวดก่อนและหลังนวดในแต่ละครั้ง"
        />
      ) : null}
    </View>
  );
}

/** padding ภายในที่ ChartKit v2 ตั้งตายตัว (useChartModel: base top 16, right 18, bottom 12, left 10) */
const CHARTKIT_PAD = { top: 16, right: 18, bottom: 12, left: 10 };

/**
 * Renderer ของ ChartKit ที่แทน gradient ด้วย "สีระดับความปวด" (สีเดียวกับแถบ Pain Score ใน Figma)
 * - ไล่แนวทแยงจากมุมล่างซ้าย → มุมบนขวา: เขียว (เบา) → เหลือง → แดง (หนัก)
 *   ล่าง = ค่าต่ำเป็นเขียว · บน = ค่าสูงเป็นแดง · ซ้ายเริ่มเขียว ขวาไปทางแดง (เหมือนแถบ slider)
 * - ใช้ทั้งพื้น (area) และเส้น (stroke ผ่าน url(#strokeId)) · พิกัดเป็น userSpaceOnUse ตามกรอบ plot
 */
function createPainRenderer(plot: { left: number; right: number; top: number; bottom: number }, strokeId: string): LineChartRenderer {
  const stops = (opacity: [number, number, number]) => [
    <Stop key="l" offset="0" stopColor={palette.pain.low} stopOpacity={opacity[0]} />,
    <Stop key="m" offset="0.5" stopColor={palette.pain.mid} stopOpacity={opacity[1]} />,
    <Stop key="h" offset="1" stopColor={palette.pain.high} stopOpacity={opacity[2]} />,
  ];
  // ให้แถบสีขนานกับเส้นทแยง (บนซ้าย–ล่างขวา) ของกรอบ: เวกเตอร์ตั้งฉาก (h, -w) จากมุมล่างซ้าย
  // → ล่างซ้าย = 0 (เขียว) · บนซ้าย/ล่างขวา = 0.5 (เหลือง) · บนขวา = 1 (แดง) ไม่ว่ากรอบจะกว้างแค่ไหน
  const w = plot.right - plot.left;
  const h = plot.bottom - plot.top;
  const k = (2 * w * h) / (w * w + h * h || 1);
  const coords = { x1: plot.left, y1: plot.bottom, x2: plot.left + h * k, y2: plot.bottom - w * k };
  const PainGradient = ({ id }: { id: string }) => (
    <>
      <LinearGradient id={id} gradientUnits="userSpaceOnUse" {...coords}>
        {stops([0.22, 0.3, 0.4])}
      </LinearGradient>
      <LinearGradient id={strokeId} gradientUnits="userSpaceOnUse" {...coords}>
        {stops([1, 1, 1])}
      </LinearGradient>
    </>
  );
  return {
    Surface: ({ children, width, height, ...props }: { children: React.ReactNode; width: number; height: number }) => (
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} {...props}>
        {children}
      </Svg>
    ),
    Group: G,
    Layer: ({ children, name: _name, ...props }: { children: React.ReactNode; name?: string }) => <G {...props}>{children}</G>,
    Defs: ({ children }: { children: React.ReactNode }) => <Defs>{children}</Defs>,
    LinearGradient: PainGradient,
    Path,
    Rect,
    Circle,
    Line,
    Text: SvgText,
    capabilities: { clipPaths: false, gradients: true, pathGradients: false, rectClips: false, text: true },
    name: 'svg-pain',
  };
}

/**
 * PainSparkArea — Area chart ขนาดเล็กในการ์ด Pain Score (ไม่มีแกน/legend)
 * สีไล่ทแยง ล่างซ้าย = เขียว (เบา) → บนขวา = แดง (หนัก) · วาดเต็มขอบการ์ด (full-bleed) · ลากเพื่อดูแต่ละครั้ง
 */
export function PainSparkArea({ values, labels, height = 80 }: { values: number[]; labels: string[]; height?: number }) {
  const { colors } = useTheme();
  const [width, setWidth] = React.useState(0);
  const data = values.map((v, i) => ({ label: labels[i] ?? `${i + 1}`, pain: v }));
  const P = CHARTKIT_PAD;
  const strokeId = React.useId().replace(/[^a-zA-Z0-9]/g, '') + 'painStroke';
  // plot ของ ChartKit เริ่มที่ padding บน และสูงเท่ากรอบ (label แกนถูกซ่อน)
  // plot ของ ChartKit เริ่มที่ padding ซ้าย/บน และมีขนาดเท่ากรอบ (label แกนถูกซ่อน) → y บน = 10, y ล่าง = 0
  const renderer = React.useMemo(
    () => createPainRenderer({ left: P.left, right: P.left + width, top: P.top, bottom: P.top + height }, strokeId),
    [width, height, strokeId, P.left, P.top],
  );
  return (
    <View onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))} style={{ height, overflow: 'hidden' }}>
      {width > 0 ? (
        <View style={{ marginLeft: -P.left, marginTop: -P.top }}>
          <AreaChart
            data={data}
            xKey="label"
            yKey="pain"
            width={width + P.left + P.right}
            height={height + P.top + P.bottom}
            curve="monotone"
            yDomain={[0, 10]}
            series={[
              {
                yKey: 'pain',
                label: 'Pain Score',
                color: `url(#${strokeId})`,
                strokeWidth: 2.5,
              },
            ]}
            renderer={renderer}
            dots={false}
            interaction={{ mode: 'scrub', selectionPersistence: 'whileActive' }}
            activeDot={{ radius: 5, strokeWidth: 3, fill: colors.surface.default, stroke: colors.text.primary }}
            crosshair={false}
            tooltip={false}
            legend={false}
            showHorizontalGridLines={false}
            showVerticalGridLines={false}
            labelStrategy="hide"
            yAxisLabelWidth={0}
            formatYLabel={() => ''}
            theme={{ background: 'transparent', plotBackground: 'transparent', grid: 'transparent', axis: 'transparent', text: 'transparent', mutedText: 'transparent' }}
            accessibilityLabel={`แนวโน้มคะแนนปวด ${values.join(', ')}`}
          />
        </View>
      ) : null}
    </View>
  );
}

/**
 * PainScaleArea — สเกลความปวด 0–10 แบบ area chart (แทนแถบเลื่อนในการ์ด Pain Score ของ Figma)
 * - พื้นไล่สูงจากซ้าย (0 เบา · เขียว) ไปขวา (10 หนัก · แดง) — แดงอยู่สูงกว่าเขียวเสมอ
 * - จุดบนเส้น = คะแนนปัจจุบัน · ลากบนกราฟเพื่อเลือกคะแนน
 * - วาดเต็มขอบการ์ด (full-bleed)
 */
/** สีตามระดับปวด (เขียว → เหลือง → แดง) — สีเดียวกับจุดบนกราฟ ใช้กับ pill ก่อน/หลังด้วย */
export function painColor(v: number, max = 10) {
  const t = v / max;
  const mix = (a: string, b: string, k: number) => {
    const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
    const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return `rgb(${pa.map((c, i) => Math.round(c + (pb[i] - c) * k)).join(',')})`;
  };
  return t < 0.5 ? mix(palette.pain.low, palette.pain.mid, t / 0.5) : mix(palette.pain.mid, palette.pain.high, (t - 0.5) / 0.5);
}
/** สีระดับปวดแบบโปร่ง (พื้น pill) */
export const painTint = (v: number, alpha: number, max = 10) => painColor(v, max).replace('rgb(', 'rgba(').replace(')', `,${alpha})`);

/** ชั้นทับกราฟสเกล: ช่วงที่คะแนนเปลี่ยน (แรเงาใต้เส้น) + จุดก่อนรักษา (โปร่ง · ป้ายอยู่ที่ pill "ก่อนรักษา" ในการ์ด) */
function BeforeAfterOverlay({
  before,
  after,
  max,
  width,
  height,
  pointX,
  pointY,
}: {
  before: number;
  after: number;
  max: number;
  width: number;
  height: number;
  pointX: (i: number) => number;
  pointY: (i: number) => number;
}) {
  const { colors } = useTheme();
  const better = after < before;
  const tone = better ? colors.status.success.fg : colors.status.danger.fg;
  // เส้นของกราฟผ่านจุดคะแนนจำนวนเต็ม → สุ่มจุดย่อยตามเส้นเดียวกันแล้วปิดลงขอบล่าง
  const lo = Math.min(before, after);
  const hi = Math.max(before, after);
  const steps = Math.max(1, Math.round((hi - lo) * 8));
  const pts = Array.from({ length: steps + 1 }, (_, k) => lo + ((hi - lo) * k) / steps).map((t) => `${pointX(t).toFixed(1)},${pointY(t).toFixed(1)}`);
  const band = hi > lo ? `M${pointX(lo).toFixed(1)},${height} L${pts.join(' L')} L${pointX(hi).toFixed(1)},${height} Z` : '';
  const r = 6;
  const bx = pointX(before);
  const by = pointY(before);
  // จุดหลังนวด: แบบเดียวกับ activeDot ของกราฟ (ทึบ ขอบขาว) วาดเป็นชั้นบนสุด
  const ar = 7;
  const ax = pointX(after);
  const ay = pointY(after);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height }}>
      {band ? (
        <Svg width={width} height={height} style={{ position: 'absolute' }}>
          <Path d={band} fill={tone} fillOpacity={0.18} />
          <Path d={`M${pts.join(' L')}`} stroke={tone} strokeWidth={4} strokeOpacity={0.55} strokeLinecap="round" fill="none" />
        </Svg>
      ) : null}
      {before !== after ? (
        <>
          <View
            style={{
              position: 'absolute',
              left: bx - r,
              top: by - r,
              width: r * 2,
              height: r * 2,
              borderRadius: r,
              backgroundColor: colors.surface.default,
              borderWidth: 2,
              borderColor: painColor(before, max),
            }}
          />
        </>
      ) : null}
      <View
        style={{
          position: 'absolute',
          left: ax - ar,
          top: ay - ar,
          width: ar * 2,
          height: ar * 2,
          borderRadius: ar,
          backgroundColor: painColor(after, max),
          borderWidth: 3,
          borderColor: colors.surface.default,
        }}
      />
    </View>
  );
}

/**
 * PainScaleArea — สเกลความปวด 0–max เป็น area chart ชิดขอบ
 * - onChange: ลาก (scrub) เพื่อเลือก
 * - onPick: แสดงจุดของแต่ละคะแนนบนเส้นกราฟ → แตะครั้งเดียวเลือกเลย (คอลัมน์รอบจุดเป็นพื้นที่แตะทั้งแนวตั้ง)
 * ปลายทั้งสองข้างต่อเส้นออกไปถึงขอบ (จุดหลอก) เพื่อให้จุด 0 และ max ไม่ถูกตัดครึ่งที่ขอบการ์ด
 */
export function PainScaleArea({
  value,
  onChange,
  onPick,
  max = 10,
  height = 80,
  before,
}: {
  value: number;
  /** คะแนนก่อนรักษา → จุดโปร่งบนเส้น + แรเงาช่วงระหว่างก่อน–หลัง (เขียว = ดีขึ้น · แดง = แย่ลง) */
  before?: number;
  onChange?: (v: number) => void;
  onPick?: (v: number) => void;
  max?: number;
  height?: number;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = React.useState(0);
  // เส้นโค้งขึ้นแบบนุ่ม: ฝั่งเขียวเริ่มที่ ~30% ของความสูง แล้วไต่ขึ้นถึงบนสุดที่ฝั่งแดง
  const base = max * 0.3;
  const level = (i: number) => base + Math.pow(Math.max(0, Math.min(1, i / max)), 1.3) * (max - base);
  // เผื่อด้านบนให้จุดคะแนนสูงสุด + ตัวเลขไม่ชนขอบ
  // เผื่อด้านบน: จุดคะแนนสูงสุดไม่ชนขอบ และกราฟอยู่ต่ำลงในการ์ด
  const top = onPick ? max * 1.35 : max * 1.3;
  const data = React.useMemo(
    () =>
      // จุดหลอกหัว/ท้าย: ต่อเส้นออกไปถึงขอบ → จุดคะแนน 0 และ max ไม่ถูกตัดครึ่งที่ขอบการ์ด
      [{ score: 'L', level: base * 0.85 }, ...Array.from({ length: max + 1 }, (_, i) => ({ score: `${i}`, level: level(i) })), { score: 'R', level: max * 1.08 }],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [max, base, onPick],
  );
  const P = CHARTKIT_PAD;
  const strokeId = React.useId().replace(/[^a-zA-Z0-9]/g, '') + 'painScale';
  const renderer = React.useMemo(
    () => createPainRenderer({ left: P.left, right: P.left + width, top: P.top, bottom: P.top + height }, strokeId),
    [width, height, strokeId, P.left, P.top],
  );
  // ตำแหน่งจุดคะแนน i (ตรงกับการวางจุดของ ChartKit: index กระจายเต็มความกว้าง)
  const n = data.length - 1;
  const pointX = (i: number) => ((i + 1) / n) * width;
  const pointY = (i: number) => height * (1 - level(i) / top);
  const col = width / (n || 1);
  return (
    <View onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))} style={{ height, overflow: 'hidden' }}>
      {width > 0 ? (
        <View pointerEvents={onPick ? 'none' : 'auto'} style={{ marginLeft: -P.left, marginTop: -P.top }}>
          <AreaChart
            data={data}
            xKey="score"
            yKey="level"
            width={width + P.left + P.right}
            height={height + P.top + P.bottom}
            curve="monotone"
            yDomain={[0, top]}
            series={[{ yKey: 'level', label: 'Pain Score', color: `url(#${strokeId})`, strokeWidth: 2.5 }]}
            renderer={renderer}
            dots={false}
            selectedIndex={onPick ? undefined : value + 1}
            interaction={
              onPick
                ? undefined
                : { mode: 'scrub', selectionPersistence: 'persist', deselectOnOutsidePress: false, onSelect: (e) => onChange?.(Math.max(0, Math.min(max, e.index - 1))) }
            }
            // จุดคะแนนที่เลือก: สีตามระดับปวด ขอบขาว
            // โหมดเทียบก่อน/หลัง: จุดหลังวาดในชั้นบน (BeforeAfterOverlay) ให้อยู่ทับเส้นแรเงา
            activeDot={onPick || before !== undefined ? false : { radius: 7, strokeWidth: 3, fill: painColor(value, max), stroke: colors.surface.default }}
            crosshair={false}
            tooltip={false}
            legend={false}
            showHorizontalGridLines={false}
            showVerticalGridLines={false}
            labelStrategy="hide"
            yAxisLabelWidth={0}
            formatYLabel={() => ''}
            theme={{ background: 'transparent', plotBackground: 'transparent', grid: 'transparent', axis: 'transparent', text: 'transparent', mutedText: 'transparent' }}
            accessibilityLabel={`คะแนนปวด ${value} จาก ${max}`}
          />
        </View>
      ) : null}
      {/* ก่อน → หลัง: แรเงาใต้เส้นช่วงระหว่างสองคะแนน + จุดโปร่งที่คะแนนก่อนรักษา */}
      {before !== undefined && width > 0 && !onPick ? (
        <BeforeAfterOverlay before={before} after={value} max={max} width={width} height={height} pointX={pointX} pointY={pointY} />
      ) : null}
      {/* จุดคะแนน: แตะครั้งเดียวเลือกเลย */}
      {onPick && width > 0
        ? Array.from({ length: max + 1 }, (_, i) => {
            const on = i === value;
            const r = on ? 7 : 5;
            const y = pointY(i);
            return (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={`ปวดระดับ ${i} จาก ${max}`}
                onPress={() => onPick(i)}
                style={({ pressed }) => ({
                  position: 'absolute',
                  left: pointX(i) - col / 2,
                  width: col,
                  top: 0,
                  bottom: 0,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text
                  style={{
                    position: 'absolute',
                    top: y - r - 15,
                    width: col,
                    textAlign: 'center',
                    fontFamily: on ? fontFamily.bold : fontFamily.medium,
                    fontSize: on ? 12 : 10,
                    color: on ? colors.text.primary : colors.text.secondary,
                  }}
                >
                  {i}
                </Text>
                <View
                  style={{
                    position: 'absolute',
                    top: y - r,
                    left: col / 2 - r,
                    width: r * 2,
                    height: r * 2,
                    borderRadius: r,
                    backgroundColor: on ? painColor(i, max) : colors.surface.default,
                    borderWidth: 2,
                    borderColor: on ? colors.surface.default : painColor(i, max),
                  }}
                />
              </Pressable>
            );
          })
        : null}
    </View>
  );
}
