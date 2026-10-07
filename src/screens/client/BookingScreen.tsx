import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { AppBar, Badge, Button, Icon, InfoRow, Panel, RowLink, Screen, StatTile, Tag, TINT, Text, useHideTabs, useTheme } from '../../design-system';
import { radius, space } from '../../design-system/tokens';
import { useJourney } from '../../state/JourneyContext';
import { useNav } from '../../navigation/types';
import { PLACES, callClinic, clinicPhone } from './PlacesScreen';
import { isCloud, isoToLabel } from '../../services/clinicBridge';
import { anyoneSlots, dayLabel, therapistsAt, type ServiceId } from '../../data/booking';
import { caseClinic, serviceMismatch, useAllAppointments } from '../../state/appointments';
import { ANY_THERAPIST, AnyTherapistCard, THERAPIST_CARD_W, TherapistCard } from './places/TherapistCard';

/* ============================================================ จองนวด
 * ต่อจากการประเมินกับ AI: สรุปอาการ + ข้อควรระวัง → เลือกบริการ (แนะนำจากแนวทาง) → วันเวลา → ผู้ให้บริการ → ยืนยัน
 * สิทธิบัตรทองครอบคลุม นวด ประคบ อบ ฟื้นฟูหลังคลอด (health profile 2568 หน้า 21)
 * ระดับผู้ให้บริการ: นวดเพื่อบำบัดโรค = ผู้ประกอบวิชาชีพแพทย์แผนไทย (health profile 2568 หน้า 34)
 */

/**
 * ชื่อ/เวลาตามหลังบ้าน ThaiWellAI (s2 · s5 · s3 · s1 · s4) · เพื่อการรักษาอยู่บน
 * style = แนวการนวดจากคลังความรู้ (KH หน้า 3 · CPG หน้า 150–151: นวดรักษาใช้แบบราชสำนัก) และขอบเขตตามกฎหมาย (KH หน้า 5)
 */
export const SERVICES: { value: ServiceId; label: string; uc: boolean; style: string }[] = [
  { value: 'royal', label: 'นวดไทยเพื่อการรักษา · 60 นาที', uc: true, style: 'นวดแบบราชสำนัก โดยแพทย์แผนไทย' },
  { value: 'royal+compress', label: 'นวดไทยร่วมประคบสมุนไพร · 90 นาที', uc: true, style: 'นวดแบบราชสำนัก + ลูกประคบ โดยแพทย์แผนไทย' },
  { value: 'compress', label: 'ประคบสมุนไพร · 60 นาที', uc: true, style: 'ลูกประคบสมุนไพรอุ่น' },
  { value: 'relax', label: 'นวดไทยเพื่อสุขภาพ · 60 นาที', uc: false, style: 'บริการเวลเนส ไม่ใช่การรักษา' },
  { value: 'foot', label: 'นวดเท้าเพื่อสุขภาพ · 60 นาที', uc: false, style: 'บริการเวลเนส ไม่ใช่การรักษา' },
];
export const THERAPISTS = [
  { value: 't2', label: 'พท.ป. วิภาวดี ศรีสุข', description: 'แพทย์แผนไทย' },
  { value: 't1', label: 'นศ.พท. สมชาย', description: 'นักศึกษาแพทย์แผนไทย' },
];
const CLINIC = 'คลินิกแพทย์แผนไทย สาขาสุขุมวิท';

type BookingParams = { clinic?: string; therapist?: string; day?: string; time?: string; service?: ServiceId; caseId?: string; draftId?: string; looseId?: string };
/** เรื่องที่จอง: ใบการรักษา / ใบร่าง / นัดเรื่องใหม่ที่มีอยู่ (เลื่อน) / เรื่องใหม่ (นัดเพิ่ม) */
type Topic = { key: string; caseId?: string; draftId?: string; looseId?: string; title: string; sub?: string };

export function BookingScreen({ route }: { route?: { params?: BookingParams } }) {
  const nav = useNav();
  const pre = route?.params;
  useHideTabs(true);
  const { colors } = useTheme();
  const { log, newPatient, setCareStage, drafts, activeDraftId, upsertDraft, cases, looseBookings, addLooseBooking, updateLooseBooking, setCaseAppointment, issueQueue, requestBooking, bookCase } = useJourney();
  const allAppts = useAllAppointments();
  // สถานที่ที่เลือกมา (หน้าสถานที่) · เรื่องที่รักษาอยู่ใช้ที่เดิมเสมอ (ดูด้านล่าง)
  // ใช้งานจริง: ชื่อคลินิกตามที่คลินิกตั้งไว้ (ตรงกับหน้าสถานที่)
  const pickedClinic = pre?.clinic ?? (isCloud() ? PLACES[0]?.name : undefined) ?? CLINIC;

  /* ---------- จองให้เรื่องไหน ---------- */
  // ระบุมาแล้ว (จากการ์ดของเรื่องนั้น) → ไม่ต้องเลือก · ไม่ระบุ → เลือกในหน้านี้ (ไม่เดาจากใบที่ประเมินล่าสุด)
  const topics: Topic[] = [
    ...drafts.map((d) => ({
      key: `d:${d.id}`,
      draftId: d.id,
      title: d.guide?.areas && d.guide.areas.length > 1 ? `${d.guide.areas[0].region ?? d.guide.areas[0].symptom} +${d.guide.areas.length - 1}` : d.title,
      sub: d.booking ? `มีนัด ${d.booking.date} ${d.booking.time}` : d.assessedOn ? `ประเมิน ${isoToLabel(d.assessedOn)}` : 'ประเมินแล้ว',
    })),
    // เรื่องที่รักษาอยู่ → จองได้เฉพาะที่เดิม (บอกไว้ในตัวเลือก)
    // เรื่องที่รักษาอยู่ไม่อยู่ในรายการนี้: นัดครั้งถัดไปมาจากแผนของแพทย์ (คลินิกนัดให้) · จองเรื่องใหม่/นวดผ่อนคลายเพิ่มได้
    // นัดเรื่องใหม่ที่จองไว้แล้ว → เลือก = เลื่อนนัดนั้น
    ...looseBookings.map((b) => ({ key: `l:${b.id}`, looseId: b.id, title: `นัดเรื่องใหม่ ${b.date} ${b.time}`, sub: `เลื่อนนัดนี้ · ${b.clinic}` })),
    // เรื่องใหม่ (ยังไม่ได้เล่าอาการ) → นัดเพิ่มได้หลายนัด ไม่ทับนัดเดิม
    { key: 'new', title: newPatient && !looseBookings.length ? 'ยังไม่ได้เล่าอาการ' : 'เรื่องใหม่', sub: looseBookings.length ? 'นัดเพิ่ม · เล่าอาการกับ AI ทีหลัง' : 'จองก่อน เล่าอาการกับ AI ทีหลัง' },
  ];
  const fixed = !!(pre?.caseId || pre?.draftId || pre?.looseId);
  /**
   * จองนัดใหม่ (ไม่ได้มาจากการ์ดของเรื่องไหน) → เลือกได้เฉพาะเรื่องที่ประเมินแล้วยังไม่จอง + เรื่องใหม่
   * ไม่แสดง: เรื่องที่จองแล้ว/นัดที่ยังไม่ประเมิน (เลื่อนนัดจากการ์ดนัด) · ควรพบแพทย์ก่อน (จองนวดไม่ได้) · นวดแล้ว/ทำคอร์ส (แพทย์วางแผน คลินิกนัดให้)
   */
  const pickable = topics.filter((t) => t.key === 'new' || (t.draftId && drafts.some((d) => d.id === t.draftId && !d.booking && !d.red && d.stage === 'assessed')));
  const initialKey = pre?.caseId
    ? `c:${pre.caseId}`
    : pre?.draftId
      ? `d:${pre.draftId}`
      : pre?.looseId
        ? `l:${pre.looseId}`
        : (pickable.find((t) => t.draftId === activeDraftId) ?? pickable[0])?.key;
  const [topicKey, setTopicKey] = React.useState(initialKey ?? 'new');
  const topic = topics.find((t) => t.key === topicKey) ?? topics[0];
  const draft = drafts.find((d) => d.id === topic?.draftId);
  const tc = cases.find((c) => c.id === topic?.caseId);
  const loose = looseBookings.find((b) => b.id === topic?.looseId);
  const red = !!draft?.red;
  // เรื่องที่รักษาอยู่: นัดครั้งถัดไปต้องที่เดิม (ไม่ใช่สถานที่ที่เปิดดูมา)
  const clinic = tc ? caseClinic(tc) : pickedClinic;
  const clinicLocked = !!tc && pickedClinic !== clinic && !!pre?.clinic;
  // นัดเดิมของเรื่องนี้ → การยืนยันคือ "เลื่อนนัด" (แทนที่ ไม่ซ้อน) · เรื่องใหม่ = นัดเพิ่ม
  const current = tc && tc.appointment.date !== '-' ? { date: tc.appointment.date, time: tc.appointment.time } : draft?.booking ?? loose ?? null;

  /* ---------- บริการ ---------- */
  // ใบการรักษา = นวดเพื่อรักษาเท่านั้น (ไม่มีนวดผ่อนคลาย) · ข้อควรระวังเรื่องอบ/ประคบ → ไม่แนะนำประคบ
  const caution = draft?.caution ?? '';
  /**
   * บริการที่แนะนำของเรื่องนั้น — ตามแนวทางการรักษา (วิธีมีประคบ = นวด + ประคบ) เว้นแต่ข้อควรระวังให้งดประคบ/อบ
   * การรักษาที่ทำอยู่ = ตามแผนของแพทย์ · เรื่องใหม่ (ยังไม่ประเมิน) = ไม่มีคำแนะนำ
   */
  const recommendedFor = (d?: typeof draft, c?: typeof tc): ServiceId | undefined => {
    if (c) return c.plan.includes('ประคบ') ? 'royal+compress' : 'royal';
    if (!d) return undefined;
    const noCompress = /อบ|ประคบ/.test(d.caution ?? '');
    const withCompress = d.guide ? d.guide.methods.some((m) => m.includes('ประคบ')) : true;
    return withCompress && !noCompress ? 'royal+compress' : 'royal';
  };
  const recommended: ServiceId = recommendedFor(draft, tc) ?? 'royal';
  const hasRecommendation = !!recommendedFor(draft, tc);
  const services = tc ? SERVICES.filter((x) => x.value !== 'relax') : SERVICES;
  const [service, setService] = React.useState<ServiceId>(pre?.service ?? recommended);

  // ผู้ให้บริการของสถานที่นี้ที่ลงตารางรับบริการที่เลือก (แบบ shift.services หลังบ้าน) · เลือกเวลาในการ์ด = เลือกทั้งคนและเวลา
  const place = PLACES.find((x) => x.name === clinic);
  const staff = place ? therapistsAt(place.id, service) : [];
  // ไม่ระบุแพทย์ = รวมคิวว่างทุกคนที่รับบริการนี้
  const anySlots = place ? anyoneSlots(place.id, service) : [];
  const [pick, setPick] = React.useState<{ id: string; day: string; time: string } | null>(() => {
    if (!pre?.day || !pre?.time) return null;
    if (pre.therapist === 'ไม่ระบุแพทย์') return { id: ANY_THERAPIST, day: pre.day, time: pre.time };
    const t = staff.find((x) => x.name === pre.therapist);
    return t ? { id: t.id, day: pre.day, time: pre.time } : null;
  });
  const any = pick?.id === ANY_THERAPIST;
  const picked = staff.find((x) => x.id === pick?.id);
  // ช่องที่เลือกยังรับบริการนี้อยู่ไหม (เปลี่ยนบริการแล้วคน/เวลาเดิมอาจไม่รับ → ล้างให้เลือกใหม่)
  const slotOk = (id: string, day: string, time: string, v = service) =>
    !!place &&
    (id === ANY_THERAPIST
      ? anyoneSlots(place.id, v).some((f) => dayLabel(f.day) === day && f.time === time)
      : !!therapistsAt(place.id, v).find((x) => x.id === id)?.free.some((f) => dayLabel(f.day) === day && f.time === time));
  const pickService = (v: ServiceId) => {
    setService(v);
    if (pick && !slotOk(pick.id, pick.day, pick.time, v)) setPick(null);
  };
  const pickTopic = (k: string) => {
    setTopicKey(k);
    const t = topics.find((x) => x.key === k);
    const c = cases.find((x) => x.id === t?.caseId);
    const d = drafts.find((x) => x.id === t?.draftId);
    // เลือกเรื่องที่ประเมินแล้ว → บริการตามแนวทางของเรื่องนั้น (เปลี่ยนเองได้) · ใบการรักษาไม่มีนวดผ่อนคลาย
    const rec = recommendedFor(d, c);
    if (rec && rec !== service) pickService(rec);
  };
  const pickLabel = pick ? `${any ? 'ไม่ระบุแพทย์' : picked?.name ?? ''} · ${pick.day} ${pick.time}` : null;
  // เวลาชนกับนัดอื่นของเรา (ไม่นับนัดเดิมของเรื่องนี้ที่กำลังเลื่อน) → จองซ้อนเวลาเดียวกันไม่ได้
  const selfKey = tc ? `c:${tc.id}` : draft ? `d:${draft.id}` : loose ? `l:${loose.id}` : '';
  const clash = pick ? allAppts.find((a) => a.key !== selfKey && a.date === pick.day && a.time === pick.time) : undefined;
  const ready = !red && !!pick && (any || !!picked) && slotOk(pick.id, pick.day, pick.time) && !clash;

  const confirm = () => {
    const svc = SERVICES.find((x) => x.value === service)!;
    if (!pick || !ready) return;
    // ไม่ระบุแพทย์ → จัดคนแรกที่ว่างช่วงนั้น (แพทย์แผนไทยก่อน)
    const who = any ? anySlots.find((f) => dayLabel(f.day) === pick.day && f.time === pick.time)?.who[0] : picked;
    if (!who) return;
    const today = pick.day === 'วันนี้';
    const queue = today ? issueQueue() : undefined;
    // จองจากแอป = คำขอจอง → รอเจ้าหน้าที่คลินิกยืนยัน (เลขคิวออกตอนยืนยัน)
    const bk = { date: pick.day, time: pick.time, service: svc.label, therapist: who.name, clinic, queue: tc ? queue : undefined, visit: tc ? tc.course.done + 1 : 1, status: tc ? undefined : ('pending' as const) };
    const label = `${pick.day} ${pick.time}`;
    if (tc) bookCase(tc.id, { today, date: pick.day, time: pick.time, queue, clinic, therapist: who.name }, svc.label);
    else if (draft) {
      upsertDraft({ ...draft, stage: 'booked', booking: bk });
      requestBooking({ draftId: draft.id }, label);
    } else if (loose) {
      updateLooseBooking(loose.id, bk);
      requestBooking({ looseId: loose.id }, label);
    } else requestBooking({ looseId: addLooseBooking(bk) }, label);
    if (newPatient && !tc) setCareStage('booked');
    const named = tc || draft;
    log('ผู้รับบริการ', `${current ? 'เลื่อนนัด' : 'จองนวด'} ${pick.day} ${pick.time} · ${svc.label} · ${who.name}${any ? ' (ไม่ระบุแพทย์)' : ''}${named ? ` · ${topic!.title}` : ''}`);
    nav.replace('BookingDone', { ...bk, topic: named ? topic!.title : undefined, caution: caution || undefined, moved: !!current, pending: !tc });
  };

  // นัดของเรื่องที่รักษาอยู่ = แผนของแพทย์ (คลินิกนัด/เลื่อน/ยกเลิกให้) → ในแอปดูได้อย่างเดียว ติดต่อคลินิก
  const lockedCase = pre?.caseId ? cases.find((c) => c.id === pre.caseId) : undefined;
  if (lockedCase) {
    const has = lockedCase.appointment.date !== '-';
    return (
      <Screen header={<AppBar onBack={() => nav.goBack()} title="นัดของการรักษา" />} footer={<Button label={`ติดต่อคลินิก ${clinicPhone(caseClinic(lockedCase))}`} iconLeft="phone" onPress={() => callClinic(caseClinic(lockedCase))} />}>
        <Panel icon="calendar" tint={TINT.amber} title={has ? `มีนัด ${lockedCase.appointment.date} ${lockedCase.appointment.time}` : 'รอคลินิกนัดครั้งถัดไป'}>
          <Text variant="bodySm" tone="secondary">
            {has ? 'นัดของการรักษาเลื่อนหรือยกเลิกได้ที่คลินิก คลินิกจะแก้ไขให้และแจ้งเตือนในแอป' : 'แพทย์จะนัดครั้งถัดไปตามแผนการรักษา และแจ้งเตือนในแอป'}
          </Text>
        </Panel>
      </Screen>
    );
  }
  // นัดเดิมบริการไม่ตรงผลประเมิน → หน้านี้คือ "เปลี่ยนบริการ" (ไม่ใช่แค่เลื่อนเวลา)
  const wrongService = !!draft?.booking && !draft.keepService && !!serviceMismatch(draft.booking.service, draft.caution);
  const title = wrongService ? 'เปลี่ยนบริการ' : current ? 'เลื่อนนัด' : tc ? `จองครั้งที่ ${Math.min(tc.course.total, tc.course.done + 1)}` : 'จองนวด';
  return (
    <Screen
      header={<AppBar onBack={() => nav.goBack()} title={title} />}
      footer={<Button label={red ? 'ควรพบแพทย์ก่อนนวด' : clash ? `เวลานี้มีนัด${clash.topic}แล้ว` : ready ? `ยืนยัน ${pick!.day} ${pick!.time}` : 'เลือกผู้ให้บริการและเวลา'} disabled={!ready} onPress={confirm} />}
    >
      {/* สถานที่ที่จอง */}
      <Panel flush>
        <RowLink icon="map-pin" tint={TINT.green} title={clinic} sub={tc ? 'สถานที่ที่รักษาอยู่ (นัดต่อที่เดิม)' : 'สถานที่'} last />
      </Panel>

      {/* เปิดจากสถานที่อื่น แต่เลือกเรื่องที่รักษาอยู่ → บอกว่าย้ายมาที่เดิม */}
      {clinicLocked ? (
        <Text variant="bodySm" tone="secondary">
          เรื่องที่รักษาอยู่จองต่อได้เฉพาะ{clinic}
        </Text>
      ) : null}

      {/* จองให้เรื่องไหน — มีหลายเรื่อง/ไม่ได้ระบุมา → เลือก (นัดไปอยู่ที่การ์ดของเรื่องนั้น) */}
      {/* จองให้เรื่องไหน — แยกการ์ดทีละเรื่อง (เลือกได้หนึ่ง) · เรื่องที่ประเมินแล้วก่อน เรื่องใหม่ท้ายสุด */}
      {!fixed && pickable.length > 1 ? (
        <View style={{ gap: space[2] }}>
          <Text variant="labelLg">จองให้เรื่องไหน</Text>
          {pickable.map((t) => {
            const on = t.key === topicKey;
            return (
              <Pressable
                key={t.key}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${t.title} ${t.sub ?? ''}`}
                onPress={() => pickTopic(t.key)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space[3],
                  padding: space[4],
                  borderRadius: 20,
                  backgroundColor: colors.surface.default,
                  borderWidth: on ? 2 : 1,
                  borderColor: on ? colors.brand.primary : colors.border.subtle,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="labelMd">{t.title}</Text>
                  {t.sub ? (
                    <Text variant="bodyXs" tone="secondary">
                      {t.sub}
                    </Text>
                  ) : null}
                </View>
                <Icon name={on ? 'check-circle' : 'circle'} size="sm" color={on ? colors.brand.primary : colors.text.tertiary} />
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {/* การรักษาที่ทำอยู่ไม่อยู่ในรายการ → บอกเหตุผลสั้น ๆ */}
      {!fixed && cases.length ? (
        <Text variant="bodyXs" tone="tertiary">
          นัดครั้งถัดไปของการรักษาที่ทำอยู่ คลินิกจะนัดให้ตามแผน
        </Text>
      ) : null}

      {/* ข้อมูลของเรื่องที่จอง — ผู้ให้บริการเห็นก่อนถึงคิว */}
      {red ? (
        <Panel icon="alert-triangle" tint={TINT.red} title="ควรพบแพทย์ก่อนนวด">
          <Text variant="bodySm" tone="secondary">
            ผลประเมิน{draft?.title}มีสัญญาณที่ต้องให้แพทย์ตรวจก่อน
          </Text>
          <Button label="ดูคำแนะนำ" variant="secondary" size="md" onPress={() => nav.navigate('RedFlag', { reason: draft?.title })} />
        </Panel>
      ) : draft ? (
        <Panel icon="clipboard" tint={TINT.violet} title="จากการประเมิน">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {draft.symptoms.map((x) => (
              <Tag key={x} text={x} />
            ))}
            <Tag text={`ปวด ${draft.pain}/10`} tone="warn" />
          </View>
          {draft.caution ? (
            <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'center' }}>
              <Icon name="alert-triangle" size="xs" color={colors.status.warning.fg} />
              <Text variant="bodySm">{draft.caution}</Text>
            </View>
          ) : null}
        </Panel>
      ) : tc ? (
        <Panel icon="clipboard" tint={TINT.violet} title={`รักษา${tc.short}`}>
          <InfoRow k="แผน" v={tc.plan} />
          <InfoRow k="คอร์ส" v={`ครั้งที่ ${Math.min(tc.course.total, tc.course.done + 1)} / ${tc.course.total}`} />
        </Panel>
      ) : (
        <Panel icon="message-circle" tint={TINT.violet} title={loose ? 'นัดเรื่องใหม่' : 'ยังไม่ได้เล่าอาการ'}>
          <Text variant="bodySm" tone="secondary">
            เล่าอาการกับ AI ก่อนถึงนัด ให้นวดได้ตรงจุด
          </Text>
        </Panel>
      )}

      {current && !red ? (
        <Panel flush>
          <RowLink icon="calendar" tint={TINT.amber} title={`นัดเดิม ${current.date} ${current.time}`} sub={wrongService ? `${draft?.booking?.service ?? ''} · ยืนยันแล้วนัดใหม่จะแทนนัดนี้` : 'ยืนยันแล้วนัดใหม่จะแทนนัดนี้'} last />
        </Panel>
      ) : null}
      {/* เปลี่ยนตามคำแนะนำ = ทางเลือก ไม่บังคับ → เปลี่ยนใจใช้แผนเดิมได้ตลอด (เลือกเวลา/แพทย์เองก่อนยืนยัน) */}
      {wrongService && draft ? (
        <Button
          label="ใช้แผนเดิม ไม่เปลี่ยน"
          variant="ghost"
          size="md"
          onPress={() => {
            upsertDraft({ ...draft, keepService: true });
            log('ผู้รับบริการ', `คงบริการที่จองไว้ (${draft.booking?.service ?? ''}) แม้ไม่ตรงผลประเมิน`);
            nav.goBack();
          }}
        />
      ) : null}

      {red ? null : (
        <>
          <Panel icon="activity" tint={TINT.green} title="บริการ" flush>
            {services.map((sv, i) => (
              <Choice
                key={sv.value}
                on={service === sv.value}
                title={sv.label}
                sub={[sv.style, sv.uc ? 'บัตรทอง' : ''].filter(Boolean).join(' · ')}
                badge={sv.value === recommended && hasRecommendation ? 'ตามผลประเมิน' : undefined}
                onPress={() => pickService(sv.value)}
                last={i === services.length - 1}
              />
            ))}
          </Panel>

          {/* ผู้ให้บริการ + เวลา: การ์ดรายคน เลื่อนแนวนอน */}
          <View style={{ gap: space[2] }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Text variant="labelLg">ผู้ให้บริการและเวลา</Text>
              <Text variant="bodyXs" tone="tertiary">
                {ready ? pickLabel : 'แตะเวลาในการ์ด'}
              </Text>
            </View>
            {staff.length ? (
              <ScrollView key={service} horizontal showsHorizontalScrollIndicator={false} snapToInterval={THERAPIST_CARD_W + space[3]} decelerationRate="fast" style={{ marginHorizontal: -space[4] }} contentContainerStyle={{ gap: space[3], paddingHorizontal: space[4] }}>
                <AnyTherapistCard slots={anySlots} selected={any ? pick : null} onPick={(d, tm) => setPick({ id: ANY_THERAPIST, day: d, time: tm })} />
                {staff.map((t) => (
                  <TherapistCard key={t.id} t={t} selected={pick?.id === t.id ? pick : null} onPick={(d, tm) => setPick({ id: t.id, day: d, time: tm })} />
                ))}
              </ScrollView>
            ) : (
              // ไม่มีใครรับบริการนี้ → บอกทางไปต่อ (เปลี่ยนบริการ / ที่อื่น) ไม่ให้ค้าง
              <Panel>
                <Text variant="bodySm" tone="secondary">
                  {!place ? 'ไม่พบตารางของสถานที่นี้' : therapistsAt(place.id).length ? 'บริการนี้ยังไม่มีคิว ลองเลือกบริการอื่น' : 'ที่นี่ยังไม่เปิดจองออนไลน์'}
                </Text>
                <Button label="ดูสถานที่อื่น" variant="secondary" size="md" onPress={() => nav.popTo('ClientTabs', { screen: 'Places' })} />
              </Panel>
            )}
          </View>
        </>
      )}
    </Screen>
  );
}

/** จองสำเร็จ — รายละเอียดนัด + เตรียมตัวก่อนมา (ข้อมูลมากับหน้า ไม่อ่านจากนัดกลาง) */
export function BookingDoneScreen({ route }: { route: { params: { date: string; time: string; service: string; therapist: string; clinic: string; queue?: string; topic?: string; caution?: string; moved?: boolean; pending?: boolean } } }) {
  const nav = useNav();
  const { colors } = useTheme();
  const b = route.params;
  // ก่อนมานวด: ตามข้อควรระวังจากการประเมิน + ทั่วไป (ไม่นวดภายใน 30 นาทีหลังอาหาร — ตำราอ้างอิงฯ หน้า 402)
  const prep = [...(b.caution?.includes('ความดัน') || b.caution?.includes('อบ') ? ['วัดความดันก่อนนวด'] : []), 'งดอาหารหนักก่อนนวด 30 นาที', 'ใส่เสื้อผ้าหลวมสบาย'];
  return (
    <Screen
      header={<AppBar title={b.pending ? 'ส่งคำขอแล้ว' : b.moved ? 'เลื่อนนัดแล้ว' : 'จองแล้ว'} />}
      footer={<Button label="กลับหน้าแรก" onPress={() => nav.popTo('ClientTabs', { screen: 'Home' })} />}
    >
      <View style={{ alignItems: 'center', gap: space[2], paddingVertical: space[3] }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.brand.subtle, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="check" size="lg" color={colors.brand.primary} />
        </View>
        <Text variant="titleLg">{b.pending ? (b.moved ? 'ส่งคำขอเลื่อนนัดแล้ว' : 'ส่งคำขอจองแล้ว') : b.moved ? 'เลื่อนนัดเรียบร้อย' : 'จองเรียบร้อย'}</Text>
        {/* คำขอจองจากแอป ต้องให้คลินิกยืนยันก่อน (อาจได้เวลาอื่นถ้าคิวเต็ม) */}
        {b.pending ? (
          <Text variant="bodySm" tone="secondary" align="center">
            รอคลินิกยืนยัน จะแจ้งเตือนในแอปเมื่อยืนยันแล้ว
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <StatTile label="วัน" value={b.date} small />
        <StatTile label="เวลา" value={b.time} small />
        {/* เลขคิวออกเฉพาะนัดวันนี้ */}
        {b.queue ? <StatTile label="คิว" value={b.queue} small color={colors.brand.primary} /> : null}
      </View>
      <Panel icon="clipboard" tint={TINT.green} title="รายละเอียดนัด">
        {b.topic ? <InfoRow k="เรื่อง" v={b.topic} /> : null}
        <InfoRow k="บริการ" v={b.service} />
        <InfoRow k="ผู้ให้บริการ" v={b.therapist} />
        <InfoRow k="สถานที่" v={b.clinic} />
      </Panel>
      <Panel icon="check-circle" tint={TINT.amber} title="ก่อนมานวด">
        {prep.map((p) => (
          <View key={p} style={{ flexDirection: 'row', gap: space[2], alignItems: 'center' }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: TINT.amber }} />
            <Text variant="bodySm">{p}</Text>
          </View>
        ))}
      </Panel>
    </Screen>
  );
}

/** ตัวเลือกแบบแถวในการ์ด (เลือกได้ 1) — วงกลมเลือก · ชื่อ · รายละเอียด */
function Choice({ on, title, sub, onPress, last, badge }: { on: boolean; title: string; sub?: string; onPress: () => void; last?: boolean; /** ป้ายมุมขวา (เช่น บริการที่แนะนำ) */ badge?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={onPress} style={({ pressed }) => ({ backgroundColor: on ? colors.brand.subtle : pressed ? colors.surface.sunken : 'transparent' })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], marginHorizontal: space[4], borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border.subtle }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? colors.brand.primary : colors.border.strong, alignItems: 'center', justifyContent: 'center' }}>
          {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand.primary }} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="labelMd">{title}</Text>
          {sub ? (
            <Text variant="bodyXs" tone="secondary">
              {sub}
            </Text>
          ) : null}
        </View>
        {badge ? <Badge label={badge} tone="brand" /> : null}
      </View>
    </Pressable>
  );
}
