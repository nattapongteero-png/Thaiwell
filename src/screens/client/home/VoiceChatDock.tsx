import React from 'react';
import { Animated } from 'react-native';
import { useAudioRecorderState } from 'expo-audio';
import { ChatComposer } from '../../../design-system';
import type { VoiceChat } from '../../../services/useVoiceChat';

/**
 * ช่องแชท + คุยด้วยเสียงในช่องเดียวกัน (ไม่สลับเป็นอีกแถบ ให้ลูกแก้ว/กรอบเดิมเปลี่ยนสภาพต่อเนื่อง)
 * ระดับไมค์วัดใน VoiceMeter (เฉพาะตอนเปิดเสียง) แล้วเขียนลง ref/Animated → ไม่ render ใหม่ทุก 120ms
 */
export function VoiceChatDock({ voice, status, onSend, onVoice }: { voice: VoiceChat; status: string; onSend: (text: string) => void; onVoice: () => void }) {
  const level = React.useRef(0);
  const halo = React.useRef(new Animated.Value(0)).current;
  const { phase } = voice;
  const on = phase !== 'off';
  return (
    <>
      {on ? <VoiceMeter voice={voice} level={level} halo={halo} /> : null}
      <ChatComposer
        onSend={onSend}
        onVoice={onVoice}
        voice={
          on
            ? {
                mode: phase === 'transcribing' || phase === 'waiting' ? 'busy' : phase === 'listening' || phase === 'speaking' || phase === 'error' ? phase : 'paused',
                status,
                level,
                halo,
                muted: voice.muted,
                onMain: voice.toggle,
                onExit: () => void voice.off(),
                onMute: () => voice.setMuted((m) => !m),
              }
            : undefined
        }
      />
    </>
  );
}

/** วัดระดับไมค์ทุก ~120ms → ตัวจับช่วงเงียบ + ริบบิ้น + แสงรอบลูกแก้ว */
function VoiceMeter({ voice, level, halo }: { voice: VoiceChat; level: { current: number }; halo: Animated.Value }) {
  const rec = useAudioRecorderState(voice.recorder, 120);
  const { phase, muted } = voice;
  React.useEffect(() => {
    if (phase === 'listening' && rec.isRecording) voice.tick(rec.metering);
    // ฟัง = เสียงผู้ใช้จริง (dBFS → 0–1) · ไทยเวลพูด = กลาง ๆ · อื่น ๆ = เงียบ (เส้นบาง)
    const l = phase === 'listening' ? Math.max(0, Math.min(1, ((rec.metering ?? -60) + 55) / 40)) : phase === 'speaking' && !muted ? 0.5 : 0;
    level.current = l;
    Animated.timing(halo, { toValue: l, duration: 140, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.durationMillis, rec.metering, phase, muted]);
  return null;
}
