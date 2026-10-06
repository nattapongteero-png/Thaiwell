import React from 'react';
import { Animated, Easing, Keyboard, LayoutAnimation, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { componentTokens, fontFamily, space } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { BottomFade } from './Glass';
import { Text } from './Text';

export interface TabItem {
  label: string;
  /** render icon ด้วยสีตามสถานะ active/inactive */
  icon: (color: string, size: number, active: boolean) => React.ReactNode;
}

/* ------------------------------------------------------------------ Dock context
 * - accessory: หน้าที่กำลังแสดงส่งส่วนเสริม (เช่น ช่องแชท AI) มาวางเหนือ tab menu ใน dock เดียวกัน
 * - height: ความสูงจริงของ dock ให้หน้าจอเว้นที่ด้านล่าง (dock ลอยทับเนื้อหา)
 */
interface DockState {
  accessory: React.ReactNode;
  setAccessory: (n: React.ReactNode) => void;
  height: number;
  setHeight: (h: number) => void;
  /** หน้าขอซ่อนแถบแท็บชั่วคราว (เช่น กำลังคุยกับ AI · โหมดให้คะแนนบนหุ่น) */
  hideTabs: boolean;
  setHideTabs: (v: boolean) => void;
  /** ปุ่มลอย (FAB) ของหน้า เช่น ปุ่ม AI — มุมขวาล่าง เหนือ tab menu */
  fab: React.ReactNode;
  setFab: (n: React.ReactNode) => void;
}
const DockContext = React.createContext<DockState | null>(null);

export function TabAccessoryProvider({ children }: { children: React.ReactNode }) {
  const [accessory, setAccessory] = React.useState<React.ReactNode>(null);
  const [height, setHeight] = React.useState(0);
  const [hideTabs, setHideTabs] = React.useState(false);
  const [fab, setFab] = React.useState<React.ReactNode>(null);
  const value = React.useMemo(
    () => ({ accessory, setAccessory, height, setHeight, hideTabs, setHideTabs, fab, setFab }),
    [accessory, height, hideTabs, fab],
  );
  return <DockContext.Provider value={value}>{children}</DockContext.Provider>;
}

/** ใช้ในหน้าจอของแท็บ: แสดง node เหนือ tab menu ขณะหน้านี้ถูกเลือก และเอาออกเมื่อออกจากหน้า */
export function useTabAccessory(node: React.ReactNode, deps: React.DependencyList) {
  const ctx = React.useContext(DockContext);
  useFocusEffect(
    React.useCallback(() => {
      ctx?.setAccessory(node);
      return () => ctx?.setAccessory(null);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps),
  );
}

/** ใช้ในหน้าจอของแท็บ: ปุ่มลอย (FAB) มุมขวาล่างเหนือ tab menu ขณะหน้านี้ถูกเลือก */
export function useTabFab(node: React.ReactNode, deps: React.DependencyList) {
  const ctx = React.useContext(DockContext);
  useFocusEffect(
    React.useCallback(() => {
      ctx?.setFab(node);
      return () => ctx?.setFab(null);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps),
  );
}

/** ซ่อนแถบแท็บขณะหน้านี้ถูกเลือกและ hidden = true (ออกจากหน้า → แสดงกลับ) */
export function useHideTabs(hidden: boolean) {
  const ctx = React.useContext(DockContext);
  useFocusEffect(
    React.useCallback(() => {
      ctx?.setHideTabs(hidden);
      return () => ctx?.setHideTabs(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hidden]),
  );
}

/** ความสูงของ dock ที่ลอยอยู่ (0 ถ้าหน้าจอไม่ได้อยู่ในแท็บ) — ใช้เว้นที่ด้านล่างของเนื้อหา */
export function useDockHeight() {
  return React.useContext(DockContext)?.height ?? 0;
}

/**
 * TabBar — dock ลอยติดล่าง (sticky ทุกแท็บ)
 * - [ส่วนเสริมของหน้า เช่น คำแนะนำ + ช่องแชท AI] ลอยเหนือ [tab แคปซูล]
 * - fade ผืนเดียวคลุมตั้งแต่ส่วนแชทลงไปถึง tab menu (เนื้อหาเลื่อนผ่านด้านหลังได้)
 * - เว้น safe area ล่าง + ระยะห่างจากขอบจอเสมอ
 */
/** ความสูงแป้นพิมพ์ที่เปิดอยู่ (0 = ปิด) — iOS เท่านั้น (Android ย่อหน้าจอเองตามแป้นพิมพ์ · เว็บไม่มีแป้นพิมพ์ทับ) · ขยับพร้อมแป้นพิมพ์ */
function useKeyboardHeight() {
  const [kb, setKb] = React.useState(0);
  React.useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardWillShow', (e) => {
      LayoutAnimation.configureNext(LayoutAnimation.create(e.duration || 250, 'keyboard', 'opacity'));
      setKb(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener('keyboardWillHide', (e) => {
      LayoutAnimation.configureNext(LayoutAnimation.create(e.duration || 250, 'keyboard', 'opacity'));
      setKb(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return kb;
}

export function TabBar({ state, navigation, items, hideTabs }: BottomTabBarProps & { items: Record<string, TabItem>; /** ซ่อนแถบแท็บ (เหลือแค่ส่วนเสริมของหน้า เช่น ช่องแชท AI) */ hideTabs?: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const dock = React.useContext(DockContext);
  const accessory = dock?.accessory;
  const t = componentTokens.dock;
  const iconSize = componentTokens.tabBar.icon;
  const [h, setH] = React.useState(0);
  const [w, setW] = React.useState(0);
  // แป้นพิมพ์เปิด (พิมพ์ในช่องแชท) → dock ลอยขึ้นเหนือแป้นพิมพ์ · ซ่อนแถบแท็บ เหลือแค่ช่องแชท
  const kb = useKeyboardHeight();
  React.useEffect(() => {
    if (h) dock?.setHeight(h + kb);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kb]);
  // ซ่อนแท็บและไม่มีส่วนเสริม → ไม่มี dock เลย (หน้าจอไม่ต้องเว้นที่ด้านล่าง)
  const empty = (hideTabs || !!dock?.hideTabs) && !accessory;
  React.useEffect(() => {
    if (empty) dock?.setHeight(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empty]);
  if (empty) return null;

  return (
    <View
      pointerEvents="box-none"
      onLayout={(e) => {
        const height = Math.round(e.nativeEvent.layout.height);
        setH(height);
        setW(Math.round(e.nativeEvent.layout.width));
        dock?.setHeight(height + kb);
      }}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: kb,
        paddingHorizontal: t.marginX,
        paddingTop: space[12],
        paddingBottom: kb ? space[2] : insets.bottom + t.marginBottom,
        gap: space[2],
      }}
    >
      {h > 0 && w > 0 ? <BottomFade height={h} width={w} /> : null}
      {accessory}
      {/* FAB: ลอยมุมขวาเหนือ tab menu (ไม่นับในความสูง dock) */}
      {dock?.fab && !(hideTabs || dock?.hideTabs) ? (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', right: t.marginX, bottom: insets.bottom + t.marginBottom + t.height + space[3], width: componentTokens.voice.cta, height: componentTokens.voice.cta, zIndex: 2 }}
        >
          {dock.fab}
        </View>
      ) : null}
      {hideTabs || dock?.hideTabs || kb ? null : <DockTabs state={state} navigation={navigation} items={items} />}
    </View>
  );
}

/* ------------------------------------------------------------------ DockTabs
 * ตามต้นแบบ ThaiWellAI (Dock.tsx · framer-motion):
 * - pill ขาวเลื่อนไปหาแท็บที่เลือก (layoutId) · spring soft (stiffness 300 · damping 32 · mass 0.9)
 * - ชื่อแท็บกาง/หุบ (width 0 → auto + opacity) ด้วย spring เดียวกัน แท็บข้าง ๆ ขยับตาม
 * - ไอคอนแท็บที่เพิ่งเลือก: scale 0.8 → 1.12 → 1 · rotate 0 → -6° → 0 (0.45 วิ ease [0.22,1,0.36,1])
 * - dock เลื่อนขึ้น 40 + จางเข้า ตอนแสดงครั้งแรก (delay 0.25 วิ)
 * pill = ผลรวมถ่วงน้ำหนักตำแหน่งแท็บด้วยค่า p ของแต่ละแท็บ (แท็บเก่า p 1→0 · ใหม่ 0→1 spring เดียวกัน → รวมกัน = 1 ตลอด)
 */
const SOFT = { stiffness: 300, damping: 32, mass: 0.9, useNativeDriver: false } as const;
const LABEL_GAP = 8;
const PAD_X = 11;
const PAD_ACTIVE_EXTRA = 5; // paddingRight 16 ตอนเลือก

function DockTabs({ state, navigation, items }: Pick<BottomTabBarProps, 'state' | 'navigation'> & { items: Record<string, TabItem> }) {
  const { colors } = useTheme();
  const t = componentTokens.dock;
  const iconSize = componentTokens.tabBar.icon;
  // route ที่ไม่มีใน items = หน้าที่เข้าจากที่อื่น (ไม่แสดงเป็นแท็บ)
  const tabs = state.routes.map((r, i) => ({ route: r, index: i, item: items[r.name] })).filter((x) => !!x.item);
  const base = Math.max(t.item, iconSize + PAD_X * 2);

  const p = React.useRef(tabs.map((x) => new Animated.Value(state.index === x.index ? 1 : 0))).current;
  const pop = React.useRef(tabs.map(() => new Animated.Value(1))).current;
  // จำนวนแท็บเปลี่ยน (เพิ่มเมนู / fast refresh) → เติมค่า animation ให้ครบทุกแท็บ ไม่งั้นแท็บใหม่ไม่มีค่า (crash)
  tabs.forEach((x, k) => {
    if (!p[k]) p[k] = new Animated.Value(state.index === x.index ? 1 : 0);
    if (!pop[k]) pop[k] = new Animated.Value(1);
  });
  const enter = React.useRef(new Animated.Value(0)).current;
  const [labelW, setLabelW] = React.useState<number[]>(() => tabs.map(() => 0));

  React.useEffect(() => {
    Animated.spring(enter, { ...SOFT, toValue: 1, delay: 250, useNativeDriver: true }).start();
  }, [enter]);
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    Animated.parallel(
      tabs.flatMap((x, k) => {
        const on = state.index === x.index;
        const a: Animated.CompositeAnimation[] = [Animated.spring(p[k], { ...SOFT, toValue: on ? 1 : 0 })];
        if (on) {
          pop[k].setValue(0);
          a.push(Animated.timing(pop[k], { toValue: 1, duration: 450, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }));
        }
        return a;
      }),
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index]);

  // ความกว้างแต่ละแท็บ = ฐาน + p × (ชื่อ + ช่องไฟ + padding ขวาที่เพิ่ม)
  const widths = tabs.map((_, k) => Animated.add(base, Animated.multiply(p[k], labelW[k] ? labelW[k] + LABEL_GAP + PAD_ACTIVE_EXTRA : 0)));
  const xs: Animated.AnimatedInterpolation<number>[] = [];
  let acc: Animated.AnimatedInterpolation<number> = Animated.add(0, 0);
  widths.forEach((w) => {
    xs.push(acc);
    acc = Animated.add(Animated.add(acc, w), t.gap);
  });
  let pillX: Animated.AnimatedInterpolation<number> = Animated.add(t.padding, 0);
  let pillW: Animated.AnimatedInterpolation<number> = Animated.add(0, 0);
  tabs.forEach((_, k) => {
    pillX = Animated.add(pillX, Animated.multiply(p[k], xs[k]));
    pillW = Animated.add(pillW, Animated.multiply(p[k], widths[k]));
  });

  return (
    <Animated.View
      accessibilityRole="tablist"
      style={[
        {
          // กว้างตามเนื้อหา กึ่งกลางจอ (แบบ dock ของ back-office) · แก้วฝ้า: เว็บเบลอจริง native ใช้พื้นโปร่ง
          alignSelf: 'center',
          height: t.height,
          borderRadius: t.radius,
          padding: t.padding,
          gap: t.gap,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: Platform.OS === 'web' ? colors.dock.bg : 'rgba(255,255,255,0.86)',
          borderWidth: 1,
          borderColor: colors.dock.border,
          shadowColor: '#000000',
          shadowOpacity: 0.2,
          shadowRadius: 32,
          shadowOffset: { width: 0, height: 10 },
          elevation: 6,
          opacity: enter,
          transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
        },
        Platform.OS === 'web' ? ({ backdropFilter: `blur(${t.blur}px) saturate(1.6)`, WebkitBackdropFilter: `blur(${t.blur}px) saturate(1.6)` } as object) : null,
      ]}
    >
      {/* วัดความกว้างชื่อแท็บ (มองไม่เห็น) */}
      <View pointerEvents="none" style={{ position: 'absolute', opacity: 0, left: 0, top: 0, width: 400 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {tabs.map((x, k) => (
          <View key={x.route.key} style={{ position: 'absolute' }} onLayout={(e) => {
            const w = Math.ceil(e.nativeEvent.layout.width) + 1;
            setLabelW((prev) => {
              if (prev[k] === w) return prev;
              const next = [...prev];
              next[k] = w;
              return next;
            });
          }}>
            <Text numberOfLines={1} style={{ fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 20 }}>
              {x.item.label}
            </Text>
          </View>
        ))}
      </View>
      {/* pill ขาวของแท็บที่เลือก — เลื่อน/ยืดตามแท็บ */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: t.padding,
          left: pillX,
          width: pillW,
          height: t.item,
          borderRadius: t.item / 2,
          backgroundColor: colors.dock.activeBg,
          shadowColor: '#000000',
          shadowOpacity: 0.16,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 6 },
          elevation: 3,
        }}
      />
      {tabs.map((x, k) => {
        const { route, item } = x;
        const focused = state.index === x.index;
        const color = focused ? colors.dock.activeFg : colors.dock.fg;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={item.label}
            onPress={() => {
              const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !e.defaultPrevented) navigation.navigate(route.name, route.params);
            }}
          >
            <Animated.View style={{ width: widths[k], height: t.item, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', paddingLeft: (base - iconSize) / 2 }}>
              <Animated.View
                style={{
                  transform: [
                    { scale: pop[k].interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 1.12, 1] }) },
                    { rotate: pop[k].interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '-6deg', '0deg'] }) },
                  ],
                }}
              >
                {item.icon(color, iconSize, focused)}
              </Animated.View>
              {/* ไม่หดตามช่อง (ถูกตัดด้วยขอบแท็บแทน → กางออกทีละนิด ไม่ขึ้น …) */}
              <Animated.View style={{ marginLeft: LABEL_GAP, opacity: p[k], flexShrink: 0 }}>
                <Text color={colors.dock.label} style={{ fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 20, width: labelW[k] || undefined }}>
                  {item.label}
                </Text>
              </Animated.View>
            </Animated.View>
          </Pressable>
        );
      })}
    </Animated.View>
  );
}
