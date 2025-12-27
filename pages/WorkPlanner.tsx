
import React, { useEffect, useState, useRef } from 'react';
import { User } from 'firebase/auth';
import { GlassCard } from '../components/GlassCard';
import { getWorkPlans, addWorkPlan, deleteWorkPlan, addHospital, getUserProfile } from '../services/dbService';
import { WorkPlan, UserProfile } from '../types';
import { 
    Plus, Trash2, Calendar, MapPin, 
    X, Loader2, MessageSquare, User as UserIcon, 
    ChevronRight, Info, Save, Clock, ChevronLeft, Building, Search, Download
} from 'lucide-react';

interface Props {
    user: User;
    userProfile: UserProfile | null;
}

const WorkPlanner: React.FC<Props> = ({ user, userProfile }) => {
    // ฟังก์ชันช่วยในการจัดรูปแบบวันที่แบบ Local (YYYY-MM-DD) เพื่อป้องกันปัญหา Timezone
    const formatLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [plans, setPlans] = useState<WorkPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    // ตั้งค่าเริ่มต้นวันที่เลือกให้เป็นวันนี้แบบ Local
    const [selectedDate, setSelectedDate] = useState(formatLocalDate(new Date()));
    
    // Export Range State
    const [exportStart, setExportStart] = useState(formatLocalDate(new Date()));
    const [exportEnd, setExportEnd] = useState(formatLocalDate(new Date()));
    const [showExportOptions, setShowExportOptions] = useState(false);

    // Profile state to handle dynamic hospital updates
    const [localProfile, setLocalProfile] = useState<UserProfile | null>(userProfile);

    // Form State
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [itinerary, setItinerary] = useState<{location: string, objective: string}[]>([]);
    const [newLoc, setNewLoc] = useState('');
    const [newObj, setNewObj] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Autocomplete State
    const [showLocSuggestions, setShowLocSuggestions] = useState(false);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    const refreshProfile = async () => {
        const p = await getUserProfile(user.uid);
        setLocalProfile(p);
    };

    const fetchPlans = async () => {
        setLoading(true);
        try {
            const data = await getWorkPlans();
            setPlans(data);
        } catch (error) {
            console.error("Failed to fetch plans", error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchPlans();
        
        const handleClickOutside = (e: MouseEvent) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
                setShowLocSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [user]);

    // Keep localProfile in sync with props initially
    useEffect(() => {
        setLocalProfile(userProfile);
    }, [userProfile]);

    // Calendar Logic
    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const daysInMonth = getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
    const firstDay = getFirstDayOfMonth(currentMonth.getFullYear(), currentMonth.getMonth());
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const blanks = Array.from({ length: firstDay }, (_, i) => i);

    const changeMonth = (offset: number) => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1));
    };

    const hasPlan = (day: number) => {
        const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const dStr = formatLocalDate(d);
        return plans.some(p => p.date === dStr);
    };

    const selectedDayPlans = plans.filter(p => p.date === selectedDate);

    const handleAddLocation = () => {
        if (!newLoc) return;
        setItinerary([...itinerary, { location: newLoc, objective: newObj }]);
        setNewLoc('');
        setNewObj('');
        setShowLocSuggestions(false);
    };

    const handleAddNewHospital = async () => {
        if (!newLoc.trim()) return;
        try {
            await addHospital(user.uid, newLoc.trim());
            await refreshProfile();
            setShowLocSuggestions(false);
        } catch (e) {
            console.error("Failed to add hospital", e);
        }
    };

    const handleSavePlan = async () => {
        if (!title || !content) return;
        setIsSaving(true);
        await addWorkPlan({
            userId: user.uid,
            userName: localProfile?.name || user.email?.split('@')[0] || 'Unknown',
            date: selectedDate,
            title,
            content,
            itinerary,
            createdAt: new Date().toISOString()
        });
        resetForm();
        await fetchPlans();
        setIsSaving(false);
    };

    const resetForm = () => {
        setTitle('');
        setContent('');
        setItinerary([]);
        setShowForm(false);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("ต้องการลบแผนงานนี้ใช่หรือไม่?")) return;
        await deleteWorkPlan(id);
        await fetchPlans();
    };

    const exportPlansToCSV = () => {
        const filtered = plans.filter(p => p.date >= exportStart && p.date <= exportEnd);
        if (filtered.length === 0) {
            alert("ไม่พบแผนงานในช่วงวันที่เลือก");
            return;
        }

        const headers = ["วันที่", "พนักงาน", "หัวข้อแผนงาน", "รายละเอียด", "จุดนัดพบ/เป้าหมาย"];
        const rows = filtered.map(p => {
            const itineraryStr = p.itinerary.map(it => `${it.location} (${it.objective})`).join(' | ');
            return [
                p.date,
                `"${p.userName}"`,
                `"${p.title.replace(/"/g, '""')}"`,
                `"${p.content.replace(/"/g, '""')}"`,
                `"${itineraryStr.replace(/"/g, '""')}"`
            ];
        });

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const link = document.createElement("a");
        link.href = encodeURI("data:text/csv;charset=utf-8,\uFEFF" + csvContent);
        link.download = `workplans_${exportStart}_to_${exportEnd}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Location suggestions filtering - Show all on empty if focused
    const filteredHospitals = newLoc === '' 
        ? (localProfile?.hospitals || [])
        : (localProfile?.hospitals.filter(h => h.toLowerCase().includes(newLoc.toLowerCase())) || []);

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-enter pb-32 px-4 pt-6">
            {/* Header */}
            <div className="flex justify-between items-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-md p-6 rounded-[32px] border border-slate-200 dark:border-white/5 shadow-sm">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">ปฏิทินแผนงาน</h2>
                    <p className="text-slate-500 text-sm font-medium">จัดตารางและเป้าหมายของคุณ</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setShowExportOptions(!showExportOptions)}
                        className={`p-4 rounded-2xl shadow-lg transition-all active:scale-95 ${
                            showExportOptions 
                            ? 'bg-emerald-500 text-white' 
                            : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-white/5'
                        }`}
                        title="Download CSV"
                    >
                        <Download size={24} />
                    </button>
                    <button 
                        onClick={() => setShowForm(!showForm)}
                        className={`p-4 rounded-2xl shadow-lg transition-all active:scale-95 ${
                            showForm 
                            ? 'bg-rose-500 text-white shadow-rose-500/20' 
                            : 'bg-indigo-600 text-white shadow-indigo-500/20'
                        }`}
                    >
                        {showForm ? <X size={24} /> : <Plus size={24} />}
                    </button>
                </div>
            </div>

            {/* Export Section */}
            {showExportOptions && (
                <GlassCard className="p-6 border-emerald-500/20 animate-enter">
                    <div className="flex flex-col md:flex-row items-end gap-4">
                        <div className="flex-1 w-full space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ดาวน์โหลดแผนงานช่วงวันที่</label>
                            <div className="grid grid-cols-2 gap-2">
                                <input type="date" value={exportStart} onChange={e => setExportStart(e.target.value)} className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white" />
                                <input type="date" value={exportEnd} onChange={e => setExportEnd(e.target.value)} className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white" />
                            </div>
                        </div>
                        <button onClick={exportPlansToCSV} className="w-full md:w-auto bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all">
                            <Download size={18} /> Export
                        </button>
                    </div>
                </GlassCard>
            )}

            {/* Calendar Card */}
            <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-6 px-2">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">
                        {currentMonth.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
                    </h3>
                    <div className="flex gap-2">
                        <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"><ChevronLeft size={20}/></button>
                        <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"><ChevronRight size={20}/></button>
                    </div>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-2">
                    {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(d => (
                        <div key={d} className="text-center text-[10px] font-black text-slate-400 uppercase py-2 tracking-widest">{d}</div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                    {blanks.map(b => <div key={`b-${b}`} className="aspect-square"></div>)}
                    {days.map(d => {
                        const dateObj = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
                        const dateStr = formatLocalDate(dateObj); 
                        const isSelected = selectedDate === dateStr;
                        const isToday = formatLocalDate(new Date()) === dateStr;
                        const hasWork = hasPlan(d);

                        return (
                            <button 
                                key={d}
                                onClick={() => setSelectedDate(dateStr)}
                                className={`aspect-square flex flex-col items-center justify-center rounded-2xl relative transition-all duration-300 ${
                                    isSelected 
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 ring-2 ring-indigo-500/20' 
                                    : isToday 
                                        ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-500/30' 
                                        : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'
                                }`}
                            >
                                <span className="text-sm font-bold">{d}</span>
                                {hasWork && (
                                    <div className={`w-1.5 h-1.5 rounded-full mt-1 ${isSelected ? 'bg-white shadow-sm' : 'bg-indigo-500'}`}></div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </GlassCard>

            {/* Create Plan Form Overlay */}
            {showForm && (
                <div className="animate-enter">
                    <GlassCard className="p-8 space-y-6 border-indigo-500/30 bg-white/80 dark:bg-slate-900/80 shadow-2xl overflow-visible">
                        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/5 pb-4">
                            <div className="p-3 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                                <Calendar size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white">เพิ่มแผนงานใหม่</h3>
                                <p className="text-xs text-slate-500 font-bold">วันที่ {new Date(selectedDate).toLocaleDateString('th-TH')}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">หัวข้อแผนงาน</label>
                                <input 
                                    value={title} 
                                    onChange={e => setTitle(e.target.value)} 
                                    className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-all font-bold" 
                                    placeholder="เช่น เข้าพบลูกค้าโซนสุขุมวิท" 
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">รายละเอียด</label>
                                <textarea 
                                    value={content} 
                                    onChange={e => setContent(e.target.value)} 
                                    rows={3}
                                    className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-all resize-none text-base" 
                                    placeholder="ระบุรายละเอียดคร่าวๆ..." 
                                />
                            </div>

                            <div className="space-y-4 bg-slate-50 dark:bg-black/20 p-5 rounded-[24px] border border-slate-200 dark:border-white/5 overflow-visible">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">จุดนัดหมาย (Itinerary)</label>
                                
                                <div className="space-y-3">
                                    {itinerary.map((it, idx) => (
                                        <div key={idx} className="flex items-center gap-3 bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-white/5">
                                            <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px] font-bold">{idx + 1}</div>
                                            <div className="flex-1">
                                                <div className="text-sm font-bold text-slate-900 dark:text-white">{it.location}</div>
                                                <div className="text-[10px] text-slate-500">{it.objective}</div>
                                            </div>
                                            <button onClick={() => setItinerary(itinerary.filter((_, i) => i !== idx))} className="text-rose-400 hover:text-rose-600"><Trash2 size={16}/></button>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex flex-col sm:flex-row gap-2 mt-4 relative" ref={suggestionsRef}>
                                    <div className="flex-1 relative">
                                        <input 
                                            value={newLoc} 
                                            onChange={e => {
                                                setNewLoc(e.target.value);
                                                setShowLocSuggestions(true);
                                            }} 
                                            onFocus={() => setShowLocSuggestions(true)}
                                            placeholder="สถานที่" 
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-500" 
                                        />
                                        
                                        {showLocSuggestions && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl z-50 max-h-52 overflow-y-auto ring-1 ring-black/5">
                                                {filteredHospitals.length > 0 ? (
                                                    filteredHospitals.map((h, i) => (
                                                        <button 
                                                            key={i} 
                                                            onClick={() => {
                                                                setNewLoc(h);
                                                                setShowLocSuggestions(false);
                                                            }}
                                                            className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 text-xs text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-white/5 last:border-0 flex items-center gap-2"
                                                        >
                                                            <Building size={12} className="text-indigo-400" />
                                                            {h}
                                                        </button>
                                                    ))
                                                ) : newLoc && (
                                                    <div className="px-4 py-3 text-[10px] text-slate-400 italic">
                                                        ไม่พบรายชื่อสถานที่ในฐานข้อมูล
                                                    </div>
                                                )}
                                                
                                                {newLoc && !localProfile?.hospitals.some(h => h.toLowerCase() === newLoc.toLowerCase()) && (
                                                    <button 
                                                        onClick={handleAddNewHospital}
                                                        className="w-full text-left px-4 py-3 bg-indigo-50 dark:bg-indigo-900/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-xs text-indigo-600 dark:text-indigo-400 font-black border-t border-slate-200 dark:border-white/10 flex items-center gap-2 sticky bottom-0"
                                                    >
                                                        <Plus size={14} className="bg-indigo-600 text-white rounded-full" />
                                                        สร้างรายชื่อใหม่: "{newLoc}"
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <input value={newObj} onChange={e => setNewObj(e.target.value)} placeholder="เป้าหมาย" className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-500" />
                                    <button onClick={handleAddLocation} className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-500 transition-transform active:scale-90"><Plus size={20}/></button>
                                </div>
                            </div>

                            <button 
                                onClick={handleSavePlan}
                                disabled={isSaving || !title || !content}
                                className="w-full bg-indigo-600 py-4 rounded-2xl font-black text-white dark:text-slate-900 hover:opacity-90 flex items-center justify-center gap-2 shadow-xl disabled:opacity-50 active:scale-95 transition-all"
                            >
                                {isSaving ? <Loader2 className="animate-spin" /> : <><Save size={20}/> บันทึกแผนงาน</>}
                            </button>
                        </div>
                    </GlassCard>
                </div>
            )}

            {/* Daily Details */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <MessageSquare size={14} className="text-indigo-500" />
                        แผนงานประจำวันที่ {new Date(selectedDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long' })}
                    </h3>
                </div>

                {loading ? (
                    <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-500" /></div>
                ) : selectedDayPlans.length === 0 ? (
                    <div className="text-center py-12 bg-white/30 dark:bg-slate-900/30 rounded-[32px] border-2 border-dashed border-slate-200 dark:border-white/10">
                        <Info className="mx-auto text-slate-300 mb-4" size={32} />
                        <p className="text-slate-400 italic text-sm font-medium">ไม่มีแผนงานในวันนี้... คลิกปุ่ม + เพื่อเพิ่ม</p>
                    </div>
                ) : (
                    selectedDayPlans.map((plan) => (
                        <GlassCard key={plan.id} className="p-0 overflow-hidden hover:shadow-xl transition-all border-indigo-500/10">
                            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-start">
                                <div className="flex gap-4">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shrink-0">
                                        <UserIcon size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight mb-1">{plan.title}</h3>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{plan.userName}</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                            <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                                                <Clock size={10} /> {new Date(plan.createdAt).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => handleDelete(plan.id)} className="text-slate-300 hover:text-rose-500 p-2 transition-colors"><Trash2 size={18} /></button>
                            </div>
                            <div className="p-6">
                                <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed mb-4">{plan.content}</p>
                                {plan.itinerary && plan.itinerary.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {plan.itinerary.map((it, i) => (
                                            <div key={i} className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 px-3 py-1.5 rounded-full text-[10px] font-black border border-indigo-100 dark:border-indigo-500/20">
                                                <span>{it.location}</span>
                                                <ChevronRight size={10} />
                                                <span className="opacity-70">{it.objective}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </GlassCard>
                    ))
                )}
            </div>
        </div>
    );
};

export default WorkPlanner;
