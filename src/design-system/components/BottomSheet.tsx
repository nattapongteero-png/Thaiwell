import React from 'react';
import { Animated, Easing, Modal, PanResponder, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { EdgeFade } from './Glass';
import { Icon } from './Icon';
import { Text } from './Text';

/**
 * BottomSheet — พื้นหลังจางขึ้นอยู่กับที่ · เฉพาะ sheet เลื่อนขึ้น · สูงคงที่ (เนื้อหาเลื่อนข้างใน)
 * ปิด: ปัดลงที่หัว · แตะพื้นหลัง · ✕ · ปุ่มย้อนกลับของเครื่อง
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  header,
  footer,
  heightRatio = 0.72,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** ส่วนหัวเพิ่มเติม (ไม่เลื่อน) เช่น ตัวกรอง */
  header?: React.ReactNode;
  /** ส่วนล่างติดขอบ (ไม่เลื่อน) เช่น ปุ่มบันทึก */
  footer?: React.ReactNode;
  heightRatio?: number;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const [mounted, setMounted] = React.useState(visible);
  const fade = React.useRef(new Animated.Value(0)).current;
  const slide = React.useRef(new Animated.Value(winH)).current;

  React.useEffect(() => {
    if (visible) {
      setMounted(true);
      slide.setValue(winH);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(slide, { toValue: 0, damping: 26, stiffness: 260, mass: 0.9, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slide, { toValue: winH, duration: 240, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ปัดลงที่หัว sheet: ลากตามนิ้ว · เกิน 120 หรือปัดเร็ว = ปิด · ไม่ถึง = เด้งกลับ
  const pan = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => slide.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (g.dy > 120 || g.vy > 1.2) onClose();
          else Animated.spring(slide, { toValue: 0, damping: 24, stiffness: 280, useNativeDriver: true }).start();
        },
      }),
    [slide, onClose],
  );

  if (!mounted) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.45)', opacity: fade }}>
        <Pressable accessibilityRole="button" accessibilityLabel="ปิด" onPress={onClose} style={{ flex: 1 }} />
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: Math.round(winH * heightRatio),
          backgroundColor: colors.surface.canvas,
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          paddingBottom: insets.bottom + space[2],
          shadowColor: '#0F172A',
          shadowOpacity: 0.18,
          shadowRadius: 30,
          shadowOffset: { width: 0, height: -8 },
          elevation: 16,
          transform: [{ translateY: slide }],
        }}
      >
        <View {...pan.panHandlers}>
          <View style={{ alignItems: 'center', paddingTop: space[3], paddingBottom: space[1] }}>
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border.strong }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[5], paddingTop: space[2], gap: space[3] }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="titleLg">{title}</Text>
              {subtitle ? (
                <Text variant="bodySm" tone="secondary">
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="ปิด"
              onPress={onClose}
              hitSlop={8}
              style={{ width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface.sunken }}
            >
              <Icon name="x" size="sm" />
            </Pressable>
          </View>
          {header ? <View style={{ paddingHorizontal: space[5], paddingTop: space[4] }}>{header}</View> : null}
        </View>
        {/* เนื้อหาจางที่ขอบบน/ล่างตอนเลื่อนผ่าน (แทนเส้นคั่น) */}
        <EdgeFade>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: space[5], paddingTop: space[5], paddingBottom: space[6], gap: space[3] }}>
            {children}
          </ScrollView>
        </EdgeFade>
        {footer ? <View style={{ paddingHorizontal: space[5], paddingTop: space[2] }}>{footer}</View> : null}
      </Animated.View>
    </Modal>
  );
}
