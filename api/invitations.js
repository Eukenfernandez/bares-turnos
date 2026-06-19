import supabase from './db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { email, bar_id, user_id, status } = req.query;
      let query = supabase.from('invitations').select('*').order('created_at', { ascending: false });

      if (email) query = query.ilike('email', email);
      if (bar_id) query = query.eq('bar_id', bar_id);
      if (user_id) query = query.eq('user_id', user_id);
      if (status) query = query.eq('status', status);

      const { data: invs, error } = await query;
      if (error) throw error;

      // Join to bars in code (no FK relationship in the DB schema cache)
      const barIds = [...new Set((invs || []).map(i => i.bar_id).filter(Boolean))];
      let barsById = {};
      if (barIds.length) {
        const { data: bars } = await supabase
          .from('bars')
          .select('id, name, owner_id')
          .in('id', barIds);
        barsById = Object.fromEntries((bars || []).map(b => [b.id, b]));
      }

      const result = (invs || []).map(i => ({ ...i, bars: barsById[i.bar_id] || null }));
      return res.status(200).json(result);
    }

    if (req.method === 'POST') {
      const { bar_id, email, invited_by } = req.body;
      
      // Check if already invited or member
      const { data: existing } = await supabase
        .from('invitations')
        .select('id')
        .eq('bar_id', bar_id)
        .ilike('email', email)
        .in('status', ['pending'])
        .maybeSingle();
      
      if (existing) {
        return res.status(409).json({ error: 'Ya hay una invitacion pendiente para este email' });
      }
      
      // Check if already a member
      const { data: member } = await supabase
        .from('users')
        .select('id')
        .ilike('email', email)
        .maybeSingle();
      
      if (member) {
        const { data: existingMember } = await supabase
          .from('bar_members')
          .select('id')
          .eq('bar_id', bar_id)
          .eq('user_id', member.id)
          .maybeSingle();
        if (existingMember) {
          return res.status(409).json({ error: 'Este usuario ya es miembro del bar' });
        }
      }
      
      const { data, error } = await supabase
        .from('invitations')
        .insert({ bar_id, email, invited_by, status: 'pending', user_id: member?.id || null })
        .select('*')
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const { id, status, user_id } = req.body;
      
      if (!['accepted', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Estado no valido' });
      }
      
      // Get the invitation
      const { data: inv, error: fetchErr } = await supabase
        .from('invitations')
        .select('*')
        .eq('id', id)
        .single();
      if (fetchErr || !inv) return res.status(404).json({ error: 'Invitacion no encontrada' });
      
      // Update invitation status
      const { error: updateErr } = await supabase
        .from('invitations')
        .update({ status, user_id: user_id || inv.user_id })
        .eq('id', id);
      if (updateErr) throw updateErr;
      
      // If accepted, add as bar member
      if (status === 'accepted' && user_id) {
        const { data: memberCheck } = await supabase
          .from('bar_members')
          .select('id')
          .eq('bar_id', inv.bar_id)
          .eq('user_id', user_id)
          .maybeSingle();
        if (!memberCheck) {
          await supabase.from('bar_members').insert({ bar_id: inv.bar_id, user_id, role: 'worker' });
        }
      }
      
      return res.status(200).json({ ok: true, status });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body;
      const { error } = await supabase.from('invitations').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API invitations error:', err);
    res.status(500).json({ error: err.message });
  }
}
