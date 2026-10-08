import React from 'react';
import { AudioQuality, IOSOutputFormat, createAudioPlayer, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, type AudioPlayer } from 'expo-audio';
import { speak, transcribe } from './voiceAI';

/**
 * คุยด้วยเสียงในแชท: ฟัง (จับช่วงเงียบตัดประโยค) → ถอดเสียง → ส่งเข้าแชทเหมือนพิมพ์ (onHeard)
 * → แชทตอบด้วยการ์ด/ข้อความแบบเดิม → say() อ่านข้อความสั้นออกเสียง → ฟังต่อเอง หรือพัก (การ์ดที่ต้องแตะ / ฉุกเฉิน)
 */
export type VoicePhase = 'off' | 'starting' | 'listening' | 'transcribing' | 'waiting' | 'speaking' | 'paused' | 'error';

/** WAV 16 kHz mono (Qwen3-ASR ต้องการ) · เปิดวัดระดับเสียงไว้จับช่วงเงียบ */
const REC_OPTIONS = {
  extension: '.wav',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  isMeteringEnabled: true,
  ios: { extension: '.wav', outputFormat: IOSOutputFormat.LINEARPCM, audioQuality: AudioQuality.MAX, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
  android: { extension: '.m4a', outputFormat: 'mpeg4' as const, audioEncoder: 'aac' as const },
  web: { mimeType: 'audio/webm' },
};
/** เงียบหลังพูดนานเท่านี้ = จบประโยค (ms) · พูดยาวสุดต่อรอบ · รอแชทตอบนานสุด */
const SILENCE_MS = 1400;
/** วัดเสียงพื้นหลังหลังเปิดไมค์ (ms) · ดังกว่าพื้นหลังกี่ dB = พูด · ต่ำกว่ากี่ dB = เงียบ · ดังต่อเนื่องนานเท่าไหร่ถึงนับว่าพูด */
const CALIBRATE_MS = 350;
const SPEAK_DB = 12;
const QUIET_DB = 6;
const MIN_SPEECH_MS = 250;
const MAX_TURN_MS = 25000;
const MAX_WAIT_MS = 60000;

export function useVoiceChat(onHeard: (text: string) => void) {
  const [phase, setPhaseState] = React.useState<VoicePhase>('off');
  const [hint, setHint] = React.useState<string | null>(null);
  const [muted, setMuted] = React.useState(false);
  const phaseRef = React.useRef<VoicePhase>('off');
  const setPhase = (p: VoicePhase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };
  const mutedRef = React.useRef(muted);
  mutedRef.current = muted;
  const heardRef = React.useRef(onHeard);
  heardRef.current = onHeard;
  const recorder = useAudioRecorder(REC_OPTIONS);
  const player = React.useRef<AudioPlayer | null>(null);
  const alive = React.useRef(true);
  React.useEffect(
    () => () => {
      alive.current = false;
      player.current?.remove();
      if (recorder.isRecording) void recorder.stop().catch(() => undefined);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const stopMedia = async () => {
    player.current?.pause();
    if (recorder.isRecording) await recorder.stop().catch(() => undefined);
  };

  const listen = async () => {
    player.current?.pause();
    setHint(null);
    // แสดงโหมดเสียงทันที (ไม่รอขอสิทธิ์/เตรียมไมค์ → ไม่ค้างตอนกด)
    setPhase('starting');
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setHint('ยังไม่ได้อนุญาตไมโครโฟน');
      return setPhase('error');
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      if (phaseRef.current !== 'starting') return;
      spoke.current = false;
      silentFor.current = 0;
      startedAt.current = Date.now();
      lastTick.current = Date.now();
      floor.current = -50;
      loudFor.current = 0;
      await recorder.prepareToRecordAsync();
      recorder.record();
      if (alive.current && phaseRef.current === 'starting') setPhase('listening');
      else await recorder.stop().catch(() => undefined);
    } catch {
      if (alive.current) setPhase('error');
    }
  };

  const pause = async (h?: string) => {
    await stopMedia();
    setHint(h ?? null);
    setPhase('paused');
  };

  /** จบประโยค → ถอดเสียง → ส่งเข้าแชท แล้วรอแชทตอบ · ยังไม่ได้พูด: force = พัก / ไม่ force = ฟังต่อ */
  const finishTurn = async (force = false) => {
    if (!recorder.isRecording) return;
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri || !spoke.current) return force ? pause() : void listen();
    setPhase('transcribing');
    try {
      const text = await transcribe(uri);
      if (!alive.current || phaseRef.current !== 'transcribing') return;
      // ถอดได้แค่เสียงรบกวน (ว่าง / 1 ตัวอักษร) → ฟังต่อ ไม่ส่งเข้าแชท
      if (text.replace(/[\s.,!?…]/g, '').length < 2) return void listen();
      setPhase('waiting');
      heardRef.current(text);
      // แชทไม่ตอบ (ค้าง) → พักไว้ ไม่ค้างหน้า "กำลังคิด"
      setTimeout(() => alive.current && phaseRef.current === 'waiting' && void pause(), MAX_WAIT_MS);
    } catch {
      if (alive.current) setPhase('error');
    }
  };

  /** อ่านออกเสียง (ปิดเสียง/พูดไม่ได้ = ข้าม) แล้วฟังต่อ หรือพักพร้อมคำบอก */
  const say = async (text: string, then: 'listen' | 'pause', h?: string) => {
    setPhase('speaking');
    if (text && !mutedRef.current) {
      try {
        const uri = await speak(text);
        if (!alive.current || phaseRef.current !== 'speaking') return;
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        player.current?.remove();
        const p = createAudioPlayer(uri);
        player.current = p;
        await new Promise<void>((resolve) => {
          const sub = p.addListener('playbackStatusUpdate', (st) => {
            if (st.didJustFinish) {
              sub.remove();
              resolve();
            }
          });
          p.play();
          // กันค้าง: เสียงไม่จบเอง
          setTimeout(resolve, Math.min(30000, 2500 + text.length * 120));
        });
      } catch {
        /* พูดไม่ได้ → อ่านจากแชท */
      }
    }
    // ถูกขัด/ปิดระหว่างพูด → ไม่ทำต่อ
    if (!alive.current || phaseRef.current !== 'speaking') return;
    if (then === 'listen') void listen();
    else void pause(h);
  };

  /** ออกจากโหมดเสียง (กลับไปพิมพ์) */
  const off = async () => {
    setPhase('off');
    setHint(null);
    await stopMedia();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
  };

  /** ปุ่มหลัก: ฟัง = ส่งที่พูด (ยังไม่พูด = พัก) · ไทยเวลพูด = ขัดแล้วฟัง · พัก/ผิดพลาด/ปิด = เริ่มฟัง */
  const toggle = () => {
    const p = phaseRef.current;
    if (p === 'listening') void finishTurn(true);
    else if (p === 'speaking' || p === 'paused' || p === 'error' || p === 'off') void listen();
    // starting / transcribing / waiting = รอ
  };

  // จับช่วงเงียบ (ระดับเสียงมาจาก tick ถี่ ๆ — วัดใน component ช่องแชท ไม่ให้หน้าแชททั้งหน้า render ตาม)
  // ตัดเสียงแวดล้อม: วัดระดับเสียงพื้นหลังตลอด (ลงเร็ว ขึ้นช้า — เสียงพัดลม/แอร์/คนคุยรอบ ๆ ที่ดังคงที่ = พื้นหลัง)
  // พูด = ดังกว่าพื้นหลัง ≥ SPEAK_DB ต่อเนื่องพอ (ไม่นับเสียงกระแทกสั้น ๆ) · เงียบ = กลับมาใกล้พื้นหลัง (< พื้นหลัง + QUIET_DB)
  const spoke = React.useRef(false);
  const silentFor = React.useRef(0);
  const loudFor = React.useRef(0);
  const startedAt = React.useRef(0);
  const floor = React.useRef(-50);
  const lastTick = React.useRef(0);
  const tick = (metering: number | undefined) => {
    if (phaseRef.current !== 'listening' || !recorder.isRecording) return;
    const now = Date.now();
    const dt = Math.min(200, now - lastTick.current);
    lastTick.current = now;
    const m = metering ?? -160;
    // ช่วงแรกหลังเปิดไมค์ = วัดพื้นหลังอย่างเดียว
    if (now - startedAt.current < CALIBRATE_MS) {
      floor.current = floor.current === -50 ? m : floor.current * 0.7 + m * 0.3;
      return;
    }
    // ลงเร็ว (เงียบลง) · ขึ้นช้ามาก (ไม่ให้เสียงพูดดันพื้นหลังขึ้นมา)
    floor.current = m < floor.current ? floor.current * 0.6 + m * 0.4 : floor.current + Math.min(m - floor.current, 6) * (spoke.current ? 0.004 : 0.03) * (dt / 50);
    const over = m - floor.current;
    if (over >= SPEAK_DB) {
      loudFor.current += dt;
      if (loudFor.current >= MIN_SPEECH_MS) spoke.current = true;
      silentFor.current = 0;
    } else {
      loudFor.current = Math.max(0, loudFor.current - dt);
      if (spoke.current && over < QUIET_DB) silentFor.current += dt;
    }
    if ((spoke.current && silentFor.current >= SILENCE_MS) || now - startedAt.current > MAX_TURN_MS) void finishTurn();
  };
  /** ระดับเสียงสำหรับเส้นแสง: เทียบกับพื้นหลัง (เสียงแวดล้อมไม่ทำให้คลื่นขึ้น) */
  const levelOf = (metering: number | undefined) => Math.max(0, Math.min(1, ((metering ?? -160) - floor.current - QUIET_DB) / 26));

  return { phase, hint, muted, setMuted, recorder, tick, levelOf, listen, pause, say, off, toggle };
}
export type VoiceChat = ReturnType<typeof useVoiceChat>;
