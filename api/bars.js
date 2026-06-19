import supabase from './db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { user_id } = req.query;
      let query = supabase.from('bars').select('*').order('created_at', { ascending: false });
      if (user_id) query = query.eq('owner_id', user_id);
      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const { name, owner_id } = req.body;
      const { data, error } = await supabase
        .from('bars')
        .insert({ name, owner_id })
        .select()
        .single();
      if (error) throw error;
      // Auto-add owner as member
      await supabase.from('bar_members').insert({ bar_id: data.id, user_id: owner_id, role: 'owner' });
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const { id, ...updates } = req.body;
      const { data, error } = await supabase.from('bars').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { id } = req.body;
      await supabase.from('bar_members').delete().eq('bar_id', id);
      await supabase.from('invitations').delete().eq('bar_id', id);
      const { error } = await supabase.from('bars').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API bars error:', err);
    res.status(500).json({ error: err.message });
  }
}
