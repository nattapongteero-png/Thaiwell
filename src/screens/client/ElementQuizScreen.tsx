import React from 'react';
import { View } from 'react-native';
import {
  AppBar,
  Button,
  Card,
  ChipSection,
  ElementSummary,
  HStack,
  ProgressBar,
  Screen,
  SectionHeader,
  Text,
  VStack,
  radius,
  space,
  useTheme,
} from '../../design-system';
import {
  ELEMENT_INFO,
  ELEMENT_QUIZ,
  dominantElement,
  elementPercents,
  type ElementKey,
} from '../../data/thaiMassageKnowledge';
import { useJourney } from '../../state/JourneyContext';
import { useNav } from '../../navigation/types';

const ORDER: ElementKey[] = ['ดิน', 'น้ำ', 'ลม', 'ไฟ'];

/** แบบประเมินธาตุเจ้าเรือนปัจจุบัน 14 ข้อ (CPG_PCU หน้า 163–164) */
export function ElementQuizScreen() {
  const nav = useNav();
  const { colors } = useTheme();
  const { elements, setElements, log, newPatient, elementsDone } = useJourney();
  // คนใหม่ที่ยังไม่เคยทำ → ไม่มี "ผลที่บันทึกไว้" (ไม่แสดงค่าตัวอย่าง)
  const hasSaved = elementsDone || !newPatient;
  const [answers, setAnswers] = React.useState<(ElementKey | undefined)[]>(Array(ELEMENT_QUIZ.length).fill(undefined));
  const answered = answers.filter(Boolean).length;
  const done = answered === ELEMENT_QUIZ.length;
  const pct = done ? elementPercents(answers) : elements;
  const top = dominantElement(pct);
  const info = ELEMENT_INFO[top];

  return (
    <Screen
      header={<AppBar title="ธาตุเจ้าเรือนของคุณ" subtitle="ประเมินจากลักษณะร่างกายและนิสัย 14 ข้อ" onBack={() => nav.goBack()} />}
      footer={
        <Button
          label={done ? 'บันทึกผลธาตุเจ้าเรือน' : `ตอบแล้ว ${answered}/${ELEMENT_QUIZ.length} ข้อ`}
          disabled={!done}
          onPress={() => {
            setElements(pct);
            log('ผู้รับบริการ', `ประเมินธาตุเจ้าเรือนปัจจุบัน: ${info.label} ${pct[top]}%`);
            nav.goBack();
          }}
        />
      }
    >
      {done || hasSaved ? (
      <Card>
        <Text variant="bodyXs" tone="secondary">
          {done ? 'ผลประเมินล่าสุด' : 'ผลที่บันทึกไว้'} · ธาตุเจ้าเรือนปัจจุบัน
        </Text>
        <ElementSummary percent={pct[top]} name={info.label} advice={info.advice} />
        <VStack gap={2}>
          {ORDER.map((k) => (
            <HStack key={k} gap={2}>
              <Text variant="bodyXs" style={{ width: 56 }}>
                ธาตุ{k}
              </Text>
              <View style={{ flex: 1, height: 8, borderRadius: radius.full, backgroundColor: colors.surface.sunken, overflow: 'hidden' }}>
                <View style={{ width: `${pct[k]}%`, height: '100%', borderRadius: radius.full, backgroundColor: k === top ? colors.brand.primary : colors.border.default }} />
              </View>
              <Text variant="bodyXs" tone="secondary" style={{ width: 36, textAlign: 'right' }}>
                {pct[k]}%
              </Text>
            </HStack>
          ))}
        </VStack>
        <Text variant="bodySm">แนวโน้ม: {info.tendency}</Text>
        {info.foods ? <Text variant="bodySm">อาหารที่ช่วยปรับสมดุล: {info.foods}</Text> : null}
      </Card>
      ) : null}

      <SectionHeader title="เลือกข้อที่ตรงกับคุณที่สุด" subtitle="ข้อละ 1 คำตอบ" />
      <ProgressBar value={answered / ELEMENT_QUIZ.length} />
      {ELEMENT_QUIZ.map((q, i) => {
        const labels = ORDER.map((k) => q.options[k]);
        const current = answers[i] ? q.options[answers[i]!] : undefined;
        return (
          <Card key={q.topic} style={{ gap: space[2] }}>
            <ChipSection
              title={`${i + 1}. ${q.topic}`}
              options={labels}
              value={current ? [current] : []}
              onChange={(v) => {
                const picked = v[v.length - 1];
                const key = ORDER.find((k) => q.options[k] === picked);
                const next = [...answers];
                next[i] = key;
                setAnswers(next);
              }}
            />
          </Card>
        );
      })}
    </Screen>
  );
}
