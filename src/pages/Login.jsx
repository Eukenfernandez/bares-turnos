import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { signInWithGoogle } from '../lib/googleAuth';
import { Coffee, Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import supabase from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  if (!authLoading && user) {
    navigate('/calendar');
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      if (isSignUp) {
        if (!fullName.trim()) throw new Error('Introduce tu nombre y apellidos');
        const cleanName = fullName.trim();
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: cleanName, name: cleanName } },
        });
        if (err) throw err;
        if (data.user) {
          await fetch('/api/users', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: data.user.id, email: data.user.email, display_name: cleanName, role: 'worker' }),
          });
        }
        setError('Cuenta creada! Revisa tu email.');
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        navigate('/calendar');
      }
    } catch (err) {
      setError(err.message || 'Error al iniciar sesion');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#1a1612] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#c4a77d]/5 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#8b7355]/5 rounded-full blur-3xl"></div>
      </div>
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 0.2 }} className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[#c4a77d] to-[#8b7355] rounded-3xl shadow-xl mb-6">
            <Coffee className="w-10 h-10 text-[#1a1612]" />
          </motion.div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#f5ebe0] mb-2">BarShift</h1>
          <p className="text-[#8b7355]">Gestion de turnos para tu bar</p>
        </div>
        <div className="bg-[#231e19] border border-[#3d3428] rounded-3xl p-6 sm:p-8 shadow-2xl">
          <button onClick={() => signInWithGoogle('BarShift')} className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-semibold py-4 px-4 rounded-2xl hover:bg-gray-50 transition-all active:scale-[0.98] shadow-lg">
            <svg className="w-6 h-6" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continuar con Google
          </button>
          <div className="relative my-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#3d3428]"></div></div><div className="relative flex justify-center text-sm"><span className="px-4 bg-[#231e19] text-[#5c4f42]">o usa tu email</span></div></div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && <div><label className="block text-sm font-medium text-[#a89a8a] mb-2">Nombre y apellidos</label><input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nombre Apellido" required={isSignUp} autoComplete="name" className="w-full px-4 py-3.5 bg-[#1a1612] border border-[#3d3428] rounded-2xl text-[#f5ebe0] placeholder-[#5c4f42] focus:border-[#c4a77d] outline-none text-base" /></div>}
            <div><label className="block text-sm font-medium text-[#a89a8a] mb-2">Email</label><div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5c4f42]" /><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" required className="w-full pl-12 pr-4 py-3.5 bg-[#1a1612] border border-[#3d3428] rounded-2xl text-[#f5ebe0] placeholder-[#5c4f42] focus:border-[#c4a77d] outline-none text-base" /></div></div>
            <div><label className="block text-sm font-medium text-[#a89a8a] mb-2">Contrasena</label><div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5c4f42]" /><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="w-full pl-12 pr-4 py-3.5 bg-[#1a1612] border border-[#3d3428] rounded-2xl text-[#f5ebe0] placeholder-[#5c4f42] focus:border-[#c4a77d] outline-none text-base" /></div></div>
            {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={'text-sm p-3 rounded-xl ' + (error.includes('creada') ? 'bg-emerald-900/20 text-emerald-400' : 'bg-red-900/20 text-red-400')}>{error}</motion.p>}
            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#c4a77d] to-[#b8956a] text-[#1a1612] font-bold py-4 px-4 rounded-2xl hover:from-[#d4b78d] hover:to-[#c4a77d] transition-all disabled:opacity-60 shadow-lg active:scale-[0.98]">{loading ? <div className="w-6 h-6 border-2.5 border-[#1a1612] border-t-transparent rounded-full animate-spin"></div> : <>{isSignUp ? 'Crear Cuenta' : 'Iniciar Sesion'}<ArrowRight className="w-5 h-5" /></>}</button>
          </form>
          <p className="text-center mt-6 text-sm text-[#8b7355]">{isSignUp ? 'Ya tienes cuenta?' : 'No tienes cuenta?'} <button onClick={() => { setIsSignUp(!isSignUp); setError(''); }} className="text-[#c4a77d] hover:text-[#d4b78d] font-bold">{isSignUp ? 'Inicia sesion' : 'Registrate'}</button></p>
        </div>
        <p className="text-center mt-6 text-xs text-[#5c4f42] flex items-center justify-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Diseno Frontier para bares</p>
      </motion.div>
    </div>
  );
}
