/**
 * Polyfill สำหรับ Hermes (iOS/Android) — บนเว็บมีของจริงอยู่แล้ว จึงไม่ถูกแทน
 * - performance.mark/measure/clearMarks/clearMeasures: reconciler ของ @react-three/fiber (React 19 โหมด dev) เรียกใช้
 * - navigator.userAgent: GLTFLoader ของ three ใช้ตรวจ Safari/Firefox (ใน RN เป็น undefined → โหลดหุ่น 3D ไม่ได้)
 */
const perf = globalThis.performance as unknown as Record<string, unknown> | undefined;
if (perf) {
  for (const k of ['mark', 'measure', 'clearMarks', 'clearMeasures']) {
    if (typeof perf[k] !== 'function') perf[k] = () => undefined;
  }
}

const nav = (globalThis as unknown as { navigator?: Record<string, unknown> }).navigator;
if (nav && typeof nav.userAgent !== 'string') {
  try {
    nav.userAgent = 'ReactNative';
  } catch {
    Object.defineProperty(nav, 'userAgent', { value: 'ReactNative', configurable: true });
  }
}

export {};

