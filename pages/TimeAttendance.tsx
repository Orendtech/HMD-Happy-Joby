
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { User } from 'firebase/auth';
import { 
    Navigation, Plus, LogOut, Calendar, Sparkles, X, Search, Check, 
    Flame, Zap, TrendingUp, Loader2, ArrowLeft, ChevronDown, ChevronUp, 
    UserPlus, Save, User as UserIcon, ClipboardList, Settings, Bell, 
    Target, MapPin, Building, MessageSquare, Edit, Send, Map as MapIcon,
    Trophy, Gift, Star, Coins, Box, Info, ChevronLeft, AlertCircle, ChevronRight,
    PartyPopper, CheckCircle2, Award, Crown, ShieldCheck, Maximize2, Minimize2,
    CalendarCheck, ListChecks, HelpCircle, Activity, Cpu, Radio, Fingerprint
} from 'lucide-react';
import { MapDisplay } from '../components/MapDisplay';
import { GlassCard } from '../components/GlassCard';
import { 
    getUserProfile, getTodayAttendance, checkIn, checkOut, 
    addHospital, addCustomer, getReminders, getWorkPlans, getTodayDateId, getUserHistory,
    updateUserProfile
} from '../services/dbService';
import { UserProfile, AttendanceDay, DailyReport, PipelineData, 
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
    if (level >= 9) return { title: 'LEGEND', color: 'text-amber-400', themeColor: '#f59e0b' }; 
    if (level >= 7) return { title: 'ELITE', color: 'text-rose-400', themeColor: '#e11d48' };  
    if (level >= 5) return { title: 'RANGER', color: 'text-purple-400', themeColor: '#4f46e5' }; 
    if (level >= 3) return { title: 'SCOUT', color: 'text-orange-400', themeColor: '#f97316' };  
    return { title: 'ROOKIE', color: 'text-slate-400', themeColor: '' }; 
};

const cleanFirestoreData = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(v => cleanFirestoreData(v));
    const newObj: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const val = obj[key];
            if (val instanceof HTMLElement || (val && val.current instanceof HTMLElement)) continue;
            newObj[key] = cleanFirestoreData(val);
        }
    }
    return newObj;
};

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
    const [history, setHistory] = useState<AttendanceDay[]>([]);
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
    const [showQuestPage, setShowQuestPage] = useState(false);
    const [showRewardModal, setShowRewardModal] = useState(false);
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
            const h = await getUserHistory(user.uid);
            const r = await getReminders(user.uid);
            const plans = await getWorkPlans(user.uid);
            const todayStr = getTodayDateId();
            const foundPlan = plans.find(plan => plan.date === todayStr);
            setTodayPlan(foundPlan || null);
            setProfile(p);
            setTodayData(a);
            setHistory(h);
            const filteredReminders = r.filter(item => !item.isCompleted && item.dueTime.startsWith(todayStr));
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
        } catch (e) { console.error("Refresh failed", e); }
    };

    const currentLevel = profile?.level || 1; 
    const rank = getRankTitle(currentLevel);

    const getWorkingDaysInMonth = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const lastDay = new Date(year, month + 1, 0).getDate();
        let count = 0;
        for (let i = 1; i <= lastDay; i++) {
            const day = new Date(year, month, i).getDay();
            if (day !== 0 && day !== 6) count++; 
        }
        return count;
    };

    const monthlyQuestStats = useMemo(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        
        const currentMonthHistory = history.filter(h => h.id.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`));
        const completedDays = currentMonthHistory.filter(h => 
            h.checkIns.length > 0 && h.report?.visits && h.report.visits.length > 0 && h.checkOut
        ).length;

        const targetDays = getWorkingDaysInMonth(); 
        const progress = Math.min(100, (completedDays / targetDays) * 100);
        const isClaimed = profile?.lastRewardClaimedMonth === `${year}-${String(month+1).padStart(2,'0')}`;
        
        return { completedDays, targetDays, progress, isClaimed };
    }, [history, profile]);

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

    const handleClaimReward = async () => {
        if ("vibrate" in navigator) navigator.vibrate([100, 50, 100, 50, 300]);
        const now = new Date();
        const monthId = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        try {
            setIsSavingReport(true);
            await updateUserProfile(user.uid, { lastRewardClaimedMonth: monthId } as any);
            setShowRewardModal(true);
            await refreshData();
        } catch (e) {
            console.error(e);
        } finally {
            setIsSavingReport(false);
        }
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
            if (!todayData?.checkIns || todayData.checkIns.length === 0) { alert("ไม่พบข้อมูลการเช็คอินของวันนี้"); setIsSavingReport(false); return; }
            const visits: VisitReport[] = todayData.checkIns.map((ci, idx) => { 
                const draft = visitDrafts[idx] || { interactions: [] }; 
                const interactions = draft.interactions.map(d => {
                    const interaction: Interaction = { customerName: d.customerName, department: d.department || "", summary: d.summary || "" };
                    if (d.pipeline) interaction.pipeline = d.pipeline;
                    return interaction;
                });
                const aggregatedSummary = interactions.map(i => `${i.customerName}: ${i.summary}`).join('\n'); 
                const aggregatedMetWith = interactions.map(i => i.customerName); 
                const aggregatedPipeline = interactions.filter(i => i.pipeline).map(i => i.pipeline!); 
                return { location: ci.location, checkInTime: ci.timestamp, summary: aggregatedSummary, metWith: aggregatedMetWith, pipeline: aggregatedPipeline, interactions: interactions }; 
            }); 
            const rawReport: DailyReport = { visits }; 
            const cleanedReport = cleanFirestoreData(rawReport);
            await checkOut(user.uid, cleanedReport, undefined, final); 
            if ("vibrate" in navigator) navigator.vibrate([100, 50, 100]);
            if (final) alert(todayData?.checkOut ? 'อัปเดตรายงานเรียบร้อยแล้ว' : 'บันทึกรายงานและเช็คเอาท์เรียบร้อยแล้ว');
            else alert('บันทึกร่างกิจกรรมเรียบร้อยแล้ว');
            setShowReportModal(false);
            await refreshData(); 
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (e) { console.error("Firestore Save Error:", e); alert('ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง'); } finally { setIsSavingReport(false); }
    };
    
    const filteredLocations = searchQuery === '' ? (profile?.hospitals || []) : (profile?.hospitals.filter(h => h.toLowerCase().includes(searchQuery.toLowerCase())) || []);
    const handleSelectLocation = (loc: string) => { setSelectedPlace(loc); setSearchQuery(loc); setIsDropdownOpen(false); };
    const handleAddNewLocation = async () => { if (!searchQuery.trim()) return; try { await addHospital(user.uid, searchQuery.trim()); await refreshData(); handleSelectLocation(searchQuery.trim()); } catch (e) { setStatusMsg('เพิ่มสถานที่ล้มเหลว'); } };

    const isCheckedInToday = todayData && todayData.checkIns.length > 0;
    const isCheckedOut = todayData && !!todayData.checkOut;
    const currentStage = isCheckedOut ? 'completed' : isCheckedInToday ? 'working' : 'idle';
    
    const getBadgeInfo = (role?: string) => {
        if (role === 'admin') return { label: 'ADMIN', color: 'text-indigo-400', icon: <Crown size={12} /> };
        if (role === 'manager') return { label: 'MANAGER', color: 'text-emerald-400', icon: <ShieldCheck size={12} /> };
        return { label: 'FIELD', color: 'text-cyan-400', icon: <UserIcon size={12} /> };
    };

    const handleOpenVisitReport = (idx: number) => { setExpandedVisitIdx(idx); setIsFinalCheckout(false); setShowReportModal(true); };
    const handleCheckOutStart = () => { if ("vibrate" in navigator) navigator.vibrate(100); setIsFinalCheckout(true); setExpandedVisitIdx(0); setShowReportModal(true); };

    if (showRewardModal) {
        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-50 dark:bg-black px-6 overflow-hidden transition-colors duration-500">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.1)_0%,transparent_70%)] dark:bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.15)_0%,transparent_70%)]"></div>
                
                <div className="absolute inset-0 pointer-events-none">
                    {Array.from({ length: 20 }).map((_, i) => (
                        <div key={i} 
                             className="absolute text-2xl animate-[confetti_3s_ease-in-out_infinite]"
                             style={{ 
                                left: `${Math.random() * 100}%`, 
                                animationDelay: `${Math.random() * 2}s`,
                                top: `-5%`
                             }}
                        >
                            {['✨', '💰', '🎉', '🌟'][Math.floor(Math.random()*4)]}
                        </div>
                    ))}
                </div>

                <div className="relative w-full max-sm text-center space-y-8 animate-bounce-in">
                    <div className="relative inline-block">
                        <div className="absolute -inset-8 bg-amber-500/20 dark:bg-amber-500/30 rounded-full blur-[40px] animate-pulse"></div>
                        <div className="w-32 h-32 bg-gradient-to-br from-amber-400 to-orange-600 rounded-[40px] flex items-center justify-center shadow-[0_20px_50px_rgba(245,158,11,0.3)] dark:shadow-[0_20px_50px_rgba(245,158,11,0.5)] border-4 border-white/50 dark:border-white/30 relative z-10 rotate-12">
                            <PartyPopper size={64} className="text-white fill-white/20" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Quest Complete!</h2>
                        <p className="text-amber-600 dark:text-amber-400 font-black text-xs uppercase tracking-[0.3em]">ภารกิจรายเดือนสำเร็จแล้ว</p>
                          <p className="text-slate-600 dark:text-slate-500 text-[10px] font-medium mt-4 leading-relaxed">
                            ระบบได้ทำการบันทึกรางวัลของคุณเข้าสู่พอร์ตสะสมเรียบร้อยแล้ว ขอบคุณสำหรับความตั้งใจตลอดเดือนที่ผ่านมา
                        </p>
                    </div>

                    <button 
                        onClick={() => setShowRewardModal(false)}
                        className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-black py-5 rounded-[24px] shadow-2xl active:scale-95 transition-all uppercase tracking-widest text-sm"
                    >
                        Great! Continue Work
                    </button>
                </div>

                <style dangerouslySetInnerHTML={{ __html: `
                    @keyframes confetti {
                        0% { transform: translateY(0) rotate(0deg); opacity: 1; }
                        100% { transform: translateY(110vh) rotate(360deg); opacity: 0; }
                    }
                `}} />
            </div>
        );
    }

    if (showQuestPage) {
        return (
            <div className="h-[100dvh] flex flex-col bg-[#F5F5F7] dark:bg-black text-slate-900 dark:text-white animate-enter overflow-hidden transition-colors duration-500">
                {/* Ultra-Compact Premium Header */}
                <header className="px-4 py-3 flex items-center gap-3 z-20 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border-b border-slate-100 dark:border-white/5 shrink-0">
                    <button 
                        onClick={() => setShowQuestPage(false)} 
                        className="p-2.5 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 rounded-xl text-slate-700 dark:text-white transition-all active:scale-95"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Monthly Quest</h2>
                        <p className="text-[9px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider">สะสมรางวัลภารกิจรายเดือน</p>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto pb-8 px-3 pt-4 space-y-4 relative no-scrollbar">
                    {/* Glowing Accent Blur in Background */}
                    <div className="absolute top-10 right-0 w-48 h-48 bg-amber-500/5 dark:bg-amber-500/10 rounded-full blur-[80px] pointer-events-none"></div>
                    
                    <div className="relative z-10 space-y-4">
                        {/* UNIFIED PREMIUM MEMBERSHIP-STYLE QUEST CARD */}
                        <div className="relative rounded-2xl overflow-hidden shadow-lg border border-amber-500/20 bg-slate-950 text-white p-4">
                            {/* Card Background Pattern */}
                            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-orange-950/40 pointer-events-none"></div>
                            <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
                            <Coins className="absolute -right-10 -bottom-10 text-amber-500/5 w-36 h-36 rotate-12 pointer-events-none" />

                            <div className="relative z-10 space-y-3.5">
                                {/* Top: Trophy and Reward text */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-300 via-amber-500 to-orange-600 p-[1.5px] shadow-lg">
                                            <div className="w-full h-full bg-slate-900 rounded-[11px] flex items-center justify-center">
                                                <Trophy size={20} className="text-amber-400 fill-amber-400" />
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-[8px] font-black tracking-widest text-amber-400 uppercase block leading-none">GRAND QUEST PRIZE</span>
                                            <h3 className="text-white font-black text-2xl tracking-tight leading-normal">฿500 <span className="text-xs font-bold text-slate-400 tracking-normal">CASH REWARD</span></h3>
                                        </div>
                                    </div>

                                    {/* Star Stamp badge */}
                                    <div className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/20 rounded-lg border border-amber-500/30">
                                        <Star size={11} className="text-amber-400 fill-amber-400 animate-pulse" />
                                        <span className="text-[10px] font-mono font-black text-amber-400">{Math.round(monthlyQuestStats.progress)}%</span>
                                    </div>
                                </div>

                                {/* Progress Slider Bar - extremely integrated and sleek */}
                                <div className="space-y-1.5 pt-1.5 border-t border-white/5">
                                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                                        <span>PROGRESS ROADMAP</span>
                                        <span className="font-mono text-white">
                                            {monthlyQuestStats.completedDays}/{monthlyQuestStats.targetDays} <span className="text-slate-400 text-[8px]">DAYS COMPLETE</span>
                                        </span>
                                    </div>
                                    <div className="h-2.5 w-full bg-black/40 rounded-full overflow-hidden p-[1px] border border-white/5">
                                        <div 
                                            style={{ width: `${monthlyQuestStats.progress}%` }} 
                                            className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 rounded-full transition-all duration-1000 relative"
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SLICK VERTICAL TIMELINE CHECKLIST */}
                        <div className="space-y-2.5">
                            <div className="flex items-center gap-1.5 px-1.5">
                                <HelpCircle size={14} className="text-amber-500" />
                                <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest leading-none">เงื่อนไขการสะสมวันทำงาน</h3>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-2">
                                {/* Step 1 */}
                                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-white/5 flex gap-3 items-center">
                                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0 border border-cyan-500/20 text-cyan-500">
                                        <MapPin size={16} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1 leading-none">
                                            <span className="text-[10px] text-cyan-500 font-mono">01.</span> เช็คอินเข้าสถานที่ทำงาน
                                        </h4>
                                        <p className="text-[10px] text-slate-400 mt-0.5 leading-tight truncate">เช็คอินที่สถานพยาบาลหรือสถานที่นัดพบในแต่ละวัน</p>
                                    </div>
                                </div>

                                {/* Step 2 */}
                                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-white/5 flex gap-3 items-center">
                                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0 border border-purple-500/20 text-purple-500">
                                        <ClipboardList size={16} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1 leading-none">
                                            <span className="text-[10px] text-purple-500 font-mono">02.</span> บันทึกรายงานกิจกรรม
                                        </h4>
                                        <p className="text-[10px] text-slate-400 mt-0.5 leading-tight truncate">บันทึกประเด็นที่พูดคุยหรือกิจกรรมที่มีคุณภาพ 1 รายการ</p>
                                    </div>
                                </div>

                                {/* Step 3 */}
                                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-white/5 flex gap-3 items-center">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20 text-emerald-500">
                                        <LogOut size={16} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1 leading-none">
                                            <span className="text-[10px] text-emerald-500 font-mono">03.</span> เช็คเอาท์ส่งสรุปจบวัน
                                        </h4>
                                        <p className="text-[10px] text-slate-400 mt-0.5 leading-tight truncate">กดบันทึกรายงานเลิกงานเพื่อส่งวันคุณภาพเข้าระบบ</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* HIGH-END XP POINT LIST */}
                        <div className="space-y-2">
                             <div className="flex items-center gap-1.5 px-1.5">
                                <Zap size={14} className="text-cyan-500" />
                                <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest leading-none">คะแนนสะสม XP และโบนัสพิเศษ</h3>
                            </div>
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-white/5 overflow-hidden">
                                <div className="divide-y divide-slate-100 dark:divide-white/5 text-[11px] font-bold">
                                    <div className="px-3.5 py-2 flex justify-between items-center bg-slate-50/50 dark:bg-white/5">
                                        <span className="text-slate-500 dark:text-slate-300">เช็คอินเช้า (ก่อน 09:00 น.) Early Bonus</span>
                                        <span className="font-extrabold text-cyan-500 font-mono">+50 XP</span>
                                    </div>
                                    <div className="px-3.5 py-2 flex justify-between items-center">
                                        <span className="text-slate-400 dark:text-slate-400">เช็คอินเข้างานปกติช่วงวัน</span>
                                        <span className="font-extrabold text-slate-600 dark:text-slate-300 font-mono">+15 XP</span>
                                    </div>
                                    <div className="px-3.5 py-2 flex justify-between items-center bg-orange-500/[0.02]">
                                        <div className="flex flex-col">
                                            <span className="text-orange-600 dark:text-orange-400 font-black">Streak Bonus (สะสมเข้างานต่อเนื่อง)</span>
                                            <span className="text-[8px] text-slate-400 font-medium">เพิ่มทวีคูณตามคอมโบความต่อเนื่องทำงาน</span>
                                        </div>
                                        <span className="font-extrabold text-orange-500 font-mono">สูงสุด +50</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* BOTTOM ACTION - CLAIM BUTTON */}
                        <div className="pt-2">
                            <button 
                                onClick={handleClaimReward}
                                disabled={monthlyQuestStats.progress < 100 || monthlyQuestStats.isClaimed || isSavingReport}
                                className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 ${
                                    monthlyQuestStats.isClaimed 
                                        ? 'bg-emerald-500 text-white shadow-emerald-500/10' 
                                        : monthlyQuestStats.progress >= 100 
                                            ? 'bg-gradient-to-r from-amber-400 to-orange-600 text-white shadow-orange-500/20 hover:scale-[1.01]' 
                                            : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-75'
                                }`}
                            >
                                {monthlyQuestStats.isClaimed ? <CheckCircle2 size={16} /> : <Gift size={16} />}
                                {monthlyQuestStats.isClaimed ? 'CLAIMED' : monthlyQuestStats.progress >= 100 ? 'CLAIM ฿500 NOW' : `สะสมอีก ${monthlyQuestStats.targetDays - monthlyQuestStats.completedDays} วันเพื่อรับรางวัล`}
                            </button>
                            <p className="text-center text-[8.5px] text-slate-400 font-bold mt-2.5 uppercase tracking-widest">ทำภารกิจให้ครบหลักเกณฑ์ทุกวันเพื่อรักษาสิทธิ์ของท่าน</p>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    if (showReportModal) {
        if (showAddContactView) {
             return (
                <div className="max-w-2xl mx-auto space-y-6 animate-enter pb-10 pt-12 px-4">
                    <div className="flex items-center gap-4 sticky top-0 bg-[#F5F5F7] dark:bg-black z-20 py-2">
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
            <div className="max-w-2xl mx-auto space-y-6 animate-enter pb-60 pt-12 px-4 relative">
                <div className="flex items-center gap-4 sticky top-0 bg-[#F5F5F7] dark:bg-black z-20 py-2">
                    <button onClick={() => setShowReportModal(false)} className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-200 dark:border-white/10"><ArrowLeft size={20} /></button>
                    <div><h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><Sparkles className="text-purple-500" size={24}/> {isCheckedOut ? 'แก้ไขข้อมูลรายงาน' : (isFinalCheckout ? 'สรุปรายงานการปฏิบัติงาน' : 'บันทึกรายละเอียดกิจกรรม')}</h2><p className="text-sm text-slate-500 dark:text-slate-400">{isCheckedOut ? 'คุณสามารถอัปเดตข้อมูลย้อนหลังได้' : (isFinalCheckout ? `สรุปรายละเอียดการเข้าพบ ${todayData?.checkIns.length} สถานที่` : 'คุณสามารถบันทึกรายละเอียดแต่ละที่ไว้ก่อนได้')}</p></div>
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
                                        <div><div className="font-bold text-slate-900 dark:text-white text-base">{ci.location}</div><div className="text-xs text-slate-500">{ci.timestamp.toDate().toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}</div></div>
                                    </div>
                                    {isExpanded ? <ChevronUp className="text-cyan-500"/> : <ChevronDown className="text-slate-400"/>}
                                </div>
                                {isExpanded && (
                                    <div className="p-5 space-y-6 animate-enter bg-slate-50/50 dark:bg-slate-950/30">
                                        {draft.interactions.length > 0 && (
                                            <div className="space-y-3">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">กิจกรรมที่บันทึกแล้ว ({draft.interactions.length})</label>
                                                {draft.interactions.map((inter, iIdx) => (
                                                    <div key={iIdx} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm relative group"><button onClick={() => removeInteraction(idx, iIdx)} className="absolute top-2 right-2 text-slate-400 hover:text-rose-500"><X size={16}/></button><div className="flex items-center gap-2 mb-1"><UserIcon size={14} className="text-purple-500"/><span className="font-bold text-slate-900 dark:text-white text-sm">{inter.customerName}</span><span className="text-xs text-slate-500">({inter.department})</span></div><p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium pl-10">"{inter.summary}"</p>{inter.pipeline && (<div className="ml-5 flex items-center gap-2 text-[10px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 px-2 py-1 rounded w-fit border border-indigo-100 dark:border-indigo-500/20"><TrendingUp size={10}/> <span>{inter.pipeline.product} (฿{inter.pipeline.value.toLocaleString()}) — {stageLabels[inter.pipeline.stage] || inter.pipeline.stage}</span></div>)}</div>
                                                ))}
                                            </div>
                                        )}
                                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm space-y-4">
                                            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-2"><ClipboardList size={16} className="text-orange-500"/> เพิ่มบันทึกกิจกรรม / การเข้าพบ</h3>
                                            <div className="space-y-1.5 relative">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase">1. เลือกลูกค้า / ผู้ติดต่อ</label>
                                                <div className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={14} /><input type="text" value={contactSearch} onChange={(e) => { setContactSearch(e.target.value); setIsContactDropdownOpen(true); setSelectedCustomer(null); }} placeholder="ค้นหาชื่อผู้ติดต่อ..." className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-slate-900 dark:text-white outline-none focus:border-orange-500 text-sm" />{isContactDropdownOpen && (<div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 max-h-40 overflow-y-auto ring-1 ring-black/5">{ (profile?.customers || []).filter(c => c.hospital === ci.location || c.hospital === 'All').filter(c => !contactSearch || c.name.toLowerCase().includes(contactSearch.toLowerCase())).map((c, i) => (<div key={i} onClick={() => handleSelectCustomer(c.name, c.department)} className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer text-sm border-b border-slate-100 dark:border-white/5 last:border-0 flex justify-between"><span className="text-slate-900 dark:text-white">{c.name}</span><span className="text-xs text-slate-500">{c.department}</span></div>))}{contactSearch && <div onClick={() => setShowAddContactView(true)} className="px-4 py-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 cursor-pointer text-sm flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold"><Plus size={14} /> สร้างรายชื่อใหม่ "{contactSearch}"</div>}</div>)}</div>{selectedCustomer && <div className="text-xs text-emerald-500 flex items-center gap-1"><Check size={12}/> เลือกแล้ว: <b>{selectedCustomer.name}</b></div>}
                                            </div>
                                            <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase">2. สรุปรายละเอียดการสนทนา</label><textarea value={currentSummary} onChange={(e) => setCurrentSummary(e.target.value)} placeholder="สรุปหัวข้อที่ได้พูดคุยหรือความคืบหน้า..." rows={3} className="w-full bg-slate-50 dark:bg-black/30 border-2 border-slate-100 dark:border-white/5 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-orange-500 focus:bg-white dark:focus:bg-slate-800 text-sm resize-none shadow-inner" /></div>
                                            <div className="space-y-2"><div className="flex items-center justify-between"><label className="text-[10px] font-bold text-indigo-500 uppercase flex items-center gap-1"><TrendingUp size={12}/> 3. เพิ่มโอกาสการขาย (โอกาสเดิมหรือดีลใหม่)?</label><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={hasOpp} onChange={(e) => setHasOpp(e.target.checked)} className="sr-only peer"/><div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div></label></div>{hasOpp && (<div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl border border-indigo-100 dark:border-indigo-500/20 space-y-2 animate-enter"><div className="flex p-1 bg-white/50 dark:bg-black/20 rounded-lg mb-2"><button onClick={() => { setDealMode('new'); setPipelineProduct(''); setPipelineValue(''); }} className={`flex-1 text-[10px] py-1.5 rounded-md font-bold transition-all ${dealMode === 'new' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-500'}`}>ดีลใหม่</button><button onClick={() => setDealMode('update')} className={`flex-1 text-[10px] py-1.5 rounded-md font-bold transition-all ${dealMode === 'update' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500'}`}>อัปเดตดีลเดิม</button></div>{dealMode === 'update' && (<select value={selectedExistingDealId} onChange={(e) => handleExistingDealSelect(e.target.value)} className="w-full p-2 rounded-lg bg-white dark:bg-black/20 border border-amber-200 dark:border-amber-500/30 text-xs outline-none focus:border-amber-500 text-slate-700 dark:text-white appearance-none"><option value="">-- เลือกดีลที่ต้องการอัปเดต --</option>{(profile?.activePipeline || []).map(deal => (<option key={deal.id} value={deal.id}>{deal.product} ({stageLabels[deal.stage] || deal.stage})</option>))}</select>)}<div className="grid grid-cols-2 gap-2"><input value={pipelineProduct} onChange={e => setPipelineProduct(e.target.value)} placeholder="ชื่อสินค้า / โปรเจกต์" className="w-full p-2 rounded-lg bg-white dark:bg-black/20 border border-indigo-200 dark:border-indigo-500/30 text-xs outline-none focus:border-indigo-500"/><input type="number" value={pipelineValue} onChange={e => setPipelineValue(e.target.value)} placeholder="มูลค่า (บาท)" className="w-full p-2 rounded-lg bg-white dark:bg-black/20 border border-indigo-200 dark:border-indigo-500/30 text-xs outline-none focus:border-indigo-500"/></div><div className="grid grid-cols-2 gap-2"><select value={pipelineStage} onChange={e => setPipelineStage(e.target.value)} className="w-full p-2 rounded-lg bg-white dark:bg-black/20 border border-indigo-200 dark:border-indigo-500/30 text-xs outline-none">{['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'].map(s => <option key={s} value={s}>{stageLabels[s] || s}</option>)}</select><div className="flex items-center gap-2 px-1 text-xs text-slate-500"><span>โอกาส: {pipelineProb}%</span><input type="range" min="0" max="100" step="10" value={pipelineProb} onChange={e => setPipelineProb(parseInt(e.target.value))} className="w-16 accent-indigo-500"/></div></div></div>)}</div>
                                        </div>
                                        <button onClick={() => addInteractionToDraft(idx)} disabled={!selectedCustomer || !currentSummary} className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 text-center"><Plus size={16} /> บันทึกกิจกรรมลงร่าง</button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="pt-4 pb-12 z-[100] relative">{isFinalCheckout ? (<button onClick={() => confirmCheckOut(true)} disabled={isSavingReport} className={`w-full bg-gradient-to-r ${isCheckedOut ? 'from-amber-500 to-orange-600' : 'from-emerald-500 to-orange-500'} text-white font-bold py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 transform active:scale-95 transition-all text-center`}>{isSavingReport ? <Loader2 className="animate-spin" /> : <><Check size={24} /> {isCheckedOut ? 'อัปเดตข้อมูลรายงาน' : 'ส่งรายงานทั้งหมดและเช็คเอาท์'}</>}</button>) : (<button onClick={(e) => { e.preventDefault(); e.stopPropagation(); confirmCheckOut(false); }} disabled={isSavingReport} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-4 rounded-2xl shadow-xl border-2 border-white/10 flex items-center justify-center gap-2 disabled:opacity-50 transform active:scale-95 transition-all text-center">{isSavingReport ? <Loader2 className="animate-spin" /> : <><Save size={20} /> บันทึกร่างกิจกรรมและกลับ</>}</button>)}</div>
            </div>
        );
    }

    const badge = getBadgeInfo(profile?.role);

    return (
        <div className="w-full max-w-md mx-auto space-y-3.5 px-3 pb-8 pt-2">
            {/* ELEGANT OFFICIAL EMPLOYEE ID CARD DESIGN - Extremely compact & responsive */}
            <div className="relative z-30 pt-1 pb-1">
                {/* Lanyard Strap Extending from top and a metallic badge holder clip */}
                <div className="flex flex-col items-center justify-center -mb-2 relative z-20">
                    {/* Woven strap texture going straight up */}
                    <div className="w-3.5 h-6 bg-gradient-to-r from-orange-600 via-orange-500 to-orange-700 shadow-sm border-x border-orange-800/25 rounded-b-[2px]"></div>
                    {/* Compact Metallic/Plated steel badge holder bracket */}
                    <div className="w-7 h-3 bg-gradient-to-b from-slate-200 to-slate-400 dark:from-slate-600 dark:to-slate-800 rounded-sm border border-slate-300 dark:border-slate-500 shadow-md flex items-center justify-center relative">
                        <div className="w-2.5 h-0.5 bg-slate-900 dark:bg-black rounded-full shadow-inner"></div>
                        {/* Metallic loop ring hook */}
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full border border-slate-300 dark:border-slate-500 bg-slate-300 dark:bg-slate-700"></div>
                    </div>
                </div>

                {/* Main Compact Badge Card - Orange & White Premium Edition */}
                <div className="relative rounded-2xl overflow-hidden shadow-xl border-2 border-slate-100/80 dark:border-white/5 bg-white dark:bg-slate-950 p-3 text-slate-800 dark:text-white">
                    {/* Dual-Tone Geometric Shapes for Premium Accent */}
                    <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-orange-500/10 to-transparent rounded-full -mr-16 -mt-16 pointer-events-none"></div>
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-orange-500 via-[#e25300] to-amber-500 pointer-events-none"></div>
                    {/* Security Micro Grid Watermark */}
                    <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] dark:opacity-[0.07] pointer-events-none"></div>

                    {/* Card Top Header - Symmetrical & Clean */}
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-1.5 mb-2 pl-2">
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                            <span className="text-[8px] font-black tracking-[0.2em] text-slate-400 dark:text-slate-400 uppercase">
                                HAPPY JOBY
                            </span>
                        </div>
                        <div className="px-1.5 py-0.5 bg-orange-500/10 dark:bg-orange-500/20 rounded border border-orange-500/20">
                            <span className="text-[7px] font-black tracking-widest text-orange-600 dark:text-orange-400 uppercase">
                                OFFICIAL ID BADGE
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-12 gap-2 pl-2 items-center">
                        {/* Photo Column */}
                        <div className="col-span-3 flex justify-center">
                            <div className="relative">
                                <div className="w-12 h-12 rounded-xl p-[1.5px] bg-gradient-to-tr from-orange-500 to-amber-500 shadow-sm">
                                    <div className="w-full h-full bg-slate-100 dark:bg-slate-900 rounded-[10px] overflow-hidden relative">
                                        {profile?.photoBase64 ? (
                                            <img src={profile.photoBase64} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-100 dark:bg-slate-900">
                                                <Fingerprint size={18} className="text-orange-400 animate-pulse" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {/* Active Tracking Security Indicator */}
                                <span className="absolute -bottom-0.5 -right-0.5 flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                </span>
                            </div>
                        </div>

                        {/* Employee Bio details */}
                        <div className="col-span-9 space-y-1 pl-1">
                            <div className="flex items-center justify-between gap-1">
                                <div className="min-w-0">
                                    <span className="text-[6.5px] font-extrabold text-orange-500 dark:text-orange-400 uppercase block leading-none tracking-wider">Employee Name</span>
                                    <h2 className="font-black text-slate-800 dark:text-white truncate text-xs sm:text-xs leading-tight mt-0.5">
                                        {profile?.name || user.email?.split('@')[0]}
                                    </h2>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="text-[6.5px] font-extrabold text-slate-400 uppercase block leading-none tracking-wider">Badge ID</span>
                                    <span className="font-mono text-[7px] font-black text-slate-500 dark:text-slate-350 block mt-0.5 bg-slate-50 dark:bg-white/5 px-1 py-0.5 rounded border border-slate-100 dark:border-white/5">
                                        HJ-{(user.uid || 'EMP').substring(0, 4).toUpperCase()}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-12 gap-1.5 items-center">
                                {/* Department / Role */}
                                <div className="col-span-6 min-w-0">
                                    <span className="text-[6.5px] font-extrabold text-orange-500 dark:text-orange-400 uppercase block leading-none tracking-wider">Role</span>
                                    <div className="inline-flex items-center gap-0.5 font-black uppercase text-[7.5px] truncate mt-1 bg-orange-500 text-white dark:bg-orange-500 dark:text-slate-950 rounded px-1.5 py-0.5 shadow-xs">
                                        {React.cloneElement(badge.icon, { size: 9, className: "text-current" })} {badge.label}
                                    </div>
                                </div>

                                {/* Dynamic XP indicator inside ID Badge */}
                                <div className="col-span-6 bg-slate-50 dark:bg-white/5 px-1.5 py-1 rounded border border-slate-100 dark:border-white/5 space-y-0.5">
                                    <div className="flex justify-between items-center text-[6.5px] font-black leading-none">
                                        <span className="uppercase text-orange-600 dark:text-orange-400 truncate">LV.{currentLevel}</span>
                                        <span className="uppercase text-slate-450 dark:text-slate-400 truncate text-[5.5px] font-bold">{rank.title}</span>
                                    </div>
                                    <div className="h-0.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                                        <div 
                                            style={{ width: `${(profile?.xp || 0) % 100}%` }} 
                                            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500 shadow-[0_0_4px_rgba(249,115,22,0.4)]"
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Integrated barcode and clickable Smart RFID Cash Chip */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-white/10 flex items-center justify-between gap-2 pl-2">
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-[1px] h-3 opacity-80 dark:opacity-90">
                                {[1, 2, 1, 3, 1, 2, 1, 1, 2, 1, 3, 1].map((width, idx) => (
                                    <div 
                                        key={idx} 
                                        className="bg-slate-800 dark:bg-slate-200 h-full" 
                                        style={{ width: `${width}px` }}
                                    ></div>
                                ))}
                            </div>
                            <span className="font-mono text-[5.5px] text-slate-400 tracking-wider">RFID CARD SECURE</span>
                        </div>

                        {/* Clickable Smart Gold-NFC Quest Chip (very cool, compact) */}
                        <button 
                            onClick={() => setShowQuestPage(true)}
                            className="relative overflow-hidden bg-gradient-to-br from-amber-400 via-yellow-300 to-amber-500 border border-amber-600/30 text-slate-950 font-black rounded-lg py-1 px-2 shadow-sm hover:brightness-105 active:scale-95 transition-all text-[8.5px] flex items-center gap-1 shrink-0"
                        >
                            <Coins size={9} className="animate-spin" style={{ animationDuration: '3s' }} />
                            <span>QUEST ฿500</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="space-y-3.5 pt-0.5">
                {xpParticles.map((p) => (<div key={p.id} className="animate-fly-xp flex items-center justify-center fixed inset-0 pointer-events-none z-[200]"><div className="bg-gradient-to-br from-amber-400 to-orange-500 text-white font-black text-2xl px-5 py-2.5 rounded-full shadow-lg border border-white/30"><Zap className="fill-white" size={22} /> +{p.xp}</div></div>))}
                
                {/* Premium Integrated Map & Location Search Unit - highly compact */}
                <div className="relative rounded-2xl border border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 shadow-sm overflow-hidden" ref={dropdownRef}>
                    {/* Map Panel - Compacted for mobile with premium fading edge frames */}
                    <div className="h-32 sm:h-36 w-full relative overflow-hidden">
                        {location ? (
                            <MapDisplay lat={location.lat} lng={location.lng} markers={[{lat: location.lat, lng: location.lng, text: profile?.name || user.email || 'ตำแหน่งของฉัน', photo: profile?.photoBase64}]} className="h-full w-full" zoom={15} />
                        ) : (
                            <div className="h-full w-full bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center text-slate-400 text-xs gap-1 font-sans"><Navigation size={12} className="animate-spin text-orange-500" /> ค้นหาตำแหน่ง GPS...</div>
                        )}
                        <button onClick={getLocation} className="absolute top-2 right-2 bg-slate-950/50 hover:bg-slate-950/75 backdrop-blur-md p-1 rounded-full text-white shadow border border-white/10 z-20 transition-all active:scale-90"><Navigation size={13} /></button>
                        
                        {/* Soft premium edge-blending vignettes to fade the map borders into the card container background */}
                        <div className="absolute top-0 left-0 right-0 h-5 bg-gradient-to-b from-white dark:from-slate-900 to-transparent pointer-events-none z-10"></div>
                        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white dark:from-slate-900 to-transparent pointer-events-none z-10"></div>
                        <div className="absolute top-0 bottom-0 left-0 w-4 bg-gradient-to-r from-white dark:from-slate-900 to-transparent pointer-events-none z-10"></div>
                        <div className="absolute top-0 bottom-0 right-0 w-4 bg-gradient-to-l from-white dark:from-slate-900 to-transparent pointer-events-none z-10"></div>
                        
                        {/* Compact HUD Display on Map */}
                        <div className="absolute bottom-2 left-2 z-20 pointer-events-none text-slate-700 dark:text-white drop-shadow-sm">
                            <span className="bg-white/70 dark:bg-black/45 backdrop-blur-md px-2 py-0.5 rounded text-[10.5px] font-mono font-bold border border-slate-200/50 dark:border-white/5 inline-flex items-center gap-1.5">
                                <span>{time.toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}</span>
                                <span className="opacity-60">|</span>
                                <span className="text-[8px] uppercase tracking-wider">{time.toLocaleDateString('th-TH', {weekday: 'short', day: 'numeric', month: 'short'})}</span>
                            </span>
                        </div>
                        <div className="absolute bottom-2 right-2 z-20">
                            <div className={`px-2 py-0.5 rounded text-[8px] font-black border uppercase tracking-widest shadow-sm backdrop-blur-md ${currentStage === 'working' ? 'bg-emerald-500/90 border-emerald-400/45 text-white' : currentStage === 'completed' ? 'bg-slate-850/90 border-slate-700/40 text-white' : 'bg-orange-500/90 border-orange-400/45 text-white'}`}>
                                {currentStage === 'working' ? 'กำลังทำงาน' : currentStage === 'completed' ? 'เลิกงานแล้ว' : 'พร้อมทำงาน'}
                            </div>
                        </div>
                    </div>

                    {/* Integrated Controls Panel - Sleek and Compact */}
                    <div className="p-2.5 space-y-2.5">
                        {/* Horizontal Swiping Plans */}
                        {todayPlan && todayPlan.itinerary && todayPlan.itinerary.length > 0 && !isCheckedOut && (
                            <div className="animate-enter">
                                <label className="text-[8px] font-extrabold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1 mb-1 ml-0.5">
                                    <Target size={10} /> แผนงานวันนี้ (ปัดซ้าย-ขวา)
                                </label>
                                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 no-scrollbar scroll-smooth">
                                    {todayPlan.itinerary.map((it, idx) => { 
                                        const isCheckedIn = todayData?.checkIns.some(ci => ci.location === it.location); 
                                        return (
                                            <button 
                                                key={idx} 
                                                onClick={() => handleSelectLocation(it.location)} 
                                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 border shrink-0 active:scale-95 ${selectedPlace === it.location ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm' : isCheckedIn ? 'bg-slate-50 dark:bg-slate-800 border-emerald-500/20 text-emerald-500 opacity-60' : 'bg-white dark:bg-slate-800 border-slate-200/60 dark:border-white/5 text-slate-600 dark:text-slate-350 hover:border-indigo-500'}`}
                                            >
                                                {isCheckedIn ? <Check size={10} /> : <MapPin size={10} />}
                                                {it.location}
                                            </button>
                                        ); 
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Search Location Input */}
                        <div className="relative rounded-lg">
                            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                                <Search size={13} className="text-slate-400" />
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
                                placeholder="ค้นหาหรือระบุสถานที่เข้าทำงาน..." 
                                className="block w-full pl-8 pr-3 py-1.5 bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 rounded-lg text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500/40 transition-all text-xs" 
                            />
                            {isDropdownOpen && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg shadow-lg z-[100] max-h-40 overflow-y-auto ring-1 ring-black/5">
                                    {filteredLocations.length > 0 ? (
                                        filteredLocations.map((loc, idx) => (
                                            <button 
                                                key={idx} 
                                                onClick={() => handleSelectLocation(loc)} 
                                                className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-350 text-xs flex justify-between items-center border-b border-slate-100 dark:border-white/5 last:border-0"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Building size={12} className="text-slate-400" />
                                                    <span className="font-bold">{loc}</span>
                                                </div>
                                                {selectedPlace === loc && <Check size={11} className="text-orange-500" />}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-3 py-4 text-center text-slate-400 text-xs italic">ไม่พบสถานที่ในการระบบ</div>
                                    )}
                                    {searchQuery && !profile?.hospitals.some(h => h.toLowerCase() === searchQuery.toLowerCase()) && (
                                        <button 
                                            onClick={handleAddNewLocation} 
                                            className="w-full text-left px-3.5 py-2 hover:bg-orange-50 dark:hover:bg-orange-950/20 text-orange-600 dark:text-orange-400 text-xs flex items-center gap-1.5 border-t border-slate-150 dark:border-white/5 bg-white dark:bg-slate-900 font-extrabold sticky bottom-0"
                                        >
                                            <Plus size={12} className="text-orange-500" />
                                            <span>เพิ่มสถานที่ใหม่: "{searchQuery}"</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sleek Horizontal Action Row - Highly compact */}
                <div className="grid grid-cols-2 gap-2.5">
                    {/* Compact Check-In Button */}
                    <button 
                        onClick={handleCheckIn} 
                        disabled={isCheckedOut || !selectedPlace} 
                        className={`relative group py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all duration-300 border ${isCheckedOut || !selectedPlace ? 'bg-slate-100/60 dark:bg-slate-900/60 border-slate-200/20 dark:border-white/5 opacity-50 cursor-not-allowed text-slate-400' : 'bg-gradient-to-r from-emerald-500 to-teal-600 dark:from-emerald-600 dark:to-teal-700 border-emerald-500/20 shadow-md hover:brightness-105 active:scale-95 font-bold text-white'}`}
                    >
                        <Plus size={15} />
                        <span className="text-xs tracking-tight">
                            {selectedPlace ? `เช็คอิน: ${selectedPlace.length > 12 ? selectedPlace.substring(0, 10) + '...' : selectedPlace}` : 'เลือกสถานที่เช็คอิน'}
                        </span>
                    </button>

                    {/* Compact Check-Out/Edit Button */}
                    <button 
                        onClick={handleCheckOutStart} 
                        disabled={!isCheckedInToday} 
                        className={`relative group py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all duration-300 border ${!isCheckedInToday ? 'bg-slate-100/60 dark:bg-slate-900/60 border-slate-200/20 dark:border-white/5 opacity-50 cursor-not-allowed text-slate-400' : isCheckedOut ? 'bg-amber-500/90 border-amber-400/20 text-white shadow-md' : 'bg-gradient-to-r from-rose-500 to-orange-500 border-rose-500/20 shadow-md hover:brightness-105 active:scale-95 font-bold text-white'}`}
                    >
                        {isCheckedOut ? <Edit size={13} /> : <LogOut size={13} />}
                        <span className="text-xs tracking-tight">
                            {isCheckedOut ? 'ตรวจสอบ / แก้ไขสรุป' : 'เช็คเอาท์ส่งงาน'}
                        </span>
                    </button>
                </div>

                {statusMsg && (
                    <div className="text-center text-orange-600 dark:text-orange-400 text-[10.5px] py-1.5 bg-orange-50 dark:bg-orange-950/15 rounded-lg border border-orange-100 dark:border-orange-500/10 font-bold">
                        {statusMsg}
                    </div>
                )}

                {/* Progress Roadmap list today */}
                <div className="pt-1">
                    <div className="flex items-center gap-1.5 mb-2.5 px-0.5 text-slate-400 dark:text-slate-500">
                        <Calendar size={12} />
                        <h3 className="text-[10px] font-black uppercase tracking-widest leading-none">เส้นทางความคืบหน้าวันนี้</h3>
                    </div>

                    {todayData?.checkIns && todayData.checkIns.length > 0 ? (
                        <div className="relative pl-2.5 space-y-2 border-l border-slate-200 dark:border-white/5 ml-1.5">
                            {todayData?.checkIns.map((ci, idx) => { 
                                const draft = visitDrafts[idx] || { interactions: [] }; 
                                const hasInteractions = draft.interactions.length > 0; 
                                return (
                                    <div key={idx} className="relative pl-4 group">
                                        {/* Sleeker Dot */}
                                        <div className="absolute -left-[14.5px] top-3.5 w-2 h-2 rounded-full bg-emerald-500 shadow-sm ring-2 ring-white dark:ring-black"></div>
                                        
                                        <div className="flex justify-between items-center bg-white/95 dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-2.5 rounded-lg shadow-sm hover:border-orange-500/10 hover:shadow-xs transition-all">
                                            <div className="flex-1 min-w-0 pr-2 text-left">
                                                <div className="text-slate-900 dark:text-white font-bold text-xs truncate">
                                                    {ci.location}
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-0.5 leading-none">
                                                    <span className="text-slate-400 dark:text-slate-500 font-mono text-[8px] font-bold">
                                                        {ci.timestamp.toDate().toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}
                                                    </span>
                                                    {hasInteractions && (
                                                        <span className="px-1 py-0.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-[7.5px] font-black rounded uppercase border border-emerald-100/30 dark:border-emerald-500/10 flex items-center gap-0.5">
                                                            บันทึกกิจกรรมแล้ว {draft.interactions.length} รายการ
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleOpenVisitReport(idx)} 
                                                className="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-slate-50 dark:bg-slate-800 hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-950/20 text-slate-400 rounded-md transition-all active:scale-90 border border-slate-100 dark:border-white/5" 
                                                title="บันทึกกิจกรรม"
                                            >
                                                <MessageSquare size={12} />
                                            </button>
                                        </div>
                                    </div>
                                ); 
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-5 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-dashed border-slate-200 dark:border-white/5 text-slate-400 text-xs">
                            ยังไม่มีการลงบันทึกเช็คอินสำหรับวันนี้
                        </div>
                    )}
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes fly-xp { 
                    0% { opacity: 0; transform: translateY(0) scale(0.5); } 
                    20% { opacity: 1; transform: translateY(-30px) scale(1.1); } 
                    100% { opacity: 0; transform: translateY(-90px) scale(1); } 
                } 
                .animate-fly-xp { animation: fly-xp 1.2s ease-out forwards; }
                @keyframes bounce-in {
                    0% { transform: scale(0.3); opacity: 0; }
                    50% { transform: scale(1.05); }
                    70% { transform: scale(0.9); }
                    100% { transform: scale(1); opacity: 1; }
                }
                .animate-bounce-in { animation: bounce-in 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}} />
        </div>
    )
}

export default TimeAttendance;
