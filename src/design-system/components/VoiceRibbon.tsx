import React from 'react';
import { PixelRatio, View, type StyleProp, type ViewStyle } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';

/**
 * VoiceRibbon — ริบบิ้นอนุภาคบอกระดับเสียง (แนว voice assistant): เงียบ = เส้นบางเกือบตรง ขยับนิดเดียว · พูด = ริบบิ้นพลิ้วบิดเป็นคลื่นตามความดัง
 * อนุภาคหลายพันจุดวาดใน vertex shader (expo-gl) · ปลายสองข้างสีทองจาง กลางสีฟ้าอมเขียว · ใช้บนพื้นสว่าง
 * level อ่านจาก ref ทุกเฟรม แล้วไล่เข้าหาค่าเป้าหมายให้นุ่ม (ไม่กระตุกตามไมค์)
 */
const NU = 260;
const NV = 18;

const VERT = `#version 300 es
in vec3 a;
uniform float uTime;
uniform float uAmp;
uniform float uDpr;
out float vA;
out vec3 vC;
void main() {
  float u = a.x, v = a.y, s = a.z;
  float env = pow(sin(3.14159 * u), 1.6);
  float t = uTime;
  float wave = sin(u * 5.5 + t * 1.3) * 0.6 + sin(u * 9.0 - t * 0.9 + 1.7) * 0.4;
  float tw = u * 7.0 + t * 0.8;
  float width = (0.015 + uAmp * 0.30) * env;
  float y = wave * uAmp * env * 0.42 + v * width * cos(tw);
  float depth = v * sin(tw);
  float r1 = fract(sin(s * 91.7) * 43758.5);
  float r2 = fract(sin(s * 17.3) * 12345.6);
  y += (r1 - 0.5) * (0.006 + uAmp * 0.05) * env;
  float x = (u * 2.0 - 1.0) * 0.96 + (r2 - 0.5) * 0.006;
  gl_Position = vec4(x, y * 2.0, 0.0, 1.0);
  gl_PointSize = (1.4 + 2.2 * (0.5 + 0.5 * depth)) * uDpr * (0.55 + env * 0.6) * (0.7 + r2 * 0.6);
  vA = (0.25 + 0.75 * env) * (0.45 + 0.55 * (0.5 + 0.5 * depth)) * (0.6 + 0.4 * r1);
  vec3 edge = vec3(0.86, 0.60, 0.16);
  vec3 mid = vec3(0.02, 0.68, 0.74);
  vec3 deep = vec3(0.10, 0.45, 0.88);
  vC = mix(edge, mix(mid, deep, 0.3 + 0.35 * depth), smoothstep(0.05, 0.55, env));
}
`;

const FRAG = `#version 300 es
precision highp float;
in float vA;
in vec3 vC;
out vec4 o;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.1, d) * vA;
  o = vec4(vC * a, a);
}
`;

export function VoiceRibbon({ level = 0, style }: { /** ระดับเสียง 0–1 */ level?: number; style?: StyleProp<ViewStyle> }) {
  const target = React.useRef(level);
  target.current = level;
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
    // อนุภาค: u = ตำแหน่งตามยาว (0–1) · v = ข้ามความกว้างริบบิ้น (-1–1) · seed
    const pts = new Float32Array(NU * NV * 3);
    let k = 0;
    for (let i = 0; i < NU; i++)
      for (let j = 0; j < NV; j++) {
        pts[k++] = i / (NU - 1);
        pts[k++] = (j / (NV - 1)) * 2 - 1;
        pts[k++] = i * NV + j + 1;
      }
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, pts, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uAmp = gl.getUniformLocation(prog, 'uAmp');
    gl.uniform1f(gl.getUniformLocation(prog, 'uDpr'), PixelRatio.get());

    let amp = 0.04;
    let spd = 0.4;
    let t = 0;
    let last = Date.now();
    const frame = () => {
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const l = Math.max(0, Math.min(1, target.current));
      const e = l * l * (3 - 2 * l);
      // เงียบ = เส้นบางเกือบตรง ขยับช้า · ดัง = คลื่นสูงขึ้น เร็วขึ้น
      const tAmp = 0.04 + e * 0.6;
      const tSpd = 0.4 + e * 1.4;
      const kk = Math.min(1, dt * 8);
      amp += (tAmp - amp) * kk;
      spd += (tSpd - spd) * kk;
      t += dt * spd;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, t);
      gl.uniform1f(uAmp, amp);
      gl.drawArrays(gl.POINTS, 0, NU * NV);
      gl.flush();
      gl.endFrameEXP();
      raf.current = requestAnimationFrame(frame);
    };
    frame();
  };

  return (
    <View style={[{ width: '100%', height: 200 }, style]} pointerEvents="none">
      <GLView style={{ flex: 1, backgroundColor: 'transparent' }} onContextCreate={onContextCreate} />
    </View>
  );
}
