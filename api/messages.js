import supabase from './db-client.js';

const CHAT_TITLE = '__private_chat_message__';
const CHAT_MARKER_RE = /^<!--chat_to:([^>\n]+)-->\n?/;
const READ_MARKER_RE = /^<!--read_at:([^>\n]+)-->\n?/;

function parseDescription(description) {
  let text = description || '';
  let receiver_id = '';
  let read_at = null;
  let matched = true;

  while (matched) {
    matched = false;
    const chatMatch = text.match(CHAT_MARKER_RE);
    if (chatMatch) {
      receiver_id = chatMatch[1];
      text = text.replace(CHAT_MARKER_RE, '');
      matched = true;
      continue;
    }

    const readMatch = text.match(READ_MARKER_RE);
    if (readMatch) {
      read_at = readMatch[1];
      text = text.replace(READ_MARKER_RE, '');
      matched = true;
    }
  }

  return { receiver_id, read_at, message: text };
}

function encodeMessage(receiverId, message, readAt = null) {
  const markers = [`<!--chat_to:${receiverId}-->`];
  if (readAt) markers.push(`<!--read_at:${readAt}-->`);
  return `${markers.join('\n')}\n${message || ''}`;
}

function parseMessage(row) {
  const parsed = parseDescription(row.description);
  return {
    id: row.id,
    bar_id: row.bar_id,
    sender_id: row.created_by,
    receiver_id: parsed.receiver_id,
    message: parsed.message,
    created_at: row.created_at,
    delivered_at: row.created_at,
    read_at: parsed.read_at,
  };
}

async function fetchChatRows(barId) {
  const { data, error } = await supabase
    .from('tasks_v2')
    .select('id, bar_id, title, description, created_by, created_at, is_active')
    .eq('bar_id', barId)
    .eq('title', CHAT_TITLE)
    .eq('is_active', false)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function markConversationRead({ barId, userId, peerId }) {
  const rows = await fetchChatRows(barId);
  const readAt = new Date().toISOString();
  const rowsToMark = rows
    .map(row => ({ row, parsed: parseMessage(row) }))
    .filter(({ parsed }) => parsed.sender_id === peerId && parsed.receiver_id === userId && !parsed.read_at);

  const results = await Promise.all(rowsToMark.map(({ row, parsed }) => (
    supabase
      .from('tasks_v2')
      .update({ description: encodeMessage(parsed.receiver_id, parsed.message, readAt) })
      .eq('id', row.id)
  )));
  const updateError = results.find(result => result.error)?.error;
  if (updateError) throw updateError;

  return rowsToMark.length;
}

async function areBarMembers(barId, userIds) {
  const { data, error } = await supabase
    .from('bar_members')
    .select('user_id')
    .eq('bar_id', barId)
    .in('user_id', userIds);
  if (error) throw error;
  return new Set((data || []).map(member => member.user_id)).size === new Set(userIds).size;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { bar_id, user_id, peer_id } = req.query;
      if (!bar_id || !user_id) return res.status(400).json({ error: 'bar_id y user_id requeridos' });

      const rows = await fetchChatRows(bar_id);

      if (!peer_id) {
        const incoming = rows
          .map(parseMessage)
          .filter(message => message.receiver_id === user_id && !message.read_at);
        const bySender = incoming.reduce((acc, message) => {
          acc[message.sender_id] = (acc[message.sender_id] || 0) + 1;
          return acc;
        }, {});
        return res.status(200).json({ has_messages: incoming.length > 0, count: incoming.length, by_sender: bySender });
      }

      const messages = rows
        .map(parseMessage)
        .filter(message => (
          (message.sender_id === user_id && message.receiver_id === peer_id) ||
          (message.sender_id === peer_id && message.receiver_id === user_id)
        ));
      return res.status(200).json(messages);
    }

    if (req.method === 'POST') {
      const { bar_id, sender_id, receiver_id, message } = req.body;
      const cleanMessage = String(message || '').trim();
      if (!bar_id || !sender_id || !receiver_id || !cleanMessage) return res.status(400).json({ error: 'Mensaje incompleto' });
      if (sender_id === receiver_id) return res.status(400).json({ error: 'El chat debe ser entre dos personas distintas' });

      const membersOk = await areBarMembers(bar_id, [sender_id, receiver_id]);
      if (!membersOk) return res.status(403).json({ error: 'Solo puedes escribir a miembros de tu bar' });

      const { data, error } = await supabase
        .from('tasks_v2')
        .insert({
          bar_id,
          title: CHAT_TITLE,
          description: encodeMessage(receiver_id, cleanMessage),
          created_by: sender_id,
          is_active: false,
        })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(parseMessage(data));
    }

    if (req.method === 'PUT') {
      const { bar_id, user_id, peer_id, action } = req.body;
      if (action !== 'mark_read') return res.status(400).json({ error: 'Accion no valida' });
      if (!bar_id || !user_id || !peer_id) return res.status(400).json({ error: 'bar_id, user_id y peer_id requeridos' });
      const marked = await markConversationRead({ barId: bar_id, userId: user_id, peerId: peer_id });
      return res.status(200).json({ ok: true, marked });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API messages error:', err);
    res.status(500).json({ error: err.message });
  }
}
