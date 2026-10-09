import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions, type PointerEvent } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line } from 'react-native-svg';
import { BODY_LIMBS, Body3D, Button, Icon, Text, useTheme, zoneRegion, type Body3DHandle, type BodyPoint, type BodyRegion, type BodyZone } from '../../../design-system';
import { radius, space } from '../../../design-system/tokens';

/**
 * หน้าเลือกบริเวณที่ปวดจากหุ่น (เปิดจากปุ่ม "ชี้จุดบนหุ่น" ในแชทประเมิน / แตะหุ่นเล็กในการ์ดประเมิน)
 * แตะบนหุ่น = เลือกทั้งโซน (แตะซ้ำ / ✕ ที่ pill = เอาออก) · ลากบนตัวหุ่น = เลือกทุกโซนที่นิ้วผ่าน
 * (เริ่มลากจากโซนที่เลือกแล้ว = ลบ) · ลากที่ว่าง = หมุน
 * เลือกครบทุกโซนของแขน/ขาข้างหนึ่ง = รวมเป็น "ปวดทั้งแขนซ้าย" ป้ายเดียว · แตะโซนในแขนขา → มีปุ่มลัดเลือกทั้งแขน/ขา
 * ข้อมูลที่ส่งออก: ชื่อ → จุดที่แตะ (โซนละ 1 จุด) — หุ่นทุกหน้าระบายทั้งโซนของจุดนั้น
 */
export type BodySelection = Record<string, BodyPoint[]>;
type Zones = Partial<Record<BodyZone, BodyPoint>>;
const limbLabel = (l: (typeof BODY_LIMBS)[number]) => `ปวดทั้ง${l.label}`;
const limbOf = (z: BodyZone) => BODY_LIMBS.find((l) => (l.zones as readonly BodyZone[]).includes(z));

const DRAG_SLOP = 6;
/** สัดส่วน canvas หุ่น (เท่าหน้าแรก — หุ่นกางแขน) */
const ASPECT = 0.53;
const PILL_H = 32;

export function BodyPicker({
  visible,
  title,
  initial,
  labelOf,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  initial: BodySelection;
  /** ส่วนของร่างกายที่แตะ → ชื่อคำตอบ (เช่น ปวดไหล่ซ้าย) */
  labelOf: (region: BodyRegion) => string;
  onClose: () => void;
  onConfirm: (sel: BodySelection) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const bodyRef = React.useRef<Body3DHandle>(null);
  const [zones, setZones] = React.useState<Zones>({});
  const zonesRef = React.useRef(zones);
  zonesRef.current = zones;
  /** แตะโซนในแขน/ขา → ปุ่มลัดเลือกทั้งแขน/ขาข้างนั้น */
  const [suggest, setSuggest] = React.useState<(typeof BODY_LIMBS)[number] | null>(null);
  // เปิดใหม่: จุดเดิม → โซน (รอหุ่นโหลดก่อน — ต้องใช้หุ่นแปลงพิกัด)
  React.useEffect(() => {
    if (!visible) return;
    setZones({});
    setSuggest(null);
    const pts = Object.values(initial).flat();
    if (!pts.length) return;
    const id = setInterval(() => {
      const b = bodyRef.current;
      if (!b || !b.regionOf(pts[0])) return;
      clearInterval(id);
      const out: Zones = {};
      for (const p of pts) {
        const r = b.regionOf(p);
        if (r && !out[r.key]) out[r.key] = p;
      }
      setZones(out);
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  /** โซน → ชื่ออาการ: แขน/ขาที่เลือกครบรวมเป็นชื่อเดียว */
  const sel = React.useMemo<BodySelection>(() => {
    const out: BodySelection = {};
    const used = new Set<BodyZone>();
    for (const l of BODY_LIMBS) {
      if (!l.zones.every((z) => zones[z])) continue;
      out[limbLabel(l)] = l.zones.map((z) => zones[z]!);
      l.zones.forEach((z) => used.add(z));
    }
    for (const [z, p] of Object.entries(zones) as [BodyZone, BodyPoint][]) {
      if (used.has(z)) continue;
      const label = labelOf(zoneRegion(z));
      out[label] = [...(out[label] ?? []), p];
    }
    return out;
  }, [zones, labelOf]);
  const [stageH, setStageH] = React.useState(0);
  const bodyH = stageH;
  const bodyW = Math.min(winW, Math.round(bodyH * ASPECT));
  const labels = React.useMemo(() => Object.keys(sel), [sel]);
  const count = labels.length;

  /* ตำแหน่ง pill: จุดที่เห็นอยู่ของแต่ละรายการ → ซ้าย/ขวาตามฝั่งของจุด · เรียงไม่ให้ซ้อนกัน */
  const [pos, setPos] = React.useState<Record<string, { x: number; y: number } | null>>({});
  React.useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      const next: Record<string, { x: number; y: number } | null> = {};
      for (const l of labels) {
        const vis = sel[l].map((p) => bodyRef.current?.projectPoint(p)).filter((q): q is { x: number; y: number; visible: boolean } => !!q && q.visible);
        next[l] = vis.length ? { x: vis.reduce((n, q) => n + q.x, 0) / vis.length, y: vis.reduce((n, q) => n + q.y, 0) / vis.length } : null;
      }
      setPos((cur) => (JSON.stringify(cur) === JSON.stringify(next) ? cur : next));
    }, 150);
    return () => clearInterval(id);
  }, [visible, sel, labels]);
  const pills = React.useMemo(() => {
    const items = labels.filter((l) => pos[l]).map((l) => ({ l, p: pos[l]!, left: pos[l]!.x < winW / 2 }));
    const out: { l: string; p: { x: number; y: number }; left: boolean; y: number }[] = [];
    for (const side of [true, false]) {
      let last = -Infinity;
      items
        .filter((it) => it.left === side)
        .sort((a, b) => a.p.y - b.p.y)
        .forEach((it) => {
          const y = Math.max(it.p.y - PILL_H / 2, last + PILL_H + space[2]);
          last = y;
          out.push({ ...it, y });
        });
    }
    return out;
  }, [labels, pos, winW]);

  /** ป้าย ✕: เอาทุกโซนของชื่อนั้นออก */
  const remove = (label: string) => {
    const limb = BODY_LIMBS.find((l) => limbLabel(l) === label);
    setZones((cur) => {
      const out = { ...cur };
      for (const z of Object.keys(cur) as BodyZone[]) if (limb ? (limb.zones as readonly BodyZone[]).includes(z) : labelOf(zoneRegion(z)) === label) delete out[z];
      return out;
    });
    setSuggest(null);
  };
  const regionAt = (pageX: number, pageY: number) => {
    const res = bodyRef.current?.pickAt(pageX, pageY);
    return res?.region ? { zone: res.region.key, point: res.point } : null;
  };
  const onTap = (pageX: number, pageY: number) => {
    const hit = regionAt(pageX, pageY);
    if (!hit) return;
    const on = !!zonesRef.current[hit.zone];
    setZones((cur) => {
      const out = { ...cur };
      if (on) delete out[hit.zone];
      else out[hit.zone] = hit.point;
      return out;
    });
    const limb = limbOf(hit.zone);
    setSuggest(!on && limb && !limb.zones.every((z) => z === hit.zone || zonesRef.current[z]) ? limb : null);
  };
  const pickLimb = (l: (typeof BODY_LIMBS)[number]) => {
    setSuggest(null);
    // โซนที่ยังไม่ได้แตะ: ใช้จุดของโซนที่แตะไว้ในแขน/ขาเดียวกันแทนไม่ได้ (หุ่นระบายตามโซนของจุด) → หาจุดกลางของโซนจากหุ่น
    const b = bodyRef.current;
    if (!b) return;
    setZones((cur) => {
      const out = { ...cur };
      for (const z of l.zones) if (!out[z]) {
        const p = b.zoneCenter(z);
        if (p) out[z] = p;
      }
      return out;
    });
  };

  /* ลากเริ่มบนตัวหุ่น = ระบายเลือกโซน (เริ่มจากโซนที่เลือกแล้ว = ลบ) · ลากเริ่มที่ว่าง = หมุน · แตะ = เลือก/เอาออก */
  const mode = React.useRef<'add' | 'erase' | 'rotate'>('rotate');
  const beginDrag = (x: number, y: number) => {
    const hit = regionAt(x, y);
    mode.current = !hit ? 'rotate' : zonesRef.current[hit.zone] ? 'erase' : 'add';
    if (mode.current === 'rotate') bodyRef.current?.beginRotate();
    else {
      setSuggest(null);
      paint(x, y);
    }
  };
  const paint = (x: number, y: number) => {
    const hit = regionAt(x, y);
    if (!hit) return;
    const erase = mode.current === 'erase';
    if (erase ? !zonesRef.current[hit.zone] : zonesRef.current[hit.zone]) return;
    const out = { ...zonesRef.current };
    if (erase) delete out[hit.zone];
    else out[hit.zone] = hit.point;
    zonesRef.current = out;
    setZones(out);
  };
  const moveDrag = (x: number, y: number, dx: number, dy: number) => {
    // แบบ ThaiWellAI: ลากซ้าย-ขวา = หมุนรอบตัว · ขึ้น-ลง = ก้ม/เงย
    if (mode.current === 'rotate') bodyRef.current?.rotateTo(dx / 80, dy / 160);
    else paint(x, y);
  };
  const endDrag = () => {
    if (mode.current === 'rotate') bodyRef.current?.endRotate();
  };
  const start = React.useRef<{ x: number; y: number } | null>(null);
  const moved = React.useRef(false);
  const web = {
    onPointerDown: (e: PointerEvent) => {
      start.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
      moved.current = false;
    },
    onPointerMove: (e: PointerEvent) => {
      if (!start.current) return;
      const { clientX: x, clientY: y } = e.nativeEvent;
      const dx = x - start.current.x;
      const dy = y - start.current.y;
      if (!moved.current && (Math.abs(dx) > DRAG_SLOP || Math.abs(dy) > DRAG_SLOP)) {
        moved.current = true;
        beginDrag(start.current.x, start.current.y);
      }
      if (moved.current) moveDrag(x, y, dx, dy);
    },
    onPointerUp: (e: PointerEvent) => {
      if (start.current && !moved.current) onTap(e.nativeEvent.clientX, e.nativeEvent.clientY);
      else if (moved.current) endDrag();
      start.current = null;
    },
    // ล้อเมาส์ / trackpad = ซูม
    onWheel: (e: { nativeEvent: { deltaY: number }; preventDefault?: () => void }) => {
      bodyRef.current?.beginZoom();
      bodyRef.current?.zoomTo(Math.exp(-e.nativeEvent.deltaY / 400));
    },
  };
  const fns = React.useRef({ onTap, beginDrag, moveDrag, endDrag });
  fns.current = { onTap, beginDrag, moveDrag, endDrag };
  const gesture = React.useMemo(
    () =>
      Gesture.Simultaneous(
        // สองนิ้วถ่าง/หุบ = ซูม (พร้อมกับลากได้)
        Gesture.Pinch()
          .runOnJS(true)
          .onStart(() => bodyRef.current?.beginZoom())
          .onUpdate((e) => bodyRef.current?.zoomTo(e.scale)),
        Gesture.Race(
        Gesture.Pan()
          .runOnJS(true)
          .minDistance(DRAG_SLOP)
          .maxPointers(1)
          // เริ่มที่ตำแหน่งที่นิ้วแตะลงครั้งแรก (ไม่ใช่ตำแหน่งที่ลากพ้นระยะแล้ว)
          .onStart((e) => fns.current.beginDrag(e.absoluteX - e.translationX, e.absoluteY - e.translationY))
          .onUpdate((e) => fns.current.moveDrag(e.absoluteX, e.absoluteY, e.translationX, e.translationY))
          .onEnd(() => fns.current.endDrag()),
        Gesture.Tap()
          .runOnJS(true)
          .maxDistance(DRAG_SLOP)
          .onEnd((e, ok) => ok && fns.current.onTap(e.absoluteX, e.absoluteY)),
        ),
      ),
    [],
  );

  // ปุ่มมุมมองแบบ ThaiWellAI: หน้า · ขวา · หลัง · ซ้าย (หันไปมุมนั้น + กลับระดับสายตา/ไม่ซูม)
  const VIEWS = [
    { key: 'front', label: 'หน้า' },
    { key: 'right', label: 'ขวา' },
    { key: 'back', label: 'หลัง' },
    { key: 'left', label: 'ซ้าย' },
  ] as const;
  const [side, setSide] = React.useState<(typeof VIEWS)[number]['key']>('front');
  const turn = (s: (typeof VIEWS)[number]['key']) => {
    setSide(s);
    bodyRef.current?.face(s);
    bodyRef.current?.resetView();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface.canvas }}>
        {/* หัว: ชื่อ + ปิด */}
        <View style={{ paddingTop: insets.top + space[3], paddingHorizontal: space[5], flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="titleLg">{title}</Text>
            <Text variant="bodySm" tone="secondary">
              แตะหรือลากบนตัวเพื่อเลือก ลากที่ว่างเพื่อหมุน
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="ปิด"
            onPress={onClose}
            style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface.default, borderWidth: 1, borderColor: colors.border.subtle }}
          >
            <Icon name="x" />
          </Pressable>
        </View>

        {/* หุ่น + ชั้นรับแตะ/ลาก */}
        <View style={{ flex: 1 }} onLayout={(e) => setStageH(Math.round(e.nativeEvent.layout.height))}>
          {bodyH > 0 ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: (winW - bodyW) / 2, width: bodyW, height: bodyH }}>
              <Body3D ref={bodyRef} interactive={false} width={bodyW} height={bodyH} restAngle={0} pins={[]} marks={Object.values(sel).flat()} />
            </View>
          ) : null}
          {Platform.OS === 'web' ? (
            <View {...web} accessibilityLabel="หุ่นสำหรับเลือกจุดที่ปวด แตะเพื่อเลือก ลากเพื่อหมุน" style={[StyleSheet.absoluteFill, { touchAction: 'none', cursor: 'grab' } as object]} />
          ) : (
            <GestureDetector gesture={gesture}>
              <View accessibilityLabel="หุ่นสำหรับเลือกจุดที่ปวด แตะเพื่อเลือก ลากเพื่อหมุน" style={StyleSheet.absoluteFill} />
            </GestureDetector>
          )}
          {/* ด้านหน้า / ด้านหลัง */}
          <View style={{ position: 'absolute', top: space[2], right: space[5], flexDirection: 'row', padding: 4, gap: 4, borderRadius: radius.full, backgroundColor: colors.surface.default, borderWidth: 1, borderColor: colors.border.subtle }}>
            {VIEWS.map(({ key: s, label }) => (
              <Pressable
                key={s}
                accessibilityRole="button"
                accessibilityLabel={`ดูด้าน${label}`}
                accessibilityState={{ selected: side === s }}
                onPress={() => turn(s)}
                style={{ paddingHorizontal: space[3], height: 32, borderRadius: radius.full, justifyContent: 'center', backgroundColor: side === s ? colors.text.primary : 'transparent' }}
              >
                <Text variant="labelSm" color={side === s ? colors.text.inverse : colors.text.secondary}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* pill + เส้นชี้ไปที่จุด (พิกัดจอ) */}
        {/* iOS: pointerEvents บน Svg ไม่มีผล → Svg เต็มจอจะกินทุกการแตะ ต้องห่อด้วย View ที่ไม่รับแตะ */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg style={StyleSheet.absoluteFill} width={winW} height={winH}>
          {pills.map(({ l, p, left, y }) => {
            const px = left ? space[5] + 120 : winW - space[5] - 120;
            return (
              <React.Fragment key={l}>
                <Line x1={px} y1={y + PILL_H / 2} x2={p.x} y2={p.y} stroke={colors.text.primary} strokeWidth={1.5} />
                <Circle cx={p.x} cy={p.y} r={5} fill={colors.text.primary} stroke="#FFFFFF" strokeWidth={2} />
              </React.Fragment>
            );
          })}
        </Svg>
        </View>
        {pills.map(({ l, left, y }) => (
          <View
            key={l}
            style={{
              position: 'absolute',
              top: y,
              ...(left ? { left: space[5] } : { right: space[5] }),
              width: 120,
              height: PILL_H,
              borderRadius: radius.full,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingLeft: space[3],
              paddingRight: 4,
              backgroundColor: colors.text.primary,
            }}
          >
            <Text variant="labelSm" color={colors.text.inverse} numberOfLines={1} style={{ flex: 1 }}>
              {l}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`เอา ${l} ออก`} onPress={() => remove(l)} hitSlop={6} style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="x" size="xs" color={colors.text.inverse} />
            </Pressable>
          </View>
        ))}

        {/* ยืนยัน */}
        <View style={{ paddingHorizontal: space[5], paddingTop: space[3], paddingBottom: insets.bottom + space[4], gap: space[3], backgroundColor: colors.surface.canvas }}>
          {/* ชื่อจุดอยู่ที่ pill ที่ชี้ออกจากหุ่นแล้ว · ยังไม่เลือก = คำแนะนำ */}
          {suggest ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => pickLimb(suggest)}
              style={({ pressed }) => ({ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: space[1], height: 36, paddingHorizontal: space[4], borderRadius: radius.full, backgroundColor: colors.surface.default, borderWidth: 1, borderColor: colors.border.subtle, opacity: pressed ? 0.7 : 1 })}
            >
              <Icon name="plus" size="xs" />
              <Text variant="labelSm">เลือกทั้ง{suggest.label}</Text>
            </Pressable>
          ) : count ? null : (
            <Text variant="bodySm" tone="secondary" align="center">
              แตะบนหุ่นตรงที่ปวด
            </Text>
          )}
          <Button label={count ? `ยืนยัน ${count} บริเวณ` : 'ยืนยัน'} disabled={!count} onPress={() => onConfirm(sel)} />
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
