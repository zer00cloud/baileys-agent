const supabase = require('./supabase');
const logger = require('../utils/logger');

const sessionStore = {
  // Ambil sesi yang ada, atau buat baru jika belum ada
  async getOrCreate(phone, pushName) {
    const { data, error } = await supabase
      .from('sessions')
      .upsert(
        { phone, name: pushName, last_activity: new Date().toISOString() },
        { onConflict: 'phone', ignoreDuplicates: false }
      )
      .select()
      .single();

    if (error) {
      logger.error({ error, phone }, 'sessionStore.getOrCreate failed');
      throw error;
    }

    return data;
  },

  // Update kolom tertentu (state, memory, dll)
  async update(phone, data) {
    const { error } = await supabase
      .from('sessions')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('phone', phone);

    if (error) {
      logger.error({ error, phone }, 'sessionStore.update failed');
      throw error;
    }
  },

  // Catat waktu aktivitas terakhir
  async updateActivity(phone) {
    await sessionStore.update(phone, { last_activity: new Date().toISOString() });
  },

  // Reset ke state awal (misal: sesi timeout)
  async resetState(phone) {
    await sessionStore.update(phone, {
      state: 'idle',
      warning_sent: false,
    });
  },
};

module.exports = sessionStore;
