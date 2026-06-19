import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CheckSquare, Square, Plus, Pencil, Trash2, CheckCircle2, Clock, ListChecks, AlertCircle, X, UserRound, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Avatar from '../components/Avatar';

const TASK_PRIORITIES = [
  { value: 'urgent', label: 'Urgente', rank: 4, badge: 'bg-red-900/35 text-red-300 border-red-700/50' },
  { value: 'high', label: 'Alta', rank: 3, badge: 'bg-amber-900/35 text-amber-300 border-amber-700/50' },
  { value: 'medium', label: 'Media', rank: 2, badge: 'bg-blue-900/30 text-blue-300 border-blue-700/40' },
  { value: 'low', label: 'Baja', rank: 1, badge: 'bg-[#3d3428] text-[#a89a8a] border-[#4d4438]' },
];

const PRIORITY_BY_VALUE = Object.fromEntries(TASK_PRIORITIES.map(priority => [priority.value, priority]));
const getTaskPriority = (task) => PRIORITY_BY_VALUE[task?.priority] || PRIORITY_BY_VALUE.medium;

export default function Tasks() {
  const { profile, activeBar } = useAuth();
  const isOwner = activeBar?.is_owner;
  const barId = activeBar?.bar_id;
  
  const [tasks, setTasks] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskAssignee, setTaskAssignee] = useState('general');
  const [taskView, setTaskView] = useState('all');
  const [expandedTask, setExpandedTask] = useState(null);
  const [error, setError] = useState('');
  const [completingId, setCompletingId] = useState(null);

  const fetchData = useCallback(async () => {
    if (!barId) return;
    try {
      setLoading(true); setError('');
      const taskParams = new URLSearchParams({ bar_id: barId });
      const completionParams = new URLSearchParams();
      if (profile?.id) taskParams.set('user_id', profile.id);
      if (isOwner) {
        taskParams.set('is_owner', 'true');
        completionParams.set('is_owner', 'true');
      } else if (profile?.id) {
        completionParams.set('user_id', profile.id);
      }
      const [tasksRes, compRes, memRes] = await Promise.all([
        fetch(`/api/tasks?${taskParams}`),
        fetch(`/api/task-completions?${completionParams}`),
        fetch(`/api/bar-members?bar_id=${barId}`),
      ]);
      if (tasksRes.ok) setTasks(await tasksRes.json());
      if (compRes.ok) setCompletions(await compRes.json());
      if (memRes.ok) {
        const memData = await memRes.json();
        setMembers(memData.map(m => ({ id: m.user_id, name: m.users?.display_name || m.users?.email || '?', email: m.users?.email || '', avatar_url: m.users?.avatar_url || '', role: m.role })));
      }
    } catch (err) { console.error(err); setError('Error de conexion'); }
    finally { setLoading(false); }
  }, [barId, profile?.id, isOwner]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getCompletionsForTask = (tid) => completions.filter(c => c.task_id === tid);
  const isCompletedByMe = (tid) => completions.some(c => c.task_id === tid && c.user_id === profile?.id);
  const getUserName = (uid) => {
    if (uid === profile?.id) return profile?.display_name || 'Tu';
    return members.find(m => m.id === uid)?.name || '?';
  };
  const getUserAvatar = (uid) => {
    if (uid === profile?.id) return profile?.avatar_url;
    return members.find(m => m.id === uid)?.avatar_url || '';
  };

  const handleToggleComplete = async (taskId) => {
    if (!profile?.id) { setError('Cargando perfil...'); return; }
    try {
      setCompletingId(taskId); setError('');
      if (isCompletedByMe(taskId)) {
        const c = completions.find(c => c.task_id === taskId && c.user_id === profile.id);
        if (c) await fetch('/api/task-completions',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:c.id,user_id:profile.id})});
      } else {
        await fetch('/api/task-completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task_id:taskId,user_id:profile.id})});
      }
      fetchData();
    } catch (err) { setError(err.message||'Error'); }
    finally { setCompletingId(null); }
  };

  const openCreate = () => { if (!isOwner) return; setEditingTask(null); setTaskTitle(''); setTaskDesc(''); setTaskPriority('medium'); setTaskAssignee('general'); setShowTaskModal(true); };
  const openEdit = (task) => { if (!isOwner) return; setEditingTask(task); setTaskTitle(task.title || ''); setTaskDesc(task.description || ''); setTaskPriority(getTaskPriority(task).value); setTaskAssignee(task.assigned_to || 'general'); setShowTaskModal(true); };

  const handleSaveTask = async () => {
    if (!taskTitle.trim()||!barId) return;
    if (!isOwner) { setError('Solo el jefe puede editar tareas'); return; }
    try {
      setError('');
      if (editingTask) {
        const payload = { id: editingTask.id, title: taskTitle.trim(), description: taskDesc.trim(), priority: taskPriority, assigned_to: taskAssignee === 'general' ? '' : taskAssignee, is_owner: true };
        const res = await fetch('/api/tasks',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        if (!res.ok) throw new Error('Error guardando cambios');
      } else {
        const res = await fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bar_id:barId,title:taskTitle.trim(),description:taskDesc.trim(),priority:taskPriority,assigned_to:taskAssignee==='general'?'':taskAssignee,created_by:profile?.id,is_owner:true})});
        if (!res.ok) throw new Error('Error creando tarea');
      }
      setTaskTitle(''); setTaskDesc(''); setEditingTask(null); setShowTaskModal(false); fetchData();
    } catch (err) { setError(err.message); }
  };

  const handleDeleteTask = async (taskId) => {
    if (!isOwner) { setError('Solo el jefe puede eliminar tareas'); return; }
    if (!confirm('Eliminar esta tarea?')) return;
    try { setError(''); await fetch('/api/tasks',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:taskId,is_owner:true})}); fetchData(); }
    catch (err) { setError('Error eliminando'); }
  };

  const activeTasks = tasks
    .filter(t => t.is_active !== false)
    .filter(t => {
      if (taskView === 'general') return !t.assigned_to;
      if (taskView === 'individual') return !!t.assigned_to;
      if (taskView === 'mine') return t.assigned_to === profile?.id;
      return true;
    })
    .sort((a, b) => {
      const priorityDiff = getTaskPriority(b).rank - getTaskPriority(a).rank;
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  const completedCount = activeTasks.filter(t => isCompletedByMe(t.id)).length;
  const individualCount = tasks.filter(t => t.is_active !== false && t.assigned_to).length;
  const generalCount = tasks.filter(t => t.is_active !== false && !t.assigned_to).length;

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-10 h-10 border-4 border-[#c4a77d] border-t-transparent rounded-full animate-spin"></div></div>;
  if (!barId) {
    const { user: authUser } = useAuth();
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-20 h-20 bg-gradient-to-br from-[#c4a77d]/20 to-[#8b7355]/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <ListChecks className="w-10 h-10 text-[#c4a77d]" />
        </div>
        <h2 className="text-2xl font-bold text-[#f5ebe0] mb-2">Sin bar asignado</h2>
        <p className="text-[#8b7355] max-w-sm mx-auto">Necesitas pertenecer a un bar para ver las tareas. Ve a Turnos para crear o unirte a un bar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#f5ebe0]">Tareas</h2>
          <p className="text-[#8b7355] text-sm mt-0.5">{activeBar?.bar_name} · Checklist del bar</p>
        </div>
        {!isOwner && activeTasks.length > 0 && (
          <div className="flex items-center gap-3 bg-[#231e19] border border-[#3d3428] rounded-2xl px-4 py-3">
            <ListChecks className="w-5 h-5 text-[#c4a77d] shrink-0"/>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex-1 h-2.5 bg-[#1a1612] rounded-full overflow-hidden">
                <motion.div initial={false} className="h-full bg-gradient-to-r from-[#c4a77d] to-[#8b7355] rounded-full" animate={{width:`${activeTasks.length>0?(completedCount/activeTasks.length)*100:0}%`}} transition={{type:'spring',stiffness:100}}/>
              </div>
              <span className="text-sm font-bold text-[#c4a77d] shrink-0">{completedCount}/{activeTasks.length}</span>
            </div>
          </div>
        )}
        {isOwner && (
          <button onClick={openCreate} className="self-start flex items-center gap-2 bg-gradient-to-r from-[#c4a77d] to-[#b8956a] text-[#1a1612] font-bold py-3 px-5 rounded-xl shadow-lg active:scale-95">
            <Plus className="w-5 h-5"/> Nueva Tarea
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {isOwner ? (
          <>
            <button onClick={()=>setTaskView('all')} className={'shrink-0 px-3 py-2 rounded-xl text-sm font-bold active:scale-95 '+(taskView==='all'?'bg-[#c4a77d] text-[#1a1612]':'bg-[#231e19] border border-[#3d3428] text-[#a89a8a]')}>Todas</button>
            <button onClick={()=>setTaskView('general')} className={'shrink-0 px-3 py-2 rounded-xl text-sm font-bold active:scale-95 '+(taskView==='general'?'bg-[#c4a77d] text-[#1a1612]':'bg-[#231e19] border border-[#3d3428] text-[#a89a8a]')}>Generales ({generalCount})</button>
            <button onClick={()=>setTaskView('individual')} className={'shrink-0 px-3 py-2 rounded-xl text-sm font-bold active:scale-95 '+(taskView==='individual'?'bg-[#c4a77d] text-[#1a1612]':'bg-[#231e19] border border-[#3d3428] text-[#a89a8a]')}>Individuales ({individualCount})</button>
          </>
        ) : (
          <>
            <button onClick={()=>setTaskView('all')} className={'shrink-0 px-3 py-2 rounded-xl text-sm font-bold active:scale-95 '+(taskView==='all'?'bg-[#c4a77d] text-[#1a1612]':'bg-[#231e19] border border-[#3d3428] text-[#a89a8a]')}>Todas</button>
            <button onClick={()=>setTaskView('general')} className={'shrink-0 px-3 py-2 rounded-xl text-sm font-bold active:scale-95 '+(taskView==='general'?'bg-[#c4a77d] text-[#1a1612]':'bg-[#231e19] border border-[#3d3428] text-[#a89a8a]')}>Generales</button>
            <button onClick={()=>setTaskView('mine')} className={'shrink-0 px-3 py-2 rounded-xl text-sm font-bold active:scale-95 '+(taskView==='mine'?'bg-[#c4a77d] text-[#1a1612]':'bg-[#231e19] border border-[#3d3428] text-[#a89a8a]')}>Para mi</button>
          </>
        )}
      </div>

      <AnimatePresence>{error&&(
        <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} className="flex items-center gap-3 bg-red-900/20 border border-red-800/50 text-red-300 px-4 py-3 rounded-xl">
          <AlertCircle className="w-5 h-5 shrink-0"/><p className="text-sm flex-1">{error}</p><button onClick={()=>setError('')} className="p-1 text-red-400 font-bold text-lg leading-none">&times;</button>
        </motion.div>
      )}</AnimatePresence>

      <div className="space-y-3">
        {activeTasks.length===0?(
          <div className="text-center py-16 bg-[#231e19] border border-[#3d3428] rounded-2xl">
            <CheckSquare className="w-14 h-14 text-[#3d3428] mx-auto mb-4"/>
            <p className="text-[#8b7355] text-lg font-semibold">Sin tareas</p>
            <p className="text-[#5c4f42] text-sm mt-1">{isOwner?'Toca para crear una':'El jefe anadira tareas'}</p>
          </div>
        ):activeTasks.map((task,idx)=>{
          const taskComps = getCompletionsForTask(task.id);
          const doneByMe = isCompletedByMe(task.id);
          const isExp = expandedTask===task.id;
          const isLoading = completingId===task.id;
          const priority = getTaskPriority(task);
          const isIndividual = Boolean(task.assigned_to);
          const expectedCompletions = isIndividual ? 1 : members.length;
          const isUrgent = priority.value === 'urgent';
          return(
            <motion.div key={task.id} layout initial={{opacity:0,y:15}} animate={{opacity:1,y:0}} transition={{delay:idx*0.05}} className={'relative rounded-2xl overflow-hidden border transition-all '+(doneByMe?'border-emerald-700/40 bg-emerald-900/10':isUrgent?'border-red-700/60 bg-red-950/20 shadow-[0_0_0_1px_rgba(248,113,113,0.12),0_18px_45px_rgba(127,29,29,0.18)]':'border-[#3d3428] bg-[#231e19]')}>
              <div className="p-4 sm:p-5 cursor-pointer" onClick={()=>setExpandedTask(isExp?null:task.id)}>
                <div className="flex items-start gap-3 sm:gap-4">
                  <button onClick={e=>{e.stopPropagation();handleToggleComplete(task.id);}} disabled={isLoading} className={'mt-0.5 w-12 h-12 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all active:scale-90 '+(doneByMe?'bg-emerald-500/20 text-emerald-400':'bg-[#3d3428] text-[#5c4f42] active:bg-[#c4a77d]/20 active:text-[#c4a77d]')+(isLoading?' opacity-60':'')}>
                    {isLoading?<div className="w-6 h-6 border-2.5 border-current border-t-transparent rounded-full animate-spin"></div>:doneByMe?<CheckCircle2 className="w-6 h-6" strokeWidth={2.5}/>:<Square className="w-6 h-6" strokeWidth={2}/>}
                  </button>
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className={'font-bold text-base sm:text-base pr-2 '+(doneByMe?'text-emerald-300 line-through decoration-emerald-500/50':'text-[#f5ebe0]')}>{task.title}</h3>
                        {task.description&&<p className={'text-sm mt-1 line-clamp-2 '+(doneByMe?'text-emerald-500/60':'text-[#8b7355]')}>{task.description}</p>}
                        <div className="sm:hidden flex flex-wrap gap-2 mt-2">
                          <span className={'inline-flex items-center px-2 py-1 border rounded-lg text-xs font-bold '+priority.badge}>{priority.label}</span>
                          <span className="inline-flex items-center gap-1 px-2 py-1 border border-[#3d3428] rounded-lg text-xs font-bold text-[#a89a8a] bg-[#1a1612]">
                            {isIndividual ? <UserRound className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                            {isIndividual ? getUserName(task.assigned_to) : 'General'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 pt-0.5">
                        {isIndividual&&(
                          <Avatar name={getUserName(task.assigned_to)} src={getUserAvatar(task.assigned_to)} size="sm" className="hidden sm:flex" />
                        )}
                        <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 border border-[#3d3428] rounded-lg text-xs font-bold text-[#a89a8a] bg-[#1a1612]">
                          {isIndividual ? <UserRound className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                          {isIndividual ? getUserName(task.assigned_to) : 'General'}
                        </span>
                        <span className={'hidden sm:inline-flex items-center px-2 py-1 border rounded-lg text-xs font-bold '+priority.badge}>
                          {priority.label}
                        </span>
                        {isOwner&&taskComps.length>0&&(
                          <span className="flex items-center gap-1 px-2 py-1 bg-emerald-900/30 text-emerald-400 text-xs font-bold rounded-lg">
                            <CheckCircle2 className="w-3.5 h-3.5"/>{taskComps.length}{expectedCompletions>1?`/${expectedCompletions}`:''}
                          </span>
                        )}
                        {isOwner&&(
                          <button onClick={e=>{e.stopPropagation();openEdit(task);}} className="p-2 text-[#5c4f42] hover:text-[#c4a77d] hover:bg-[#c4a77d]/10 rounded-xl active:scale-90" title="Editar tarea">
                            <Pencil className="w-4 h-4"/>
                          </button>
                        )}
                        {isOwner&&(
                          <button onClick={e=>{e.stopPropagation();handleDeleteTask(task.id);}} className="p-2 text-[#5c4f42] hover:text-red-400 hover:bg-red-900/20 rounded-xl active:scale-90">
                            <Trash2 className="w-4.5 h-4.5"/>
                          </button>
                        )}
                        <svg className={'w-5 h-5 text-[#5c4f42] transition-transform duration-200 '+(isExp?'rotate-180':'')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <AnimatePresence>{isExp&&(
                <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.2}} className="overflow-hidden">
                  <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 space-y-2">
                    <div className="border-t border-[#3d3428]/50 pt-3">
                      <span className={'sm:hidden inline-flex items-center px-2.5 py-1 border rounded-lg text-xs font-bold mb-3 '+priority.badge}>
                        Urgencia {priority.label.toLowerCase()}
                      </span>
                      {task.description&&(
                        <p className="text-sm text-[#a89a8a] leading-relaxed px-1 pb-2">{task.description}</p>
                      )}
                      {isOwner&&taskComps.length>0?(
                        <>
                          <p className="text-xs font-bold text-[#8b7355] uppercase tracking-wider mb-2.5 px-1">
                            Completado por {taskComps.length} de {expectedCompletions}:
                          </p>
                          {taskComps.map(c=>(
                            <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#3d3428]/30 transition-colors">
                              <Avatar name={getUserName(c.user_id)} src={getUserAvatar(c.user_id)} size="sm" />
                              <span className="font-medium text-[#a89a8a] text-sm">{getUserName(c.user_id)}</span>
                              <span className="text-[#5c4f42] text-xs ml-auto flex items-center gap-1 shrink-0">
                                <Clock className="w-3.5 h-3.5"/>{new Date(c.completed_at).toLocaleString('es-ES',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                              </span>
                            </div>
                          ))}
                        </>
                      ):isOwner?<p className="text-sm text-[#5c4f42] italic px-1 py-2">Nadie ha completado esta tarea aun</p>:null}
                    </div>
                  </div>
                </motion.div>)}</AnimatePresence>
            </motion.div>);
        })}
      </div>

      {/* Task Modal — owner create/edit */}
      <AnimatePresence>{showTaskModal&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center" onClick={()=>setShowTaskModal(false)}>
          <motion.div initial={{y:'100%',opacity:0}} animate={{y:0,opacity:1}} exit={{y:'100%',opacity:0}} transition={{type:'spring',damping:25,stiffness:300}} className="bg-[#231e19] border-t sm:border border-t-[#3d3428] sm:border-[#3d3428] rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-[#f5ebe0]">{editingTask?'Editar Tarea':'Nueva Tarea'}</h3>
              <button onClick={()=>setShowTaskModal(false)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#3d3428] text-[#8b7355] active:scale-90"><X className="w-5 h-5"/></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-sm font-semibold text-[#a89a8a] mb-2">Titulo *</label><input type="text" value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} placeholder="Ej: Limpiar la barra..." autoFocus className="w-full px-4 py-3.5 bg-[#1a1612] border border-[#3d3428] rounded-2xl text-[#f5ebe0] placeholder-[#5c4f42] focus:border-[#c4a77d] outline-none text-base"/></div>
              <div><label className="block text-sm font-semibold text-[#a89a8a] mb-2">Descripcion</label><textarea value={taskDesc} onChange={e=>setTaskDesc(e.target.value)} placeholder="Instrucciones..." rows={3} className="w-full px-4 py-3.5 bg-[#1a1612] border border-[#3d3428] rounded-2xl text-[#f5ebe0] placeholder-[#5c4f42] focus:border-[#c4a77d] outline-none resize-none text-base"/></div>
              {isOwner&&(
                <div>
                  <label className="block text-sm font-semibold text-[#a89a8a] mb-2">Urgencia</label>
                  <select value={taskPriority} onChange={e=>setTaskPriority(e.target.value)} className="w-full px-4 py-3.5 bg-[#1a1612] border border-[#3d3428] rounded-2xl text-[#f5ebe0] focus:border-[#c4a77d] outline-none text-base">
                    {TASK_PRIORITIES.map(priority => <option key={priority.value} value={priority.value}>{priority.label}</option>)}
                  </select>
                </div>
              )}
              {isOwner&&(
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-[#a89a8a]">Tipo de tarea</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={()=>setTaskAssignee('general')} className={'flex items-center justify-center gap-2 px-3 py-3 rounded-2xl text-sm font-bold active:scale-95 '+(taskAssignee==='general'?'bg-[#c4a77d] text-[#1a1612]':'bg-[#1a1612] border border-[#3d3428] text-[#a89a8a]')}>
                      <Users className="w-4 h-4" /> General
                    </button>
                    <button type="button" onClick={()=>setTaskAssignee(members.find(m=>m.id!==profile?.id)?.id || members[0]?.id || 'general')} className={'flex items-center justify-center gap-2 px-3 py-3 rounded-2xl text-sm font-bold active:scale-95 '+(taskAssignee!=='general'?'bg-[#c4a77d] text-[#1a1612]':'bg-[#1a1612] border border-[#3d3428] text-[#a89a8a]')}>
                      <UserRound className="w-4 h-4" /> Individual
                    </button>
                  </div>
                  {taskAssignee!=='general'&&(
                    <div>
                      <label className="block text-sm font-semibold text-[#a89a8a] mb-2">Empleado</label>
                      <select value={taskAssignee} onChange={e=>setTaskAssignee(e.target.value)} className="w-full px-4 py-3.5 bg-[#1a1612] border border-[#3d3428] rounded-2xl text-[#f5ebe0] focus:border-[#c4a77d] outline-none text-base">
                        {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}
              <button onClick={handleSaveTask} disabled={!taskTitle.trim() || (isOwner && taskAssignee!=='general' && !taskAssignee)} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#c4a77d] to-[#b8956a] text-[#1a1612] font-bold py-3.5 px-4 rounded-2xl active:scale-[0.97] disabled:opacity-50 text-base">{editingTask?<><Pencil className="w-5 h-5"/> Guardar Cambios</>:<><Plus className="w-5 h-5"/> Crear Tarea</>}</button>
            </div>
          </motion.div>
        </motion.div>)}</AnimatePresence>
    </div>
  );
}
