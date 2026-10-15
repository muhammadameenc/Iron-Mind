/*
 * Public browser configuration only. Get both values from Supabase Dashboard
 * > Project Settings > API. Never put a service-role key or database password here.
 */
window.IRON_MIND_SUPABASE_CONFIG = null;

if(window.location.origin === "http://127.0.0.1:8000"){
    window.IRON_MIND_SUPABASE_CONFIG = Object.freeze({
    url: "http://127.0.0.1:54421",
    publishableKey: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"
    });
}
