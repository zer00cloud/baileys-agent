const supabase = require('../db/supabase');

// ─── Definisi tools (dikirim ke LLM) ─────────────────────────────────────────

const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'list_categories',
      description: 'Ambil semua kategori produk yang tersedia di toko',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_products',
      description: 'Cari produk berdasarkan nama atau kategori. Hanya tampilkan produk yang stoknya masih ada.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Kata kunci pencarian nama produk (opsional)',
          },
          category: {
            type: 'string',
            description: 'Filter berdasarkan kategori, misal: makanan, minuman, snack, paket (opsional)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_product_detail',
      description: 'Ambil detail lengkap satu produk termasuk deskripsi, harga, dan stok',
      parameters: {
        type: 'object',
        properties: {
          product_id: {
            type: 'string',
            description: 'UUID produk yang ingin dilihat detailnya',
          },
        },
        required: ['product_id'],
      },
    },
  },
];

// ─── Implementasi tools ───────────────────────────────────────────────────────

const toolExecutors = {
  async list_categories() {
    const { data, error } = await supabase
      .from('products')
      .select('category')
      .eq('active', true);

    if (error) throw new Error(`list_categories error: ${error.message}`);

    const categories = [...new Set(data.map((r) => r.category).filter(Boolean))];
    return { categories };
  },

  async search_products({ query, category } = {}) {
    let q = supabase
      .from('products')
      .select('id, name, price, category, stock, sku')
      .eq('active', true)
      .gt('stock', 0);

    if (category) q = q.ilike('category', `%${category}%`);
    if (query) q = q.ilike('name', `%${query}%`);

    const { data, error } = await q.order('name');
    if (error) throw new Error(`search_products error: ${error.message}`);

    return { products: data };
  },

  async get_product_detail({ product_id }) {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, description, price, stock, category, sku, image_url')
      .eq('id', product_id)
      .eq('active', true)
      .single();

    if (error) throw new Error(`get_product_detail error: ${error.message}`);

    return { product: data };
  },
};

module.exports = { toolDefinitions, toolExecutors };
