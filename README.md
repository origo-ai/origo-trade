# ORIGO Trade

## Team Workflow (GitHub)

สำหรับการทำงานร่วมกันในทีม ให้ใช้ Pull Request flow ตามเอกสารนี้:

- คู่มือทีม: `CONTRIBUTING.md`
- Checklist รีวิว: `docs/review-checklist.md`
- PR template: `.github/pull_request_template.md`
- CI checks: `.github/workflows/ci.yml`

Quick start:

```sh
# สร้าง branch ใหม่จาก main
git checkout main
git pull origin main
git checkout -b feat/your-task

# ทำงาน -> commit -> push
git add .
git commit -m "feat: short summary"
git push -u origin feat/your-task
```

จากนั้นเปิด Pull Request และให้ทีม review ก่อน merge

## AI Rules

กติกาสำหรับ AI ให้ยึด [AGENTS.md](./AGENTS.md) เป็นหลัก

สรุปสั้น ๆ:

- ต้องประกาศ `Scope: frontend | backend` ก่อนเริ่มแก้
- ไม่จำเป็นต้องระบุไฟล์ก่อนเริ่ม ถ้ายังไม่ได้ไล่สำรวจโค้ด
- ห้ามข้ามจาก frontend ไป backend หรือ backend ไป frontend โดยไม่ประกาศ
- ถ้ากระทบอีกฝั่ง ให้ยังเลือก scope หลักเป็น `frontend` หรือ `backend` อย่างใดอย่างหนึ่ง และบอกให้ชัดว่ามี cross-boundary impact

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Current Structure

โครงสร้างหลักของโปรเจกต์:

```text
src/
  app/           # app shell, routing, global app pages
  features/      # domain-based UI/pages
  services/      # frontend API clients
  data-access/   # frontend data access / Supabase-facing modules
  components/    # shared UI
  contexts/
  hooks/
  lib/           # pure utilities only

server/
  app/           # app wiring + shared server helpers
  routes/        # express route registration by domain
  services/      # backend services / domain logic
  db/            # sqlite access
  middleware/    # auth / RBAC middleware
  config/        # env / runtime config
  migrations/

supabase/
  migrations/
  functions/
```

## Ownership Boundary

- `frontend`: `src/app`, `src/features`, `src/components`, `src/contexts`, `src/hooks`
- `backend`: `server/*`, `supabase/*`

สำหรับ `src/services`, `src/data-access`, `src/types`:

- ยังต้องประกาศ scope เป็นแค่ `frontend` หรือ `backend`
- ถ้าไฟล์ที่แก้มีผลต่อ API contract หรือ data shape ให้ default เป็น `backend`
- ถ้าไม่ใช่การเปลี่ยน contract ให้เลือกฝั่งหลักที่งานนั้นสังกัด และระบุเพิ่มว่ากระทบอีกฝั่งหรือไม่

## Admin Backoffice (REST + UI)

- API server: `server/index.js`
- DB migrations/seed: `server/migrations`
- Admin UI route: `/admin/backoffice`
- Run both services: `npm run dev:full`
- Setup guide: `docs/admin-backoffice-setup.md`
- API reference: `docs/admin-backoffice-api.md`

## Local Setup

แนะนำ Node.js `20.x` ตาม `package.json`

```sh
npm install
npm run build
npm test
npm run dev
```

## Supabase setup

ระบบหลังบ้านสามารถเชื่อมกับ Supabase ได้โดยตรงแล้ว (fallback เป็น local cache หากยังไม่ตั้งค่า env)

1. สร้างโปรเจกต์ใน Supabase และคัดลอก:
   - `Project URL`
   - `anon public key`
2. คัดลอกไฟล์ `.env.example` เป็น `.env.local` แล้วตั้งค่า:

```sh
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

3. ไปที่ Supabase SQL Editor แล้วรันสคริปต์:
   - `docs/supabase-schema.sql`
4. ติดตั้ง dependency และรันแอป:

```sh
npm i
npm run dev
```

หมายเหตุ:
- หาก Supabase ว่าง ระบบจะ seed ข้อมูล demo เริ่มต้นให้อัตโนมัติ
- ตารางที่ใช้: `customers`, `admin_users`, `uploads`, `activity_logs`
