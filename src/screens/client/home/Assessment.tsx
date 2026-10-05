import React from 'react';
import { Pressable, View } from 'react-native';
import { Icon, ReplyChips, Text, componentTokens, radius, space, useTheme } from '../../../design-system';
import { ASSESS_ASK, ASSESS_ORDER, CAUSE_OPTIONS, DURATION_OPTIONS, HEALTH_OPTIONS, PRESSURE_OPTIONS, RISK_OPTIONS, type AssessStep, type Assessment } from '../../../data/homeFeed';
import { PillButton } from './ThreadCards';

/**
 * ตัวเลือกแบบเลือกได้หลายข้อ (อาการ / อาการร่วม / ส่วนอื่นของร่างกาย) — หน้าตาเดียวกับตัวเลือกข้ออื่นในแชท (ReplyChips)
 * แตะ = เลือก/เอาออก · title = ป้ายกลุ่ม (เช่น ที่พบได้บ่อย)
 */
function ChoiceSection({ title, options, value, onChange }: { title?: string; options: string[]; value: string[]; onChange: (next: string[]) => void }) {
  return (
    <View style={{ gap: space[2] }}>
      {title ? (
        <Text variant="bodyXs" tone="secondary">
          {title}
        </Text>
      ) : null}
      <ReplyChips options={options} selected={value} onPick={(o) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])} />
    </View>
  );
}
import { HOME_CONTENT, SYMPTOM_GROUPS } from '../../../data/homeContent';
import { radiateFor } from '../../../data/radiation';

type Step = Exclude<AssessStep, 'done'>;
const NONE = 'ไม่มีอาการร่วม';
const PAIN_OPTIONS = Array.from({ length: 11 }, (_, i) => `${i}`);

/**
 * ตัวเลือกตอบคำถามประเมินในบับเบิลแชท (แสดงเฉพาะหัวข้อที่กำลังถาม)
 * ทุกหัวข้อแตะครั้งเดียว = ส่งคำตอบทันที: อาการ/อาการร่วม/ระยะเวลา = chip (อาการผูกกับ mark บนหุ่น) · ความปวด = ตัวเลข 0–10 (คำตอบแสดงเป็นการ์ด Pain Score)
 */
export function AssessWidget({
  step,
  assess,
  symptoms,
  related,
  selectedIn,
  onChips,
  onPain,
  onNext,
  topics = [],
  onOther,
  radiate = [],
  onPickBody,
}: {
  /** เปิดหน้าเลือกจุดจากหุ่น (ตอบข้อนี้ด้วยการแตะบนหุ่น) */
  onPickBody?: () => void;
  /** ตัวเลือกอาการร้าว ของอาการที่ถามอยู่ */
  radiate?: string[];
  /** เลือกตำแหน่งจากรายการทั้งร่างกาย */
  onOther?: (label: string) => void;
  /** ตัวเลือกหัวข้อ "เรื่องเดิมหรืออาการใหม่" */
  topics?: string[];
  step: Step;
  assess: Assessment;
  symptoms: string[];
  related: string[];
  selectedIn: (opts: string[]) => string[];
  onChips: (opts: string[]) => (next: string[]) => void;
  onPain: (v: number) => void;
  /** ยืนยันคำตอบของหัวข้อนี้ (answer = ข้อความที่แสดงเป็นคำตอบของผู้ใช้) */
  onNext: (answer: string, patch?: Partial<Assessment>, userExtra?: { pain?: number }) => void;
}) {
  const { colors } = useTheme();
  const [more, setMore] = React.useState(false);
  /** แตะ chip = เลือก + ส่งคำตอบทันที (mark บนหุ่นตามไปด้วย) */
  const pickFrom = (opts: string[]) => (next: string[]) => {
    const cur = selectedIn(opts);
    const added = next.find((o) => !cur.includes(o));
    onChips(opts)(next);
    if (added) onNext(added);
  };
  switch (step) {
    case 'topic':
      return <ReplyChips options={topics} onPick={(o) => onNext(o, { topic: o })} />;
    case 'symptoms': {
      const common = symptoms.filter((x) => HOME_CONTENT.symptoms.includes(x));
      const others = symptoms.filter((x) => !HOME_CONTENT.symptoms.includes(x));
      return (
        <View style={{ gap: space[3] }}>
          {/* ตำแหน่งที่พบบ่อย (ตัวเลือกด่วน) · ที่เลือกจากรายการทั้งร่างกาย/แตะหุ่นแยกไว้ด้านล่าง ไม่ปนกับ "ที่พบได้บ่อย" */}
          {onPickBody ? <PillButton label="ชี้จุดบนร่างกาย" icon="target" tone="light" onPress={onPickBody} /> : null}
          <ChoiceSection title="ที่พบได้บ่อย" options={common} value={selectedIn(common)} onChange={pickFrom(common)} />
          {others.length ? <ChoiceSection options={others} value={selectedIn(others)} onChange={pickFrom(others)} /> : null}
          {/* ไม่มีใน chip ด่วน → เปิด/ปิดรายการทั้งร่างกาย (ตามส่วนของร่างกาย) · ปุ่มอยู่ตลอดเพื่อย่อกลับได้ */}
          {onOther ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: more }}
              onPress={() => setMore((v) => !v)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space[1], alignSelf: 'flex-start' }}
            >
              <Text variant="labelMd" style={{ color: colors.brand.primary }}>
                ส่วนอื่นของร่างกาย
              </Text>
              <Icon name={more ? 'chevron-up' : 'chevron-down'} size="xs" color={colors.brand.primary} />
            </Pressable>
          ) : null}
          {onOther && more
            ? SYMPTOM_GROUPS.map((g) => (
                <ChoiceSection
                  key={g.title}
                  title={g.title}
                  options={g.items.map(([l]) => l).filter((l) => !symptoms.includes(l))}
                  value={[]}
                  onChange={(next) => next.length && onOther(next[next.length - 1])}
                />
              ))
            : null}
        </View>
      );
    }
    case 'related':
      return (
        <View style={{ gap: space[3] }}>
          {onPickBody ? <PillButton label="ชี้จุดบนร่างกาย" icon="target" tone="light" onPress={onPickBody} /> : null}
          <ChoiceSection
            options={[...related, NONE]}
            value={selectedIn(related)}
            onChange={(next) => (next.includes(NONE) ? onNext(NONE) : pickFrom(related)(next))}
          />
        </View>
      );
    case 'pain':
      // แตะตัวเลขครั้งเดียว = ส่งคำตอบ · คำตอบแสดงเป็นการ์ด Pain Score ฝั่งผู้ใช้
      return (
        <ReplyChips
          options={PAIN_OPTIONS}
          onPick={(o) => {
            const v = Number(o);
            onPain(v);
            onNext(`ปวดระดับ ${v}/10`, { pain: v }, { pain: v });
          }}
        />
      );
    case 'duration':
      return <ReplyChips options={DURATION_OPTIONS} onPick={(o) => onNext(`เป็นมา ${o}`, { duration: o })} />;
    case 'cause':
      return <ReplyChips options={CAUSE_OPTIONS} onPick={(o) => onNext(o, { cause: o })} />;
    case 'health':
      // ตอบแล้วบันทึกลงโปรไฟล์ (ข้อมูลสุขภาพที่เดียว) — ไม่ต้องกรอกฟอร์มแยก
      return <ReplyChips options={HEALTH_OPTIONS} onPick={(o) => onNext(o === 'ไม่มี' ? 'ไม่มีโรคประจำตัว' : o, { health: o })} />;
    case 'radiate':
      return <ReplyChips options={radiate} onPick={(o) => onNext(o, { radiate: o })} />;
    case 'risk':
      return <ReplyChips options={RISK_OPTIONS} onPick={(o) => onNext(o === 'ไม่มี' ? 'ไม่มีข้อไหนตรง' : o, { risk: o })} />;
    case 'pressure':
      return <ReplyChips options={PRESSURE_OPTIONS} onPick={(o) => onNext(o === PRESSURE_OPTIONS[3] ? o : `แรงนวด${o}`, { pressure: o })} />;
  }
}

/**
 * สรุปการประเมิน — อยู่ข้างหุ่นแทน chip/กราฟเดิม
 * บอกว่าตอบไปแล้วอะไร เหลืออะไร · แตะหัวข้อเพื่อเลื่อนไปที่คำถามนั้นในแชท
 */
export function AssessmentTracker({
  assess,
  symptoms,
  related,
  width,
  onJump,
  body,
}: {
  assess: Assessment;
  symptoms: string[];
  related: string[];
  width: number | '100%';
  onJump: (step: AssessStep) => void;
  /** หุ่นทางขวาของการ์ด (แสดงจุดที่เลือก) — รับขนาดที่พอดีกับความสูงของรายการคำตอบ */
  body?: (size: { width: number; height: number }) => React.ReactNode;
}) {
  const { colors } = useTheme();
  const done = assess.step === 'done';
  // หัวข้อ "เรื่องเดิม/ใหม่" ไม่นับในตัวติดตาม (ถามเฉพาะเมื่อมีใบอยู่แล้ว)
  // อาการร้าว: แสดงเฉพาะเมื่ออาการที่เลือกมีรูปแบบการร้าว
  const ORDER = ASSESS_ORDER.filter((s) => s !== 'topic' && (s !== 'radiate' || assess.radiate || radiateFor(symptoms)));
  const idx = done ? ORDER.length : Math.max(0, ORDER.indexOf(assess.step as (typeof ORDER)[number]));
  const passed = (s: Step) => idx > ORDER.indexOf(s as (typeof ORDER)[number]);
  const value: Partial<Record<Step, string | undefined>> = {
    symptoms: symptoms.length ? symptoms.join(', ') : undefined,
    radiate: assess.radiate,
    related: passed('related') ? (related.length ? related.join(', ') : 'ไม่มี') : related.length ? related.join(', ') : undefined,
    pain: passed('pain') ? `${assess.pain}/10` : undefined,
    duration: assess.duration,
    cause: assess.cause,
    health: assess.health,
    risk: assess.risk,
    pressure: assess.pressure,
  };
  // หุ่นสูงเท่ารายการคำตอบ · กว้างตามสัดส่วนหุ่น (0.53) ไม่เกินราวครึ่งการ์ด
  const [listH, setListH] = React.useState(0);
  const [rowW, setRowW] = React.useState(0);
  const bodySize = listH && rowW ? { height: listH, width: Math.min(Math.round(listH * 0.53), Math.round(rowW * 0.48)) } : null;
  const painColor = assess.pain >= 7 ? colors.status.danger.fg : assess.pain >= 4 ? colors.status.warning.fg : colors.status.success.fg;

  return (
    <View
      style={{
        width,
        gap: space[3],
        padding: space[3],
        borderRadius: componentTokens.painCard.radius,
        backgroundColor: colors.surface.raised,
        ...componentTokens.painCard.shadow,
      }}
    >
      <View style={{ gap: space[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="labelSm">{done ? 'ประเมินครบแล้ว' : 'ประเมินอาการ'}</Text>
          {done ? (
            <Icon name="check-circle" size="xs" color={colors.brand.primary} />
          ) : (
            <Text variant="caption" tone="tertiary">
              {idx}/{ORDER.length}
            </Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 3 }}>
          {ORDER.map((s, i) => (
            <View key={s} style={{ flex: 1, height: 4, borderRadius: radius.full, backgroundColor: i < idx ? colors.brand.primary : i === idx ? colors.brand.subtle : colors.surface.sunken }} />
          ))}
        </View>
      </View>

      {/* รายการคำตอบ (ซ้าย) · หุ่นเล็กแสดงจุดที่เลือก (ขวา) */}
      <View style={{ flexDirection: 'row', gap: space[3] }} onLayout={(e) => setRowW(Math.round(e.nativeEvent.layout.width))}>
        <View style={{ flex: 1, gap: space[3] }} onLayout={(e) => setListH(Math.round(e.nativeEvent.layout.height))}>
          {ORDER.map((s, i) => {
            const current = i === idx;
            const v = value[s];
            return (
              <Pressable key={s} accessibilityRole="button" accessibilityLabel={`${ASSESS_ASK[s].label} ${v ?? 'ยังไม่ได้ตอบ'}`} onPress={() => onJump(s)} style={{ gap: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
                  <Text variant="caption" tone="tertiary">
                    {ASSESS_ASK[s].label}
                  </Text>
                  {current ? (
                    <Text variant="caption" color={colors.brand.primary}>
                      · กำลังถาม
                    </Text>
                  ) : null}
                </View>
                <Text
                  variant="labelSm"
                  numberOfLines={2}
                  color={s === 'pain' && v ? painColor : v ? colors.text.primary : colors.text.tertiary}
                >
                  {v ?? '—'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {body && bodySize ? body(bodySize) : null}
      </View>

      {done ? (
        // ปุ่มแคปซูลแบบเดียวกับปุ่มในช่อง bento (พื้นเข้ม เต็มความกว้าง)
        <Pressable
          accessibilityRole="button"
          onPress={() => onJump('done')}
          style={({ pressed }) => ({
            minHeight: 36,
            borderRadius: radius.full,
            backgroundColor: colors.text.primary,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: space[1],
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text variant="labelSm" color={colors.text.inverse}>
            ดูแนวทางการรักษา
          </Text>
          <Icon name="arrow-down" size="xs" color={colors.text.inverse} />
        </Pressable>
      ) : null}
    </View>
  );
}
