/** สร้าง docs/LAWS_OF_UX.md จาก src/data/uxLaws.ts (แหล่งเดียวกับหน้า Laws of UX ในแอป) */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { UX_LAWS } from '../src/data/uxLaws';

const rows = UX_LAWS.map((l) => `| **${l.name}** | ${l.group} | ${l.definition} | ${l.applied} | ${l.screens.join(', ')} |`).join('\n');
const md = `# Laws of UX ใน ThaiWell AI

> สร้างอัตโนมัติจาก \`src/data/uxLaws.ts\` (\`npx tsx scripts/export-uxlaws.ts\`) — อ้างอิง lawsofux.com
> ในแอปเปิด “แสดง Law of UX annotation” ที่ Hub เพื่อดู sticky note บนแต่ละหน้าจอ

| Law | กลุ่ม | ความหมาย | ใช้ใน ThaiWell อย่างไร | หน้าจอ |
|---|---|---|---|---|
${rows}
`;
writeFileSync(join(__dirname, '..', 'docs', 'LAWS_OF_UX.md'), md);
console.log(`✓ docs/LAWS_OF_UX.md (${UX_LAWS.length} laws)`);
