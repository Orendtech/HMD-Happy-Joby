import React, { useEffect, useState, useRef } from 'react';
import { User } from 'firebase/auth';
import { Navigation, Plus, LogOut, Calendar, ChevronRight, Sparkles, Map as MapIcon, X, Search, Check, Flame, Trophy, Zap, TrendingUp, DollarSign, Loader2, ArrowLeft, ChevronDown, ChevronUp, UserPlus, Save } from 'lucide-react';
import { MapDisplay } from '../components/MapDisplay';
import { getUserProfile, getTodayAttendance, checkIn, checkOut, addHospital, addCustomer } from '../services/dbService';
import { UserProfile, AttendanceDay, DailyReport, PipelineData, CheckInRecord, VisitReport } from '../types';
import { GlassCard } from '../components/GlassCard';

interface Props {
    user: User;
}

// Internal State for a single visit report draft
interface VisitDraft {
    summary: string;
    metWithStack: string[];
    pipelineStack: PipelineData[];
}

// Particle Interface for Animation
interface XpParticle {
    id: number;
    xp: number;
}

const getRankTitle = (level: number) => {
    if (level >= 9) return { title: 'LEGEND', color: 'text-amber-500 dark:text-amber-400' };
    if (level >= 7) return { title: 'ELITE', color: 'text-rose-500 dark:text-rose-400' };
    if (level >= 5) return { title: 'RANGER', color: 'text-purple-500 dark:text-purple-400' };
    if (level >= 3) return { title: 'SCOUT', color: 'text-cyan-500 dark:text-cyan-400' };
    return { title: 'ROOKIE', color: 'text-slate-400 dark:text-slate-400' };
};

const TimeAttendance: React.FC<Props> = ({ user }) => {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [todayData, setTodayData] = useState<AttendanceDay | null>(null);
    const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
    const [loadingLoc, setLoadingLoc] = useState(false);
    
    // Location Selection State
    const [selectedPlace, setSelectedPlace] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [statusMsg, setStatusMsg] = useState('');
    const [time, setTime] = useState(new Date());
    
    // --- CHECKOUT REPORT STATE (MULTI-VISIT) ---
    const [showReportModal, setShowReportModal] = useState(false);
    const [visitDrafts, setVisitDrafts] = useState<Record<number, VisitDraft>>({});
    const [expandedVisitIdx, setExpandedVisitIdx] = useState<number>(0); 
    
    // Contact Search & Add State
    const [contactSearch, setContactSearch] = useState('');
    const [isContactDropdownOpen, setIsContactDropdownOpen] = useState(false);
    const [showAddContactView, setShowAddContactView] = useState(false); // Full Page Toggle
    const [newContact, setNewContact] = useState({ name: '', department: '', phone: '' });
    const contactDropdownRef = useRef<HTMLDivElement>(null);
    
    // Pipeline Form State (Shared)
    const [dealMode, setDealMode] = useState<'new' | 'update'>('new');
    const [selectedExistingDealId, setSelectedExistingDealId] = useState('');
    const [pipelineProduct, setPipelineProduct] = useState('');
    const [pipelineValue, setPipelineValue] = useState('');
    const [pipelineStage, setPipelineStage] = useState('Prospecting');
    const [pipelineProb, setPipelineProb] = useState(20);
    const [pipelineCustomer, setPipelineCustomer] = useState(''); // New State for Customer Link

    // Gamification
    const [xpParticles, setXpParticles] = useState<XpParticle[]>([]);
    const [isHudBouncing, setIsHudBouncing] = useState(false);
    const [showLevelUp, setShowLevelUp] = useState(false);
    const [newLevelDisplay, setNewLevelDisplay] = useState(0);

    const refreshData = async () => {
        const p = await getUserProfile(user.uid);
        const a = await getTodayAttendance(user.uid);
        setProfile(p);
        setTodayData(a);

        // Initialize Drafts
        if (a && a.checkIns.length > 0) {
            setVisitDrafts(prev => {
                const newDrafts = { ...prev };
                a.checkIns.forEach((_, idx) => {
                    if (!newDrafts[idx]) {
                        newDrafts[idx] = { summary: '', metWithStack: [], pipelineStack: [] };
                    }
                });
                return newDrafts;
            });
        }
    };

    useEffect(() => {
        refreshData();
        getLocation();
        const timer = setInterval(() => setTime(new Date()), 1000);
        const handleClickOutside = (event: MouseEvent) => { 
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsDropdownOpen(false); 
            if (contactDropdownRef.current && !contactDropdownRef.current.contains(event.target as Node)) setIsContactDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => { clearInterval(timer); document.removeEventListener('mousedown', handleClickOutside); };
    }, [user]);

    const getLocation = () => {
        setLoadingLoc(true);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => { setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLoadingLoc(false); },
                (err) => { setStatusMsg('GPS Access Denied'); setLoadingLoc(false); },
                { enableHighAccuracy: true }
            );
        } else { setStatusMsg('GPS Not Supported'); setLoadingLoc(false); }
    };

    const handleCheckIn = async () => {
        if (!location) { getLocation(); return; }
        if (!selectedPlace) { setStatusMsg('กรุณาเลือกสถานที่ (Select Location)'); return; }
        try {
            const result = await checkIn(user.uid, selectedPlace, location.lat, location.lng);
            setStatusMsg(''); 
            const newParticle = { id: Date.now(), xp: result.earnedXp };
            setXpParticles(prev => [...prev, newParticle]);
            setSelectedPlace(''); setSearchQuery('');
            setTimeout(() => { setXpParticles(prev => prev.filter(p => p.id !== newParticle.id)); }, 1200);
            setTimeout(() => { setIsHudBouncing(true); setTimeout(() => setIsHudBouncing(false), 300); refreshData(); }, 900);
            if (result.isLevelUp) { setTimeout(() => { setNewLevelDisplay(result.newLevel); setShowLevelUp(true); }, 1000); }
        } catch (e) { setStatusMsg('Check-in failed'); }
    };

    // --- DRAFT MANIPULATION ---
    const updateDraft = (idx: number, field: keyof VisitDraft, value: any) => {
        setVisitDrafts(prev => ({
            ...prev,
            [idx]: { ...prev[idx], [field]: value }
        }));
    };

    const addContactToDraft = (idx: number) => {
        const currentStack = visitDrafts[idx]?.metWithStack || [];
        if (contactSearch && !currentStack.includes(contactSearch)) {
            updateDraft(idx, 'metWithStack', [...currentStack, contactSearch]);
            setContactSearch(''); // Clear
            setIsContactDropdownOpen(false);
        }
    };
    const removeContactFromDraft = (idx: number, name: string) => {
        const currentStack = visitDrafts[idx]?.metWithStack || [];
        updateDraft(idx, 'metWithStack', currentStack.filter(c => c !== name));
    };

    const handleSaveNewContact = async () => {
        if (!newContact.name) return;
        const currentHospital = todayData?.checkIns[expandedVisitIdx]?.location || '';
        try {
            await addCustomer(user.uid, { ...newContact, hospital: currentHospital });
            await refreshData();
            
            // Auto select and add to draft
            setContactSearch('');
            updateDraft(expandedVisitIdx, 'metWithStack', [
                ...(visitDrafts[expandedVisitIdx]?.metWithStack || []),
                newContact.name
            ]);
            
            setShowAddContactView(false);
            setNewContact({ name: '', department: '', phone: '' });
        } catch (e) {
            console.error("Failed to add customer", e);
        }
    };

    const addPipelineToDraft = (idx: number) => {
        if (!pipelineProduct || !pipelineValue) return;
        const newItem: PipelineData = {
            id: dealMode === 'update' ? selectedExistingDealId : undefined,
            product: pipelineProduct,
            value: parseFloat(pipelineValue) || 0,
            stage: pipelineStage,
            probability: pipelineProb,
            isNew: dealMode === 'new',
            customerName: pipelineCustomer || undefined // Link to customer
        };
        const currentStack = visitDrafts[idx]?.pipelineStack || [];
        // Remove if exists (update)
        const filteredStack = currentStack.filter(p => p.id !== newItem.id || !p.id);
        updateDraft(idx, 'pipelineStack', [...filteredStack, newItem]);
        
        // Reset Form
        setPipelineProduct(''); 
        setPipelineValue(''); 
        setPipelineStage('Prospecting'); 
        setPipelineProb(20); 
        setDealMode('new'); 
        setSelectedExistingDealId('');
        setPipelineCustomer('');
    };

    const removePipelineFromDraft = (idx: number, pipeIdx: number) => {
        const currentStack = visitDrafts[idx]?.pipelineStack || [];
        const newStack = [...currentStack];
        newStack.splice(pipeIdx, 1);
        updateDraft(idx, 'pipelineStack', newStack);
    };

    const handleExistingDealSelect = (dealId: string) => {
        const deal = profile?.activePipeline?.find(p => p.id === dealId);
        setSelectedExistingDealId(dealId);
        if (deal) { 
            setPipelineProduct(deal.product); 
            setPipelineValue(deal.value.toString()); 
            setPipelineStage(deal.stage); 
            setPipelineProb(deal.probability);
            setPipelineCustomer(deal.customerName || ''); 
        }
    };

    const confirmCheckOut = async () => {
         try {
            if (!todayData?.checkIns) return;
            
            const visits: VisitReport[] = todayData.checkIns.map((ci, idx) => {
                const draft = visitDrafts[idx];
                return {
                    location: ci.location,
                    checkInTime: ci.timestamp,
                    summary: draft?.summary || '',
                    metWith: draft?.metWithStack || [],
                    pipeline: draft?.pipelineStack || []
                };
            });

            const reportData: DailyReport = { visits };
            await checkOut(user.uid, reportData);
            
            setStatusMsg('Shift ended & reports saved.');
            setShowReportModal(false);
            refreshData();
        } catch (e) { setStatusMsg('Check-out failed'); }
    };

    // Helpers
    const filteredLocations = profile?.hospitals.filter(h => h.toLowerCase().includes(searchQuery.toLowerCase())) || [];
    const handleSelectLocation = (loc: string) => { setSelectedPlace(loc); setSearchQuery(loc); setIsDropdownOpen(false); };
    const handleAddNewLocation = async () => { if (!searchQuery.trim()) return; try { await addHospital(user.uid, searchQuery.trim()); await refreshData(); handleSelectLocation(searchQuery.trim()); } catch (e) { setStatusMsg('Failed to add new location'); } };

    const isCheckedInToday = todayData && todayData.checkIns.length > 0;
    const isCheckedOut = todayData && !!todayData.checkOut;
    const currentStage = isCheckedOut ? 'completed' : isCheckedInToday ? 'working' : 'idle';
    const lastCheckInLocation = todayData?.checkIns.length ? todayData.checkIns[todayData.checkIns.length - 1].location : selectedPlace;
    
    const getFilteredCustomers = (visitLocation: string) => {
        const all = (profile?.customers || []).filter(c => c.hospital === visitLocation || c.hospital === 'All');
        if (!contactSearch) return all;
        return all.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()));
    };

    const activeDeals = profile?.activePipeline || [];
    const currentLevel = profile?.level || 1;
    const currentXP = profile?.xp || 0;
    const getNextLevelXP = (lvl: number) => { return lvl === 1 ? 100 : lvl * lvl * 100; };
    const nextLevelXP = getNextLevelXP(currentLevel);
    const progressPercent = Math.min(100, Math.max(0, ((currentXP - (getNextLevelXP(currentLevel - 1) || 0)) / (nextLevelXP - (getNextLevelXP(currentLevel - 1) || 0))) * 100));
    const rank = getRankTitle(currentLevel);
    const pipelineStages = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

    // --- CHECKOUT REPORT WIZARD ---
    if (showReportModal) {
        
        // SUB-VIEW: ADD CONTACT FULL PAGE
        if (showAddContactView) {
            return (
                <div className="max-w-2xl mx-auto space-y-6 animate-enter pb-10 pt-4 px-4">
                    {/* Header */}
                    <div className="flex items-center gap-4 sticky top-0 bg-[#F5F5F7] dark:bg-[#020617] z-20 py-2">
                        <button 
                            onClick={() => setShowAddContactView(false)} 
                            className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                               <UserPlus className="text-purple-500" size={24}/> New Contact
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Adding person at {todayData?.checkIns[expandedVisitIdx]?.location}</p>
                        </div>
                    </div>

                    {/* Form Card */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[24px] p-6 shadow-sm space-y-5">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Full Name</label>
                            <input 
                                value={newContact.name} 
                                onChange={e => setNewContact({...newContact, name: e.target.value})} 
                                className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-slate-900 dark:text-white outline-none focus:border-purple-500 text-base font-medium" 
                                placeholder="e.g. Dr. Somsak" 
                                autoFocus
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Department / Role</label>
                            <input 
                                value={newContact.department} 
                                onChange={e => setNewContact({...newContact, department: e.target.value})} 
                                className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-slate-900 dark:text-white outline-none focus:border-purple-500 text-base" 
                                placeholder="e.g. OPD, Purchasing" 
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Phone Number</label>
                            <input 
                                value={newContact.phone} 
                                onChange={e => setNewContact({...newContact, phone: e.target.value})} 
                                className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-slate-900 dark:text-white outline-none focus:border-purple-500 text-base" 
                                placeholder="08x-xxx-xxxx (Optional)" 
                            />
                        </div>
                    </div>

                    <button 
                        onClick={handleSaveNewContact} 
                        disabled={!newContact.name} 
                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 transform active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                    >
                        <Save size={20} /> Save & Select Contact
                    </button>
                </div>
            );
        }

        // MAIN VIEW: VISIT LIST
        return (
            <div className="max-w-2xl mx-auto space-y-6 animate-enter pb-32 pt-4 px-4">
                 {/* Header */}
                <div className="flex items-center gap-4 sticky top-0 bg-[#F5F5F7] dark:bg-[#020617] z-20 py-2">
                    <button onClick={() => setShowReportModal(false)} className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                           <Sparkles className="text-purple-500" size={24}/> Checkout Report
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Summarize activity for {todayData?.checkIns.length} location(s)</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {todayData?.checkIns.map((ci, idx) => {
                        const isExpanded = expandedVisitIdx === idx;
                        const draft = visitDrafts[idx] || { summary: '', metWithStack: [], pipelineStack: [] };
                        const customers = getFilteredCustomers(ci.location);

                        return (
                            <div key={idx} className={`bg-white dark:bg-slate-900 border transition-all duration-300 rounded-[24px] overflow-hidden ${isExpanded ? 'border-cyan-400 dark:border-cyan-500 shadow-xl scale-[1.01]' : 'border-slate-200 dark:border-white/10 opacity-80 hover:opacity-100'}`}>
                                {/* Header of Card */}
                                <div 
                                    onClick={() => { setExpandedVisitIdx(isExpanded ? -1 : idx); setContactSearch(''); setIsContactDropdownOpen(false); }}
                                    className="p-4 flex items-center justify-between cursor-pointer bg-slate-50 dark:bg-white/5"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${isExpanded ? 'bg-cyan-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900 dark:text-white text-base">{ci.location}</div>
                                            <div className="text-xs text-slate-500">{ci.timestamp.toDate().toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}</div>
                                        </div>
                                    </div>
                                    {isExpanded ? <ChevronUp className="text-cyan-500"/> : <ChevronDown className="text-slate-400"/>}
                                </div>

                                {/* Expanded Content */}
                                {isExpanded && (
                                    <div className="p-5 space-y-6 animate-enter">
                                        
                                        {/* Met With - SEARCHABLE + QUICK ADD */}
                                        <div className="space-y-3" ref={contactDropdownRef}>
                                             <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Who did you meet?</label>
                                             <div className="flex gap-2 relative">
                                                 <div className="relative flex-1">
                                                    <Search className="absolute left-3 top-3 text-slate-400" size={16} />
                                                    <input 
                                                        type="text"
                                                        value={contactSearch}
                                                        onChange={(e) => { setContactSearch(e.target.value); setIsContactDropdownOpen(true); }}
                                                        onFocus={() => setIsContactDropdownOpen(true)}
                                                        placeholder={`Search customer at ${ci.location}...`}
                                                        className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-slate-900 dark:text-white outline-none focus:border-purple-500 text-sm"
                                                    />
                                                    
                                                    {/* Custom Dropdown */}
                                                    {isContactDropdownOpen && (
                                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                                                            {customers.map((c, i) => (
                                                                <div 
                                                                    key={i} 
                                                                    onClick={() => { setContactSearch(c.name); setIsContactDropdownOpen(false); }}
                                                                    className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer text-sm border-b border-slate-100 dark:border-white/5 last:border-0 flex justify-between items-center"
                                                                >
                                                                    <span className="text-slate-900 dark:text-white">{c.name}</span>
                                                                    <span className="text-xs text-slate-500">{c.department}</span>
                                                                </div>
                                                            ))}
                                                            {customers.length === 0 && !contactSearch && (
                                                                <div className="px-4 py-3 text-xs text-slate-400 italic text-center">Type to search...</div>
                                                            )}
                                                            {contactSearch && (
                                                                <div 
                                                                    onClick={() => { setNewContact({ name: contactSearch, department: '', phone: '' }); setShowAddContactView(true); setIsContactDropdownOpen(false); }}
                                                                    className="px-4 py-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 cursor-pointer text-sm flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold bg-slate-50 dark:bg-black/20"
                                                                >
                                                                    <Plus size={14} /> Create new contact "{contactSearch}"
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <button onClick={() => addContactToDraft(idx)} disabled={!contactSearch} className="bg-purple-500 text-white p-2.5 rounded-xl hover:bg-purple-600 disabled:opacity-50 shadow-lg shadow-purple-500/20 transition-all active:scale-95"><Plus size={20}/></button>
                                            </div>
                                            {draft.metWithStack.length > 0 && (
                                                <div className="flex flex-wrap gap-2">
                                                    {draft.metWithStack.map((name, i) => (
                                                        <span key={i} className="flex items-center gap-1 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 text-xs px-2 py-1 rounded-lg border border-purple-100 dark:border-purple-500/20">
                                                            {name} <button onClick={() => removeContactFromDraft(idx, name)}><X size={12}/></button>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Summary */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Outcome / Summary</label>
                                            <textarea 
                                                value={draft.summary}
                                                onChange={(e) => updateDraft(idx, 'summary', e.target.value)}
                                                placeholder="What happened at this location?"
                                                rows={3}
                                                className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-cyan-500 text-sm resize-none"
                                            />
                                        </div>

                                        {/* Pipeline for THIS location */}
                                        <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-white/5">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold text-indigo-500 uppercase tracking-wide flex items-center gap-1"><TrendingUp size={14}/> Opportunities at {ci.location}</label>
                                            </div>

                                            {/* Pipeline List */}
                                            {draft.pipelineStack.length > 0 && (
                                                <div className="space-y-2">
                                                    {draft.pipelineStack.map((item, pIdx) => (
                                                        <div key={pIdx} className="flex justify-between items-center p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-bold text-slate-900 dark:text-white text-sm">{item.product}</span>
                                                                    {item.customerName && <span className="text-[10px] text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-500/20">{item.customerName}</span>}
                                                                </div>
                                                                <div className="text-xs text-slate-500">{item.stage} • ฿{item.value.toLocaleString()}</div>
                                                            </div>
                                                            <button onClick={() => removePipelineFromDraft(idx, pIdx)} className="text-slate-400 hover:text-rose-500"><X size={16}/></button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Pipeline Adder (Mini Form) */}
                                            <div className="bg-slate-50 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-200 dark:border-white/5 space-y-3">
                                                 {/* Customer Link Select */}
                                                 <div>
                                                     <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Linked Contact</label>
                                                     <select 
                                                        value={pipelineCustomer} 
                                                        onChange={(e) => setPipelineCustomer(e.target.value)}
                                                        className="w-full p-2 rounded-lg bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs outline-none text-slate-700 dark:text-white"
                                                     >
                                                         <option value="">-- Select Contact (Optional) --</option>
                                                         {draft.metWithStack.map(c => <option key={c} value={c}>{c}</option>)}
                                                     </select>
                                                 </div>

                                                 <div className="grid grid-cols-2 gap-2">
                                                     <input value={pipelineProduct} onChange={e => setPipelineProduct(e.target.value)} placeholder="Product" className="w-full p-2 rounded-lg bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs outline-none focus:border-indigo-500"/>
                                                     <input type="number" value={pipelineValue} onChange={e => setPipelineValue(e.target.value)} placeholder="Value (THB)" className="w-full p-2 rounded-lg bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs outline-none focus:border-indigo-500"/>
                                                 </div>
                                                 <div className="grid grid-cols-2 gap-2">
                                                     <select value={pipelineStage} onChange={e => setPipelineStage(e.target.value)} className="w-full p-2 rounded-lg bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs outline-none">
                                                         {pipelineStages.map(s => <option key={s} value={s}>{s}</option>)}
                                                     </select>
                                                     <div className="flex items-center gap-2 px-2 text-xs text-slate-500">
                                                         <span>Prob: {pipelineProb}%</span>
                                                         <input type="range" min="0" max="100" step="10" value={pipelineProb} onChange={e => setPipelineProb(parseInt(e.target.value))} className="w-16 accent-indigo-500"/>
                                                     </div>
                                                 </div>
                                                 <button onClick={() => addPipelineToDraft(idx)} disabled={!pipelineProduct || !pipelineValue} className="w-full py-2 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-xs font-bold rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-500/30 transition-colors disabled:opacity-50">
                                                     + Add Opportunity to {ci.location}
                                                 </button>
                                            </div>
                                        </div>

                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="pt-4 pb-10">
                    <button 
                        onClick={confirmCheckOut}
                        className="w-full bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-white font-bold py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 transform active:scale-95 transition-all"
                    >
                        <Check size={24} /> Submit All Reports & Check Out
                    </button>
                    <p className="text-center text-xs text-slate-400 mt-3">This will end your shift and save reports for {todayData?.checkIns.length} locations.</p>
                </div>
            </div>
        );
    }

    // ... (Main UI Logic kept same)
    return (
        <div className="max-w-lg mx-auto space-y-5 animate-enter pb-24">
            <div className={`
                bg-white dark:bg-slate-900/60 backdrop-blur-xl 
                border border-slate-200 dark:border-white/10 
                rounded-[32px] p-4 shadow-sm dark:shadow-xl 
                transition-all duration-300 
                ${isHudBouncing ? 'scale-105 ring-2 ring-cyan-400/50' : ''}
            `}>
                <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-white/5 relative shadow-inner">
                        <span className="text-2xl font-black text-slate-800 dark:text-white">{currentLevel}</span>
                        <div className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-cyan-500 ${isHudBouncing ? 'animate-ping' : ''}`}></div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1.5">
                             <span className={`text-xs font-black tracking-widest uppercase ${rank.color}`}>{rank.title}</span>
                             <span className={`text-[10px] text-slate-500 dark:text-slate-400 font-medium transition-colors ${isHudBouncing ? 'text-cyan-500 font-bold' : ''}`}>{currentXP} XP</span>
                        </div>
                        <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative border border-slate-200 dark:border-transparent">
                            <div style={{width: `${progressPercent}%`}} className={`h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full shadow-sm transition-all duration-1000 ${isHudBouncing ? 'brightness-125' : ''}`}></div>
                        </div>
                        <div className="text-[9px] text-slate-400 mt-1 font-medium text-right">{Math.floor(nextLevelXP - currentXP)} XP to next level</div>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/50 px-3 py-2 rounded-2xl border border-slate-100 dark:border-white/5">
                        <div className="flex items-center gap-1">
                            <Flame size={16} className={`${(profile?.currentStreak || 0) > 0 ? 'text-orange-500 fill-orange-500' : 'text-slate-400'}`} />
                            <span className="text-lg font-bold text-slate-800 dark:text-white">{profile?.currentStreak || 0}</span>
                        </div>
                        <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Day Streak</div>
                    </div>
                </div>
            </div>

            {xpParticles.map((p) => (
                <div key={p.id} className="animate-fly-xp flex items-center justify-center">
                    <div className="flex flex-col items-center">
                        <div className="bg-gradient-to-br from-amber-400 to-orange-500 text-white font-black text-3xl px-6 py-3 rounded-full shadow-[0_10px_30px_rgba(245,158,11,0.4)] flex items-center gap-2 border-2 border-white/40 backdrop-blur-md">
                            <Zap className="fill-white animate-pulse" size={28} /> +{p.xp}
                        </div>
                        <span className="text-amber-500 dark:text-amber-200 font-bold text-sm mt-2 shadow-sm">XP COLLECTED!</span>
                    </div>
                </div>
            ))}

            <div className="flex justify-between items-end px-2 pt-2">
                <div>
                    <div className="text-4xl font-bold text-slate-900 dark:text-white tracking-tighter leading-none">{time.toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">{time.toLocaleDateString('en-US', {weekday: 'long', day: 'numeric', month: 'short'})}</div>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-[10px] font-bold border uppercase tracking-wider shadow-sm ${
                    currentStage === 'working' ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-200 dark:border-emerald-500/50 text-emerald-600 dark:text-emerald-400' :
                    currentStage === 'completed' ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400' :
                    'bg-cyan-50 dark:bg-cyan-500/20 border-cyan-200 dark:border-cyan-500/50 text-cyan-600 dark:text-cyan-400'
                }`}>
                    {currentStage === 'working' ? 'ON DUTY' : currentStage === 'completed' ? 'OFF DUTY' : 'READY'}
                </div>
            </div>

            <div className="relative rounded-[32px] border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl dark:shadow-2xl overflow-hidden" ref={dropdownRef}>
                <div className="h-48 w-full relative">
                    {location ? (
                        <MapDisplay 
                            lat={location.lat} 
                            lng={location.lng} 
                            markers={[{
                                lat: location.lat,
                                lng: location.lng,
                                text: profile?.name || user.email || 'My Location',
                                photo: profile?.photoBase64
                            }]}
                            className="h-full w-full opacity-90 transition-all duration-500" 
                            zoom={15} 
                        />
                    ) : (
                        <div className="h-full w-full bg-slate-100 dark:bg-slate-950 flex items-center justify-center text-slate-500 text-xs gap-2">
                            <Navigation size={14} className="animate-spin" /> Acquiring GPS...
                        </div>
                    )}
                    <button onClick={getLocation} className="absolute top-3 right-3 bg-white dark:bg-slate-900/80 p-2 rounded-full text-slate-500 dark:text-slate-300 hover:text-cyan-500 shadow-md border border-slate-100 dark:border-white/10 z-10">
                        <Navigation size={16} />
                    </button>
                </div>
                
                <div className="absolute bottom-4 left-4 right-4 z-20">
                    <div className="relative group shadow-lg rounded-2xl">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search size={18} className="text-slate-400 dark:text-slate-400" />
                        </div>
                        <input 
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSearchQuery(val);
                                setIsDropdownOpen(val.length > 0);
                                if(val === '') setSelectedPlace('');
                            }}
                            onFocus={() => { if (searchQuery.length > 0) setIsDropdownOpen(true); }}
                            placeholder="Select location to check-in..."
                            className="block w-full pl-11 pr-4 py-4 bg-white dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all text-sm font-medium"
                        />
                        {searchQuery && (
                            <button onClick={() => {setSearchQuery(''); setSelectedPlace(''); setIsDropdownOpen(false);}} className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-rose-500">
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    {isDropdownOpen && (
                        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-slate-900/95 backdrop-blur border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-50 max-h-52 overflow-y-auto">
                            {filteredLocations.map((loc, idx) => (
                                <button key={idx} onClick={() => handleSelectLocation(loc)} className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 text-sm flex justify-between items-center border-b border-slate-100 dark:border-white/5 last:border-0">
                                    {loc}
                                    {selectedPlace === loc && <Check size={14} className="text-cyan-500" />}
                                </button>
                            ))}
                            {filteredLocations.length === 0 && searchQuery && (
                                <button onClick={handleAddNewLocation} className="w-full text-left px-4 py-3 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 text-sm flex items-center gap-2 border-t border-slate-100 dark:border-white/5">
                                    <Plus size={14} /> Add new: "{searchQuery}"
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <button 
                    onClick={handleCheckIn}
                    disabled={isCheckedOut}
                    className={`relative group h-32 rounded-[32px] flex flex-col items-center justify-center transition-all duration-300 overflow-hidden ${
                        isCheckedOut 
                        ? 'bg-slate-100 dark:bg-slate-800 opacity-50 cursor-not-allowed text-slate-400' 
                        : 'bg-gradient-to-br from-emerald-400 to-emerald-600 dark:from-emerald-600 dark:to-emerald-800 shadow-[0_10px_30px_-10px_rgba(52,211,153,0.4)] hover:shadow-[0_15px_40px_-10px_rgba(52,211,153,0.6)] active:scale-95'
                    }`}
                >
                    <Plus size={36} className={`${isCheckedOut ? 'text-slate-400' : 'text-white'} mb-2`} />
                    <span className={`${isCheckedOut ? 'text-slate-400' : 'text-white'} font-black text-xl tracking-tight`}>CHECK IN</span>
                    <span className={`${isCheckedOut ? 'text-slate-400' : 'text-emerald-100'} text-[10px] font-bold uppercase tracking-wider mt-1 opacity-80`}>Start Task</span>
                </button>

                <button 
                    onClick={() => setShowReportModal(true)}
                    disabled={!isCheckedInToday || isCheckedOut}
                    className={`relative group h-32 rounded-[32px] flex flex-col items-center justify-center transition-all duration-300 overflow-hidden ${
                        !isCheckedInToday || isCheckedOut 
                        ? 'bg-slate-100 dark:bg-slate-800 opacity-50 cursor-not-allowed border border-slate-200 dark:border-white/5 text-slate-400' 
                        : 'bg-gradient-to-br from-rose-400 to-rose-600 dark:from-rose-600 dark:to-rose-800 shadow-[0_10px_30px_-10px_rgba(244,63,94,0.4)] hover:shadow-[0_15px_40px_-10px_rgba(244,63,94,0.6)] active:scale-95'
                    }`}
                >
                    <LogOut size={36} className={`${!isCheckedInToday || isCheckedOut ? 'text-slate-400' : 'text-white'} mb-2`} />
                    <span className={`${!isCheckedInToday || isCheckedOut ? 'text-slate-400' : 'text-white'} font-black text-xl tracking-tight`}>CHECK OUT</span>
                    <span className={`${!isCheckedInToday || isCheckedOut ? 'text-slate-400' : 'text-rose-100'} text-[10px] font-bold uppercase tracking-wider mt-1 opacity-80`}>Finish Task</span>
                </button>
            </div>
            
            {statusMsg && (
                <div className="text-center text-cyan-600 dark:text-cyan-400 text-sm py-3 bg-cyan-50 dark:bg-cyan-950/30 rounded-2xl border border-cyan-100 dark:border-cyan-500/20 animate-fade-in-up font-medium">
                    {statusMsg}
                </div>
            )}

            <div className="pt-2">
                <div className="flex items-center gap-2 mb-4 px-2 opacity-60">
                    <Calendar size={14} className="text-slate-500 dark:text-slate-400" />
                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Today's Journey</h3>
                </div>
                
                <div className="relative pl-4 space-y-4 border-l border-slate-200 dark:border-slate-800 ml-3">
                    {todayData?.checkIns.map((ci, idx) => (
                        <div key={idx} className="relative pl-6 animate-enter" style={{animationDelay: `${idx * 50}ms`}}>
                            <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] ring-4 ring-white dark:ring-slate-950"></div>
                            <div className="flex justify-between items-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-4 rounded-2xl shadow-sm">
                                <div>
                                    <div className="text-slate-900 dark:text-white font-bold text-sm">{ci.location}</div>
                                    <div className="text-emerald-500 text-[10px] font-bold uppercase mt-0.5">Checked In</div>
                                </div>
                                <div className="text-slate-500 dark:text-slate-400 font-mono text-xs bg-slate-50 dark:bg-black/20 px-2 py-1 rounded-lg">
                                    {ci.timestamp.toDate().toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}
                                </div>
                            </div>
                        </div>
                    ))}
                    {todayData?.checkOut && (
                        <div className="relative pl-6 animate-enter">
                            <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)] ring-4 ring-white dark:ring-slate-950"></div>
                            <div className="flex justify-between items-center bg-rose-50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-500/20 p-4 rounded-2xl shadow-sm">
                                <div>
                                    <div className="text-slate-900 dark:text-slate-300 font-bold text-sm">Shift Ended</div>
                                    <div className="text-rose-500 dark:text-rose-400 text-[10px] font-bold uppercase mt-0.5">Checked Out</div>
                                </div>
                                <div className="text-rose-500 dark:text-rose-400/70 font-mono text-xs bg-rose-100 dark:bg-rose-950/30 px-2 py-1 rounded-lg">
                                    {todayData.checkOut.toDate().toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}
                                </div>
                            </div>
                        </div>
                    )}
                    {!todayData?.checkIns.length && (
                        <div className="pl-6 text-slate-400 text-xs italic">Ready to start your day...</div>
                    )}
                </div>
            </div>

            {showLevelUp && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white/90 dark:bg-black/90 backdrop-blur-xl p-6 animate-enter">
                    <div className="text-center relative">
                         <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-500 blur-[80px] opacity-20 dark:opacity-30 animate-pulse"></div>
                        <div className="relative z-10">
                            <Trophy size={80} className="text-amber-500 dark:text-amber-400 mx-auto mb-4 drop-shadow-xl" />
                            <h2 className="text-5xl font-black text-slate-900 dark:text-white italic mb-2 tracking-tighter drop-shadow-sm">LEVEL UP!</h2>
                            <p className="text-cyan-600 dark:text-cyan-300 text-xl font-bold mb-8 tracking-wide">Welcome to Level {newLevelDisplay}</p>
                            <button 
                                onClick={() => setShowLevelUp(false)}
                                className="px-10 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-black rounded-full hover:scale-110 transition-transform shadow-xl"
                            >
                                CONTINUE
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimeAttendance;