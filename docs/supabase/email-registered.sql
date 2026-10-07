-- ThaiWell app: แยกข้อความเข้าสู่ระบบ "ไม่พบอีเมลนี้" / "รหัสผ่านไม่ถูกต้อง"
-- Supabase Auth ตอบ "Invalid login credentials" เหมือนกันทั้งสองกรณี → แอปถามฟังก์ชันนี้หลังเข้าสู่ระบบไม่ผ่าน
-- รันใน Supabase SQL Editor ของโปรเจกต์หลังบ้าน (ThaiWellAI) ครั้งเดียว
-- หมายเหตุ: เปิดให้รู้ว่าอีเมลไหนสมัครแล้ว (account enumeration) — คืนแค่ true/false ไม่คืนข้อมูลอื่น
create or replace function public.tw_email_registered(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (select 1 from auth.users u where lower(u.email) = lower(trim(p_email)));
$$;
revoke all on function public.tw_email_registered(text) from public;
grant execute on function public.tw_email_registered(text) to anon, authenticated;
