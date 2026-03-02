# TODO: Demo User แยกข้อมูลจาก TRR

## เป้าหมาย
- สร้างบัญชี `demo` ที่ใช้งาน flow เหมือน `trrgroup`
- ข้อมูลรายชื่อลูกค้าใช้โครงสร้างเดิมได้
- ตัวเลขเชิงปริมาณ/การเงินต้องไม่ตรงกับ TRR
- Login คนละบัญชีแล้วเห็นข้อมูลคนละชุด

## แผนงานถัดไป

1. เตรียมบัญชีและ mapping
- สร้าง Auth user ใหม่ใน Supabase (เช่น `demo@...`)
- เพิ่มแถวใน `public.users` role=`CUSTOMER` และตั้ง `username`
- สร้าง `customer/workspace` สำหรับ demo และผูกกับ user ใหม่

2. ออกแบบ data isolation ให้ชัดเจน
- กำหนด `customer_id` หรือ `workspace_id` เป็น key กลาง
- ตรวจทุกตารางหลัก: `deliveries`, `stock`, `finance_invoices`, `contract_lines`, `your_product_requests`
- เพิ่มคอลัมน์ scope ถ้ายังไม่มี และทำ index

3. ทำ RLS และ policy
- เปิด RLS ในตารางที่ลูกค้าเข้าถึง
- policy ให้เห็นเฉพาะข้อมูลที่ตรงกับ user ของ session
- ทดสอบ cross-account: TRR ห้ามเห็น demo และ demo ห้ามเห็น TRR

4. สร้างข้อมูล demo แบบ synthetic
- คัดลอกรายการลูกค้า/มิติที่ไม่ sensitive ได้
- สร้างตัวเลขใหม่สำหรับ operation + finance (ไม่ reuse ตัวเลข TRR)
- กำหนดสูตร/seed ให้คงที่เพื่อ demo ได้ซ้ำ

5. ปรับ query ฝั่งหน้าเว็บให้ผูก account scope
- `MyCompany` ให้ filter ตาม account (ตอนนี้ยังมี query แบบรวม)
- `Market Intelligence` และหน้าที่เกี่ยวข้องให้ดึงตาม customer context
- ตรวจ fallback/local data ไม่ให้หลุดข้ามบัญชี

6. ทำสคริปต์ seed และ migration
- `docs/sql/01_scope_migration.sql`
- `docs/sql/02_rls_policies.sql`
- `docs/sql/03_demo_seed.sql`
- เขียนวิธีรันทีละไฟล์ใน Supabase SQL Editor

7. QA + UAT สำหรับ presentation
- Test matrix: login `trrgroup` vs `demo`
- ตรวจ KPI หน้า Trade Performance ต้องคนละตัวเลข
- ตรวจ Orders/Inventory/Invoices/Your Product แยกข้อมูลครบ
- ตรวจสิทธิ์แก้ไข/อัปโหลดของ demo ทำงานครบ

8. เตรียมคู่มือใช้งาน demo
- ระบุบัญชี demo, password, ข้อจำกัด
- ระบุข้อมูลไหน synthetic และ refresh/reset อย่างไร

## Definition of Done
- Demo user login ได้
- ทุกหน้าหลักเห็นข้อมูลเฉพาะ demo
- ตัวเลขไม่ซ้ำ TRR
- RLS กันการเห็นข้ามบัญชีผ่าน API ได้จริง
- มี SQL scripts + runbook พร้อมใช้งาน
