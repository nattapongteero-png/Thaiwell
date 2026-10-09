import React from 'react';
import { Animated } from 'react-native';
import { ChatComposer } from '../../../design-system';
import type { VoiceChat } from '../../../services/useVoiceChat';

/**
 * ช่องแชท + คุยด้วยเสียงในช่องเดียวกัน (ไม่สลับเป็นอีกแถบ ให้ลูกแก้ว/กรอบเดิมเปลี่ยนสภาพต่อเนื่อง)
 * ระดับไมค์อ่านตรงจาก recorder ทุก ~50ms (ไม่ผ่าน state) → ref ให้เส้นแสง + Animated ให้แสงรอบช่องแชท → ไม่ render ใหม่ ไม่กระตุก
 */
export function VoiceChatDock({ voice, status, onSend, onVoice, fill }: { voice: VoiceChat; status: string; onSend: (text: string) => void; onVoice: () => void; fill?: { text: string; n: number } }) {
  const level = React.useRef(0);
  const glow = React.useRef(new Animated.Value(0)).current;
  const live = React.useRef(voice);
  live.current = voice;
  const { phase } = voice;
  const on = phase !== 'off';
  React.useEffect(() => {
    if (!on) {
      level.current = 0;
      glow.setValue(0);
      return;
    }
    let smooth = 0;
    let t = 0;
    const id = setInterval(() => {
      const v = live.current;
      t += 0.05;
      let target = 0;
      if (v.phase === 'listening') {
        let m: number | undefined;
        try {
          m = v.recorder.getStatus().metering;
        } catch {
          return; // ตัวบันทึกถูกปล่อยแล้ว (กำลังออกจากหน้า)
        }
        v.tick(m);
        // เทียบกับเสียงพื้นหลัง → เสียงแวดล้อมไม่ทำให้คลื่นขึ้น ขึ้นเมื่อพูดจริง
        target = v.levelOf(m);
      } else if (v.phase === 'speaking' && !v.muted) {
        // ไทยเวลพูด (ไม่มีระดับเสียงจากเครื่องเล่น) → จังหวะพูดจำลอง ขึ้นลงไม่สม่ำเสมอ
        target = 0.35 + 0.3 * Math.abs(Math.sin(t * 7.3) * Math.sin(t * 2.9 + 1));
      }
      smooth += (target - smooth) * (target > smooth ? 0.6 : 0.25);
      level.current = smooth;
      glow.setValue(smooth);
    }, 50);
    return () => clearInterval(id);
  }, [on, glow]);
  return (
    <ChatComposer
      fill={fill}
      onSend={onSend}
      onVoice={onVoice}
      voice={
        on
          ? {
              mode: phase === 'transcribing' || phase === 'waiting' ? 'busy' : phase === 'listening' || phase === 'starting' ? 'listening' : phase === 'speaking' || phase === 'error' ? phase : 'paused',
              status,
              level,
              halo: glow,
              muted: voice.muted,
              onMain: voice.toggle,
              onExit: () => void voice.off(),
              onMute: () => voice.setMuted((m) => !m),
            }
          : undefined
      }
    />
  );
}
