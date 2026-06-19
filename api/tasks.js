import supabase from './db-client.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_PRIORITY = 'medium';
const ALLOWED_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);
const LOCAL_PRIORITY_FILE = path.join(process.cwd(), '.local-task-priorities.json');
const PRIORITY_MARKER_RE = /^<!--priority:(low|medium|high|urgent)-->\n?/;
const ASSIGNED_MARKER_RE = /^<!--assigned_to:([^>\n]+)-->\n?/;
const CHAT_TITLE = '__private_chat_message__';
const CHAT_MARKER_RE = /^<!--chat_to:([^>\n]+)-->\n?/;

const cleanPriority = (priority) => ALLOWED_PRIORITIES.has(priority) ? priority : DEFAULT_PRIORITY;
const cleanAssignedTo = (assignedTo) => assignedTo && assignedTo !== 'general' ? String(assignedTo) : '';

const isMissingPriorityColumn = (error) => {
  const message = String(error?.message || '');
  return message.includes('priority') && (message.includes('does not exist') || message.includes('schema cache'));
};

async function readLocalPriorities() {
  try {
    return JSON.parse(await fs.readFile(LOCAL_PRIORITY_FILE, 'utf8'));
  } catch {
    return {};
  }
}

async function writeLocalPriorities(priorities) {
  try {
    await fs.writeFile(LOCAL_PRIORITY_FILE, JSON.stringify(priorities, null, 2));
  } catch (err) {
    console.warn('No se pudo guardar prioridad local:', err.message);
  }
}

async function rememberLocalPriority(taskId, priority) {
  if (!taskId) return;
  const priorities = await readLocalPriorities();
  priorities[taskId] = cleanPriority(priority);
  await writeLocalPriorities(priorities);
}

async function forgetLocalPriority(taskId) {
  const priorities = await readLocalPriorities();
  if (priorities[taskId]) {
    delete priorities[taskId];
    await writeLocalPriorities(priorities);
  }
}

function parseTaskDescription(description) {
  const text = description || '';
  let descriptionText = text;
  let priority;
  let assigned_to = '';
  let chat_to = '';
  let matched = true;

  while (matched) {
    matched = false;
    const priorityMatch = descriptionText.match(PRIORITY_MARKER_RE);
    if (priorityMatch) {
      priority = priorityMatch[1];
      descriptionText = descriptionText.replace(PRIORITY_MARKER_RE, '');
      matched = true;
      continue;
    }

    const assignedMatch = descriptionText.match(ASSIGNED_MARKER_RE);
    if (assignedMatch) {
      assigned_to = cleanAssignedTo(assignedMatch[1]);
      descriptionText = descriptionText.replace(ASSIGNED_MARKER_RE, '');
      matched = true;
      continue;
    }

    const chatMatch = descriptionText.match(CHAT_MARKER_RE);
    if (chatMatch) {
      chat_to = chatMatch[1];
      descriptionText = descriptionText.replace(CHAT_MARKER_RE, '');
      matched = true;
    }
  }

  return {
    priority: cleanPriority(priority),
    assigned_to,
    chat_to,
    description: descriptionText,
  };
}

function encodeTaskMetadata(description, { priority, assigned_to } = {}) {
  const cleanDescription = parseTaskDescription(description).description;
  const markers = [`<!--priority:${cleanPriority(priority)}-->`];
  const taskAssignee = cleanAssignedTo(assigned_to);
  if (taskAssignee) markers.push(`<!--assigned_to:${taskAssignee}-->`);
  return `${markers.join('\n')}\n${cleanDescription || ''}`;
}

function isChatRow(task) {
  return task?.title === CHAT_TITLE || CHAT_MARKER_RE.test(task?.description || '');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { bar_id, user_id, is_owner } = req.query;
      let query = supabase.from('tasks_v2').select('*').order('created_at', { ascending: false });
      if (bar_id) query = query.eq('bar_id', bar_id);
      const { data, error } = await query;
      if (error) throw error;
      const localPriorities = await readLocalPriorities();
      const tasks = (data || [])
        .filter(task => !isChatRow(task))
        .map(task => {
          const parsed = parseTaskDescription(task.description);
          return {
            ...task,
            description: parsed.description,
            priority: cleanPriority(task.priority || parsed.priority || localPriorities[task.id]),
            assigned_to: parsed.assigned_to,
            task_scope: parsed.assigned_to ? 'individual' : 'general',
          };
        })
        .filter(task => is_owner === 'true' || !user_id || !task.assigned_to || task.assigned_to === user_id);
      return res.status(200).json(tasks);
    }

    if (req.method === 'POST') {
      const { bar_id, title, description, created_by, priority, assigned_to, is_owner } = req.body;
      if (is_owner !== true) return res.status(403).json({ error: 'Solo el jefe puede crear tareas' });
      if (!bar_id) return res.status(400).json({ error: 'bar_id requerido' });
      const taskPriority = cleanPriority(priority);
      const taskAssignee = cleanAssignedTo(assigned_to);
      const encodedDescription = encodeTaskMetadata(description, { priority: taskPriority, assigned_to: taskAssignee });
      let { data, error } = await supabase
        .from('tasks_v2')
        .insert({ bar_id, title, description: encodedDescription, created_by, priority: taskPriority, is_active: true })
        .select()
        .single();
      if (error && isMissingPriorityColumn(error)) {
        const retry = await supabase
          .from('tasks_v2')
          .insert({ bar_id, title, description: encodedDescription, created_by, is_active: true })
          .select()
          .single();
        data = retry.data;
        error = retry.error;
        if (!error) await rememberLocalPriority(data?.id, taskPriority);
      }
      if (error) throw error;
      const parsed = parseTaskDescription(data.description);
      return res.status(201).json({ ...data, description: parsed.description, priority: taskPriority, assigned_to: taskAssignee, task_scope: taskAssignee ? 'individual' : 'general' });
    }

    if (req.method === 'PUT') {
      const { id, priority, assigned_to, is_owner, ...updates } = req.body;
      if (is_owner !== true) return res.status(403).json({ error: 'Solo el jefe puede editar tareas' });
      const nextPriority = priority === undefined ? undefined : cleanPriority(priority);
      const nextAssignedTo = assigned_to === undefined ? undefined : cleanAssignedTo(assigned_to);
      const needsExistingDescription = updates.description === undefined || nextPriority === undefined || nextAssignedTo === undefined;
      const { data: existing } = needsExistingDescription
        ? await supabase.from('tasks_v2').select('description').eq('id', id).single()
        : { data: null };
      const existingParsed = parseTaskDescription(existing?.description);
      const priorityToStore = nextPriority ?? existingParsed.priority;
      const assignedToStore = nextAssignedTo === undefined ? existingParsed.assigned_to : nextAssignedTo;
      const nextDescription = encodeTaskMetadata(updates.description ?? existing?.description, {
        priority: priorityToStore,
        assigned_to: assignedToStore,
      });
      const dbUpdates = {
        ...updates,
        description: nextDescription,
        ...(nextPriority !== undefined ? { priority: nextPriority } : {}),
      };
      let { data, error } = await supabase.from('tasks_v2').update(dbUpdates).eq('id', id).select().single();
      if (error && isMissingPriorityColumn(error)) {
        const { priority: _priority, ...fallbackUpdates } = dbUpdates;
        const retry = await supabase.from('tasks_v2').update(fallbackUpdates).eq('id', id).select().single();
        data = retry.data;
        error = retry.error;
        if (!error && nextPriority !== undefined) await rememberLocalPriority(id, nextPriority);
      }
      if (error) throw error;
      const parsed = parseTaskDescription(data.description);
      data.description = parsed.description;
      if (nextPriority !== undefined) data.priority = nextPriority;
      else data.priority = cleanPriority(data.priority || parsed.priority || (await readLocalPriorities())[id]);
      data.assigned_to = parsed.assigned_to;
      data.task_scope = parsed.assigned_to ? 'individual' : 'general';
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { id, is_owner } = req.body;
      if (is_owner !== true) return res.status(403).json({ error: 'Solo el jefe puede eliminar tareas' });
      const { error } = await supabase.from('tasks_v2').delete().eq('id', id);
      if (error) throw error;
      await forgetLocalPriority(id);
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API tasks error:', err);
    res.status(500).json({ error: err.message });
  }
}
