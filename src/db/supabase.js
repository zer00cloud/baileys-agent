const { createClient } = require('@supabase/supabase-js');
const { config } = require('../config');

// Singleton — satu koneksi dipakai seluruh aplikasi
const supabase = createClient(config.supabase.url, config.supabase.key);

module.exports = supabase;
