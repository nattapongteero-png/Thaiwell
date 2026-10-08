import React from 'react';
import { Image, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';
import { BODY_ICON_IMAGES } from './bodyIconImages';
import type { BodyPin } from './Body3D';

/**
 * BodyIcon — ไอคอนหุ่นจิ๋ว ระบายบริเวณที่ปวด (สีตามระดับปวด) · ซูมเข้าส่วนของร่างกายที่เกี่ยวข้อง
 * ใช้แทนจุดสีในป้าย/แถวที่บอกบริเวณ (คอ-บ่า หลังส่วนล่าง เข่าซ้าย …) ให้เห็นทันทีว่าตรงไหนของร่างกาย
 * ซ้าย/ขวา = ของผู้ป่วยแบบเดียวกับหุ่น 3D: มุมหน้า ขวาของผู้ป่วยอยู่ซ้ายภาพ · มุมหลัง (มีเส้นกระดูกสันหลัง) ขวาของผู้ป่วยอยู่ขวาภาพ
 */
type Shape = { c: [number, number, number] } | { e: [number, number, number, number] } | { r: [number, number, number, number] };
type Spec = { shapes: (back: boolean) => Shape[]; top: number; back?: boolean };

/** x ของฝั่งผู้ป่วย: front ขวา = ซ้ายภาพ · back ขวา = ขวาภาพ */
const sx = (side: 'L' | 'R', back: boolean, left: number, right: number) => ((side === 'R') !== back ? left : right);
const pair = (side: 'L' | 'R', mk: (x: number) => Shape, l: number, r: number) => (back: boolean) => [mk(sx(side, back, l, r))];

const HEAD: Spec = { shapes: () => [{ c: [12, 4.6, 3.2] }], top: 0 };
const SPEC: Partial<Record<BodyPin, Spec>> = {
  head: HEAD,
  templeLeft: HEAD,
  templeRight: HEAD,
  occiputLeft: { ...HEAD, back: true },
  occiputRight: { ...HEAD, back: true },
  noseLeft: HEAD,
  eyeLeft: HEAD,
  eyeRight: HEAD,
  jaw: HEAD,
  neck: { shapes: () => [{ r: [10.6, 6.9, 2.8, 2.8] }], top: 0 },
  neckBack: { shapes: () => [{ r: [10.6, 6.9, 2.8, 2.8] }], top: 0, back: true },
  trapLeft: { shapes: pair('L', (x) => ({ e: [x, 9.6, 3, 1.8] }), 9, 15), top: 0, back: true },
  trapRight: { shapes: pair('R', (x) => ({ e: [x, 9.6, 3, 1.8] }), 9, 15), top: 0, back: true },
  shoulderLeft: { shapes: pair('L', (x) => ({ c: [x, 10.4, 2.2] }), 7, 17), top: 0 },
  shoulderRight: { shapes: pair('R', (x) => ({ c: [x, 10.4, 2.2] }), 7, 17), top: 0 },
  clavicleLeft: { shapes: pair('L', (x) => ({ e: [x, 10, 2.4, 0.9] }), 9.4, 14.6), top: 0 },
  clavicleRight: { shapes: pair('R', (x) => ({ e: [x, 10, 2.4, 0.9] }), 9.4, 14.6), top: 0 },
  chest: { shapes: () => [{ r: [7, 10, 10, 3.6] }], top: 2 },
  back: { shapes: () => [{ r: [7, 10, 10, 4.6] }], top: 2, back: true },
  scapulaLeft: { shapes: pair('L', (x) => ({ e: [x, 12, 2, 1.8] }), 9.4, 14.6), top: 2, back: true },
  scapulaRight: { shapes: pair('R', (x) => ({ e: [x, 12, 2, 1.8] }), 9.4, 14.6), top: 2, back: true },
  ribLeft: { shapes: pair('L', (x) => ({ e: [x, 14.6, 1.8, 1.8] }), 8.4, 15.6), top: 5 },
  ribRight: { shapes: pair('R', (x) => ({ e: [x, 14.6, 1.8, 1.8] }), 8.4, 15.6), top: 5 },
  belly: { shapes: () => [{ e: [12, 16.4, 3.6, 2.6] }], top: 5 },
  lowerBack: { shapes: () => [{ r: [7, 15.2, 10, 4.4] }], top: 5, back: true },
  hipLeft: { shapes: pair('L', (x) => ({ c: [x, 19.4, 2.2] }), 9.4, 14.6), top: 8 },
  hipRight: { shapes: pair('R', (x) => ({ c: [x, 19.4, 2.2] }), 9.4, 14.6), top: 8 },
  armLeft: { shapes: pair('L', (x) => ({ e: [x, 12.6, 1.6, 2.8] }), 5.2, 18.8), top: 2 },
  armRight: { shapes: pair('R', (x) => ({ e: [x, 12.6, 1.6, 2.8] }), 5.2, 18.8), top: 2 },
  elbowLeft: { shapes: pair('L', (x) => ({ c: [x, 15, 1.7] }), 4.9, 19.1), top: 5 },
  elbowRight: { shapes: pair('R', (x) => ({ c: [x, 15, 1.7] }), 4.9, 19.1), top: 5 },
  wristLeft: { shapes: pair('L', (x) => ({ c: [x, 18.4, 1.6] }), 4.4, 19.6), top: 8 },
  wristRight: { shapes: pair('R', (x) => ({ c: [x, 18.4, 1.6] }), 4.4, 19.6), top: 8 },
  handLeft: { shapes: pair('L', (x) => ({ c: [x, 19.6, 1.8] }), 4.2, 19.8), top: 8 },
  handRight: { shapes: pair('R', (x) => ({ c: [x, 19.6, 1.8] }), 4.2, 19.8), top: 8 },
  thighLeft: { shapes: pair('L', (x) => ({ r: [x - 1.7, 20, 3.4, 4] }), 9.75, 14.25), top: 12 },
  thighRight: { shapes: pair('R', (x) => ({ r: [x - 1.7, 20, 3.4, 4] }), 9.75, 14.25), top: 12 },
  thighBackLeft: { shapes: pair('L', (x) => ({ r: [x - 1.7, 20, 3.4, 4] }), 9.75, 14.25), top: 12, back: true },
  thighBackRight: { shapes: pair('R', (x) => ({ r: [x - 1.7, 20, 3.4, 4] }), 9.75, 14.25), top: 12, back: true },
  kneeLeft: { shapes: pair('L', (x) => ({ c: [x, 25, 2] }), 9.75, 14.25), top: 12 },
  kneeRight: { shapes: pair('R', (x) => ({ c: [x, 25, 2] }), 9.75, 14.25), top: 12 },
  kneeBackLeft: { shapes: pair('L', (x) => ({ c: [x, 25, 2] }), 9.75, 14.25), top: 12, back: true },
  kneeBackRight: { shapes: pair('R', (x) => ({ c: [x, 25, 2] }), 9.75, 14.25), top: 12, back: true },
  shinLeft: { shapes: pair('L', (x) => ({ r: [x - 1.7, 26.2, 3.4, 3] }), 9.75, 14.25), top: 12 },
  shinRight: { shapes: pair('R', (x) => ({ r: [x - 1.7, 26.2, 3.4, 3] }), 9.75, 14.25), top: 12 },
  calfLeft: { shapes: pair('L', (x) => ({ r: [x - 1.7, 26.2, 3.4, 3] }), 9.75, 14.25), top: 12, back: true },
  calfRight: { shapes: pair('R', (x) => ({ r: [x - 1.7, 26.2, 3.4, 3] }), 9.75, 14.25), top: 12, back: true },
  ankleLeft: { shapes: pair('L', (x) => ({ c: [x, 29.4, 1.6] }), 9.75, 14.25), top: 12 },
  ankleRight: { shapes: pair('R', (x) => ({ c: [x, 29.4, 1.6] }), 9.75, 14.25), top: 12 },
  heelLeft: { shapes: pair('L', (x) => ({ c: [x, 30.2, 1.6] }), 9.75, 14.25), top: 12, back: true },
  heelRight: { shapes: pair('R', (x) => ({ c: [x, 30.2, 1.6] }), 9.75, 14.25), top: 12, back: true },
  footLeft: { shapes: pair('L', (x) => ({ c: [x, 30.4, 1.8] }), 9.75, 14.25), top: 12 },
  footRight: { shapes: pair('R', (x) => ({ c: [x, 30.4, 1.8] }), 9.75, 14.25), top: 12 },
};

const BODY_FILL = '#B8C4D3';

function Silhouette({ fill }: { fill: string }) {
  return (
    <G fill={fill}>
      <Circle cx={12} cy={4.6} r={3.1} />
      <Rect x={10.8} y={7} width={2.4} height={2.6} />
      <Path d="M6.6 9.6 Q12 8.4 17.4 9.6 L16.4 19.4 Q12 20.4 7.6 19.4 Z" />
      <Rect x={4.5} y={9.9} width={2.3} height={9.8} rx={1.15} transform="rotate(9 5.65 9.9)" />
      <Rect x={17.2} y={9.9} width={2.3} height={9.8} rx={1.15} transform="rotate(-9 18.35 9.9)" />
      <Rect x={8.1} y={19} width={3.3} height={11.6} rx={1.65} />
      <Rect x={12.6} y={19} width={3.3} height={11.6} rx={1.65} />
    </G>
  );
}

/** กรอบของรูปที่ระบาย (x1, y1, x2, y2) */
const boundsOf = (sh: Shape): [number, number, number, number] =>
  'c' in sh ? [sh.c[0] - sh.c[2], sh.c[1] - sh.c[2], sh.c[0] + sh.c[2], sh.c[1] + sh.c[2]] : 'e' in sh ? [sh.e[0] - sh.e[2], sh.e[1] - sh.e[3], sh.e[0] + sh.e[2], sh.e[1] + sh.e[3]] : [sh.r[0], sh.r[1], sh.r[0] + sh.r[2], sh.r[1] + sh.r[3]];

/**
 * ไอคอนวงกลม: พื้นวงกลมสีจางตามสีที่ระบาย · หุ่นถูกตัดเป็นวงกลม · ซูมเข้าบริเวณที่ปวด (เห็นส่วนรอบ ๆ พอให้รู้ว่าตรงไหนของร่างกาย)
 */
export function BodyIconSvg({ pins, color, size = 24, bodyColor = BODY_FILL }: { pins: (BodyPin | undefined)[]; color: string; size?: number; bodyColor?: string }) {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const specs = pins.map((p) => (p ? SPEC[p] : undefined)).filter((x): x is Spec => !!x);
  // มุมหลัง = ทุกบริเวณอยู่ด้านหลัง · ปนกัน = มุมหน้า
  const back = specs.length > 0 && specs.every((s) => s.back);
  const shapes = specs.flatMap((s) => s.shapes(back));
  // ซูมเข้าบริเวณที่ระบาย: กลางกรอบของทุกบริเวณ · ขนาดอย่างน้อย 16 หน่วย (ไม่มีบริเวณ = ทั้งตัว)
  const b = shapes.map(boundsOf);
  const x1 = b.length ? Math.min(...b.map((v) => v[0])) : 0;
  const y1 = b.length ? Math.min(...b.map((v) => v[1])) : 0;
  const x2 = b.length ? Math.max(...b.map((v) => v[2])) : 24;
  const y2 = b.length ? Math.max(...b.map((v) => v[3])) : 32;
  const S = b.length ? Math.max(16, Math.max(x2 - x1, y2 - y1) + 8) : 32;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const vx = cx - S / 2;
  const vy = cy - S / 2;
  return (
    <Svg width={size} height={size} viewBox={`${vx} ${vy} ${S} ${S}`}>
      <Defs>
        <ClipPath id={`o${id}`}>
          <Circle cx={cx} cy={cy} r={S / 2} />
        </ClipPath>
        <ClipPath id={`b${id}`}>
          <Silhouette fill="#000" />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#o${id})`}>
        {/* พื้นวงกลม: ขาว + สีที่ระบายแบบจาง */}
        <Circle cx={cx} cy={cy} r={S / 2} fill="#FFFFFF" />
        <Circle cx={cx} cy={cy} r={S / 2} fill={color} fillOpacity={0.14} />
        <Silhouette fill={bodyColor} />
        <G fill={color} clipPath={`url(#b${id})`}>
          {shapes.map((sh, i) =>
            'c' in sh ? <Circle key={i} cx={sh.c[0]} cy={sh.c[1]} r={sh.c[2]} /> : 'e' in sh ? <Ellipse key={i} cx={sh.e[0]} cy={sh.e[1]} rx={sh.e[2]} ry={sh.e[3]} /> : <Rect key={i} x={sh.r[0]} y={sh.r[1]} width={sh.r[2]} height={sh.r[3]} />,
          )}
        </G>
        {back ? <Path d="M12 9.4 V18.6" stroke="#FFFFFF" strokeWidth={0.5} opacity={0.9} /> : null}
      </G>
    </Svg>
  );
}

/** สีจาง (พื้นวงกลม) จาก rgb()/hex */
const soft = (c: string, a: number) => (c.startsWith('rgb(') ? c.replace('rgb(', 'rgba(').replace(')', `,${a})`) : c.startsWith('#') && c.length === 7 ? `${c}${Math.round(a * 255).toString(16).padStart(2, '0')}` : c);

/**
 * BodyIcon — รูปหุ่น 3D จริงซูมเข้าจุดที่ปวด ในวงกลม · บริเวณที่ปวดระบายสีตามระดับปวด (mask + tintColor)
 * หลายบริเวณ = ใช้บริเวณแรก (บริเวณหลัก) · ไม่มีรูปของจุดนั้น = ไอคอนหุ่นวาด (BodyIconSvg)
 */
export function BodyIcon({ pins, color, size = 24 }: { pins: (BodyPin | undefined)[]; color: string; size?: number }) {
  const pin = pins.find((p): p is BodyPin => !!p && !!BODY_ICON_IMAGES[p]);
  if (!pin) return <BodyIconSvg pins={pins} color={color} size={size} />;
  const img = BODY_ICON_IMAGES[pin];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: soft(color, 0.14) }}>
      <Image source={img.base} style={{ width: size, height: size }} />
      <Image source={img.mask} style={{ position: 'absolute', left: 0, top: 0, width: size, height: size, tintColor: color, opacity: 0.88 }} />
    </View>
  );
}
