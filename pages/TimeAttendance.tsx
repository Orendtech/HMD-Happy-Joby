import React, { useEffect, useState, useRef } from 'react';
import { User } from 'firebase/auth';
import { 
    Navigation, Plus, LogOut, Calendar, Sparkles, X, Search, Check, 
    Flame, Zap, TrendingUp, Loader2, ArrowLeft, ChevronDown, ChevronUp, 
    UserPlus, Save, User as UserIcon, ClipboardList, Settings, Bell, 
    Target, MapPin, Building, MessageSquare, Edit, Send
} from 'lucide-react';
import { MapDisplay } from '../components/MapDisplay';
import { 
    getUserProfile, getTodayAttendance, checkIn, checkOut, 
    addHospital, addCustomer, getReminders, getWorkPlans, getTodayDateId 
} from '../services/dbService';
import { 
    UserProfile, AttendanceDay, DailyReport, PipelineData, 
    VisitReport, Interaction, Reminder, WorkPlan 
} from '../types';
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
    if (level >= 9) return { title: 'LEGEND', color: 'text-white', themeColor: '#f59e0b' }; 
    if (level >= 7) return { title: 'ELITE', color: 'text-white', themeColor: '#e11d48' };  
    if (level >= 5) return { title: 'RANGER', color: 'text-white', themeColor: '#4f46e5' }; 
    if (level >= 3) return { title: 'SCOUT', color: 'text-white', themeColor: '#06b6d4' };  
    return { title: 'ROOKIE', color: 'text-slate-400', themeColor: '' }; 
};

const cleanFirestoreData = (obj: any): any => {
    if (Array.isArray(obj)) {
        return obj.map(v => cleanFirestoreData(v));
    } else if (obj !== null && typeof obj === 'object') {
        const newObj: any = {};
        Object.keys(obj).forEach(key => {
            const val = cleanFirestoreData(obj[key]);
            if (val !== undefined) {
                newObj[key] = val;
            }
        });
        return newObj;
    }
    return obj;
};

// Thai translations for stages
const stageLabels: Record<string, string> = {
    'Prospecting': 'ค้นหาลูกค้า',
    'Qualification': 'ตรวจสอบความต้องการ',
    'Proposal': 'เสนอราคา/บริการ',
    'Negotiation': 'กำลังต่อรอง',
    'Closed Won': 'สำเร็จ',
    'Closed Lost': 'ไม่สำเร็จ'
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
    const [isFinalCheckout, setIsFinalCheckout] = useState(false);
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

    const [isSavingReport, setIsSavingReport] = useState(false);

    const refreshData = async () => {
        try {
            const p = await getUserProfile(user.uid);
            const a = await getTodayAttendance(user.uid);
            const r = await getReminders(user.uid);
            const plans = await getWorkPlans(user.uid);
            const todayStr = getTodayDateId();
            
            const foundPlan = plans.find(plan => plan.date === todayStr);
            setTodayPlan(foundPlan || null);
            setProfile(p);
            setTodayData(a);
            
            const filteredReminders = r.filter(item => {
                return !item.isCompleted && item.dueTime.startsWith(todayStr);
            });
            setReminders(filteredReminders.slice(0, 5)); 
            
            if (a && a.checkIns.length > 0) {
                setVisitDrafts(prev => {
                    const newDrafts = { ...prev };
                    a.checkIns.forEach((ci, idx) => {
                        const existingVisit = a.report?.visits?.[idx];
                        if (existingVisit && (!newDrafts[idx] || newDrafts[idx].interactions.length === 0)) {
                            newDrafts[idx] = { 
                                interactions: (existingVisit.interactions || []).map(i => ({
                                    customerName: i.customerName,
                                    department: i.department || '',
                                    summary: i.summary,
                                    pipeline: i.pipeline || null
                                })) 
                            };
                        } else if (!newDrafts[idx]) {
                            newDrafts[idx] = { interactions: [] };
                        }
                    });
                    return newDrafts;
                });
            }
        } catch (e) {
            console.error("Refresh failed", e);
        }
    };

    const currentLevel = profile?.level || 1; 
    const rank = getRankTitle(currentLevel);

    // Dynamic Rank Status Bar Sync
    useEffect(() => {
        const metaThemeColor = document.getElementById('meta-theme-color');
        if (metaThemeColor) {
            if (rank.themeColor) {
                metaThemeColor.setAttribute('content', rank.themeColor);
            } else {
                const isDark = document.documentElement.classList.contains('dark');
                metaThemeColor.setAttribute('content', isDark ? '#020617' : '#F5F5F7');
            }
        }
    }, [currentLevel, rank.themeColor]);

    useEffect(() => {
        refreshData();
        getLocation();
        const timer = setInterval(() => setTime(new Date()), 1000);
        const handleClickOutside = (event: MouseEvent) => { 
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsDropdownOpen(false); 
            if (contactDropdownRef.current && !contactDropdownRef.current.contains(event.target as Node)) setIsContactDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => { 
            clearInterval(timer); 
            document.removeEventListener('mousedown', handleClickOutside);
        };
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
        
        if ("vibrate" in navigator) navigator.vibrate(100);

        try {
            const result = await checkIn(user.uid, selectedPlace, location.lat, location.lng);
            setStatusMsg(''); 
            const newParticle = { id: Date.now(), xp: result.earnedXp };
            setXpParticles(prev => [...prev, newParticle]);
            setSelectedPlace(''); setSearchQuery('');
            setTimeout(() => { setXpParticles(prev => prev.filter(p => p.id !== newParticle.id)); }, 1200);
            setTimeout(() => { setIsHudBouncing(true); setTimeout(() => setIsHudBouncing(false), 300); refreshData(); }, 900);
            if (result.isLevelUp) { 
                if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
                setTimeout(() => { setNewLevelDisplay(result.newLevel); setShowLevelUp(true); }, 1000); 
            }
        } catch (e) { setStatusMsg('การเช็คอินล้มเหลว'); }
    };

    const handleSelectCustomer = (name: string, dept: string) => { 
        setSelectedCustomer({ name, department: dept }); 
        setContactSearch(name); 
        setIsContactDropdownOpen(false); 
    };

    const handleSaveNewContact = async () => { 
        if (!newContact.name) return; 
        const currentHospital = todayData?.checkIns[expandedVisitIdx]?.location || ''; 
        try { 
            await addCustomer(user.uid, { ...newContact, hospital: currentHospital }); 
            await refreshData(); 
            handleSelectCustomer(newContact.name, newContact.department); 
            setShowAddContactView(false); 
            setNewContact({ name: '', department: '', phone: '' }); 
        } catch (e) { console.error("Failed to add customer", e); } 
    };

    const addInteractionToDraft = (idx: number) => { 
        if (!selectedCustomer) return; 
        const newInteraction: InteractionDraft = { 
            customerName: selectedCustomer.name, 
            department: selectedCustomer.department, 
            summary: currentSummary, 
            pipeline: hasOpp ? { 
                id: dealMode === 'update' ? selectedExistingDealId : crypto.randomUUID(), 
                product: pipelineProduct, 
                value: parseFloat(pipelineValue) || 0, 
                stage: pipelineStage, 
                probability: pipelineProb, 
                isNew: dealMode === 'new', 
                customerName: selectedCustomer.name, 
                expectedCloseDate: pipelineDate 
            } : null 
        }; 
        const currentInteractions = visitDrafts[idx]?.interactions || []; 
        setVisitDrafts(prev => ({ ...prev, [idx]: { ...prev[idx], interactions: [...currentInteractions, newInteraction] } })); 
        setSelectedCustomer(null); 
        setContactSearch(''); 
        setCurrentSummary(''); 
        setHasOpp(false); 
        setPipelineProduct(''); 
        setPipelineValue(''); 
        setPipelineStage('Prospecting'); 
        setPipelineProb(20); 
        setDealMode('new'); 
        setSelectedExistingDealId(''); 
        setPipelineDate(''); 
    };

    const removeInteraction = (visitIdx: number, interactIdx: number) => { 
        const currentInteractions = [...(visitDrafts[visitIdx]?.interactions || [])]; 
        currentInteractions.splice(interactIdx, 1); 
        setVisitDrafts(prev => ({ ...prev, [visitIdx]: { ...prev[visitIdx], interactions: currentInteractions } })); 
    };

    const handleExistingDealSelect = (dealId: string) => { 
        const deal = profile?.activePipeline?.find(p => p.id === dealId); 
        setSelectedExistingDealId(dealId); 
        if (deal) { 
            setPipelineProduct(deal.product); 
            setPipelineValue(deal.value.toString()); 
            setPipelineStage(deal.stage); 
            setPipelineProb(deal.probability); 
            if (deal.expectedCloseDate) setPipelineDate(deal.expectedCloseDate); 
        } 
    };
    
    const confirmCheckOut = async (final: boolean = true) => { 
        if (isSavingReport) return;
        setIsSavingReport(true);
        try { 
            if (!todayData?.checkIns || todayData.checkIns.length === 0) {
                alert("ไม่พบข้อมูลการเช็คอินของวันนี้");
                setIsSavingReport(false);
                return; 
            }
            
            const visits: VisitReport[] = todayData.checkIns.map((ci, idx) => { 
                const draft = visitDrafts[idx] || { interactions: [] }; 
                
                const interactions = draft.interactions.map(d => {
                    const interaction: Interaction = {
                        customerName: d.customerName,
                        department: d.department || "",
                        summary: d.summary || ""
                    };
                    if (d.pipeline) {
                        interaction.pipeline = cleanFirestoreData(d.pipeline);
                    }
                    return interaction;
                });

                const aggregatedSummary = interactions.map(i => `${i.customerName}: ${i.summary}`).join('\n'); 
                const aggregatedMetWith = interactions.map(i => i.customerName); 
                const aggregatedPipeline = interactions.filter(i => i.pipeline).map(i => i.pipeline!); 
                
                return { 
                    location: ci.location, 
                    checkInTime: ci.timestamp, 
                    summary: aggregatedSummary, 
                    metWith: aggregatedMetWith, 
                    pipeline: aggregatedPipeline, 
                    interactions: interactions 
                }; 
            }); 

            const rawReport: DailyReport = { visits }; 
            const cleanedReport = cleanFirestoreData(rawReport);
            
            await checkOut(user.uid, cleanedReport, undefined, final); 
            
            if ("vibrate" in navigator) navigator.vibrate([100, 50, 100]);

            if (final) {
                alert(todayData?.checkOut ? 'อัปเดตรายงานเรียบร้อยแล้ว' : 'บันทึกรายงานและเช็คเอาท์เรียบร้อยแล้ว');
            } else {
                alert('บันทึกร่างกิจกรรมเรียบร้อยแล้ว');
            }
            
            setShowReportModal(false);
            await refreshData(); 
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (e) { 
            console.error("Firestore Save Error:", e);
            alert('ไม่สามารถบันทึกข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
        } finally {
            setIsSavingReport(false);
        }
    };
    
    const filteredLocations = searchQuery === '' 
        ? (profile?.hospitals || []) 
        : (profile?.hospitals.filter(h => h.toLowerCase().includes(searchQuery.toLowerCase())) || []);

    const handleSelectLocation = (loc: string) => { setSelectedPlace(loc); setSearchQuery(loc); setIsDropdownOpen(false); };
    const handleAddNewLocation = async () => { if (!searchQuery.trim()) return; try { await addHospital(user.uid, searchQuery.trim()); await refreshData(); handleSelectLocation(searchQuery.trim()); } catch (e) { setStatusMsg('เพิ่มสถานที่ล้มเหลว'); } };

    const isCheckedInToday = todayData && todayData.checkIns.length > 0;
    const isCheckedOut = todayData && !!todayData.checkOut;
    const currentStage = isCheckedOut ? 'completed' : isCheckedInToday ? 'working' : 'idle';
    const getFilteredCustomers = (visitLocation: string) => { const all = (profile?.customers || []).filter(c => c.hospital === visitLocation || c.hospital === 'All'); if (!contactSearch) return all; return all.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase())); };
    const activeDeals = profile?.activePipeline || [];
    
    const currentXP = profile?.xp || 0; 
    const prevLevelXP = (currentLevel - 1) === 0 ? 0 : (currentLevel - 1) * (currentLevel - 1) * 100;
    const nextLevelXP = currentLevel * currentLevel * 100; 
    const progressPercent = Math.min(100, Math.max(0, ((currentXP - prevLevelXP) / (nextLevelXP - prevLevelXP)) * 100)); 
    
    const pipelineStages = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

    const getTheme = (level: number) => {
        if (level >= 9) return { cardBg: 'bg-gradient-to-br from-amber-400 via-orange-500 to-yellow-600', textPrimary: 'text-white', textSecondary: 'text-amber-100', settingsBtn: 'bg-white/20 text-white', avatarBorder: 'border-white/50', progressTrack: 'bg-black/20', progressFill: 'bg-white', statIcon: 'text-white fill-white', divider: 'border-white/20' };
        if (level >= 7) return { cardBg: 'bg-gradient-to-br from-rose-500 via-pink-600 to-red-500', textPrimary: 'text-white', textSecondary: 'text-rose-100', settingsBtn: 'bg-white/20 text-white', avatarBorder: 'border-white/50', progressTrack: 'bg-black/20', progressFill: 'bg-white', statIcon: 'text-white fill-white', divider: 'border-white/20' };
        if (level >= 5) return { cardBg: 'bg-gradient-to-br from-purple-600 via-indigo-600 to-violet-700', textPrimary: 'text-white', textSecondary: 'text-purple-100', settingsBtn: 'bg-white/20 text-white', avatarBorder: 'border-white/50', progressTrack: 'bg-black/20', progressFill: 'bg-white', statIcon: 'text-white fill-white', divider: 'border-white/20' };
        if (level >= 3) return { cardBg: 'bg-gradient-to-br from-cyan-500 via-blue-500 to-sky-600', textPrimary: 'text-white', textSecondary: 'text-cyan-100', settingsBtn: 'bg-white/20 text-white', avatarBorder: 'border-white/50', progressTrack: 'bg-black/20', progressFill: 'bg-white', statIcon: 'text-white fill-white', divider: 'border-white/20' };
        return { cardBg: 'bg-white dark:bg-slate-900', textPrimary: 'text-slate-900 dark:text-white', textSecondary: 'text-slate-500 dark:text-slate-400', settingsBtn: 'bg-slate-50 dark:bg-slate-800 text-slate-400', avatarBorder: 'border-slate-100 dark:border-slate-700', progressTrack: 'bg-slate-100 dark:bg-slate-800', progressFill: 'bg-gradient-to-r from-cyan-400 to-blue-500', statIcon: 'text-orange-500 fill-orange-500', divider: 'border-slate-100 dark:border-white/5' };
    };

    const theme = getTheme(currentLevel);
    const badge = currentLevel >= 3 
        ? { label: profile?.role?.toUpperCase() === 'ADMIN' ? 'ผู้ดูแลระบบ' : profile?.role?.toUpperCase() === 'MANAGER' ? 'หัวหน้างาน' : 'พนักงาน', bg: 'bg-black/20 border-white/30 text-white' } 
        : { label: profile?.role?.toUpperCase() === 'ADMIN' ? 'ผู้ดูแลระบบ' : profile?.role?.toUpperCase() === 'MANAGER' ? 'หัวหน้างาน' : 'พนักงาน', bg: 'bg-slate-500/10 border-slate-500/20 text-slate-500' };

    const handleOpenVisitReport = (idx: number) => {
        setExpandedVisitIdx(idx);
        setIsFinalCheckout(false);
        setShowReportModal(true);
    };

    const handleCheckOutStart = () => {
        if ("vibrate" in navigator) navigator.vibrate(100);
        
        setIsFinalCheckout(true);
        setExpandedVisitIdx(0);
        setShowReportModal(true);
    };

    if (showReportModal) {
        if (showAddContactView) {
             return (
                <div className="max-w-2xl mx-auto space-y-6 animate-enter pb-10 pt-12 px-4">
                    <div className="flex items-center gap-4 sticky top-0 bg-[#F5F5F7] dark:bg-[#020617] z-20 py-2">
                        <button onClick={() => setShowAddContactView(false)} className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-200 dark:border-white/10"><ArrowLeft size={20} /></button>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><UserPlus className="text-purple-500" size={24}/> เพิ่มรายชื่อใหม่</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">กำลังเพิ่มรายชื่อที่ {todayData?.checkIns[expandedVisitIdx]?.location}</p>
                        </div>
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
            <div className="max-w-2xl mx-auto space-y-6 animate-enter pb-60 pt-12 px-4 relative">
                <div className="flex items-center gap-4 sticky top-0 bg-[#F5F5F7] dark:bg-[#020617] z-20 py-2">
                    <button onClick={() => setShowReportModal(false)} className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-200 dark:border-white/10"><ArrowLeft size={20} /></button>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><Sparkles className="text-purple-500" size={24}/> {isCheckedOut ? 'แก้ไขข้อมูลรายงาน' : (isFinalCheckout ? 'สรุปรายงานการปฏิบัติงาน' : 'บันทึกรายละเอียดกิจกรรม')}</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{isCheckedOut ? 'คุณสามารถอัปเดตข้อมูลย้อนหลังได้' : (isFinalCheckout ? `สรุปรายละเอียดการเข้าพบ ${todayData?.checkIns.length} สถานที่` : 'คุณสามารถบันทึกรายละเอียดแต่ละที่ไว้ก่อนได้')}</p>
                    </div>
                </div>
                <div className="space-y-4">
                    {todayData?.checkIns.map((ci, idx) => {
                        const isExpanded = expandedVisitIdx === idx;
                        const draft = visitDrafts[idx] || { interactions: [] };
                        return (
                            <div key={idx} className={`bg-white dark:bg-slate-900 border transition-all duration-300 rounded-[24px] overflow-hidden ${isExpanded ? 'border-cyan-400 dark:border-cyan-500 shadow-xl scale-[1.01]' : 'border-slate-200 dark:border-white/10 opacity-80'}`}>
                                <div onClick={() => { setExpandedVisitIdx(isExpanded ? -1 : idx); setContactSearch(''); setIsContactDropdownOpen(false); setSelectedCustomer(null); }} className="p-4 flex items-center justify-between cursor-pointer bg-slate-50 dark:bg-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${isExpanded ? 'bg-cyan-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>{idx + 1}</div>
                                        <div>
                                            <div className="font-bold text-slate-900 dark:text-white text-base">{ci.location}</div>
                                            <div className="text-xs text-slate-500">{ci.timestamp.toDate().toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}</div>
                                        </div>
                                    </div>
                                    {isExpanded ? <ChevronUp className="text-cyan-500"/> : <ChevronDown className="text-slate-400"/>}
                                </div>
                                {isExpanded && (
                                    <div className="p-5 space-y-6 animate-enter bg-slate-50/50 dark:bg-slate-950/30">
                                        {draft.interactions.length > 0 && (
                                            <div className="space-y-3">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">กิจกรรมที่บันทึกแล้ว ({draft.interactions.length})</label>
                                                {draft.interactions.map((inter, iIdx) => (
                                                    <div key={iIdx} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm relative group">
                                                        <button onClick={() => removeInteraction(idx, iIdx)} className="absolute top-2 right-2 text-slate-400 hover:text-rose-500"><X size={16}/></button>
                                                        <div className="flex items-center gap-2 mb-1"><UserIcon size={14} className="text-purple-500"/><span className="font-bold text-slate-900 dark:text-white text-sm">{inter.customerName}</span><span className="text-xs text-slate-500">({inter.department})</span></div>
                                                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium pl-10">"{inter.summary}"</p>
                                                        {inter.pipeline && (<div className="ml-5 flex items-center gap-2 text-[10px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 px-2 py-1 rounded w-fit border border-indigo-100 dark:border-indigo-500/20"><TrendingUp size={10}/> <span>{inter.pipeline.product} (฿{inter.pipeline.value.toLocaleString()}) — {stageLabels[inter.pipeline.stage] || inter.pipeline.stage}</span></div>)}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm space-y-4">
                                            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-2"><ClipboardList size={16} className="text-cyan-500"/> เพิ่มบันทึกกิจกรรม / การเข้าพบ</h3>
                                            <div className="space-y-1.5 relative">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase">1. เลือกลูกค้า / ผู้ติดต่อ</label>
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-3 text-slate-400" size={14} />
                                                    <input type="text" value={contactSearch} onChange={(e) => { setContactSearch(e.target.value); setIsContactDropdownOpen(true); setSelectedCustomer(null); }} placeholder="ค้นหาชื่อผู้ติดต่อ..." className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-slate-900 dark:text-white outline-none focus:border-cyan-500 text-sm" />
                                                    {isContactDropdownOpen && (
                                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 max-h-40 overflow-y-auto">
                                                            {getFilteredCustomers(ci.location).map((c, i) => (
                                                                <div key={i} onClick={() => handleSelectCustomer(c.name, c.department)} className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer text-sm border-b border-slate-100 dark:border-white/5 last:border-0 flex justify-between">
                                                                    <span className="text-slate-900 dark:text-white">{c.name}</span>
                                                                    <span className="text-xs text-slate-500">{c.department}</span>
                                                                </div>
                                                            ))}
                                                            {contactSearch && <div onClick={() => setShowAddContactView(true)} className="px-4 py-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 cursor-pointer text-sm flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold"><Plus size={14} /> สร้างรายชื่อใหม่ "{contactSearch}"</div>}
                                                        </div>
                                                    )}
                                                </div>
                                                {selectedCustomer && <div className="text-xs text-emerald-500 flex items-center gap-1"><Check size={12}/> เลือกแล้ว: <b>{selectedCustomer.name}</b></div>}
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase">2. สรุปรายละเอียดการสนทนา</label>
                                                <textarea value={currentSummary} onChange={(e) => setCurrentSummary(e.target.value)} placeholder="สรุปหัวข้อที่ได้พูดคุยหรือความคืบหน้า..." rows={3} className="w-full bg-slate-50 dark:bg-black/30 border-2 border-slate-100 dark:border-white/5 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-cyan-500 focus:bg-white dark:focus:bg-slate-800 text-sm resize-none shadow-inner" />
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-[10px] font-bold text-indigo-500 uppercase flex items-center gap-1"><TrendingUp size={12}/> 3. เพิ่มโอกาสการขาย (โอกาสเดิมหรือดีลใหม่)?</label>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input type="checkbox" checked={hasOpp} onChange={(e) => setHasOpp(e.target.checked)} className="sr-only peer"/>
                                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                                                    </label>
                                                </div>
                                                {hasOpp && (
                                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl border border-indigo-100 dark:border-indigo-500/20 space-y-2 animate-enter">
                                                        <div className="flex p-1 bg-white/50 dark:bg-black/20 rounded-lg mb-2">
                                                            <button onClick={() => { setDealMode('new'); setPipelineProduct(''); setPipelineValue(''); }} className={`flex-1 text-[10px] py-1.5 rounded-md font-bold transition-all ${dealMode === 'new' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-500'}`}>ดีลใหม่</button>
                                                            <button onClick={() => setDealMode('update')} className={`flex-1 text-[10px] py-1.5 rounded-md font-bold transition-all ${dealMode === 'update' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500'}`}>อัปเดตดีลเดิม</button>
                                                        </div>
                                                        {dealMode === 'update' && (
                                                            <select value={selectedExistingDealId} onChange={(e) => handleExistingDealSelect(e.target.value)} className="w-full p-2 rounded-lg bg-white dark:bg-black/20 border border-amber-200 dark:border-amber-500/30 text-xs outline-none focus:border-amber-500 text-slate-700 dark:text-white appearance-none">
                                                                <option value="">-- เลือกดีลที่ต้องการอัปเดต --</option>
                                                                {activeDeals.map(deal => (<option key={deal.id} value={deal.id}>{deal.product} ({stageLabels[deal.stage] || deal.stage})</option>))}
                                                            </select>
                                                        )}
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <input value={pipelineProduct} onChange={e => setPipelineProduct(e.target.value)} placeholder="ชื่อสินค้า / โปรเจกต์" className="w-full p-2 rounded-lg bg-white dark:bg-black/20 border border-indigo-200 dark:border-indigo-500/30 text-xs outline-none focus:border-indigo-500"/>
                                                            <input type="number" value={pipelineValue} onChange={e => setPipelineValue(e.target.value)} placeholder="มูลค่า (บาท)" className="w-full p-2 rounded-lg bg-white dark:bg-black/20 border border-indigo-200 dark:border-indigo-500/30 text-xs outline-none focus:border-indigo-500"/>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <select value={pipelineStage} onChange={e => setPipelineStage(e.target.value)} className="w-full p-2 rounded-lg bg-white dark:bg-black/20 border border-indigo-200 dark:border-indigo-500/30 text-xs outline-none">
                                                                {pipelineStages.map(s => <option key={s} value={s}>{stageLabels[s] || s}</option>)}
                                                            </select>
                                                            <div className="flex items-center gap-2 px-1 text-xs text-slate-500"><span>โอกาส: {pipelineProb}%</span><input type="range" min="0" max="100" step="10" value={pipelineProb} onChange={e => setPipelineProb(parseInt(e.target.value))} className="w-16 accent-indigo-500"/></div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <button onClick={() => addInteractionToDraft(idx)} disabled={!selectedCustomer || !currentSummary} className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                                            <Plus size={16} /> บันทึกกิจกรรมลงร่าง
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="pt-4 pb-12 z-[100] relative">
                    {isFinalCheckout ? (
                        <button 
                            onClick={() => confirmCheckOut(true)} 
                            disabled={isSavingReport} 
                            className={`w-full bg-gradient-to-r ${isCheckedOut ? 'from-amber-500 to-orange-600' : 'from-emerald-500 to-cyan-600'} text-white font-bold py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 transform active:scale-95 transition-all`}
                        >
                            {isSavingReport ? <Loader2 className="animate-spin" /> : <><Check size={24} /> {isCheckedOut ? 'อัปเดตข้อมูลรายงาน' : 'ส่งรายงานทั้งหมดและเช็คเอาท์'}</>}
                        </button>
                    ) : (
                        <button 
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); confirmCheckOut(false); }} 
                            disabled={isSavingReport} 
                            className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-4 rounded-2xl shadow-xl border-2 border-white/10 flex items-center justify-center gap-2 disabled:opacity-50 transform active:scale-95 transition-all"
                        >
                            {isSavingReport ? <Loader2 className="animate-spin" /> : <><Save size={20} /> บันทึกร่างกิจกรรมและกลับ</>}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    const remindersItems = reminders.map(r => `• ${r.title} (${new Date(r.dueTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })})`);
    const itineraryItems = (todayPlan?.itinerary || [])
        .filter(it => !todayData?.checkIns.some(ci => ci.location === it.location))
        .map(it => `• แผนงาน: ${it.location} (${it.objective})`);
    
    const marqueeItems = [...remindersItems, ...itineraryItems];
    const marqueeText = marqueeItems.length > 0 ? marqueeItems.join('     ') : '• ไม่มีกิจกรรมค้างในวันนี้';

    return (
        <div className="h-full flex flex-col bg-[#F5F5F7] dark:bg-[#020617]">
            <div className="w-full max-w-2xl mx-auto flex flex-col min-h-full">
                <div className="px-4 pt-4 mb-2 z-20 sticky top-0">
                    <div className={`relative rounded-[28px] shadow-2xl pb-8 pt-8 px-6 overflow-hidden transition-all duration-500 ${theme.cardBg}`}>
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
                            <button onClick={() => navigate('/settings')} className={`p-2.5 rounded-full ${theme.settingsBtn}`}><Settings size={22} /></button>
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
                                    <Flame size={20} />
                                    <span className={`text-xl font-bold ${theme.textPrimary}`}>{profile?.currentStreak || 0}</span>
                                </div>
                                <span className={`text-[8px] font-bold uppercase tracking-wider ${theme.textSecondary}`}>ความต่อเนื่อง</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto px-4 pt-2 pb-28 space-y-6">
                    {xpParticles.map((p) => (<div key={p.id} className="animate-fly-xp flex items-center justify-center"><div className="bg-gradient-to-br from-amber-400 to-orange-500 text-white font-black text-3xl px-6 py-3 rounded-full shadow-lg border-2 border-white/40"><Zap className="fill-white" size={28} /> +{p.xp}</div></div>))}
                    <div className="relative rounded-[32px] border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl overflow-visible" ref={dropdownRef}>
                        <div className="h-56 w-full relative overflow-hidden rounded-t-[32px]">
                            {location ? (
                                <MapDisplay 
                                    lat={location.lat} 
                                    lng={location.lng} 
                                    markers={[{
                                        lat: location.lat,
                                        lng: location.lng,
                                        text: profile?.name || user.email || 'ตำแหน่งของฉัน',
                                        photo: profile?.photoBase64
                                    }]}
                                    className="h-full w-full" zoom={15} 
                                />
                            ) : (
                                <div className="h-full w-full bg-slate-100 dark:bg-slate-950 flex items-center justify-center text-slate-500 text-xs gap-2"><Navigation size={14} className="animate-spin" /> ค้นหาตำแหน่ง GPS...</div>
                            )}
                            {marqueeItems.length > 0 && (
                                <div className="absolute top-4 left-4 right-14 z-30 pointer-events-auto">
                                    <div onClick={() => navigate('/reminders')} className="group relative w-full h-8 bg-slate-900/40 backdrop-blur-md rounded-full border border-white/20 shadow-lg overflow-hidden flex items-center cursor-pointer transition-all hover:bg-slate-900/60 active:scale-[0.98]">
                                        <div className="flex-shrink-0 w-8 h-full flex items-center justify-center bg-rose-500 text-white relative z-20"><Bell size={14} className="animate-[wiggle_1s_ease-in-out_infinite]" /></div>
                                        <div className="flex-1 h-full overflow-hidden relative flex items-center whitespace-nowrap z-10"><div className="inline-block animate-marquee pl-3"><span className="text-[10px] font-black text-white uppercase tracking-wide">{marqueeText}</span><span className="text-[10px] font-black text-white uppercase tracking-wide ml-10">{marqueeText}</span></div></div>
                                    </div>
                                </div>
                            )}
                            <button onClick={getLocation} className="absolute top-3 right-3 bg-white/30 dark:bg-slate-900/40 backdrop-blur-md p-2 rounded-full text-white shadow-lg border border-white/20 z-20 hover:bg-white/50 transition-all active:scale-90"><Navigation size={18} /></button>
                            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/60 via-black/30 to-transparent pointer-events-none z-10"></div>
                            <div className="absolute bottom-4 left-4 z-20 pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                                <div className="text-3xl font-black text-white leading-none">{time.toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}</div>
                                <div className="text-[10px] text-white/90 font-black uppercase tracking-wider mt-1">{time.toLocaleDateString('th-TH', {weekday: 'short', day: 'numeric', month: 'short'})}</div>
                            </div>
                            <div className="absolute bottom-4 right-4 z-20">
                                <div className={`px-3 py-1 rounded-full text-[9px] font-black border uppercase tracking-widest shadow-xl backdrop-blur-md ${currentStage === 'working' ? 'bg-emerald-500/80 border-emerald-400 text-white' : currentStage === 'completed' ? 'bg-slate-600/80 border-slate-500 text-white' : 'bg-cyan-500/80 border-cyan-400 text-white'}`}>{currentStage === 'working' ? 'กำลังทำงาน' : currentStage === 'completed' ? 'เลิกงานแล้ว' : 'พร้อมทำงาน'}</div>
                            </div>
                        </div>
                        <div className="p-4 space-y-4">
                            {todayPlan && todayPlan.itinerary && todayPlan.itinerary.length > 0 && !isCheckedOut && (
                                <div className="animate-enter">
                                    <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2 mb-2 ml-1"><Target size={12} /> เป้าหมายวันนี้จากแผนงาน</label>
                                    <div className="flex flex-wrap gap-2">
                                        {todayPlan.itinerary.map((it, idx) => {
                                            const isCheckedIn = todayData?.checkIns.some(ci => ci.location === it.location);
                                            return (
                                                <button key={idx} onClick={() => handleSelectLocation(it.location)} className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 border shadow-sm active:scale-95 ${selectedPlace === it.location ? 'bg-indigo-600 border-indigo-500 text-white shadow-indigo-500/20' : isCheckedIn ? 'bg-slate-50 dark:bg-slate-800 border-emerald-500/30 text-emerald-500 opacity-60' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-300 hover:border-indigo-500'}`}>{isCheckedIn ? <Check size={14} /> : <MapPin size={14} />}{it.location}</button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            <div className="relative group shadow-lg rounded-2xl">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Search size={18} className="text-slate-400" /></div>
                                <input type="text" value={searchQuery} onChange={(e) => { const val = e.target.value; setSearchQuery(val); setIsDropdownOpen(true); if(val === '') setSelectedPlace(''); }} onFocus={() => setIsDropdownOpen(true)} placeholder="เลือกสถานที่เพื่อเช็คอิน..." className="block w-full pl-11 pr-4 py-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all text-sm font-medium" />
                                {isDropdownOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-[100] max-h-52 overflow-y-auto ring-1 ring-black/5">
                                        {filteredLocations.length > 0 ? (
                                            filteredLocations.map((loc, idx) => (
                                                <button key={idx} onClick={() => handleSelectLocation(loc)} className="w-full text-left px-5 py-4 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 text-sm flex justify-between items-center border-b border-slate-100 dark:border-white/5 last:border-0 transition-colors"><div className="flex items-center gap-3"><Building size={16} className="text-slate-400" /><span className="font-bold">{loc}</span></div>{selectedPlace === loc && <Check size={14} className="text-cyan-500" />}</button>
                                            ))
                                        ) : (<div className="px-5 py-8 text-center text-slate-400 text-sm italic">ไม่พบสถานที่ที่ตรงกับคำค้นหา</div>)}
                                        {searchQuery && !profile?.hospitals.some(h => h.toLowerCase() === searchQuery.toLowerCase()) && (
                                            <button onClick={handleAddNewLocation} className="w-full text-left px-5 py-4 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 text-sm flex items-center gap-3 border-t-2 border-slate-100 dark:border-white/10 sticky bottom-0 bg-white dark:bg-slate-900 font-black"><div className="bg-cyan-500 text-white p-1 rounded-full"><Plus size={14} /></div>เพิ่มรายชื่อใหม่: "{searchQuery}"</button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={handleCheckIn} disabled={isCheckedOut || !selectedPlace} className={`relative group h-32 rounded-[32px] flex flex-col items-center justify-center transition-all duration-300 overflow-hidden ${isCheckedOut || !selectedPlace ? 'bg-slate-100 dark:bg-slate-800 opacity-50 cursor-not-allowed text-slate-400' : 'bg-gradient-to-br from-emerald-400 to-emerald-600 dark:from-emerald-600 dark:to-emerald-800 shadow-emerald-500/20 active:scale-95'}`}><Plus size={36} className={`${isCheckedOut || !selectedPlace ? 'text-slate-400' : 'text-white'} mb-2`} /><span className={`${isCheckedOut || !selectedPlace ? 'text-slate-400' : 'text-white'} font-black text-xl tracking-tight`}>เช็คอิน</span></button>
                        <button onClick={handleCheckOutStart} disabled={!isCheckedInToday} className={`relative group h-32 rounded-[32px] flex flex-col items-center justify-center transition-all duration-300 overflow-hidden ${!isCheckedInToday ? 'bg-slate-100 dark:bg-slate-800 opacity-50 cursor-not-allowed text-slate-400' : isCheckedOut ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-gradient-to-br from-rose-400 to-rose-600 shadow-rose-500/20 active:scale-95'}`}>{isCheckedOut ? <Edit size={36} className="text-white mb-2" /> : <LogOut size={36} className={`${!isCheckedInToday ? 'text-slate-400' : 'text-white'} mb-2`} />}<span className={`${!isCheckedInToday ? 'text-slate-400' : 'text-white'} font-black text-xl tracking-tight uppercase`}>{isCheckedOut ? 'แก้ไขรายงาน' : 'เช็คเอาท์'}</span></button>
                    </div>
                    {statusMsg && <div className="text-center text-cyan-600 text-sm py-3 bg-cyan-50 dark:bg-cyan-950/30 rounded-2xl border border-cyan-100 dark:border-cyan-500/20">{statusMsg}</div>}
                    <div className="pt-2 pb-10">
                        <div className="flex items-center gap-2 mb-4 px-2 opacity-60"><Calendar size={14} className="text-slate-500" /><h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">เส้นทางวันนี้</h3></div>
                        <div className="relative pl-4 space-y-4 border-l border-slate-200 dark:border-slate-800 ml-3">
                            {todayData?.checkIns.map((ci, idx) => {
                                const draft = visitDrafts[idx] || { interactions: [] };
                                const hasInteractions = draft.interactions.length > 0;
                                return (
                                    <div key={idx} className="relative pl-6 group">
                                        <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-lg ring-4 ring-white dark:ring-slate-950 transition-transform group-hover:scale-125"></div>
                                        <div className="flex justify-between items-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-4 rounded-2xl shadow-sm hover:border-cyan-500/30 transition-all">
                                            <div className="flex-1 min-w-0 pr-4">
                                                <div className="text-slate-900 dark:text-white font-bold text-sm truncate">{ci.location}</div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px]">{ci.timestamp.toDate().toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}</span>
                                                    {hasInteractions && (
                                                        <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[8px] font-black rounded-full uppercase border border-emerald-200 dark:border-emerald-500/20 flex items-center gap-1"><Check size={8}/> บันทึก {draft.interactions.length} รายการ</span>
                                                    )}
                                                </div>
                                            </div>
                                            <button onClick={() => handleOpenVisitReport(idx)} className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-slate-50 dark:bg-slate-800/50 text-slate-400 hover:bg-cyan-50 hover:text-cyan-600 rounded-xl transition-all active:scale-90 border border-transparent" title="บันทึกกิจกรรม"><MessageSquare size={18} /></button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
            <style dangerouslySetInnerHTML={{ __html: `@keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } } .animate-marquee { animation: marquee 15s linear infinite; display: inline-block; } @keyframes wiggle { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(10deg); } 75% { transform: rotate(-10deg); } }`}} />
        </div>
    )
}

export default TimeAttendance;