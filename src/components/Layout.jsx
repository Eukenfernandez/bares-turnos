import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Camera, CheckSquare, LogOut, Menu, MessageCircle, Users, X, Coffee, Bell, Store } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import supabase from '../lib/supabase';
import Avatar from './Avatar';

function imageFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) {
      reject(new Error('Selecciona una imagen'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 320;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const sourceSize = Math.min(img.width, img.height);
        const sourceX = (img.width - sourceSize) / 2;
        const sourceY = (img.height - sourceSize) / 2;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => reject(new Error('No se pudo leer la imagen'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

export default function Layout() {
  const { user, profile, myBars, activeBar, setActiveBar, pendingInvitations, refreshProfile, barsLoaded } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [chatHasMessages, setChatHasMessages] = useState(false);
  const fileInputRef = useRef(null);
  const isOwner = activeBar?.is_owner;
  const hasPending = pendingInvitations.length > 0;
  const profileName = profile?.display_name || user?.email || '?';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;
    try {
      setAvatarSaving(true);
      const avatar_url = await imageFileToDataUrl(file);
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: profile.id, avatar_url }),
      });
      if (!res.ok) throw new Error('No se pudo guardar la foto');
      await refreshProfile();
    } catch (err) {
      alert(err.message || 'Error guardando foto');
    } finally {
      setAvatarSaving(false);
      e.target.value = '';
    }
  };

  const fetchChatStatus = useCallback(async () => {
    if (!activeBar?.bar_id || !profile?.id) {
      setChatHasMessages(false);
      return;
    }
    try {
      const params = new URLSearchParams({ bar_id: activeBar.bar_id, user_id: profile.id });
      const res = await fetch(`/api/messages?${params}`);
      if (res.ok) {
        const data = await res.json();
        setChatHasMessages(Boolean(data.has_messages));
      }
    } catch {
      setChatHasMessages(false);
    }
  }, [activeBar?.bar_id, profile?.id]);

  useEffect(() => {
    fetchChatStatus();
    const timer = setInterval(fetchChatStatus, 15000);
    window.addEventListener('barshift-chat-read', fetchChatStatus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('barshift-chat-read', fetchChatStatus);
    };
  }, [fetchChatStatus]);

  const navItems = [
    { to: '/calendar', icon: Calendar, label: 'Turnos' },
    { to: '/tasks', icon: CheckSquare, label: 'Tareas' },
    { to: '/chat', icon: MessageCircle, label: 'Chat', dot: chatHasMessages },
  ];
  if (isOwner) navItems.push({ to: '/admin', icon: Users, label: 'Equipo' });
  if (hasPending) navItems.push({ to: '/invitations', icon: Bell, label: 'Invitaciones', badge: pendingInvitations.length });

  const bottomNavItems = [
    { to: '/calendar', icon: Calendar, label: 'Turnos' },
    { to: '/tasks', icon: CheckSquare, label: 'Tareas' },
    { to: '/chat', icon: MessageCircle, label: 'Chat', dot: chatHasMessages },
    ...(isOwner ? [{ to: '/admin', icon: Users, label: 'Equipo' }] : []),
  ];

  const isActive = (path) => location.pathname === path;

  // No team yet -> route to the onboarding (jefe/trabajador) screen
  if (barsLoaded && myBars.length === 0) return <Navigate to="/welcome" replace />;

  return (
    <div className="min-h-screen bg-[#1a1612] flex flex-col pb-20 md:pb-0">
      {/* Header */}
      <header className="bg-[#231e19]/95 backdrop-blur-sm border-b border-[#3d3428] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
            <NavLink to="/calendar" className="flex items-center gap-2 sm:gap-3 group">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-[#c4a77d] to-[#8b7355] rounded-lg flex items-center justify-center shadow-lg">
                <Coffee className="w-4 h-4 sm:w-5 sm:h-5 text-[#1a1612]" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-[#f5ebe0] tracking-wide">BarShift</h1>
                <p className="text-[10px] text-[#8b7355] uppercase tracking-widest -mt-0.5">Gestion de Turnos</p>
              </div>
            </NavLink>

            {/* Bar selector */}
            {myBars.length > 1 && (
              <div className="hidden sm:flex items-center gap-2 bg-[#1a1612] border border-[#3d3428] rounded-xl px-3 py-1.5">
                <Store className="w-4 h-4 text-[#c4a77d]" />
                <select
                  value={activeBar?.bar_id || ''}
                  onChange={e => {
                    const bar = myBars.find(b => String(b.bar_id) === e.target.value);
                    if (bar) setActiveBar(bar);
                  }}
                  className="bg-transparent text-sm text-[#f5ebe0] font-medium outline-none cursor-pointer"
                >
                  {myBars.map(b => (
                    <option key={b.bar_id} value={b.bar_id}>{b.bar_name}</option>
                  ))}
                </select>
              </div>
            )}
            {myBars.length === 1 && activeBar && (
              <div className="hidden sm:flex items-center gap-2 text-[#c4a77d] text-sm font-medium">
                <Store className="w-4 h-4" />{activeBar.bar_name}
              </div>
            )}

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} className={'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all relative ' + (isActive(item.to) ? 'bg-[#c4a77d]/15 text-[#c4a77d]' : 'text-[#a89a8a] hover:text-[#f5ebe0] hover:bg-[#3d3428]/50')}>
                  <span className="relative">
                    <item.icon className="w-4 h-4" />
                    {item.dot&&<span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 border border-[#231e19] rounded-full" />}
                  </span>
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{item.badge}</span>
                  )}
                </NavLink>
              ))}
            </nav>

            {/* User Menu - Desktop */}
            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center gap-3 mr-2">
                <div className="text-right">
                  <p className="text-sm font-medium text-[#f5ebe0]">{profile?.display_name || user?.email}</p>
                  <p className={'text-xs capitalize ' + (isOwner ? 'text-[#c4a77d]' : 'text-[#8b7355]')}>
                    {isOwner ? 'Jefe del bar' : 'Trabajador'}
                  </p>
                </div>
                <button type="button" onClick={()=>fileInputRef.current?.click()} disabled={avatarSaving} className="relative rounded-full active:scale-95" title="Cambiar foto">
                  <Avatar name={profileName} src={profile?.avatar_url} size="md" />
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#3d3428] border border-[#231e19] flex items-center justify-center text-[#c4a77d]">
                    <Camera className="w-3 h-3" />
                  </span>
                </button>
              </div>
              <button onClick={handleSignOut} className="p-2.5 text-[#8b7355] hover:text-[#e07a5f] hover:bg-[#3d3428]/50 rounded-xl transition-all" title="Cerrar sesion">
                <LogOut className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="flex md:hidden items-center gap-2">
              <button type="button" onClick={()=>fileInputRef.current?.click()} disabled={avatarSaving} className="relative rounded-full active:scale-95" title="Cambiar foto">
                <Avatar name={profileName} src={profile?.avatar_url} size="sm" className="font-semibold" />
              </button>
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2.5 text-[#a89a8a] hover:text-[#f5ebe0] rounded-xl">
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="md:hidden border-t border-[#3d3428] overflow-hidden">
              <div className="px-3 py-3 space-y-1">
                {/* User info */}
                <div className="flex items-center gap-3 px-3 py-3 mb-2 bg-[#1a1612]/50 rounded-xl">
                  <button type="button" onClick={()=>fileInputRef.current?.click()} disabled={avatarSaving} className="relative rounded-full active:scale-95" title="Cambiar foto">
                    <Avatar name={profileName} src={profile?.avatar_url} size="md" />
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#3d3428] border border-[#1a1612] flex items-center justify-center text-[#c4a77d]">
                      <Camera className="w-3 h-3" />
                    </span>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#f5ebe0] truncate">{profile?.display_name || user?.email}</p>
                    <p className={'text-xs capitalize ' + (isOwner ? 'text-[#c4a77d]' : 'text-[#8b7355]')}>
                      {activeBar ? `${activeBar.bar_name} · ${isOwner ? 'Jefe' : 'Trabajador'}` : 'Sin bar asignado'}
                    </p>
                  </div>
                </div>

                {/* Bar selector mobile */}
                {myBars.length > 1 && (
                  <div className="px-3 mb-2">
                    <select value={activeBar?.bar_id || ''} onChange={e => { const b = myBars.find(x => String(x.bar_id) === e.target.value); if (b) setActiveBar(b); }} className="w-full px-3 py-2.5 bg-[#1a1612] border border-[#3d3428] rounded-xl text-[#f5ebe0] text-sm">
                      {myBars.map(b => <option key={b.bar_id} value={b.bar_id}>🏪 {b.bar_name}</option>)}
                    </select>
                  </div>
                )}

                {/* Nav links */}
                {navItems.map((item) => (
                  <NavLink key={item.to} to={item.to} onClick={() => setMobileMenuOpen(false)} className={'flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium transition-all relative ' + (isActive(item.to) ? 'bg-[#c4a77d]/15 text-[#c4a77d]' : 'text-[#a89a8a] active:text-[#f5ebe0] active:bg-[#3d3428]/50')}>
                    <span className="relative">
                      <item.icon className="w-5 h-5" />
                      {item.dot&&<span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 border border-[#231e19] rounded-full" />}
                    </span>
                    <span>{item.label}</span>
                    {item.badge && <span className="ml-auto w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{item.badge}</span>}
                  </NavLink>
                ))}

                <button onClick={() => { handleSignOut(); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium text-red-400 hover:bg-red-900/20 mt-2">
                  <LogOut className="w-5 h-5" /> Cerrar sesion
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content - Always render Outlet, pages handle their own empty states */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        <Outlet />
      </main>

      {/* Bottom Navigation - Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#231e19]/98 backdrop-blur-md border-t border-[#3d3428] z-50 safe-area-pb">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {bottomNavItems.map((item) => {
            const active = isActive(item.to);
            return (
              <NavLink key={item.to} to={item.to} className={'flex flex-col items-center gap-0.5 py-2 px-3 min-w-[64px] transition-all active:scale-95 ' + (active ? 'text-[#c4a77d]' : 'text-[#5c4f42]')}>
                <div className={'relative p-1.5 rounded-xl transition-all ' + (active ? 'bg-[#c4a77d]/15' : '')}>
                  <item.icon className={'w-5 h-5 ' + (active ? 'stroke-[2.5]' : '')} strokeWidth={active ? 2.5 : 1.5} />
                  {item.dot&&<span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 border border-[#231e19] rounded-full" />}
                </div>
                <span className={'text-[10px] font-medium ' + (active ? 'font-bold' : '')}>{item.label}</span>
                {active && <motion.div layoutId="bottomNavIndicator" className="w-1 h-1 rounded-full bg-[#c4a77d] mt-0.5" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Footer - Desktop */}
      <footer className="hidden md:block border-t border-[#3d3428] py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <p className="text-xs text-[#5c4f42]">BarShift &copy; {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}

function NoBarScreen() {
  const { user, profile } = useAuth();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <Store className="w-16 h-16 text-[#3d3428] mx-auto mb-4" />
      <h2 className="text-xl font-bold text-[#f5ebe0] mb-2">Sin bar asignado</h2>
      <p className="text-[#8b7355] text-sm max-w-sm">
        {user ? `Hola ${profile?.display_name || ''}, aun no perteneces a ningun bar. Tu jefe debe enviarte una invitacion.` : 'Inicia sesion para continuar.'}
      </p>
    </div>
  );
}
