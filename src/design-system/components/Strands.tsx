import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';

/**
 * Strands — เส้นแสงพลิ้ว (พอร์ตจาก React Bits <Strands /> · shader เดิม) วาดด้วย expo-gl แทน ogl/DOM canvas
 * ใช้เป็นตัวบอกระดับเสียง: level 0–1 (จากไมค์) → ความสูงคลื่น · ความสว่าง · ความเร็ว
 * ค่าในแต่ละเฟรมอ่านจาก ref (ไม่ render ใหม่ทั้ง component เมื่อ level เปลี่ยน) และค่อย ๆ ไล่เข้าหาค่าเป้าหมายให้นุ่ม
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
uniform vec3 uColors[${MAX_COLORS}];
uniform int uColorCount;
uniform int uStrandCount;
uniform float uSpeed;
uniform float uAmplitude;
uniform float uWaviness;
uniform float uThickness;
uniform float uGlow;
uniform float uTaper;
uniform float uSpread;
uniform float uIntensity;
uniform float uOpacity;
uniform float uScale;
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
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  uv /= max(uScale, 0.0001);
  float e = 0.06 + uIntensity * 0.94;
  float env = pow(max(cos(uv.x * PI * 1.3), 0.0), uTaper);
  vec3 col = vec3(0.0);
  for (int i = 0; i < ${MAX_STRANDS}; i++) {
    if (i >= uStrandCount) break;
    float fi = float(i);
    float ph = fi * 1.7 * uSpread;
    float freq = (2.0 + fi * 0.35) * uWaviness;
    float spd = 1.4 + fi * 1.2;
    float tt = uTime * uSpeed;
    float w = sin(uv.x * freq + tt * spd + ph) * 0.60
            + sin(uv.x * freq * 1.1 - tt * spd * 0.7 + ph * 1.7) * 0.40;
    float amp = (0.1 + 0.02 * e) * env * uAmplitude;
    float y = w * amp;
    float d = abs(uv.y - y);
    float thick = (0.001 + 0.05 * e) * (0.35 + env) * uThickness;
    float g = thick / (d + thick * 0.45);
    g = g * g;
    float h = fi / float(uStrandCount) + uv.x * 0.30 + uTime * 0.04;
    col += samplePalette(h) * g * env;
  }
  col *= 0.45 + 0.7 * e;
  // จางก่อนถึงขอบบน/ล่างของพื้นที่วาด (ไม่ให้เห็นเป็นกรอบสี่เหลี่ยม)
  col *= smoothstep(0.5, 0.22, abs((gl_FragCoord.y / uResolution.y) - 0.5));
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
  active = true,
  colors = ['#5FF0B8', '#22D3EE', '#3B82F6', '#8B5CF6'],
  count = 4,
  scale = 1.6,
  style,
}: {
  /** ซูม: มาก = เส้นยาวเต็มความกว้าง */
  scale?: number;
  /** ระดับเสียง 0–1 (ไมค์ / เสียงผู้ช่วย) */
  level?: number;
  /** false = นิ่งเบา ๆ (ไม่ได้ฟัง/พูด) */
  active?: boolean;
  colors?: string[];
  count?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const target = React.useRef({ level, active });
  target.current = { level, active };
  const raf = React.useRef<number | null>(null);
  React.useEffect(
    () => () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    },
    [],
  );

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
    gl.uniform1f(u('uWaviness'), 1);
    gl.uniform1f(u('uThickness'), 1);
    gl.uniform1f(u('uGlow'), 3);
    gl.uniform1f(u('uTaper'), 2.2);
    gl.uniform1f(u('uSpread'), 1);
    gl.uniform1f(u('uOpacity'), 1);
    gl.uniform1f(u('uScale'), scale);
    gl.uniform1f(u('uSaturation'), 1.4);
    const uTime = u('uTime');
    const uAmp = u('uAmplitude');
    const uInt = u('uIntensity');
    const uSpeed = u('uSpeed');

    // ค่าที่ไล่ตามเป้าหมาย (นุ่ม ไม่กระตุกตามไมค์)
    let amp = 0.2;
    let inten = 0.25;
    let spd = 0.3;
    let t = 0;
    let last = Date.now();
    const frame = () => {
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { level: lv, active: on } = target.current;
      const l = on ? Math.max(0, Math.min(1, lv)) : 0;
      // เงียบ = เส้นเกือบตรง ขยับนิดเดียวพอให้รู้ว่ามีชีวิต · เสียงดัง = คลื่นสูง สว่าง เร็ว (ไม่ฟัง/ไม่พูด = แบบเงียบ)
      const e = l * l * (3 - 2 * l); // ค่อย ๆ ขึ้นช่วงเสียงเบา แล้วชัดขึ้นเมื่อพูดจริง
      const tAmp = 0.12 + e * 1.8;
      const tInt = 0.3 + e * 0.7;
      const tSpd = 0.12 + e * 1.4;
      const k = Math.min(1, dt * 10);
      amp += (tAmp - amp) * k;
      inten += (tInt - inten) * k;
      spd += (tSpd - spd) * k;
      t += dt * spd;
      gl.clear(gl.COLOR_BUFFER_BIT);
      // uSpeed = 1 แล้วสะสมเวลาเอง → เปลี่ยนความเร็วแล้วคลื่นไม่กระโดด
      gl.uniform1f(uTime, t);
      gl.uniform1f(uSpeed, 1);
      gl.uniform1f(uAmp, amp);
      gl.uniform1f(uInt, inten);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.flush();
      gl.endFrameEXP();
      raf.current = requestAnimationFrame(frame);
    };
    frame();
  };

  return (
    <View style={[{ width: '100%', height: 140 }, style]} pointerEvents="none">
      <GLView style={{ flex: 1, backgroundColor: 'transparent' }} onContextCreate={onContextCreate} />
    </View>
  );
}
