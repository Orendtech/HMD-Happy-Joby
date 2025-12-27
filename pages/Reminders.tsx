
import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { GlassCard } from '../components/GlassCard';
import { getReminders, addReminder, updateReminderStatus, deleteReminder } from '../services/dbService';
import { Reminder } from '../types';
import { 
    Bell, Calendar, Clock, Plus, Trash2, CheckCircle, 
    Circle, AlertCircle, Tag, ChevronRight, X, Loader2,
    CalendarCheck, ClipboardList, MapPin
} from 'lucide-react';

interface Props {
    user: User;
}

const Reminders: React.FC<Props> = ({ user }) => {
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    
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
        setShowModal(false);
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
        <div className="max-w-xl mx-auto space-y-6 animate-enter pb-24 px-4">
            {/* Header section with title and add button */}
            <div className="flex justify-between items-center py-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">การแจ้งเตือน</h2>
                    <p className="text-slate-500 text-sm">จัดการตารางงานและการติดตามผล</p>
                </div>
                <button 
                    onClick={() => setShowModal(true)}
                    className="p-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl shadow-lg shadow-cyan-500/20 transition-all active:scale-95"
                >
                    <Plus size={24} />
                </button>
            </div>

            {/* Main content list of reminders */}
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-cyan-500" size={40} /></div>
            ) : (
                <div className="space-y-4">
                    {reminders.length === 0 ? (
                        <div className="text-center py-20 text-slate-400 italic">ไม่มีการแจ้งเตือนในขณะนี้</div>
                    ) : (
                        reminders.map((r) => (
                            <GlassCard key={r.id} className={`p-5 transition-opacity ${r.isCompleted ? 'opacity-60' : ''}`}>
                                <div className="flex items-start gap-4">
                                    <button 
                                        onClick={() => handleToggle(r.id, r.isCompleted)}
                                        className={`mt-1 transition-colors ${r.isCompleted ? 'text-emerald-500' : 'text-slate-300 hover:text-cyan-500'}`}
                                    >
                                        {r.isCompleted ? <CheckCircle size={24} /> : <Circle size={24} />}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <div className={`font-bold text-lg ${r.isCompleted ? 'line-through text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                                            {r.title}
                                        </div>
                                        {r.description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{r.description}</p>}
                                        <div className="flex flex-wrap gap-3 mt-3">
                                            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                                                <Clock size={12} className="text-cyan-500" />
                                                {new Date(r.dueTime).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                                            </div>
                                            <div className={`text-[10px] font-black uppercase px-2 py-1 rounded-md border ${
                                                r.type === 'check-in' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 border-indigo-100' :
                                                r.type === 'follow-up' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 border-amber-100' :
                                                'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-100'
                                            }`}>
                                                {r.type}
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => handleDelete(r.id)} className="text-slate-400 hover:text-rose-500 transition-colors p-1">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </GlassCard>
                        ))
                    )}
                </div>
            )}

            {/* Modal for adding new reminders */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-xl p-4 animate-enter">
                    <GlassCard className="w-full max-w-md relative bg-white dark:bg-slate-900 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] border-white/20">
                        {/* Header with Close Button - Fixed Stacking */}
                        <div className="flex items-center justify-between mb-8 relative z-50">
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                                <Bell className="text-cyan-500" />
                                สร้างรายการใหม่
                            </h3>
                            <button 
                                onClick={() => setShowModal(false)} 
                                className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-rose-500 rounded-full transition-colors shadow-sm"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-5 relative z-10">
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">หัวข้อ (Title)</label>
                                <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white outline-none focus:border-cyan-500 transition-all" placeholder="เช่น นัดพบหมอสมชาย" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">รายละเอียด (Description)</label>
                                <textarea value={desc} onChange={e => setDesc(e.target.value)} className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white outline-none focus:border-cyan-500 transition-all resize-none" placeholder="รายละเอียดเพิ่มเติม..." rows={2} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">วันที่ (Date)</label>
                                    <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white outline-none appearance-none" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">เวลา (Time)</label>
                                    <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white outline-none appearance-none" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">ประเภท (Type)</label>
                                <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100 dark:bg-black/40 rounded-2xl">
                                    {(['task', 'check-in', 'follow-up'] as const).map(t => (
                                        <button 
                                            key={t}
                                            type="button"
                                            onClick={() => setType(t)}
                                            className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all ${type === t ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button 
                                onClick={handleAdd}
                                disabled={isSaving || !title || !dueDate || !dueTime}
                                className="w-full bg-slate-900 dark:bg-white py-4 rounded-2xl font-black text-white dark:text-slate-900 hover:opacity-90 mt-2 flex items-center justify-center gap-2 shadow-xl disabled:opacity-50 active:scale-95 transition-all"
                            >
                                {isSaving ? <Loader2 className="animate-spin" /> : 'Set Alert'}
                            </button>
                        </div>
                    </GlassCard>
                </div>
            )}
        </div>
    );
};

export default Reminders;
