import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Users, Shield, UserPlus, Crown, Mail, Send, X, Trash2, Store, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Avatar from '../components/Avatar';

export default function Admin() {
  const { profile, activeBar, refreshAll } = useAuth();
  const isOwner = activeBar?.is_owner;
  const barId = activeBar?.bar_id;
  
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState('');
  const [barName, setBarName] = useState(activeBar?.bar_name || '');
  const [editingName, setEditingName] = useState(false);

  const fetchData = useCallback(async () => {
    if (!barId) return;
    try {
      setLoading(true);
      const [memRes, invRes] = await Promise.all([
        fetch(`/api/bar-members?bar_id=${barId}`),
        fetch(`/api/invitations?bar_id=${barId}`),
      ]);
      if (memRes.ok) setMembers(await memRes.json());
      if (invRes.ok) setInvitations(await invRes.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [barId]);

  useEffect(() => { fetchData(); setBarName(activeBar?.bar_name||''); }, [fetchData, activeBar?.bar_name]);

  const handleSendInvite = async () => {
    if (!inviteEmail.trim()||!barId) return;
    try {
      setInviteStatus('');
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bar_id: barId, email: inviteEmail.trim(), invited_by: profile?.id }),
      });
      const data = await res.json();
      if (!res.ok) { setInviteStatus(data.error || 'Error'); return; }
      setInviteEmail(''); setShowInviteModal(false); setInviteStatus('Invitacion enviada!'); fetchData(); setTimeout(()=>setInviteStatus(''),3000);
    } catch (err) { setInviteStatus('Error de conexion'); }
  };

  const handleRemoveMember = async (userId) => {
    const name = members.find(m=>m.user_id===userId)?.users?.display_name||'?';
    if (!confirm(`Expulsar a ${name} del bar?`)) return;
    try { await fetch('/api/bar-members',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({bar_id:barId,user_id:userId})}); fetchData(); }
    catch (err) { console.error(err); }
  };

  const handlePromoteMember = async (userId) => {
    const name = members.find(m=>m.user_id===userId)?.users?.display_name||'?';
    if (!confirm(`Convertir a ${name} en jefe?`)) return;
    try {
      const res = await fetch('/api/bar-members',{
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({bar_id:barId,user_id:userId,role:'owner'})
      });
      const data = await res.json();
      if (!res.ok) { setInviteStatus(data.error || 'Error cambiando rol'); return; }
      setInviteStatus(`${name} ahora es jefe`);
      fetchData();
      refreshAll();
      setTimeout(()=>setInviteStatus(''),3000);
    } catch (err) { setInviteStatus('Error de conexion'); }
  };

  const handleCancelInvite = async (invId) => {
    try { await fetch('/api/invitations',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:invId})}); fetchData(); }
    catch (err) { console.error(err); }
  };

  const handleUpdateBarName = async () => {
    if (!barName.trim()||!barId) return;
    try {
      await fetch('/api/bars',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:barId,name:barName.trim()})});
      setEditingName(false); refreshAll();
    } catch (err) { console.error(err); }
  };

  const handleCreateBar = async () => {
    if (!profile?.id) return;
    const name = prompt('Nombre de tu bar:');
    if (!name?.trim()) return;
    try {
      const res = await fetch('/api/bars',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.trim(),owner_id:profile.id})});
      if (res.ok) { refreshAll(); }
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-10 h-10 border-4 border-[#c4a77d] border-t-transparent rounded-full animate-spin"></div></div>;
  if (!barId) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <Store className="w-16 h-16 text-[#3d3428] mx-auto mb-4"/>
      <h2 className="text-xl font-bold text-[#f5ebe0] mb-2">Crea tu bar primero</h2>
      <p className="text-[#8b7355] max-w-sm mx-auto mb-4">Para gestionar un equipo, primero necesitas crear o unirte a un bar desde la pantalla de Turnos.</p>
    </div>
  );

  if (!isOwner) {
    return (
      <div className="space-y-4">
        <div className="text-center py-16 bg-[#231e19] border border-[#3d3428] rounded-2xl">
          <Shield className="w-16 h-16 text-[#3d3428] mx-auto mb-4"/>
          <h2 className="text-2xl font-bold text-[#f5ebe0] mb-2">Solo para Jefes</h2>
          <p className="text-[#8b7355] max-w-sm mx-auto">Esta seccion es solo para los jefes de bar. Como trabajador puedes ver tus turnos y tareas.</p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-10 h-10 border-4 border-[#c4a77d] border-t-transparent rounded-full animate-spin"></div></div>;
  if (!barId) return <div className="text-center py-20"><Store className="w-14 h-14 text-[#3d3428] mx-auto mb-3"/><p className="text-[#8b7355]">Crea o selecciona un bar</p></div>;

  const ownerInfo = members.find(m=>m.role==='owner');
  const workerList = members.filter(m=>m.role==='worker');
  const pendingInvs = invitations.filter(i=>i.status==='pending');

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#f5ebe0] flex items-center gap-2.5">
            <Crown className="w-7 h-7 text-[#c4a77d]"/> Mi Equipo
          </h2>
          <p className="text-[#8b7355] text-sm mt-1">Gestiona tu bar y trabajadores</p>
        </div>
      </div>

      {/* Status message */}
      {inviteStatus&&(
        <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} className="flex items-center gap-2 bg-emerald-900/20 border border-emerald-800/50 text-emerald-300 px-4 py-3 rounded-xl">
          <Send className="w-4 h-4 shrink-0"/><p className="text-sm">{inviteStatus}</p>
        </motion.div>)}

      {/* Bar Name Card */}
      <div className="bg-[#231e19] border border-[#3d3428] rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-[#c4a77d] to-[#8b7355] rounded-xl flex items-center justify-center">
              <Store className="w-6 h-6 text-[#1a1612]"/>
            </div>
            {editingName?(
              <div className="flex items-center gap-2">
                <input value={barName} onChange={e=>setBarName(e.target.value)} className="px-3 py-1.5 bg-[#1a1612] border border-[#3d3428] rounded-lg text-[#f5ebe0] text-sm outline-none focus:border-[#c4a77d]" autoFocus onBlur={handleUpdateBarName} onKeyDown={e=>{if(e.key==='Enter')handleUpdateBarName();if(e.key==='Escape'){setBarName(activeBar?.bar_name||'');setEditingName(false);}}}/>
              </div>
            ):<div><p className="font-bold text-[#f5ebe0] text-lg">{barName}</p><p className="text-xs text-[#8b7355]">Tu bar</p></div>}
          </div>
          {!editingName&&(
            <button onClick={()=>setEditingName(true)} className="p-2 text-[#8b7355] hover:text-[#c4a77d] hover:bg-[#3d3428] rounded-lg transition-all">
              ✏️
            </button>)}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#231e19] border border-[#3d3428] rounded-2xl p-3">
          <div className="flex items-center gap-2"><div className="w-10 h-10 bg-[#c4a77d]/15 rounded-xl flex items-center justify-center"><Users className="w-5 h-5 text-[#c4a77d]"/></div><div><p className="text-xl font-bold text-[#f5ebe0]">{members.length}</p><p className="text-[10px] text-[#8b7355]">Miembros</p></div></div>
        </div>
        <div className="bg-[#231e19] border border-[#3d3428] rounded-2xl p-3">
          <div className="flex items-center gap-2"><div className="w-10 h-10 bg-amber-900/30 rounded-xl flex items-center justify-center"><Send className="w-5 h-5 text-amber-400"/></div><div><p className="text-xl font-bold text-[#f5ebe0]">{pendingInvs.length}</p><p className="text-[10px] text-[#8b7355]">Pendientes</p></div></div>
        </div>
        <div className="bg-[#231e19] border border-[#3d3428] rounded-2xl p-3">
          <div className="flex items-center gap-2"><div className="w-10 h-10 bg-emerald-900/30 rounded-xl flex items-center justify-center"><Crown className="w-5 h-5 text-emerald-400"/></div><div><p className="text-xl font-bold text-[#f5ebe0]">{workerList.length}</p><p className="text-[10px] text-[#8b7355]">Trabaj.</p></div></div>
        </div>
      </div>

      {/* Invite Button */}
      <motion.button whileTap={{scale:0.97}} onClick={()=>setShowInviteModal(true)} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#c4a77d] to-[#b8956a] text-[#1a1612] font-bold py-4 px-5 rounded-2xl shadow-lg shadow-[#c4a77d]/15 active:scale-[0.97]">
        <Send className="w-5 h-5"/> Enviar Invitacion
      </motion.button>

      {/* Pending Invitations */}
      {pendingInvs.length>0&&(
        <div>
          <h3 className="text-sm font-bold text-[#8b7355] uppercase tracking-wider mb-2 px-1">Invitaciones pendientes</h3>
          <div className="space-y-2">
            {pendingInvs.map(inv=>(
              <div key={inv.id} className="flex items-center gap-3 bg-[#231e19] border border-[#3d3428] rounded-xl p-3">
                <Mail className="w-5 h-5 text-amber-400 shrink-0"/>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#f5ebe0] truncate">{inv.email}</p>
                  <p className="text-xs text-[#5c4f42]">Enviada {new Date(inv.created_at).toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</p>
                </div>
                <button onClick={()=>handleCancelInvite(inv.id)} className="p-2 text-[#5c4f42] hover:text-red-400 hover:bg-red-900/20 rounded-lg shrink-0">
                  <X className="w-4 h-4"/>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Members - Mobile cards */}
      <div>
        <h3 className="text-sm font-bold text-[#8b7355] uppercase tracking-wider mb-2 px-1">Equipo ({members.length})</h3>
        <div className="space-y-2 sm:hidden">
          {members.map((m,idx)=>(
            <motion.div key={m.id||m.user_id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:idx*0.05}} className="bg-[#231e19] border border-[#3d3428] rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <Avatar name={m.users?.display_name||m.users?.email||'?'} src={m.users?.avatar_url} size="lg" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#f5ebe0] truncate">{m.users?.display_name||'Sin nombre'}</p>
                  <p className="text-xs text-[#8b7355] truncate">{m.users?.email}</p>
                </div>
                <span className={'px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 '+(m.role==='owner'?'bg-amber-900/30 text-amber-400':'bg-[#3d3428] text-[#a89a8a]')}>
                  {m.role==='owner'?'Jefe':'Trabaj.'}
                </span>
              </div>
              {m.role!=='owner'&&(
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[#3d3428]/50">
                  <button onClick={()=>handlePromoteMember(m.user_id)} className="flex items-center justify-center gap-2 py-2.5 text-sm text-[#c4a77d] hover:bg-[#c4a77d]/10 rounded-xl active:scale-95">
                    <Crown className="w-4 h-4"/> Hacer jefe
                  </button>
                  <button onClick={()=>handleRemoveMember(m.user_id)} className="flex items-center justify-center gap-2 py-2.5 text-sm text-red-400 hover:bg-red-900/10 rounded-xl active:scale-95">
                    <Trash2 className="w-4 h-4"/> Expulsar
                  </button>
                </div>)}
            </motion.div>
          ))}
        </div>
        {/* Desktop table */}
        <div className="hidden md:block bg-[#231e19] border border-[#3d3428] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-[#3d3428]"><th className="text-left px-5 py-3 text-xs font-semibold text-[#8b7355] uppercase">Miembro</th><th className="text-left px-5 py-3 text-xs font-semibold text-[#8b7355] uppercase">Email</th><th className="text-center px-5 py-3 text-xs font-semibold text-[#8b7355] uppercase">Rol</th><th className="text-right px-5 py-3 text-xs font-semibold text-[#8b7355] uppercase">Acciones</th></tr></thead>
            <tbody>
              {members.map(m=>(
                <tr key={m.id||m.user_id} className="border-b border-[#3d3428]/50 hover:bg-[#3d3428]/20">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.users?.display_name||m.users?.email||'?'} src={m.users?.avatar_url} size="sm" />
                      <p className="font-medium text-[#f5ebe0]">{m.users?.display_name||'Sin nombre'}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-[#a89a8a] text-sm">{m.users?.email}</td>
                  <td className="px-5 py-4 text-center">
                    <span className={'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold '+(m.role==='owner'?'bg-amber-900/30 text-amber-400':'bg-[#3d3428] text-[#a89a8a]')}>
                      {m.role==='owner'?<Crown className="w-3 h-3"/>:<Users className="w-3 h-3"/>}{m.role==='owner'?'Jefe':'Trabajador'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {m.role!=='owner'&&(
                      <div className="flex justify-end gap-1">
                        <button onClick={()=>handlePromoteMember(m.user_id)} className="p-2 text-[#5c4f42] hover:text-[#c4a77d] hover:bg-[#c4a77d]/10 rounded-lg" title="Hacer jefe">
                          <Crown className="w-4 h-4"/>
                        </button>
                        <button onClick={()=>handleRemoveMember(m.user_id)} className="p-2 text-[#5c4f42] hover:text-red-400 hover:bg-red-900/20 rounded-lg" title="Expulsar">
                          <Trash2 className="w-4 h-4"/>
                        </button>
                      </div>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      <AnimatePresence>{showInviteModal&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center" onClick={()=>setShowInviteModal(false)}>
          <motion.div initial={{y:'100%',opacity:0}} animate={{y:0,opacity:1}} exit={{y:'100%',opacity:0}} transition={{type:'spring',damping:25,stiffness:300}} className="bg-[#231e19] border-t sm:border border-t-[#3d3428] sm:border-[#3d3428] rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-[#f5ebe0]">Enviar Invitacion</h3>
              <button onClick={()=>setShowInviteModal(false)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#3d3428] text-[#8b7355] active:scale-90"><X className="w-5 h-5"/></button>
            </div>
            <div className="space-y-4">
              <div className="bg-[#c4a77d]/10 border border-[#c4a77d]/20 rounded-2xl p-3.5 text-sm text-[#c4a77d]">
                Se enviara una invitacion a {inviteEmail||'...'} para unirse a <strong>{barName}</strong>. La persona debera tener una cuenta en BarShift.
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#a89a8a] mb-2">Email del trabajador *</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5c4f42]"/>
                  <input type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="trabajador@email.com" autoFocus className="w-full pl-12 pr-4 py-3.5 bg-[#1a1612] border border-[#3d3428] rounded-2xl text-[#f5ebe0] placeholder-[#5c4f42] focus:border-[#c4a77d] outline-none text-base"/>
                </div>
              </div>
              <button onClick={handleSendInvite} disabled={!inviteEmail.trim()} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#c4a77d] to-[#b8956a] text-[#1a1612] font-bold py-3.5 px-4 rounded-2xl active:scale-[0.97] disabled:opacity-50 text-base">
                <Send className="w-5 h-5"/> Enviar Invitacion
              </button>
            </div>
          </motion.div>
        </motion.div>)}</AnimatePresence>
    </div>
  );
}
