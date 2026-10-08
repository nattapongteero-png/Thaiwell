/**
 * ระยะเวลาบริการ (นาที) — ชุดเดียวกับบริการของคลินิก (หลังบ้าน ThaiWellAI: s1–s4 = 60 · s5 นวดร่วมประคบ = 90)
 * ป้ายที่บอกนาทีไว้ ("… · 90 นาที") ใช้ตามป้าย · ไม่รู้ = 60
 */
const BY_ID: Record<string, number> = { s1: 60, s2: 60, s3: 60, s4: 60, s5: 90 };
export function serviceMinutesOf(service?: string | null, serviceId?: string | null): number {
  const m = service?.match(/(\d+)\s*นาที/);
  if (m) return Number(m[1]);
  if (serviceId && BY_ID[serviceId]) return BY_ID[serviceId];
  // นวด + ประคบ ในบริการเดียว = 90 นาที
  if (service && /นวด/.test(service) && /ประคบ/.test(service)) return 90;
  return 60;
}
