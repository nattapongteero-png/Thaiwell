/**
 * แจ้งเตือนบนเครื่อง (เด้งเป็นแบนเนอร์ + เสียง) เมื่อคลินิกส่งข้อมูลมา
 * ยืนยันนัด · ได้เลขคิว · ถึงคิว · ผลการรักษา · บิล · ใบเสร็จ · แผนการรักษา
 * ⚠️ ต้นแบบ: เป็น local notification — เด้งได้ขณะแอปเปิดหรือเพิ่งพักเบื้องหลัง
 *    แจ้งเตือนตอนปิดแอปสนิท (remote push) ต้องมีกุญแจ APNs + ตัวส่งฝั่ง server
 */
import { Platform } from 'react-native';
import type { ClinicEvent } from './clinicBridge';

type N = typeof import('expo-notifications');
let mod: N | null = null;
let allowed = false;

/** ขอสิทธิ์แจ้งเตือน (ครั้งแรกระบบจะถาม) · เว็บไม่รองรับ → ข้าม */
export async function setupNotifications() {
  if (Platform.OS === 'web') return;
  try {
    mod = await import('expo-notifications');
    mod.setNotificationHandler({
      // แอปเปิดอยู่ก็ยังเด้งแบนเนอร์ + เสียง
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
    const cur = await mod.getPermissionsAsync();
    allowed = cur.granted || (await mod.requestPermissionsAsync()).granted;
  } catch (e) {
    console.warn('notifications', e);
  }
}

export async function notify(title: string, body: string) {
  if (!mod || !allowed) return;
  await mod.scheduleNotificationAsync({ content: { title, body, sound: 'default' }, trigger: null }).catch(() => undefined);
}

/** ข้อความแจ้งเตือนของเหตุการณ์จากคลินิก */
export function noticeOf(e: ClinicEvent): [string, string] | null {
  switch (e.type) {
    case 'approved':
      return ['คลินิกยืนยันนัดแล้ว', `${e.date} เวลา ${e.start} น.${e.therapist ? ` · ${e.therapist}` : ''}`];
    case 'rejected':
      return ['คลินิกไม่สามารถรับนัดได้', e.reason || 'แตะเพื่อเลือกเวลาใหม่'];
    case 'queue':
      return e.called ? [`ถึงคิว${e.queue ? ` ${e.queue}` : 'คุณ'}แล้ว`, 'เชิญเข้ารับบริการได้เลย'] : [`เลขคิวของคุณ ${e.queue}`, 'เช็กอินแล้ว รอเรียกคิว'];
    case 'checkinRejected':
      return ['เช็กอินไม่สำเร็จ', e.reason];
    case 'started':
      return ['เริ่มรับบริการแล้ว', 'ผู้ให้บริการกำลังดูแลคุณ'];
    case 'completed':
      return ['ผลการรักษาวันนี้', `ปวด ${e.painBefore} → ${e.painAfter ?? '-'}${e.record?.advice ? ` · ${e.record.advice}` : ''}`];
    case 'bill':
      return ['บิลรอชำระ', `${e.amount.toLocaleString()} บาท · ชำระในแอปได้เลย`];
    case 'receipt':
      return ['ใบเสร็จรับเงิน', `${e.amount.toLocaleString()} บาท${e.receiptNo ? ` · ${e.receiptNo}` : ''}`];
    case 'plan':
      return e.summary ? ['แผนการรักษาจากคลินิก', `${e.course?.total ?? ''} ครั้ง${e.frequency ? ` (${e.frequency})` : ''} · ${e.summary}`] : e.next ? ['นัดครั้งถัดไปตามแผน', `${e.next.date} ${e.next.start} น.`] : null;
    case 'moved':
      return ['คลินิกเลื่อนนัดของคุณ', `${e.date} เวลา ${e.start} น.${e.therapist ? ` · ${e.therapist}` : ''}`];
    case 'billVoid':
      return ['คลินิกยกเลิกใบเสร็จ', 'บิลนี้รอชำระใหม่ · แตะเพื่อดูรายละเอียด'];
    case 'cancelled':
      return [e.reason?.startsWith('ผู้ป่วย') ? 'ยกเลิกนัดแล้ว' : 'คลินิกยกเลิกนัด', e.reason || 'แตะเพื่อดูรายละเอียด'];
    case 'absent':
      return ['บันทึกว่าไม่มาตามนัด', 'ติดต่อคลินิกเพื่อนัดใหม่'];
    default:
      return null;
  }
}
