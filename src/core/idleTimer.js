const chatHistory = require('../db/chatHistory');
const sessionStore = require('../db/sessionStore');
const logger = require('../utils/logger');

const WARNING_TIMEOUT = 1* 60 * 1000; // 10 menit
const EXPIRE_TIMEOUT  =   30 * 1000; // 5 menit setelah warning

const WARNING_MESSAGE =
  'Halo, masih di sini? 😊 Kalau ada yang mau ditanyakan, saya siap bantu ya!';

const EXPIRED_MESSAGE =
  'Sesi kamu sudah berakhir karena tidak ada aktivitas. Sampai jumpa! 👋\nKalau butuh bantuan lagi, kirim pesan kapan saja ya.';

// Map phone → { jid, warningTimer, expireTimer }
const timers = new Map();

let _sendMessage;

function init(sendMessage) {
  _sendMessage = sendMessage;
}

// Dipanggil setiap kali AI selesai balas — reset timer dari awal
// jid = JID asli dari Baileys (bisa @s.whatsapp.net atau @lid)
function resetTimer(phone, jid) {
  cancelTimer(phone);
  logger.info(`[TIMER] ↺ Timer dimulai | phone: ${phone} | warning: 10 menit, expire: 15 menit`);

  const warningTimer = setTimeout(async () => {
    logger.info(`[TIMER] ⚠ Idle 10 menit | phone: ${phone} → kirim peringatan`);

    try {
      await _sendMessage(jid, WARNING_MESSAGE);
      await sessionStore.update(phone, { warning_sent: true });
    } catch (err) {
      logger.error(`[TIMER] ✗ Gagal kirim warning | phone: ${phone} | ${err.message}`);
    }

    const expireTimer = setTimeout(async () => {
      logger.info(`[TIMER] ✗ Sesi expired | phone: ${phone} → hapus history, reset state`);

      try {
        await _sendMessage(jid, EXPIRED_MESSAGE);
        chatHistory.clear(phone);
        await sessionStore.update(phone, {
          state: 'idle',
          warning_sent: false,
        });
      } catch (err) {
        logger.error(`[TIMER] ✗ Gagal expire sesi | phone: ${phone} | ${err.message}`);
      }

      timers.delete(phone);
    }, EXPIRE_TIMEOUT);

    const entry = timers.get(phone);
    if (entry) {
      entry.warningTimer = null;
      entry.expireTimer = expireTimer;
    }
  }, WARNING_TIMEOUT);

  timers.set(phone, { jid, warningTimer, expireTimer: null });
}

function cancelTimer(phone) {
  const entry = timers.get(phone);
  if (!entry) return;

  if (entry.warningTimer) clearTimeout(entry.warningTimer);
  if (entry.expireTimer) clearTimeout(entry.expireTimer);

  timers.delete(phone);
  logger.info(`[TIMER] ✓ Timer dibatalkan | phone: ${phone}`);
}

module.exports = { init, resetTimer, cancelTimer };
