import React from 'react';
import { ScrollView, View, type ViewStyle, type StyleProp } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useGrid } from './useGrid';
import { useDockHeight } from '../components/TabBar';
import { EdgeFade } from '../components/Glass';
import { useKeepFocusedVisible, useKeyboardHeight } from './keyboard';

type SpaceKey = keyof typeof space;

interface StackProps {
  gap?: SpaceKey;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  flex?: number;
}

/** Vertical stack — ระยะห่างระหว่างลูกมาจาก spacing token เท่านั้น (Law of Proximity) */
export function VStack({ gap = 0, align, justify, style, children, flex }: StackProps) {
  return <View style={[{ gap: space[gap], alignItems: align, justifyContent: justify, flex }, style]}>{children}</View>;
}

export function HStack({ gap = 0, align = 'center', justify, wrap, style, children, flex }: StackProps) {
  return (
    <View
      style={[
        { flexDirection: 'row', gap: space[gap], alignItems: align, justifyContent: justify, flexWrap: wrap ? 'wrap' : 'nowrap', flex },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export const Spacer = ({ size, flex }: { size?: SpaceKey; flex?: boolean }) => (
  <View style={flex ? { flex: 1 } : { height: space[size ?? 4], width: space[size ?? 4] }} />
);

/** Grid row — ลูกแต่ละตัวครอบด้วย <Col span={n}> */
export function GridRow({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const g = useGrid();
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', columnGap: g.gutter, rowGap: g.gutter }, style]}>{children}</View>;
}

/**
 * Col — span กำหนดตาม breakpoint ได้ เช่น span={{ compact: 4, medium: 4, expanded: 6 }}
 * ถ้าใส่ตัวเลขตรง ๆ จะ clamp ไม่เกินจำนวน column ของ breakpoint นั้น
 */
export function Col({
  span,
  children,
  style,
}: {
  span: number | Partial<Record<'compact' | 'medium' | 'expanded', number>>;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const g = useGrid();
  const n = typeof span === 'number' ? span : span[g.breakpoint] ?? g.columns;
  return <View style={[{ width: g.span(Math.min(n, g.columns)) }, style]}>{children}</View>;
}

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  /** พื้นที่ด้านล่างสำหรับ CTA ติดขอบล่าง (thumb zone) */
  footer?: React.ReactNode;
  header?: React.ReactNode;
  padded?: boolean;
  background?: 'canvas' | 'default';
  contentStyle?: StyleProp<ViewStyle>;
  /** เลื่อนหน้าจากภายนอก (เช่น เลือกแล้วเลื่อนให้เห็นขั้นถัดไป) */
  scrollRef?: React.RefObject<ScrollView | null>;
}

/**
 * Screen — container มาตรฐานทุกหน้า
 * - ใช้ grid margin ตาม breakpoint
 * - จำกัด max content width (อ่านง่ายบน tablet/kiosk)
 * - footer ติดล่าง + safe area (CTA อยู่ในระยะนิ้วโป้ง: Fitts's Law)
 */
export function Screen({ children, scroll = true, footer, header, padded = true, background = 'canvas', contentStyle, scrollRef: outerRef }: ScreenProps) {
  const { colors } = useTheme();
  const g = useGrid();
  const insets = useSafeAreaInsets();
  // หน้าในแท็บ: dock (tab menu) ลอยทับด้านล่าง ต้องเว้นที่ให้เนื้อหาและ footer
  const dockH = useDockHeight();
  /* คีย์บอร์ดขึ้น: ดันทั้งหน้าขึ้นเหนือคีย์บอร์ด (ปุ่มด้านล่างอยู่เหนือคีย์บอร์ด) + เลื่อนช่องที่พิมพ์ให้เห็นเสมอ */
  const innerRef = React.useRef<ScrollView | null>(null);
  const scrollRef = outerRef ?? innerRef;
  const keyboard = useKeyboardHeight();
  const onScroll = useKeepFocusedVisible(scrollRef, keyboard);
  const lift = keyboard ? Math.max(0, keyboard - insets.bottom - dockH) : 0;
  const inner = (
    <View
      style={[
        {
          width: '100%',
          maxWidth: g.maxContentWidth,
          alignSelf: 'center',
          paddingHorizontal: padded ? g.margin : 0,
          paddingTop: space[4],
          paddingBottom: space[8] + (footer ? 0 : dockH),
          gap: space[4],
        },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface[background], paddingBottom: lift }}>
      {header}
      {scroll ? (
        // เนื้อหาจางที่ขอบบน (ใต้ header) / ขอบล่าง (เหนือปุ่ม) ตอนเลื่อนผ่าน — แบบเดียวกับหน้าแรก
        <EdgeFade top={header ? 20 : 0} bottom={footer ? 28 : 0}>
          <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" onScroll={onScroll} scrollEventThrottle={32} contentContainerStyle={{ flexGrow: 1 }}>
            {inner}
          </ScrollView>
        </EdgeFade>
      ) : (
        <View style={{ flex: 1 }}>{inner}</View>
      )}
      {footer ? (
        <View
          style={{
            // ไม่มีเส้นคั่น — เนื้อหาเหนือปุ่มจางเอง (EdgeFade)
            backgroundColor: colors.surface[background],
            paddingHorizontal: g.margin,
            paddingTop: space[3],
            paddingBottom: dockH ? space[3] : Math.max(insets.bottom, space[3]),
            marginBottom: dockH,
          }}
        >
          <View style={{ width: '100%', maxWidth: g.maxContentWidth - g.margin * 2, alignSelf: 'center', gap: space[2] }}>{footer}</View>
        </View>
      ) : null}
    </View>
  );
}
