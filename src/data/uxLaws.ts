/**
 * Laws of UX ที่ใช้ใน ThaiWell AI — อ้างอิง lawsofux.com (Jon Yablonski)
 * + หลักการเสริมด้าน Healthcare/AI (Transparency, Human-in-the-loop, Poka-yoke)
 */
export interface UXLaw {
  name: string;
  group: 'Heuristic' | 'Gestalt' | 'Cognitive bias' | 'Principle';
  definition: string;
  applied: string;
  screens: string[];
}

export const UX_LAWS: UXLaw[] = [
  {
    name: "Jakob's Law",
    group: 'Heuristic',
    definition: 'ผู้ใช้คาดหวังให้แอปทำงานเหมือนแอปอื่นที่คุ้นเคย',
    applied: 'Bottom tab / AppBar / Settings list ตามมาตรฐาน iOS-Android · Login ด้วย MyAtlas SSO',
    screens: ['Welcome', 'ทุกหน้า'],
  },
  {
    name: "Fitts's Law",
    group: 'Heuristic',
    definition: 'เวลาที่ใช้กดเป้าหมายขึ้นกับระยะทางและขนาด',
    applied: 'Touch target ≥ 48pt · CTA หลักสูง 56pt ติดขอบล่าง (thumb zone) · ปุ่มใหญ่บน tablet ข้างเตียง',
    screens: ['Screen footer', 'Body Map', 'Service Record'],
  },
  {
    name: "Hick's Law",
    group: 'Heuristic',
    definition: 'ยิ่งตัวเลือกมาก ยิ่งใช้เวลาตัดสินใจนาน',
    applied: 'Quick reply ≤ 4 · ทางลัด 4 ปุ่ม · Primary button 1 ปุ่มต่อหน้า · Care Suggestion 3 ตัวเลือก',
    screens: ['AI Interview', 'Home', 'Care Suggestion'],
  },
  {
    name: "Miller's Law / Chunking",
    group: 'Cognitive bias',
    definition: 'หน่วยความจำระยะสั้นรับได้ราว 7±2 หน่วย ควรจัดกลุ่มข้อมูล',
    applied: 'Provider Summary 5 กล่อง · Assessment 3 กลุ่ม · Value prop 3 ข้อ',
    screens: ['Provider Summary', 'Assessment', 'Welcome'],
  },
  {
    name: "Tesler's Law",
    group: 'Principle',
    definition: 'ความซับซ้อนมีอยู่เสมอ — ให้ระบบรับไว้แทนผู้ใช้',
    applied: 'AI แปลงภาษาพูดเป็นข้อมูลโครงสร้าง · ข้ามคำถามที่รู้แล้ว · pre-fill Body Map / Service Record',
    screens: ['AI Interview', 'Body Map', 'Service Record'],
  },
  {
    name: "Postel's Law",
    group: 'Principle',
    definition: 'ยืดหยุ่นกับสิ่งที่รับเข้า เข้มงวดกับสิ่งที่ส่งออก',
    applied: 'รับอินพุตทั้งพิมพ์/เสียง/ปุ่ม/ภาษาถิ่น → ส่งออกเป็น structured summary มาตรฐานเดียว',
    screens: ['AI Interview'],
  },
  {
    name: 'Doherty Threshold',
    group: 'Principle',
    definition: 'ตอบสนองภายใน < 400ms ทำให้ผู้ใช้ไหลลื่น',
    applied: 'Heat map เปลี่ยนทันที · Typing indicator ระหว่าง AI ประมวลผล · feedback ส่งข้อมูลสำเร็จ',
    screens: ['Body Map', 'AI Interview', 'Check-in'],
  },
  {
    name: 'Zeigarnik Effect',
    group: 'Cognitive bias',
    definition: 'คนจำงานที่ยังไม่เสร็จได้ดีกว่างานที่เสร็จแล้ว',
    applied: 'การ์ด “ทำต่อ” บนหน้า Home · Streak ท่าดูแลตนเอง',
    screens: ['Home', 'Self-care'],
  },
  {
    name: 'Goal-Gradient Effect',
    group: 'Cognitive bias',
    definition: 'ยิ่งใกล้เป้าหมาย ยิ่งมีแรงทำให้เสร็จ',
    applied: 'JourneyStepper 5 ขั้น · progress bar ใน Interview และ Follow-up',
    screens: ['ทุกหน้าใน Journey'],
  },
  {
    name: 'Peak-End Rule',
    group: 'Cognitive bias',
    definition: 'คนตัดสินประสบการณ์จากช่วงพีคและช่วงจบ',
    applied: 'Session Result แสดงตัวเลขที่ดีขึ้นชัด ๆ + ขั้นถัดไป · Outcome trend ข้ามครั้ง',
    screens: ['Session Result', 'Progress'],
  },
  {
    name: 'Serial Position Effect',
    group: 'Cognitive bias',
    definition: 'คนจำรายการแรกและรายการสุดท้ายได้ดีที่สุด',
    applied: 'สถานะความปลอดภัยอยู่บนสุด · คิวเรียง Red Flag ก่อน · CTA อยู่ท้าย',
    screens: ['Pre-summary', 'Queue', 'Provider Summary'],
  },
  {
    name: 'Von Restorff Effect',
    group: 'Cognitive bias',
    definition: 'สิ่งที่แตกต่างจากสิ่งรอบข้างจะถูกจดจำ',
    applied: 'สีอันตรายใช้เฉพาะ Red Flag · Banner มีแถบซ้าย + ไอคอน · ป้าย AI สีเฉพาะ',
    screens: ['Red Flag', 'Safety Check'],
  },
  {
    name: 'Aesthetic-Usability Effect',
    group: 'Cognitive bias',
    definition: 'ดีไซน์ที่สวยถูกมองว่าใช้ง่ายกว่า',
    applied: 'Design token + type scale เดียวทั้งระบบ · whitespace ตาม 4pt grid',
    screens: ['ทุกหน้า'],
  },
  {
    name: 'Law of Proximity',
    group: 'Gestalt',
    definition: 'สิ่งที่อยู่ใกล้กันถูกมองว่าเกี่ยวข้องกัน',
    applied: 'VStack/HStack gap มาจาก spacing token · label ชิด input',
    screens: ['ทุกหน้า'],
  },
  {
    name: 'Law of Common Region',
    group: 'Gestalt',
    definition: 'สิ่งที่อยู่ในกรอบเดียวกันถูกมองเป็นกลุ่ม',
    applied: 'Card แยก “จำเป็น / ไม่บังคับ” ใน Consent · กล่อง Provider Summary',
    screens: ['Consent', 'Provider Summary'],
  },
  {
    name: 'Law of Similarity',
    group: 'Gestalt',
    definition: 'สิ่งที่หน้าตาเหมือนกันถูกมองว่าทำหน้าที่เดียวกัน',
    applied: 'ทุก output ของ AI ใช้สี/ป้าย AI เดียวกัน · Before = โทนอ่อน After = โทนเข้ม',
    screens: ['AI Interview', 'Care Suggestion', 'Charts'],
  },
  {
    name: "Parkinson's Law",
    group: 'Principle',
    definition: 'งานจะขยายเต็มเวลาที่มี — การบอกเวลาช่วยให้จบเร็ว',
    applied: '“~3 นาที”, “3 คำถาม · 30 วินาที”',
    screens: ['Welcome', 'Follow-up'],
  },
  {
    name: 'Choice Overload / Progressive Disclosure',
    group: 'Principle',
    definition: 'แสดงเฉพาะสิ่งที่จำเป็น เปิดรายละเอียดเมื่อต้องการ',
    applied: 'Reason Trace ซ่อนไว้ · รายละเอียดแผนเปิดเฉพาะตัวที่เลือก',
    screens: ['Care Suggestion', 'Provider Summary'],
  },
  {
    name: 'Poka-yoke (Forcing function)',
    group: 'Principle',
    definition: 'ออกแบบให้ทำผิดพลาดไม่ได้',
    applied: 'ต้องยืนยันข้อควรระวังครบทุกข้อก่อนไปต่อ · Red Flag override ต้องมีผู้อนุมัติ',
    screens: ['Safety Check', 'Consent'],
  },
  {
    name: 'Human-in-the-loop / AI Transparency',
    group: 'Principle',
    definition: 'AI เสนอ มนุษย์ตัดสิน และตรวจสอบย้อนกลับได้',
    applied: 'ป้าย “ข้อเสนอแนะจาก AI” · แหล่งอ้างอิง RAG · Reason Trace · Audit log',
    screens: ['Care Suggestion', 'Privacy Center'],
  },
];
