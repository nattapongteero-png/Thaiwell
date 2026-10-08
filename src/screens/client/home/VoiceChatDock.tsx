import React from 'react';
import { useAudioRecorderState } from 'expo-audio';
import { VoiceDock } from '../../../design-system/components/VoiceDock';
import type { VoiceChat } from '../../../services/useVoiceChat';

/**
 * แถบเสียงในช่องแชท — วัดระดับไมค์ที่นี่ (ทุก ~120ms) ส่งให้ตัวจับช่วงเงียบ + ริบบิ้น
 * ไม่ให้หน้าแชททั้งหน้า render ตามระดับเสียง
 */
export function VoiceChatDock({ voice, status }: { voice: VoiceChat; status: string }) {
  const rec = useAudioRecorderState(voice.recorder, 120);
  const { phase } = voice;
  React.useEffect(() => {
    if (phase === 'listening' && rec.isRecording) voice.tick(rec.metering);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.durationMillis]);
  // ฟัง = เสียงผู้ใช้จริง (dBFS → 0–1) · ไทยเวลพูด = กลาง ๆ · อื่น ๆ = เงียบ (เส้นบาง)
  const level = phase === 'listening' ? Math.max(0, Math.min(1, ((rec.metering ?? -60) + 55) / 40)) : phase === 'speaking' && !voice.muted ? 0.5 : 0;
  return (
    <VoiceDock
      mode={phase === 'transcribing' || phase === 'waiting' ? 'busy' : phase === 'listening' || phase === 'speaking' || phase === 'error' ? phase : 'paused'}
      status={status}
      level={level}
      muted={voice.muted}
      onMain={voice.toggle}
      onKeyboard={() => void voice.off()}
      onMute={() => voice.setMuted((m) => !m)}
    />
  );
}
