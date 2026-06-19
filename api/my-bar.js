import supabase from './db-client.js';

// Returns the bar(s) where current user is a member + their role
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id requerido' });

    const { data: members, error } = await supabase
      .from('bar_members')
      .select('*')
      .eq('user_id', user_id);
    if (error) throw error;

    // Join to bars in code (no FK relationship in the DB schema cache)
    const barIds = [...new Set((members || []).map(m => m.bar_id))];
    let barsById = {};
    if (barIds.length) {
      const { data: bars, error: barsErr } = await supabase
        .from('bars')
        .select('id, name, owner_id, created_at')
        .in('id', barIds);
      if (barsErr) throw barsErr;
      barsById = Object.fromEntries((bars || []).map(b => [b.id, b]));
    }

    const result = (members || [])
      .filter(m => barsById[m.bar_id])
      .map(m => {
        const b = barsById[m.bar_id];
        return {
          bar_id: b.id,
          bar_name: b.name,
          role: m.role,
          is_owner: m.role === 'owner',
          joined_at: m.joined_at,
          bar_owner_id: b.owner_id,
        };
      });

    return res.status(200).json(result);
  } catch (err) {
    console.error('API my-bar error:', err);
    res.status(500).json({ error: err.message });
  }
}
