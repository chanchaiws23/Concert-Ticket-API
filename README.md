## Concert Ticket API

Node.js/Express REST API สำหรับระบบจองบัตรคอนเสิร์ต รองรับการจัดการผู้ใช้ อีเวนต์ ออเดอร์ การชำระเงิน และ Swagger API Docs

### ฟีเจอร์หลัก
- **Authentication & Authorization**: สมัครสมาชิก, ล็อกอิน, JWT, แยกสิทธิ์ `USER`, `ORGANIZER`, `ADMIN`
- **Event Management**: จัดการอีเวนต์, ประเภทบัตร (ticket types), organizer, users
- **Order & Payment**: สร้างออเดอร์, อัปโหลดสลิป, ตรวจสอบ SlipOK, ยกเลิกออเดอร์อัตโนมัติด้วย `node-cron`
- **Documentation**: Swagger UI ที่ `/api-docs`

---

## การติดตั้ง (Setup)

### 1. Clone โปรเจกต์ และติดตั้ง dependencies

```bash
npm install
```

### 2. ตั้งค่า Environment Variables

สร้างไฟล์ `.env` ที่ root ของโปรเจกต์ โดยอ้างอิงจาก `.env.example` ที่เตรียมไว้:

```bash
cp .env.example .env   # (บน Windows ให้สร้างไฟล์ .env เองแล้วคัดลอกค่าจาก .env.example)
```

จากโค้ดในโปรเจกต์ ใช้ตัวแปรดังนี้:

- **Database**
  - `DB_USER`
  - `DB_HOST`
  - `DB_NAME`
  - `DB_PASSWORD`
  - `DB_PORT`

- **Server**
  - `PORT` (ค่าเริ่มต้น 3000 ถ้าไม่กำหนด)

- **Auth**
  - `JWT_SECRET`

- **PromptPay / Payment**
  - `PROMPTPAY_ACCOUNT`

- **SlipOK**
  - `SLIPOK_URL`
  - `SLIPOK_SECRET_KEY`

แก้ไขค่าให้ตรงกับ environment จริงของคุณ (ฐานข้อมูล PostgreSQL, ค่า secret ต่าง ๆ)

---

## การรันโปรเจกต์

### โหมดพัฒนา (แนะนำ)

```bash
npm run dev
```

ใช้ `nodemon` รัน `src/app.js` และ reload อัตโนมัติเมื่อไฟล์เปลี่ยน

### โหมด Production

```bash
npm start
```

เซิร์ฟเวอร์จะรันบนพอร์ตที่กำหนดใน `PORT` หรือค่าเริ่มต้น `3000`

เมื่อรันสำเร็จ จะเห็น log:
- `Server running on port <PORT>`
- `Scheduled task started: Checking expired orders every minute`

---

## Endpoints สำคัญ

เซิร์ฟเวอร์หลักอยู่ที่ `src/app.js` และมีการ mount routes ดังนี้:

- `GET /` – health check (`"API Running (JavaScript Mode)"`)
- `GET /api-docs` – Swagger UI
- `POST /api/auth/...` – auth routes
- `GET/POST /api/events/...` – event routes
- `GET/POST /api/orders/...` – order routes
- `GET/POST /api/organizer/...` – organizer routes (เดี่ยว)
- `GET/POST /api/organizers/...` – organizers routes (รวม)
- `GET/POST /api/user/...` – user routes (เดี่ยว)
- `GET/POST /api/users/...` – users routes (รวม)
- `GET/POST /api/ticket-types/...` – ticket types routes
- `POST /api/payments/...` – payment routes

รายละเอียดพารามิเตอร์และ response แต่ละ endpoint ดูได้จาก Swagger ที่ `/api-docs`

---

## เทคโนโลยีที่ใช้

- **Runtime**: Node.js
- **Framework**: Express
- **Database**: PostgreSQL (`pg`, `Pool` จาก `src/config/db.js`)
- **Auth**: `jsonwebtoken`, `bcryptjs`
- **Security & Misc**: `helmet`, `cors`, `dotenv`
- **File Uploads**: `multer`
- **Scheduling**: `node-cron`
- **Docs**: `swagger-jsdoc`, `swagger-ui-express`

---

## โครงสร้างโปรเจกต์ (ย่อ)

```text
src/
  app.js                # main express app, routes, cron job
  config/
    db.js               # PostgreSQL connection (Pool)
    swagger.js          # Swagger configuration
  controllers/          # business logic ของ API แต่ละส่วน
  middlewares/
    authMiddleware.js   # JWT auth + role guard
  routes/               # route definitions (auth, events, orders, payments, etc.)
  services/
    orderCancellationService.js  # service ยกเลิก order ที่หมดเวลา
uploads/
  slips/                # เก็บสลิปการชำระเงิน
```

---

## การพัฒนาเพิ่มเติม

- เขียน test เพิ่ม (เช่น Jest / Supertest) เพื่อครอบคลุม business logic สำคัญ
- เพิ่ม validation layer (เช่น `joi` หรือ `zod`) สำหรับตรวจสอบ `req.body`
- ปรับแต่ง Swagger docs ให้ครบทุก endpoint


