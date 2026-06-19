import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import supabase from '../lib/supabase';

const AuthContext = createContext({ 
  user: null, profile: null, session: null, loading: true,
  myBars: [], activeBar: null, setActiveBar: () => {}, refreshAll: () => {},
  refreshProfile: () => {}, pendingInvitations: [], barsLoaded: false
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myBars, setMyBars] = useState([]);
  const [activeBar, setActiveBar] = useState(null);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [barsLoaded, setBarsLoaded] = useState(false);
  const activeBarRef = useRef(null);

  // Keep ref in sync
  useEffect(() => { activeBarRef.current = activeBar; }, [activeBar]);

  const ensureProfileExists = async (authUser) => {
    if (!authUser) return null;
    try {
      const res = await fetch(`/api/users?user_id=${authUser.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.id) { setProfile(data); return data; }
      }
      const createRes = await fetch('/api/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: authUser.id, email: authUser.email,
          display_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Usuario',
          role: 'worker', avatar_url: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture,
        }),
      });
      if (createRes.ok) { const p = await createRes.json(); setProfile(p); return p; }
    } catch (err) { console.error('[Auth] Profile error:', err); }
    return null;
  };

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return null;
    try {
      const res = await fetch(`/api/users?user_id=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setProfile(data);
          return data;
        }
      }
    } catch (err) { console.error('[Auth] Refresh profile error:', err); }
    return null;
  }, [user?.id]);

  const fetchMyBars = useCallback(async (userId) => {
    if (!userId) return;
    try {
      console.log('[Auth] Fetching bars for:', userId);
      const res = await fetch(`/api/my-bar?user_id=${userId}`);
      console.log('[Auth] Bars response status:', res.status);
      if (res.ok) {
        const bars = await res.json();
        console.log('[Auth] Bars data:', JSON.stringify(bars));
        setMyBars(bars);
        
        // Use ref to check current value (avoid stale closure)
        const currentActive = activeBarRef.current;
        if (bars.length > 0 && !currentActive) {
          console.log('[Auth] Auto-selecting first bar:', bars[0]);
          setActiveBar(bars[0]);
        } else if (bars.length > 0 && currentActive) {
          const stillMember = bars.find(b => b.bar_id === currentActive.bar_id || String(b.bar_id) === String(currentActive.bar_id));
          if (!stillMember) {
            console.log('[Auth] Active bar invalid, switching to:', bars[0]);
            setActiveBar(bars[0]);
          }
        }
      } else {
        console.error('[Auth] Bars API error:', await res.text());
      }
    } catch (err) {
      console.error('[Auth] Bars error:', err);
    } finally {
      setBarsLoaded(true);
    }
  }, []); // No dependencies - uses ref instead

  const fetchInvitations = useCallback(async (email) => {
    if (!email) return;
    try {
      const res = await fetch(`/api/invitations?email=${encodeURIComponent(email)}&status=pending`);
      if (res.ok) setPendingInvitations(await res.json());
    } catch (err) { console.error('[Auth] Invitations error:', err); }
  }, []);

  const refreshAll = useCallback(() => {
    if (user) {
      fetchMyBars(user.id);
      if (profile?.email) fetchInvitations(profile.email);
    }
  }, [user, profile?.email, fetchMyBars, fetchInvitations]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setUser(session?.user ?? null); setLoading(false);
      if (session?.user) {
        ensureProfileExists(session.user).then(p => {
          if (p) { fetchMyBars(session.user.id); fetchInvitations(p.email); }
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session); setUser(session?.user ?? null); setLoading(false);
      if (session?.user) {
        const p = await ensureProfileExists(session.user);
        if (p) { fetchMyBars(session.user.id); fetchInvitations(p.email); }
      } else { setProfile(null); setMyBars([]); setActiveBar(null); setPendingInvitations([]); setBarsLoaded(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, myBars, activeBar, setActiveBar, pendingInvitations, refreshAll, refreshProfile, barsLoaded }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
