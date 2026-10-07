import React from 'react';
import { View } from 'react-native';
import { AppBar, Button, Icon, Panel, ReplyChips, ScaleSelector, Screen, Text, TextField, TINT, space, useTheme } from '../../design-system';
import { FU_ADVERSE, FU_RISK } from '../../data/homeFeed';
import { preVisitRed, preVisitSummary } from '../../data/preVisit';
import { useJourney } from '../../state/JourneyContext';
import { useNav } from '../../navigation/types';
import { NotFoundScreen } from './NotFound';

/**
 * ประเมินก่อนนวด (กรอกเอง ไม่ต้องคุยกับ AI) — ผลเหมือนตอบในแชท: บันทึกเป็นอาการก่อนนวดครั้งนี้ · ส่งให้ผู้ให้บริการ · สรุปว่าครั้งนี้จะรักษาอย่างไร
 * ประเมินแล้ว → เปิดมาที่ผลประเมิน (แก้ไขได้)
 */
export function PreVisitScreen({ route }: { route?: { params?: { caseId?: string } } }) {
  const nav = useNav();
  const { colors } = useTheme();
  const { cases, caseToday, setCaseToday, log, notifyClinic, assessLock, addSymptomNote } = useJourney();
  const [note, setNote] = React.useState('');
  const [sent, setSent] = React.useState<string[]>([]);
  const [sending, setSending] = React.useState(false);
  const tc = cases.find((c) => c.id === route?.params?.caseId);
  const saved = tc ? caseToday[tc.id] : undefined;
  const [editing, setEditing] = React.useState(!saved);
  const [pain, setPain] = React.useState<number | undefined>(saved?.pain);
  const [adverse, setAdverse] = React.useState<string | undefined>(saved?.adverse);
  const [risk, setRisk] = React.useState<string | undefined>(saved?.risk);
  if (!tc) return <NotFoundScreen title="ประเมินก่อนนวด" message="ไม่พบเรื่องที่รักษา" />;
  // เช็กอินแล้ว = ผู้ให้บริการใช้ผลนี้แล้ว (แก้ไม่ได้ แจ้งอาการเพิ่มได้) · ถูกเรียกคิว/กำลังรับบริการ = ล็อกทั้งหมด · วันนัดก่อนเช็กอิน = รอบสุดท้าย
  const lock = assessLock({ caseId: tc.id });
  const locked = lock === 'checkedIn' || lock === 'inService';
  const last = tc.visits[tc.visits.length - 1];
  const no = tc.course.done + 1;
  const hasAppt = tc.appointment.date !== '-';
  const complete = pain !== undefined && !!adverse && !!risk;

  const sendNote = async () => {
    setSending(true);
    const ok = await addSymptomNote({ caseId: tc.id }, note);
    setSending(false);
    if (ok) {
      log('ผู้รับบริการ', `แจ้งอาการเพิ่มหลังเช็กอิน: ${note.trim()}`);
      setSent((x) => [...x, note.trim()]);
      setNote('');
    }
  };
  /** บอกชัดว่าแก้ได้ไหม ตามสถานะนัด */
  const lockPanel =
    lock === 'inService' ? (
      <Panel title="กำลังรับบริการ">
        <Text variant="bodySm" tone="secondary">
          แก้ผลประเมินไม่ได้แล้ว · มีอาการอะไรเพิ่ม แจ้งผู้ให้บริการได้โดยตรง
        </Text>
      </Panel>
    ) : lock === 'checkedIn' ? (
      <Panel title="ผู้ให้บริการได้รับข้อมูลแล้ว">
        <Text variant="bodySm" tone="secondary">
          เช็กอินแล้ว แก้ผลประเมินไม่ได้ · มีอะไรเพิ่มแจ้งได้ ผู้ให้บริการจะเห็นก่อนเริ่มนวด
        </Text>
        {sent.map((t) => (
          <View key={t} style={{ flexDirection: 'row', gap: space[2], alignItems: 'center' }}>
            <Icon name="check-circle" size="xs" color={colors.brand.primary} />
            <Text variant="bodySm" style={{ flex: 1 }}>
              แจ้งแล้ว: {t}
            </Text>
          </View>
        ))}
        <TextField label="แจ้งอาการเพิ่ม" placeholder="เช่น เมื่อเช้าปวดร้าวลงขาซ้าย" value={note} onChangeText={setNote} multiline />
        <Button label={sending ? 'กำลังส่ง…' : 'ส่งให้ผู้ให้บริการ'} iconLeft="send" disabled={!note.trim() || sending} onPress={() => void sendNote()} />
      </Panel>
    ) : lock === 'final' ? (
      <Panel title="วันนัด">
        <Text variant="bodySm" tone="secondary">
          ผลประเมินนี้จะส่งให้ผู้ให้บริการ · แก้ได้จนกว่าจะเช็กอิน
        </Text>
      </Panel>
    ) : null;

  const submit = () => {
    const red = preVisitRed(adverse, risk);
    setCaseToday(tc.id, { pain: pain!, adverse, risk, red });
    log('ระบบ → ผู้ให้บริการ', `ก่อนนวด${tc.short}: วันนี้ปวด ${pain}/10 · หลังนวดครั้งก่อน ${adverse}${risk !== 'ไม่มี' ? ` · ${risk}` : ''}${red ? ' · ควรพบแพทย์ก่อนนวด' : ''}`);
    notifyClinic(red ? 'ผลประเมินก่อนนวด: ควรพบแพทย์ก่อน' : 'ผลประเมินก่อนนวดจากแอป', `${tc.short} ครั้งที่ ${tc.course.done + 1} · ปวด ${pain}/10 · หลังนวดครั้งก่อน ${adverse}${risk !== 'ไม่มี' ? ` · ${risk}` : ''}`);
    setEditing(false);
  };

  // ผลประเมิน
  if (!editing && saved) {
    const s = preVisitSummary(tc, saved);
    const tone = s.status === 'red' ? colors.status.danger : s.status === 'caution' ? colors.status.warning : colors.status.success;
    return (
      <Screen
        header={<AppBar title={`ก่อนนวดครั้งที่ ${no}`} onBack={() => nav.goBack()} />}
        footer={
          <>
            {s.status === 'red' ? (
              <Button label="ดูคำแนะนำ" onPress={() => nav.navigate('RedFlag', { reason: `ผลประเมินก่อนนวด${tc.short}` })} />
            ) : tc.appointment.today ? (
              <Button label="เช็กอิน" iconLeft="maximize" onPress={() => nav.navigate('CheckIn', { caseId: tc.id })} />
            ) : null}
            {locked ? null : <Button label="แก้ไขคำตอบ" variant="secondary" onPress={() => setEditing(true)} />}
          </>
        }
      >
        <View style={{ alignItems: 'center', gap: space[2], paddingVertical: space[2] }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={s.status === 'red' ? 'alert-triangle' : s.status === 'caution' ? 'alert-circle' : 'check-circle'} size="xl" color={tone.fg} />
          </View>
          <Text variant="headlineSm" align="center">
            {s.label}
          </Text>
          <Text variant="bodySm" tone="secondary" align="center">
            ส่งให้ผู้ให้บริการแล้ว{hasAppt ? ` · นัด ${tc.appointment.date} ${tc.appointment.time}` : ''}
          </Text>
        </View>
        {lockPanel}
        <Panel title="วันนี้">
          <Text variant="bodyMd">
            ปวด {saved.pain}/10 · หลังนวดครั้งก่อน {s.prevAfter}/10 {s.diff > 0 ? `(ปวดกลับมา +${s.diff})` : '(ผลยังคงอยู่)'}
          </Text>
          {(saved.adverse && saved.adverse !== 'ไม่มี') || (saved.risk && saved.risk !== 'ไม่มี') ? (
            <Text variant="bodySm" color={s.status === 'red' ? colors.status.danger.fg : colors.status.warning.fg}>
              {[saved.adverse && saved.adverse !== 'ไม่มี' ? `หลังนวดครั้งก่อน${saved.adverse}` : '', saved.risk && saved.risk !== 'ไม่มี' ? saved.risk : ''].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </Panel>
        <Panel title={s.status === 'red' ? 'ครั้งนี้' : 'ครั้งนี้จะได้รับ'}>
          {s.plan.map((it) => (
            <View key={it} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <Icon name={s.status === 'red' ? 'alert-triangle' : 'check-circle'} size="xs" color={s.status === 'red' ? colors.status.danger.fg : colors.brand.primary} />
              <Text variant="bodySm" style={{ flex: 1 }}>
                {it}
              </Text>
            </View>
          ))}
          {s.status !== 'red' && tc.prep.length ? (
            <Text variant="bodySm" tone="secondary">
              ก่อนมา: {tc.prep.join(' · ')}
            </Text>
          ) : null}
        </Panel>
      </Screen>
    );
  }

  // เช็กอินแล้วยังไม่ได้ประเมิน → ประเมินไม่ได้แล้ว แจ้งอาการเพิ่มได้อย่างเดียว
  if (locked)
    return (
      <Screen header={<AppBar title={`ก่อนนวดครั้งที่ ${no}`} onBack={() => nav.goBack()} />}>
        {lockPanel}
      </Screen>
    );
  // แบบฟอร์ม 3 ข้อ
  return (
    <Screen
      header={<AppBar title={`ประเมินก่อนนวดครั้งที่ ${no}`} onBack={() => nav.goBack()} />}
      footer={
        <>
          <Button label="ส่งผลประเมิน" disabled={!complete} onPress={submit} />
          {/* อยากเล่าเพิ่ม/ถาม → คุยกับ AI ในแชทของเรื่องนี้แทนได้ */}
          <Button label="คุยกับ AI แทน" variant="secondary" onPress={() => nav.popTo('ClientTabs', { screen: 'Home', params: { assessCase: tc.id } })} />
        </>
      }
    >
      {lockPanel}
      <Panel title="วันนี้ปวดเท่าไหร่">
        <ScaleSelector value={pain} onChange={setPain} compareValue={last.selfPain ?? last.painAfter} compareLabel="หลังนวดครั้งก่อน" minLabel="ไม่ปวด" maxLabel="ปวดมาก" />
      </Panel>
      <Panel title="หลังนวดครั้งก่อน มีอาการผิดปกติไหม">
        <ReplyChips options={FU_ADVERSE} selected={adverse} onPick={setAdverse} />
      </Panel>
      <Panel title="ช่วงนี้มีข้อใดต่อไปนี้ไหม">
        <ReplyChips options={FU_RISK} selected={risk} onPick={setRisk} />
        {preVisitRed(adverse, risk) ? (
          <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'center' }}>
            <Icon name="alert-triangle" size="xs" color={TINT.red} />
            <Text variant="bodySm" style={{ flex: 1 }}>
              ควรพบแพทย์ก่อนนวดครั้งนี้
            </Text>
          </View>
        ) : null}
      </Panel>
    </Screen>
  );
}
