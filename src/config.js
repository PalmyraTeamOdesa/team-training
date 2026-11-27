/* ---------- CONFIG (public values only: URL + publishable/anon key) ---------- */
const SB_URL='https://oqxoqooslqctjnkobehu.supabase.co';
const SB_KEY='sb_publishable_ixqaAkUWUP6Oa0SWp0or7g_colGxBvT';
const sb=supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const APP_VERSION='1.0.0';
const VAPID_PUBLIC='BN84oitkGQyZgfI8F7DC1YIao65T7jfNgEzZx1ukobCCGpKNvciuLt3CoVZVbSa3LU3pm9VNq4aRfobuxKguoHI';
