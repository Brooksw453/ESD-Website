/* ============================================
   Supabase Client — Waitlist & Lead Capture
   ============================================ */

(function () {
    'use strict';

    const SUPABASE_URL = 'https://awcmkderlpyxpkmrnvwi.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_KPsJZn3qXMIm_GpFbXl6iA_lBvbUPpj';

    // Initialize once the Supabase library is loaded
    function init() {
        if (typeof supabase === 'undefined' || !supabase.createClient) return null;
        return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    // Insert a record into a Supabase table
    // Returns { success: true } or { success: false, error: string }
    async function insertRecord(table, data) {
        const client = init();
        if (!client) {
            return { success: false, error: 'Supabase client not loaded' };
        }
        try {
            const { error } = await client.from(table).insert([data]);
            if (error) {
                console.error('Supabase insert error:', error.message);
                return { success: false, error: error.message, code: error.code };
            }
            return { success: true };
        } catch (err) {
            console.error('Supabase request failed:', err);
            return { success: false, error: 'Network error' };
        }
    }

    window.supabaseClient = { insertRecord };
})();
