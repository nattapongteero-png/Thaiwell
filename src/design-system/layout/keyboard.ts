import React from 'react';
import { Keyboard, Platform, TextInput, type ScrollView } from 'react-native';

/**
 * ความสูงคีย์บอร์ดที่บังจออยู่ (px) — 0 = ไม่มีคีย์บอร์ด
 * iOS/Android: เหตุการณ์ของคีย์บอร์ด · เว็บบนมือถือ: visualViewport หดลงเท่าคีย์บอร์ด
 */
export function useKeyboardHeight() {
  const [h, setH] = React.useState(0);
  React.useEffect(() => {
    if (Platform.OS === 'web') {
      const vv = typeof window !== 'undefined' ? window.visualViewport : null;
      if (!vv) return;
      const on = () => {
        const kb = Math.round(window.innerHeight - vv.height - vv.offsetTop);
        setH(kb > 80 ? kb : 0);
      };
      vv.addEventListener('resize', on);
      vv.addEventListener('scroll', on);
      return () => {
        vv.removeEventListener('resize', on);
        vv.removeEventListener('scroll', on);
      };
    }
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setH(e.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setH(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return h;
}

/** ระยะเผื่อเหนือคีย์บอร์ด/ใต้หัว เวลาเลื่อนช่องที่พิมพ์ให้เห็น */
const MARGIN = 24;

/**
 * คีย์บอร์ดขึ้น / เปลี่ยนช่องที่พิมพ์ → เลื่อน ScrollView ให้ช่องนั้นอยู่ในส่วนที่มองเห็น (ไม่ถูกคีย์บอร์ด/ปุ่มด้านล่างบัง)
 * คืน onScroll ไว้ติดที่ ScrollView (จำตำแหน่งเลื่อนปัจจุบัน)
 */
export function useKeepFocusedVisible(scrollRef: React.RefObject<ScrollView | null>, keyboard: number) {
  const offset = React.useRef(0);
  React.useEffect(() => {
    if (!keyboard) return;
    let last: unknown = null;
    const check = () => {
      if (Platform.OS === 'web') {
        const el = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
        if (!el || el === last || !/^(INPUT|TEXTAREA)$/.test(el.tagName)) return;
        last = el;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
      const input = TextInput.State.currentlyFocusedInput() as unknown as { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void } | null;
      const sv = scrollRef.current as unknown as { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void; scrollTo: ScrollView['scrollTo'] } | null;
      if (!input?.measureInWindow || !sv?.measureInWindow || input === last) return;
      last = input;
      input.measureInWindow((_x, y, _w, h) =>
        sv.measureInWindow!((_sx, sy, _sw, sh) => {
          const top = sy + MARGIN;
          const bottom = sy + sh - MARGIN;
          if (y + h > bottom) sv.scrollTo({ y: offset.current + (y + h - bottom), animated: true });
          else if (y < top) sv.scrollTo({ y: Math.max(0, offset.current - (top - y)), animated: true });
        }),
      );
    };
    // รอให้หน้าหดตามคีย์บอร์ดก่อน แล้วตรวจต่อเนื่อง (กดไปช่องถัดไประหว่างคีย์บอร์ดยังขึ้นอยู่)
    const t = setTimeout(check, 280);
    const id = setInterval(check, 300);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, [keyboard, scrollRef]);
  return React.useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    offset.current = e.nativeEvent.contentOffset.y;
  }, []);
}
