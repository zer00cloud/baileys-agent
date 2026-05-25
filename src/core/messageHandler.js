const sessionStore = require('../db/sessionStore');
const chatHistory = require('../db/chatHistory');
const agent = require('../agent/agent');
const idleTimer = require('./idleTimer');
const { config } = require('../config');
const logger = require('../utils/logger');

let _sendMessage;
let _sock;

function init(sendMessage, sock) {
  _sendMessage = sendMessage;
  _sock = sock;
  idleTimer.init(sendMessage);
}

// Dipanggil saat reconnect — update referensi sock & sendMessage
function updateSock(sendMessage, sock) {
  _sendMessage = sendMessage;
  _sock = sock;
  logger.info('[MSG] Socket diperbarui setelah reconnect');
}

async function handleMessage(msg) {
  const { key, message, pushName } = msg;

  if (key.fromMe) return;

  // Hanya balas private chat saja
  const jid = key.remoteJid;
  if (jid.endsWith('@g.us')) return;        // grup
  if (jid.endsWith('@broadcast')) return;   // broadcast
  if (jid.endsWith('@newsletter')) return;  // channel/newsletter
  if (jid === 'status@broadcast') return;   // status WA

  // Pastikan hanya private chat (@s.whatsapp.net atau @lid)
  if (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@lid')) return;

  const text =
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    '';
  if (!text.trim()) return;

  const msgTimestamp = msg.messageTimestamp;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (nowSeconds - msgTimestamp > config.app.messageMaxAgeSeconds) return;

  const phone = key.remoteJid.replace('@s.whatsapp.net', '');

  logger.info(`[MSG] ▶ Pesan masuk | phone: ${phone} | teks: "${text}"`);

  idleTimer.cancelTimer(phone);

  try {
    // Delay natural sebelum "membaca" pesan
    await randomDelay(500, 2000);

    // Centang 2 — tandai pesan sudah dibaca
    await _sock.readMessages([key]);

    const session = await sessionStore.getOrCreate(phone, pushName);
    logger.info(`[MSG] ✓ Sesi aktif | phone: ${phone} | state: ${session.state}`);

    if (session.warning_sent) {
      await sessionStore.update(phone, { warning_sent: false });
    }

    const history = chatHistory.getRecent(phone, config.app.maxHistoryMessages);
    chatHistory.append(phone, 'user', text);

    // Tampilkan indikator "mengetik..."
    await _sock.sendPresenceUpdate('composing', jid);
    logger.info(`[MSG] ✎ Typing indicator aktif | phone: ${phone}`);

    // Jalankan agent
    const reply = await agent.run({ history, userMessage: text, phone });

    // Hentikan indikator mengetik
    await _sock.sendPresenceUpdate('paused', jid);

    await _sendMessage(jid, reply);
    logger.info(`[MSG] ✓ Balasan terkirim | phone: ${phone}`);

    chatHistory.append(phone, 'assistant', reply);

    await sessionStore.update(phone, {
      state: 'browsing',
      last_activity: new Date().toISOString(),
    });

    idleTimer.resetTimer(phone, jid);
  } catch (err) {
    logger.error({ phone, err: err.message }, 'Error handling message');
    await _sock.sendPresenceUpdate('paused', jid).catch(() => {});
    await _sendMessage(jid, 'Maaf, terjadi kesalahan. Coba lagi ya 🙏');
    idleTimer.resetTimer(phone, jid);
  }
}

function randomDelay(min, max) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { init, updateSock, handleMessage };
