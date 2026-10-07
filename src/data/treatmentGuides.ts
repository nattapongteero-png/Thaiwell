/**
 * แนวทางการรักษาตามตำแหน่งที่ปวด — จาก knowledge hub
 * ------------------------------------------------------------------
 * ชื่อโรค: CPG แนวทางเวชปฏิบัติแพทย์แผนไทย (PCU) 2568 ตารางวินิจฉัย หน้า 137–149
 * วิธีรักษา: CPG หน้า 150–154 (นวด อบ ประคบ พอก แช่ ยืดเหยียด ฤๅษีดัดตน มณีเวช) · ตำราอ้างอิงฯ หน้า 414–416 (ประคบ พอก)
 *
 * จุดกด — ตำราไม่มีข้อความ "ปวดที่ X ให้กดจุด Y" ตรง ๆ (CPG หน้า 150–151: กดจุดตามเส้นประธานสิบ ตามดุลยพินิจแพทย์)
 * จึงใส่เฉพาะจุดที่โยงได้จากตำราจริง: อาการ → เส้นประธานที่ตำราบอกว่าเกี่ยวกับอาการนั้น (ตำราอ้างอิงฯ หน้า 394, 405)
 * → จุดสำคัญของเส้นนั้น (หน้า 406–407) · และต้องมีตำแหน่งบนร่างกายในตาราง (หน้า 407–410) จึงแสดงบนหุ่นได้
 * บริเวณที่โยงไม่ได้ → ไม่แสดงจุด (แพทย์แผนไทยเลือกให้หน้างาน)
 * ⚠️ ยังไม่ได้ให้แพทย์แผนไทยตรวจ — เป็นข้อมูลต้นแบบ
 */
import type { BodyPin } from '../design-system/components/Body3D';
import { radiateAnswers } from './radiation';

type Side = 'L' | 'R' | 'both';
/** จุดกด: ซ้าย/ขวา (ตามข้างที่ปวด) หรือแนวกลางตัว */
interface PointDef {
  label: string;
  L: BodyPin[];
  R?: BodyPin[];
}
export interface TreatmentGuide {
  key: string;
  /** ชื่อโรคตามแพทย์แผนไทย (ผู้ให้บริการยืนยันชื่อจริงหลังตรวจ) */
  condition: string;
  methods: string[];
  /** ว่าง = ตำราไม่ได้ระบุจุดสำหรับบริเวณนี้ */
  points: PointDef[];
  /** ข้อควรระวังเฉพาะบริเวณ */
  caution?: string;
  ref: string;
}

const pt = (label: string, L: BodyPin[], R?: BodyPin[]): PointDef => ({ label, L, R });
const MASSAGE = 'นวดไทยแบบราชสำนัก 60 นาที';
const COMPRESS = 'ประคบสมุนไพรหลังนวด 15–30 นาที';

/* จุดตามเส้นอิทา/ปิงคลา (ลมประจำเส้น: ปวดศีรษะ เจ็บสันหลัง — ตำราอ้างอิงฯ หน้า 405–406)
 * พื้นฐานหลัง = แนวชิดกระดูกสันหลังเอวข้อ 5 ถึงต้นคอข้อ 7 (หน้า 407) · สัญญาณ 3 ขาด้านนอก = ลักยิ้มแก้มก้น
 * สัญญาณ 4 ขาด้านใน = ใต้พับเข่า (หน้า 409) */
const BACK_LINE = pt('พื้นฐานหลัง', ['back', 'lowerBack']);
const BUTTOCK = pt('สัญญาณ 3 ขาด้านนอก', ['hipLeft'], ['hipRight']);
const KNEE_BACK = pt('สัญญาณ 4 ขาด้านใน', ['kneeBackLeft'], ['kneeBackRight']);

const GUIDES: TreatmentGuide[] = [
  {
    key: 'head',
    condition: 'ลมปะกัง',
    methods: [MASSAGE, 'ฤๅษีดัดตน ท่าแก้ลมปวดศีรษะ'],
    // ลมปะกัง → เส้นอิทา ปิงคลา (หน้า 394) · สัญญาณ 1–2 ศีรษะด้านหลัง = ฐานกะโหลกขวา/ซ้าย (หน้า 410)
    points: [pt('สัญญาณ 1–2 ศีรษะด้านหลัง', ['occiputLeft', 'occiputRight'])],
    ref: 'CPG หน้า 148, 153 · ตำราอ้างอิงฯ หน้า 394, 405–406, 410',
  },
  {
    key: 'neck',
    condition: 'ลมปลายปัตฆาตบ่า',
    methods: [MASSAGE, COMPRESS, 'ยืดกล้ามเนื้อบ่า ค้าง 15–30 วินาที'],
    // ชื่อโรคมีจุด (สัญญาณ 4 หลัง, โค้งคอ) แต่ตำราไม่ได้บอกตำแหน่ง
    points: [],
    ref: 'CPG หน้า 143–144, 151, 153',
  },
  {
    key: 'shoulder',
    condition: 'ลมปลายปัตฆาตไหล่',
    methods: [MASSAGE, COMPRESS, 'ฤๅษีดัดตน ท่าแก้ไหล่'],
    points: [],
    ref: 'CPG หน้า 144, 151, 154',
  },
  {
    key: 'scapula',
    condition: 'ลมปลายปัตฆาตสัญญาณ 4 หลัง',
    methods: [MASSAGE, COMPRESS, 'ยืดเหยียดกล้ามเนื้อสะบัก'],
    points: [],
    ref: 'CPG หน้า 137, 145, 152',
  },
  {
    key: 'upperBack',
    condition: 'ลมปลายปัตฆาตสัญญาณ 5 หลัง',
    methods: [MASSAGE, COMPRESS],
    points: [BACK_LINE],
    ref: 'CPG หน้า 137, 151 · ตำราอ้างอิงฯ หน้า 405–407',
  },
  {
    key: 'lowerBack',
    condition: 'ลมปลายปัตฆาตสัญญาณ 1 หลัง',
    methods: [MASSAGE, COMPRESS, 'มณีเวช จัดอิริยาบถ'],
    points: [BACK_LINE, BUTTOCK],
    ref: 'CPG หน้า 137, 151, 154 · ตำราอ้างอิงฯ หน้า 405–409',
  },
  {
    // ปวดหลังร้าวลงสะโพก ก้นย้อย ถึงเข่า (CPG หน้า 145) → นวดตามแนวเส้นต่อเนื่องจากหลังลงขา
    key: 'lowerBackRadiating',
    condition: 'ลมปลายปัตฆาตสัญญาณ 1 หลัง',
    methods: [`${MASSAGE} ตามแนวเส้นจากหลังลงขา`, COMPRESS, 'มณีเวช จัดอิริยาบถ'],
    points: [BACK_LINE, BUTTOCK, KNEE_BACK],
    ref: 'CPG หน้า 137, 145, 151, 154 · ตำราอ้างอิงฯ หน้า 405–409',
  },
  {
    key: 'hip',
    condition: 'ขัดสะโพก',
    methods: [MASSAGE, COMPRESS, 'ฤๅษีดัดตน ท่าแก้ตะโพก'],
    points: [],
    ref: 'CPG หน้า 138, 148, 154',
  },
  {
    // CPG ไม่มีกลุ่มอาการชายโครง
    key: 'rib',
    condition: 'ไม่มีในแนวทาง CPG',
    methods: ['แพทย์แผนไทยตรวจก่อนเลือกวิธี'],
    points: [],
    caution: 'ปวดชายโครงร่วมกับไข้ ตัวเหลือง หรือหายใจไม่อิ่ม ควรพบแพทย์ก่อน',
    ref: 'CPG หน้า 137–149',
  },
  {
    key: 'belly',
    condition: 'ลมในท้อง',
    methods: ['นวดพื้นฐานท้อง ท่าแหวก ท่านาบ', 'ฤๅษีดัดตน ท่าแก้ปวดท้อง'],
    // เส้นสุขุมัง: ร้อนท้อง แน่นท้อง (หน้า 405) → ท่าแหวกจุดที่ 2 ใต้สะดือ (หน้า 406–407)
    points: [pt('ท่าแหวกจุดที่ 2', ['belly'])],
    caution: 'นวดหลังอาหาร 30 นาที · ไม่กดรอบสะดือ',
    ref: 'CPG หน้า 153 · ตำราอ้างอิงฯ หน้า 400–401, 405–407',
  },
  {
    key: 'arm',
    condition: 'ลมปลายปัตฆาตแขน',
    methods: [MASSAGE, COMPRESS, 'ฤๅษีดัดตน ท่าแก้แขนขัด'],
    points: [],
    ref: 'CPG หน้า 144, 154',
  },
  {
    key: 'wrist',
    condition: 'ลมปลายปัตฆาตข้อมือ',
    methods: [MASSAGE, 'แช่สมุนไพรมือ ลดชา แก้นิ้วล็อก', 'ฤๅษีดัดตน ท่าแก้ลมข้อมือ'],
    points: [],
    ref: 'CPG หน้า 144, 151, 153',
  },
  {
    key: 'thigh',
    condition: 'ลมปลายปัตฆาตขา',
    methods: [MASSAGE, COMPRESS],
    points: [],
    ref: 'CPG หน้า 144',
  },
  {
    key: 'knee',
    condition: 'ลมจับโปงแห้งเข่า',
    methods: [MASSAGE, 'พอกเข่าด้วยสมุนไพร 15–30 นาที', 'ฤๅษีดัดตน ท่าแก้เข่าขัด'],
    // ลมจับโปง → เส้นอิทา ปิงคลา สหัสรังษี ทวารี (หน้า 394) · ตำแหน่งจุด (หน้า 409)
    points: [KNEE_BACK, pt('สัญญาณ 3 ขาด้านใน', ['kneeLeft'], ['kneeRight'])],
    caution: 'เข่าบวม แดง ร้อน มีน้ำในเข่า ใช้ยาพอกเย็นแทน',
    ref: 'CPG หน้า 137, 149, 151 · ตำราอ้างอิงฯ หน้า 394, 406–409, 416',
  },
  {
    key: 'leg',
    condition: 'ลมปลายปัตฆาตขา',
    methods: [MASSAGE, 'ยืดเหยียดกล้ามเนื้อน่อง', 'ฤๅษีดัดตน ท่าแก้ตะคริวเท้า'],
    points: [],
    ref: 'CPG หน้า 138, 144, 152, 154',
  },
  {
    key: 'ankle',
    condition: 'ลมปลายปัตฆาตส้นเท้า',
    methods: [MASSAGE, 'แช่เท้าด้วยสมุนไพร ลดปวดบวม', 'ฤๅษีดัดตน ท่าแก้ข้อเท้า'],
    // ลมจับโปง (ข้อเท้า) → เส้นสหัสรังษี ทวารี (หน้า 394) · สัญญาณ 5 ขาด้านใน = ใต้ตาตุ่มด้านใน (หน้า 409)
    points: [pt('สัญญาณ 5 ขาด้านใน', ['ankleLeft'], ['ankleRight'])],
    caution: 'ข้อเท้าแพลงไม่เกิน 2 วัน ยังไม่นวด',
    ref: 'CPG หน้า 138–139, 151, 153 · ตำราอ้างอิงฯ หน้า 394, 403, 407–409',
  },
  {
    // CPG มีชื่ออาการ (ขากรรไกรค้าง) แต่ไม่มีเกณฑ์/วิธีรักษา
    key: 'jaw',
    condition: 'ขากรรไกรค้าง',
    methods: ['แพทย์แผนไทยตรวจก่อนเลือกวิธี'],
    points: [],
    ref: 'CPG หน้า 138',
  },
];

/** ตำแหน่งที่ปวด → แนวทาง (เรียงคำเฉพาะก่อนคำทั่วไป เช่น ข้อมือ ก่อน มือ · ต้นขา ก่อน ขา) */
const MATCH: [string, string][] = [
  ['ศีรษะ', 'head'],
  ['ขมับ', 'head'],
  ['ท้ายทอย', 'head'],
  ['กราม', 'jaw'],
  ['คอ', 'neck'],
  ['บ่า', 'neck'],
  ['สะบัก', 'scapula'],
  ['ไหล่', 'shoulder'],
  ['หลังส่วนบน', 'upperBack'],
  ['หลัง', 'lowerBack'],
  ['เอว', 'lowerBack'],
  ['ชายโครง', 'rib'],
  ['ท้อง', 'belly'],
  ['สะโพก', 'hip'],
  ['ข้อศอก', 'arm'],
  ['แขน', 'arm'],
  ['ข้อมือ', 'wrist'],
  ['มือ', 'wrist'],
  ['ต้นขา', 'thigh'],
  ['เข่า', 'knee'],
  ['น่อง', 'leg'],
  ['ข้อเท้า', 'ankle'],
  ['ส้นเท้า', 'ankle'],
  ['เท้า', 'ankle'],
  ['ขา', 'leg'],
];

const guideOf = (symptom: string) => {
  const key = MATCH.find(([w]) => symptom.includes(w))?.[1];
  return GUIDES.find((g) => g.key === key);
};
const sideOf = (symptom: string): Side => (symptom.endsWith('ซ้าย') ? 'L' : symptom.endsWith('ขวา') ? 'R' : 'both');
const pinsOf = (p: PointDef, side: Side): BodyPin[] => (!p.R ? p.L : side === 'L' ? p.L : side === 'R' ? p.R : [...p.L, ...p.R]);

/** ชื่อบริเวณ (ใช้ถาม "ตรงไหนปวดมากที่สุด" เมื่อปวดหลายจุด — จุดซ้าย/ขวาของบริเวณเดียวกันรวมเป็นข้อเดียว) */
const REGION: Record<string, string> = {
  head: 'ศีรษะ',
  neck: 'คอ บ่า',
  shoulder: 'ไหล่',
  scapula: 'สะบัก',
  upperBack: 'หลังส่วนบน',
  lowerBack: 'หลัง เอว',
  lowerBackRadiating: 'หลังร้าวลงขา',
  hip: 'สะโพก',
  rib: 'ชายโครง',
  belly: 'ท้อง',
  arm: 'แขน',
  wrist: 'ข้อมือ มือ',
  thigh: 'ต้นขา',
  knee: 'เข่า',
  leg: 'น่อง ขา',
  ankle: 'ข้อเท้า เท้า',
  jaw: 'กราม',
};

/**
 * แนวทางของการประเมินนี้ — อาการแรก = บริเวณหลัก (ชื่อโรค + วิธี + จุดกดครบ)
 * ปวดหลายบริเวณ: จุดซ้าย/ขวาของบริเวณเดียวกันรวมเป็นบริเวณเดียว · บริเวณรองแสดงจุดกด 1 จุดต่อบริเวณ · วิธีรักษารวมไม่ซ้ำ
 * ไม่ตรงกลุ่มไหน → แนวทางคอ บ่า (กลุ่มที่พบบ่อยที่สุด)
 */
export function guideFor(
  symptoms: string[],
  /** อาการร้าว (data/radiation.ts) — ร้าวเป็นอาการเดียวกับจุดที่ปวด จึงใช้แนวทางของรูปแบบการร้าวแทน */
  radiate?: string,
): {
  condition: string;
  methods: string[];
  points: string[];
  pins: BodyPin[];
  caution?: string;
  ref: string;
  /** หลายบริเวณ (แรก = บริเวณหลัก): ชื่อบริเวณ · อาการที่อยู่ในบริเวณนี้ · ชื่อโรค · จุดกด · ร้าวไปไหน */
  areas: { symptom: string; region: string; symptoms: string[]; condition: string; points: string[]; radiate?: string }[];
} {
  // อาการร้าวผูกกับบริเวณที่ถาม (ไม่ใช่บริเวณแรกเสมอ) — ร้าว = แนวทางของรูปแบบการร้าวแทนแนวทางของจุดนั้น
  const answers = radiateAnswers(symptoms, radiate).filter((a) => a.option);
  const radiOf = (s: string) => answers.find((a) => a.symptom === s);
  const found = symptoms
    .map((s) => {
      const ra = radiOf(s);
      const rg = ra?.option?.guideKey ? GUIDES.find((g) => g.key === ra.option!.guideKey) : undefined;
      return { s, g: rg ?? guideOf(s) };
    })
    .filter((x): x is { s: string; g: TreatmentGuide } => !!x.g);
  const main = found[0]?.g ?? GUIDES.find((g) => g.key === 'neck')!;
  // รวมตามบริเวณ (แนวทางเดียวกัน) โดยคงลำดับ (บริเวณแรก = หลัก)
  // บริเวณที่อยู่ในแนวร้าวของอีกจุด (เช่น หลังร้าวลงขา + เลือกขามาด้วย) = อาการเดียวกัน → รวมเข้าจุดต้นทาง ไม่นับแยก
  const coveredBy = (s: string) => {
    const k = guideOf(s)?.key;
    return k ? answers.find((a) => a.symptom !== s && a.option?.covers?.includes(k)) : undefined;
  };
  const groups: { g: TreatmentGuide; ss: string[]; radiate?: string }[] = [];
  for (const { s, g } of found) {
    const cov = coveredBy(s);
    const src = cov ? groups.find((x) => x.ss.includes(cov.symptom)) : undefined;
    if (src) {
      src.ss.push(s);
      continue;
    }
    const hit = groups.find((x) => x.g.key === g.key);
    if (hit) hit.ss.push(s);
    else groups.push({ g, ss: [s], radiate: radiOf(s)?.label });
  }
  // บริเวณที่ถูกรวมแต่มาก่อนจุดต้นทาง (ลำดับเลือก) → ย้ายเข้าจุดต้นทาง
  for (const gr of [...groups]) {
    const cov = gr.ss.length === 1 ? coveredBy(gr.ss[0]) : undefined;
    const src = cov ? groups.find((x) => x !== gr && x.ss.includes(cov.symptom)) : undefined;
    if (src) {
      src.ss.push(...gr.ss);
      groups.splice(groups.indexOf(gr), 1);
    }
  }
  if (!groups.length) groups.push({ g: main, ss: [''] });
  // จุดกด: บริเวณหลักครบทุกจุด · บริเวณรองจุดแรกจุดเดียว (ตามข้างที่ปวด)
  const pts = new Map<string, BodyPin[]>();
  groups.forEach(({ g, ss }, gi) =>
    (gi === 0 ? g.points : g.points.slice(0, 1)).forEach((p) =>
      pts.set(p.label, [...new Set([...(pts.get(p.label) ?? []), ...ss.flatMap((s) => pinsOf(p, sideOf(s)))])]),
    ),
  );
  const points = [...pts.keys()];
  const areas = groups.map(({ g, ss, radiate: r }) => ({ symptom: ss[0], region: REGION[(guideOf(ss[0]) ?? g).key] ?? ss[0], symptoms: ss, condition: g.condition, points: g.points.map((p) => p.label), radiate: r }));
  return {
    condition: groups[0].g.condition,
    // รวมไม่ซ้ำ · วิธีเดียวกันแต่ละเอียดกว่า (เช่น นวด 60 นาที ตามแนวเส้น…) = ใช้แบบละเอียดแบบเดียว
    methods: groups.length > 1 ? [...new Set(groups.flatMap(({ g }) => g.methods))].filter((m, _, all) => !all.some((o) => o !== m && o.startsWith(m))) : groups[0].g.methods,
    points,
    pins: [...new Set(points.flatMap((l) => pts.get(l)!))],
    caution: groups[0].g.caution,
    ref: [...new Set(found.map((x) => x.g.ref))].join(' · ') || main.ref,
    areas,
  };
}
