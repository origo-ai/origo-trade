# Developer Workflow

คู่มือนี้สรุป flow การทำงานมาตรฐานของโปรเจกต์นี้ ตั้งแต่ clone repo จนถึง push งานขึ้น GitHub

## 1) Clone Repository

```sh
git clone <YOUR_GIT_URL>
cd origo-trade
```

ถ้ายังไม่มี repo local ให้เริ่มจากขั้นตอนนี้ก่อนเสมอ

## 2) Install Dependencies

โปรเจกต์นี้แนะนำ Node.js `20.x` และรองรับ `24.x`

หมายเหตุ:
- คำสั่งจาก root ของ repo จะใช้ `node` / `npm` จากเครื่องโดยตรง
- หากใช้ version manager ภายนอก สามารถอ้างอิง `.nvmrc` หรือ `.node-version` ได้ (ค่าที่แนะนำคือ `20.20.0`)

```sh
npm run install:all
```

ถ้าเพิ่ง clone ครั้งแรก หรือ `frontend/package-lock.json` / `backend/package-lock.json` เปลี่ยน ให้รันคำสั่งนี้ก่อนเริ่มงาน

## 3) Sync Main Before Starting

ก่อนสร้าง branch ใหม่ ให้ดึง `main` ล่าสุดก่อนเสมอ

```sh
git checkout main
git pull origin main
```

## 4) Create a Working Branch

สร้าง branch ใหม่จาก `main`

```sh
git checkout -b feat/your-task
```

รูปแบบชื่อ branch ที่แนะนำ:

- `feat/<short-name>`
- `fix/<short-name>`
- `chore/<short-name>`
- `docs/<short-name>`

ตัวอย่าง:

- `feat/admin-upload-review`
- `fix/login-redirect`
- `docs/workflow-guide`

## 5) Declare Work Scope First

ก่อนแก้โค้ด ให้ประกาศก่อนว่าเป็นงานฝั่งไหน:

- `Scope: frontend`
- `Scope: backend`

ถ้างานกระทบอีกฝั่ง ให้ยังเลือก scope หลักหนึ่งฝั่ง แล้วบอกเพิ่มว่ามี cross-boundary impact

กติกาสำหรับ AI ให้อิง [AGENTS.md](../AGENTS.md)

## 6) Work Locally

ตัวอย่างคำสั่งระหว่างพัฒนา:

```sh
npm run dev
```

ถ้าต้องรัน frontend + backend พร้อมกัน:

```sh
npm run dev:full
```

ถ้าต้องรัน backend อย่างเดียว:

```sh
npm run api:dev
```

## 7) Keep Your Branch Updated

ถ้าระหว่างทำงาน `main` มีการเปลี่ยนแปลง ให้ sync branch งานของคุณก่อน push หรือก่อนเปิด PR

```sh
git checkout main
git pull origin main
git checkout feat/your-task
git merge main
```

ถ้ามี conflict ให้แก้ใน branch ของคุณก่อนค่อยไปต่อ

## 8) Verify Before Commit

อย่างน้อยควรรันตาม scope งาน

ถ้าเป็นงาน frontend:

```sh
npm run build
npm run lint
```

ถ้าเป็นงาน backend:

```sh
npm run backend:check
npm run test -- src/test/server/admin-backoffice-api.test.ts
```

ถ้างานกระทบทั้งสองฝั่ง แนะนำให้รันทั้งหมด:

```sh
npm run build
npm test
npm run lint
npm run backend:check
```

## 9) Commit Your Work

```sh
git add .
git commit -m "feat: short summary"
```

ตัวอย่าง commit message:

- `feat: add upload review routes`
- `fix: prevent invalid login redirect`
- `docs: add developer workflow guide`

## 10) Push Your Branch

แบบแนะนำ:

```sh
git push -u origin feat/your-task
```

จากนั้นเปิด Pull Request เข้า `main`

## 11) Update an Existing Branch

ถ้าคุณทำงานต่อบน branch เดิมในวันถัดไป:

```sh
git checkout feat/your-task
git status
git checkout main
git pull origin main
git checkout feat/your-task
git merge main
```

แล้วค่อยทำงานต่อ

## 12) Direct Push to Main (Only When Needed)

ค่าปกติของทีมควรใช้ PR flow

ถ้าจำเป็นจริง ๆ และ repo อนุญาต:

```sh
git push origin HEAD:main
```

ใช้วิธีนี้เฉพาะเมื่อ:

- งานเล็กมาก
- คุณแน่ใจว่าไม่มีคนอื่นกำลังชนกับ `main`
- ไม่มี branch protection ที่บังคับ PR

## 13) After Push

ถ้าใช้ PR flow:

1. เปิด PR
2. ตรวจ checklist
3. ให้ review
4. merge เมื่อผ่าน

ถ้า push เข้า `main` ตรง:

1. แจ้งทีมว่า `main` ถูกอัปเดตแล้ว
2. คนอื่นควร `git checkout main && git pull origin main` ก่อนเริ่มงานใหม่

## Quick Reference

เริ่มงานใหม่:

```sh
git checkout main
git pull origin main
git checkout -b feat/your-task
npm run install:all
```

ก่อนส่งงาน:

```sh
npm run build
npm test
npm run lint
npm run backend:check
git add .
git commit -m "feat: short summary"
git push -u origin feat/your-task
```
