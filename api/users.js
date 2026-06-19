import supabase from './db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { user_id, role } = req.query;
      let query = supabase.from('users').select('*').order('created_at', { ascending: true });
      
      if (user_id) query = query.eq('id', user_id);
      if (role) query = query.eq('role', role);
      
      const { data, error } = await query;
      if (error) throw error;
      if (user_id) return res.status(200).json(data?.[0] || null);
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const { id, email, display_name, role, avatar_url } = req.body;
      
      // Check if user already exists
      const { data: existing } = await supabase.from('users').select('id').eq('id', id).single();
      
      if (existing) {
        // Update existing user
        const { data, error } = await supabase
          .from('users')
          .update({ 
            email: email || existing.email,
            display_name: display_name || existing.display_name,
            role: role || existing.role,
            avatar_url: avatar_url || existing.avatar_url,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json(data);
      }
      
      const { data, error } = await supabase
        .from('users')
        .insert({ id, email, display_name, role: role || 'worker', avatar_url })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const { id, ...updates } = req.body;
      const { data, error } = await supabase
        .from('users')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { id } = req.body;
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
