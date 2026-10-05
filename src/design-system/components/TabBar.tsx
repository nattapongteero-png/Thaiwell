import React from 'react';
import { Pressable, View } from 'react-native';
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
  icon: (color: string, size: number) => React.ReactNode;
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
export function TabBar({ state, navigation, items, hideTabs }: BottomTabBarProps & { items: Record<string, TabItem>; /** ซ่อนแถบแท็บ (เหลือแค่ส่วนเสริมของหน้า เช่น ช่องแชท AI) */ hideTabs?: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const dock = React.useContext(DockContext);
  const accessory = dock?.accessory;
  const t = componentTokens.dock;
  const iconSize = componentTokens.tabBar.icon;
  const [h, setH] = React.useState(0);
  const [w, setW] = React.useState(0);
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
        dock?.setHeight(height);
      }}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: t.marginX,
        paddingTop: space[12],
        paddingBottom: insets.bottom + t.marginBottom,
        gap: space[2],
      }}
    >
      {h > 0 && w > 0 ? <BottomFade height={h} width={w} /> : null}
      {accessory}
      {/* FAB: ลอยมุมขวาเหนือ tab menu (ไม่นับในความสูง dock) */}
      {dock?.fab && !(hideTabs || dock?.hideTabs) ? (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', right: t.marginX, bottom: insets.bottom + t.marginBottom + t.height + space[3], width: t.height, height: t.height, zIndex: 2 }}
        >
          {dock.fab}
        </View>
      ) : null}
      {hideTabs || dock?.hideTabs ? null : (
      <View
        accessibilityRole="tablist"
        style={{
          height: t.height,
          borderRadius: t.radius,
          padding: t.padding,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.dock.bg,
          borderWidth: 1,
          borderColor: colors.dock.border,
          shadowColor: '#0F172A',
          shadowOpacity: 0.12,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
        }}
      >
        {state.routes.map((route, i) => {
          const item = items[route.name];
          // route ที่ไม่มีใน items = หน้าที่เข้าจากที่อื่น (ไม่แสดงเป็นแท็บ)
          if (!item) return null;
          const focused = state.index === i;
          const color = focused ? colors.dock.activeFg : colors.text.secondary;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={item?.label ?? route.name}
              onPress={() => {
                const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !e.defaultPrevented) navigation.navigate(route.name, route.params);
              }}
              style={{
                height: t.item,
                minWidth: t.item,
                flex: focused ? 1 : undefined,
                borderRadius: t.item / 2,
                paddingHorizontal: focused ? space[4] : 0,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: space[2],
                backgroundColor: focused ? colors.dock.activeBg : 'transparent',
              }}
            >
              {item?.icon(color, iconSize)}
              {focused ? (
                <Text variant="labelMd" color={color} numberOfLines={1} style={{ fontFamily: fontFamily.semibold }}>
                  {item?.label ?? route.name}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      )}
    </View>
  );
}
