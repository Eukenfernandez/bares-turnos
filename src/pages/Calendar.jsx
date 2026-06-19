import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft, ChevronRight, Plus, Trash2, Save, X, CalendarDays, Store, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DAYS_ES = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const DAYS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const SHIFT_COLORS = ['from-amber-500 to-orange-600', 'from-emerald-500 to-teal-600', 'from-blue-500 to-indigo-600', 'from-purple-500 to-pink-600', 'from-rose-500 to-red-600', 'from-cyan-500 to-sky-600'];
const SHIFT_TYPES = [
  { value: 'morning', label: 'Mañana', shortLabel: 'Mañana', start: '08:00', end: '16:00' },
  { value: 'afternoon', label: 'Tarde', shortLabel: 'Tarde', start: '16:00', end: '00:00' },
  { value: 'closing', label: 'Cierre', shortLabel: 'Cierre', start: '18:00', end: '02:00' },
  { value: 'split', label: 'Partido (Mañana y Tarde)', shortLabel: 'Partido', start: '12:00', end: '16:00', secondStart: '20:00', secondEnd: '00:00', split: true },
  { value: 'support', label: 'Refuerzo', shortLabel: 'Refuerzo', start: '20:00', end: '00:00' },
  { value: 'event', label: 'Evento especial', shortLabel: 'Evento', start: '18:00', end: '02:00' },
];
const SHIFT_TYPE_BY_VALUE = Object.fromEntries(SHIFT_TYPES.map(type => [type.value, type]));
const SHIFT_TYPE_MARKER_RE = /^<!--shift_type:([^>\n]+)-->\n?/;
const DEFAULT_SHIFT_TYPE = 'afternoon';

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getWeekStart = (date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay();
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
  return start;
};

const getWeekDays = (date) => {
  const start = getWeekStart(date);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
};

const cleanShiftType = (type) => SHIFT_TYPE_BY_VALUE[type] ? type : DEFAULT_SHIFT_TYPE;

const parseShiftNotes = (notes) => {
  const text = notes || '';
  const match = text.match(SHIFT_TYPE_MARKER_RE);
  const shiftType = cleanShiftType(match?.[1]);
  return {
    shift_type: shiftType,
    notes: match ? text.replace(SHIFT_TYPE_MARKER_RE, '') : text,
  };
};

const encodeShiftNotes = (notes, shiftType) => `<!--shift_type:${cleanShiftType(shiftType)}-->\n${notes || ''}`;

export default function Calendar() {
  const { profile, activeBar } = useAuth();
  const isOwner = activeBar?.is_owner;
  const barId = activeBar?.bar_id;
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month');
  const [shifts, setShifts] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedWorkerFilter, setSelectedWorkerFilter] = useState('all');
  const [formWorker, setFormWorker] = useState('');
  const [formShiftType, setFormShiftType] = useState(DEFAULT_SHIFT_TYPE);
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formStart2, setFormStart2] = useState('');
  const [formEnd2, setFormEnd2] = useState('');
  const [formSplit, setFormSplit] = useState(false);
  const [formApplyDates, setFormApplyDates] = useState([]);
  const [formNotes, setFormNotes] = useState('');

  useEffect(() => {
    if (!barId) return;
    setViewMode(isOwner ? 'month' : 'week');
    setCurrentDate(new Date());
  }, [barId, isOwner]);

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const currentWeekStart = useMemo(() => getWeekStart(new Date()), []);
  const selectedWeekStart = useMemo(() => getWeekStart(currentDate), [currentDate]);
  const canGoNext = isOwner || viewMode !== 'week' || formatDateKey(selectedWeekStart) < formatDateKey(currentWeekStart);
  const viewRange = useMemo(() => {
    if (viewMode === 'week') {
      const start = getWeekStart(currentDate);
      const end = addDays(start, 6);
      const sameMonth = start.getMonth() === end.getMonth();
      const sameYear = start.getFullYear() === end.getFullYear();
      const label = sameMonth && sameYear
        ? `${start.getDate()}-${end.getDate()} ${MONTHS_ES[end.getMonth()]} ${end.getFullYear()}`
        : `${start.getDate()} ${MONTHS_ES[start.getMonth()]} ${start.getFullYear()} - ${end.getDate()} ${MONTHS_ES[end.getMonth()]} ${end.getFullYear()}`;
      return { start: formatDateKey(start), end: formatDateKey(end), label };
    }
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    return {
      start: formatDateKey(start),
      end: formatDateKey(end),
      label: `${MONTHS_ES[currentDate.getMonth()]} ${currentDate.getFullYear()}`,
    };
  }, [currentDate, viewMode]);

  const fetchData = useCallback(async () => {
    if (!barId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({ start_date: viewRange.start, end_date: viewRange.end, bar_id: barId });
      if (!isOwner && profile) params.set('user_id', profile.id);
      
      const [shiftsRes, workersRes] = await Promise.all([
        fetch(`/api/shifts?${params}`),
        isOwner ? fetch(`/api/bar-members?bar_id=${barId}`) : Promise.resolve({ ok: false }),
      ]);
      if (shiftsRes.ok) setShifts(await shiftsRes.json());
      if (workersRes.ok) {
        const members = await workersRes.json();
        setWorkers(members.map(m => ({ id: m.user_id, display_name: m.users?.display_name || m.users?.email || '?', email: m.users?.email })));
      }
    } catch (err) { console.error('Error fetching data:', err); }
    finally { setLoading(false); }
  }, [viewRange.start, viewRange.end, barId, isOwner, profile]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const visibleShifts = useMemo(() => {
    if (isOwner && selectedWorkerFilter !== 'all') return shifts.filter(s => s.user_id === selectedWorkerFilter);
    return shifts;
  }, [shifts, isOwner, selectedWorkerFilter]);

  const shiftsByDate = useMemo(() => {
    const grouped = {};
    visibleShifts.forEach(shift => { if (!grouped[shift.date]) grouped[shift.date] = []; grouped[shift.date].push(shift); });
    return Object.entries(grouped).sort((a,b) => a[0].localeCompare(b[0])).map(([date, items]) => ({ date, shifts: items }));
  }, [visibleShifts]);

  const calendarDays = useMemo(() => {
    const y = currentDate.getFullYear(), m = currentDate.getMonth();
    const first = new Date(y, m, 1), last = new Date(y, m+1, 0);
    const days = [];
    for (let i=0;i<(first.getDay()+6)%7;i++) days.push(null);
    for (let d=1;d<=last.getDate();d++) days.push(new Date(y,m,d));
    return days;
  }, [currentDate]);

  const getShiftsForDate = (date) => {
    if (!date) return [];
    return visibleShifts.filter(s => s.date === formatDateKey(date));
  };

  const getWorkerName = (uid) => workers.find(w => w.id === uid)?.display_name || '?';
  const getWorkerColorIdx = (uid) => Math.max(0, workers.findIndex(w => w.id === uid) % SHIFT_COLORS.length);
  const selectedDateKey = selectedDate ? formatDateKey(selectedDate) : '';
  const selectedFormWeekDays = useMemo(() => selectedDate ? getWeekDays(selectedDate) : [], [selectedDate]);
  const selectedFormWeekLabel = useMemo(() => {
    if (selectedFormWeekDays.length === 0) return '';
    const start = selectedFormWeekDays[0];
    const end = selectedFormWeekDays[selectedFormWeekDays.length - 1];
    return `${start.getDate()} ${MONTHS_ES[start.getMonth()]} - ${end.getDate()} ${MONTHS_ES[end.getMonth()]}`;
  }, [selectedFormWeekDays]);

  const setShiftTypeDefaults = (typeValue) => {
    const type = SHIFT_TYPE_BY_VALUE[cleanShiftType(typeValue)] || SHIFT_TYPE_BY_VALUE[DEFAULT_SHIFT_TYPE];
    setFormShiftType(type.value);
    setFormStart(type.start);
    setFormEnd(type.end);
    setFormStart2(type.secondStart || '');
    setFormEnd2(type.secondEnd || '');
    setFormSplit(Boolean(type.split));
  };

  const handleShiftTypeChange = (typeValue) => setShiftTypeDefaults(typeValue);

  const handleSplitToggle = (checked) => {
    setFormSplit(checked);
    if (checked) {
      setShiftTypeDefaults('split');
    } else if (formShiftType === 'split') {
      setShiftTypeDefaults(DEFAULT_SHIFT_TYPE);
    }
  };

  const toggleApplyDate = (dateKey) => {
    setFormApplyDates(current => (
      current.includes(dateKey)
        ? current.filter(key => key !== dateKey)
        : [...current, dateKey].sort()
    ));
  };

  const getShiftDisplayInfo = (shift) => {
    const parsed = parseShiftNotes(shift.notes);
    const type = SHIFT_TYPE_BY_VALUE[parsed.shift_type] || SHIFT_TYPE_BY_VALUE[DEFAULT_SHIFT_TYPE];
    return { type, notes: parsed.notes };
  };

  const openAddModal = (date) => {
    if (!isOwner) return;
    const nextDate = date || currentDate;
    setSelectedDate(nextDate); setEditingShift(null);
    setFormWorker(''); setShiftTypeDefaults(DEFAULT_SHIFT_TYPE); setFormApplyDates([formatDateKey(nextDate)]); setFormNotes(''); setShowAddModal(true);
  };

  const openEditModal = (shift) => {
    if (!isOwner) return;
    const parsed = parseShiftNotes(shift.notes);
    setSelectedDate(new Date(shift.date+'T00:00:00')); setEditingShift(shift);
    setFormWorker(shift.user_id); setFormShiftType(parsed.shift_type); setFormStart(shift.start_time); setFormEnd(shift.end_time); setFormStart2(''); setFormEnd2(''); setFormSplit(false); setFormApplyDates([shift.date]); setFormNotes(parsed.notes); setShowAddModal(true);
  };

  const handleSave = async () => {
    const targetDates = editingShift ? [selectedDateKey] : formApplyDates;
    if (!selectedDate || !formStart || !formEnd || !barId || targetDates.length === 0) return;
    if (formSplit && !editingShift && (!formStart2 || !formEnd2)) return;
    const basePayload = { bar_id: barId, user_id: formWorker || profile?.id, notes: encodeShiftNotes(formNotes, formShiftType) };
    const buildRowsForDate = (date) => {
      const first = { ...basePayload, date, start_time: formStart, end_time: formEnd };
      if (!formSplit || editingShift) return [first];
      return [
        first,
        { ...basePayload, date, start_time: formStart2, end_time: formEnd2 },
      ];
    };
    try {
      const method = editingShift ? 'PUT' : 'POST';
      const body = editingShift ? { id: editingShift.id, ...buildRowsForDate(selectedDateKey)[0] } : { shifts: targetDates.flatMap(buildRowsForDate) };
      const res = await fetch('/api/shifts', { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('Error guardando turno');
      setShowAddModal(false); fetchData();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => { if (!confirm('Eliminar este turno?')) return; await fetch('/api/shifts',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})}); fetchData(); setShowAddModal(false); };
  const prevPeriod = () => setCurrentDate(viewMode === 'week' ? addDays(currentDate, -7) : new Date(currentDate.getFullYear(), currentDate.getMonth()-1, 1));
  const nextPeriod = () => { if (canGoNext) setCurrentDate(viewMode === 'week' ? addDays(currentDate, 7) : new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 1)); };
  const goToToday = () => setCurrentDate(new Date());
  const today = formatDateKey(new Date());
  const formatDateHeader = (ds) => { const d=new Date(ds+'T00:00:00'); return {dayName:DAYS_FULL[d.getDay()], dayNum:d.getDate(), monthName:MONTHS_ES[d.getMonth()], isToday:ds===today}; };
  const mobileShiftGroups = viewMode === 'week' ? weekDays.map(date => ({ date: formatDateKey(date), shifts: getShiftsForDate(date) })) : shiftsByDate;
  const gridDays = viewMode === 'week' ? weekDays : calendarDays;

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-10 h-10 border-4 border-[#c4a77d] border-t-transparent rounded-full animate-spin"></div></div>;
  if (!barId) {
    const { user: authUser } = useAuth();
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <motion.div initial={{scale:0.8,opacity:0}} animate={{scale:1,opacity:1}} transition={{delay:0.1}}>
          <div className="w-20 h-20 bg-gradient-to-br from-[#c4a77d]/20 to-[#8b7355]/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Store className="w-10 h-10 text-[#c4a77d]" />
          </div>
          <h2 className="text-2xl font-bold text-[#f5ebe0] mb-2">{authUser ? 'Sin bar asignado' : 'Bienvenido a BarShift'}</h2>
          <p className="text-[#8b7355] max-w-sm mx-auto mb-8">
            {authUser ? 'Necesitas pertenecer a un bar para ver turnos. Tu jefe puede enviarte una invitacion, o crea tu propio bar.' : 'Inicia sesion para gestionar los turnos de tu bar.'}
          </p>
          {authUser && (
            <motion.button whileTap={{scale:0.97}} onClick={async()=>{
              const name = prompt('Nombre de tu bar:');
              if(!name?.trim()) return;
              try {
                const res = await fetch('/api/bars',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.trim(),owner_id:authUser.id})});
                if(res.ok) window.location.reload();
                else { const d=await res.json(); alert(d.error||'Error'); }
              } catch(err) { alert('Error: '+err.message); }
            }} className="flex items-center gap-2 bg-gradient-to-r from-[#c4a77d] to-[#b8956a] text-[#1a1612] font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-[#c4a77d]/15">
              <Sparkles className="w-5 h-5" /> Crear mi Bar
            </motion.button>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#f5ebe0]">{isOwner ? 'Calendario' : 'Mis Turnos'}</h2>
          <p className="text-[#8b7355] text-sm mt-0.5">{activeBar?.bar_name} · {visibleShifts.length} turnos {viewMode === 'week' ? 'esta semana' : 'este mes'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isOwner ? (
            <div className="flex items-center bg-[#231e19] border border-[#3d3428] rounded-xl p-1">
              <button onClick={()=>setViewMode('week')} className={'px-3 py-1.5 rounded-lg text-sm font-semibold active:scale-95 '+(viewMode==='week'?'bg-[#c4a77d] text-[#1a1612]':'text-[#a89a8a] hover:text-[#f5ebe0]')}>Semana</button>
              <button onClick={()=>setViewMode('month')} className={'px-3 py-1.5 rounded-lg text-sm font-semibold active:scale-95 '+(viewMode==='month'?'bg-[#c4a77d] text-[#1a1612]':'text-[#a89a8a] hover:text-[#f5ebe0]')}>Mes</button>
            </div>
          ) : (
            <span className="px-3 py-2 bg-[#231e19] border border-[#3d3428] text-[#c4a77d] rounded-xl text-sm font-semibold">Semana</span>
          )}
          <button onClick={goToToday} className="px-4 py-2.5 bg-[#3d3428] text-[#c4a77d] rounded-xl text-sm font-semibold hover:bg-[#4d4438] active:scale-95">Hoy</button>
          {isOwner && (
            <motion.button whileTap={{scale:0.92}} onClick={() => openAddModal()} className="flex items-center gap-2 bg-gradient-to-r from-[#c4a77d] to-[#b8956a] text-[#1a1612] font-bold py-2.5 px-4 sm:px-5 rounded-xl shadow-lg active:scale-95">
              <Plus className="w-5 h-5" /> Turno
            </motion.button>
          )}
        </div>
      </div>

      {isOwner && (
        <div className="flex items-start gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
          <span className="text-sm text-[#8b7355] shrink-0 pt-1.5">Filtrar:</span>
          <div className="flex gap-2">
            <button onClick={()=>setSelectedWorkerFilter('all')} className={'shrink-0 px-3 py-1.5 rounded-xl text-sm font-semibold active:scale-95 '+(selectedWorkerFilter==='all'?'bg-[#c4a77d] text-[#1a1612]':'bg-[#231e19] text-[#a89a8a] border border-[#3d3428]')}>Todos</button>
            {workers.map(w=>(
              <button key={w.id} onClick={()=>setSelectedWorkerFilter(w.id)} className={'shrink-0 px-3 py-1.5 rounded-xl text-sm font-semibold active:scale-95 '+(selectedWorkerFilter===w.id?`bg-gradient-to-r ${SHIFT_COLORS[getWorkerColorIdx(w.id)]} text-white`:'bg-[#231e19] text-[#a89a8a] border border-[#3d3428]')}>{w.display_name}</button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between bg-[#231e19] border border-[#3d3428] rounded-xl p-3 sm:p-4">
        <button onClick={prevPeriod} className="p-2.5 hover:bg-[#3d3428] rounded-xl text-[#a89a8a] active:scale-90"><ChevronLeft className="w-6 h-6" /></button>
        <h3 className="text-base sm:text-lg font-bold text-[#f5ebe0] text-center">{viewRange.label}</h3>
        <button onClick={nextPeriod} disabled={!canGoNext} className={'p-2.5 rounded-xl active:scale-90 '+(canGoNext?'hover:bg-[#3d3428] text-[#a89a8a]':'text-[#4d4438] cursor-not-allowed')}><ChevronRight className="w-6 h-6" /></button>
      </div>

      {/* Mobile List View */}
      <div className="space-y-3 md:hidden">
        {mobileShiftGroups.length===0?(
          <div className="text-center py-12 bg-[#231e19] border border-[#3d3428] rounded-2xl"><CalendarDays className="w-12 h-12 text-[#3d3428] mx-auto mb-3" /><p className="text-[#8b7355] font-medium">Sin turnos {viewMode === 'week' ? 'esta semana' : 'este mes'}</p>{isOwner&&<p className="text-[#5c4f42] text-sm mt-1">Usa el boton Turno para anadir</p>}</div>
        ):mobileShiftGroups.map(({date,shifts:ds})=>{
          const {dayName,dayNum,monthName,isToday}=formatDateHeader(date);
          return(
            <motion.div key={date} layout initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className={'rounded-2xl overflow-hidden border '+(isToday?'border-[#c4a77d]/40 bg-[#c4a77d]/5':'border-[#3d3428] bg-[#231e19]')}>
              <div className="px-4 py-3 flex items-center gap-3 border-b border-[#3d3428]/50">
                <div className={'w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 '+(isToday?'bg-[#c4a77d] text-[#1a1612]':'bg-[#3d3428] text-[#c4a77d]')}>
                  <span className="text-[10px] uppercase font-bold leading-none">{dayName.slice(0,3)}</span><span className="text-lg font-bold leading-tight">{dayNum}</span>
                </div>
                <div><p className="font-semibold text-[#f5ebe0]">{dayName}, {dayNum} de {monthName}</p><p className="text-xs text-[#8b7355]">{ds.length} turno{ds.length!==1?'s':''}</p></div>
                {isToday&&<span className="ml-auto px-2 py-0.5 bg-[#c4a77d]/20 text-[#c4a77d] text-xs font-bold rounded-full">HOY</span>}
              </div>
              <div className="divide-y divide-[#3d3428]/30 p-2">
                {ds.length===0?(
                  <p className="px-3 py-4 text-sm text-[#5c4f42]">Sin turnos</p>
                ):ds.map(shift=>{
                  const ci=getWorkerColorIdx(shift.user_id);
                  const { type, notes } = getShiftDisplayInfo(shift);
                  return(
                    <motion.div key={shift.id} whileTap={isOwner?{scale:0.98}:undefined} onClick={isOwner?()=>openEditModal(shift):undefined} className={'flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors '+(isOwner?'active:bg-[#3d3428]/50':'')}>
                      <div className={'w-1.5 h-12 rounded-full bg-gradient-to-b '+SHIFT_COLORS[ci]}></div>
                      <div className={'px-3 py-2 rounded-xl text-sm font-bold shrink-0 bg-gradient-to-r '+SHIFT_COLORS[ci]}>{shift.start_time}-{shift.end_time}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[#f5ebe0] truncate">{isOwner ? getWorkerName(shift.user_id) : type.shortLabel}</p>
                        <p className="text-xs text-[#8b7355] truncate">{isOwner ? type.shortLabel : notes}</p>
                        {isOwner&&notes&&<p className="text-xs text-[#5c4f42] truncate">{notes}</p>}
                      </div>
                      {isOwner&&<svg className="w-4 h-4 text-[#5c4f42] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>}
                    </motion.div>);
                })}
              </div>
            </motion.div>);
        })}
      </div>

      {/* Desktop Grid View */}
      <div className="hidden md:block">
        <div className="bg-[#231e19] border border-[#3d3428] rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-[#3d3428]">{DAYS_ES.map(d=><div key={d} className="py-3 text-center text-sm font-semibold text-[#c4a77d] bg-[#1a1612]/50">{d}</div>)}</div>
          <div className="grid grid-cols-7">{gridDays.map((date,i)=>{
            const ds=getShiftsForDate(date), isT=date&&formatDateKey(date)===today;
            const maxVisible = viewMode === 'week' ? 12 : 4;
            return(<div key={date?formatDateKey(date):`blank-${i}`} className={'p-2 border-b border-r border-[#3d3428]/50 relative '+(viewMode==='week'?'min-h-[360px]':'min-h-[120px]')+' '+(date?(isOwner?'cursor-pointer hover:bg-[#3d3428]/30':''):'')+(isT?' bg-[#c4a77d]/5':'')} onClick={isOwner&&date?()=>openAddModal(date):undefined}>
              {date&&(<><span className={'inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium '+(isT?'bg-[#c4a77d] text-[#1a1612] font-bold':'text-[#a89a8a]')}>{date.getDate()}</span><div className="mt-2 space-y-1">{ds.slice(0,maxVisible).map(shift=>{ const { type } = getShiftDisplayInfo(shift); return <motion.div key={shift.id} layout initial={{opacity:0,scale:0.8}} animate={{opacity:1,scale:1}} onClick={(e)=>{e.stopPropagation();openEditModal(shift);}} className={'px-1.5 py-0.5 rounded text-xs font-medium text-white truncate bg-gradient-to-r cursor-pointer hover:opacity-90 '+SHIFT_COLORS[getWorkerColorIdx(shift.user_id)]}><span className="truncate">{type.shortLabel} {shift.start_time}-{shift.end_time}</span></motion.div>; })}{ds.length>maxVisible&&<span className="text-[10px] text-[#c4a77d] pl-1">+{ds.length-maxVisible} mas</span>}</div></>)}</div>);
          })}</div>
        </div>
        {isOwner&&workers.length>0&&(
          <div className="flex flex-wrap items-center gap-3 bg-[#231e19] border border-[#3d3428] rounded-xl p-4 mt-4">
            <span className="text-sm text-[#8b7355] font-medium">Trabajadores:</span>
            {workers.map(w=><div key={w.id} className="flex items-center gap-1.5"><div className={'w-3 h-3 rounded-full bg-gradient-to-r '+SHIFT_COLORS[getWorkerColorIdx(w.id)]}></div><span className="text-sm text-[#a89a8a]">{w.display_name}</span></div>)}
          </div>)}
      </div>

      {/* Modal */}
      <AnimatePresence>{showAddModal&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center" onClick={()=>setShowAddModal(false)}>
          <motion.div initial={{y:'100%',opacity:0}} animate={{y:0,opacity:1}} exit={{y:'100%',opacity:0}} transition={{type:'spring',damping:25,stiffness:300}} className="bg-[#231e19] border-t sm:border border-t-[#3d3428] sm:border-[#3d3428] rounded-t-3xl sm:rounded-2xl p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:p-6 w-full max-w-full sm:max-w-3xl shadow-2xl max-h-[92dvh] sm:max-h-[85vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 mb-5">
              <h3 className="text-lg font-bold text-[#f5ebe0]">{editingShift?'Editar Turno':'Nuevo Turno'}</h3>
              <button onClick={()=>setShowAddModal(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#3d3428] text-[#8b7355] active:scale-90 shrink-0"><X className="w-5 h-5"/></button>
            </div>
            <div className="space-y-4">
              <div className="grid sm:grid-cols-[1.1fr_0.9fr] gap-3">
                <div className="bg-[#1a1612] border border-[#3d3428] rounded-2xl p-4">
                  <label className="block text-xs font-semibold text-[#8b7355] uppercase tracking-wider mb-1">Fecha del turno</label>
                  <p className="text-[#c4a77d] font-bold text-base leading-tight">{selectedDate?.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})}</p>
                  <p className="text-xs text-[#8b7355] mt-1">Semana {selectedFormWeekLabel}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#a89a8a] mb-2">Servicio / turno</label>
                  <select value={formShiftType} onChange={e=>handleShiftTypeChange(e.target.value)} className="w-full px-4 py-3.5 bg-[#1a1612] border border-[#3d3428] rounded-2xl text-[#f5ebe0] outline-none text-base appearance-none">
                    {SHIFT_TYPES.map(type=><option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                </div>
              </div>

              {!editingShift&&(
                <div className="border border-[#3d3428] rounded-2xl p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
                    <p className="text-xs font-bold text-[#8b7355] uppercase tracking-wider">Aplicar este horario a toda la semana</p>
                    <p className="text-xs font-semibold text-[#c4a77d]">{selectedFormWeekLabel}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {selectedFormWeekDays.map(day=>{
                      const key = formatDateKey(day);
                      const checked = formApplyDates.includes(key);
                      return (
                        <button key={key} type="button" onClick={()=>toggleApplyDate(key)} className={'flex items-center gap-2 min-h-12 px-3 rounded-xl border text-left active:scale-[0.98] '+(checked?'bg-[#c4a77d]/15 border-[#c4a77d]/50 text-[#f5ebe0]':'bg-[#1a1612] border-[#3d3428] text-[#8b7355]')}>
                          <span className={'w-4 h-4 rounded border flex items-center justify-center shrink-0 '+(checked?'bg-[#c4a77d] border-[#c4a77d] text-[#1a1612]':'border-[#5c4f42]')}>{checked?'✓':''}</span>
                          <span className="text-xs font-semibold leading-tight">{DAYS_FULL[day.getDay()].slice(0,3)} {day.getDate()} {MONTHS_ES[day.getMonth()].slice(0,3)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!editingShift&&(
                <button type="button" onClick={()=>handleSplitToggle(!formSplit)} className={'w-full flex items-center justify-between gap-3 px-4 py-4 border rounded-2xl text-left active:scale-[0.98] '+(formSplit?'bg-red-950/25 border-red-700/50':'bg-[#1a1612] border-[#3d3428]')}>
                  <span className="flex items-center gap-3 min-w-0">
                    <span className={'w-5 h-5 rounded-md border flex items-center justify-center shrink-0 '+(formSplit?'bg-[#c4a77d] border-[#c4a77d] text-[#1a1612]':'border-[#5c4f42] text-transparent')}>✓</span>
                    <span className="font-bold text-[#f5ebe0] leading-tight">Habilitar turno partido</span>
                  </span>
                  <span className="text-xs text-[#8b7355] shrink-0">2 tramos</span>
                </button>
              )}

              {formSplit&&!editingShift?(
                <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-3 items-end">
                  <div className="border border-[#3d3428] rounded-2xl p-3">
                    <p className="text-xs font-bold text-[#8b7355] uppercase tracking-wider mb-3">1er tramo</p>
                    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
                      <div><label className="block text-xs font-semibold text-[#a89a8a] mb-1.5">Entrada 1</label><input type="time" value={formStart} onChange={e=>setFormStart(e.target.value)} className="w-full px-3 py-3 bg-[#1a1612] border border-[#3d3428] rounded-xl text-[#f5ebe0] outline-none text-base"/></div>
                      <div><label className="block text-xs font-semibold text-[#a89a8a] mb-1.5">Salida 1</label><input type="time" value={formEnd} onChange={e=>setFormEnd(e.target.value)} className="w-full px-3 py-3 bg-[#1a1612] border border-[#3d3428] rounded-xl text-[#f5ebe0] outline-none text-base"/></div>
                    </div>
                  </div>
                  <span className="hidden sm:block text-[#8b7355] font-bold pb-8">y</span>
                  <div className="border border-[#3d3428] rounded-2xl p-3">
                    <p className="text-xs font-bold text-[#8b7355] uppercase tracking-wider mb-3">2o tramo</p>
                    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
                      <div><label className="block text-xs font-semibold text-[#a89a8a] mb-1.5">Entrada 2</label><input type="time" value={formStart2} onChange={e=>setFormStart2(e.target.value)} className="w-full px-3 py-3 bg-[#1a1612] border border-[#3d3428] rounded-xl text-[#f5ebe0] outline-none text-base"/></div>
                      <div><label className="block text-xs font-semibold text-[#a89a8a] mb-1.5">Salida 2</label><input type="time" value={formEnd2} onChange={e=>setFormEnd2(e.target.value)} className="w-full px-3 py-3 bg-[#1a1612] border border-[#3d3428] rounded-xl text-[#f5ebe0] outline-none text-base"/></div>
                    </div>
                  </div>
                </div>
              ):(
                <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                  <div><label className="block text-sm font-semibold text-[#a89a8a] mb-2">Hora de entrada</label><input type="time" value={formStart} onChange={e=>setFormStart(e.target.value)} className="w-full px-4 py-3.5 bg-[#1a1612] border border-[#3d3428] rounded-2xl text-[#f5ebe0] outline-none text-lg"/></div>
                  <div><label className="block text-sm font-semibold text-[#a89a8a] mb-2">Hora de salida</label><input type="time" value={formEnd} onChange={e=>setFormEnd(e.target.value)} className="w-full px-4 py-3.5 bg-[#1a1612] border border-[#3d3428] rounded-2xl text-[#f5ebe0] outline-none text-lg"/></div>
                </div>
              )}

              <div><label className="block text-sm font-semibold text-[#a89a8a] mb-2">Trabajador</label><select value={formWorker} onChange={e=>setFormWorker(e.target.value)} className="w-full px-4 py-3.5 bg-[#1a1612] border border-[#3d3428] rounded-2xl text-[#f5ebe0] outline-none text-base appearance-none"><option value="">Seleccionar...</option>{workers.map(w=><option key={w.id} value={w.id}>{w.display_name}</option>)}</select></div>
              <div><label className="block text-sm font-semibold text-[#a89a8a] mb-2">Notas de servicio</label><input type="text" value={formNotes} onChange={e=>setFormNotes(e.target.value)} placeholder="Ej: Montar terraza exterior..." className="w-full px-4 py-3.5 bg-[#1a1612] border border-[#3d3428] rounded-2xl text-[#f5ebe0] placeholder-[#5c4f42] outline-none text-base"/></div>
              <div className="flex flex-col min-[420px]:flex-row gap-3 pt-3">
                {editingShift&&(<button onClick={()=>handleDelete(editingShift.id)} className="flex-1 min-h-12 flex items-center justify-center gap-2 bg-red-900/25 text-red-400 font-bold py-3.5 px-4 rounded-2xl active:scale-[0.97]"><Trash2 className="w-5 h-5"/> Eliminar</button>)}
                <button onClick={handleSave} disabled={!formStart||!formEnd||(formSplit&&!editingShift&&(!formStart2||!formEnd2))||(isOwner&&!formWorker)||(!editingShift&&formApplyDates.length===0)} className="flex-1 min-h-12 flex items-center justify-center gap-2 bg-gradient-to-r from-[#c4a77d] to-[#b8956a] text-[#1a1612] font-bold py-3.5 px-4 rounded-2xl active:scale-[0.97] disabled:opacity-50 text-base"><Save className="w-5 h-5"/> Guardar</button>
              </div>
            </div>
          </motion.div>
        </motion.div>)}</AnimatePresence>
    </div>
  );
}
