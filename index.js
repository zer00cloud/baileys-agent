const { validate } = require('./src/config');
const logger = require('./src/utils/logger');
const { startWhatsApp } = require('./src/core/whatsapp');
const { init: initMessageHandler } = require('./src/core/messageHandler');

async function main() {
  // Pastikan semua env vars wajib sudah diset
  validate();

  logger.info('Starting WhatsApp AI Chatbot...');

  const { sendMessage, sock } = await startWhatsApp();

  // Inject sendMessage dan sock ke messageHandler
  initMessageHandler(sendMessage, sock);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
