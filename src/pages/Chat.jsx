import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCheck, MessageCircle, Send, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import Avatar from '../components/Avatar';

export default function Chat() {
  const { profile, activeBar } = useAuth();
  const barId = activeBar?.bar_id;

  const [members, setMembers] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [chatSummary, setChatSummary] = useState({ has_messages: false, count: 0, by_sender: {} });

  const contacts = useMemo(
    () => members.filter(member => member.id !== profile?.id),
    [members, profile?.id]
  );
  const selectedMember = contacts.find(member => member.id === selectedId);
  const unreadBySender = chatSummary.by_sender || {};

  const fetchMembers = useCallback(async () => {
    if (!barId) return;
    try {
      setLoadingMembers(true);
      const res = await fetch(`/api/bar-members?bar_id=${barId}`);
      if (!res.ok) throw new Error('Error cargando equipo');
      const data = await res.json();
      setMembers(data.map(member => ({
        id: member.user_id,
        name: member.users?.display_name || member.users?.email || '?',
        email: member.users?.email || '',
        avatar_url: member.users?.avatar_url || '',
        role: member.role,
      })));
    } catch (err) {
      setError(err.message || 'Error de conexion');
    } finally {
      setLoadingMembers(false);
    }
  }, [barId]);

  const fetchMessages = useCallback(async () => {
    if (!barId || !profile?.id || !selectedId) return;
    try {
      setLoadingMessages(true);
      await fetch('/api/messages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', bar_id: barId, user_id: profile.id, peer_id: selectedId }),
      });
      const params = new URLSearchParams({ bar_id: barId, user_id: profile.id, peer_id: selectedId });
      const res = await fetch(`/api/messages?${params}`);
      if (!res.ok) throw new Error('Error cargando mensajes');
      setMessages(await res.json());
      setChatSummary(prev => ({ ...prev, by_sender: { ...(prev.by_sender || {}), [selectedId]: 0 } }));
      window.dispatchEvent(new CustomEvent('barshift-chat-read'));
    } catch (err) {
      setError(err.message || 'Error de conexion');
    } finally {
      setLoadingMessages(false);
    }
  }, [barId, profile?.id, selectedId]);

  const fetchChatSummary = useCallback(async () => {
    if (!barId || !profile?.id) return;
    try {
      const params = new URLSearchParams({ bar_id: barId, user_id: profile.id });
      const res = await fetch(`/api/messages?${params}`);
      if (res.ok) setChatSummary(await res.json());
    } catch {
      setChatSummary({ has_messages: false, count: 0, by_sender: {} });
    }
  }, [barId, profile?.id]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);
  useEffect(() => {
    fetchChatSummary();
    const timer = setInterval(fetchChatSummary, 7000);
    return () => clearInterval(timer);
  }, [fetchChatSummary]);

  useEffect(() => {
    if (selectedId && contacts.length && !contacts.some(contact => contact.id === selectedId)) setSelectedId('');
  }, [contacts, selectedId]);

  useEffect(() => {
    fetchMessages();
    if (!selectedId) return undefined;
    const timer = setInterval(fetchMessages, 7000);
    return () => clearInterval(timer);
  }, [fetchMessages, selectedId]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!draft.trim() || !selectedId || !profile?.id || !barId) return;
    try {
      setSending(true);
      setError('');
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bar_id: barId, sender_id: profile.id, receiver_id: selectedId, message: draft.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error enviando mensaje');
      setMessages(prev => [...prev, data]);
      setDraft('');
    } catch (err) {
      setError(err.message || 'Error enviando mensaje');
    } finally {
      setSending(false);
    }
  };

  if (!barId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <MessageCircle className="w-16 h-16 text-[#3d3428] mx-auto mb-4" />
        <h2 className="text-xl font-bold text-[#f5ebe0] mb-2">Sin bar asignado</h2>
        <p className="text-[#8b7355] max-w-sm mx-auto">Necesitas pertenecer a un bar para abrir chats privados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#f5ebe0]">Chat</h2>
          <p className="text-[#8b7355] text-sm mt-0.5">{activeBar?.bar_name} · Conversaciones privadas</p>
        </div>
        <div className="inline-flex items-center gap-2 self-start bg-[#231e19] border border-[#3d3428] rounded-xl px-3 py-2 text-sm font-semibold text-[#c4a77d]">
          <ShieldCheck className="w-4 h-4" /> Privado
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800/50 text-red-300 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-[320px_1fr] gap-4 min-h-[68vh]">
        <aside className={`${selectedMember ? 'hidden md:block' : 'block'} bg-[#231e19] border border-[#3d3428] rounded-2xl overflow-hidden`}>
          <div className="p-4 border-b border-[#3d3428]">
            <h3 className="text-sm font-bold text-[#8b7355] uppercase tracking-wider">Equipo</h3>
          </div>
          <div className="divide-y divide-[#3d3428]/50">
            {loadingMembers ? (
              <div className="p-6 flex justify-center"><div className="w-8 h-8 border-4 border-[#c4a77d] border-t-transparent rounded-full animate-spin"></div></div>
            ) : contacts.length === 0 ? (
              <p className="p-5 text-sm text-[#8b7355]">Sin compañeros disponibles</p>
            ) : contacts.map(contact => (
              <button key={contact.id} onClick={() => setSelectedId(contact.id)} className={'w-full flex items-center gap-3 p-4 text-left transition-all active:scale-[0.99] '+(selectedId===contact.id?'bg-[#c4a77d]/10':'hover:bg-[#3d3428]/40')}>
                <span className="relative">
                  <Avatar name={contact.name} src={contact.avatar_url} size="lg" />
                  {unreadBySender[contact.id]>0&&<span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 border-2 border-[#231e19] rounded-full" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#f5ebe0] truncate">{contact.name}</p>
                  <p className="text-xs text-[#8b7355] truncate">{contact.role === 'owner' ? 'Jefe' : 'Trabajador'} · {contact.email}</p>
                </div>
                {unreadBySender[contact.id]>0&&(
                  <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadBySender[contact.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </aside>

        <section className={`${selectedMember ? 'flex' : 'hidden md:flex'} bg-[#231e19] border border-[#3d3428] rounded-2xl overflow-hidden flex-col min-h-[68vh]`}>
          {selectedMember ? (
            <>
              <div className="flex items-center gap-3 p-4 border-b border-[#3d3428]">
                <button onClick={() => setSelectedId('')} className="md:hidden p-2 -ml-2 text-[#8b7355] rounded-xl active:bg-[#3d3428]">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <Avatar name={selectedMember.name} src={selectedMember.avatar_url} size="lg" />
                <div className="min-w-0">
                  <p className="font-bold text-[#f5ebe0] truncate">{selectedMember.name}</p>
                  <p className="text-xs text-[#8b7355] truncate">{selectedMember.role === 'owner' ? 'Jefe' : 'Trabajador'}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMessages && messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-4 border-[#c4a77d] border-t-transparent rounded-full animate-spin"></div></div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center">
                    <p className="text-[#8b7355] text-sm">Sin mensajes</p>
                  </div>
                ) : messages.map(message => {
                  const mine = message.sender_id === profile?.id;
                  return (
                    <motion.div key={message.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={'flex '+(mine?'justify-end':'justify-start')}>
                      <div className={'max-w-[78%] rounded-2xl px-4 py-2.5 '+(mine?'bg-[#c4a77d] text-[#1a1612] rounded-br-md':'bg-[#1a1612] text-[#f5ebe0] border border-[#3d3428] rounded-bl-md')}>
                        <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>
                        <p className={'text-[10px] mt-1 flex items-center gap-1 '+(mine?'justify-end text-[#3d3428]':'text-[#5c4f42]')}>
                          <span>{new Date(message.created_at).toLocaleString('es-ES',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                          {mine&&(
                            <span className={'inline-flex items-center gap-0.5 font-bold '+(message.read_at?'text-emerald-800':'text-[#3d3428]')}>
                              <CheckCheck className="w-3.5 h-3.5" />
                              {message.read_at ? 'Visto' : 'Entregado'}
                            </span>
                          )}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <form onSubmit={handleSend} className="p-3 border-t border-[#3d3428] flex items-end gap-2">
                <textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={1} placeholder="Mensaje..." className="flex-1 max-h-32 px-4 py-3 bg-[#1a1612] border border-[#3d3428] rounded-2xl text-[#f5ebe0] placeholder-[#5c4f42] focus:border-[#c4a77d] outline-none resize-none text-base" onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); handleSend(e); } }} />
                <button type="submit" disabled={!draft.trim()||sending} className="w-12 h-12 rounded-2xl bg-gradient-to-r from-[#c4a77d] to-[#b8956a] text-[#1a1612] flex items-center justify-center active:scale-95 disabled:opacity-50">
                  {sending ? <div className="w-5 h-5 border-2 border-[#1a1612] border-t-transparent rounded-full animate-spin"></div> : <Send className="w-5 h-5" />}
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[#8b7355] text-sm">Selecciona una persona</div>
          )}
        </section>
      </div>
    </div>
  );
}
