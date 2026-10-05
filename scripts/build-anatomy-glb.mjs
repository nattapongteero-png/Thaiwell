/**
 * สร้าง assets/models/anatomy_male.glb จากข้อมูล human-atlas (BodyParts3D 4.0, CC BY 4.0)
 *
 *   git clone --depth 1 https://github.com/ashemag/human-atlas.git /tmp/human-atlas
 *   node scripts/build-anatomy-glb.mjs /tmp/human-atlas
 *
 * ผิวหนังอย่างเดียว (ไม่เอาผม/ขน) · บริเวณเป้ากดให้เรียบแบบหุ่นจำลอง · normal แบบ int16 (KHR_mesh_quantization)
 * (ถ้าจะเพิ่มกายวิภาคชั้นใน ใส่ชิ้นลงใน PARTS ได้ · keep < 1 = ลดสามเหลี่ยมด้วย meshoptimizer)
 * พิกัดคงตามต้นฉบับ: เมตร · Y ขึ้น · หน้าไป +z · +x = ซ้ายของผู้ป่วย
 * ชื่อ node = รหัส BodyParts3D (เช่น FJ1521M) · ชื่ออังกฤษเก็บใน extras.name
 */
import fs from 'node:fs';
import path from 'node:path';
import { MeshoptSimplifier } from 'meshoptimizer';

await MeshoptSimplifier.ready;

const src = process.argv[2];
if (!src) {
  console.error('usage: node scripts/build-anatomy-glb.mjs <path-to-human-atlas>');
  process.exit(1);
}
const modelsDir = path.join(src, 'public/models');
const atlas = JSON.parse(fs.readFileSync(path.join(modelsDir, 'atlas.json'), 'utf8'));

/** ผิวหนัง (ไม่เอาผม/ขนคิ้ว/ขนเพชร ให้ดูเป็นหุ่นเรียบ ๆ) */
const SKIN = ['FJ2810', 'FJ2814'];
/** หุ่นผิวหนังอย่างเดียว (ไม่ใส่กล้ามเนื้อ/กระดูก) — จุดปวด/จุดรักษาระบายสีลงบนผิวโดยตรง */
const PARTS = SKIN.map((id) => ({ id, keep: 1 }));
const FOCUS = new Set();

/**
 * บริเวณอวัยวะเพศ → กดให้แบนลงบนผิวโค้งเรียบแบบหุ่นจำลอง (ไม่ต้องใช้กางเกง)
 * ผิวโค้ง: z = zBottom + (zTop - zBottom) * sqrt(smoothstep((y - yBottom) / (yTop - yBottom)))
 * ผลเต็มที่ช่วง |x| < inner แล้วค่อย ๆ หมดที่ |x| = outer
 * ⚠️ ค่าชุดเดียวกันใช้ใน shader ของ Body3D.tsx (GROIN) เพื่อแรเงาบริเวณนี้ตามผิวเรียบ
 */
const GROIN = { yBottom: 0.745, yTop: 0.915, zBottom: 0.006, zTop: 0.09, inner: 0.045, outer: 0.075 };
const smooth01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
function flattenGroin(pos) {
  for (let v = 0; v < pos.length / 3; v++) {
    const [x, y, z] = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
    if (y < GROIN.yBottom - 0.015 || y > GROIN.yTop || z <= 0) continue;
    const target = GROIN.zBottom + (GROIN.zTop - GROIN.zBottom) * Math.sqrt(smooth01((y - GROIN.yBottom) / (GROIN.yTop - GROIN.yBottom)));
    const w = 1 - smooth01((Math.abs(x) - GROIN.inner) / (GROIN.outer - GROIN.inner));
    if (w > 0 && z > target) pos[v * 3 + 2] = z - w * (z - target);
  }
}

const byId = new Map(atlas.parts.map((p) => [p.id, p]));
const chunkCache = new Map();
const chunk = (i) => {
  if (!chunkCache.has(i)) {
    const buf = fs.readFileSync(path.join(modelsDir, path.basename(atlas.chunks[i].url)));
    chunkCache.set(i, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  }
  return chunkCache.get(i);
};

const bufferParts = [];
let byteLength = 0;
const bufferViews = [];
const accessors = [];
const meshes = [];
const nodes = [];

/** ต่อข้อมูลเข้า buffer (จัด alignment 4 ไบต์) แล้วคืน index ของ bufferView */
function addView(typed, target) {
  const pad = (4 - (byteLength % 4)) % 4;
  if (pad) {
    bufferParts.push(new Uint8Array(pad));
    byteLength += pad;
  }
  const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
  bufferParts.push(bytes);
  bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: bytes.byteLength, target });
  byteLength += bytes.byteLength;
  return bufferViews.length - 1;
}

let triangles = 0;
const buckets = new Map();
for (const { id, keep } of PARTS) {
  const p = byId.get(id);
  if (!p) throw new Error(`missing part ${id}`);
  const buf = chunk(p.chunk);
  let srcPos = new Float32Array(buf, p.positions, p.vertexCount * 3);
  const srcNrm = new Int16Array(buf, p.normals, p.vertexCount * 3);
  let idx32 = new Uint32Array(buf, p.indices, p.indexCount);
  let nrmSrc = srcNrm;
  if (id === 'FJ2810') {
    srcPos = srcPos.slice();
    flattenGroin(srcPos);
  }
  if (keep < 1) {
    // รวมจุดที่ตำแหน่งเดียวกัน (ต้นฉบับแยกจุดตาม normal) ไม่งั้นตัวลดมองเป็นขอบและไม่ยอมยุบ
    const weld = new Map();
    const canon = new Uint32Array(p.vertexCount);
    for (let v = 0; v < p.vertexCount; v++) {
      const key = `${Math.round(srcPos[v * 3] * 1e5)},${Math.round(srcPos[v * 3 + 1] * 1e5)},${Math.round(srcPos[v * 3 + 2] * 1e5)}`;
      if (!weld.has(key)) weld.set(key, v);
      canon[v] = weld.get(key);
    }
    idx32 = idx32.map((v) => canon[v]);
    // ลดสามเหลี่ยม — ยอมคลาดเคลื่อนได้ 4% ของขนาดชิ้น (มองจากระยะไกลบนจอมือถือ แทบไม่ต่าง)
    const target = Math.max(12, Math.floor((idx32.length * keep) / 3) * 3);
    let [simplified] = MeshoptSimplifier.simplify(idx32, srcPos, 3, target, 0.04);
    // ชิ้นที่โครงสร้างซับซ้อน (เช่น กล้ามเนื้อหลายมัดย่อย) ลดแบบปกติไม่ลง → ใช้แบบ sloppy แทน
    if (simplified.length > target * 1.3) [simplified] = MeshoptSimplifier.simplifySloppy(idx32, srcPos, 3, null, target, 0.04);
    if (simplified.length >= 3) idx32 = simplified;
  }
  // เก็บเฉพาะจุดที่ยังถูกใช้
  const remap = new Int32Array(p.vertexCount).fill(-1);
  let count = 0;
  for (const v of idx32) if (remap[v] < 0) remap[v] = count++;
  const pos = new Float32Array(count * 3);
  // normal แบบ int16 normalized (KHR_mesh_quantization) — 4 ช่องเพื่อให้ stride ลง 4 ไบต์พอดี
  const nrm = new Int16Array(count * 4);
  for (let v = 0; v < p.vertexCount; v++) {
    const n = remap[v];
    if (n < 0) continue;
    pos.set(srcPos.subarray(v * 3, v * 3 + 3), n * 3);
    nrm.set(nrmSrc.subarray(v * 3, v * 3 + 3), n * 4);
  }
  const idx = new Uint32Array(idx32.length);
  for (let i = 0; i < idx32.length; i++) idx[i] = remap[idx32[i]];
  const bucket = SKIN.includes(id) || FOCUS.has(id) ? id : p.system;
  if (!buckets.has(bucket)) buckets.set(bucket, { pos: [], nrm: [], idx: [], count: 0, extras: bucket === id ? { name: p.name, system: p.system } : { system: p.system } });
  const bk = buckets.get(bucket);
  bk.pos.push(pos);
  bk.nrm.push(nrm);
  bk.idx.push(idx.map((v) => v + bk.count));
  bk.count += count;
}

/** รวมข้อมูลในแต่ละกลุ่มแล้วเขียนเป็น mesh */
const concat = (Type, arrays) => {
  const out = new Type(arrays.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrays) out.set(a, o), (o += a.length);
  return out;
};
for (const [name, bk] of buckets) {
  const pos = concat(Float32Array, bk.pos);
  const nrm = concat(Int16Array, bk.nrm);
  const idx32 = concat(Uint32Array, bk.idx);
  const small = bk.count < 65536;
  const idx = small ? Uint16Array.from(idx32) : idx32;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], pos[i + k]);
      max[k] = Math.max(max[k], pos[i + k]);
    }
  const aPos = accessors.push({ bufferView: addView(pos, 34962), componentType: 5126, count: bk.count, type: 'VEC3', min, max }) - 1;
  const nView = addView(nrm, 34962);
  bufferViews[nView].byteStride = 8;
  const aNrm = accessors.push({ bufferView: nView, componentType: 5122, normalized: true, count: bk.count, type: 'VEC3' }) - 1;
  const aIdx = accessors.push({ bufferView: addView(idx, 34963), componentType: small ? 5123 : 5125, count: idx.length, type: 'SCALAR' }) - 1;
  meshes.push({ name, primitives: [{ attributes: { POSITION: aPos, NORMAL: aNrm }, indices: aIdx }] });
  nodes.push({ name, mesh: meshes.length - 1, extras: bk.extras });
  triangles += idx.length / 3;
}

const gltf = {
  extensionsUsed: ['KHR_mesh_quantization'],
  extensionsRequired: ['KHR_mesh_quantization'],
  asset: { version: '2.0', generator: 'ThaiWell build-anatomy-glb', copyright: 'BodyParts3D, © The Database Center for Life Science, CC BY 4.0' },
  scene: 0,
  scenes: [{ nodes: nodes.map((_, i) => i) }],
  nodes,
  meshes,
  accessors,
  bufferViews,
  buffers: [{ byteLength }],
};

const bin = new Uint8Array(byteLength + ((4 - (byteLength % 4)) % 4));
let o = 0;
for (const part of bufferParts) {
  bin.set(part, o);
  o += part.byteLength;
}
let json = Buffer.from(JSON.stringify(gltf), 'utf8');
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); // 'glTF'
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
const chunkHeader = (len, type) => {
  const b = Buffer.alloc(8);
  b.writeUInt32LE(len, 0);
  b.writeUInt32LE(type, 4);
  return b;
};
const out = path.join(path.dirname(new URL(import.meta.url).pathname), '../assets/models/anatomy_male.glb');
fs.writeFileSync(out, Buffer.concat([header, chunkHeader(json.length, 0x4e4f534a), json, chunkHeader(bin.length, 0x004e4942), Buffer.from(bin)]));
console.log(`wrote ${out} · ${nodes.length} meshes · ${triangles} triangles · ${(fs.statSync(out).size / 1e6).toFixed(2)} MB`);
