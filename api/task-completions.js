import supabase from './db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { task_id, user_id, is_owner } = req.query;
      if (is_owner !== 'true' && !user_id) {
        return res.status(400).json({ error: 'user_id requerido' });
      }
      let query = supabase.from('task_completions').select('*').order('completed_at', { ascending: false });
      
      if (task_id) query = query.eq('task_id', task_id);
      if (is_owner !== 'true') query = query.eq('user_id', user_id);
      
      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const { task_id, user_id } = req.body;
      
      // Check if already completed
      const { data: existing } = await supabase
        .from('task_completions')
        .select('id')
        .eq('task_id', task_id)
        .eq('user_id', user_id)
        .single();
      
      if (existing) {
        return res.status(200).json(existing);
      }
      
      const { data, error } = await supabase
        .from('task_completions')
        .insert({ task_id, user_id })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'DELETE') {
      const { id, user_id } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id requerido' });
      const { error } = await supabase.from('task_completions').delete().eq('id', id).eq('user_id', user_id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
