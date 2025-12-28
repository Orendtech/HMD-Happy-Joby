
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { User } from 'firebase/auth';
import { GlassCard } from '../components/GlassCard';
import { 
    getWorkPlans, 
    saveWorkPlan, 
    deleteWorkPlan, 
    addHospital, 
    getUserProfile, 
    getUserHistory,
    getAllUsers,
    getTeamMembers,
    updateWorkPlanStatus,
    submitPlansForApproval
} from '../services/dbService';
import { WorkPlan, UserProfile, AttendanceDay, AdminUser } from '../types';
import { 
    Plus, Trash2, Calendar, MapPin, 
    X, Loader2, MessageSquare, User as UserIcon, 
    ChevronRight, Info, Save, Clock, ChevronLeft, Building, Search, Download, Users, ChevronDown,
    CheckCircle, XCircle, AlertTriangle, RotateCcw, ShieldCheck, ListChecks, CalendarDays, Send,
    Edit, MoreVertical
} from 'lucide-react';

interface Props {
    user: User;
    userProfile: UserProfile | null;
}

const WorkPlanner: React.FC<Props> = ({ user, userProfile }) => {
    const [activeTab, setActiveTab] = useState<'calendar' | 'approvals'>('calendar');
    
    // Define helper roles for the UI
    const isAdmin = userProfile?.role === 'admin';
    const isManager = userProfile?.role === 'manager';

    const formatLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [plans, setPlans] = useState<WorkPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    // Add missing state for export options toggle
    const [showExportOptions, setShowExportOptions] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(formatLocalDate(new Date()));
    
    const [isPrivileged, setIsPrivileged] = useState(false);
    const [teamMembers, setTeamMembers] = useState<AdminUser[]>([]);
    const [targetUserId, setTargetUserId] = useState<string>(user.uid);
    const [targetUserName, setTargetUserName] = useState<string>(userProfile?.name || user.email?.split('@')[0] || 'Unknown');

    const [localProfile, setLocalProfile] = useState<UserProfile | null>(userProfile);

    // Form State
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [itinerary, setItinerary] = useState<{location: string, objective: string}[]>([]);
    const [newLoc, setNewLoc] = useState('');
    const [newObj, setNewObj] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

    // Menu State
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    const [showLocSuggestions, setShowLocSuggestions] = useState(false);
    const suggestionsRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const refreshProfile = async () => {
        const p = await getUserProfile(targetUserId);
        setLocalProfile(p);
    };

    const fetchData = async (uid: string) => {
        setLoading(true);
        try {
            const planData = await getWorkPlans(uid);
            setPlans(planData);
        } catch (error) { console.error("Failed to fetch data", error); }
        setLoading(false);
    };

    const [allPendingPlans, setAllPendingPlans] = useState<WorkPlan[]>([]);
    const fetchGlobalPending = async () => {
        if (!isPrivileged) return;
        setLoading(true);
        try {
            const allPlans = await getWorkPlans();
            const pendingOnly = allPlans.filter(p => p.status === 'pending');
            
            if (isAdmin) {
                setAllPendingPlans(pendingOnly);
            } else if (isManager) {
                const teamIds = teamMembers.map(m => m.id);
                setAllPendingPlans(pendingOnly.filter(p => teamIds.includes(p.userId)));
            }
        } catch (e) { 
            console.error("Fetch pending failed", e); 
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const init = async () => {
            const hasAccess = userProfile?.role === 'admin' || userProfile?.role === 'manager';
            setIsPrivileged(hasAccess);
            if (hasAccess) {
                let members: AdminUser[] = [];
                if (userProfile?.role === 'admin') { 
                    members = await getAllUsers(); 
                } else { 
                    members = await getTeamMembers(user.uid); 
                }
                const filteredMembers = members.filter(u => u.isApproved !== false || u.id === user.uid);
                setTeamMembers(filteredMembers);
            }
            await fetchData(targetUserId);
        };
        init();
        
        const handleClickOutside = (e: MouseEvent) => { 
            if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) { 
                setShowLocSuggestions(false); 
            } 
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [user, userProfile]);

    useEffect(() => { if (activeTab === 'approvals' && isPrivileged) { fetchGlobalPending(); } }, [activeTab]);

    const handleUserChange = async (newUserId: string) => {
        setTargetUserId(newUserId);
        const selected = teamMembers.find(u => u.id === newUserId);
        const selectedName = newUserId === user.uid ? (userProfile?.name || user.email?.split('@')[0]) : (selected?.name || selected?.email || 'Unknown');
        setTargetUserName(selectedName || 'Unknown');
        const p = await getUserProfile(newUserId);
        setLocalProfile(p);
        await fetchData(newUserId);
    };

    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
    const daysInMonth = getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
    const firstDay = getFirstDayOfMonth(currentMonth.getFullYear(), currentMonth.getMonth());
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const blanks = Array.from({ length: firstDay }, (_, i) => i);

    const changeMonth = (offset: number) => { setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1)); };

    const getPlanForDay = (day: number) => {
        const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const dStr = formatLocalDate(d);
        return plans.find(p => p.date === dStr);
    };

    const selectedDayPlans = plans.filter(p => p.date === selectedDate);
    const userDrafts = useMemo(() => plans.filter(p => p.status === 'draft' || p.status === 'rejected'), [plans]);

    const handleAddLocation = () => { if (!newLoc) return; setItinerary([...itinerary, { location: newLoc, objective: newObj }]); setNewLoc(''); setNewObj(''); setShowLocSuggestions(false); };
    const handleAddNewHospital = async () => { if (!newLoc.trim()) return; try { await addHospital(targetUserId, newLoc.trim()); await refreshProfile(); setShowLocSuggestions(false); } catch (e) { console.error("Failed to add hospital", e); } };

    const handleSavePlan = async () => {
        if (!title || !content) {
            alert("กรุณากรอกหัวข้อและรายละเอียดแผนงาน");
            return;
        }
        
        let finalItinerary = [...itinerary];
        if (newLoc.trim() && itinerary.length === 0) {
            if (window.confirm(`ต้องการเพิ่มสถานที่ "${newLoc}" ลงในแผนงานหรือไม่?`)) {
                finalItinerary = [{ location: newLoc.trim(), objective: newObj.trim() }];
            }
        }

        setIsSaving(true);
        try {
            await saveWorkPlan({
                id: editingPlanId || undefined,
                userId: targetUserId,
                userName: targetUserName,
                date: selectedDate,
                title,
                content,
                itinerary: finalItinerary,
            });
            resetForm();
            await fetchData(targetUserId);
            alert(editingPlanId ? "แก้ไขแผนงานเรียบร้อยแล้ว" : "บันทึกฉบับร่างเรียบร้อยแล้ว");
        } catch (error) {
            console.error("Save Plan Error:", error);
            alert("เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่อีกครั้ง");
        } finally {
            setIsSaving(false);
        }
    };

    const handleStatusChange = async (planId: string, status: 'approved' | 'rejected' | 'pending' | 'draft') => {
        try {
            await updateWorkPlanStatus(planId, status);
            if (activeTab === 'approvals' && isPrivileged) { 
                fetchGlobalPending(); 
            } else { 
                await fetchData(targetUserId); 
            }
        } catch (e) { 
            console.error("Update status failed", e); 
            alert("ไม่สามารถอัปเดตสถานะได้"); 
        }
    };

    const handleSendForApproval = async (planId: string) => {
        if (!window.confirm("ยืนยันการส่งแผนงานเพื่อขออนุมัติ?")) return;
        setLoading(true);
        try {
            await updateWorkPlanStatus(planId, 'pending');
            await fetchData(user.uid);
            alert("ส่งแผนงานเรียบร้อยแล้ว");
        } catch (e) { alert("เกิดข้อผิดพลาด"); }
        setLoading(false);
    };

    const handleSubmitAllDrafts = async () => {
        const draftIds = userDrafts.map(d => d.id);
        if (draftIds.length === 0) return;
        if (!window.confirm(`ต้องการส่งขออนุมัติแผนงานทั้ง ${draftIds.length} รายการที่เลือกไว้หรือไม่?`)) return;
        setLoading(true);
        try {
            await submitPlansForApproval(draftIds);
            await fetchData(user.uid);
            alert("ส่งแผนงานเรียบร้อยแล้ว หัวหน้าจะได้รับแจ้งเตือนเร็วๆ นี้");
        } catch (e) { alert("เกิดข้อผิดพลาดในการส่งแผนงาน"); }
        setLoading(false);
    };

    const handleEditPlan = (plan: WorkPlan) => {
        setEditingPlanId(plan.id);
        setTitle(plan.title);
        setContent(plan.content);
        setItinerary(plan.itinerary || []);
        setShowForm(true);
        setOpenMenuId(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resetForm = () => { 
        setTitle(''); 
        setContent(''); 
        setItinerary([]); 
        setNewLoc('');
        setNewObj('');
        setEditingPlanId(null);
        setShowForm(false); 
    };

    const handleDelete = async (id: string) => { 
        if (!window.confirm("ต้องการลบแผนงานนี้ใช่หรือไม่?")) return; 
        try {
            await deleteWorkPlan(id); 
            if (activeTab === 'approvals' && isPrivileged) {
                fetchGlobalPending();
            } else {
                await fetchData(targetUserId);
            }
            setOpenMenuId(null);
        } catch (e) { alert("ไม่สามารถลบข้อมูลได้"); }
    };

    const getStatusUI = (status?: string) => {
        switch(status) {
            case 'approved': return { label: 'อนุมัติแล้ว', color: 'bg-emerald-500 text-white', dot: 'bg-emerald-500', icon: <CheckCircle size={10}/> };
            case 'rejected': return { label: 'ต้องแก้ไข', color: 'bg-rose-500 text-white', dot: 'bg-rose-500', icon: <XCircle size={10}/> };
            case 'pending': return { label: 'รออนุมัติ', color: 'bg-amber-400 text-white', dot: 'bg-amber-400', icon: <Clock size={10}/> };
            default: return { label: 'ฉบับร่าง', color: 'bg-slate-400 text-white', dot: 'bg-slate-400', icon: <Edit size={10}/> };
        }
    };

    const filteredHospitals = newLoc === '' ? (localProfile?.hospitals || []) : (localProfile?.hospitals.filter(h => h.toLowerCase().includes(newLoc.toLowerCase())) || []);

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-enter pb-32 px-4 pt-6">
            <div className="bg-slate-200 dark:bg-slate-900/50 p-1.5 rounded-[24px] flex gap-1 border border-slate-200 dark:border-white/5 shadow-inner">
                <button onClick={() => setActiveTab('calendar')} className={`flex-1 py-3 rounded-[18px] text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'calendar' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xl' : 'text-slate-500'}`}><CalendarDays size={16} /> แผนงาน</button>
                <button onClick={() => setActiveTab('approvals')} className={`flex-1 py-3 rounded-[18px] text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'approvals' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xl' : 'text-slate-500'}`}><ListChecks size={16} /> การอนุมัติ {((isPrivileged && allPendingPlans.length > 0) || (!isPrivileged && userDrafts.length > 0)) && (<span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.5 rounded-full min-w-[16px] animate-pulse">{isPrivileged ? allPendingPlans.length : userDrafts.length}</span>)}</button>
            </div>

            {activeTab === 'calendar' && (
                <>
                    <div className="flex justify-between items-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-md p-6 rounded-[32px] border border-slate-200 dark:border-white/5 shadow-sm">
                        <div><h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">ปฏิทินแผนงาน</h2><p className="text-slate-500 text-sm font-medium mt-2">จัดตารางของ {targetUserId === user.uid ? 'คุณ' : targetUserName}</p></div>
                        <div className="flex gap-2">
                            {/* Fixed: Added missing state showExportOptions and setShowExportOptions */}
                            <button onClick={() => setShowExportOptions(!showExportOptions)} className={`p-4 rounded-2xl shadow-lg transition-all active:scale-95 ${showExportOptions ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-white/5'}`}><Download size={24} /></button>
                            <button onClick={() => { if(showForm) resetForm(); else setShowForm(true); }} className={`p-4 rounded-2xl shadow-lg transition-all active:scale-95 ${showForm ? 'bg-rose-500 text-white shadow-rose-500/20' : 'bg-indigo-600 text-white shadow-indigo-600/20'}`}>{showForm ? <X size={24} /> : <Plus size={24} />}</button>
                        </div>
                    </div>

                    {isPrivileged && (
                        <div className="bg-white/50 dark:bg-slate-900/40 p-1 rounded-[24px] border border-slate-200 dark:border-white/10 flex items-center shadow-sm">
                            <div className="p-3 bg-indigo-500 text-white rounded-[20px] shadow-lg shrink-0"><Users size={20} /></div>
                            <select value={targetUserId} onChange={(e) => handleUserChange(e.target.value)} className="flex-1 bg-transparent px-4 py-2 text-sm font-bold text-slate-900 dark:text-white outline-none appearance-none">
                                <option value={user.uid}>มุมมองส่วนตัว (ฉัน)</option>
                                {teamMembers.filter(u => u.id !== user.uid).map(m => (<option key={m.id} value={m.id}>{m.name || m.email}</option>))}
                            </select>
                            <div className="pr-4 text-slate-400"><ChevronDown size={16} /></div>
                        </div>
                    )}

                    <GlassCard className="p-6 overflow-visible shadow-2xl">
                        <div className="flex items-center justify-between mb-8 px-2">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                                {currentMonth.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
                            </h3>
                            <div className="flex gap-1.5">
                                <button onClick={() => changeMonth(-1)} className="p-2.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors"><ChevronLeft size={22}/></button>
                                <button onClick={() => changeMonth(1)} className="p-2.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors"><ChevronRight size={22}/></button>
                            </div>
                        </div>

                        <div className="grid grid-cols-7 gap-1 mb-4">
                            {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(d => (
                                <div key={d} className="text-center text-xs font-black text-slate-600 dark:text-slate-300 uppercase py-2 tracking-widest opacity-90">{d}</div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                            {blanks.map(b => <div key={`b-${b}`} className="aspect-square flex items-center justify-center opacity-0"></div>)}
                            {days.map(d => {
                                const dateObj = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
                                const dateStr = formatLocalDate(dateObj); 
                                const isSelected = selectedDate === dateStr;
                                const isToday = formatLocalDate(new Date()) === dateStr;
                                const plan = getPlanForDay(d);
                                const statusUI = plan ? getStatusUI(plan.status) : null;

                                return (
                                    <button 
                                        key={d} 
                                        onClick={() => setSelectedDate(dateStr)} 
                                        className={`aspect-square flex flex-col items-center justify-center rounded-2xl relative transition-all duration-300 transform active:scale-90 ${
                                            isSelected 
                                            ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/30 scale-105 z-10 ring-4 ring-indigo-500/10' 
                                            : isToday 
                                                ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-black border border-indigo-200 dark:border-indigo-500/30' 
                                                : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 font-medium'
                                        }`}
                                    >
                                        <span className="text-sm font-bold">{d}</span>
                                        {statusUI && <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${isSelected ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]' : statusUI.dot}`}></div>}
                                    </button>
                                );
                            })}
                        </div>
                        
                        <div className="mt-8 flex flex-wrap gap-4 justify-center border-t border-slate-100 dark:border-white/5 pt-6">
                            <div className="flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase tracking-widest"><div className="w-2.5 h-2.5 rounded-full bg-slate-400"></div> ฉบับร่าง</div>
                            <div className="flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase tracking-widest"><div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div> รออนุมัติ</div>
                            <div className="flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase tracking-widest"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div> อนุมัติแล้ว</div>
                        </div>
                    </GlassCard>

                    {showForm && (
                        <div className="animate-enter">
                            <GlassCard className="p-8 space-y-6 border-indigo-500/30 bg-white/90 dark:bg-slate-900/90 shadow-2xl overflow-visible backdrop-blur-2xl">
                                <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/5 pb-4">
                                    <div className="p-3 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-2xl"><Calendar size={24} /></div>
                                    <div><h3 className="text-xl font-black text-slate-900 dark:text-white">{editingPlanId ? 'แก้ไขแผนงาน' : 'เขียนแผนงานใหม่'}</h3><p className="text-xs text-slate-500 font-bold">สำหรับวันที่ {new Date(selectedDate).toLocaleDateString('th-TH')}</p></div>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">หัวข้อแผนงาน</label><input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 transition-all" placeholder="เช่น นัดพบลูกค้า/ตรวจเช็คเครื่อง" /></div>
                                    <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">รายละเอียดเพิ่มเติม</label><textarea value={content} onChange={e => setContent(e.target.value)} rows={3} className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white resize-none outline-none focus:border-indigo-500 transition-all" placeholder="ระบุสิ่งที่ต้องทำ..." /></div>
                                    <div className="space-y-4 bg-slate-50 dark:bg-black/20 p-5 rounded-[24px] border border-slate-200 dark:border-white/5 overflow-visible">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">จุดนัดหมาย (Itinerary)</label>
                                        <div className="space-y-3">{itinerary.map((it, idx) => (<div key={idx} className="flex items-center gap-3 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm animate-enter"><div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px] font-bold">{idx + 1}</div><div className="flex-1"><div className="text-sm font-bold text-slate-900 dark:text-white">{it.location}</div><div className="text-[10px] text-slate-500 font-medium">{it.objective}</div></div><button onClick={() => setItinerary(itinerary.filter((_, i) => i !== idx))} className="text-rose-400 hover:text-rose-600 transition-colors"><Trash2 size={16}/></button></div>))}</div>
                                        <div className="flex flex-col sm:flex-row gap-2 mt-4 relative" ref={suggestionsRef}>
                                            <div className="flex-1 relative">
                                                <input value={newLoc} onChange={e => {setNewLoc(e.target.value); setShowLocSuggestions(true);}} onFocus={() => setShowLocSuggestions(true)} placeholder="โรงพยาบาล/สถานที่" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-500" />
                                                {showLocSuggestions && (
                                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl z-50 max-h-52 overflow-y-auto ring-1 ring-black/5">
                                                        {filteredHospitals.length > 0 ? filteredHospitals.map((h, i) => (<button key={i} onClick={() => {setNewLoc(h); setShowLocSuggestions(false);}} className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2 border-b border-slate-100 dark:border-white/5 last:border-0"><Building size={12} className="text-indigo-400" />{h}</button>)) : newLoc && (<div className="px-4 py-3 text-[10px] text-slate-400 italic">ไม่พบรายชื่อในฐานข้อมูล</div>)}
                                                        {newLoc && !localProfile?.hospitals.some(h => h.toLowerCase() === newLoc.toLowerCase()) && (<button onClick={handleAddNewHospital} className="w-full text-left px-4 py-3 bg-indigo-50 dark:bg-indigo-900/40 text-xs text-indigo-600 dark:text-indigo-400 font-black border-t border-slate-200 dark:border-white/10 flex items-center gap-2 sticky bottom-0"><Plus size={14} className="bg-indigo-600 text-white rounded-full" />สร้างรายชื่อใหม่: "{newLoc}"</button>)}
                                                    </div>
                                                )}
                                            </div>
                                            <input value={newObj} onChange={e => setNewObj(e.target.value)} placeholder="เป้าหมาย" className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-500" />
                                            <button onClick={handleAddLocation} className="bg-indigo-600 text-white p-2 rounded-xl active:scale-90 transition-all shadow-lg shadow-indigo-600/20"><Plus size={20}/></button>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button onClick={handleSavePlan} disabled={isSaving} className="flex-1 bg-indigo-600 py-4 rounded-2xl font-black text-white dark:text-slate-900 hover:opacity-90 flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all disabled:opacity-50">
                                            {isSaving ? <Loader2 className="animate-spin" /> : <><Save size={20}/> {editingPlanId ? 'อัปเดตข้อมูล' : 'บันทึกเป็นฉบับร่าง'}</>}
                                        </button>
                                        {editingPlanId && (
                                            <button onClick={resetForm} className="px-6 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-bold active:scale-95 transition-all">ยกเลิก</button>
                                        )}
                                    </div>
                                </div>
                            </GlassCard>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2 pt-2"><h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2"><MessageSquare size={14} className="text-indigo-500" /> แผนงานวันที่ {new Date(selectedDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long' })}</h3></div>
                        {loading ? (<div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-500" /></div>) : selectedDayPlans.length === 0 ? (
                            <div className="text-center py-12 bg-white/30 dark:bg-slate-900/30 rounded-[32px] border-2 border-dashed border-slate-200 dark:border-white/10 opacity-60"><Info className="mx-auto text-slate-300 mb-4" size={32} /><p className="text-slate-400 italic text-sm font-medium">ยังไม่มีแผนงานในวันนี้...</p></div>
                        ) : selectedDayPlans.map((plan) => {
                            const statusUI = getStatusUI(plan.status);
                            const canModify = targetUserId === user.uid && (plan.status === 'draft' || plan.status === 'rejected');
                            
                            return (
                                <GlassCard key={plan.id} className={`p-0 overflow-hidden border-indigo-500/10 ${plan.status === 'rejected' ? 'border-rose-500/30' : ''}`}>
                                    <div className="p-6 border-b flex justify-between items-start dark:border-white/5">
                                        <div className="flex gap-4"><div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-lg"><UserIcon size={24} /></div><div><div className="flex items-center gap-2 mb-1.5"><h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">{plan.title}</h3><div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase flex items-center gap-1 ${statusUI.color}`}>{statusUI.icon} {statusUI.label}</div></div><div className="flex items-center gap-3"><span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{plan.userName}</span><span className="w-1 h-1 rounded-full bg-slate-300"></span><span className="text-[10px] text-slate-400 font-bold flex items-center gap-1"><Clock size={10} /> {new Date(plan.createdAt).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}</span></div></div></div>
                                        
                                        <div className="flex items-center gap-1 relative" ref={openMenuId === plan.id ? menuRef : null}>
                                            {canModify && (
                                                <button 
                                                    onClick={() => handleSendForApproval(plan.id)}
                                                    className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg active:scale-90 transition-all flex items-center gap-1.5"
                                                    title="ส่งขออนุมัติ"
                                                >
                                                    <Send size={14} />
                                                    <span className="text-[10px] font-black uppercase tracking-wider">ส่ง</span>
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => setOpenMenuId(openMenuId === plan.id ? null : plan.id)} 
                                                className="p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                                            >
                                                <MoreVertical size={20} />
                                            </button>
                                            
                                            {/* Action Dropdown Menu */}
                                            {openMenuId === plan.id && (
                                                <div className="absolute top-full right-0 mt-2 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-[100] py-2 animate-enter">
                                                    <button onClick={() => handleEditPlan(plan)} className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2"><Edit size={16} className="text-cyan-500" /> แก้ไขแผนงาน</button>
                                                    <button onClick={() => handleDelete(plan.id)} className="w-full text-left px-4 py-3 text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-2 border-t dark:border-white/5"><Trash2 size={16} /> ลบแผนงาน</button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-6">
                                        <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed mb-4 font-medium">{plan.content}</p>
                                        {plan.itinerary && plan.itinerary.length > 0 && (<div className="flex flex-wrap gap-2">{plan.itinerary.map((it, i) => (<div key={i} className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 px-3 py-1.5 rounded-full text-[10px] font-black border border-indigo-100 dark:border-indigo-500/20"><span>{it.location}</span><ChevronRight size={10} /><span className="opacity-70">{it.objective}</span></div>))}</div>)}
                                    </div>
                                </GlassCard>
                            );
                        })}
                    </div>
                </>
            )}

            {activeTab === 'approvals' && (
                <div className="space-y-6 animate-enter">
                    <div className="flex flex-col gap-2 pt-2"><h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">การจัดการคำขอ</h2><p className="text-slate-500 text-sm font-medium mt-2">จัดการและติดตามสถานะแผนงาน{isAdmin ? 'ของทุกคน (Admin)' : isManager ? 'ของพนักงานที่รับผิดชอบ' : 'ของคุณ'}</p></div>

                    {loading ? (<div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-500" size={40} /></div>) : (
                        <div className="space-y-4">
                            {isPrivileged ? (
                                allPendingPlans.length === 0 ? (
                                    <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/20 rounded-[40px] border-2 border-dashed border-slate-200 dark:border-white/10"><CheckCircle className="mx-auto text-emerald-500/50 mb-4" size={48} /><h3 className="text-slate-900 dark:text-white font-black uppercase tracking-widest">ทุกอย่างเรียบร้อย</h3><p className="text-slate-400 text-sm mt-1">ไม่มีแผนงานค้างรอการอนุมัติ</p></div>
                                ) : (
                                    allPendingPlans.map((plan) => (
                                        <GlassCard key={plan.id} className="p-6 border-amber-500/20 shadow-lg">
                                            <div className="flex justify-between items-start mb-4"><div className="flex items-center gap-3"><div className="p-3 bg-amber-100 text-amber-600 rounded-2xl"><Clock size={20} /></div><div><h4 className="font-black text-slate-900 dark:text-white leading-tight">{plan.title}</h4><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 flex items-center gap-1.5"><CalendarDays size={10} className="text-indigo-500" /> {new Date(plan.date).toLocaleDateString('th-TH', { weekday:'short', day:'numeric', month:'short' })} <span className="opacity-30">•</span> <UserIcon size={10} className="text-indigo-500" /> {plan.userName}</p></div></div></div>
                                            <div className="space-y-3"><p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-black/20 p-3 rounded-xl border dark:border-white/5 font-medium">{plan.content}</p><div className="flex gap-2 pt-2"><button onClick={() => handleStatusChange(plan.id, 'approved')} className="flex-1 bg-emerald-500 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"><CheckCircle size={14}/> อนุมัติ</button><button onClick={() => handleStatusChange(plan.id, 'rejected')} className="flex-1 bg-white dark:bg-slate-800 text-rose-500 border border-rose-200 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"><XCircle size={14}/> ปฏิเสธ</button></div></div>
                                        </GlassCard>
                                    ))
                                )
                            ) : (
                                <div className="space-y-6">
                                    {userDrafts.length > 0 && (
                                        <div className="space-y-4">
                                            <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-[32px] border border-indigo-100 dark:border-indigo-500/20 shadow-inner">
                                                <div className="flex items-center justify-between mb-5">
                                                    <div><h3 className="text-sm font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">แผนงานรอการส่ง ({userDrafts.length})</h3><p className="text-[10px] text-indigo-500 font-black uppercase mt-1">กด "ส่งทั้งหมด" เพื่อขออนุมัติรายอาทิตย์</p></div>
                                                    <button onClick={handleSubmitAllDrafts} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-xl active:scale-95 transition-all"><Send size={14} /> ส่งทั้งหมด</button>
                                                </div>
                                                <div className="space-y-2">
                                                    {userDrafts.map(plan => (
                                                        <div key={plan.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center justify-between border border-slate-100 dark:border-white/5 shadow-sm group">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`p-2.5 rounded-xl ${plan.status === 'rejected' ? 'bg-rose-100 text-rose-500' : 'bg-slate-100 text-slate-500'}`}>{plan.status === 'rejected' ? <XCircle size={16}/> : <Edit size={16}/>}</div>
                                                                <div><div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">{plan.title}</div><div className="text-[9px] text-slate-500 font-bold uppercase mt-1">{new Date(plan.date).toLocaleDateString('th-TH', {weekday:'short', day:'numeric', month:'short'})}</div></div>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <button onClick={() => handleSendForApproval(plan.id)} className="p-2 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors"><Send size={14}/></button>
                                                                <button onClick={() => handleEditPlan(plan)} className="p-2 text-slate-300 hover:text-cyan-500 transition-colors"><Edit size={14}/></button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {plans.filter(p => p.status === 'pending' || p.status === 'approved').length === 0 && userDrafts.length === 0 ? (
                                        <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/20 rounded-[40px] border-2 border-dashed border-slate-200 dark:border-white/10 opacity-60"><ShieldCheck className="mx-auto text-indigo-500/50 mb-4" size={48} /><h3 className="text-slate-900 dark:text-white font-black uppercase tracking-widest">ยังไม่มีข้อมูล</h3><p className="text-slate-400 text-sm mt-1 font-medium">เริ่มเขียนแผนงานที่แถบ "ปฏิทิน"</p></div>
                                    ) : (
                                        <div className="space-y-4">
                                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-2 pt-4">ประวัติการส่งแผนงาน</h3>
                                            {plans.filter(p => p.status === 'pending' || p.status === 'approved').map((plan) => {
                                                const statusUI = getStatusUI(plan.status);
                                                return (
                                                    <GlassCard key={plan.id} className={`p-6 border-slate-200 dark:border-white/10 ${plan.status === 'approved' ? 'border-emerald-500/30' : 'border-amber-500/30'}`}>
                                                        <div className="flex justify-between items-start mb-3"><div className="flex items-center gap-3"><div className={`p-2.5 rounded-2xl ${plan.status === 'approved' ? 'bg-emerald-100 text-emerald-600 shadow-sm' : 'bg-amber-100 text-amber-600 shadow-sm'}`}>{plan.status === 'approved' ? <CheckCircle size={18} /> : <Clock size={18} />}</div><div><h4 className="font-black text-slate-900 dark:text-white leading-tight">{plan.title}</h4><div className="flex items-center gap-2 mt-1.5"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(plan.date).toLocaleDateString('th-TH')}</span><span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${statusUI.color}`}>{statusUI.label}</span></div></div></div></div>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed italic font-medium">"{plan.content}"</p>
                                                    </GlassCard>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default WorkPlanner;
