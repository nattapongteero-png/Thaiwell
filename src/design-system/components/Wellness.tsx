import React from 'react';
import { PanResponder, Pressable, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import EllipseDot from '../../../assets/figma/ellipse.svg';
import Thumb from '../../../assets/figma/thumb.svg';
import { componentTokens, fontFamily, palette, radius, space } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { PainScaleArea, painColor, painTint } from './PainAreaChart';
import { Icon } from './Icon';
import { Text } from './Text';

/* ------------------------------------------------------------------ SymptomChip (Figma: symptom-chips) */

export function SymptomChip({
  label,
  selected,
  onPress,
  dot,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** จุดสีหน้า label — ใช้กับ "จุดกดบำบัด" */
  dot?: boolean;
}) {
  const { colors } = useTheme();
  const t = componentTokens.chipSm;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.gap,
        // หน้าตาเดียวกับตัวเลือกในแชท (ReplyChips): แคปซูลขาว ขอบบาง · เลือก = พื้นสีแบรนด์ ตัวขาว
        paddingHorizontal: space[3],
        paddingVertical: space[2],
        borderRadius: t.radius,
        borderWidth: 1,
        borderColor: selected ? colors.brand.primary : colors.border.subtle,
        backgroundColor: selected ? colors.brand.primary : colors.glass.strong,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {dot ? <EllipseDot width={t.dot} height={t.dot} color={selected ? colors.brand.onPrimary : colors.brand.primary} /> : null}
      <Text variant="labelMd" color={selected ? colors.brand.onPrimary : colors.text.primary}>
        {label}
      </Text>
    </Pressable>
  );
}

/** ChipSection — หัวข้อเล็ก + กลุ่ม chip แบบ wrap (Figma: quick-replies) */
export function ChipSection({
  title,
  options,
  value,
  onChange,
  dot,
  width,
}: {
  /** ไม่ใส่ = ไม่มีหัวข้อ (เช่น อยู่ใต้คำถามของ AI ในแชทแล้ว) */
  title?: string;
  options: string[];
  value: string[];
  onChange?: (v: string[]) => void;
  dot?: boolean;
  width?: number;
}) {
  return (
    <View style={{ gap: space[2], width }}>
      {title ? (
        <Text variant="bodyXs" tone="secondary">
          {title}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: componentTokens.chipSm.groupGap }}>
        {options.map((o) => {
          const sel = value.includes(o);
          return (
            <SymptomChip
              key={o}
              label={o}
              dot={dot}
              selected={sel}
              onPress={onChange ? () => onChange(sel ? value.filter((v) => v !== o) : [...value, o]) : undefined}
            />
          );
        })}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ ElementSummary (Figma: element-main) */

/** ธาตุเจ้าเรือน/ธาตุที่เด่น + % + คำแนะนำสั้น */
export function ElementSummary({ percent, name, advice, width, onPress }: { percent: number; name: string; advice: string; width?: number; onPress?: () => void }) {
  const { colors } = useTheme();
  const t = componentTokens.elementRing;
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], width }}
      accessibilityLabel={`${name} ${percent}% ${advice}`}
    >
      <View
        style={{
          width: t.size,
          height: t.size,
          borderRadius: radius.full,
          borderWidth: t.border,
          borderColor: colors.brand.primary,
          backgroundColor: 'rgba(255,255,255,0.63)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* 3 หลัก (100%) ใช้ตัวเล็กลงเพื่อไม่ล้นวง */}
        <Text variant={percent >= 100 ? 'labelSm' : 'titleXs'} color={colors.brand.onSubtle} style={percent >= 100 ? { fontFamily: fontFamily.bold, letterSpacing: 0 } : undefined}>
          {percent}%
        </Text>
      </View>
      <View style={{ flex: 1, gap: space[1] }}>
        <Text variant="titleXs">{name}</Text>
        <Text variant="caption" tone="secondary">
          {advice}
        </Text>
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ PainScoreCard (Figma: vas-card) */

/**
 * PainScoreCard — Visual Analogue Scale 0–10
 * ลากหรือแตะบนแถบสีเพื่อเปลี่ยนค่า (ไล่สีเขียว → เหลือง → แดง)
 */
/**
 * ตัวเลขคะแนนใหญ่: ขอบบนของตัวเลขตรงกับขอบบนป้าย "ก่อนรักษา" · ขอบล่างตรงกับขอบล่างของ "/ 10"
 * sideOffset = เลื่อนคอลัมน์ขวาลงให้ป้ายเริ่มที่ระดับหัวตัวเลข (ฟอนต์เว้นที่ว่างเหนือตัวเลขไว้ในบรรทัด)
 */
const SCORE = { size: 74, line: 96, sideOffset: 6 };
/** โหมดเทียบก่อน/หลัง: ตัวเลขเล็กลงให้วาง 2 ค่าในการ์ดเดียว */
const SCORE_SM = { size: 40, line: 52 };

/**
 * คะแนนหนึ่งค่าในโหมดเทียบ: pill (สีเดียวกับจุดบนกราฟ + เครื่องหมายแบบเดียวกับจุด) · ตัวเลข / max
 * ก่อน = วงโปร่ง (เหมือนจุดโปร่งบนกราฟ) · หลัง = จุดทึบ
 */
function ScoreBlock({ value, label, max, hollow }: { value: number; label: string; max: number; hollow?: boolean }) {
  const { colors } = useTheme();
  const c = painColor(value, max);
  return (
    <View style={{ flex: 1, gap: space[1] }} accessibilityLabel={`${label} ${value} จาก ${max}`}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: 4,
          paddingHorizontal: space[2],
          paddingVertical: 2,
          borderRadius: radius.full,
          backgroundColor: painTint(value, 0.22, max),
        }}
      >
        <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 2, borderColor: c, backgroundColor: hollow ? colors.surface.default : c }} />
        <Text variant="bodyXs" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
        <Text variant="displayXl" style={{ fontSize: SCORE_SM.size, lineHeight: SCORE_SM.line }}>
          {value}
        </Text>
        <Text variant="titleXs" tone="secondary">
          /{max}
        </Text>
      </View>
    </View>
  );
}

/** ดีขึ้น/แย่ลงกี่ % เทียบก่อนรักษา — pill แบบเดียวกับ pill ก่อน/หลัง แต่สีตามสถานะ (ลดลง = เขียว · เพิ่มขึ้น = แดง · เท่าเดิม = เทา) */
function DeltaPill({ before, after }: { before: number; after: number }) {
  const { colors } = useTheme();
  const pct = before > 0 ? Math.round(((before - after) / before) * 100) : 0;
  const tone = after < before ? colors.status.success : after > before ? colors.status.danger : null;
  const fg = tone ? tone.fg : colors.text.secondary;
  const label = after === before ? 'เท่าเดิม' : `${after < before ? 'ลดลง' : 'เพิ่มขึ้น'} ${Math.abs(pct)}%`;
  return (
    <View
      accessibilityLabel={`ความปวด${label}จากก่อนรักษา`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        // ชิดตัวเลขคะแนนด้านบน (บรรทัดตัวเลขมีที่ว่างด้านล่างเผื่อฟอนต์)
        marginTop: -space[3],
        gap: 4,
        paddingHorizontal: space[2],
        paddingVertical: 2,
        borderRadius: radius.full,
        backgroundColor: tone ? tone.bg : colors.border.default,
      }}
    >
      {after === before ? null : <Icon name={after < before ? 'trending-down' : 'trending-up'} size="xs" color={fg} />}
      <Text variant="bodyXs" color={fg} style={{ fontFamily: fontFamily.semibold }}>
        {label}
      </Text>
    </View>
  );
}

export function PainScoreCard({
  value,
  onChange,
  stageLabel = 'ก่อนรักษา',
  max = 10,
  chart,
  onPick,
  width,
  before,
}: {
  value: number;
  /** คะแนนก่อนรักษา → การ์ดเปรียบเทียบ: value = หลังรักษา (ตัวใหญ่) · แถวล่างบอกจากเท่าไหร่ ดีขึ้น/แย่ลงกี่ % */
  before?: number;
  onChange?: (v: number) => void;
  /** แตะจุดคะแนนบนกราฟครั้งเดียวเพื่อเลือก (ใช้คู่กับ chart) */
  onPick?: (v: number) => void;
  /** ความกว้างการ์ด (ค่าเริ่มต้นตาม Figma) */
  width?: number | '100%';
  stageLabel?: string;
  max?: number;
  /** แสดงสเกลความปวดเป็น area chart (ChartKit) แทนแถบเลื่อน — ลากเพื่อเลือกคะแนน */
  chart?: boolean;
}) {
  const { colors } = useTheme();
  const t = componentTokens.painCard;
  // ป้ายสั้นแบบเดียวกันทุกการ์ด: ก่อน / หลัง (ตัด "รักษา" / "นวด")
  const shortStage = stageLabel.replace(/(นวด|รักษา)$/, '') || stageLabel;
  const [trackW, setTrackW] = React.useState<number>(t.width);
  const trackWRef = React.useRef(trackW);
  trackWRef.current = trackW;
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const setFromX = (x: number) => {
    const v = Math.round(Math.max(0, Math.min(1, x / trackWRef.current)) * max);
    onChangeRef.current?.(v);
  };
  const pan = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => setFromX(e.nativeEvent.locationX),
        onPanResponderMove: (e) => setFromX(e.nativeEvent.locationX),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const thumbLeft = (value / max) * trackW - t.thumb / 2;
  // โหมดแตะจุด: กราฟสูงขึ้นให้มีที่วางตัวเลขเหนือจุด
  // โหมดเทียบก่อน/หลัง: กราฟไม่ยกขึ้นซ้อนตัวเลข (มีตัวเลข 2 ค่าเต็มแถว)
  // การ์ดแสดงผล (ไม่ได้ให้เลือกคะแนน) ใช้รูปแบบเดียวกันทั้งค่าเดียวและก่อน/หลัง: pill + ตัวเลขขนาดกลาง + กราฟไม่ซ้อนตัวเลข
  const display = !onChange && !onPick;
  const unified = before !== undefined || display;
  const chartH = onPick ? t.chartHeight + t.chartLift + space[4] : unified ? t.chartHeight : t.chartHeight + t.chartLift;
  const chartBelow = onPick ? t.chartHeight + space[2] : unified ? t.chartHeight - space[5] : t.chartHeight - space[4];

  return (
    <View
      style={{
        width: width ?? t.width,
        borderRadius: t.radius,
        backgroundColor: colors.surface.raised,
        paddingTop: t.padding,
        // กราฟวางชิดล่างแบบ absolute → เว้นที่ใต้ตัวเลขเท่าความสูงกราฟส่วนที่ไม่ซ้อน (ทุกแพลตฟอร์มเหมือนกัน ไม่ขึ้นกับความสูงบรรทัดของฟอนต์)
        paddingBottom: chart ? chartBelow : space[4],
        gap: space[2],
        ...t.shadow,
      }}
    >
      {/* ข้อความอยู่ชั้นบนกราฟ · box-none ให้ลากกราฟผ่านพื้นที่ว่างได้ */}
      <View pointerEvents="box-none" style={{ paddingHorizontal: t.padding, gap: space[2], zIndex: 1 }}>
        <Text variant="bodyXs" tone="secondary">
          Pain Score
        </Text>
        {before !== undefined ? (
          // เทียบก่อน/หลังในการ์ดเดียว (ค่าเล็กลง วางคู่กัน)
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            {/* การ์ดแคบ (เช่น ในแชท) → ป้ายสั้นลงไม่ให้ pill ชนกัน */}
            <ScoreBlock value={before} label="ก่อน" max={max} hollow />
            <ScoreBlock value={value} label={shortStage} max={max} />
          </View>
        ) : null}
        {before !== undefined ? <DeltaPill before={before} after={value} /> : null}
        {before === undefined && display ? (
          // ค่าเดียว (เช่น ก่อนรักษา) — รูปแบบเดียวกับการ์ดก่อน/หลัง
          <View style={{ flexDirection: 'row' }}>
            <ScoreBlock value={value} label={shortStage} max={max} hollow={/ก่อน/.test(stageLabel)} />
          </View>
        ) : null}
        {unified ? null : (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}>
          {/* คะแนนที่เลือก = จุดเด่นของการ์ด (ใหญ่กว่า displayXl) · lineHeight เผื่อฟอนต์ไทยไม่ให้ iOS ตัดหัว */}
          <Text variant="displayXl" style={{ fontSize: SCORE.size, lineHeight: SCORE.line }} accessibilityLabel={`คะแนนปวด ${value} จาก ${max}`}>
            {value}
          </Text>
          <View style={{ gap: space[1], marginTop: SCORE.sideOffset }}>
            <View style={{ minWidth: t.pill, alignSelf: 'flex-start', paddingHorizontal: space[2], paddingVertical: space[1], borderRadius: radius.full, backgroundColor: colors.border.default }}>
              <Text variant="bodyXs" tone="secondary">
                {stageLabel}
              </Text>
            </View>
            <Text variant="titleXl">
              /{' '}
              <Text variant="titleXs">{max}</Text>
            </Text>
          </View>
        </View>
        )}
      </View>

      {chart ? (
        // สเกลความปวดแบบ area chart ชิดขอบการ์ด — ลากเพื่อเลือกคะแนน
        // ยกกราฟขึ้นไปใช้พื้นที่ว่างด้านบน (ซ้อนหลังตัวเลข) โดยการ์ดสูงเท่าเดิม: สูงเพิ่ม chartLift แล้วดึงขึ้นเท่ากัน
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden', borderBottomLeftRadius: t.radius, borderBottomRightRadius: t.radius }}>
          <PainScaleArea value={value} onChange={onChange} onPick={onPick} max={max} height={chartH} before={before} />
        </View>
      ) : (
      <View
        {...pan.panHandlers}
        accessibilityRole="adjustable"
        accessibilityValue={{ min: 0, max, now: value }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onChange?.(Math.max(0, Math.min(max, value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))))}
        onLayout={(e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width)}
        style={{ height: space[6], justifyContent: 'center' }}
      >
        <Svg width={trackW} height={t.trackHeight}>
          <Defs>
            <LinearGradient id="painTrack" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={palette.pain.low} />
              <Stop offset="0.5" stopColor={palette.pain.mid} />
              <Stop offset="1" stopColor={palette.pain.high} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={trackW} height={t.trackHeight} rx={t.trackHeight / 2} fill="url(#painTrack)" />
        </Svg>
        <View pointerEvents="none" style={{ position: 'absolute', left: thumbLeft, top: (space[6] - t.thumb) / 2 }}>
          <Thumb width={t.thumb} height={t.thumb} />
        </View>
      </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ StatCard (Figma: text-stack 134:1988) */

/** การ์ดขาวโปร่งแบบ Figma "text-stack": ขาว 90% · ขอบขาว 1px · padding 12 · มุม 16 · กว้าง 160 */
export function StackCard({ children, width = componentTokens.statCard.width, gap = space[3], onPress }: { children: React.ReactNode; width?: number; gap?: number; onPress?: () => void }) {
  const t = componentTokens.statCard;
  const style = { width, gap, padding: space[3], borderRadius: radius.lg, backgroundColor: t.bg, borderWidth: 1, borderColor: t.border };
  if (!onPress) return <View style={style}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [style, { opacity: pressed ? 0.85 : 1 }]}>
      {children}
    </Pressable>
  );
}

/** Pain Score แบบย่อ (Figma 134:1988): ตัวเลขใหญ่ + ป้ายช่วง (ก่อน/หลังรักษา) + "/ 10" */
export function PainScoreStat({ value, stageLabel, max = 10, title = 'Pain Score' }: { value: number; stageLabel: string; max?: number; title?: string }) {
  const { colors } = useTheme();
  return (
    <StackCard>
      <Text variant="bodyBase" tone="secondary">
        {title}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <Text variant="displayXl" style={{ lineHeight: 60 }} accessibilityLabel={`${title} ${stageLabel} ${value} จาก ${max}`}>
          {value}
        </Text>
        <View style={{ gap: space[1] }}>
          <View style={{ alignSelf: 'flex-start', paddingHorizontal: space[2], paddingVertical: space[1], borderRadius: radius.full, backgroundColor: colors.border.default }}>
            <Text variant="bodyBase" tone="secondary">
              {stageLabel}
            </Text>
          </View>
          <Text variant="titleXl">
            /{' '}
            <Text variant="titleXs">{max}</Text>
          </Text>
        </View>
      </View>
    </StackCard>
  );
}
