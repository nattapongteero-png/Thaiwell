import React from 'react';
import { dxCode, procCode } from '../../../data/clinicalCodes';
import { Pressable, ScrollView, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Polyline, Stop, Text as SvgText } from 'react-native-svg';
import { Icon, StretchDemo, Text, fontFamily, painColor, useTheme } from '../../../design-system';
import { radius, space } from '../../../design-system/tokens';
import { type TreatmentCase } from '../../../data/homeFeed';
import { SYMPTOM_GROUPS } from '../../../data/thaiMassageKnowledge';
import { STRETCH_MOTION } from '../../../data/stretchMotion';

/**
 * รายละเอียดการรักษา — หน้าตาเดียวกับหลังบ้าน (ThaiWellAI · หน้าผู้มารับบริการ)
 * ใช้ร่วม: bottom sheet จากแชท · หน้ารายละเอียดจากแท็บประวัติ
 * ช่องสรุป 4 ช่อง → คอร์สการรักษา (ช่องรายครั้ง) → แนวโน้ม Pain Score → ประวัติการรับบริการ (timeline) → บริเวณ/ผู้ให้บริการ → ก่อนมานวด → ดูแลตัวเอง
 */
/** คะแนนหลังนวดของครั้งที่ i: ครั้งล่าสุด = ที่ผู้ใช้ประเมินหลังนวด (ยังไม่ประเมิน = ไม่มี) · ครั้งก่อน ๆ = หลังนวด — ชุดเดียวกับหน้าแรก */
export const afterOf = (tc: TreatmentCase, i: number) => (i === tc.visits.length - 1 ? tc.visits[i].selfPain : tc.visits[i].painAfter);

export function TreatmentDetailBody({ tc, visit = null }: { tc: TreatmentCase; /** ครั้งที่เลือกจากแถบ VisitTabs (ค้างไว้ใน header) · null = ภาพรวม */ visit?: number | null }) {
  const { colors } = useTheme();
  /** เปิดดูรายครั้ง (index ใน tc.visits) — เลือกจากแถบด้านบนที่เดียว (การ์ดด้านล่างเป็นสรุป ดูอย่างเดียว) */
  if (visit !== null && tc.visits[visit]) return <VisitDetail tc={tc} index={visit} />;
  const first = tc.visits[0];
  const last = tc.visits[tc.visits.length - 1];
  // ล่าสุดที่มีคะแนน (ครั้งล่าสุดยังไม่ประเมิน → ใช้ครั้งก่อนหน้า)
  const latest = [...tc.visits.keys()].reverse().map((i) => afterOf(tc, i)).find((v) => v !== undefined);
  const change = first && latest !== undefined ? first.painBefore - latest : 0;
  const pct = first ? Math.round((change / Math.max(1, first.painBefore)) * 100) : 0;
  const group = SYMPTOM_GROUPS.find((g) => g.id === tc.selfCare.groupId);
  const motion = group ? STRETCH_MOTION[group.stretch.name] : undefined;
  const hasNext = tc.appointment.date !== '-';
  const areaText = tc.areas.map((a) => a.label).join(' · ');

  return (
    <View style={{ gap: space[3] }}>
      {/* สรุป 4 ช่อง (พื้นเทาอ่อน ไม่มีขอบ แบบหลังบ้าน) */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        <Stat label="รับบริการแล้ว" value={`${tc.visits.length}`} unit="ครั้ง" />
        <Stat label="Pain ล่าสุด" value={`${latest ?? '-'}`} unit="/10" color={latest !== undefined ? painColor(latest) : undefined} />
        <Stat label="เปลี่ยนแปลง" value={`${change > 0 ? '↘ ' : ''}${Math.abs(change)}`} unit={change > 0 ? 'ดีขึ้น' : 'เท่าเดิม'} color={change > 0 ? colors.brand.primary : undefined} />
        <Stat label="นัดถัดไป" value={hasNext ? tc.appointment.time : '-'} unit={hasNext ? tc.appointment.date : 'ยังไม่มีนัด'} small />
      </View>

      {/* คอร์สการรักษา */}
      <Section icon="clipboard" tint="#C2782B" title="คอร์สการรักษา" right={<Chip text={`เหลือ ${tc.course.total - tc.course.done} ครั้ง`} />}>
        <Text variant="labelLg">{tc.plan} {tc.course.total} ครั้ง</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {Array.from({ length: tc.course.total }, (_, i) => {
            const done = i < tc.course.done;
            const booked = !done && i === tc.course.done && hasNext;
            return (
              <View
                key={i}
                accessibilityLabel={`ครั้งที่ ${i + 1} ${done ? 'ทำแล้ว' : booked ? 'จองไว้' : 'ว่าง'}`}
                style={{
                  width: 34,
                  height: 30,
                  borderRadius: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: done ? colors.brand.primary : booked ? '#FBE3A8' : colors.surface.default,
                  borderWidth: done || booked ? 0 : 1,
                  borderColor: colors.border.subtle,
                }}
              >
                {done ? <Icon name="check" size="xs" color="#FFFFFF" /> : <Text variant="labelSm" color={booked ? '#9A6A10' : colors.text.tertiary}>{i + 1}</Text>}
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: space[3] }}>
          <Legend color={colors.brand.primary} text={`ใช้แล้ว ${tc.course.done}`} />
          {hasNext ? <Legend color="#E8B23A" text="จองไว้ 1" /> : null}
          <Legend color={colors.border.default} text={`ว่าง ${tc.course.total - tc.course.done - (hasNext ? 1 : 0)}`} />
        </View>
      </Section>

      {/* แผนการรักษาที่แพทย์อนุมัติในหลังบ้าน */}
      {tc.clinicPlan ? (
        <Section icon="file-text" tint="#2F6FA3" title="แผนจากแพทย์" right={<Chip text={`${tc.clinicPlan.sessions} ครั้ง · ${tc.clinicPlan.frequency}`} />}>
          <Text variant="bodyMd">{tc.clinicPlan.summary}</Text>
          {tc.clinicPlan.homeCare.map((h) => (
            <View key={h} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#2F6FA3' }} />
              <Text variant="bodySm" style={{ flex: 1 }}>
                {h}
              </Text>
            </View>
          ))}
        </Section>
      ) : null}

      {/* แนวโน้ม Pain Score */}
      <Section icon="activity" tint="#D9534F" title="แนวโน้ม Pain Score" right={first && latest !== undefined ? <Chip text={`${first.painBefore} → ${latest} · ดีขึ้น ${pct}%`} tone="good" /> : null}>
        <PainTrend values={tc.visits.map((v, i) => ({ label: v.date, v: afterOf(tc, i) }))} />
      </Section>

      {/* ประวัติการรับบริการ (timeline · ล่าสุดก่อน) */}
      <Section icon="clock" tint="#7C6CD4" title="ประวัติการรับบริการ">
        {[...tc.visits].reverse().map((v, i, arr) => (
          <View key={v.date} style={{ flexDirection: 'row', gap: space[3] }}>
            <View style={{ alignItems: 'center', width: 12 }}>
              <View style={{ width: 9, height: 9, borderRadius: 5, marginTop: 6, backgroundColor: i === 0 ? colors.brand.primary : colors.border.strong }} />
              {i < arr.length - 1 ? <View style={{ flex: 1, width: 1.5, backgroundColor: colors.border.subtle, marginTop: 2 }} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: i < arr.length - 1 ? space[3] : 0, flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyXs" tone="secondary">
                  {v.date} · ครั้งที่ {arr.length - i}
                </Text>
                <Text variant="labelMd">{tc.plan}</Text>
                <Text variant="bodyXs" tone="tertiary" numberOfLines={1}>
                  {areaText}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <PainPill label="ก่อน" v={v.painBefore} />
                {/* ยังไม่ประเมินหลังนวด → กล่องหลังว่าง (ไม่มีสี) */}
                <PainPill label="หลัง" v={afterOf(tc, arr.length - 1 - i)} />
              </View>
            </View>
          </View>
        ))}
      </Section>

      {/* บริเวณ · ผู้ให้บริการ */}
      <Section icon="user" tint={colors.brand.primary} title="การดูแล">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {tc.areas.map((a) => (
            <Chip key={a.pin} text={a.label} />
          ))}
        </View>
        <Info k="ผู้ให้บริการ" v={tc.therapist} />
        {tc.pending.length ? <Info k="รอติดตามผล" v={`ครั้ง ${tc.pending.map((p) => p.date).join(', ')}`} /> : null}
      </Section>

      {tc.prep.length ? (
        <Section icon="check-circle" tint={colors.brand.primary} title="ก่อนมานวด">
          {tc.prep.map((p) => (
            <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.brand.primary }} />
              <Text variant="bodySm">{p}</Text>
            </View>
          ))}
        </Section>
      ) : null}

      {motion && group ? (
        <Section icon="play-circle" tint="#2F6FA3" title={`ดูแลตัวเอง · ${group.stretch.name.replace(' 7 ท่า', '')}`} flush>
          <StretchDemo motion={motion} steps={group.stretch.steps} height={230} />
        </Section>
      ) : null}
    </View>
  );
}

/** การ์ดแบบหลังบ้าน: ไอคอนในกล่องสีอ่อน + หัวข้อหนา · ขวา = ชิปสรุป */
function Section({ icon, tint, title, right, children, flush }: { icon: React.ComponentProps<typeof Icon>['name']; tint: string; title: string; right?: React.ReactNode; children: React.ReactNode; flush?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ borderRadius: 20, backgroundColor: colors.surface.default, borderWidth: 1, borderColor: colors.border.subtle, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], padding: space[4], paddingBottom: flush ? space[3] : 0 }}>
        <View style={{ width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: `${tint}1F` }}>
          <Icon name={icon} size="xs" color={tint} />
        </View>
        <Text variant="labelLg" style={{ flex: 1 }}>
          {title}
        </Text>
        {right}
      </View>
      <View style={flush ? null : { padding: space[4], paddingTop: space[3], gap: space[3] }}>{children}</View>
    </View>
  );
}

function Stat({ label, value, unit, color, small }: { label: string; value: string; unit: string; color?: string; small?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: '48.6%', padding: space[3], borderRadius: 16, backgroundColor: colors.surface.sunken, gap: 2 }}>
      <Text variant="bodyXs" tone="secondary">
        {label}
      </Text>
      <Text style={{ fontFamily: fontFamily.bold, fontSize: small ? 18 : 24, lineHeight: small ? 28 : 34, color: color ?? colors.text.primary }}>{value}</Text>
      <Text variant="bodyXs" tone="tertiary" numberOfLines={1}>
        {unit}
      </Text>
    </View>
  );
}

function Chip({ text, tone }: { text: string; tone?: 'good' }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingHorizontal: space[2] + 2, height: 26, justifyContent: 'center', borderRadius: radius.full, backgroundColor: tone === 'good' ? colors.brand.subtle : colors.surface.sunken }}>
      <Text variant="labelSm" color={tone === 'good' ? colors.brand.primary : colors.text.secondary}>
        {text}
      </Text>
    </View>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text variant="bodyXs" tone="secondary">
        {text}
      </Text>
    </View>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[3] }}>
      <Text variant="bodySm" tone="secondary">
        {k}
      </Text>
      <Text variant="labelMd" style={{ flexShrink: 1, textAlign: 'right' }}>
        {v}
      </Text>
    </View>
  );
}

/** ป้ายคะแนนแบบหลังบ้าน: "หลัง ▮▮▯▯▯ 3" (แท่งสีตามระดับ) */
export function PainPill({ label, v }: { label: string; v?: number }) {
  const { colors } = useTheme();
  const c = v === undefined ? colors.text.tertiary : painColor(v);
  const n = v === undefined ? 0 : Math.max(1, Math.ceil(v / 2));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 26, paddingHorizontal: space[2], borderRadius: radius.full, backgroundColor: colors.surface.sunken }}>
      <Text variant="bodyXs" tone="secondary">
        {label}
      </Text>
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {Array.from({ length: 5 }, (_, i) => (
          <View key={i} style={{ width: 4, height: 12, borderRadius: 2, backgroundColor: i < n ? c : colors.border.subtle }} />
        ))}
      </View>
      <Text style={{ fontFamily: fontFamily.bold, fontSize: 13, lineHeight: 18, color: c }}>{v ?? '–'}</Text>
    </View>
  );
}

/** กราฟแนวโน้มแบบหลังบ้าน: เส้นเขียว + พื้นไล่จาง · จุดวงแหวนสีตามระดับ + ตัวเลขเหนือจุด */
function PainTrend({ values: all }: { values: { label: string; v?: number }[] }) {
  // เส้นเฉพาะครั้งที่มีคะแนน · ครั้งที่ยังไม่ประเมิน = วงเทาโปร่งบนเส้น 0 (ไม่มีตัวเลข)
  const n = all.findIndex((p) => p.v === undefined);
  const values = (n === -1 ? all : all.slice(0, n)) as { label: string; v: number }[];
  const { colors } = useTheme();
  const [w, setW] = React.useState(0);
  const H = 170;
  const L = 26;
  const R = 24;
  const T = 26;
  const B = 26;
  const x = (i: number) => L + (all.length > 1 ? (i * (w - L - R)) / (all.length - 1) : (w - L - R) / 2);
  const y = (v: number) => T + ((10 - v) / 10) * (H - T - B);
  const line = values.map((p, i) => `${x(i)},${y(p.v)}`).join(' ');
  const area = values.length ? `M${x(0)},${y(0)} L${values.map((p, i) => `${x(i)},${y(p.v)}`).join(' L')} L${x(values.length - 1)},${y(0)} Z` : '';
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 ? (
        <Svg width={w} height={H}>
          <Defs>
            <LinearGradient id="pt" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.brand.primary} stopOpacity={0.18} />
              <Stop offset="1" stopColor={colors.brand.primary} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {[0, 5, 10].map((g) => (
            <React.Fragment key={g}>
              <Line x1={L} x2={w - R} y1={y(g)} y2={y(g)} stroke={colors.border.subtle} strokeDasharray="4 5" />
              <SvgText fontFamily={fontFamily.medium} x={L - 8} y={y(g) + 4} fontSize={11} fill={colors.text.tertiary} textAnchor="end">
                {g}
              </SvgText>
            </React.Fragment>
          ))}
          <Path d={area} fill="url(#pt)" />
          <Polyline points={line} fill="none" stroke={colors.brand.primary} strokeWidth={3} strokeLinejoin="round" />
          {values.map((p, i) => (
            <React.Fragment key={p.label}>
              <Circle cx={x(i)} cy={y(p.v)} r={7} fill="#FFFFFF" stroke={painColor(p.v)} strokeWidth={3} />
              <SvgText fontFamily={fontFamily.medium} x={x(i)} y={y(p.v) - 13} fontSize={13} fontWeight="700" fill={colors.text.primary} textAnchor="middle">
                {p.v}
              </SvgText>
              <SvgText fontFamily={fontFamily.medium} x={x(i)} y={H - 6} fontSize={10.5} fill={colors.text.tertiary} textAnchor="middle">
                {p.label}
              </SvgText>
            </React.Fragment>
          ))}
          {all.slice(values.length).map((p, k) => {
            const i = values.length + k;
            return (
              <React.Fragment key={`m-${p.label}`}>
                <Circle cx={x(i)} cy={y(0)} r={6} fill="#FFFFFF" stroke={colors.border.default} strokeWidth={3} />
                <SvgText fontFamily={fontFamily.medium} x={x(i)} y={H - 6} fontSize={10.5} fill={colors.text.tertiary} textAnchor="middle">
                  {p.label}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      ) : (
        <View style={{ height: H }} />
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ รายละเอียดรายครั้ง
 * เปิดจาก: แถวในประวัติการรับบริการ · ช่อง ✓ ในคอร์สการรักษา
 * ข้อมูลที่ผู้ให้บริการบันทึก (ServiceRecord): วิธีนวด · แรงนวด · เวลา · บริเวณ · สมุนไพร · บันทึกผู้ให้บริการ · คำแนะนำหลังนวด
 * ⚠️ ต้นแบบ: ข้อมูลรายครั้งสร้างจากแผนการรักษา (ยังไม่มีบันทึกจริงจากหลังบ้าน)
 */
export function sessionRecord(tc: TreatmentCase, i: number) {
  const compress = /ประคบ/.test(tc.plan) || i % 2 === 1;
  const techniques = /หน้า/.test(tc.plan) ? ['นวดหน้า', 'กดจุดศีรษะ', 'คลายบ่า-ไหล่'] : ['นวดราชสำนัก (กดจุด)', 'คลายกล้ามเนื้อบ่า-คอ', 'ยืดเหยียดหลังนวด'];
  const notes = ['กล้ามเนื้อบ่าตึงมาก เริ่มด้วยแรงเบา', 'จุดกดเจ็บลดลงจากครั้งก่อน', 'ผู้ป่วยนอนหลับได้ดีขึ้น เพิ่มเวลาคลายบ่า', 'ตึงน้อยลงชัดเจน ลดแรงกด', 'อาการคงที่ ติดตามต่อ'];
  const base = {
    duration: compress ? 90 : 60,
    pressure: i < 2 ? 'เบา' : 'ปานกลาง',
    techniques: compress ? [...techniques, 'ประคบสมุนไพร'] : techniques,
    herbs: compress ? ['ลูกประคบสมุนไพร (ไพล ขมิ้นชัน ตะไคร้)'] : [],
    note: notes[i % notes.length],
    advice: ['ดื่มน้ำอุ่นมาก ๆ', 'งดอาบน้ำเย็น 2 ชม.', 'ทำท่ายืดวันละ 2 รอบ'],
    therapist: tc.therapist,
    diagnoses: undefined as string[] | undefined,
  };
  // บันทึกจริงจากคลินิก (หลังบ้าน) → ใช้แทนข้อมูลตัวอย่าง
  const rec = tc.visits[i]?.record;
  if (!rec) return base;
  return {
    ...base,
    techniques: rec.procedures?.length ? rec.procedures : base.techniques,
    herbs: rec.procedures?.some((p) => /ประคบ/.test(p)) ? base.herbs : [],
    note: rec.findings || base.note,
    advice: rec.advice ? rec.advice.split(/\n|·/).map((x) => x.trim()).filter(Boolean) : base.advice,
    therapist: rec.therapist || base.therapist,
    diagnoses: rec.diagnoses?.length ? rec.diagnoses : undefined,
  };
}

function VisitDetail({ tc, index }: { tc: TreatmentCase; index: number }) {
  const { colors } = useTheme();
  const v = tc.visits[index];
  const r = sessionRecord(tc, index);
  const vAfter = afterOf(tc, index);
  const d = vAfter === undefined ? 0 : v.painBefore - vAfter;
  const prev = index > 0 ? tc.visits[index - 1] : null;
  const dx = dxCode(tc.condition);
  // หัตถการที่ทำ → รหัส ICD-9-CM (ไม่ซ้ำ)
  const procs = [...new Set(r.techniques.map((t) => procCode(t)?.code).filter(Boolean) as string[])];
  return (
    <View style={{ gap: space[3] }}>
      {/* หัวของครั้งนี้ */}
      <View style={{ gap: 2 }}>
        <Text variant="bodyXs" tone="secondary">
          ครั้งที่ {index + 1} · {v.date}
        </Text>
        <Text style={{ fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 32, color: colors.text.primary }}>{tc.plan}</Text>
        <Text variant="bodySm" tone="secondary">
          {r.therapist} · {r.duration} นาที
        </Text>
      </View>

      {/* ผลครั้งนี้ */}
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <View style={{ flex: 1, padding: space[3], borderRadius: 16, backgroundColor: colors.surface.sunken }}>
          <Text variant="bodyXs" tone="secondary">ก่อนนวด</Text>
          <Text style={{ fontFamily: fontFamily.bold, fontSize: 26, lineHeight: 36, color: painColor(v.painBefore) }}>{v.painBefore}<Text variant="bodySm" tone="tertiary">/10</Text></Text>
        </View>
        <View style={{ flex: 1, padding: space[3], borderRadius: 16, backgroundColor: colors.surface.sunken }}>
          <Text variant="bodyXs" tone="secondary">หลังนวด</Text>
          <Text style={{ fontFamily: fontFamily.bold, fontSize: 26, lineHeight: 36, color: vAfter === undefined ? colors.text.tertiary : painColor(vAfter) }}>{vAfter ?? '–'}<Text variant="bodySm" tone="tertiary">/10</Text></Text>
        </View>
        <View style={{ flex: 1, padding: space[3], borderRadius: 16, backgroundColor: d > 0 ? colors.brand.subtle : colors.surface.sunken }}>
          <Text variant="bodyXs" tone="secondary">ครั้งนี้</Text>
          <Text style={{ fontFamily: fontFamily.bold, fontSize: 26, lineHeight: 36, color: d > 0 ? colors.brand.primary : colors.text.secondary }}>{d > 0 ? `↘${d}` : '–'}</Text>
        </View>
      </View>
      {prev && vAfter !== undefined ? (
        <Text variant="bodyXs" tone="tertiary">
          เทียบครั้งก่อน ({prev.date}): หลังนวด {prev.painAfter} → {vAfter}
        </Text>
      ) : null}

      {/* วินิจฉัย (แพทย์แผนไทยบันทึกในหลังบ้าน) + รหัส ICD-10 ชุดเดียวกับหลังบ้าน */}
      <Section icon="clipboard" tint="#2F6FA3" title="วินิจฉัย">
        <Text variant="bodyMd">{r.diagnoses?.join(' · ') ?? tc.condition}</Text>
        {dx ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Chip text={`ICD-10 ${dx.code}`} />
            <Chip text={dx.en} />
          </View>
        ) : null}
      </Section>

      <Section icon="activity" tint={colors.brand.primary} title="การรักษาครั้งนี้">
        <Info k="แรงนวด" v={r.pressure} />
        <Info k="เวลา" v={`${r.duration} นาที`} />
        <View style={{ gap: space[2] }}>
          <Text variant="bodySm" tone="secondary">วิธีนวด</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {r.techniques.map((t) => (
              <Chip key={t} text={t} />
            ))}
          </View>
        </View>
        <View style={{ gap: space[2] }}>
          <Text variant="bodySm" tone="secondary">บริเวณ</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {tc.areas.map((a) => (
              <Chip key={a.pin} text={a.label} tone="good" />
            ))}
          </View>
        </View>
        {r.herbs.length ? <Info k="สมุนไพร" v={r.herbs.join(', ')} /> : null}
        {procs.length ? <Info k="รหัสหัตถการ" v={procs.join(', ')} /> : null}
      </Section>

      <Section icon="edit-3" tint="#7C6CD4" title="บันทึกจากผู้ให้บริการ">
        <Text variant="bodyMd">{r.note}</Text>
        <Text variant="bodyXs" tone="tertiary">{r.therapist}</Text>
      </Section>

      <Section icon="check-circle" tint="#C2782B" title="คำแนะนำหลังนวด">
        {r.advice.map((a) => (
          <View key={a} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#C2782B' }} />
            <Text variant="bodySm">{a}</Text>
          </View>
        ))}
      </Section>
    </View>
  );
}

/** แถบเลือกครั้ง (เลื่อนแนวนอน) — ภาพรวม + ครั้งที่ 1…n (ล่าสุดอยู่ขวาสุด · เปิดมาเลื่อนให้เห็นครั้งล่าสุด) */
export function VisitTabs({ count, dates, value, onChange, inset = space[5] }: { count: number; dates: string[]; value: number | null; onChange: (v: number | null) => void; /** ระยะขอบซ้ายขวาของภาชนะ (เลื่อนชิดขอบจอได้) */ inset?: number }) {
  const { colors } = useTheme();
  const ref = React.useRef<ScrollView>(null);
  const item = (key: string, label: string, sub: string | null, on: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={sub ? `${label} ${sub}` : label}
      onPress={onPress}
      style={{ minWidth: 64, paddingHorizontal: space[3], paddingVertical: 6, borderRadius: 14, alignItems: 'center', backgroundColor: on ? colors.text.primary : colors.surface.default, borderWidth: 1, borderColor: on ? colors.text.primary : colors.border.subtle }}
    >
      <Text variant="labelMd" color={on ? colors.text.inverse : colors.text.primary}>
        {label}
      </Text>
      {sub ? (
        <Text variant="caption" color={on ? 'rgba(255,255,255,0.75)' : colors.text.tertiary}>
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );
  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -inset }} contentContainerStyle={{ gap: space[2], paddingHorizontal: inset }}>
      {item('all', 'ภาพรวม', 'ทุกครั้ง', value === null, () => onChange(null))}
      {Array.from({ length: count }, (_, i) => item(`v${i}`, `ครั้งที่ ${i + 1}`, dates[i], value === i, () => onChange(i)))}
    </ScrollView>
  );
}

function StepBtn({ icon, label, disabled, onPress }: { icon: React.ComponentProps<typeof Icon>['name']; label: string; disabled?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface.sunken, opacity: disabled ? 0.35 : 1 }}>
      <Icon name={icon} size="sm" />
    </Pressable>
  );
}
