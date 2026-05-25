const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const { handleMessage, updateSock } = require('./messageHandler');

const AUTH_DIR = path.resolve('auth_info_baileys');
const MAX_RETRY = 5;

const baileysLogger = logger.child({ module: 'baileys' });
baileysLogger.level = 'silent';

// Suppress known Baileys noise ke stderr
const originalStderr = process.stderr.write.bind(process.stderr);
process.stderr.write = (chunk, ...args) => {
  const str = chunk.toString();
  if (str.includes('Bad MAC') || str.includes('Failed to decrypt') || str.includes('Session error')) {
    return true;
  }
  return originalStderr(chunk, ...args);
};

// Hapus folder auth agar QR baru bisa muncul
function clearAuth() {
  if (fs.existsSync(AUTH_DIR)) {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    logger.info('[WA] Auth dihapus, siap scan QR baru');
  }
}

async function startWhatsApp(retryCount = 0) {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: baileysLogger,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrcode.generate(qr, { small: true });
      logger.info('[WA] Scan QR code di atas untuk login WhatsApp');
    }

    if (connection === 'open') {
      logger.info('[WA] WhatsApp connected!');
      retryCount = 0;

      // Update sock di messageHandler agar pakai koneksi terbaru
      updateSock(
        async (jid, text) => {
          try {
            await sock.sendMessage(jid, { text });
          } catch (err) {
            logger.warn(`[WA] sendMessage gagal | jid: ${jid} | ${err.message}`);
          }
        },
        sock
      );
    }

    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      logger.warn(`[WA] Koneksi terputus | reason: ${reason}`);

      if (reason === DisconnectReason.loggedOut) {
        // Logout — coba reconnect dulu max 5x
        if (retryCount < MAX_RETRY) {
          retryCount++;
          logger.warn(`[WA] Logout terdeteksi, mencoba reconnect (${retryCount}/${MAX_RETRY})...`);
          setTimeout(() => startWhatsApp(retryCount), 1000);
        } else {
          // Semua percobaan gagal — hapus auth, tampilkan QR baru
          logger.warn(`[WA] Gagal reconnect ${MAX_RETRY}x, hapus auth dan tampilkan QR baru`);
          clearAuth();
          setTimeout(() => startWhatsApp(0), 1000);
        }
      } else {
        // Disconnect biasa (bukan logout) — reconnect langsung
        logger.info('[WA] Reconnect otomatis dalam 3 detik...');
        setTimeout(() => startWhatsApp(retryCount), 3000);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      await handleMessage(msg);
    }
  });

  return {
    sendMessage: async (jid, text) => {
      try {
        await sock.sendMessage(jid, { text });
      } catch (err) {
        logger.warn(`[WA] sendMessage gagal | jid: ${jid} | ${err.message}`);
      }
    },
    sock,
  };
}

module.exports = { startWhatsApp };
