
import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { GlassCard } from '../components/GlassCard';
import { getUserHistory, updateOpportunity, getUserProfile, getAllUsers, getTeamMembers } from '../services/dbService';
import { AttendanceDay, PipelineData, UserProfile, AdminUser } from '../types';
import { 
    Clock, MapPin, User as UserIcon, TrendingUp, DollarSign, 
    Edit, Save, Loader2, Building, Users, ChevronDown, 
    BarChart3, List, PieChart, Calendar, Trash2, 
    ArrowLeft, Filter, ArrowUpRight, Activity, 
    Zap, Target, Briefcase, ChevronRight, X, Download, Percent
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

const Reports: React.FC<Props> = ({ user }) => {
    const [activeTab, setActiveTab] = useState<'reports' | 'dashboard'>('dashboard');
    const [history, setHistory] = useState<AttendanceDay[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPrivileged, setIsPrivileged] = useState(false);
    const [teamMembers, setTeamMembers] = useState<AdminUser[]>([]);
    const [targetUserId, setTargetUserId] = useState<string>(user.uid);
    const [targetUserName, setTargetUserName] = useState<string>('ประสิทธิภาพของฉัน');

    // Filter State
    const [filterMode, setFilterMode] = useState<'this_month' | 'next_month' | 'this_quarter' | 'year_to_date' | 'custom'>('this_month');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [filterStages, setFilterStages] = useState<string[]>([]);

    // Edit State
    const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
    const [saving, setSaving] = useState(false);

    const funnelStages = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

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
                    
                    // Filter: 
                    // 1. Must be Approved (isApproved !== false)
                    // 2. Must have at least some XP/Data ((u.xp || 0) > 0)
                    // 3. OR it's the current user themselves
                    const filteredMembers = rawMembers.filter(u => 
                        (u.isApproved !== false && (u.xp || 0) > 0) || u.id === user.uid
                    );
                    
                    setTeamMembers(filteredMembers);
                }
                await fetchHistory(user.uid);
            } catch (e) { console.error(e); } finally { setLoading(false); }
        };
        init();
        applyQuickFilter('this_month');
    }, [user]);

    const handleUserChange = async (newUserId: string) => {
        setTargetUserId(newUserId);
        const selectedUser = teamMembers.find(u => u.id === newUserId);
        setTargetUserName(newUserId === user.uid ? 'ประสิทธิภาพของฉัน' : (selectedUser?.name || selectedUser?.email || 'รายงานพนักงาน'));
        setLoading(true); 
        await fetchHistory(newUserId); 
        setLoading(false);
    };

    const fetchHistory = async (uid: string) => {
        const data = await getUserHistory(uid);
        setHistory(data);
    };

    const applyQuickFilter = (mode: typeof filterMode) => {
        setFilterMode(mode);
        const now = new Date();
        let start = new Date();
        let end = new Date();

        if (mode === 'this_month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else if (mode === 'next_month') {
            start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        } else if (mode === 'this_quarter') {
            const currentQuarter = Math.floor(now.getMonth() / 3);
            start = new Date(now.getFullYear(), currentQuarter * 3, 1);
            end = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);
        } else if (mode === 'year_to_date') {
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31);
        }

        const toLocalISO = (d: Date) => {
            const offset = d.getTimezoneOffset() * 60000;
            return new Date(d.getTime() - offset).toISOString().split('T')[0];
        }
        setFilterStartDate(toLocalISO(start));
        setFilterEndDate(toLocalISO(end));
    };

    const toggleStageFilter = (stage: string) => {
        setFilterStages(prev => 
            prev.includes(stage) 
                ? prev.filter(s => s !== stage) 
                : [...prev, stage]
        );
    };

    const handleSaveEdit = async () => {
        if (!editTarget) return;
        setSaving(true);
        try {
            await updateOpportunity(targetUserId, editTarget.dateId, editTarget.location, editTarget.data);
            await fetchHistory(targetUserId); setEditTarget(null);
        } catch (e) { alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล"); } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        if (!editTarget) return;
        if (!window.confirm("คุณต้องการลบโอกาสการขายนี้ใช่หรือไม่?")) return;
        setSaving(true);
        try {
            await updateOpportunity(targetUserId, editTarget.dateId, editTarget.location, null);
            await fetchHistory(targetUserId); setEditTarget(null);
        } catch (e) { alert("เกิดข้อผิดพลาดในการลบข้อมูล"); } finally { setSaving(false); }
    };

    const handleEditClick = (dateId: string, data: PipelineData, location: EditTarget['location']) => {
        setEditTarget({ dateId, data: { ...data }, location });
    };

    const getAllOpportunities = () => {
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
            const dateMatch = d >= filterStartDate && d <= filterEndDate;
            
            // If no stage filter is selected, hide Closed Won/Lost by default to keep list clean
            if (filterStages.length === 0) {
                return dateMatch && op.stage !== 'Closed Won' && op.stage !== 'Closed Lost';
            }
            
            const stageMatch = filterStages.includes(op.stage);
            return dateMatch && stageMatch;
        }).sort((a, b) => (a.expectedCloseDate || a.date).localeCompare(b.expectedCloseDate || b.date));
    };

    const exportToCSV = () => {
        let headers: string[] = [];
        let rows: any[] = [];
        let filename = `report_${filterStartDate}_to_${filterEndDate}.csv`;

        if (activeTab === 'dashboard') {
            headers = ["Date Created", "Product", "Hospital/Location", "Value (THB)", "Stage", "Probability", "Expected Close", "Customer"];
            const opportunities = getAllOpportunities();
            rows = opportunities.map(op => [
                op.date,
                `"${op.product}"`,
                `"${op.locationName}"`,
                op.value,
                op.stage,
                `${op.probability}%`,
                op.expectedCloseDate || '-',
                `"${op.customerName || '-'}"`
            ]);
            filename = `pipeline_${targetUserName}_${filterStartDate}.csv`;
        } else {
            headers = ["Date", "Location", "Check-in Time", "Customer", "Department", "Summary"];
            history.forEach(day => {
                if (day.id < filterStartDate || day.id > filterEndDate) return;
                if (day.report?.visits) {
                    day.report.visits.forEach((v: any) => {
                        // Only export visits with interactions
                        if (v.interactions && v.interactions.length > 0) {
                            v.interactions.forEach((i: any) => {
                                rows.push([
                                    day.id,
                                    `"${v.location}"`,
                                    v.checkInTime?.toDate().toLocaleTimeString('th-TH'),
                                    `"${i.customerName}"`,
                                    `"${i.department || '-'}"`,
                                    `"${(i.summary || '').replace(/"/g, '""')}"`
                                ]);
                            });
                        }
                    });
                }
            });
            filename = `journal_${targetUserName}_${filterStartDate}.csv`;
        }

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const link = document.createElement("a");
        link.href = encodeURI("data:text/csv;charset=utf-8,\uFEFF" + csvContent);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const allDeals = getAllOpportunities();
    const totalValue = allDeals.reduce((sum, item) => sum + (item.value || 0), 0);
    const weightedValue = allDeals.reduce((sum, item) => sum + ((item.value || 0) * (item.probability / 100)), 0);
    const wonValue = allDeals.filter(i => i.stage === 'Closed Won').reduce((sum, item) => sum + (item.value || 0), 0);

    const funnelStagesList = funnelStages;

    if (editTarget) {
        return (
            <div className="max-w-2xl mx-auto space-y-6 animate-enter pb-10 pt-4 px-4">
                <div className="flex items-center gap-4 py-4 sticky top-0 bg-[#F5F5F7] dark:bg-[#020617] z-20">
                    <button onClick={() => setEditTarget(null)} className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 transition-transform active:scale-95"><ArrowLeft size={20} /></button>
                    <div><h2 className="text-2xl font-bold text-slate-900 dark:text-white">แก้ไขโอกาสการขาย</h2><p className="text-sm text-slate-500">{editTarget.data.product}</p></div>
                </div>
                
                <div className="space-y-6">
                    <GlassCard className="p-8 space-y-6">
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">ชื่อสินค้า / โปรเจกต์</label>
                            <div className="relative">
                                <Briefcase className="absolute left-4 top-4 text-slate-400" size={18} />
                                <input value={editTarget.data.product} onChange={e => setEditTarget({...editTarget, data: {...editTarget.data, product: e.target.value}})} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl py-4 pl-12 pr-4 text-lg font-bold outline-none focus:border-cyan-500 transition-all" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">มูลค่า (THB)</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-4 top-4 text-emerald-500" size={18} />
                                    <input type="number" value={editTarget.data.value} onChange={e => setEditTarget({...editTarget, data: {...editTarget.data, value: parseFloat(e.target.value)}})} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl py-4 pl-12 pr-4 text-lg font-bold outline-none focus:border-cyan-500 transition-all" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">สถานะ (Status)</label>
                                <select value={editTarget.data.stage} onChange={e => setEditTarget({...editTarget, data: {...editTarget.data, stage: e.target.value}})} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-base font-bold outline-none focus:border-cyan-500 appearance-none transition-all">
                                    {funnelStagesList.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">โอกาสสำเร็จ (%)</label>
                                <div className="relative">
                                    <Percent className="absolute left-4 top-4 text-indigo-500" size={18} />
                                    <input type="number" min="0" max="100" value={editTarget.data.probability} onChange={e => setEditTarget({...editTarget, data: {...editTarget.data, probability: parseInt(e.target.value)}})} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl py-4 pl-12 pr-4 text-lg font-bold outline-none focus:border-cyan-500 transition-all" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">วันที่คาดว่าจะปิดดีล</label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-4 text-cyan-500" size={18} />
                                    <input type="date" value={editTarget.data.expectedCloseDate || ''} onChange={e => setEditTarget({...editTarget, data: {...editTarget.data, expectedCloseDate: e.target.value}})} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl py-4 pl-12 pr-4 text-base font-bold outline-none focus:border-cyan-500 appearance-none transition-all" />
                                </div>
                            </div>
                        </div>
                    </GlassCard>
                    
                    <div className="flex gap-4">
                        <button onClick={handleDelete} className="p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-2xl border border-rose-100 dark:border-rose-500/20 active:scale-95 transition-all">
                            <Trash2 size={24}/>
                        </button>
                        <button onClick={handleSaveEdit} disabled={saving} className="flex-1 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-2xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50">
                            {saving ? <Loader2 className="animate-spin"/> : <><Save size={20}/> บันทึกการเปลี่ยนแปลง</>}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-enter pb-28 px-4 sm:px-6">
            
            {/* --- TOP HUD --- */}
            <div className="flex flex-col gap-6 pt-6">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">{targetUserName}</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 font-medium flex items-center gap-2">
                            <Activity size={14} className="text-cyan-500" /> 
                            ข้อมูลเชิงลึกทางธุรกิจ
                        </p>
                    </div>
                    
                    {/* Header Controls: Switcher + Export */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                        <button 
                            onClick={exportToCSV}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white p-3 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                            title="Export to CSV"
                        >
                            <Download size={20} />
                            <span className="sm:hidden font-bold text-xs uppercase tracking-widest">Download CSV</span>
                        </button>

                        <div className="bg-slate-200/50 dark:bg-slate-900/50 backdrop-blur-md p-1.5 rounded-[20px] flex gap-1 border border-slate-200 dark:border-white/5">
                            <button 
                                onClick={() => setActiveTab('dashboard')} 
                                className={`flex-1 sm:px-6 py-2.5 rounded-[14px] text-xs font-black uppercase tracking-widest transition-all duration-500 ${activeTab === 'dashboard' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xl scale-[1.02]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                Intelligence
                            </button>
                            <button 
                                onClick={() => setActiveTab('reports')} 
                                className={`flex-1 sm:px-6 py-2.5 rounded-[14px] text-xs font-black uppercase tracking-widest transition-all duration-500 ${activeTab === 'reports' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xl scale-[1.02]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                Journal
                            </button>
                        </div>
                    </div>
                </div>

                {isPrivileged && (
                    <div className="bg-white/50 dark:bg-slate-900/40 p-1 rounded-[24px] border border-slate-200 dark:border-white/10 flex items-center shadow-sm">
                        <div className="p-3 bg-indigo-500 text-white rounded-[20px] shadow-lg shadow-indigo-500/20 shrink-0">
                            <Users size={20} />
                        </div>
                        <select 
                            value={targetUserId} 
                            onChange={(e) => handleUserChange(e.target.value)}
                            className="flex-1 bg-transparent px-4 py-2 text-sm font-bold text-slate-900 dark:text-white outline-none cursor-pointer appearance-none"
                        >
                            <option value={user.uid} className="bg-white dark:bg-slate-900">มุมมองส่วนตัว (ฉัน)</option>
                            {teamMembers.filter(u => u.id !== user.uid).map(m => (
                                <option key={m.id} value={m.id} className="bg-white dark:bg-slate-900">{m.name || m.email}</option>
                            ))}
                        </select>
                        <div className="pr-4 pointer-events-none text-slate-400">
                            <ChevronDown size={16} />
                        </div>
                    </div>
                )}
            </div>

            {/* --- INTELLIGENCE TAB (Opportunities) --- */}
            {activeTab === 'dashboard' && (
                <div className="space-y-8 animate-enter">
                    
                    {/* Stats Dashboard */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-6 rounded-[32px] text-white shadow-2xl shadow-indigo-500/20 relative overflow-hidden group">
                            <Target size={40} className="absolute -right-2 -bottom-2 opacity-20 group-hover:scale-110 transition-transform" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Pipeline</p>
                            <h3 className="text-3xl font-black">฿{(totalValue/1000).toFixed(1)}k</h3>
                            <p className="text-[10px] mt-2 bg-white/20 w-fit px-2 py-0.5 rounded-full">{allDeals.length} ACTIVE</p>
                        </div>

                        <div className="bg-gradient-to-br from-amber-400 to-orange-600 p-6 rounded-[32px] text-white shadow-2xl shadow-orange-500/20 relative overflow-hidden group">
                            <Zap size={40} className="absolute -right-2 -bottom-2 opacity-20 group-hover:scale-110 transition-transform" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Forecast</p>
                            <h3 className="text-3xl font-black">฿{(weightedValue/1000).toFixed(1)}k</h3>
                            <p className="text-[10px] mt-2 bg-white/20 w-fit px-2 py-0.5 rounded-full">WEIGHTED</p>
                        </div>

                        <div className="col-span-2 md:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-200 dark:border-white/5 shadow-xl flex flex-col justify-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Won Revenue</p>
                            <h3 className="text-3xl font-black text-emerald-500">฿{(wonValue/1000).toFixed(1)}k</h3>
                            <div className="flex items-center gap-1 mt-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className="text-[10px] font-bold text-slate-500">REALIZED THIS PERIOD</span>
                            </div>
                        </div>
                    </div>

                    {/* Deal List */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-2">
                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                                <Briefcase size={16} className="text-slate-400" /> โอกาสการขายที่ใช้งานอยู่
                            </h3>
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">{allDeals.length} ทั้งหมด</span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {allDeals.map((deal, idx) => (
                                <div key={idx} onClick={() => handleEditClick(deal.editMetadata.dateId, deal, deal.editMetadata.location)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-5 rounded-[32px] shadow-sm hover:shadow-xl hover:scale-[1.01] transition-all cursor-pointer group flex flex-col gap-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-black text-slate-900 dark:text-white text-lg leading-tight group-hover:text-indigo-500 transition-colors">{deal.product}</div>
                                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mt-1 flex items-center gap-2">
                                                <Building size={12} className="text-cyan-500" /> {deal.locationName}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xl font-black text-indigo-600 dark:text-indigo-400">฿{(deal.value || 0).toLocaleString()}</div>
                                            <div className={`text-[10px] font-black px-2 py-0.5 rounded-full inline-block uppercase mt-1 ${deal.probability >= 70 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                                {deal.probability}% Prob.
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 font-black rounded-full uppercase border border-indigo-100 dark:border-indigo-500/20">
                                                {deal.stage}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold">
                                            <Calendar size={12} /> {deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString('th-TH') : '-'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {allDeals.length === 0 && <div className="col-span-full py-12 text-center text-slate-400 font-bold italic opacity-50 bg-slate-50 dark:bg-slate-900/50 rounded-[32px] border-2 border-dashed border-slate-200 dark:border-white/10">ไม่มีข้อมูลในช่วงเวลานี้</div>}
                        </div>
                    </div>
                </div>
            )}

            {/* --- JOURNAL TAB (Daily Reports) --- */}
            {activeTab === 'reports' && (
                <div className="space-y-10 animate-enter">
                    {history.length === 0 && <div className="py-20 text-center text-slate-400 font-black uppercase tracking-widest opacity-30">ไม่มีบันทึกใน Journal</div>}
                    
                    <div className="relative pl-6 sm:pl-10 space-y-12">
                        {/* Timeline vertical bar */}
                        <div className="absolute left-0 sm:left-4 top-4 bottom-4 w-1 bg-gradient-to-b from-cyan-400 via-indigo-500 to-purple-600 rounded-full opacity-30"></div>
                        
                        {history.map((day, idx) => {
                            // Filter visits that actually have content (interactions or pipeline items)
                            const activeVisits = (day.report?.visits || []).filter((v: any) => 
                                (v.interactions && v.interactions.length > 0) || (v.pipeline && v.pipeline.length > 0)
                            );

                            return (
                                <div key={day.id} className="relative animate-enter" style={{animationDelay: `${idx * 80}ms`}}>
                                    {/* Timeline Dot */}
                                    <div className="absolute -left-[30px] sm:-left-[34px] top-4 w-6 h-6 rounded-full border-4 border-slate-50 dark:border-slate-950 bg-white dark:bg-slate-800 shadow-xl z-10 flex items-center justify-center">
                                        <div className={`w-2 h-2 rounded-full ${day.checkOut ? 'bg-emerald-500' : 'bg-cyan-500 animate-pulse'}`}></div>
                                    </div>
                                    
                                    <GlassCard className="p-0 overflow-hidden border-white/50 dark:border-white/5">
                                        {/* Card Header */}
                                        <div className="p-6 bg-slate-50 dark:bg-white/5 flex justify-between items-center border-b border-slate-100 dark:border-white/5">
                                            <div>
                                                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                                                    {new Date(day.id).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })}
                                                </h3>
                                                <div className="flex items-center gap-3 mt-1.5">
                                                    <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                        <Clock size={12} className="text-cyan-500" />
                                                        {day.checkIns[0]?.timestamp.toDate().toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}
                                                        {day.checkOut && ` — ${day.checkOut.toDate().toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}`}
                                                    </div>
                                                    {day.checkOut && <div className="text-[8px] px-2 py-0.5 bg-emerald-500 text-white rounded-full font-black uppercase">เรียบร้อย</div>}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-2xl font-black text-slate-200 dark:text-slate-800">#{history.length - idx}</div>
                                            </div>
                                        </div>

                                        {/* Visit Thread */}
                                        <div className="p-6 space-y-8">
                                            {activeVisits.length > 0 ? activeVisits.map((visit: any, vIdx: number) => (
                                                <div key={vIdx} className="relative pl-6">
                                                    {/* Connecting line between visits */}
                                                    {vIdx < activeVisits.length - 1 && (
                                                        <div className="absolute left-[7px] top-4 bottom-[-32px] w-0.5 bg-slate-100 dark:bg-white/5"></div>
                                                    )}
                                                    
                                                    {/* Visit Indicator */}
                                                    <div className="absolute left-0 top-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 bg-cyan-500 shadow-lg"></div>
                                                    
                                                    <div className="space-y-4">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <h4 className="font-black text-slate-900 dark:text-white text-base leading-tight">{visit.location}</h4>
                                                                <div className="flex items-center gap-3 mt-1">
                                                                    <span className="text-[10px] font-bold text-slate-400">{visit.checkInTime?.toDate().toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Interactions within visit */}
                                                        <div className="space-y-3">
                                                            {(visit.interactions || []).map((inter: any, iIdx: number) => (
                                                                <div key={iIdx} className="bg-slate-50 dark:bg-white/5 p-4 rounded-[24px] border border-slate-100 dark:border-white/5 group hover:bg-white dark:hover:bg-slate-800 transition-all">
                                                                    <div className="flex items-center gap-2 mb-3">
                                                                        <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-md">
                                                                            <UserIcon size={14} />
                                                                        </div>
                                                                        <div>
                                                                            <div className="text-sm font-black text-slate-900 dark:text-white">{inter.customerName}</div>
                                                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{inter.department || 'ไม่ระบุแผนก'}</div>
                                                                        </div>
                                                                    </div>
                                                                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium pl-10">
                                                                        "{inter.summary || 'ไม่มีรายละเอียดการบันทึก'}"
                                                                    </p>
                                                                    
                                                                    {inter.pipeline && (
                                                                        <div 
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleEditClick(day.id, inter.pipeline!, { visitIdx: vIdx, interactionIdx: iIdx });
                                                                            }}
                                                                            className="mt-4 ml-10 p-4 bg-white dark:bg-slate-950/50 border border-slate-100 dark:border-white/10 rounded-2xl flex justify-between items-center group/pipe relative transition-all hover:border-indigo-500/50 cursor-pointer hover:scale-[1.01] hover:shadow-md"
                                                                        >
                                                                            <div className="flex items-center gap-3">
                                                                                <TrendingUp size={16} className="text-indigo-500" />
                                                                                <div>
                                                                                    <div className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tighter">{inter.pipeline.product}</div>
                                                                                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{inter.pipeline.stage}</div>
                                                                                </div>
                                                                            </div>
                                                                            <div className="text-right">
                                                                                <div className="text-xs font-black text-indigo-600 dark:text-indigo-400">฿{(inter.pipeline.value || 0).toLocaleString()}</div>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )) : (
                                                <div className="py-4 text-center text-slate-400 text-xs font-medium italic opacity-60">
                                                    (ไม่มีข้อมูลบันทึกในวันนี้)
                                                </div>
                                            )}
                                        </div>
                                    </GlassCard>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {loading && (
                <div className="fixed inset-0 bg-white/60 dark:bg-slate-950/60 backdrop-blur-sm z-[100] flex items-center justify-center">
                    <Loader2 className="animate-spin text-cyan-500" size={48} />
                </div>
            )}
        </div>
    );
};

export default Reports;
