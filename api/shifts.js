import supabase from './db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { year, month, user_id, bar_id, start_date, end_date } = req.query;
      let query = supabase.from('shifts_v2').select('*').order('date', { ascending: true }).order('start_time', { ascending: true });
      
      if (start_date && end_date) {
        query = query.gte('date', start_date).lte('date', end_date);
      } else if (year && month) {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
        query = query.gte('date', startDate).lte('date', endDate);
      }
      
      if (bar_id) query = query.eq('bar_id', bar_id);
      if (user_id) query = query.eq('user_id', user_id);
      
      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const rows = Array.isArray(req.body.shifts) ? req.body.shifts : [req.body];
      const shifts = rows.map(({ bar_id, user_id, date, start_time, end_time, notes }) => ({ bar_id, user_id, date, start_time, end_time, notes }));
      if (shifts.some(shift => !shift.bar_id || !shift.user_id || !shift.date || !shift.start_time || !shift.end_time)) {
        return res.status(400).json({ error: 'Turno incompleto' });
      }
      const { data, error } = await supabase
        .from('shifts_v2')
        .insert(shifts)
        .select();
      if (error) throw error;
      return res.status(201).json(Array.isArray(req.body.shifts) ? data : data?.[0]);
    }

    if (req.method === 'PUT') {
      const { id, ...updates } = req.body;
      const { data, error } = await supabase.from('shifts_v2').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { id } = req.body;
      const { error } = await supabase.from('shifts_v2').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API shifts error:', err);
    res.status(500).json({ error: err.message });
  }
}
