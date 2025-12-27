
import React, { useEffect, useState, useRef } from 'react';
import { User } from 'firebase/auth';
import { Navigation, Plus, LogOut, Calendar, ChevronRight, Sparkles, Map as MapIcon, X, Search, Check, Flame, Trophy, Zap, TrendingUp, DollarSign, Loader2, ArrowLeft, ChevronDown, ChevronUp, UserPlus, Save, User as UserIcon, ClipboardList, Settings, Bell, Clock, Target, MapPin, Building } from 'lucide-react';
import { MapDisplay } from '../components/MapDisplay';
import { getUserProfile, getTodayAttendance, checkIn, checkOut, addHospital, addCustomer, getReminders, getWorkPlans, getTodayDateId } from '../services/dbService';
import { UserProfile, AttendanceDay, DailyReport, PipelineData, CheckInRecord, VisitReport, Interaction, Reminder, WorkPlan } from '../types';
import { GlassCard } from '../components/GlassCard';
import { useNavigate } from 'react-router-dom';

interface Props {
    user: User;
    userProfile?: UserProfile | null;
}

interface InteractionDraft {
    customerName: string;
    department: string;
    summary: string;
    pipeline: PipelineData | null;
}

interface VisitDraft {
    interactions: InteractionDraft[];
}

interface XpParticle {
    id: number;
    xp: number;
}

const getRankTitle = (level: number) => {
    if (level >= 9) return { title: 'LEGEND', color: 'text-white' };
    if (level >= 7) return { title: 'ELITE', color: 'text-white' };
    if (level >= 5) return { title: 'RANGER', color: 'text-white' };
    if (level >= 3) return { title: 'SCOUT', color: 'text-white' };
    return { title: 'ROOKIE', color: 'text-slate-400 dark:text-slate-400' };
};

const TimeAttendance: React.FC<Props> = ({ user, userProfile: initialProfile }) => {
    const navigate = useNavigate();
    const [profile, setProfile] = useState<UserProfile | null>(initialProfile || null);
    const [todayData, setTodayData] = useState<AttendanceDay | null>(null);
    const [todayPlan, setTodayPlan] = useState<WorkPlan | null>(null);
    const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
    const [loadingLoc, setLoadingLoc] = useState(false);
    const [reminders, setReminders] = useState<Reminder[]>([]);
    
    const [selectedPlace, setSelectedPlace] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [statusMsg, setStatusMsg] = useState('');
    const [time, setTime] = useState(new Date());
    
    const [showReportModal, setShowReportModal] = useState(false);
    const [visitDrafts, setVisitDrafts] = useState<Record<number, VisitDraft>>({});
    const [expandedVisitIdx, setExpandedVisitIdx] = useState<number>(0); 
    
    const [contactSearch, setContactSearch] = useState('');
    const [isContactDropdownOpen, setIsContactDropdownOpen] = useState(false);
    const [showAddContactView, setShowAddContactView] = useState(false);
    const [newContact, setNewContact] = useState({ name: '', department: '', phone: '' });
    const contactDropdownRef = useRef<HTMLDivElement>(null);
    
    const [selectedCustomer, setSelectedCustomer] = useState<{name: string, department: string} | null>(null);
    const [currentSummary, setCurrentSummary] = useState('');
    const [hasOpp, setHasOpp] = useState(false);
    
    const [dealMode, setDealMode] = useState<'new' | 'update'>('new');
    const [selectedExistingDealId, setSelectedExistingDealId] = useState('');
    const [pipelineProduct, setPipelineProduct] = useState('');
    const [pipelineValue, setPipelineValue] = useState('');
    const [pipelineStage, setPipelineStage] = useState('Prospecting');
    const [pipelineProb, setPipelineProb] = useState(20);
    const [pipelineDate, setPipelineDate] = useState('');

    const [xpParticles, setXpParticles] = useState<XpParticle[]>([]);
    const [isHudBouncing, setIsHudBouncing] = useState(false);
    const [showLevelUp, setShowLevelUp] = useState(false);
    const [newLevelDisplay, setNewLevelDisplay] = useState(0);

    const refreshData = async () => {
        const p = await getUserProfile(user.uid);
        const a = await getTodayAttendance(user.uid);
        const r = await getReminders(user.uid);
        
        // Fetch Today's Plan
        const plans = await getWorkPlans(user.uid);
        const todayStr = getTodayDateId();
        const foundPlan = plans.find(plan => plan.date === todayStr);
        setTodayPlan(foundPlan || null);

        setProfile(p);
        setTodayData(a);
        setReminders(r.filter(item => !item.isCompleted).slice(0, 3));
        if (a && a.checkIns.length > 0) {
            setVisitDrafts(prev => {
                const newDrafts = { ...prev };
                a.checkIns.forEach((_, idx) => {
                    if (!newDrafts[idx]) newDrafts[idx] = { interactions: [] };
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

    const handleSelectCustomer = (name: string, dept: string) => { setSelectedCustomer({ name, department: dept }); setContactSearch(name); setIsContactDropdownOpen(false); };
    const handleSaveNewContact = async () => { if (!newContact.name) return; const currentHospital = todayData?.checkIns[expandedVisitIdx]?.location || ''; try { await addCustomer(user.uid, { ...newContact, hospital: currentHospital }); await refreshData(); handleSelectCustomer(newContact.name, newContact.department); setShowAddContactView(false); setNewContact({ name: '', department: '', phone: '' }); } catch (e) { console.error("Failed to add customer", e); } };
    const addInteractionToDraft = (idx: number) => { if (!selectedCustomer) return; const newInteraction: InteractionDraft = { customerName: selectedCustomer.name, department: selectedCustomer.department, summary: currentSummary, pipeline: hasOpp ? { id: dealMode === 'update' ? selectedExistingDealId : crypto.randomUUID(), product: pipelineProduct, value: parseFloat(pipelineValue) || 0, stage: pipelineStage, probability: pipelineProb, isNew: dealMode === 'new', customerName: selectedCustomer.name, expectedCloseDate: pipelineDate } : null }; const currentInteractions = visitDrafts[idx]?.interactions || []; setVisitDrafts(prev => ({ ...prev, [idx]: { ...prev[idx], interactions: [...currentInteractions, newInteraction] } })); setSelectedCustomer(null); setContactSearch(''); setCurrentSummary(''); setHasOpp(false); setPipelineProduct(''); setPipelineValue(''); setPipelineStage('Prospecting'); setPipelineProb(20); setDealMode('new'); setSelectedExistingDealId(''); setPipelineDate(''); };
    const removeInteraction = (visitIdx: number, interactIdx: number) => { const currentInteractions = [...visitDrafts[visitIdx].interactions]; currentInteractions.splice(interactIdx, 1); setVisitDrafts(prev => ({ ...prev, [visitIdx]: { ...prev[visitIdx], interactions: currentInteractions } })); };
    const handleExistingDealSelect = (dealId: string) => { const deal = profile?.activePipeline?.find(p => p.id === dealId); setSelectedExistingDealId(dealId); if (deal) { setPipelineProduct(deal.product); setPipelineValue(deal.value.toString()); setPipelineStage(deal.stage); setPipelineProb(deal.probability); if (deal.expectedCloseDate) setPipelineDate(deal.expectedCloseDate); } };
    const confirmCheckOut = async () => { try { if (!todayData?.checkIns) return; const visits: VisitReport[] = todayData.checkIns.map((ci, idx) => { const draft = visitDrafts[idx]; const interactions = draft.interactions.map(d => ({ customerName: d.customerName, department: d.department, summary: d.summary, pipeline: d.pipeline || undefined })); const aggregatedSummary = interactions.map(i => `${i.customerName}: ${i.summary}`).join('\n'); const aggregatedMetWith = interactions.map(i => i.customerName); const aggregatedPipeline = interactions.filter(i => i.pipeline).map(i => i.pipeline!); return { location: ci.location, checkInTime: ci.timestamp, summary: aggregatedSummary, metWith: aggregatedMetWith, pipeline: aggregatedPipeline, interactions: interactions }; }); const reportData: DailyReport = { visits }; await checkOut(user.uid, reportData); setStatusMsg('บันทึกรายงานและเช็คเอาท์เรียบร้อย'); setShowReportModal(false); refreshData(); } catch (e) { setStatusMsg('Check-out failed'); } };
    
    // Improved Location Logic - Show all if query is empty on focus
    const filteredLocations = searchQuery === '' 
        ? (profile?.hospitals || []) 
        : (profile?.hospitals.filter(h => h.toLowerCase().includes(searchQuery.toLowerCase())) || []);

    const handleSelectLocation = (loc: string) => { setSelectedPlace(loc); setSearchQuery(loc); setIsDropdownOpen(false); };
    const handleAddNewLocation = async () => { if (!searchQuery.trim()) return; try { await addHospital(user.uid, searchQuery.trim()); await refreshData(); handleSelectLocation(searchQuery.trim()); } catch (e) { setStatusMsg('Failed to add new location'); } };

    const isCheckedInToday = todayData && todayData.checkIns.length > 0;
    const isCheckedOut = todayData && !!todayData.checkOut;
    const currentStage = isCheckedOut ? 'completed' : isCheckedInToday ? 'working' : 'idle';
    const getFilteredCustomers = (visitLocation: string) => { const all = (profile?.customers || []).filter(c => c.hospital === visitLocation || c.hospital === 'All'); if (!contactSearch) return all; return all.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase())); };
    const activeDeals = profile?.activePipeline || [];
    
    const currentLevel = profile?.level || 1; 
    const currentXP = profile?.xp || 0; 
    const nextLevelXP = currentLevel === 1 ? 100 : currentLevel * currentLevel * 100; 
    const progressPercent = Math.min(100, Math.max(0, ((currentXP - ((currentLevel - 1) === 0 ? 0 : (currentLevel-1)*(currentLevel-1)*100)) / (nextLevelXP - ((currentLevel - 1) === 0 ? 0 : (currentLevel-1)*(currentLevel-1)*100))) * 100)); 
    const rank = getRankTitle(currentLevel); 
    const pipelineStages = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

    const getTheme = (level: number) => {
        if (level >= 9) return { cardBg: 'bg-gradient-to-br from-amber-400 via-orange-500 to-yellow-600 shadow-orange-500/30', textPrimary: 'text-white', textSecondary: 'text-amber-100', settingsBtn: 'bg-white/20 text-white hover:bg-white/30', avatarBorder: 'border-white/50', progressTrack: 'bg-black/20', progressFill: 'bg-white', statIcon: 'text-white fill-white', divider: 'border-white/20' };
        if (level >= 7) return { cardBg: 'bg-gradient-to-br from-rose-500 via-pink-600 to-red-500 shadow-rose-500/30', textPrimary: 'text-white', textSecondary: 'text-rose-100', settingsBtn: 'bg-white/20 text-white hover:bg-white/30', avatarBorder: 'border-white/50', progressTrack: 'bg-black/20', progressFill: 'bg-white', statIcon: 'text-white fill-white', divider: 'border-white/20' };
        if (level >= 5) return { cardBg: 'bg-gradient-to-br from-purple-600 via-indigo-600 to-violet-700 shadow-purple-500/30', textPrimary: 'text-white', textSecondary: 'text-purple-100', settingsBtn: 'bg-white/20 text-white hover:bg-white/30', avatarBorder: 'border-white/50', progressTrack: 'bg-black/20', progressFill: 'bg-white', statIcon: 'text-white fill-white', divider: 'border-white/20' };
        if (level >= 3) return { cardBg: 'bg-gradient-to-br from-cyan-500 via-blue-500 to-sky-600 shadow-cyan-500/30', textPrimary: 'text-white', textSecondary: 'text-cyan-100', settingsBtn: 'bg-white/20 text-white hover:bg-white/30', avatarBorder: 'border-white/50', progressTrack: 'bg-black/20', progressFill: 'bg-white', statIcon: 'text-white fill-white', divider: 'border-white/20' };
        return { cardBg: 'bg-white dark:bg-slate-900 shadow-xl', textPrimary: 'text-slate-900 dark:text-white', textSecondary: 'text-slate-500 dark:text-slate-400', settingsBtn: 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200', avatarBorder: 'border-slate-100 dark:border-slate-700', progressTrack: 'bg-slate-100 dark:bg-slate-800', progressFill: 'bg-gradient-to-r from-cyan-400 to-blue-500', statIcon: 'text-orange-500 fill-orange-500', divider: 'border-slate-100 dark:border-white/5' };
    };

    const theme = getTheme(currentLevel);
    const badge = currentLevel >= 3 ? { label: profile?.role?.toUpperCase() || 'USER', bg: 'bg-black/20 border-white/30 text-white' } : { label: profile?.role?.toUpperCase() || 'USER', bg: 'bg-slate-500/10 border-slate-500/20 text-slate-500' };

    if (showReportModal) {
        if (showAddContactView) {
             return (
                <div className="max-w-2xl mx-auto space-y-6 animate-enter pb-10 pt-12 px-4">
                    <div className="flex items-center gap-4 sticky top-0 bg-[#F5F5F7] dark:bg-[#020617] z-20 py-2">
                        <button onClick={() => setShowAddContactView(false)} className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-200 dark:border-white/10"><ArrowLeft size={20} /></button>
                        <div><h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><UserPlus className="text-purple-500" size={24}/> เพิ่มรายชื่อใหม่</h2><p className="text-sm text-slate-500 dark:text-slate-400">กำลังเพิ่มรายชื่อที่ {todayData?.checkIns[expandedVisitIdx]?.location}</p></div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[24px] p-6 shadow-sm space-y-5">
                        <div className="space-y-2"><label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">ชื่อ-นามสกุล</label><input value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-slate-900 dark:text-white outline-none focus:border-purple-500 text-base font-medium" placeholder="เช่น นพ. สมชาย รักดี" autoFocus /></div>
                        <div className="space-y-2"><label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">แผนก / บทบาท</label><input value={newContact.department} onChange={e => setNewContact({...newContact, department: e.target.value})} className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-slate-900 dark:text-white outline-none focus:border-purple-500 text-base" placeholder="เช่น แผนกศัลยกรรม, จัดซื้อ" /></div>
                        <div className="space-y-2"><label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">เบอร์โทรศัพท์</label><input value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-slate-900 dark:text-white outline-none focus:border-purple-500 text-base" placeholder="08x-xxx-xxxx (ถ้ามี)" /></div>
                    </div>
                    <button onClick={handleSaveNewContact} disabled={!newContact.name} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 transform active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"><Save size={20} /> บันทึกและเลือกลูกค้า</button>
                </div>
            );
        }
        return (
            <div className="max-w-2xl mx-auto space-y-6 animate-enter pb-32 pt-12 px-4">
                <div className="flex items-center gap-4 sticky top-0 bg-[#F5F5F7] dark:bg-[#020617] z-20 py-2">
                    <button onClick={() => setShowReportModal(false)} className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-200 dark:border-white/10"><ArrowLeft size={20} /></button>
                    <div><h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><Sparkles className="text-purple-500" size={24}/> สรุปรายงานการปฏิบัติงาน</h2><p className="text-sm text-slate-500 dark:text-slate-400">สรุปรายละเอียดการเข้าพบ {todayData?.checkIns.length} สถานที่</p></div>
                </div>
                <div className="space-y-4">{todayData?.checkIns.map((ci, idx) => {
                    const isExpanded = expandedVisitIdx === idx;
                    const draft = visitDrafts[idx] || { interactions: [] };
                    return (<div key={idx} className={`bg-white dark:bg-slate-900 border transition-all duration-300 rounded-[24px] overflow-hidden ${isExpanded ? 'border-cyan-400 dark:border-cyan-500 shadow-xl scale-[1.01]' : 'border-slate-200 dark:border-white/10 opacity-80 hover:opacity-100'}`}><div onClick={() => { setExpandedVisitIdx(isExpanded ? -1 : idx); setContactSearch(''); setIsContactDropdownOpen(false); setSelectedCustomer(null); }} className="p-4 flex items-center justify-between cursor-pointer bg-slate-50 dark:bg-white/5"><div className="flex items-center gap-3"><div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${isExpanded ? 'bg-cyan-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>{idx + 1}</div><div><div className="font-bold text-slate-900 dark:text-white text-base">{ci.location}</div><div className="text-xs text-slate-500">{ci.timestamp.toDate().toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}</div></div></div>{isExpanded ? <ChevronUp className="text-cyan-500"/> : <ChevronDown className="text-slate-400"/>}</div>{isExpanded && (<div className="p-5 space-y-6 animate-enter bg-slate-50/50 dark:bg-slate-950/30">{draft.interactions.length > 0 && (<div className="space-y-3"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">กิจกรรมที่บันทึกแล้ว ({draft.interactions.length})</label>{draft.interactions.map((inter, iIdx) => (<div key={iIdx} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm relative group"><button onClick={() => removeInteraction(idx, iIdx)} className="absolute top-2 right-2 text-slate-400 hover:text-rose-500"><X size={16}/></button><div className="flex items-center gap-2 mb-1"><UserIcon size={14} className="text-purple-500"/><span className="font-bold text-slate-900 dark:text-white text-sm">{inter.customerName}</span><span className="text-xs text-slate-500">({inter.department})</span></div><p className="text-xs text-slate-600 dark:text-slate-300 ml-5 mb-2 line-clamp-2">"{inter.summary}"</p>{inter.pipeline && (<div className="ml-5 flex items-center gap-2 text-[10px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 px-2 py-1 rounded w-fit border border-indigo-100 dark:border-indigo-500/20"><TrendingUp size={10}/> <span>{inter.pipeline.product} (฿{inter.pipeline.value.toLocaleString()})</span></div>)}</div>))}</div>)}<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm space-y-4"><h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-2"><ClipboardList size={16} className="text-cyan-500"/> เพิ่มบันทึกกิจกรรม / การเข้าพบ</h3><div className="space-y-1.5 relative"><label className="text-[10px] font-bold text-slate-500 uppercase">1. เลือกลูกค้า / ผู้ติดต่อ</label><div className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={14} /><input type="text" value={contactSearch} onChange={(e) => { setContactSearch(e.target.value); setIsContactDropdownOpen(true); setSelectedCustomer(null); }} placeholder="ค้นหาชื่อผู้ติดต่อ..." className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-slate-900 dark:text-white outline-none focus:border-cyan-500 text-sm" />{isContactDropdownOpen && (<div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 max-h-40 overflow-y-auto">{getFilteredCustomers(ci.location).map((c, i) => (<div key={i} onClick={() => handleSelectCustomer(c.name, c.department)} className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer text-sm border-b border-slate-100 dark:border-white/5 last:border-0 flex justify-between"><span className="text-slate-900 dark:text-white">{c.name}</span><span className="text-xs text-slate-500">{c.department}</span></div>))}{contactSearch && <div onClick={() => setShowAddContactView(true)} className="px-4 py-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 cursor-pointer text-sm flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold"><Plus size={14} /> สร้างรายชื่อใหม่ "{contactSearch}"</div>}</div>)}</div>{selectedCustomer && <div className="text-xs text-emerald-500 flex items-center gap-1"><Check size={12}/> เลือกแล้ว: <b>{selectedCustomer.name}</b></div>}</div><div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase">2. สรุปรายละเอียดการสนทนา</label><textarea value={currentSummary} onChange={(e) => setCurrentSummary(e.target.value)} placeholder="สรุปหัวข้อที่ได้พูดคุยหรือความคืบหน้า..." rows={2} className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-cyan-500 text-sm resize-none" /></div><div className="space-y-2"><div className="flex items-center justify-between"><label className="text-[10px] font-bold text-indigo-500 uppercase flex items-center gap-1"><TrendingUp size={12}/> 3. เพิ่มโอกาสการขาย (Opportunity)?</label><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={hasOpp} onChange={(e) => setHasOpp(e.target.checked)} className="sr-only peer"/><div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div></label></div>{hasOpp && (<div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl border border-indigo-100 dark:border-indigo-500/20 space-y-2 animate-enter"><div className="flex p-1 bg-white/50 dark:bg-black/20 rounded-lg mb-2"><button onClick={() => { setDealMode('new'); setPipelineProduct(''); setPipelineValue(''); }} className={`flex-1 text-[10px] py-1.5 rounded-md font-bold transition-all ${dealMode === 'new' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-indigo-500'}`}>ดีลใหม่</button><button onClick={() => setDealMode('update')} className={`flex-1 text-[10px] py-1.5 rounded-md font-bold transition-all ${dealMode === 'update' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-amber-500'}`}>อัปเดตดีลเดิม</button></div>{dealMode === 'update' && (<select value={selectedExistingDealId} onChange={(e) => handleExistingDealSelect(e.target.value)} className="w-full p-2 rounded-lg bg-white dark:bg-black/20 border border-amber-200 dark:border-amber-500/30 text-xs outline-none focus:border-amber-500 text-slate-700 dark:text-white appearance-none"><option value="">-- เลือกดีลที่ต้องการอัปเดต --</option>{activeDeals.map(deal => (<option key={deal.id} value={deal.id}>{deal.product} ({deal.stage})</option>))}</select>)}<div className="grid grid-cols-2 gap-2"><input value={pipelineProduct} onChange={e => setPipelineProduct(e.target.value)} placeholder="ชื่อสินค้า / โปรเจกต์" className="w-full p-2 rounded-lg bg-white dark:bg-black/20 border border-indigo-200 dark:border-indigo-500/30 text-xs outline-none focus:border-indigo-500"/><input type="number" value={pipelineValue} onChange={e => setPipelineValue(e.target.value)} placeholder="มูลค่า (บาท)" className="w-full p-2 rounded-lg bg-white dark:bg-black/20 border border-indigo-200 dark:border-indigo-500/30 text-xs outline-none focus:border-indigo-500"/></div><div className="grid grid-cols-2 gap-2"><select value={pipelineStage} onChange={e => setPipelineStage(e.target.value)} className="w-full p-2 rounded-lg bg-white dark:bg-black/20 border border-indigo-200 dark:border-indigo-500/30 text-xs outline-none">{pipelineStages.map(s => <option key={s} value={s}>{s}</option>)}</select><div className="flex items-center gap-2 px-1 text-xs text-slate-500"><span>โอกาส: {pipelineProb}%</span><input type="range" min="0" max="100" step="10" value={pipelineProb} onChange={e => setPipelineProb(parseInt(e.target.value))} className="w-16 accent-indigo-500"/></div></div></div>)}</div><button onClick={() => addInteractionToDraft(idx)} disabled={!selectedCustomer || !currentSummary} className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"><Plus size={16} /> บันทึกข้อมูลกิจกรรม</button></div></div>)}</div>); })}</div><div className="pt-4 pb-10"><button onClick={confirmCheckOut} className="w-full bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-white font-bold py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 transform active:scale-95 transition-all"><Check size={24} /> ส่งรายงานทั้งหมดและเช็คเอาท์</button></div></div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-[#F5F5F7] dark:bg-[#020617]">
            <div className={`relative rounded-b-[40px] shadow-xl pb-8 pt-[max(2rem,env(safe-area-inset-top))] px-6 z-20 overflow-hidden transition-all duration-500 ${theme.cardBg}`}>
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                
                <div className="flex justify-between items-start mb-6 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-sm overflow-hidden border-2 ${theme.avatarBorder}`}>
                            {profile?.photoBase64 ? (
                                <img src={profile.photoBase64} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-white text-xl font-bold">
                                    {profile?.name?.[0] || user.email?.[0]?.toUpperCase()}
                                </div>
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className={`text-xl font-bold leading-tight ${theme.textPrimary}`}>
                                    {profile?.name || user.email?.split('@')[0]}
                                </h1>
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase ${badge.bg}`}>
                                    {badge.label}
                                </span>
                            </div>
                            <p className={`text-sm font-medium ${theme.textSecondary}`}>
                                {profile?.area || 'Happy Joby Workspace'}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => navigate('/settings')}
                        className={`p-2.5 rounded-full transition-colors ${theme.settingsBtn}`}
                    >
                        <Settings size={22} />
                    </button>
                </div>

                <div className="flex items-center gap-4 relative z-10">
                    <div className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center relative overflow-hidden backdrop-blur-md bg-black/5 border border-white/10 shadow-inner">
                         <span className={`text-2xl font-black ${theme.textPrimary}`}>{currentLevel}</span>
                         {isHudBouncing && <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-ping"></div>}
                    </div>
                    
                    <div className="flex-1">
                         <div className="flex justify-between items-end mb-1.5">
                             <span className={`text-[10px] font-black tracking-widest uppercase opacity-80 ${theme.textPrimary}`}>{rank.title}</span>
                             <div className="flex items-baseline gap-1">
                                <span className={`text-sm font-bold ${theme.textPrimary}`}>{currentXP}</span>
                                <span className={`text-[10px] ${theme.textSecondary}`}>XP</span>
                             </div>
                         </div>
                         <div className={`h-2.5 w-full rounded-full overflow-hidden ${theme.progressTrack}`}>
                            <div style={{ width: `${progressPercent}%` }} className={`h-full rounded-full transition-all duration-700 ${theme.progressFill}`}></div>
                         </div>
                    </div>

                    <div className={`flex flex-col items-center pl-3 border-l ${theme.divider}`}>
                        <div className={`flex items-center gap-1 ${theme.statIcon}`}>
                            <Flame size={20} className={theme.statIcon.split(' ')[1]} />
                            <span className={`text-xl font-bold ${theme.textPrimary}`}>{profile?.currentStreak || 0}</span>
                        </div>
                        <span className={`text-[8px] font-bold uppercase tracking-wider ${theme.textSecondary}`}>Streak</span>
                    </div>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto px-4 pt-6 pb-28 space-y-6">
                {xpParticles.map((p) => (<div key={p.id} className="animate-fly-xp flex items-center justify-center"><div className="bg-gradient-to-br from-amber-400 to-orange-500 text-white font-black text-3xl px-6 py-3 rounded-full shadow-lg border-2 border-white/40"><Zap className="fill-white" size={28} /> +{p.xp}</div></div>))}

                <div className="flex justify-between items-end px-2">
                    <div>
                        <div className="text-4xl font-bold text-slate-900 dark:text-white tracking-tighter leading-none">{time.toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">{time.toLocaleDateString('en-US', {weekday: 'long', day: 'numeric', month: 'short'})}</div>
                    </div>
                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-bold border uppercase tracking-wider shadow-sm ${
                        currentStage === 'working' ? 'bg-emerald-100 dark:bg-emerald-500/20 border-emerald-200 dark:border-emerald-500/50 text-emerald-700 dark:text-emerald-400' :
                        currentStage === 'completed' ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500' :
                        'bg-cyan-100 dark:bg-cyan-500/20 border-cyan-200 dark:border-cyan-500/50 text-cyan-700 dark:text-cyan-400'
                    }`}>
                        {currentStage === 'working' ? 'ON DUTY' : currentStage === 'completed' ? 'OFF DUTY' : 'READY'}
                    </div>
                </div>

                {/* --- SMART REMINDERS WIDGET --- */}
                {reminders.length > 0 && (
                    <div className="animate-enter delay-100">
                        <div className="flex items-center justify-between mb-3 px-2">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Bell size={12} className="text-cyan-500" /> Smart Alerts
                            </h3>
                            <button onClick={() => navigate('/reminders')} className="text-[10px] font-black text-cyan-500 flex items-center gap-1 uppercase">ดูทั้งหมด <ChevronRight size={12} /></button>
                        </div>
                        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                            {reminders.map((r) => (
                                <div 
                                    key={r.id} 
                                    onClick={() => navigate('/reminders')}
                                    className="min-w-[160px] bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-md active:scale-95 transition-all cursor-pointer"
                                >
                                    <div className="font-bold text-slate-900 dark:text-white text-xs truncate mb-1">{r.title}</div>
                                    <div className="text-[9px] font-black text-cyan-600 dark:text-cyan-400 uppercase flex items-center gap-1">
                                        <Clock size={10} /> 
                                        {new Date(r.dueTime).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="relative rounded-[32px] border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl overflow-visible" ref={dropdownRef}>
                    <div className="h-48 w-full relative overflow-hidden rounded-t-[32px]">
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
                        <button onClick={getLocation} className="absolute top-3 right-3 bg-white dark:bg-slate-900/80 p-2 rounded-full text-slate-500 shadow-md border border-slate-100 dark:border-white/10 z-10">
                            <Navigation size={16} />
                        </button>
                    </div>
                    
                    <div className="p-4 space-y-4">
                        {/* Planned Today Chips */}
                        {todayPlan && todayPlan.itinerary && todayPlan.itinerary.length > 0 && !isCheckedOut && (
                            <div className="animate-enter">
                                <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2 mb-2 ml-1">
                                    <Target size={12} /> เป้าหมายวันนี้จากแผนงาน
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {todayPlan.itinerary.map((it, idx) => {
                                        // ตรวจสอบว่าเช็คอินไปแล้วหรือยัง
                                        const isCheckedIn = todayData?.checkIns.some(ci => ci.location === it.location);
                                        return (
                                            <button 
                                                key={idx}
                                                onClick={() => handleSelectLocation(it.location)}
                                                className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 border shadow-sm active:scale-95 ${
                                                    selectedPlace === it.location
                                                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-indigo-500/20'
                                                    : isCheckedIn
                                                        ? 'bg-slate-50 dark:bg-slate-800 border-emerald-500/30 text-emerald-500 opacity-60'
                                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-300 hover:border-indigo-500'
                                                }`}
                                            >
                                                {isCheckedIn ? <Check size={14} /> : <MapPin size={14} />}
                                                {it.location}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="relative group shadow-lg rounded-2xl">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Search size={18} className="text-slate-400" />
                            </div>
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSearchQuery(val);
                                    setIsDropdownOpen(true);
                                    if(val === '') setSelectedPlace('');
                                }}
                                onFocus={() => setIsDropdownOpen(true)}
                                placeholder="เลือกสถานที่เพื่อเช็คอิน..."
                                className="block w-full pl-11 pr-4 py-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all text-sm font-medium"
                            />
                            
                            {isDropdownOpen && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-[100] max-h-52 overflow-y-auto ring-1 ring-black/5">
                                    {filteredLocations.length > 0 ? (
                                        filteredLocations.map((loc, idx) => (
                                            <button 
                                                key={idx} 
                                                onClick={() => handleSelectLocation(loc)} 
                                                className="w-full text-left px-5 py-4 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 text-sm flex justify-between items-center border-b border-slate-100 dark:border-white/5 last:border-0 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Building size={16} className="text-slate-400" />
                                                    <span className="font-bold">{loc}</span>
                                                </div>
                                                {selectedPlace === loc && <Check size={14} className="text-cyan-500" />}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-5 py-8 text-center text-slate-400 text-sm italic">
                                            ไม่พบสถานที่ที่ตรงกับคำค้นหา
                                        </div>
                                    )}
                                    {searchQuery && !profile?.hospitals.some(h => h.toLowerCase() === searchQuery.toLowerCase()) && (
                                        <button 
                                            onClick={handleAddNewLocation} 
                                            className="w-full text-left px-5 py-4 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 text-sm flex items-center gap-3 border-t-2 border-slate-100 dark:border-white/10 sticky bottom-0 bg-white dark:bg-slate-900 font-black"
                                        >
                                            <div className="bg-cyan-500 text-white p-1 rounded-full">
                                                <Plus size={14} />
                                            </div>
                                            เพิ่มรายชื่อใหม่: "{searchQuery}"
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <button 
                        onClick={handleCheckIn}
                        disabled={isCheckedOut || !selectedPlace}
                        className={`relative group h-32 rounded-[32px] flex flex-col items-center justify-center transition-all duration-300 overflow-hidden ${
                            isCheckedOut || !selectedPlace
                            ? 'bg-slate-100 dark:bg-slate-800 opacity-50 cursor-not-allowed text-slate-400' 
                            : 'bg-gradient-to-br from-emerald-400 to-emerald-600 dark:from-emerald-600 dark:to-emerald-800 shadow-[0_10px_30px_-10px_rgba(52,211,153,0.4)] hover:shadow-[0_15px_40px_-10px_rgba(52,211,153,0.6)] active:scale-95'
                        }`}
                    >
                        <Plus size={36} className={`${isCheckedOut || !selectedPlace ? 'text-slate-400' : 'text-white'} mb-2`} />
                        <span className={`${isCheckedOut || !selectedPlace ? 'text-slate-400' : 'text-white'} font-black text-xl tracking-tight`}>CHECK IN</span>
                    </button>

                    <button 
                        onClick={() => setShowReportModal(true)}
                        disabled={!isCheckedInToday || isCheckedOut}
                        className={`relative group h-32 rounded-[32px] flex flex-col items-center justify-center transition-all duration-300 overflow-hidden ${
                            !isCheckedInToday || isCheckedOut 
                            ? 'bg-slate-100 dark:bg-slate-800 opacity-50 cursor-not-allowed text-slate-400' 
                            : 'bg-gradient-to-br from-rose-400 to-rose-600 dark:from-rose-600 dark:to-rose-800 shadow-[0_10px_30px_-10px_rgba(244,63,94,0.4)] hover:shadow-[0_15px_40px_-10px_rgba(244,63,94,0.6)] active:scale-95'
                        }`}
                    >
                        <LogOut size={36} className={`${!isCheckedInToday || isCheckedOut ? 'text-slate-400' : 'text-white'} mb-2`} />
                        <span className={`${!isCheckedInToday || isCheckedOut ? 'text-slate-400' : 'text-white'} font-black text-xl tracking-tight`}>CHECK OUT</span>
                    </button>
                </div>
                
                {statusMsg && <div className="text-center text-cyan-600 text-sm py-3 bg-cyan-50 dark:bg-cyan-950/30 rounded-2xl border border-cyan-100 dark:border-cyan-500/20">{statusMsg}</div>}

                <div className="pt-2">
                    <div className="flex items-center gap-2 mb-4 px-2 opacity-60">
                        <Calendar size={14} className="text-slate-500" />
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">เส้นทางวันนี้</h3>
                    </div>
                    
                    <div className="relative pl-4 space-y-4 border-l border-slate-200 dark:border-slate-800 ml-3">
                        {todayData?.checkIns.map((ci, idx) => (
                            <div key={idx} className="relative pl-6">
                                <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-lg ring-4 ring-white dark:ring-slate-950"></div>
                                <div className="flex justify-between items-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-4 rounded-2xl shadow-sm">
                                    <div className="text-slate-900 dark:text-white font-bold text-sm">{ci.location}</div>
                                    <div className="text-slate-500 dark:text-slate-400 font-mono text-xs">{ci.timestamp.toDate().toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TimeAttendance;
