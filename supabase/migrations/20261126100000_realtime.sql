-- live updates for notifications and chat (RLS still applies to realtime)
alter publication supabase_realtime add table public.notifications, public.messages;
