const { config } = require('../config');
const { toolDefinitions, toolExecutors } = require('../tools');
const logger = require('../utils/logger');

const SYSTEM_PROMPT = `Kamu adalah asisten toko makanan yang ramah dan natural.
Kamu membantu pelanggan melihat menu dan informasi produk.
Gunakan Bahasa Indonesia yang santai dan akrab.
Gunakan emoji secukupnya. Harga selalu dalam Rupiah (format: Rp 15.000).
Jika stok habis, sampaikan dengan sopan.

PENTING - Data produk:
- Setiap kali pelanggan bertanya tentang produk, menu, harga, stok, atau kategori, WAJIB panggil tool terlebih dahulu
- Jangan pernah menjawab pertanyaan produk dari ingatan atau percakapan sebelumnya
- Data produk bisa berubah kapan saja, selalu ambil data terbaru via tool

FORMAT PESAN (wajib diikuti):
- Pesan dikirim via WhatsApp, JANGAN gunakan Markdown seperti **, ##, tabel, atau ---
- Untuk teks tebal gunakan *teks* (satu bintang)
- Untuk teks miring gunakan _teks_
- Jangan kasih emoji ⚠️
- Jangan langsung kasih harga kecuali diminta, biar fokus ke produk dulu
- Tulis dengan natural seperti chat biasa, bukan laporan atau menu restoran`;

const agent = {
  async run({ history, userMessage, phone }) {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: userMessage },
    ];

    let loops = 0;

    logger.info(`[AGENT] ▶ Mulai proses | phone: ${phone} | pesan: "${userMessage}"`);

    try {
      while (loops < config.app.agentMaxLoops) {
        loops++;

        logger.info(`[AGENT] ↑ Kirim ke LLM (loop ${loops}/${config.app.agentMaxLoops})`);
        const response = await callLLM(messages);
        const choice = response.choices[0];

        if (choice.finish_reason === 'stop') {
          const reply = choice.message.content;
          logger.info(`[AGENT] ✓ Selesai | reply: "${reply.slice(0, 80)}${reply.length > 80 ? '...' : ''}"`);
          return reply;
        }

        if (choice.finish_reason === 'tool_calls') {
          const toolNames = choice.message.tool_calls.map((t) => t.function.name).join(', ');
          logger.info(`[AGENT] ⚙ LLM minta tool: ${toolNames}`);

          messages.push(choice.message);

          for (const toolCall of choice.message.tool_calls) {
            const result = await executeTool(toolCall);
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            });
          }

          continue;
        }

        logger.warn(`[AGENT] ⚠ finish_reason tidak dikenal: ${choice.finish_reason}`);
        break;
      }

      logger.warn(`[AGENT] ⚠ Max loop tercapai (${config.app.agentMaxLoops}x)`);
      return 'Maaf, saya sedang kesulitan memproses permintaan kamu. Coba lagi ya 🙏';
    } catch (err) {
      if (err.message === 'RATE_LIMIT') {
        logger.warn(`[AGENT] ✗ Rate limit hit`);
        return 'Maaf, saya sedang sibuk melayani banyak pelanggan. Coba lagi dalam beberapa detik ya 🙏';
      }
      throw err;
    }
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function callLLM(messages) {
  const res = await fetch(`${config.ai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.ai.apiKey}`,
    },
    body: JSON.stringify({
      model: config.ai.model,
      messages,
      tools: toolDefinitions,
      tool_choice: 'auto',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error('RATE_LIMIT');
    throw new Error(`LLM API error ${res.status}: ${text}`);
  }

  return res.json();
}

async function executeTool(toolCall) {
  const { name, arguments: argsStr } = toolCall.function;
  const executor = toolExecutors[name];

  if (!executor) {
    logger.warn(`[TOOL] ✗ Tool tidak ditemukan: ${name}`);
    return { error: `Tool "${name}" tidak ditemukan` };
  }

  const args = (() => {
    try { return JSON.parse(argsStr || '{}'); } catch { return {}; }
  })();

  logger.info(`[TOOL] ▶ ${name} | args: ${JSON.stringify(args)}`);
  const start = Date.now();

  try {
    const result = await executor(args);
    const duration = Date.now() - start;
    const summary = summarizeToolResult(name, result);
    logger.info(`[TOOL] ✓ ${name} selesai (${duration}ms) | ${summary}`);
    return result;
  } catch (err) {
    logger.error(`[TOOL] ✗ ${name} error: ${err.message}`);
    return { error: err.message };
  }
}

function summarizeToolResult(name, result) {
  if (name === 'list_categories') {
    return `kategori: ${result.categories?.join(', ') || '-'}`;
  }
  if (name === 'search_products') {
    return `ditemukan ${result.products?.length || 0} produk`;
  }
  if (name === 'get_product_detail') {
    return `produk: ${result.product?.name || '-'}`;
  }
  return JSON.stringify(result).slice(0, 60);
}

module.exports = agent;
