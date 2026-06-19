import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Crown, Users, Store, ArrowRight, ArrowLeft, Mail, Check, X, RefreshCw, Coffee, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Onboarding() {
  const { profile, myBars, barsLoaded, pendingInvitations, refreshAll } = useAuth();
  const [mode, setMode] = useState(null); // null | 'jefe' | 'trabajador'
  const [barName, setBarName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actioningId, setActioningId] = useState(null);
  const [error, setError] = useState('');

  // Wait until we know whether the user belongs to a bar
  if (!barsLoaded) {
    return (
      <div className="min-h-screen bg-[#1a1612] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#c4a77d] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  // Already in a team -> straight to the app
  if (myBars.length > 0) return <Navigate to="/calendar" replace />;

  const createBar = async () => {
    if (!barName.trim() || !profile?.id) return;
    try {
      setSubmitting(true); setError('');
      const res = await fetch('/api/bars', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: barName.trim(), owner_id: profile.id }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Error creando el bar'); }
      refreshAll(); // myBars updates -> redirect kicks in
    } catch (err) { setError(err.message); setSubmitting(false); }
  };

  const respondInvite = async (id, status) => {
    if (!profile?.id) return;
    try {
      setActioningId(id); setError('');
      const res = await fetch('/api/invitations', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, user_id: profile.id }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Error'); }
      refreshAll();
      if (status === 'rejected') setActioningId(null);
    } catch (err) { setError(err.message); setActioningId(null); }
  };

  return (
    <div className="min-h-screen bg-[#1a1612] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#c4a77d]/5 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#8b7355]/5 rounded-full blur-3xl"></div>
      </div>

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#c4a77d] to-[#8b7355] rounded-3xl shadow-xl mb-5">
            <Coffee className="w-8 h-8 text-[#1a1612]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#f5ebe0] mb-2">Hola, {profile?.display_name || 'bienvenido'}</h1>
          <p className="text-[#8b7355]">¿Cómo vas a usar BarShift?</p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 bg-red-900/20 border border-red-800/50 text-red-300 px-4 py-3 rounded-xl text-sm">
            <X className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* ---------- Choice ---------- */}
          {mode === null && (
            <motion.div key="choice" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid sm:grid-cols-2 gap-4">
              <button onClick={() => { setError(''); setMode('jefe'); }} className="group text-left bg-[#231e19] border border-[#3d3428] hover:border-[#c4a77d]/60 rounded-3xl p-6 transition-all active:scale-[0.98]">
                <div className="w-14 h-14 bg-amber-900/30 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Crown className="w-7 h-7 text-amber-400" />
                </div>
                <h3 className="text-lg font-bold text-[#f5ebe0] mb-1">Soy Jefe</h3>
                <p className="text-sm text-[#8b7355] mb-3">Crea tu bar y tu equipo. Tú gestionas turnos, tareas e invitas a tus trabajadores.</p>
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#c4a77d]">Crear mi equipo <ArrowRight className="w-4 h-4" /></span>
              </button>

              <button onClick={() => { setError(''); setMode('trabajador'); refreshAll(); }} className="group text-left bg-[#231e19] border border-[#3d3428] hover:border-[#c4a77d]/60 rounded-3xl p-6 transition-all active:scale-[0.98]">
                <div className="w-14 h-14 bg-[#c4a77d]/15 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Users className="w-7 h-7 text-[#c4a77d]" />
                </div>
                <h3 className="text-lg font-bold text-[#f5ebe0] mb-1">Soy Trabajador</h3>
                <p className="text-sm text-[#8b7355] mb-3">Únete al equipo de tu jefe. Verás tus turnos y completarás las tareas del bar.</p>
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#c4a77d]">
                  Ver invitaciones
                  {pendingInvitations.length > 0 && <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{pendingInvitations.length}</span>}
                  <ArrowRight className="w-4 h-4" />
                </span>
              </button>
            </motion.div>
          )}

          {/* ---------- Jefe: create bar ---------- */}
          {mode === 'jefe' && (
            <motion.div key="jefe" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="bg-[#231e19] border border-[#3d3428] rounded-3xl p-6 sm:p-8">
              <div className="w-14 h-14 bg-amber-900/30 rounded-2xl flex items-center justify-center mb-5">
                <Crown className="w-7 h-7 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-[#f5ebe0] mb-1">Crea tu bar</h3>
              <p className="text-sm text-[#8b7355] mb-5">Ponle nombre a tu bar. Serás el jefe y podrás invitar a tu equipo después.</p>
              <label className="block text-sm font-semibold text-[#a89a8a] mb-2">Nombre del bar</label>
              <div className="relative mb-5">
                <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5c4f42]" />
                <input
                  autoFocus value={barName} onChange={e => setBarName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') createBar(); }}
                  placeholder="Ej: Bar Los Amigos"
                  className="w-full pl-12 pr-4 py-3.5 bg-[#1a1612] border border-[#3d3428] rounded-2xl text-[#f5ebe0] placeholder-[#5c4f42] focus:border-[#c4a77d] outline-none text-base"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setMode(null); setBarName(''); setError(''); }} className="flex items-center justify-center gap-2 bg-[#3d3428] text-[#a89a8a] font-semibold py-3.5 px-5 rounded-2xl active:scale-95">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button onClick={createBar} disabled={!barName.trim() || submitting} className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#c4a77d] to-[#b8956a] text-[#1a1612] font-bold py-3.5 px-4 rounded-2xl active:scale-[0.97] disabled:opacity-50 text-base">
                  {submitting ? <div className="w-6 h-6 border-2.5 border-[#1a1612] border-t-transparent rounded-full animate-spin"></div> : <>Crear mi bar <ArrowRight className="w-5 h-5" /></>}
                </button>
              </div>
            </motion.div>
          )}

          {/* ---------- Trabajador: invitations ---------- */}
          {mode === 'trabajador' && (
            <motion.div key="trabajador" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="bg-[#231e19] border border-[#3d3428] rounded-3xl p-6 sm:p-8">
              <div className="flex items-center justify-between mb-5">
                <div className="w-14 h-14 bg-[#c4a77d]/15 rounded-2xl flex items-center justify-center">
                  <Users className="w-7 h-7 text-[#c4a77d]" />
                </div>
                <button onClick={refreshAll} className="flex items-center gap-1.5 text-sm font-semibold text-[#c4a77d] hover:bg-[#3d3428] px-3 py-2 rounded-xl active:scale-95">
                  <RefreshCw className="w-4 h-4" /> Actualizar
                </button>
              </div>

              {pendingInvitations.length > 0 ? (
                <>
                  <h3 className="text-xl font-bold text-[#f5ebe0] mb-1">Tus invitaciones</h3>
                  <p className="text-sm text-[#8b7355] mb-5">Acepta la invitación de tu jefe para unirte a su equipo.</p>
                  <div className="space-y-3">
                    {pendingInvitations.map(inv => (
                      <div key={inv.id} className="bg-[#1a1612] border border-[#3d3428] rounded-2xl p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-11 h-11 bg-gradient-to-br from-[#c4a77d]/20 to-[#8b7355]/20 rounded-xl flex items-center justify-center shrink-0">
                            <Store className="w-6 h-6 text-[#c4a77d]" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-[#f5ebe0] truncate">{inv.bars?.name || 'Un bar'}</p>
                            <p className="text-xs text-[#8b7355]">Te invitan como trabajador</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => respondInvite(inv.id, 'accepted')} disabled={actioningId === inv.id} className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl active:scale-95 disabled:opacity-50">
                            {actioningId === inv.id ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check className="w-5 h-5" /> Aceptar</>}
                          </button>
                          <button onClick={() => respondInvite(inv.id, 'rejected')} disabled={actioningId === inv.id} className="flex items-center justify-center gap-2 bg-[#3d3428] text-[#8b7355] hover:text-red-400 font-bold py-2.5 px-4 rounded-xl active:scale-95 disabled:opacity-50">
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-bold text-[#f5ebe0] mb-1">Esperando invitación</h3>
                  <p className="text-sm text-[#8b7355] mb-5">Aún no tienes invitaciones. Dale este email a tu jefe para que te invite a su bar:</p>
                  <div className="flex items-center gap-3 bg-[#1a1612] border border-[#3d3428] rounded-2xl p-4 mb-5">
                    <Mail className="w-5 h-5 text-[#c4a77d] shrink-0" />
                    <span className="font-medium text-[#f5ebe0] text-sm break-all">{profile?.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#5c4f42]">
                    <Clock className="w-3.5 h-3.5" /> Cuando tu jefe te invite, pulsa «Actualizar».
                  </div>
                </>
              )}

              <button onClick={() => { setMode(null); setError(''); }} className="mt-6 flex items-center gap-2 text-sm font-semibold text-[#8b7355] hover:text-[#c4a77d]">
                <ArrowLeft className="w-4 h-4" /> Volver
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
