import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { GlassCard } from '../components/GlassCard';
import { getUserHistory, updatePipelineItem, getUserProfile, getAllUsers, getTeamMembers } from '../services/dbService';
import { AttendanceDay, PipelineData, UserProfile, AdminUser, VisitReport } from '../types';
import { Clock, MapPin, User as UserIcon, TrendingUp, DollarSign, Edit, X, Save, Loader2, Building, Users, ChevronDown, ExternalLink, BarChart3, List, PieChart } from 'lucide-react';

interface Props {
    user: User;
}

const Reports: React.FC<Props> = ({ user }) => {
    // Tab State
    const [activeTab, setActiveTab] = useState<'reports' | 'dashboard'>('dashboard');

    const [history, setHistory] = useState<AttendanceDay[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Manager/Admin View State
    const [isPrivileged, setIsPrivileged] = useState(false);
    const [teamMembers, setTeamMembers] = useState<AdminUser[]>([]);
    const [targetUserId, setTargetUserId] = useState<string>(user.uid);
    const [targetUserName, setTargetUserName] = useState<string>('My Reports');

    // Editing State
    const [editingPipeline, setEditingPipeline] = useState<{dateId: string, index: number, data: PipelineData} | null>(null);
    const [saving, setSaving] = useState(false);

    // Initial Load: Check Role & Fetch Data
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                const profile = await getUserProfile(user.uid);
                const hasAccess = profile?.role === 'admin' || profile?.role === 'manager';
                setIsPrivileged(hasAccess);

                if (hasAccess) {
                    if (profile?.role === 'admin') {
                        const users = await getAllUsers();
                        setTeamMembers(users);
                    } else {
                        const team = await getTeamMembers(user.uid);
                        setTeamMembers(team);
                    }
                }
                await fetchHistory(user.uid);
            } catch (e) { console.error(e); } finally { setLoading(false); }
        };
        init();
    }, [user]);

    // Fetch history when target user changes
    const handleUserChange = async (newUserId: string) => {
        setTargetUserId(newUserId);
        if (newUserId === user.uid) { setTargetUserName('My Reports'); } else {
            const selectedUser = teamMembers.find(u => u.id === newUserId);
            setTargetUserName(selectedUser?.name || selectedUser?.email || 'User Reports');
        }
        setLoading(true); await fetchHistory(newUserId); setLoading(false);
    };

    const fetchHistory = async (uid: string) => {
        const data = await getUserHistory(uid);
        setHistory(data);
    };

    const getProbColor = (prob: number) => {
        if (prob >= 80) return 'bg-emerald-500';
        if (prob >= 50) return 'bg-amber-500';
        return 'bg-rose-500';
    };

    // Funnel Configuration - Standard Funnel Order (Prospecting Top -> Closed Won Bottom)
    const funnelConfig = [
        { stage: 'Prospecting', color: 'bg-yellow-400', width: '100%', z: 50 },
        { stage: 'Qualification', color: 'bg-orange-400', width: '85%', z: 40 },
        { stage: 'Proposal', color: 'bg-rose-400', width: '70%', z: 30 },
        { stage: 'Negotiation', color: 'bg-purple-500', width: '55%', z: 20 },
        { stage: 'Closed Won', color: 'bg-emerald-500', width: '40%', z: 10 }
    ];

    // --- DASHBOARD LOGIC ---
    const getAllOpportunities = () => {
        const opportunities: Array<PipelineData & { date: string, location: string }> = [];
        history.forEach(day => {
            if (day.report?.visits) {
                day.report.visits.forEach(visit => {
                    // Aggregated Pipeline Array
                    if (visit.pipeline && visit.pipeline.length > 0) {
                        visit.pipeline.forEach(p => {
                            opportunities.push({ ...p, date: day.id, location: visit.location });
                        });
                    }
                    // Detailed Interactions Pipeline
                    else if (visit.interactions) {
                        visit.interactions.forEach(i => {
                            if (i.pipeline) {
                                opportunities.push({ ...i.pipeline, date: day.id, location: visit.location });
                            }
                        });
                    }
                });
            } 
            // Legacy Support
            else if (day.report?.pipeline) {
                const pipes = Array.isArray(day.report.pipeline) ? day.report.pipeline : [day.report.pipeline];
                pipes.forEach(p => opportunities.push({ ...p, date: day.id, location: day.checkIns[0]?.location || 'Unknown' }));
            }
        });
        return opportunities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };

    const allDeals = getAllOpportunities();
    const totalValue = allDeals.reduce((sum, item) => sum + (item.value || 0), 0);
    const weightedValue = allDeals.reduce((sum, item) => sum + ((item.value || 0) * (item.probability / 100)), 0);
    const wonValue = allDeals.filter(i => i.stage === 'Closed Won').reduce((sum, item) => sum + item.value, 0);

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-enter pb-24">
            
            {/* Header & Filter Area */}
            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{targetUserName}</h2>
                        <p className="text-slate-500 text-sm">Performance & Activity Overview</p>
                    </div>
                    {/* Tab Switcher */}
                    <div className="bg-slate-200 dark:bg-slate-800 p-1 rounded-xl flex text-xs font-bold">
                        <button 
                            onClick={() => setActiveTab('reports')}
                            className={`px-4 py-2 rounded-lg transition-all ${activeTab === 'reports' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                        >
                            Daily Reports
                        </button>
                        <button 
                            onClick={() => setActiveTab('dashboard')}
                            className={`px-4 py-2 rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                        >
                            Opportunities
                        </button>
                    </div>
                </div>

                {/* Manager Filter Dropdown */}
                {isPrivileged && (
                    <GlassCard className="p-3 flex items-center gap-3 bg-white/70 dark:bg-slate-900/50 border-indigo-200 dark:border-indigo-500/20">
                        <div className="bg-indigo-100 dark:bg-indigo-500/10 p-2 rounded-lg text-indigo-500 dark:text-indigo-400">
                            <Users size={18} />
                        </div>
                        <div className="flex-1 relative">
                            <label className="block text-[10px] text-indigo-400 dark:text-indigo-300 font-bold uppercase tracking-wider mb-0.5">
                                {teamMembers.length <= 1 ? 'Viewing Data For' : 'Select Team Member'}
                            </label>
                            <div className="relative">
                                <select 
                                    value={targetUserId}
                                    onChange={(e) => handleUserChange(e.target.value)}
                                    className="w-full bg-transparent text-slate-900 dark:text-white text-sm font-medium outline-none appearance-none cursor-pointer relative z-10 pr-8"
                                >
                                    <option value={user.uid} className="bg-white dark:bg-slate-900">My Reports (Me)</option>
                                    {teamMembers.filter(u => u.id !== user.uid).map(member => (
                                        <option key={member.id} value={member.id} className="bg-white dark:bg-slate-900">
                                            {member.name || member.email}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="absolute right-0 top-1 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    </GlassCard>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center pt-20 text-slate-500 gap-2">
                    <Loader2 className="animate-spin" /> Loading data...
                </div>
            ) : (
                <>
                    {/* --- VIEW 1: DAILY REPORTS --- */}
                    {activeTab === 'reports' && (
                        <div className="space-y-6">
                            {history.length === 0 && (
                                <div className="text-center py-10 text-slate-400 bg-white/50 dark:bg-slate-900/30 rounded-3xl border border-slate-200 dark:border-white/5 border-dashed">
                                    No reports found for this user.
                                </div>
                            )}

                            {history.map((day, idx) => {
                                const dateObj = new Date(day.id);
                                
                                // Handle New vs Old Data Structure
                                let visits: VisitReport[] = [];
                                
                                if (day.report?.visits) {
                                    visits = day.report.visits;
                                } else {
                                    // Legacy Support
                                    const flatPipeline = Array.isArray(day.report?.pipeline) ? day.report?.pipeline : day.report?.pipeline ? [day.report.pipeline] : [];
                                    const flatMetWith = Array.isArray(day.report?.metWith) ? day.report?.metWith : day.report?.metWith ? [day.report.metWith] : [];
                                    if (day.checkIns.length > 0) {
                                        visits = day.checkIns.map((ci, i) => ({
                                            location: ci.location,
                                            checkInTime: ci.timestamp,
                                            summary: i === day.checkIns.length - 1 ? day.report?.summary || '' : '',
                                            metWith: i === day.checkIns.length - 1 ? flatMetWith : [],
                                            pipeline: i === day.checkIns.length - 1 ? flatPipeline : []
                                        }));
                                    }
                                }

                                return (
                                    <div key={day.id} className="relative pl-8 animate-enter" style={{animationDelay: `${idx * 50}ms`}}>
                                        {/* Timeline Line */}
                                        {idx !== history.length - 1 && <div className="absolute left-[11px] top-8 bottom-[-24px] w-[2px] bg-slate-200 dark:bg-slate-800"></div>}
                                        <div className={`absolute left-0 top-2 w-6 h-6 rounded-full border-4 border-[#F5F5F7] dark:border-slate-950 ${day.checkOut ? 'bg-emerald-500' : 'bg-cyan-500 animate-pulse'}`}></div>

                                        <GlassCard className="group">
                                            {/* Header */}
                                            <div className="flex justify-between items-start border-b border-slate-100 dark:border-white/5 pb-4 mb-4">
                                                <div>
                                                    <div className="text-lg font-bold text-slate-900 dark:text-white">{dateObj.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                                                    <div className="text-slate-500 text-xs mt-1 flex items-center gap-2">
                                                        <Clock size={12} />
                                                        {day.checkIns[0]?.timestamp.toDate().toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}
                                                        <span className="text-slate-300 dark:text-slate-700 mx-1">•</span>
                                                        {day.checkOut ? day.checkOut.toDate().toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'}) : 'Active'}
                                                    </div>
                                                </div>
                                                <div className={`text-xs px-2 py-1 rounded border ${day.checkOut ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-cyan-50 dark:bg-cyan-500/10 border-cyan-100 dark:border-cyan-500/20 text-cyan-600 dark:text-cyan-400'}`}>{day.checkOut ? 'Completed' : 'On Going'}</div>
                                            </div>

                                            {/* VISITS LOOP */}
                                            <div className="space-y-6">
                                                {visits.map((visit, vIdx) => (
                                                    <div key={vIdx} className="relative">
                                                        {/* Connecting line */}
                                                        {vIdx !== visits.length - 1 && <div className="absolute left-[7px] top-4 bottom-[-24px] w-[2px] bg-slate-100 dark:bg-white/5"></div>}
                                                        
                                                        <div className="flex flex-col gap-3">
                                                            {/* Location Header */}
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-4 h-4 rounded-full bg-cyan-100 dark:bg-cyan-500/20 border border-cyan-200 dark:border-cyan-500/50 flex items-center justify-center shrink-0">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500"></div>
                                                                </div>
                                                                <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">{visit.location}</div>
                                                                <div className="text-[10px] text-slate-400 bg-slate-50 dark:bg-black/20 px-1.5 py-0.5 rounded">{visit.checkInTime?.toDate().toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}</div>
                                                            </div>

                                                            {/* Details */}
                                                            <div className="ml-7 bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-white/5 rounded-xl p-4">
                                                                {/* Summary */}
                                                                {visit.summary ? (
                                                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3 whitespace-pre-line">"{visit.summary}"</p>
                                                                ) : (
                                                                    <p className="text-xs text-slate-400 italic mb-3">No summary recorded.</p>
                                                                )}

                                                                {/* Met With */}
                                                                {visit.metWith && visit.metWith.length > 0 && (
                                                                    <div className="flex flex-wrap gap-2 mb-3">
                                                                        {visit.metWith.map((contact, ci) => (
                                                                            <span key={ci} className="flex items-center gap-1 text-[10px] bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-300 px-2 py-1 rounded border border-purple-100 dark:border-purple-500/20">
                                                                                <UserIcon size={10}/> {contact}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {/* Pipeline */}
                                                                {visit.pipeline && visit.pipeline.length > 0 && (
                                                                    <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/5">
                                                                         <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-1"><TrendingUp size={10}/> Opportunities</div>
                                                                        {visit.pipeline.map((item: any, pi: number) => (
                                                                            <div key={pi} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg p-2.5 flex justify-between items-center shadow-sm">
                                                                                <div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{item.product}</span>
                                                                                        {item.customerName && <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1 rounded">{item.customerName}</span>}
                                                                                    </div>
                                                                                    <div className="text-[10px] text-slate-500">{item.stage} • {item.probability}%</div>
                                                                                </div>
                                                                                <div className="text-right">
                                                                                    <div className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">฿{item.value.toLocaleString()}</div>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </GlassCard>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* --- VIEW 2: OPPORTUNITIES DASHBOARD --- */}
                    {activeTab === 'dashboard' && (
                        <div className="space-y-6">
                            {/* KPI Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <GlassCard className="p-4 flex flex-col gap-1 bg-indigo-500 text-white border-none relative overflow-hidden">
                                    <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/20 rounded-full blur-2xl"></div>
                                    <span className="text-[10px] font-bold opacity-80 uppercase tracking-wider">Total Pipeline</span>
                                    <span className="text-2xl font-black tracking-tight">฿{(totalValue/1000).toFixed(1)}k</span>
                                    <span className="text-[10px] opacity-70">{allDeals.length} active deals</span>
                                </GlassCard>
                                <GlassCard className="p-4 flex flex-col gap-1 bg-white dark:bg-slate-800">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Weighted Forecast</span>
                                    <span className="text-2xl font-black text-slate-900 dark:text-white">฿{(weightedValue/1000).toFixed(1)}k</span>
                                    <span className="text-[10px] text-slate-400">Prob. adjusted</span>
                                </GlassCard>
                                <GlassCard className="p-4 flex flex-col gap-1 bg-white dark:bg-slate-800 col-span-2 md:col-span-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Closed Won</span>
                                    <span className="text-2xl font-black text-emerald-500">฿{(wonValue/1000).toFixed(1)}k</span>
                                    <span className="text-[10px] text-slate-400">Realized Revenue</span>
                                </GlassCard>
                            </div>

                            {/* Funnel Chart (Standard Funnel Order) */}
                            <GlassCard className="overflow-visible relative">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2"><BarChart3 size={16} className="text-cyan-500"/> Pipeline Funnel</h3>
                                <div className="flex flex-col items-center w-full gap-0.5 relative z-0">
                                    {funnelConfig.map((config, idx) => {
                                        const deals = allDeals.filter(d => d.stage === config.stage);
                                        const value = deals.reduce((sum, d) => sum + d.value, 0);
                                        
                                        return (
                                            <div 
                                                key={idx}
                                                className={`
                                                    h-10 md:h-12 ${config.color} text-white flex items-center justify-between px-4 md:px-6 shadow-lg relative group transition-all hover:scale-[1.02] hover:z-50 cursor-default
                                                `}
                                                style={{ 
                                                    width: config.width, 
                                                    clipPath: 'polygon(2% 0, 98% 0, 100% 100%, 0% 100%)', 
                                                    marginBottom: '-4px', 
                                                    zIndex: config.z
                                                }}
                                            >
                                                {/* Stage Label */}
                                                <span className="font-bold text-[10px] md:text-xs uppercase tracking-wider drop-shadow-md whitespace-nowrap text-shadow">
                                                    {config.stage}
                                                </span>
                                                
                                                {/* Value Label */}
                                                <div className="text-right flex flex-col items-end leading-none drop-shadow-md">
                                                    <span className="font-black text-xs md:text-sm">฿{(value/1000).toFixed(1)}k</span>
                                                    <span className="text-[8px] md:text-[10px] opacity-90">{deals.length} deals</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    
                                    {/* Closed Lost - Bottom Box */}
                                    <div className="w-[30%] min-w-[120px] mt-6 bg-slate-200 dark:bg-slate-800 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-slate-500 shadow-inner">
                                        Lost: ฿{(allDeals.filter(d => d.stage === 'Closed Lost').reduce((s,i) => s+i.value, 0)/1000).toFixed(1)}k
                                    </div>
                                </div>
                            </GlassCard>

                            {/* Detailed Deal List */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white ml-2 flex items-center gap-2"><List size={16} className="text-slate-400"/> Active Deals ({allDeals.length})</h3>
                                {allDeals.length === 0 ? (
                                    <div className="text-center py-8 text-slate-400 text-sm italic">No opportunities found.</div>
                                ) : (
                                    allDeals.map((deal, idx) => (
                                        <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col gap-2">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-bold text-slate-900 dark:text-white text-base">{deal.product}</div>
                                                    <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                                                        <Building size={10} className="text-slate-400"/> {deal.location}
                                                        {deal.customerName && <><span className="text-slate-300">•</span> <UserIcon size={10} className="text-slate-400"/> {deal.customerName}</>}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-base">฿{deal.value.toLocaleString()}</div>
                                                    <div className={`text-[10px] px-2 py-0.5 rounded mt-1 inline-block font-bold ${getProbColor(deal.probability)} text-white shadow-sm`}>
                                                        {deal.probability}% Prob.
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center pt-3 border-t border-slate-50 dark:border-white/5 mt-1">
                                                <span className="text-[10px] px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 font-bold uppercase tracking-wide border border-indigo-100 dark:border-indigo-500/20">{deal.stage}</span>
                                                <span className="text-[10px] text-slate-400">{new Date(deal.date).toLocaleDateString('th-TH')}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default Reports;