import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';

/**
 * Strands — เส้นแสงพลิ้ว (พอร์ตจาก React Bits <Strands /> · shader เดิม) วาดด้วย expo-gl
 * ใช้เป็นตัวบอกระดับเสียง: level 0–1 → ความสูงคลื่น · ความสว่าง · ความเร็ว
 * level ส่งเป็น ref ได้ (อ่านทุกเฟรม ไม่ต้อง render ใหม่) · ไล่เข้าหาค่าเป้าหมายเร็ว ๆ ให้ตามเสียงทันแต่ไม่กระตุก
 * พื้นที่วาดยืดเต็มกรอบ: span.x = ช่วงแนวนอนของ shader (เส้นจางที่ปลาย) · span.y = ช่วงแนวตั้ง (คลื่นดังสุดเกือบเต็มความสูง)
 * running = false → หยุดวาด (ยัง mount ไว้ เปิดครั้งถัดไปไม่ต้องสร้าง GL ใหม่ = ไม่กระตุก)
 */
const MAX_STRANDS = 12;
const MAX_COLORS = 8;

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uSpan;
uniform vec3 uColors[${MAX_COLORS}];
uniform int uColorCount;
uniform int uStrandCount;
uniform float uAmplitude;
uniform float uWaviness;
uniform float uThickness;
uniform float uGlow;
uniform float uTaper;
uniform float uSpread;
uniform float uIntensity;
uniform float uOpacity;
uniform float uSaturation;
out vec4 fragColor;
const float PI = 3.14159265;

vec3 samplePalette(float t) {
  t = fract(t);
  float scaled = t * float(uColorCount);
  int idx = int(floor(scaled));
  float blend = fract(scaled);
  int nextIdx = idx + 1;
  if (nextIdx >= uColorCount) nextIdx = 0;
  return mix(uColors[idx], uColors[nextIdx], blend);
}

void main() {
  vec2 uv = (gl_FragCoord.xy / uResolution - 0.5) * uSpan;
  float e = 0.06 + uIntensity * 0.94;
  float env = pow(max(cos(uv.x * PI * 1.3), 0.0), uTaper);
  vec3 col = vec3(0.0);
  for (int i = 0; i < ${MAX_STRANDS}; i++) {
    if (i >= uStrandCount) break;
    float fi = float(i);
    float ph = fi * 1.7 * uSpread;
    float freq = (2.0 + fi * 0.35) * uWaviness;
    float spd = 1.4 + fi * 1.2;
    float w = sin(uv.x * freq + uTime * spd + ph) * 0.60
            + sin(uv.x * freq * 1.1 - uTime * spd * 0.7 + ph * 1.7) * 0.40;
    float amp = (0.1 + 0.02 * e) * env * uAmplitude;
    float d = abs(uv.y - w * amp);
    float thick = (0.001 + 0.05 * e) * (0.35 + env) * uThickness;
    float g = thick / (d + thick * 0.45);
    g = g * g;
    float h = fi / float(uStrandCount) + uv.x * 0.30 + uTime * 0.04;
    col += samplePalette(h) * g * env;
  }
  col *= 0.45 + 0.7 * e;
  // จางก่อนถึงขอบบน/ล่าง (ไม่ให้เห็นเป็นกรอบสี่เหลี่ยม)
  col *= smoothstep(0.5, 0.3, abs(gl_FragCoord.y / uResolution.y - 0.5));
  col = 1.0 - exp(-col * uGlow);
  float gray = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = max(mix(vec3(gray), col, uSaturation), 0.0);
  float lum = max(max(col.r, col.g), col.b);
  float alpha = clamp(lum, 0.0, 1.0) * uOpacity;
  fragColor = vec4(col * uOpacity, alpha);
}
`;

const hexToRgb = (hex: string) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export function Strands({
  level = 0,
  running = true,
  colors = ['#5FF0B8', '#22D3EE', '#3B82F6', '#8B5CF6'],
  count = 4,
  span = { x: 0.76, y: 0.5 },
  style,
}: {
  /** ระดับเสียง 0–1 (ตัวเลข หรือ ref) */
  level?: number | { current: number };
  /** false = หยุดวาด (ซ่อนอยู่) */
  running?: boolean;
  colors?: string[];
  count?: number;
  span?: { x: number; y: number };
  style?: StyleProp<ViewStyle>;
}) {
  const target = React.useRef({ level, running });
  target.current = { level, running };
  const raf = React.useRef<number | null>(null);
  const kick = React.useRef<(() => void) | null>(null);
  React.useEffect(
    () => () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      kick.current = null;
    },
    [],
  );
  // เปิดวาดต่อเมื่อกลับมาแสดง
  React.useEffect(() => {
    if (running) kick.current?.();
  }, [running]);

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    // สามเหลี่ยมใหญ่คลุมทั้งจอ (แบบ ogl Triangle)
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    const u = (n: string) => gl.getUniformLocation(prog, n);
    const pal: number[] = [];
    for (let i = 0; i < MAX_COLORS; i++) pal.push(...hexToRgb(colors[Math.min(i, colors.length - 1)]));
    gl.uniform3fv(u('uColors'), new Float32Array(pal));
    gl.uniform1i(u('uColorCount'), Math.min(colors.length, MAX_COLORS));
    gl.uniform1i(u('uStrandCount'), Math.min(count, MAX_STRANDS));
    gl.uniform2f(u('uResolution'), gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform2f(u('uSpan'), span.x, span.y);
    gl.uniform1f(u('uWaviness'), 1);
    gl.uniform1f(u('uThickness'), 0.7);
    gl.uniform1f(u('uGlow'), 1.6); // ต่ำกว่าต้นฉบับ: บนพื้นสว่างแกนเส้นไม่กลายเป็นสีขาวจนมองไม่เห็น
    gl.uniform1f(u('uTaper'), 2.2);
    gl.uniform1f(u('uSpread'), 1);
    gl.uniform1f(u('uOpacity'), 1);
    gl.uniform1f(u('uSaturation'), 1.4);
    const uTime = u('uTime');
    const uAmp = u('uAmplitude');
    const uInt = u('uIntensity');

    // ค่าที่ไล่ตามเป้าหมาย: ขึ้นเร็ว (ตามเสียงทัน) ลงช้ากว่าเล็กน้อย (ไม่วูบ)
    let amp = 0.12;
    let inten = 0.3;
    let spd = 0.12;
    let t = 0;
    let last = Date.now();
    const frame = () => {
      raf.current = null;
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { level: lv, running: on } = target.current;
      const l = Math.max(0, Math.min(1, typeof lv === 'number' ? lv : lv.current));
      // เงียบ = เส้นเกือบตรง ขยับนิดเดียว · เสียงดัง = คลื่นสูง สว่าง เร็ว
      const tAmp = 0.12 + l * 1.7;
      const tInt = 0.3 + l * 0.7;
      const tSpd = 0.25 + l * 2.2;
      const k = Math.min(1, dt * (tAmp > amp ? 18 : 7));
      amp += (tAmp - amp) * k;
      inten += (tInt - inten) * k;
      spd += (tSpd - spd) * Math.min(1, dt * 6);
      t += dt * spd;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, t);
      gl.uniform1f(uAmp, amp);
      gl.uniform1f(uInt, inten);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.flush();
      gl.endFrameEXP();
      if (on) raf.current = requestAnimationFrame(frame);
    };
    kick.current = () => {
      if (raf.current === null) {
        last = Date.now();
        raf.current = requestAnimationFrame(frame);
      }
    };
    frame();
  };

  return (
    <View style={[{ width: '100%', height: 140 }, style]} pointerEvents="none">
      <GLView style={{ flex: 1, backgroundColor: 'transparent' }} onContextCreate={onContextCreate} />
    </View>
  );
}
