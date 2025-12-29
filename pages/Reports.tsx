
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
    Zap, Target, Briefcase, ChevronRight, X, Download, Percent, MessageSquare, Info, FilterX,
    LayoutDashboard, History
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
    
    const displayedDeals = useMemo(() => {
        return allDealsInRange.filter(op => {
            if (filterStages.length === 0) return op.stage !== 'Closed Lost';
            return filterStages.includes(op.stage);
        }).sort((a, b) => (a.expectedCloseDate || a.date).localeCompare(b.expectedCloseDate || b.date));
    }, [allDealsInRange, filterStages]);

    const activeDeals = useMemo(() => allDealsInRange.filter(d => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost'), [allDealsInRange]);
    const wonDeals = useMemo(() => allDealsInRange.filter(d => d.stage === 'Closed Won'), [allDealsInRange]);
    const totalPipelineValue = useMemo(() => activeDeals.reduce((sum, item) => sum + (item.value || 0), 0), [activeDeals]);
    const forecastValue = useMemo(() => activeDeals.reduce((sum, item) => sum + ((item.value || 0) * (item.probability / 100)), 0), [activeDeals]);
    const wonRevenue = useMemo(() => wonDeals.reduce((sum, item) => sum + (item.value || 0), 0), [wonDeals]);

    // Funnel Data Calculation - Translated to Thai
    const funnelData = useMemo(() => {
        const stats = {
            'Prospecting': { count: 0, value: 0, color: 'bg-lime-600', label: 'สร้างการรับรู้', thaiStage: 'กำลังค้นหาลูกค้า' },
            'Qualification': { count: 0, value: 0, color: 'bg-yellow-400', label: 'สนใจ/ติดต่อ', thaiStage: 'ตรวจสอบความต้องการ' },
            'Proposal': { count: 0, value: 0, color: 'bg-amber-500', label: 'นำเสนอ/ส่งมอบ', thaiStage: 'เสนอราคา/บริการ' },
            'Negotiation': { count: 0, value: 0, color: 'bg-rose-600', label: 'มีโอกาสปิด', thaiStage: 'กำลังต่อรอง' },
            'Closed Won': { count: 0, value: 0, color: 'bg-blue-500', label: 'ปิดการขายสำเร็จ', thaiStage: 'สำเร็จ' }
        };

        allDealsInRange.forEach(d => {
            if (stats[d.stage]) {
                stats[d.stage].count += 1;
                stats[d.stage].value += (d.value || 0);
            }
        });

        return Object.entries(stats).map(([stage, data]) => ({
            stage,
            ...data
        }));
    }, [allDealsInRange]);

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

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-enter pb-28 px-4 sm:px-6">
            <div className="flex flex-col gap-6 pt-6">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{targetUserName}</h1>
                        <p className="text-slate-500 text-sm mt-2 font-medium flex items-center gap-2"><Activity size={14} className="text-cyan-500" /> ข้อมูลเชิงลึกทางธุรกิจ</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                        <button onClick={exportToCSV} className="bg-emerald-500 hover:bg-emerald-600 text-white p-3 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"><Download size={20} /><span className="sm:hidden font-bold text-xs">ส่งออกข้อมูล</span></button>
                        <div className="bg-slate-200/50 dark:bg-slate-900/50 backdrop-blur-md p-1.5 rounded-[20px] flex gap-1 border border-slate-200 dark:border-white/5 shadow-inner">
                            <button onClick={() => setActiveTab('dashboard')} className={`flex-1 sm:px-6 py-2.5 rounded-[14px] text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'dashboard' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xl' : 'text-slate-500'}`}><LayoutDashboard size={14} /> ข้อมูลสรุป</button>
                            <button onClick={() => setActiveTab('reports')} className={`flex-1 sm:px-6 py-2.5 rounded-[14px] text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'reports' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xl' : 'text-slate-500'}`}><History size={14} /> บันทึกรายวัน</button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white/50 dark:bg-slate-900/40 p-3 rounded-[24px] border border-slate-200 dark:border-white/10 flex items-center gap-3 shadow-sm">
                        <div className="p-2 bg-cyan-500 text-white rounded-xl shadow-md shrink-0"><Calendar size={18} /></div>
                        <div className="flex flex-1 items-center gap-2">
                            <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="bg-transparent text-xs font-bold text-slate-900 dark:text-white outline-none w-full" />
                            <span className="text-slate-400 text-xs font-bold">ถึง</span>
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
                    {/* Top KPI Cards - Translated */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-6 rounded-[32px] text-white shadow-2xl relative overflow-hidden group">
                            <Target size={40} className="absolute -right-2 -bottom-2 opacity-20" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">มูลค่ารวมในพอร์ต</p>
                            <h3 className="text-2xl sm:text-3xl font-black truncate">฿{(totalPipelineValue/1000).toFixed(1)}k</h3>
                            <p className="text-[10px] mt-2 bg-white/20 w-fit px-2 py-0.5 rounded-full">{activeDeals.length} ดีลที่กำลังดำเนินอยู่</p>
                        </div>
                        <div className="bg-gradient-to-br from-amber-400 to-orange-600 p-6 rounded-[32px] text-white shadow-2xl relative overflow-hidden group">
                            <Zap size={40} className="absolute -right-2 -bottom-2 opacity-20" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">ยอดขายคาดการณ์</p>
                            <h3 className="text-2xl sm:text-3xl font-black truncate">฿{(forecastValue/1000).toFixed(1)}k</h3>
                            <p className="text-[10px] mt-2 bg-white/20 w-fit px-2 py-0.5 rounded-full">คำนวณตามน้ำหนักความน่าจะเป็น</p>
                        </div>
                        <div className="col-span-2 md:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-200 dark:border-white/5 shadow-xl flex flex-col justify-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">ยอดขายที่ทำได้จริง</p>
                            <h3 className="text-2xl sm:text-3xl font-black text-emerald-500 truncate">฿{(wonRevenue/1000).toFixed(1)}k</h3>
                            <div className="flex items-center gap-1 mt-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className="text-[10px] font-bold text-slate-500 line-clamp-1 uppercase">สำเร็จในช่วงเวลานี้</span>
                            </div>
                        </div>
                    </div>

                    {/* Sales Funnel Visualization - Translated Labels */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                                <BarChart3 size={16} className="text-cyan-500" /> สถิติกรวยการขาย (Sales Funnel)
                            </h3>
                            <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-400">
                                <Info size={14} />
                            </div>
                        </div>

                        <GlassCard className="p-6 sm:p-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 overflow-visible">
                            <div className="flex flex-col items-center gap-1.5 max-w-full">
                                {funnelData.map((item: any, idx: number) => {
                                    const baseWidth = 95;
                                    const widthPercent = baseWidth - (idx * 15);
                                    
                                    return (
                                        <div 
                                            key={idx} 
                                            className="w-full flex flex-col items-center group relative"
                                            style={{ zIndex: funnelData.length - idx }}
                                        >
                                            <div 
                                                className={`h-14 sm:h-16 flex items-center justify-between px-4 sm:px-6 transition-all duration-500 hover:brightness-110 shadow-lg ${item.color} rounded-2xl relative border border-white/10`}
                                                style={{ 
                                                    width: `${widthPercent}%`, 
                                                    minWidth: '160px', 
                                                    marginBottom: '2px' 
                                                }}
                                            >
                                                <div className="flex flex-col min-w-0 pr-2">
                                                    <span className="text-[8px] sm:text-[10px] font-black text-white/80 uppercase tracking-wider truncate">
                                                        {item.label}
                                                    </span>
                                                    <span className="text-[10px] sm:text-xs font-black text-white truncate">
                                                        {item.thaiStage}
                                                    </span>
                                                </div>

                                                <div className="text-right shrink-0">
                                                    <div className="text-sm sm:text-lg font-black text-white leading-none">
                                                        ฿{(item.value / 1000).toFixed(1)}k
                                                    </div>
                                                    <div className="text-[8px] sm:text-[9px] font-bold text-white/90">
                                                        {item.count} ดีล
                                                    </div>
                                                </div>

                                                <div className="absolute inset-0 bg-white/5 pointer-events-none rounded-2xl overflow-hidden">
                                                    <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-l from-black/10 to-transparent"></div>
                                                </div>
                                            </div>
                                            
                                            {idx < funnelData.length - 1 && (
                                                <div className="h-1.5 w-0.5 bg-slate-200 dark:bg-slate-700/50 my-0.5"></div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-10 grid grid-cols-5 gap-1 border-t border-slate-100 dark:border-white/5 pt-6 px-1">
                                {funnelData.map((item: any, idx: number) => (
                                    <div key={idx} className="flex flex-col items-center gap-1.5">
                                        <div className={`w-3 h-3 rounded-full ${item.color} shadow-sm`}></div>
                                        <span className="text-[7px] sm:text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase text-center leading-tight">
                                            {item.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </GlassCard>
                    </div>

                    {/* Deals List */}
                    <div className="space-y-4 pt-4">
                        <div className="flex flex-col gap-3">
                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2 px-2">
                                <Briefcase size={16} className="text-slate-400" /> รายการดีลทั้งหมด
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
                                        {stage === 'Prospecting' ? 'ค้นหาลูกค้า' : 
                                         stage === 'Qualification' ? 'ตรวจสอบ' : 
                                         stage === 'Proposal' ? 'เสนอราคา' : 
                                         stage === 'Negotiation' ? 'ต่อรอง' : 
                                         stage === 'Closed Won' ? 'สำเร็จ' : 'ไม่สำเร็จ'}
                                    </button>
                                ))}
                                {filterStages.length > 0 && (
                                    <button onClick={() => setFilterStages([])} className="p-2 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-full border border-rose-100 dark:border-rose-500/20 shrink-0"><FilterX size={14}/></button>
                                )}
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-12">
                            {displayedDeals.map((deal, idx) => (
                                <div key={idx} onClick={() => handleEditClick(deal.editMetadata.dateId, deal, deal.editMetadata.location)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-5 rounded-[32px] shadow-sm hover:shadow-xl hover:scale-[1.01] transition-all cursor-pointer group flex flex-col gap-4">
                                    <div className="flex justify-between items-start">
                                        <div className="min-w-0 pr-2">
                                            <div className="font-black text-slate-900 dark:text-white text-lg leading-tight group-hover:text-indigo-500 transition-colors truncate">{deal.product}</div>
                                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mt-1 flex items-center gap-2"><Building size={12} className="text-cyan-500 shrink-0" /> <span className="truncate">{deal.locationName}</span></div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-lg sm:text-xl font-black text-indigo-600 dark:text-indigo-400">฿{(deal.value || 0).toLocaleString()}</div>
                                            <div className={`text-[9px] font-black px-2 py-0.5 rounded-full inline-block uppercase mt-1 ${deal.probability >= 70 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>{deal.probability}% โอกาสสำเร็จ</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                                        <span className="text-[10px] px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 font-black rounded-full uppercase border border-indigo-100 dark:border-indigo-500/20">{deal.stage}</span>
                                        <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold shrink-0"><Calendar size={12} /> {deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString('th-TH') : 'ไม่ระบุวันปิดการขาย'}</div>
                                    </div>
                                </div>
                            ))}
                            {displayedDeals.length === 0 && <div className="col-span-full py-12 text-center text-slate-400 font-bold italic opacity-50 bg-slate-50 dark:bg-slate-900/50 rounded-[32px] border-2 border-dashed border-slate-200 dark:border-white/10 uppercase tracking-widest text-xs">ไม่มีข้อมูลดีลในช่วงเวลานี้</div>}
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
                                    <div className="absolute -left-[30px] sm:-left-[34px] top-4 w-6 h-6 rounded-full border-4 border-slate-50 dark:border-slate-950 bg-white dark:bg-slate-800 shadow-xl z-10 flex items-center justify-center shadow-emerald-500/20"><div className={`w-2 h-2 rounded-full ${day.checkOut ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-cyan-500 animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.5)]'}`}></div></div>
                                    <GlassCard className="p-0 overflow-hidden border-white/50 dark:border-white/5 shadow-lg">
                                        <div className="p-6 bg-slate-50 dark:bg-white/5 flex justify-between items-center border-b border-slate-100 dark:border-white/5">
                                            <div><h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">{new Date(day.id).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })}</h3><div className="flex items-center gap-3 mt-1.5"><div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest"><Clock size={12} className="text-cyan-500" />{formatTime(day.checkIns[0]?.timestamp)}{day.checkOut && ` — ${formatTime(day.checkOut)}`}</div>{day.checkOut && <div className="text-[8px] px-2 py-0.5 bg-emerald-500 text-white rounded-full font-black uppercase tracking-tighter">สำเร็จ</div>}</div></div>
                                            <div className="text-right shrink-0"><div className="text-2xl font-black text-slate-200 dark:text-slate-800">#{journalHistory.length - idx}</div></div>
                                        </div>
                                        <div className="p-6 space-y-8">
                                            {visits.length > 0 ? visits.map((visit: any, vIdx: number) => (
                                                <div key={vIdx} className="relative pl-6">{vIdx < visits.length - 1 && (<div className="absolute left-[7px] top-4 bottom-[-32px] w-0.5 bg-slate-100 dark:bg-white/5"></div>)}<div className="absolute left-0 top-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 bg-cyan-500 shadow-md"></div><div className="space-y-4"><div className="flex justify-between items-start"><div><h4 className="font-black text-slate-900 dark:text-white text-base leading-tight truncate max-w-[200px]">{visit.location}</h4><div className="flex items-center gap-3 mt-1"><span className="text-[10px] font-bold text-slate-400 uppercase">{formatTime(visit.checkInTime)}</span></div></div>{targetUserId === user.uid && (<button onClick={() => handleEditVisit(day.id, vIdx, visit)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-400 hover:text-indigo-500 transition-colors shadow-sm"><MessageSquare size={16}/></button>)}</div><div className="space-y-3">{(visit.interactions || []).map((inter: any, iIdx: number) => (<div key={iIdx} className="bg-slate-50 dark:bg-white/5 p-4 rounded-[24px] border border-slate-100 dark:border-white/5 group hover:bg-white dark:hover:bg-slate-800 transition-all shadow-sm"><div className="flex items-center gap-2 mb-3"><div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-sm shrink-0"><UserIcon size={14} /></div><div className="min-w-0 flex-1"><div className="text-sm font-black text-slate-900 dark:text-white truncate">{inter.customerName}</div><div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight truncate">{inter.department || 'ไม่ระบุแผนก'}</div></div></div><p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium pl-0 sm:pl-10 italic">"{inter.summary || 'ไม่มีรายละเอียดการบันทึก'}"</p>{inter.pipeline && (<div onClick={(e) => { e.stopPropagation(); handleEditClick(day.id, inter.pipeline!, { visitIdx: vIdx, interactionIdx: iIdx }); }} className="mt-4 sm:ml-10 p-4 bg-white dark:bg-slate-950/50 border border-slate-100 dark:border-white/10 rounded-2xl flex justify-between items-center relative transition-all hover:border-indigo-500/50 cursor-pointer hover:scale-[1.01] shadow-sm"><div className="flex items-center gap-3 min-w-0 flex-1"><TrendingUp size={16} className="text-indigo-500 shrink-0" /><div className="min-w-0"><div className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tighter truncate">{inter.pipeline.product}</div><div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest truncate">{inter.pipeline.stage}</div></div></div><div className="text-right shrink-0"><div className="text-xs font-black text-indigo-600 dark:text-indigo-400">฿{(inter.pipeline.value || 0).toLocaleString()}</div></div></div>)}</div>))}</div></div></div>
                                            )) : (<div className="py-4 text-center text-slate-400 text-xs font-medium italic opacity-60 uppercase tracking-widest">(ไม่มีข้อมูลบันทึกในวันนี้)</div>)}
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
