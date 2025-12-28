
import React, { useEffect, useState, useMemo } from 'react';
import { User } from 'firebase/auth';
import { GlassCard } from '../components/GlassCard';
import { getUserHistory, updateOpportunity, getUserProfile, getAllUsers, getTeamMembers, getWorkPlans, checkOut } from '../services/dbService';
import { AttendanceDay, PipelineData, UserProfile, AdminUser, WorkPlan, VisitReport, Interaction, DailyReport } from '../types';
import { 
    Clock, MapPin, User as UserIcon, TrendingUp, DollarSign, 
    Edit, Save, Loader2, Building, Users, ChevronDown, 
    BarChart3, List, PieChart, Calendar, Trash2, 
    ArrowLeft, Filter, ArrowUpRight, Activity, 
    Zap, Target, Briefcase, ChevronRight, X, Download, Percent, MessageSquare
} from 'lucide-react';

interface Props {
    user: User;
}

interface EditTarget {
    dateId: string;
    data: PipelineData;
    location: {
        visitIdx?: number;
        interactionIdx?: number;
        legacyIdx?: number;
    };
}

interface VisitEditState {
    dateId: string;
    visitIdx: number;
    interactions: Interaction[];
}

const Reports: React.FC<Props> = ({ user }) => {
    const [activeTab, setActiveTab] = useState<'reports' | 'dashboard'>('dashboard');
    const [history, setHistory] = useState<AttendanceDay[]>([]);
    const [plans, setPlans] = useState<WorkPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPrivileged, setIsPrivileged] = useState(false);
    const [teamMembers, setTeamMembers] = useState<AdminUser[]>([]);
    const [targetUserId, setTargetUserId] = useState<string>(user.uid);
    const [targetUserName, setTargetUserName] = useState<string>('ประสิทธิภาพของฉัน');

    // Filter State
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [filterStages, setFilterStages] = useState<string[]>([]);

    // Edit State
    const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
    const [visitEdit, setVisitEdit] = useState<VisitEditState | null>(null);
    const [saving, setSaving] = useState(false);

    const funnelStages = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

    const formatTime = (ts: any) => {
        if (!ts) return '-';
        try {
            if (typeof ts.toDate === 'function') return ts.toDate().toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'});
            if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'});
            return new Date(ts).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'});
        } catch (e) {
            return '-';
        }
    };

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                const profile = await getUserProfile(user.uid);
                const hasAccess = profile?.role === 'admin' || profile?.role === 'manager';
                setIsPrivileged(hasAccess);

                if (hasAccess) {
                    let rawMembers: AdminUser[] = [];
                    if (profile?.role === 'admin') {
                        rawMembers = await getAllUsers();
                    } else {
                        rawMembers = await getTeamMembers(user.uid);
                    }
                    const filteredMembers = rawMembers.filter(u => 
                        (u.isApproved !== false && (u.xp || 0) > 0) || u.id === user.uid
                    );
                    setTeamMembers(filteredMembers);
                }
                await fetchUserData(user.uid);
            } catch (e) { console.error(e); } finally { setLoading(false); }
        };
        init();
        
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const toLocalISO = (d: Date) => {
            const offset = d.getTimezoneOffset() * 60000;
            return new Date(d.getTime() - offset).toISOString().split('T')[0];
        }
        setFilterStartDate(toLocalISO(start));
        setFilterEndDate(toLocalISO(end));
    }, [user]);

    const handleUserChange = async (newUserId: string) => {
        setTargetUserId(newUserId);
        const selectedUser = teamMembers.find(u => u.id === newUserId);
        setTargetUserName(newUserId === user.uid ? 'ประสิทธิภาพของฉัน' : (selectedUser?.name || selectedUser?.email || 'รายงานพนักงาน'));
        setLoading(true); 
        await fetchUserData(newUserId); 
        setLoading(false);
    };

    // Fix for handleEditClick not found error
    const handleEditClick = (dateId: string, data: PipelineData, location: { visitIdx?: number, interactionIdx?: number, legacyIdx?: number }) => {
        setEditTarget({
            dateId,
            data: { ...data },
            location
        });
    };

    const fetchUserData = async (uid: string) => {
        const historyData = await getUserHistory(uid);
        const planData = await getWorkPlans(uid);
        setHistory(historyData);
        setPlans(planData);
    };

    const toggleStageFilter = (stage: string) => {
        setFilterStages(prev => 
            prev.includes(stage) ? prev.filter(s => s !== stage) : [...prev, stage]
        );
    };

    const handleSaveEdit = async () => {
        if (!editTarget) return;
        setSaving(true);
        try {
            await updateOpportunity(targetUserId, editTarget.dateId, editTarget.location, editTarget.data);
            await fetchUserData(targetUserId); setEditTarget(null);
        } catch (e) { alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล"); } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        if (!editTarget) return;
        if (!window.confirm("คุณต้องการลบโอกาสการขายนี้ใช่หรือไม่?")) return;
        setSaving(true);
        try {
            await updateOpportunity(targetUserId, editTarget.dateId, editTarget.location, null);
            await fetchUserData(targetUserId); setEditTarget(null);
        } catch (e) { alert("เกิดข้อผิดพลาดในการลบข้อมูล"); } finally { setSaving(false); }
    };

    const handleEditVisit = (dateId: string, visitIdx: number, visit: VisitReport) => {
        setVisitEdit({
            dateId,
            visitIdx,
            interactions: visit.interactions ? JSON.parse(JSON.stringify(visit.interactions)) : []
        });
    };

    const handleSaveVisitEdit = async () => {
        if (!visitEdit) return;
        setSaving(true);
        try {
            const dayRecord = history.find(h => h.id === visitEdit.dateId);
            if (!dayRecord || !dayRecord.report?.visits) return;

            const updatedVisits = [...dayRecord.report.visits];
            const targetVisit = updatedVisits[visitEdit.visitIdx];
            
            targetVisit.interactions = visitEdit.interactions;
            targetVisit.summary = visitEdit.interactions.map(i => `${i.customerName}: ${i.summary}`).join('\n');
            targetVisit.metWith = visitEdit.interactions.map(i => i.customerName);
            
            const newReport: DailyReport = {
                ...dayRecord.report,
                visits: updatedVisits
            };

            await checkOut(targetUserId, newReport, visitEdit.dateId);
            await fetchUserData(targetUserId);
            setVisitEdit(null);
        } catch (e) {
            console.error(e);
            alert("ไม่สามารถบันทึกข้อมูลได้");
        } finally {
            setSaving(false);
        }
    };

    // Memoized opportunities to prevent hanging during tab switches
    const allDealsInRange = useMemo(() => {
        const opportunities: any[] = [];
        history.forEach(day => {
            const extract = (p: PipelineData, loc: string, meta: any) => {
                opportunities.push({ ...p, date: day.id, locationName: loc, editMetadata: { dateId: day.id, location: meta } });
            };
            if (day.report?.visits) {
                day.report.visits.forEach((visit, vIdx) => {
                    if (visit.pipeline) visit.pipeline.forEach((p, pIdx) => extract(p, visit.location, { visitIdx: vIdx, legacyIdx: pIdx }));
                    if (visit.interactions) visit.interactions.forEach((inter, iIdx) => { if (inter.pipeline) extract(inter.pipeline, visit.location, { visitIdx: vIdx, interactionIdx: iIdx }); });
                });
            } else if (day.report?.pipeline) {
                const pipes = Array.isArray(day.report.pipeline) ? day.report.pipeline : [day.report.pipeline];
                pipes.forEach((p, pIdx) => extract(p, day.checkIns[0]?.location || 'Unknown', { legacyIdx: pIdx }));
            }
        });
        return opportunities.filter(op => {
            const d = op.expectedCloseDate || op.date;
            return d >= filterStartDate && d <= filterEndDate;
        });
    }, [history, filterStartDate, filterEndDate]);
    
    // List view filtered by stage chips
    const displayedDeals = useMemo(() => {
        return allDealsInRange.filter(op => {
            if (filterStages.length === 0) return op.stage !== 'Closed Lost';
            return filterStages.includes(op.stage);
        }).sort((a, b) => (a.expectedCloseDate || a.date).localeCompare(b.expectedCloseDate || b.date));
    }, [allDealsInRange, filterStages]);

    // Stats calculations
    const activeDeals = useMemo(() => allDealsInRange.filter(d => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost'), [allDealsInRange]);
    const wonDeals = useMemo(() => allDealsInRange.filter(d => d.stage === 'Closed Won'), [allDealsInRange]);
    const totalPipelineValue = useMemo(() => activeDeals.reduce((sum, item) => sum + (item.value || 0), 0), [activeDeals]);
    const forecastValue = useMemo(() => activeDeals.reduce((sum, item) => sum + ((item.value || 0) * (item.probability / 100)), 0), [activeDeals]);
    const wonRevenue = useMemo(() => wonDeals.reduce((sum, item) => sum + (item.value || 0), 0), [wonDeals]);

    // Journal specific history filtering
    const journalHistory = useMemo(() => {
        return history.filter(h => h.id >= filterStartDate && h.id <= filterEndDate);
    }, [history, filterStartDate, filterEndDate]);

    const exportToCSV = () => {
        let headers: string[] = [];
        let rows: any[] = [];
        let filename = `report_${filterStartDate}_to_${filterEndDate}.csv`;

        if (activeTab === 'dashboard') {
            headers = ["วันที่สร้าง", "ชื่อสินค้า", "โรงพยาบาล/สถานที่", "มูลค่า (บาท)", "สถานะ", "ความน่าจะเป็น (%)", "วันที่คาดว่าจะปิด", "ผู้ติดต่อ"];
            rows = allDealsInRange.map(op => [
                op.date, `"${op.product}"`, `"${op.locationName}"`, op.value, op.stage, `${op.probability}%`, op.expectedCloseDate || '-', `"${op.customerName || '-'}"`
            ]);
            filename = `pipeline_${targetUserName}_${filterStartDate}.csv`;
        } else {
            headers = ["วันที่", "พนักงาน", "แผนงาน: หัวข้อ", "แผนงาน: รายละเอียด", "แผนงาน: จุดนัดพบ/เป้าหมาย", "รายงาน: สถานที่เช็คอิน", "รายงาน: เวลาเช็คอิน", "รายงาน: เวลาเช็คเอาท์", "รายงาน: ผู้ติดต่อ", "รายงาน: แผนก", "รายงาน: สรุปกิจกรรม"];
            
            journalHistory.forEach(dayReport => {
                const dateStr = dayReport.id;
                const dayPlan = plans.find(p => p.date === dateStr);
                const planTitle = dayPlan?.title || '-';
                const planContent = dayPlan?.content || '-';
                const planItinerary = dayPlan?.itinerary ? dayPlan.itinerary.map(it => `${it.location} (${it.objective})`).join(' | ') : '-';

                if (dayReport.report?.visits && dayReport.report.visits.length > 0) {
                    dayReport.report.visits.forEach((v: any) => {
                        const checkInStr = formatTime(v.checkInTime);
                        const checkOutStr = formatTime(dayReport.checkOut);
                        if (v.interactions && v.interactions.length > 0) {
                            v.interactions.forEach((i: any) => {
                                rows.push([
                                    dateStr, `"${targetUserName}"`, `"${planTitle.replace(/"/g, '""')}"`, `"${planContent.replace(/"/g, '""')}"`, `"${planItinerary.replace(/"/g, '""')}"`,
                                    `"${v.location}"`, checkInStr, checkOutStr,
                                    `"${i.customerName}"`, `"${i.department || '-'}"`, `"${(i.summary || '').replace(/"/g, '""')}"`
                                ]);
                            });
                        } else {
                            rows.push([
                                dateStr, `"${targetUserName}"`, `"${planTitle.replace(/"/g, '""')}"`, `"${planContent.replace(/"/g, '""')}"`, `"${planItinerary.replace(/"/g, '""')}"`,
                                `"${v.location}"`, checkInStr, checkOutStr, '-', '-', '"(ไม่มีบันทึกกิจกรรม)"'
                            ]);
                        }
                    });
                } else if (dayPlan) {
                    rows.push([
                        dateStr, `"${targetUserName}"`, `"${planTitle.replace(/"/g, '""')}"`, `"${planContent.replace(/"/g, '""')}"`, `"${planItinerary.replace(/"/g, '""')}"`,
                        '-', '-', '-', '-', '-', '"(ยังไม่มีข้อมูลรายงาน)"'
                    ]);
                }
            });
            filename = `performance_${targetUserName}_${filterStartDate}_to_${filterEndDate}.csv`;
        }

        if (rows.length === 0) { alert("ไม่พบข้อมูลที่จะส่งออก"); return; }
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const link = document.createElement("a");
        link.href = encodeURI("data:text/csv;charset=utf-8,\uFEFF" + csvContent);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (visitEdit) {
        return (
            <div className="max-w-2xl mx-auto space-y-6 animate-enter pb-10 pt-4 px-4">
                <div className="flex items-center gap-4 py-4 sticky top-0 bg-[#F5F5F7] dark:bg-[#020617] z-20">
                    <button onClick={() => setVisitEdit(null)} className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 active:scale-95 transition-transform"><ArrowLeft size={20} /></button>
                    <div><h2 className="text-2xl font-bold text-slate-900 dark:text-white">แก้ไขรายละเอียดกิจกรรม</h2><p className="text-sm text-slate-500">วันที่ {visitEdit.dateId}</p></div>
                </div>
                <div className="space-y-4">
                    {visitEdit.interactions.map((inter, idx) => (
                        <GlassCard key={idx} className="p-6 space-y-4">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <UserIcon size={16} className="text-indigo-500" />
                                    <span className="font-bold text-slate-900 dark:text-white">{inter.customerName}</span>
                                </div>
                                <button onClick={() => {
                                    const next = [...visitEdit.interactions];
                                    next.splice(idx, 1);
                                    setVisitEdit({...visitEdit, interactions: next});
                                }} className="text-rose-400 hover:text-rose-600"><Trash2 size={16}/></button>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">สรุปการเข้าพบ</label>
                                <textarea 
                                    value={inter.summary} 
                                    onChange={e => {
                                        const next = [...visitEdit.interactions];
                                        next[idx].summary = e.target.value;
                                        setVisitEdit({...visitEdit, interactions: next});
                                    }}
                                    rows={3}
                                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm outline-none focus:border-cyan-500 transition-all resize-none"
                                />
                            </div>
                        </GlassCard>
                    ))}
                    {visitEdit.interactions.length === 0 && (
                        <div className="py-12 text-center text-slate-400 font-bold italic opacity-60">ไม่มีข้อมูลบันทึกกิจกรรม</div>
                    )}
                </div>
                <button 
                    onClick={handleSaveVisitEdit} 
                    disabled={saving} 
                    className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-2xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                >
                    {saving ? <Loader2 className="animate-spin"/> : <><Save size={20}/> บันทึกรายงาน</>}
                </button>
            </div>
        );
    }

    if (editTarget) {
        return (
            <div className="max-w-2xl mx-auto space-y-6 animate-enter pb-10 pt-4 px-4">
                <div className="flex items-center gap-4 py-4 sticky top-0 bg-[#F5F5F7] dark:bg-[#020617] z-20">
                    <button onClick={() => setEditTarget(null)} className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 active:scale-95 transition-transform"><ArrowLeft size={20} /></button>
                    <div><h2 className="text-2xl font-bold text-slate-900 dark:text-white">แก้ไขโอกาสการขาย</h2><p className="text-sm text-slate-500">{editTarget.data.product}</p></div>
                </div>
                <GlassCard className="p-8 space-y-6">
                    <div className="space-y-1.5"><label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">ชื่อสินค้า / โปรเจกต์</label><div className="relative"><Briefcase className="absolute left-4 top-4 text-slate-400" size={18} /><input value={editTarget.data.product} onChange={e => setEditTarget({...editTarget, data: {...editTarget.data, product: e.target.value}})} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl py-4 pl-12 pr-4 text-lg font-bold outline-none focus:border-cyan-500 transition-all" /></div></div>
                    <div className="grid grid-cols-2 gap-4"><div className="space-y-1.5"><label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">มูลค่า (THB)</label><div className="relative"><DollarSign className="absolute left-4 top-4 text-emerald-500" size={18} /><input type="number" value={editTarget.data.value} onChange={e => setEditTarget({...editTarget, data: {...editTarget.data, value: parseFloat(e.target.value)}})} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl py-4 pl-12 pr-4 text-lg font-bold outline-none focus:border-cyan-500 transition-all" /></div></div><div className="space-y-1.5"><label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">สถานะ (Status)</label><select value={editTarget.data.stage} onChange={e => setEditTarget({...editTarget, data: {...editTarget.data, stage: e.target.value}})} className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-base font-bold outline-none focus:border-cyan-500 appearance-none">{funnelStages.map(f => <option key={f} value={f}>{f}</option>)}</select></div></div>
                    <div className="grid grid-cols-2 gap-4"><div className="space-y-1.5"><label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">โอกาสสำเร็จ (%)</label><div className="relative"><Percent className="absolute left-4 top-4 text-indigo-500" size={18} /><input type="number" min="0" max="100" value={editTarget.data.probability} onChange={e => setEditTarget({...editTarget, data: {...editTarget.data, probability: parseInt(e.target.value)}})} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl py-4 pl-12 pr-4 text-lg font-bold outline-none focus:border-cyan-500 transition-all" /></div></div><div className="space-y-1.5"><label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">วันที่คาดว่าจะปิดดีล</label><div className="relative"><Calendar className="absolute left-4 top-4 text-cyan-500" size={18} /><input type="date" value={editTarget.data.expectedCloseDate || ''} onChange={e => setEditTarget({...editTarget, data: {...editTarget.data, expectedCloseDate: e.target.value}})} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl py-4 pl-12 pr-4 text-base font-bold outline-none focus:border-cyan-500 appearance-none" /></div></div></div>
                </GlassCard>
                <div className="flex gap-4"><button onClick={handleDelete} className="p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-2xl border border-rose-100 dark:border-rose-500/20 active:scale-95 transition-all"><Trash2 size={24}/></button><button onClick={handleSaveEdit} disabled={saving} className="flex-1 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-2xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50">{saving ? <Loader2 className="animate-spin"/> : <><Save size={20}/> บันทึกการเปลี่ยนแปลง</>}</button></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-enter pb-28 px-4 sm:px-6">
            <div className="flex flex-col gap-6 pt-6">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{targetUserName}</h1>
                        <p className="text-slate-500 text-sm mt-2 font-medium flex items-center gap-2"><Activity size={14} className="text-cyan-500" /> ข้อมูลเชิงลึกทางธุรกิจ</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                        <button onClick={exportToCSV} className="bg-emerald-500 hover:bg-emerald-600 text-white p-3 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"><Download size={20} /><span className="sm:hidden font-bold text-xs">Download CSV</span></button>
                        <div className="bg-slate-200/50 dark:bg-slate-900/50 backdrop-blur-md p-1.5 rounded-[20px] flex gap-1 border border-slate-200 dark:border-white/5">
                            <button onClick={() => setActiveTab('dashboard')} className={`flex-1 sm:px-6 py-2.5 rounded-[14px] text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'dashboard' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xl' : 'text-slate-500'}`}>ข้อมูลสรุป</button>
                            <button onClick={() => setActiveTab('reports')} className={`flex-1 sm:px-6 py-2.5 rounded-[14px] text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'reports' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xl' : 'text-slate-500'}`}>บันทึกรายวัน</button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white/50 dark:bg-slate-900/40 p-3 rounded-[24px] border border-slate-200 dark:border-white/10 flex items-center gap-3 shadow-sm">
                        <div className="p-2 bg-cyan-500 text-white rounded-xl shadow-md shrink-0"><Calendar size={18} /></div>
                        <div className="flex flex-1 items-center gap-2">
                            <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="bg-transparent text-xs font-bold text-slate-900 dark:text-white outline-none w-full" />
                            <span className="text-slate-400 text-xs">to</span>
                            <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="bg-transparent text-xs font-bold text-slate-900 dark:text-white outline-none w-full" />
                        </div>
                    </div>
                    {isPrivileged && (
                        <div className="bg-white/50 dark:bg-slate-900/40 p-1 rounded-[24px] border border-slate-200 dark:border-white/10 flex items-center shadow-sm">
                            <div className="p-3 bg-indigo-500 text-white rounded-[20px] shadow-lg shrink-0"><Users size={20} /></div>
                            <select value={targetUserId} onChange={(e) => handleUserChange(e.target.value)} className="flex-1 bg-transparent px-4 py-2 text-sm font-bold text-slate-900 dark:text-white outline-none appearance-none">
                                <option value={user.uid}>มุมมองส่วนตัว (ฉัน)</option>
                                {teamMembers.filter(u => u.id !== user.uid).map(m => (<option key={m.id} value={m.id}>{m.name || m.email}</option>))}
                            </select>
                            <div className="pr-4 pointer-events-none text-slate-400"><ChevronDown size={16} /></div>
                        </div>
                    )}
                </div>
            </div>

            {activeTab === 'dashboard' && (
                <div className="space-y-8 animate-enter">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-6 rounded-[32px] text-white shadow-2xl relative overflow-hidden group">
                            <Target size={40} className="absolute -right-2 -bottom-2 opacity-20" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Pipeline</p>
                            <h3 className="text-3xl font-black">฿{(totalPipelineValue/1000).toFixed(1)}k</h3>
                            <p className="text-[10px] mt-2 bg-white/20 w-fit px-2 py-0.5 rounded-full">{activeDeals.length} ACTIVE</p>
                        </div>
                        <div className="bg-gradient-to-br from-amber-400 to-orange-600 p-6 rounded-[32px] text-white shadow-2xl relative overflow-hidden group">
                            <Zap size={40} className="absolute -right-2 -bottom-2 opacity-20" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Forecast</p>
                            <h3 className="text-3xl font-black">฿{(forecastValue/1000).toFixed(1)}k</h3>
                            <p className="text-[10px] mt-2 bg-white/20 w-fit px-2 py-0.5 rounded-full">WEIGHTED</p>
                        </div>
                        <div className="col-span-2 md:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-200 dark:border-white/5 shadow-xl flex flex-col justify-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Won Revenue</p>
                            <h3 className="text-3xl font-black text-emerald-500">฿{(wonRevenue/1000).toFixed(1)}k</h3>
                            <div className="flex items-center gap-1 mt-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className="text-[10px] font-bold text-slate-500">REALIZED THIS PERIOD</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex flex-col gap-3">
                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2 px-2">
                                <Briefcase size={16} className="text-slate-400" /> ดีลและการขาย
                            </h3>
                            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 px-2">
                                {funnelStages.map(stage => (
                                    <button 
                                        key={stage} 
                                        onClick={() => toggleStageFilter(stage)}
                                        className={`px-4 py-2 rounded-full text-[10px] font-black whitespace-nowrap transition-all border ${
                                            filterStages.includes(stage) 
                                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' 
                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/5 text-slate-500'
                                        }`}
                                    >
                                        {stage}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {displayedDeals.map((deal, idx) => (
                                <div key={idx} onClick={() => handleEditClick(deal.editMetadata.dateId, deal, deal.editMetadata.location)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-5 rounded-[32px] shadow-sm hover:shadow-xl hover:scale-[1.01] transition-all cursor-pointer group flex flex-col gap-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-black text-slate-900 dark:text-white text-lg leading-tight group-hover:text-indigo-500 transition-colors">{deal.product}</div>
                                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mt-1 flex items-center gap-2"><Building size={12} className="text-cyan-500" /> {deal.locationName}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xl font-black text-indigo-600 dark:text-indigo-400">฿{(deal.value || 0).toLocaleString()}</div>
                                            <div className={`text-[10px] font-black px-2 py-0.5 rounded-full inline-block uppercase mt-1 ${deal.probability >= 70 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>{deal.probability}% Prob.</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                                        <span className="text-[10px] px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 font-black rounded-full uppercase border border-indigo-100 dark:border-indigo-500/20">{deal.stage}</span>
                                        <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold"><Calendar size={12} /> {deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString('th-TH') : '-'}</div>
                                    </div>
                                </div>
                            ))}
                            {displayedDeals.length === 0 && <div className="col-span-full py-12 text-center text-slate-400 font-bold italic opacity-50 bg-slate-50 dark:bg-slate-900/50 rounded-[32px] border-2 border-dashed border-slate-200 dark:border-white/10">ไม่มีข้อมูลในช่วงเวลานี้</div>}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'reports' && (
                <div className="space-y-10 animate-enter">
                    {journalHistory.length === 0 && <div className="py-20 text-center text-slate-400 font-black uppercase tracking-widest opacity-30">ไม่มีบันทึกกิจกรรมในหน้านี้</div>}
                    <div className="relative pl-6 sm:pl-10 space-y-12">
                        <div className="absolute left-0 sm:left-4 top-4 bottom-4 w-1 bg-gradient-to-b from-cyan-400 via-indigo-500 to-purple-600 rounded-full opacity-30"></div>
                        {journalHistory.map((day, idx) => {
                            const visits = (day.report?.visits || []);
                            return (
                                <div key={day.id || idx} className="relative animate-enter" style={{animationDelay: `${Math.min(idx, 10) * 80}ms`}}>
                                    <div className="absolute -left-[30px] sm:-left-[34px] top-4 w-6 h-6 rounded-full border-4 border-slate-50 dark:border-slate-950 bg-white dark:bg-slate-800 shadow-xl z-10 flex items-center justify-center"><div className={`w-2 h-2 rounded-full ${day.checkOut ? 'bg-emerald-500' : 'bg-cyan-500 animate-pulse'}`}></div></div>
                                    <GlassCard className="p-0 overflow-hidden border-white/50 dark:border-white/5">
                                        <div className="p-6 bg-slate-50 dark:bg-white/5 flex justify-between items-center border-b border-slate-100 dark:border-white/5">
                                            <div><h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{new Date(day.id).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })}</h3><div className="flex items-center gap-3 mt-1.5"><div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest"><Clock size={12} className="text-cyan-500" />{formatTime(day.checkIns[0]?.timestamp)}{day.checkOut && ` — ${formatTime(day.checkOut)}`}</div>{day.checkOut && <div className="text-[8px] px-2 py-0.5 bg-emerald-500 text-white rounded-full font-black uppercase">เรียบร้อย</div>}</div></div>
                                            <div className="text-right"><div className="text-2xl font-black text-slate-200 dark:text-slate-800">#{journalHistory.length - idx}</div></div>
                                        </div>
                                        <div className="p-6 space-y-8">
                                            {visits.length > 0 ? visits.map((visit: any, vIdx: number) => (
                                                <div key={vIdx} className="relative pl-6">{vIdx < visits.length - 1 && (<div className="absolute left-[7px] top-4 bottom-[-32px] w-0.5 bg-slate-100 dark:bg-white/5"></div>)}<div className="absolute left-0 top-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 bg-cyan-500 shadow-lg"></div><div className="space-y-4"><div className="flex justify-between items-start"><div><h4 className="font-black text-slate-900 dark:text-white text-base leading-tight">{visit.location}</h4><div className="flex items-center gap-3 mt-1"><span className="text-[10px] font-bold text-slate-400">{formatTime(visit.checkInTime)}</span></div></div>{targetUserId === user.uid && (<button onClick={() => handleEditVisit(day.id, vIdx, visit)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-400 hover:text-indigo-500 transition-colors"><MessageSquare size={16}/></button>)}</div><div className="space-y-3">{(visit.interactions || []).map((inter: any, iIdx: number) => (<div key={iIdx} className="bg-slate-50 dark:bg-white/5 p-4 rounded-[24px] border border-slate-100 dark:border-white/5 group hover:bg-white dark:hover:bg-slate-800 transition-all"><div className="flex items-center gap-2 mb-3"><div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-md"><UserIcon size={14} /></div><div><div className="text-sm font-black text-slate-900 dark:text-white">{inter.customerName}</div><div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{inter.department || 'ไม่ระบุแผนก'}</div></div></div><p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium pl-10">"{inter.summary || 'ไม่มีรายละเอียดการบันทึก'}"</p>{inter.pipeline && (<div onClick={(e) => { e.stopPropagation(); handleEditClick(day.id, inter.pipeline!, { visitIdx: vIdx, interactionIdx: iIdx }); }} className="mt-4 ml-10 p-4 bg-white dark:bg-slate-950/50 border border-slate-100 dark:border-white/10 rounded-2xl flex justify-between items-center relative transition-all hover:border-indigo-500/50 cursor-pointer hover:scale-[1.01] shadow-sm"><div className="flex items-center gap-3"><TrendingUp size={16} className="text-indigo-500" /><div><div className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tighter">{inter.pipeline.product}</div><div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{inter.pipeline.stage}</div></div></div><div className="text-right"><div className="text-xs font-black text-indigo-600 dark:text-indigo-400">฿{(inter.pipeline.value || 0).toLocaleString()}</div></div></div>)}</div>))}</div></div></div>
                                            )) : (<div className="py-4 text-center text-slate-400 text-xs font-medium italic opacity-60">(ไม่มีข้อมูลบันทึกในวันนี้)</div>)}
                                        </div>
                                    </GlassCard>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {loading && (<div className="fixed inset-0 bg-white/60 dark:bg-slate-950/60 backdrop-blur-sm z-[100] flex items-center justify-center"><Loader2 className="animate-spin text-cyan-500" size={48} /></div>)}
        </div>
    );
};

export default Reports;
