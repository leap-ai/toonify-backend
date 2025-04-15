# 🎨 Cartoonify Backend

A secure Node.js backend using Fastify, PostgreSQL, and Drizzle ORM for cartoonifying user-uploaded images.

---

## 📦 Features

- Email & password authentication
- Google & Apple Sign-In (via OAuth `id_token`)
- JWT-based session auth
- PostgreSQL via Railway
- Drizzle ORM for schema & migrations
- Docker + Docker Compose support
- Seed script with demo user
- Cartoonify mock endpoint (3s delay)

---

## 🚀 Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/your-username/cartoonify-backend.git
cd cartoonify-backend
npm install
```

### 2. Setup Environment
Create a `.env` file based on `.env.example`:
```env
DATABASE_URL=postgres://user:password@localhost:5432/cartoonify
JWT_SECRET=your_jwt_secret
```

### 3. Start with Docker
```bash
docker-compose up --build
```

### 4. Seed Demo User
```bash
docker exec -it <api_container_id> node seed.js
```
Login:
- **Email**: `demo@example.com`
- **Password**: `password123`

---

## 🛠 Scripts

| Command            | Description                  |
|-------------------|------------------------------|
| `npm run dev`     | Start backend (non-Docker)   |
| `npm run seed`    | Seed demo user               |
| `drizzle-kit`     | Migrate schema               |

---

## 🧠 Auth API Overview

### `POST /auth/signup`
```json
{ "email": "user@example.com", "password": "pass" }
```
### `POST /auth/login`
```json
{ "email": "user@example.com", "password": "pass" }
```
### `POST /auth/google`
```json
{ "id_token": "..." }
```
### `POST /auth/apple`
```json
{ "id_token": "..." }
```
### `GET /auth/me`
```http
Authorization: Bearer <JWT>
```

---

## 🎨 Cartoonify API

### `POST /cartoonify`
Mocked cartoonification with 3s delay.
```http
Authorization: Bearer <JWT>
```
```json
{ "image": "<base64 image>" }
```
Response:
```json
{ "cartoonUrl": "https://v3.fal.media/..." }
```

---

## ✅ To Do
- Plug in real Fal.ai API
- Store image history per user
- Add Swagger or Postman docs
- Enable refresh tokens

---

## 👥 Contributors
- Yash Tambi 🎉
- Claudio Fuentes 🎉

---

## 📄 License
MIT
