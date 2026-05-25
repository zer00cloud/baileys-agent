# 🤖 Zer00Store WhatsApp AI Chatbot

Chatbot WhatsApp otomatis berbasis AI untuk toko makanan. Pelanggan cukup kirim pesan WhatsApp biasa, dan bot akan membalas secara natural seperti layaknya admin toko sungguhan.

---

## ✨ Fitur Utama

### 💬 Percakapan Natural
- Balas pesan pelanggan secara otomatis menggunakan AI
- Bahasa Indonesia santai dan akrab, bukan kaku seperti robot
- Muncul indikator "mengetik..." sebelum membalas — terasa seperti admin sungguhan
- Centang 2 (pesan terbaca) otomatis setelah pesan masuk

### 🛍️ Informasi Produk Real-time
- Data produk selalu diambil langsung dari database (tidak pakai data lama)
- Bisa tanya daftar menu, cari produk, atau minta detail produk tertentu
- Stok dan harga selalu up-to-date — kalau ada perubahan di database, langsung tercermin di balasan bot

### ⏱️ Sistem Sesi Otomatis
- Setiap pelanggan punya sesi percakapan sendiri
- Bot ingat konteks percakapan dalam satu sesi
- **Timer idle otomatis:**
  - 10 menit tidak ada pesan → bot kirim pesan "Masih di sini?"
  - 5 menit setelah peringatan masih tidak ada balasan → sesi berakhir otomatis
  - Pelanggan balas kapanpun → timer reset, sesi lanjut normal
  - Setelah sesi berakhir, pelanggan kirim pesan lagi → sesi baru dimulai dari awal

### 🔒 Hanya Private Chat
- Bot hanya merespons pesan pribadi (1-on-1)
- Pesan dari grup, channel, broadcast, dan status diabaikan otomatis

### 🔄 Koneksi Stabil
- Reconnect otomatis jika koneksi terputus
- Jika logout: coba reconnect 5x, kalau gagal → QR baru muncul otomatis tanpa perlu restart manual

### 📊 Log Terminal yang Jelas
Setiap aktivitas tercatat rapi di terminal untuk memudahkan monitoring:
```
[MSG] ▶ Pesan masuk | phone: 628xxx | teks: "ada menu apa?"
[AGENT] ⚙ LLM minta tool: search_products
[TOOL] ✓ search_products selesai (120ms) | ditemukan 8 produk
[AGENT] ✓ Selesai | reply: "Hei! Kita punya beberapa pilihan..."
[MSG] ✓ Balasan terkirim | phone: 628xxx
[TIMER] ↺ Timer dimulai | warning: 10 menit, expire: 15 menit
```

---

## 🛠️ Tech Stack

| Komponen | Teknologi |
|---|---|
| WhatsApp | Baileys (gratis, tanpa biaya API) |
| AI | OpenAI-compatible API (Groq, OpenRouter, Together AI, dll) |
| Database Produk & Sesi | Supabase (PostgreSQL) |
| Riwayat Chat | SQLite (lokal, cepat) |
| Runtime | Node.js 20+ |

---

## 🚀 Cara Instalasi

### 1. Clone & Install
```bash
git clone https://github.com/zer00cloud/baileys-agent.git
cd baileys-agent
npm install
```

### 2. Konfigurasi
```bash
cp .env.example .env
```

Edit file `.env` dan isi:
```env
# AI Model (pilih salah satu provider)
AI_BASE_URL=https://api.groq.com/openai/v1
AI_API_KEY=your_api_key_here
AI_MODEL=llama-3.1-8b-instant

# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=your_anon_key_here
```

### 3. Setup Database Supabase
Buat dua tabel ini di Supabase SQL Editor:

**Tabel `sessions`** (menyimpan data & status pelanggan):
```sql
create table public.sessions (
  phone text not null primary key,
  name text null,
  state text null default 'idle',
  memory jsonb null,
  last_activity timestamp with time zone null default now(),
  warning_sent boolean null default false,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now()
);
```

**Tabel `products`** (data produk toko):
```sql
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text null,
  price integer not null,
  stock integer null default 0,
  category text null,
  sku text null,
  active boolean null default true,
  image_url text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now()
);
```

### 4. Jalankan
```bash
npm run dev
```

Scan QR code yang muncul di terminal dengan WhatsApp kamu.

---

## 📱 Provider AI yang Didukung

Semua provider yang kompatibel dengan format OpenAI API bisa digunakan. Cukup ganti 3 baris di `.env`:

| Provider | Base URL | Rekomendasi Model |
|---|---|---|
| **Groq** ⭐ | `https://api.groq.com/openai/v1` | `llama-3.1-8b-instant` |
| **OpenRouter** | `https://openrouter.ai/api/v1` | `google/gemma-2-9b-it:free` |
| **Together AI** | `https://api.together.xyz/v1` | `meta-llama/Llama-3.1-8B-Instruct-Turbo` |
| **OpenAI** | `https://api.openai.com/v1` | `gpt-4o-mini` |

---

## 📁 Struktur Project

```
baileys-agent/
├── src/
│   ├── core/
│   │   ├── whatsapp.js        # Koneksi WhatsApp & QR code
│   │   ├── messageHandler.js  # Proses setiap pesan masuk
│   │   └── idleTimer.js       # Timer sesi otomatis
│   ├── agent/
│   │   └── agent.js           # AI agent & tool calling loop
│   ├── tools/
│   │   ├── index.js           # Registry semua tools
│   │   └── products.js        # Tool: cari & tampilkan produk
│   ├── db/
│   │   ├── supabase.js        # Koneksi Supabase
│   │   ├── sessionStore.js    # CRUD sesi pelanggan
│   │   └── chatHistory.js     # Riwayat chat (SQLite)
│   ├── config/index.js        # Semua konfigurasi & env vars
│   └── utils/logger.js        # Logger terminal
├── data/
│   └── chats.db               # Database SQLite (auto-created)
├── auth_info_baileys/         # Session WhatsApp (auto-created)
├── .env.example               # Template konfigurasi
└── index.js                   # Entry point
```

---

## 🗺️ Rencana Fitur Selanjutnya

| Versi | Fitur |
|---|---|
| v1.1 | Keranjang belanja & buat pesanan |
| v1.2 | Pembayaran otomatis (Mayar.id) |
| v1.3 | Notifikasi status pesanan ke admin |
| v1.4 | Lacak status pesanan |

---

## ⚠️ Catatan Penting

- File `.env` dan folder `auth_info_baileys/` **jangan di-commit** ke Git (sudah ada di `.gitignore`)
- Bot hanya bisa dijalankan di **1 device** sekaligus per nomor WhatsApp
- Gunakan nomor WhatsApp khusus untuk bot, bukan nomor pribadi
