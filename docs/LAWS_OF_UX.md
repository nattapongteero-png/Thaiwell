# Laws of UX ใน ThaiWell AI

> สร้างอัตโนมัติจาก `src/data/uxLaws.ts` (`npx tsx scripts/export-uxlaws.ts`) — อ้างอิง lawsofux.com
> ในแอปเปิด “แสดง Law of UX annotation” ที่ Hub เพื่อดู sticky note บนแต่ละหน้าจอ

| Law | กลุ่ม | ความหมาย | ใช้ใน ThaiWell อย่างไร | หน้าจอ |
|---|---|---|---|---|
| **Jakob's Law** | Heuristic | ผู้ใช้คาดหวังให้แอปทำงานเหมือนแอปอื่นที่คุ้นเคย | Bottom tab / AppBar / Settings list ตามมาตรฐาน iOS-Android · Login ด้วย MyAtlas SSO | Welcome, ทุกหน้า |
| **Fitts's Law** | Heuristic | เวลาที่ใช้กดเป้าหมายขึ้นกับระยะทางและขนาด | Touch target ≥ 48pt · CTA หลักสูง 56pt ติดขอบล่าง (thumb zone) · ปุ่มใหญ่บน tablet ข้างเตียง | Screen footer, Body Map, Service Record |
| **Hick's Law** | Heuristic | ยิ่งตัวเลือกมาก ยิ่งใช้เวลาตัดสินใจนาน | Quick reply ≤ 4 · ทางลัด 4 ปุ่ม · Primary button 1 ปุ่มต่อหน้า · Care Suggestion 3 ตัวเลือก | AI Interview, Home, Care Suggestion |
| **Miller's Law / Chunking** | Cognitive bias | หน่วยความจำระยะสั้นรับได้ราว 7±2 หน่วย ควรจัดกลุ่มข้อมูล | Provider Summary 5 กล่อง · Assessment 3 กลุ่ม · Value prop 3 ข้อ | Provider Summary, Assessment, Welcome |
| **Tesler's Law** | Principle | ความซับซ้อนมีอยู่เสมอ — ให้ระบบรับไว้แทนผู้ใช้ | AI แปลงภาษาพูดเป็นข้อมูลโครงสร้าง · ข้ามคำถามที่รู้แล้ว · pre-fill Body Map / Service Record | AI Interview, Body Map, Service Record |
| **Postel's Law** | Principle | ยืดหยุ่นกับสิ่งที่รับเข้า เข้มงวดกับสิ่งที่ส่งออก | รับอินพุตทั้งพิมพ์/เสียง/ปุ่ม/ภาษาถิ่น → ส่งออกเป็น structured summary มาตรฐานเดียว | AI Interview |
| **Doherty Threshold** | Principle | ตอบสนองภายใน < 400ms ทำให้ผู้ใช้ไหลลื่น | Heat map เปลี่ยนทันที · Typing indicator ระหว่าง AI ประมวลผล · feedback ส่งข้อมูลสำเร็จ | Body Map, AI Interview, Check-in |
| **Zeigarnik Effect** | Cognitive bias | คนจำงานที่ยังไม่เสร็จได้ดีกว่างานที่เสร็จแล้ว | การ์ด “ทำต่อ” บนหน้า Home · Streak ท่าดูแลตนเอง | Home, Self-care |
| **Goal-Gradient Effect** | Cognitive bias | ยิ่งใกล้เป้าหมาย ยิ่งมีแรงทำให้เสร็จ | JourneyStepper 5 ขั้น · progress bar ใน Interview และ Follow-up | ทุกหน้าใน Journey |
| **Peak-End Rule** | Cognitive bias | คนตัดสินประสบการณ์จากช่วงพีคและช่วงจบ | Session Result แสดงตัวเลขที่ดีขึ้นชัด ๆ + ขั้นถัดไป · Outcome trend ข้ามครั้ง | Session Result, Progress |
| **Serial Position Effect** | Cognitive bias | คนจำรายการแรกและรายการสุดท้ายได้ดีที่สุด | สถานะความปลอดภัยอยู่บนสุด · คิวเรียง Red Flag ก่อน · CTA อยู่ท้าย | Pre-summary, Queue, Provider Summary |
| **Von Restorff Effect** | Cognitive bias | สิ่งที่แตกต่างจากสิ่งรอบข้างจะถูกจดจำ | สีอันตรายใช้เฉพาะ Red Flag · Banner มีแถบซ้าย + ไอคอน · ป้าย AI สีเฉพาะ | Red Flag, Safety Check |
| **Aesthetic-Usability Effect** | Cognitive bias | ดีไซน์ที่สวยถูกมองว่าใช้ง่ายกว่า | Design token + type scale เดียวทั้งระบบ · whitespace ตาม 4pt grid | ทุกหน้า |
| **Law of Proximity** | Gestalt | สิ่งที่อยู่ใกล้กันถูกมองว่าเกี่ยวข้องกัน | VStack/HStack gap มาจาก spacing token · label ชิด input | ทุกหน้า |
| **Law of Common Region** | Gestalt | สิ่งที่อยู่ในกรอบเดียวกันถูกมองเป็นกลุ่ม | Card แยก “จำเป็น / ไม่บังคับ” ใน Consent · กล่อง Provider Summary | Consent, Provider Summary |
| **Law of Similarity** | Gestalt | สิ่งที่หน้าตาเหมือนกันถูกมองว่าทำหน้าที่เดียวกัน | ทุก output ของ AI ใช้สี/ป้าย AI เดียวกัน · Before = โทนอ่อน After = โทนเข้ม | AI Interview, Care Suggestion, Charts |
| **Parkinson's Law** | Principle | งานจะขยายเต็มเวลาที่มี — การบอกเวลาช่วยให้จบเร็ว | “~3 นาที”, “3 คำถาม · 30 วินาที” | Welcome, Follow-up |
| **Choice Overload / Progressive Disclosure** | Principle | แสดงเฉพาะสิ่งที่จำเป็น เปิดรายละเอียดเมื่อต้องการ | Reason Trace ซ่อนไว้ · รายละเอียดแผนเปิดเฉพาะตัวที่เลือก | Care Suggestion, Provider Summary |
| **Poka-yoke (Forcing function)** | Principle | ออกแบบให้ทำผิดพลาดไม่ได้ | ต้องยืนยันข้อควรระวังครบทุกข้อก่อนไปต่อ · Red Flag override ต้องมีผู้อนุมัติ | Safety Check, Consent |
| **Human-in-the-loop / AI Transparency** | Principle | AI เสนอ มนุษย์ตัดสิน และตรวจสอบย้อนกลับได้ | ป้าย “ข้อเสนอแนะจาก AI” · แหล่งอ้างอิง RAG · Reason Trace · Audit log | Care Suggestion, Privacy Center |
