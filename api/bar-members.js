import supabase from './db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { bar_id, user_id } = req.query;
      let query = supabase.from('bar_members').select('*').order('joined_at', { ascending: true });
      if (bar_id) query = query.eq('bar_id', bar_id);
      if (user_id) query = query.eq('user_id', user_id);
      const { data: members, error } = await query;
      if (error) throw error;

      // Join to users in code (no FK relationship in the DB schema cache)
      const userIds = [...new Set((members || []).map(m => m.user_id))];
      let usersById = {};
      if (userIds.length) {
        const { data: users } = await supabase
          .from('users')
          .select('id, display_name, email, avatar_url')
          .in('id', userIds);
        usersById = Object.fromEntries((users || []).map(u => [u.id, u]));
      }

      const result = (members || []).map(m => ({ ...m, users: usersById[m.user_id] || null }));
      return res.status(200).json(result);
    }

    if (req.method === 'POST') {
      const { bar_id, user_id, role } = req.body;
      const { data, error } = await supabase
        .from('bar_members')
        .insert({ bar_id, user_id, role: role || 'worker' })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const { bar_id, user_id, role } = req.body;
      if (!bar_id || !user_id || !role) return res.status(400).json({ error: 'bar_id, user_id y role requeridos' });
      if (!['owner', 'worker'].includes(role)) return res.status(400).json({ error: 'role no valido' });
      const { data, error } = await supabase
        .from('bar_members')
        .update({ role })
        .eq('bar_id', bar_id)
        .eq('user_id', user_id)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { bar_id, user_id } = req.body;
      const { error } = await supabase.from('bar_members').delete().eq('bar_id', bar_id).eq('user_id', user_id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API bar-members error:', err);
    res.status(500).json({ error: err.message });
  }
}
