
import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { GlassCard } from '../components/GlassCard';
import { getUserHistory, updatePipelineItem, getUserProfile, getAllUsers, getTeamMembers } from '../services/dbService';
import { AttendanceDay, PipelineData, UserProfile, AdminUser } from '../types';
import { Calendar, Clock, MapPin, User as UserIcon, FileText, ArrowDown, TrendingUp, DollarSign, Percent, Activity, Edit, X, Save, Loader2, Building, Users, ChevronDown, Filter } from 'lucide-react';

interface Props {
    user: User;
}

const Reports: React.FC<Props> = ({ user }) => {
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
                // 1. Check Role
                const profile = await getUserProfile(user.uid);
                const hasAccess = profile?.role === 'admin' || profile?.role === 'manager';
                setIsPrivileged(hasAccess);

                // 2. If Manager/Admin, fetch appropriate users
                if (hasAccess) {
                    if (profile?.role === 'admin') {
                         // Admin sees everyone
                        const users = await getAllUsers();
                        setTeamMembers(users);
                    } else {
                        // Manager sees only their team + themselves
                        const team = await getTeamMembers(user.uid);
                        setTeamMembers(team);
                    }
                }

                // 3. Fetch History (default to self)
                await fetchHistory(user.uid);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [user]);

    // Fetch history when target user changes
    const handleUserChange = async (newUserId: string) => {
        setTargetUserId(newUserId);
        
        // Update Display Name
        if (newUserId === user.uid) {
            setTargetUserName('My Reports');
        } else {
            const selectedUser = teamMembers.find(u => u.id === newUserId);
            setTargetUserName(selectedUser?.name || selectedUser?.email || 'User Reports');
        }

        setLoading(true);
        await fetchHistory(newUserId);
        setLoading(false);
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

    const handleEditPipeline = (dateId: string, index: number, item: PipelineData) => {
        setEditingPipeline({
            dateId,
            index,
            data: { ...item } // Clone
        });
    };

    const handleSavePipeline = async () => {
        if (!editingPipeline) return;
        setSaving(true);

        try {
            // 1. Find the specific day record locally to clone array
            const dayRecord = history.find(d => d.id === editingPipeline.dateId);
            if (!dayRecord || !dayRecord.report) return;

            // 2. Construct the new array
            const currentPipelineArray = Array.isArray(dayRecord.report.pipeline) 
                ? [...dayRecord.report.pipeline] 
                : dayRecord.report.pipeline ? [dayRecord.report.pipeline as any] : [];
            
            if (editingPipeline.index >= 0 && editingPipeline.index < currentPipelineArray.length) {
                currentPipelineArray[editingPipeline.index] = editingPipeline.data;
            }

            // 3. Update DB (Use targetUserId because manager might be editing someone else's report)
            await updatePipelineItem(targetUserId, editingPipeline.dateId, currentPipelineArray);

            // 4. Refresh UI
            await fetchHistory(targetUserId);
            setEditingPipeline(null);
        } catch (e) {
            console.error("Failed to update pipeline", e);
            alert("Failed to save changes");
        } finally {
            setSaving(false);
        }
    };

    const pipelineStages = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-enter pb-24">
            
            {/* Header Area */}
            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-end">
                    <div>
                        <h2 className="text-3xl font-bold text-white tracking-tight">{targetUserName}</h2>
                        <p className="text-slate-400 text-sm">Historical tracking and pipeline status</p>
                    </div>
                    <div className="bg-slate-800 px-3 py-1 rounded-full text-xs text-slate-300 border border-slate-700">
                        {history.length} Records
                    </div>
                </div>

                {/* Manager Filter Dropdown */}
                {isPrivileged && (
                    <GlassCard className="p-3 flex items-center gap-3 bg-slate-900/50 border-indigo-500/20">
                        <div className="bg-indigo-500/10 p-2 rounded-lg text-indigo-400">
                            <Users size={18} />
                        </div>
                        <div className="flex-1 relative">
                            <label className="block text-[10px] text-indigo-300 font-bold uppercase tracking-wider mb-0.5">
                                {teamMembers.length <= 1 ? 'Viewing Data For' : 'Select Team Member'}
                            </label>
                            <div className="relative">
                                <select 
                                    value={targetUserId}
                                    onChange={(e) => handleUserChange(e.target.value)}
                                    className="w-full bg-transparent text-white text-sm font-medium outline-none appearance-none cursor-pointer relative z-10 pr-8"
                                >
                                    <option value={user.uid} className="bg-slate-900">My Reports (Me)</option>
                                    {teamMembers.filter(u => u.id !== user.uid).map(member => (
                                        <option key={member.id} value={member.id} className="bg-slate-900">
                                            {member.name || member.email}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="absolute right-0 top-1 text-slate-500 pointer-events-none" />
                            </div>
                        </div>
                        <div className="h-8 w-[1px] bg-white/10 mx-2"></div>
                        <div className="text-xs text-slate-500 whitespace-nowrap">
                            {teamMembers.length} Members
                        </div>
                    </GlassCard>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center pt-20 text-slate-500 gap-2">
                    <Loader2 className="animate-spin" /> Loading data...
                </div>
            ) : (
                <div className="space-y-6">
                    {history.length === 0 && (
                        <div className="text-center py-10 text-slate-500 bg-slate-900/30 rounded-3xl border border-white/5 border-dashed">
                            No reports found for this user.
                        </div>
                    )}

                    {history.map((day, idx) => {
                        const dateObj = new Date(day.id);
                        const locations = Array.from(new Set(day.checkIns.map(c => c.location)));
                        
                        // Handle Array or Legacy Single Object for Pipeline
                        const pipelineItems = Array.isArray(day.report?.pipeline) 
                            ? day.report.pipeline 
                            : day.report?.pipeline ? [day.report.pipeline] : [];

                        // Handle Array or Legacy Single Object for MetWith
                        const contacts = Array.isArray(day.report?.metWith) 
                            ? day.report.metWith 
                            : day.report?.metWith ? [day.report.metWith] : [];

                        return (
                            <div key={day.id} className="relative pl-8 animate-enter" style={{animationDelay: `${idx * 50}ms`}}>
                                {/* Timeline Line */}
                                {idx !== history.length - 1 && (
                                    <div className="absolute left-[11px] top-8 bottom-[-24px] w-[2px] bg-slate-800"></div>
                                )}
                                
                                {/* Timeline Dot */}
                                <div className={`absolute left-0 top-2 w-6 h-6 rounded-full border-4 border-slate-950 ${day.checkOut ? 'bg-emerald-500' : 'bg-cyan-500 animate-pulse'}`}></div>

                                <GlassCard className="group">
                                    {/* Header */}
                                    <div className="flex justify-between items-start border-b border-white/5 pb-4 mb-4">
                                        <div>
                                            <div className="text-lg font-bold text-white">
                                                {dateObj.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })}
                                            </div>
                                            <div className="text-slate-500 text-xs mt-1 flex items-center gap-2">
                                                <Clock size={12} />
                                                {day.checkIns[0]?.timestamp.toDate().toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}
                                                <span className="text-slate-700 mx-1">•</span>
                                                {day.checkOut ? day.checkOut.toDate().toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'}) : 'Active'}
                                            </div>
                                        </div>
                                        <div className={`text-xs px-2 py-1 rounded border ${day.checkOut ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'}`}>
                                            {day.checkOut ? 'Completed' : 'On Going'}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        {/* Location Tags */}
                                        <div className="flex flex-wrap gap-2">
                                            {locations.map((loc, i) => (
                                                <span key={i} className="flex items-center gap-1 text-xs bg-slate-800 text-slate-300 px-2 py-1.5 rounded-md border border-white/5">
                                                    <MapPin size={10} className="text-cyan-400"/> {loc}
                                                </span>
                                            ))}
                                        </div>

                                        {/* AI Summary Box */}
                                        {day.report && (
                                            <div className="space-y-3">
                                                <div className="relative bg-slate-800/30 border border-white/5 rounded-xl p-4 overflow-hidden">
                                                    {contacts.length > 0 && (
                                                        <div className="flex flex-wrap gap-2 mb-2">
                                                            {contacts.map((contact, ci) => (
                                                                <span key={ci} className="flex items-center gap-1 text-xs bg-purple-500/10 text-purple-300 px-2 py-1 rounded border border-purple-500/20">
                                                                    <UserIcon size={10}/> {contact}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <p className="text-sm text-slate-400 leading-relaxed italic">
                                                        "{day.report.summary || 'No summary provided.'}"
                                                    </p>
                                                </div>

                                                {/* PIPELINE CARD STACK */}
                                                {pipelineItems.length > 0 && (
                                                    <div className="space-y-3 mt-2">
                                                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-300 uppercase tracking-wider">
                                                            <TrendingUp size={12}/> Sales Pipeline
                                                        </div>
                                                        {pipelineItems.map((item: any, pi: number) => (
                                                            <div key={pi} className="bg-slate-900/80 border border-white/10 rounded-xl p-0 relative overflow-hidden group/item shadow-lg hover:border-indigo-500/30 transition-all">
                                                                 {/* Gradient Left Border */}
                                                                 <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-600"></div>
                                                                 
                                                                 <div className="p-4">
                                                                     <div className="flex justify-between items-start mb-3">
                                                                         <div className="flex flex-col gap-1">
                                                                            {/* Opportunity ID / Tag */}
                                                                             <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                                                                                 Opportunity #{pi+1}
                                                                                 {item.isNew && <span className="bg-cyan-500 text-white text-[9px] px-1.5 py-0.5 rounded-sm">NEW</span>}
                                                                             </div>
                                                                             
                                                                             {/* Product Name */}
                                                                             <div className="text-white font-bold text-lg leading-tight">{item.product}</div>
                                                                             
                                                                             {/* Hospital Location */}
                                                                             <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-300 bg-slate-800 px-2 py-1 rounded-md border border-white/5 w-fit">
                                                                                 <Building size={12} className="text-cyan-400"/>
                                                                                 <span className="font-medium">{day.report?.hospital || 'Unknown Location'}</span>
                                                                             </div>
                                                                         </div>

                                                                         {/* Edit Button */}
                                                                         <button 
                                                                            onClick={() => handleEditPipeline(day.id, pi, item)}
                                                                            className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white hover:bg-indigo-600 transition-all border border-white/5"
                                                                         >
                                                                            <Edit size={14} />
                                                                         </button>
                                                                     </div>

                                                                     {/* Stats Grid */}
                                                                     <div className="grid grid-cols-2 gap-3 bg-white/5 rounded-lg p-3 border border-white/5">
                                                                         <div>
                                                                             <div className="text-[10px] text-slate-500 uppercase mb-0.5">Value</div>
                                                                             <div className="text-emerald-400 font-mono font-bold text-sm">฿{item.value.toLocaleString()}</div>
                                                                         </div>
                                                                         <div className="text-right">
                                                                              <div className="text-[10px] text-slate-500 uppercase mb-0.5">Stage</div>
                                                                              <div className="text-white font-medium text-sm">{item.stage}</div>
                                                                         </div>
                                                                         <div className="col-span-2 pt-1 border-t border-white/5 mt-1">
                                                                              <div className="flex justify-between text-[10px] text-slate-500 uppercase mb-1.5">
                                                                                 <span>Probability</span>
                                                                                 <span className={getProbColor(item.probability).replace('bg-', 'text-')}>{item.probability}%</span>
                                                                              </div>
                                                                              <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                                                                                 <div 
                                                                                    className={`h-full rounded-full ${getProbColor(item.probability)}`} 
                                                                                    style={{width: `${item.probability}%`}}
                                                                                 ></div>
                                                                             </div>
                                                                         </div>
                                                                     </div>
                                                                 </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </GlassCard>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* EDIT MODAL */}
            {editingPipeline && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
                    <GlassCard className="w-full max-w-md relative border-indigo-500/30 bg-slate-900">
                        <button 
                            onClick={() => setEditingPipeline(null)}
                            className="absolute top-4 right-4 text-slate-500 hover:text-white"
                        >
                            <X size={20} />
                        </button>
                        
                        <h3 className="text-lg font-bold text-white mb-1">Edit Opportunity</h3>
                        <p className="text-xs text-slate-400 mb-6">Update deal information and probability.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-indigo-200/70 mb-1.5">Product / Solution</label>
                                <input 
                                    type="text"
                                    value={editingPipeline.data.product}
                                    onChange={(e) => setEditingPipeline({...editingPipeline, data: {...editingPipeline.data, product: e.target.value}})}
                                    className="w-full bg-black/30 border border-indigo-500/30 rounded-xl p-3 text-white outline-none focus:border-indigo-400 text-sm"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-indigo-200/70 mb-1.5">Value (THB)</label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-3 text-indigo-400"><DollarSign size={14}/></div>
                                        <input 
                                            type="number"
                                            value={editingPipeline.data.value}
                                            onChange={(e) => setEditingPipeline({...editingPipeline, data: {...editingPipeline.data, value: parseFloat(e.target.value)}})}
                                            className="w-full bg-black/30 border border-indigo-500/30 rounded-xl py-3 pl-8 pr-3 text-white outline-none focus:border-indigo-400 text-sm"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-indigo-200/70 mb-1.5">Stage</label>
                                    <select 
                                        value={editingPipeline.data.stage}
                                        onChange={(e) => setEditingPipeline({...editingPipeline, data: {...editingPipeline.data, stage: e.target.value}})}
                                        className="w-full bg-black/30 border border-indigo-500/30 rounded-xl py-3 px-3 text-white outline-none focus:border-indigo-400 appearance-none text-sm"
                                    >
                                        {pipelineStages.map(s => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-xs text-indigo-200/70 mb-2">
                                    <span>Probability</span>
                                    <span className="font-bold text-indigo-300">{editingPipeline.data.probability}%</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="100" 
                                    step="5"
                                    value={editingPipeline.data.probability} 
                                    onChange={(e) => setEditingPipeline({...editingPipeline, data: {...editingPipeline.data, probability: parseInt(e.target.value)}})}
                                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                            </div>

                            <button 
                                onClick={handleSavePipeline}
                                disabled={saving}
                                className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
                            >
                                {saving ? <Loader2 className="animate-spin"/> : <Save size={18} />}
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </GlassCard>
                </div>
            )}
        </div>
    );
};

export default Reports;
