require('dotenv').config();

const config = {
  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY,
  },

  ai: {
    baseUrl: process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1',
    apiKey: process.env.AI_API_KEY,
    model: process.env.AI_MODEL || 'llama-3.1-8b-instant',
  },

  sqlite: {
    path: process.env.SQLITE_PATH || './data/chats.db',
  },

  app: {
    maxHistoryMessages: parseInt(process.env.MAX_HISTORY_MESSAGES || '20'),
    agentMaxLoops: parseInt(process.env.AGENT_MAX_LOOPS || '5'),
    logLevel: process.env.LOG_LEVEL || 'info',
    // Abaikan pesan yang lebih tua dari N detik (hindari spam saat reconnect)
    messageMaxAgeSeconds: 30,
  },
};

// Validasi env wajib saat startup
function validate() {
  const required = ['SUPABASE_URL', 'SUPABASE_KEY', 'AI_API_KEY'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

module.exports = { config, validate };
