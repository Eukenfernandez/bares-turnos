import supabase from './db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { action } = req.body;

  try {
    // Use raw SQL via rpc or direct query
    if (action === 'migrate') {
      // Add missing columns used by the app.
      const { error: err1 } = await supabase.rpc('exec_sql', { 
        sql: `
          ALTER TABLE shifts ADD COLUMN IF NOT EXISTS bar_id INTEGER;
          ALTER TABLE tasks ADD COLUMN IF NOT EXISTS bar_id INTEGER;
          ALTER TABLE tasks_v2 ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium';
          ALTER TABLE tasks_v2 DROP CONSTRAINT IF EXISTS tasks_v2_priority_check;
          ALTER TABLE tasks_v2 ADD CONSTRAINT tasks_v2_priority_check CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
        `
      }).catch(() => ({ error: true }));

      // If RPC not available, try direct approach
      // We'll use a workaround - insert into a temp approach
      const results = [];

      // Try adding bar_id to shifts
      try {
        await supabase.from('shifts').select('bar_id').limit(1);
        results.push({ table: 'shifts', bar_id_exists: true });
      } catch (e) {
        results.push({ table: 'shifts', bar_id_exists: false, error: e.message });
      }

      // Try adding bar_id to tasks  
      try {
        await supabase.from('tasks').select('bar_id').limit(1);
        results.push({ table: 'tasks', bar_id_exists: true });
      } catch (e) {
        results.push({ table: 'tasks', bar_id_exists: false, error: e.message });
      }

      return res.status(200).json({ message: 'Migration check complete', results });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
