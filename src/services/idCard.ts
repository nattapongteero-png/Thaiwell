/**
 * ข้อมูลตามบัตรประชาชน — อ่านจากข้อความที่ OCR บนเครื่องได้ (modules/id-card-ocr) หรือกรอกเอง
 * ตรวจเลขบัตรด้วยหลักตรวจสอบ (หลักที่ 13) · วันเกิดเก็บเป็น วว/ดด/ปปปป (พ.ศ.)
 */
export interface IdCard {
  citizenId: string; // 13 หลัก ไม่มีขีด
  title: string;
  firstName: string;
  lastName: string;
  sex: 'ชาย' | 'หญิง' | '';
  birthDate: string; // วว/ดด/ปปปป พ.ศ.
  address: string;
  phone: string;
}

/** ตัดวันที่บนบัตรที่ติดมากับที่อยู่ (เช่น "… กรุงเทพมหานคร 1 ก.ค. 2568") */
export function cleanAddress(a: string) {
  const months = TH_MONTHS.map((m) => m.replace(/\./g, '\\.')).join('|');
  return a.replace(new RegExp(`\\s*(\\d{1,2}\\s*)?(${months})\\s*\\d{4}.*$`), '').trim();
}

export const EMPTY_ID: IdCard = { citizenId: '', title: '', firstName: '', lastName: '', sex: '', birthDate: '', address: '', phone: '' };

export const TITLES = ['นาย', 'นาง', 'นางสาว', 'เด็กชาย', 'เด็กหญิง'] as const;
const TITLE_ALIASES: [RegExp, string][] = [
  [/^(นางสาว|น\.ส\.)/, 'นางสาว'],
  [/^(เด็กชาย|ด\.ช\.)/, 'เด็กชาย'],
  [/^(เด็กหญิง|ด\.ญ\.)/, 'เด็กหญิง'],
  [/^นาย/, 'นาย'],
  [/^นาง/, 'นาง'],
];
export const sexOfTitle = (t: string): IdCard['sex'] => (/^(นาย|เด็กชาย)$/.test(t) ? 'ชาย' : /^(นาง|นางสาว|เด็กหญิง)$/.test(t) ? 'หญิง' : '');

/** เลขบัตรประชาชน 13 หลัก + หลักตรวจสอบถูกต้อง */
export function validCitizenId(id: string) {
  const d = id.replace(/\D/g, '');
  if (d.length !== 13) return false;
  const sum = [...d.slice(0, 12)].reduce((s, c, i) => s + Number(c) * (13 - i), 0);
  return (11 - (sum % 11)) % 10 === Number(d[12]);
}
/** 1234567890123 → 1-2345-67890-12-3 */
export const formatCitizenId = (id: string) => {
  const d = id.replace(/\D/g, '').slice(0, 13);
  return [d.slice(0, 1), d.slice(1, 5), d.slice(5, 10), d.slice(10, 12), d.slice(12)].filter(Boolean).join('-');
};
export const validPhone = (p: string) => /^0\d{8,9}$/.test(p.replace(/\D/g, ''));

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const TH_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const EN_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/** วว/ดด/ปปปป (พ.ศ.) ที่เป็นวันจริงในอดีต → อายุ · ไม่ถูกต้อง → null */
export function ageFromBirth(b: string): number | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(b.trim());
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const y = Number(m[3]) > 2400 ? Number(m[3]) - 543 : Number(m[3]);
  const d = new Date(y, mm - 1, dd);
  if (d.getFullYear() !== y || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  const now = new Date();
  const age = now.getFullYear() - y - (now.getMonth() < mm - 1 || (now.getMonth() === mm - 1 && now.getDate() < dd) ? 1 : 0);
  return d > now || age > 120 ? null : age;
}
/** วว/ดด/ปปปป พ.ศ. → YYYY-MM-DD ค.ศ. */
export function birthISO(b: string) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(b.trim());
  if (!m) return undefined;
  const y = Number(m[3]) > 2400 ? Number(m[3]) - 543 : Number(m[3]);
  return `${y}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
}

/** ข้อความจากบัตร (ทีละบรรทัด) → ช่องที่อ่านได้ · ที่อ่านไม่ได้ปล่อยว่างให้ผู้ใช้กรอก */
export function parseIdCard(lines: string[]): Partial<IdCard> {
  const out: Partial<IdCard> = {};
  const all = lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);

  // เลขบัตร: ตัวเลข 13 หลัก (อาจมีช่องว่าง/ขีดคั่น) · เลือกตัวที่หลักตรวจสอบถูกก่อน
  const ids = all.flatMap((l) => (l.match(/\d[\d\s-]{11,22}\d/g) ?? []).map((x) => x.replace(/\D/g, ''))).filter((d) => d.length === 13);
  out.citizenId = ids.find(validCitizenId) ?? ids[0];

  // ชื่อ: บรรทัด "ชื่อตัวและชื่อสกุล ..." หรือบรรทัดที่ขึ้นต้นด้วยคำนำหน้า
  const nameLine = all.find((l) => /ชื่อตัวและชื่อสกุล/.test(l))?.replace(/.*ชื่อตัวและชื่อสกุล\s*/, '') ?? all.find((l) => TITLE_ALIASES.some(([re]) => re.test(l)) && !/ที่อยู่/.test(l));
  if (nameLine) {
    let rest = nameLine.trim();
    for (const [re, t] of TITLE_ALIASES) {
      if (re.test(rest)) {
        out.title = t;
        rest = rest.replace(re, '').trim();
        break;
      }
    }
    const parts = rest.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      out.firstName = parts[0];
      out.lastName = parts.slice(1).join(' ');
    } else if (parts.length === 1) out.firstName = parts[0];
  }
  // คำนำหน้าภาษาไทยอ่านไม่ได้ → จากภาษาอังกฤษ (Mr. / Mrs. / Miss)
  if (!out.title) {
    const en = all.find((l) => /^Name\b/i.test(l)) ?? '';
    if (/\bMr\.?\b/i.test(en)) out.title = 'นาย';
    else if (/\bMrs\.?\b/i.test(en)) out.title = 'นาง';
    else if (/\bMiss\b|\bMs\.?\b/i.test(en)) out.title = 'นางสาว';
  }
  if (out.title) out.sex = sexOfTitle(out.title);

  // วันเกิด: "เกิดวันที่ 12 มี.ค. 2528" · สำรอง "Date of Birth 12 Mar. 1985"
  const th = all.find((l) => /เกิดวันที่/.test(l));
  if (th) {
    const m = /(\d{1,2})\s*([ก-๙.]+)\s*(\d{4})/.exec(th.replace(/.*เกิดวันที่\s*/, ''));
    if (m) {
      const key = m[2].replace(/\s/g, '');
      let mi = TH_MONTHS.indexOf(key.endsWith('.') ? key : `${key}.`);
      if (mi < 0) mi = TH_MONTHS_FULL.findIndex((x) => key.startsWith(x.slice(0, 3)));
      if (mi >= 0) out.birthDate = `${pad(Number(m[1]))}/${pad(mi + 1)}/${m[3]}`;
    }
  }
  if (!out.birthDate) {
    const en = all.find((l) => /Date of Birth/i.test(l));
    const m = en ? /(\d{1,2})\s*([A-Za-z]{3})[a-z]*\.?\s*(\d{4})/.exec(en) : null;
    const mi = m ? EN_MONTHS.indexOf(m[2].toLowerCase()) : -1;
    if (m && mi >= 0) out.birthDate = `${pad(Number(m[1]))}/${pad(mi + 1)}/${Number(m[3]) + 543}`;
  }

  // ที่อยู่: จากบรรทัด "ที่อยู่" ต่อจนถึงบรรทัดวันออกบัตร/วันหมดอายุ (ที่อยู่บนบัตรมักยาว 2 บรรทัด)
  const ai = all.findIndex((l) => /^ที่อยู่/.test(l));
  if (ai >= 0) {
    const parts = [all[ai].replace(/^ที่อยู่\s*/, '')];
    for (let i = ai + 1; i < all.length && i <= ai + 2; i++) {
      // วันที่บนบัตร (วันออกบัตร/หมดอายุ) — OCR บางครั้งแยกวันออกไป เหลือแค่ "ก.ค. 2568" → ดูแค่เดือน + ปี
      const isDate = TH_MONTHS.some((mo) => new RegExp(`${mo.replace(/\./g, '\\.')}\\s*\\d{4}`).test(all[i]));
      if (/วันออกบัตร|วันบัตรหมดอายุ|Date of|ศาสนา/.test(all[i]) || isDate) break;
      parts.push(all[i]);
    }
    out.address = cleanAddress(parts.join(' '));
  }
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v)) as Partial<IdCard>;
}
