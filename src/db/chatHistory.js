const Database = require('better-sqlite3');
const path = require('path');
const { config } = require('../config');
const logger = require('../utils/logger');

// Buka koneksi SQLite (file dibuat otomatis jika belum ada)
const db = new Database(path.resolve(config.sqlite.path));

// Aktifkan WAL mode: lebih cepat untuk baca/tulis bersamaan
db.pragma('journal_mode = WAL');

// Buat tabel jika belum ada
db.exec(`
  CREATE TABLE IF NOT EXISTS chat_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    phone      TEXT NOT NULL,
    role       TEXT NOT NULL,
    content    TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  CREATE INDEX IF NOT EXISTS idx_chat_history_phone
    ON chat_history (phone, created_at DESC);
`);

const chatHistory = {
  // Simpan satu pesan ke history
  append(phone, role, content) {
    const stmt = db.prepare(
      'INSERT INTO chat_history (phone, role, content) VALUES (?, ?, ?)'
    );
    stmt.run(phone, role, typeof content === 'string' ? content : JSON.stringify(content));
  },

  // Ambil N pesan terakhir, diurutkan dari lama ke baru (siap dikirim ke LLM)
  getRecent(phone, limit = 20) {
    const rows = db
      .prepare(
        `SELECT role, content FROM chat_history
         WHERE phone = ?
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .all(phone, limit);

    // Balik urutan: LLM butuh urutan lama → baru
    return rows.reverse().map((row) => ({
      role: row.role,
      content: row.content,
    }));
  },

  // Hapus semua history satu nomor (misal: sesi reset)
  clear(phone) {
    db.prepare('DELETE FROM chat_history WHERE phone = ?').run(phone);
  },

  // Hapus history lama (jalankan berkala, misal tiap hari)
  cleanupOld(daysOld = 7) {
    const cutoff = Math.floor(Date.now() / 1000) - daysOld * 86400;
    const result = db
      .prepare('DELETE FROM chat_history WHERE created_at < ?')
      .run(cutoff);
    logger.info({ deleted: result.changes }, 'chat_history cleanup done');
  },
};

module.exports = chatHistory;
