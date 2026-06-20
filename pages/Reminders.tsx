
import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { GlassCard } from '../components/GlassCard';
import { getReminders, addReminder, updateReminderStatus, deleteReminder } from '../services/dbService';
import { Reminder } from '../types';
import { 
    Bell, Calendar, Clock, Plus, Trash2, CheckCircle, 
    Circle, AlertCircle, Tag, ChevronRight, X, Loader2,
    CalendarCheck, ClipboardList, MapPin, ChevronUp, ChevronDown
} from 'lucide-react';

interface Props {
    user: User;
}

const Reminders: React.FC<Props> = ({ user }) => {
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    
    // Form State
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [dueTime, setDueTime] = useState('');
    const [type, setType] = useState<'check-in' | 'follow-up' | 'task'>('task');
    const [isSaving, setIsSaving] = useState(false);

    const fetchReminders = async () => {
        setLoading(true);
        const data = await getReminders(user.uid);
        setReminders(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchReminders();
    }, [user]);

    const handleAdd = async () => {
        if (!title || !dueDate || !dueTime) return;
        setIsSaving(true);
        const combinedDateTime = new Date(`${dueDate}T${dueTime}`).toISOString();
        await addReminder(user.uid, {
            title,
            description: desc,
            dueTime: combinedDateTime,
            type,
            isCompleted: false,
            createdAt: new Date().toISOString()
        });
        setTitle(''); setDesc(''); setDueDate(''); setDueTime(''); setType('task');
        setShowForm(false);
        await fetchReminders();
        setIsSaving(false);
    };

    const handleToggle = async (id: string, current: boolean) => {
        await updateReminderStatus(user.uid, id, !current);
        await fetchReminders();
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("ต้องการลบการแจ้งเตือนนี้ใช่หรือไม่?")) return;
        await deleteReminder(user.uid, id);
        await fetchReminders();
    };

    return (
        <div className="max-w-xl mx-auto space-y-4 animate-enter pb-24 px-3">
            {/* Header section with title and add button */}
            <div className="flex justify-between items-center py-2.5">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">การแจ้งเตือน</h2>
                    <p className="text-slate-500 text-xs">จัดการตารางงานและการติดตามผล</p>
                </div>
                <button 
                    onClick={() => setShowForm(!showForm)}
                    className={`p-2.5 rounded-xl shadow-md transition-all active:scale-95 ${
                        showForm 
                        ? 'bg-rose-500 text-white shadow-rose-500/20' 
                        : 'bg-orange-500 text-white shadow-orange-500/20'
                    }`}
                >
                    {showForm ? <X size={20} /> : <Plus size={20} />}
                </button>
            </div>

            {/* Inline Creation Form - Expanding at the top */}
            {showForm && (
                <div className="animate-enter">
                    <GlassCard className="p-4 border-slate-200/50 bg-white/80 dark:bg-slate-900/80 shadow-md overflow-visible">
                        <div className="space-y-3.5">
                            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5 mb-1">
                                <Plus className="text-orange-500" size={16} />
                                เพิ่มรายการใหม่
                            </h3>
                            
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">หัวข้อ (Title)</label>
                                <input 
                                    value={title} 
                                    onChange={e => setTitle(e.target.value)} 
                                    className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-xs text-slate-900 dark:text-white outline-none focus:border-orange-500 transition-all font-bold" 
                                    placeholder="เช่น นัดพบคุณหมอสมชาย" 
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">รายละเอียด (Optional)</label>
                                <textarea 
                                    value={desc} 
                                    onChange={e => setDesc(e.target.value)} 
                                    className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-orange-500 transition-all resize-none text-xs" 
                                    placeholder="รายละเอียดเพิ่มเติม..." 
                                    rows={2} 
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">วันที่ (Date)</label>
                                    <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-xs text-slate-900 dark:text-white outline-none appearance-none font-bold" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">เวลา (Time)</label>
                                    <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-xs text-slate-900 dark:text-white outline-none appearance-none font-bold" />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">ประเภท (Type)</label>
                                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-black/40 rounded-xl">
                                    {(['task', 'check-in', 'follow-up'] as const).map(t => (
                                        <button 
                                            key={t}
                                            type="button"
                                            onClick={() => setType(t)}
                                            className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tight transition-all ${type === t ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-1">
                                <button 
                                    onClick={handleAdd}
                                    disabled={isSaving || !title || !dueDate || !dueTime}
                                    className="w-full bg-slate-900 dark:bg-white py-3 rounded-xl font-bold text-xs text-white dark:text-slate-900 hover:opacity-90 flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 active:scale-95 transition-all"
                                >
                                    {isSaving ? <Loader2 className="animate-spin" /> : 'ตั้งค่าแจ้งเตือน'}
                                </button>
                            </div>
                        </div>
                    </GlassCard>
                </div>
            )}

            {/* Main content list of reminders */}
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-orange-500" size={32} /></div>
            ) : (
                <div className="space-y-3">
                    <div className="flex items-center gap-1.5 px-1 opacity-60">
                        <ClipboardList size={13} className="text-slate-500" />
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">รายการทั้งหมด</h3>
                    </div>

                    {reminders.length === 0 ? (
                        <div className="text-center py-16 text-xs text-slate-400 italic">ไม่มีการแจ้งเตือนในขณะนี้</div>
                    ) : (
                        reminders.map((r, idx) => (
                            <GlassCard 
                                key={r.id} 
                                className={`p-3.5 transition-all animate-enter ${r.isCompleted ? 'opacity-50' : ''}`}
                                style={{ animationDelay: `${idx * 40}ms` }}
                            >
                                <div className="flex items-start gap-3">
                                    <button 
                                        onClick={() => handleToggle(r.id, r.isCompleted)}
                                        className={`mt-0.5 transition-all duration-300 transform active:scale-75 ${r.isCompleted ? 'text-emerald-500' : 'text-slate-300 hover:text-orange-500'}`}
                                    >
                                        {r.isCompleted ? <CheckCircle size={20} /> : <Circle size={20} />}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <div className={`font-bold text-sm leading-snug transition-all ${r.isCompleted ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                                            {r.title}
                                        </div>
                                        {r.description && <p className="text-xs text-slate-500 dark:text-slate-450 mt-0.5 line-clamp-2">{r.description}</p>}
                                        <div className="flex flex-wrap gap-2 mt-2.5">
                                            <div className="flex items-center gap-1 text-[8.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide bg-slate-50 dark:bg-slate-900/40 px-2 py-1 rounded-lg border border-slate-100 dark:border-white/5">
                                                <Clock size={10} className="text-orange-500" />
                                                {new Date(r.dueTime).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                                            </div>
                                            <div className={`text-[8.5px] font-bold uppercase px-2 py-1 rounded-lg border tracking-wide ${
                                                r.type === 'check-in' ? 'bg-indigo-50 dark:bg-indigo-900/10 text-indigo-600 border-indigo-100 dark:border-indigo-500/10' :
                                                r.type === 'follow-up' ? 'bg-amber-50 dark:bg-amber-900/10 text-amber-600 border-amber-100 dark:border-amber-500/10' :
                                                'bg-slate-50 dark:bg-slate-900/20 text-slate-500 border-slate-100 dark:border-white/5'
                                            }`}>
                                                {r.type}
                                            </div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleDelete(r.id)} 
                                        className="text-slate-300 hover:text-rose-500 transition-colors p-1.5 rounded-full hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </GlassCard>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default Reminders;
