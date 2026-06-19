import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Check, X, Clock, Store, Bell, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Invitations() {
  const { profile, pendingInvitations, refreshAll } = useAuth();
  const [actioningId, setActioningId] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');

  const handleRespond = async (invitationId, status) => {
    if (!profile?.id) return;
    try {
      setActioningId(invitationId);
      setStatusMsg('');
      const res = await fetch('/api/invitations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: invitationId, status, user_id: profile.id }),
      });
      const data = await res.json();
      if (!res.ok) { setStatusMsg(data.error || 'Error'); return; }
      setStatusMsg(status === 'accepted' ? 'Has aceptado la invitacion!' : 'Has rechazado la invitacion');
      refreshAll();
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (err) {
      setStatusMsg('Error de conexion');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-[#f5ebe0] flex items-center gap-2.5">
          <Bell className="w-7 h-7 text-[#c4a77d]"/> Invitaciones
        </h2>
        <p className="text-[#8b7355] text-sm mt-1">Invitaciones que has recibido para unirte a un bar</p>
      </div>

      {statusMsg && (
        <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} className={'flex items-center gap-2 px-4 py-3 rounded-xl '+(statusMsg.includes('aceptado')?'bg-emerald-900/20 border border-emerald-800/50 text-emerald-300':'bg-red-900/20 border border-red-800/50 text-red-300')}>
          {statusMsg.includes('aceptado')?<Check className="w-4 h-4 shrink-0"/>:<X className="w-4 h-4 shrink-0"/>}<p className="text-sm flex-1">{statusMsg}</p>
        </motion.div>)}

      {pendingInvitations.length === 0 ? (
        <div className="text-center py-16 bg-[#231e19] border border-[#3d3428] rounded-2xl">
          <Mail className="w-14 h-14 text-[#3d3428] mx-auto mb-4"/>
          <p className="text-[#8b7355] text-lg font-semibold">Sin invitaciones pendientes</p>
          <p className="text-[#5c4f42] text-sm mt-2 max-w-sm mx-auto">Cuando un jefe te invite a su bar, aparecera aqui para que puedas aceptar o rechazar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingInvitations.map((inv, idx) => (
            <motion.div
          key={inv.id}
          initial={{opacity:0,y:15}}
          animate={{opacity:1,y:0}}
          transition={{delay:idx*0.08}}
          className="bg-[#231e19] border border-[#3d3428] rounded-2xl p-4 sm:p-5"
        >
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-[#c4a77d]/20 to-[#8b7355]/20 rounded-2xl flex items-center justify-center shrink-0">
              <Store className="w-7 h-7 text-[#c4a77d]"/>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-[#f5ebe0] text-lg">{inv.bars?.name || 'Un bar'}</h3>
                  <p className="text-sm text-[#8b7355] mt-0.5">Te han invitado a unirte como trabajador</p>
                </div>
                <span className="shrink-0 px-2.5 py-1 bg-amber-900/20 text-amber-400 text-xs font-bold rounded-lg flex items-center gap-1">
                  <Clock className="w-3 h-3"/> Pendiente
                </span>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => handleRespond(inv.id, 'accepted')}
                  disabled={actioningId === inv.id}
                  className={'flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold transition-all active:scale-95 ' + (actioningId===inv.id?'opacity-50 cursor-wait':'bg-emerald-600 hover:bg-emerald-500 text-white')}
                >
                  {actioningId===inv.id?<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>:<><Check className="w-5 h-5"/> Aceptar Invitacion</>}
                </button>
                <button
                  onClick={() => handleRespond(inv.id, 'rejected')}
                  disabled={actioningId === inv.id}
                  className={'flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold transition-all active:scale-95 ' + (actioningId===inv.id?'opacity-50 cursor-wait':'bg-[#3d3428] text-[#8b7355] hover:bg-[#3d3428] hover:text-red-400 border border-[#3d3428]')}
                >
                  {actioningId===inv.id?<div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"/>:<><X className="w-5 h-5"/> Rechazar</>}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}