import React, { useEffect, useState, useRef, useMemo } from 'react';
import { User } from 'firebase/auth';
import { 
    Navigation, Plus, LogOut, Calendar, Sparkles, X, Search, Check, 
    Flame, Zap, TrendingUp, Loader2, ArrowLeft, ChevronDown, ChevronUp, 
    UserPlus, Save, User as UserIcon, ClipboardList, Settings, Bell, 
    Target, MapPin, Building, MessageSquare, Edit, Send, Map as MapIcon,
    Trophy, Gift, Star, Coins, Box, Info, ChevronLeft, AlertCircle, ChevronRight,
    PartyPopper, CheckCircle2, BadgeCheck
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
    if (level >= 9) return { title: 'LEGEND', color: 'text-white', themeColor: '#f59e0b' }; 
    if (level >= 7) return { title: 'ELITE', color: 'text-white', themeColor: '#e11d48' };  
    if (level >= 5) return { title: 'RANGER', color: 'text-white', themeColor: '#4f46e5' }; 
    if (level >= 3) return { title: 'SCOUT', color: 'text-white', themeColor: '#06b6d4' };  
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

    const dailyProgress = useMemo(() => {
        if (!todayData) return 0;
        const target = 5; 
        return Math.min(100, (todayData.checkIns.length / target) * 100);
    }, [todayData]);

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
    
    const getTheme = (level: number) => {
        if (level >= 9) return { cardBg: 'bg-gradient-to-br from-amber-400 via-orange-500 to-yellow-600', textPrimary: 'text-white', textSecondary: 'text-amber-100', settingsBtn: 'bg-white/20 text-white', avatarBorder: 'border-white/50', progressTrack: 'bg-black/20', progressFill: 'bg-white', statIcon: 'text-white fill-white', divider: 'border-white/20' };
        if (level >= 7) return { cardBg: 'bg-gradient-to-br from-rose-500 via-pink-600 to-red-500', textPrimary: 'text-white', textSecondary: 'text-rose-100', settingsBtn: 'bg-white/20 text-white', avatarBorder: 'border-white/50', progressTrack: 'bg-black/20', progressFill: 'bg-white', statIcon: 'text-white fill-white', divider: 'border-white/20' };
        if (level >= 5) return { cardBg: 'bg-gradient-to-br from-purple-600 via-indigo-600 to-violet-700', textPrimary: 'text-white', textSecondary: 'text-purple-100', settingsBtn: 'bg-white/20 text-white', avatarBorder: 'border-white/50', progressTrack: 'bg-black/20', progressFill: 'bg-white', statIcon: 'text-white fill-white', divider: 'border-white/20' };
        if (level >= 3) return { cardBg: 'bg-gradient-to-br from-cyan-500 via-blue-500 to-sky-600', textPrimary: 'text-white', textSecondary: 'text-cyan-100', settingsBtn: 'bg-white/20 text-white', avatarBorder: 'border-white/50', progressTrack: 'bg-black/20', progressFill: 'bg-white', statIcon: 'text-white fill-white', divider: 'border-white/20' };
        return { cardBg: 'bg-white dark:bg-zinc-900', textPrimary: 'text-slate-900 dark:text-white', textSecondary: 'text-slate-500 dark:text-slate-400', settingsBtn: 'bg-slate-50 dark:bg-zinc-800 text-slate-400', avatarBorder: 'border-slate-100 dark:border-white/10', progressTrack: 'bg-slate-100 dark:bg-zinc-800', progressFill: 'bg-gradient-to-r from-cyan-400 to-blue-500', statIcon: 'text-orange-500 fill-orange-500', divider: 'border-slate-100 dark:border-white/5' };
    };

    const theme = getTheme(currentLevel);
    const badge = { label: profile?.role?.toUpperCase() === 'ADMIN' ? 'ผู้ดูแลระบบ' : profile?.role?.toUpperCase() === 'MANAGER' ? 'หัวหน้างาน' : 'พนักงาน', bg: currentLevel >= 3 ? 'bg-black/20 border-white/30 text-white' : 'bg-slate-500/10 border-slate-500/20 text-slate-500' };

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

                <div className="relative w-full max-w-sm text-center space-y-8 animate-bounce-in">
                    <div className="relative inline-block">
                        <div className="absolute -inset-8 bg-amber-500/20 dark:bg-amber-500/30 rounded-full blur-[40px] animate-pulse"></div>
                        <div className="w-32 h-32 bg-gradient-to-br from-amber-400 to-orange-600 rounded-[40px] flex items-center justify-center shadow-[0_20px_50px_rgba(245,158,11,0.3)] dark:shadow-[0_20px_50px_rgba(245,158,11,0.5)] border-4 border-white/50 dark:border-white/30 relative z-10 rotate-12">
                            <PartyPopper size={64} className="text-white fill-white/20" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Quest Complete!</h2>
                        <p className="text-amber-600 dark:text-amber-400 font-black text-xs uppercase tracking-[0.3em]">ภารกิจรายเดือนสำเร็จแล้ว</p>
                    </div>

                    <div className="bg-white/80 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-[32px] p-8 backdrop-blur-xl shadow-xl dark:shadow-none">
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase mb-2">You Unlocked</p>
                        <div className="flex items-center justify-center gap-3">
                            <Coins className="text-amber-500" size={32} />
                            <span className="text-5xl font-black text-slate-900 dark:text-white tracking-tight">฿500</span>
                        </div>
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
                <header className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-4 flex items-center gap-4 z-20 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 shrink-0">
                    <button onClick={() => setShowQuestPage(false)} className="p-3 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 rounded-2xl text-slate-700 dark:text-white transition-all active:scale-95"><ChevronLeft size={24} /></button>
                    <div><h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">Monthly Quest</h2><p className="text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest">สะสมรางวัลภารกิจรายเดือน</p></div>
                </header>

                <main className="flex-1 overflow-y-auto pb-10 px-4 pt-6 space-y-6 relative">
                    <div className="absolute top-20 right-0 w-64 h-64 bg-amber-500/5 dark:bg-amber-500/10 rounded-full blur-[100px] pointer-events-none"></div>
                    <div className="absolute bottom-20 left-0 w-80 h-80 bg-orange-600/5 dark:bg-orange-600/10 rounded-full blur-[120px] pointer-events-none"></div>

                    <div className="relative z-10 space-y-6">
                        <div className="flex justify-between items-center bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[32px] p-6 shadow-xl dark:shadow-2xl relative overflow-hidden group">
                            <Coins className="absolute -right-6 -bottom-6 text-amber-500/10 w-40 h-40 rotate-12 group-hover:scale-110 transition-transform duration-1000" />
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-2xl animate-pulse"><Trophy size={36} className="text-slate-900 fill-slate-900" /></div>
                                <div><h3 className="text-slate-900 dark:text-white font-black text-3xl tracking-tight leading-none">฿500</h3><p className="text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Cash Rewards</p></div>
                            </div>
                            <div className="text-right relative z-10">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</div>
                                <div className={`px-3 py-1 rounded-full text-[10px] font-black ${monthlyQuestStats.isClaimed ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-slate-900'}`}>
                                    {monthlyQuestStats.isClaimed ? 'CLAIMED' : 'ACTIVE'}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/70 dark:bg-white/5 p-6 rounded-[36px] border border-slate-200 dark:border-white/5 shadow-inner space-y-4 backdrop-blur-md">
                            <div className="flex justify-between items-end">
                                <div className="flex flex-col"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progress Tracker</span><span className="text-lg font-black text-slate-900 dark:text-white">{monthlyQuestStats.completedDays}/{monthlyQuestStats.targetDays} <span className="text-slate-500 font-bold text-sm">DAYS</span></span></div>
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 dark:bg-amber-500/20 rounded-full border border-amber-500/20 dark:border-amber-500/30"><Star size={12} className="text-amber-600 dark:text-amber-500 fill-amber-600 dark:fill-amber-500" /><span className="text-xs font-black text-amber-600 dark:text-amber-500">{Math.round(monthlyQuestStats.progress)}%</span></div>
                            </div>
                            <div className="h-6 w-full bg-slate-200 dark:bg-black/40 rounded-full overflow-hidden border border-slate-300 dark:border-white/10 p-1">
                                <div style={{ width: `${monthlyQuestStats.progress}%` }} className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-yellow-300 rounded-full transition-all duration-1000 relative">
                                    <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:20px_20px] animate-[progress-shine_2s_linear_infinite]"></div>
                                </div>
                            </div>
                            <div className="grid grid-cols-7 gap-2.5 pt-4">
                                {Array.from({ length: monthlyQuestStats.targetDays }).map((_, i) => {
                                    const isDone = i < monthlyQuestStats.completedDays;
                                    const isCurrent = i === monthlyQuestStats.completedDays;
                                    return (
                                        <div key={i} className={`aspect-square rounded-xl flex items-center justify-center transition-all duration-500 ${isDone ? 'bg-amber-500 text-slate-900 shadow-lg scale-100' : isCurrent ? 'bg-slate-200 dark:bg-zinc-800 border-2 border-dashed border-amber-500/50 animate-pulse' : 'bg-slate-100 dark:bg-zinc-800/50 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-white/5'}`}>
                                            {isDone ? <Star size={16} fill="currentColor" className="animate-enter" /> : <div className="text-[10px] font-black opacity-50">{i + 1}</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-[40px] p-8 space-y-6 backdrop-blur-md shadow-sm">
                            <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-amber-500/10 rounded-xl text-amber-600 dark:text-amber-500"><Info size={20} /></div><h4 className="text-slate-900 dark:text-white font-black text-sm uppercase tracking-widest">กติกาการรับรางวัล (RULES)</h4></div>
                            <div className="space-y-6">
                                <div className="flex gap-4"><div className="w-8 h-8 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-500 flex items-center justify-center text-xs font-black shrink-0 border border-amber-500/10 dark:border-amber-500/20">1</div><p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed"><span className="text-slate-900 dark:text-white font-bold block mb-1">เช็คอิน (Check-in)</span> ในสถานที่ปฏิบัติงานจริงทุกวันทำงาน (จันทร์-ศุกร์) ตลอดเดือน</p></div>
                                <div className="flex gap-4"><div className="w-8 h-8 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-500 flex items-center justify-center text-xs font-black shrink-0 border border-amber-500/10 dark:border-amber-500/20">2</div><p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed"><span className="text-slate-900 dark:text-white font-bold block mb-1">บันทึกรายงานกิจกรรม (Visit Report)</span> ให้ครบถ้วนทุกสถานที่ที่ท่านได้เข้าพบในวันนั้นๆ อย่างละเอียด</p></div>
                                <div className="flex gap-4"><div className="w-8 h-8 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-500 flex items-center justify-center text-xs font-black shrink-0 border border-amber-500/10 dark:border-amber-500/20">3</div><p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed"><span className="text-slate-900 dark:text-white font-bold block mb-1">เช็คเอาท์ (Check-out)</span> เพื่อสรุปยอดและส่งรายงานการปฏิบัติงานเมื่อจบวันทุกครั้ง</p></div>
                            </div>
                            <div className="pt-6 border-t border-slate-200 dark:border-white/5 flex gap-3"><AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" /><p className="text-[11px] text-amber-600 dark:text-amber-400/80 italic leading-relaxed">* หากทำครบเงื่อนไข ระบบจะปลดล็อกเงินรางวัล 500 บาท และโอนเข้าพอร์ตสะสมของคุณโดยอัตโนมัติเมื่อกดรับสิทธิ์</p></div>
                        </div>

                        <div className="pb-10">
                            {monthlyQuestStats.isClaimed ? (
                                <div className="bg-emerald-500 rounded-[32px] p-6 flex items-center justify-between shadow-2xl shadow-emerald-500/20">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center"><CheckCircle2 className="text-emerald-500" size={28} /></div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">Status</span>
                                            <span className="text-sm font-black text-white uppercase">REWARD CLAIMED!</span>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-black bg-white/20 px-3 py-1 rounded-full text-white">SUCCESS</span>
                                </div>
                            ) : monthlyQuestStats.progress >= 100 ? (
                                <button 
                                    onClick={handleClaimReward}
                                    disabled={isSavingReport}
                                    className="w-full bg-gradient-to-r from-amber-400 to-orange-600 rounded-[32px] p-6 flex items-center justify-between shadow-2xl animate-pulse active:scale-95 transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-slate-950 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-transform">
                                            <Gift className="text-amber-500" size={24} />
                                        </div>
                                        <div className="flex flex-col text-left">
                                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">Mission Completed</span>
                                            <span className="text-xl font-black text-slate-950 uppercase">CLAIM ฿500 NOW</span>
                                        </div>
                                    </div>
                                    <ChevronRight className="text-slate-950 group-hover:translate-x-1 transition-transform" size={32} />
                                </button>
                            ) : (
                                <div className="bg-slate-200/50 dark:bg-white/10 rounded-[32px] p-6 flex items-center justify-between border border-slate-300 dark:border-white/5 shadow-sm dark:shadow-none backdrop-blur-sm">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white dark:bg-zinc-800 rounded-2xl flex items-center justify-center shadow-sm"><Gift className="text-slate-400 dark:text-slate-500" size={24} /></div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tighter">Next Target</span>
                                            <span className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase">อีก {monthlyQuestStats.targetDays - monthlyQuestStats.completedDays} วันเพื่อรับรางวัล</span>
                                        </div>
                                    </div>
                                    <div className="p-1.5 bg-white/50 dark:bg-black/20 rounded-xl">
                                        <div className="p-1.5 bg-white/50 dark:bg-black/20 rounded-xl">
                                            <Info className="text-slate-400 dark:text-slate-600" size={20} />
                                        </div>
                                    </div>
                                </div>
                            )}
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
                        <button onClick={() => setShowAddContactView(false)} className="p-3 bg-white dark:bg-zinc-900 rounded-full shadow-sm border border-slate-200 dark:border-white/10"><ArrowLeft size={20} /></button>
                        <div><h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><UserPlus className="text-purple-500" size={24}/> เพิ่มรายชื่อใหม่</h2><p className="text-sm text-slate-500 dark:text-slate-400">กำลังเพิ่มรายชื่อที่ {todayData?.checkIns[expandedVisitIdx]?.location}</p></div>
                    </div>
                    <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 rounded-[24px] p-6 shadow-sm space-y-5">
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
                    <button onClick={() => setShowReportModal(false)} className="p-3 bg-white dark:bg-zinc-900 rounded-full shadow-sm border border-slate-200 dark:border-white/10"><ArrowLeft size={20} /></button>
                    <div><h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><Sparkles className="text-purple-500" size={24}/> {isCheckedOut ? 'แก้ไขข้อมูลรายงาน' : (isFinalCheckout ? 'สรุปรายงานการปฏิบัติงาน' : 'บันทึกรายละเอียดกิจกรรม')}</h2><p className="text-sm text-slate-500 dark:text-slate-400">{isCheckedOut ? 'คุณสามารถอัปเดตข้อมูลย้อนหลังได้' : (isFinalCheckout ? `สรุปรายละเอียดการเข้าพบ ${todayData?.checkIns.length} สถานที่` : 'คุณสามารถบันทึกรายละเอียดแต่ละที่ไว้ก่อนได้')}</p></div>
                </div>
                <div className="space-y-4">
                    {todayData?.checkIns.map((ci, idx) => {
                        const isExpanded = expandedVisitIdx === idx;
                        const draft = visitDrafts[idx] || { interactions: [] };
                        return (
                            <div key={idx} className={`bg-white dark:bg-zinc-950 border transition-all duration-300 rounded-[24px] overflow-hidden ${isExpanded ? 'border-cyan-400 dark:border-cyan-500 shadow-xl scale-[1.01]' : 'border-slate-200 dark:border-white/10 opacity-80'}`}>
                                <div onClick={() => { setExpandedVisitIdx(isExpanded ? -1 : idx); setContactSearch(''); setIsContactDropdownOpen(false); setSelectedCustomer(null); }} className="p-4 flex items-center justify-between cursor-pointer bg-slate-50 dark:bg-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${isExpanded ? 'bg-cyan-500 text-white' : 'bg-slate-200 dark:bg-zinc-800 text-slate-500'}`}>{idx + 1}</div>
                                        <div><div className="font-bold text-slate-900 dark:text-white text-base">{ci.location}</div><div className="text-xs text-slate-500">{ci.timestamp.toDate().toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}</div></div>
                                    </div>
                                    {isExpanded ? <ChevronUp className="text-cyan-500"/> : <ChevronDown className="text-slate-400"/>}
                                </div>
                                {isExpanded && (
                                    <div className="p-5 space-y-6 animate-enter bg-slate-50/50 dark:bg-black/30">
                                        {draft.interactions.length > 0 && (
                                            <div className="space-y-3">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">กิจกรรมที่บันทึกแล้ว ({draft.interactions.length})</label>
                                                {draft.interactions.map((inter, iIdx) => (
                                                    <div key={iIdx} className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm relative group"><button onClick={() => removeInteraction(idx, iIdx)} className="absolute top-2 right-2 text-slate-400 hover:text-rose-500"><X size={16}/></button><div className="flex items-center gap-2 mb-1"><UserIcon size={14} className="text-purple-500"/><span className="font-bold text-slate-900 dark:text-white text-sm">{inter.customerName}</span><span className="text-xs text-slate-500">({inter.department})</span></div><p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium pl-10">"{inter.summary}"</p>{inter.pipeline && (<div className="ml-5 flex items-center gap-2 text-[10px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 px-2 py-1 rounded w-fit border border-indigo-100 dark:border-indigo-500/20"><TrendingUp size={10}/> <span>{inter.pipeline.product} (฿{inter.pipeline.value.toLocaleString()}) — {stageLabels[inter.pipeline.stage] || inter.pipeline.stage}</span></div>)}</div>
                                                ))}
                                            </div>
                                        )}
                                        <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm space-y-4">
                                            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-2"><ClipboardList size={16} className="text-cyan-500"/> เพิ่มบันทึกกิจกรรม / การเข้าพบ</h3>
                                            <div className="space-y-1.5 relative">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase">1. เลือกลูกค้า / ผู้ติดต่อ</label>
                                                <div className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={14} /><input type="text" value={contactSearch} onChange={(e) => { setContactSearch(e.target.value); setIsContactDropdownOpen(true); setSelectedCustomer(null); }} placeholder="ค้นหาชื่อผู้ติดต่อ..." className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-slate-900 dark:text-white outline-none focus:border-cyan-500 text-sm" />{isContactDropdownOpen && (<div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 max-h-40 overflow-y-auto ring-1 ring-black/5">{ (profile?.customers || []).filter(c => c.hospital === ci.location || c.hospital === 'All').filter(c => !contactSearch || c.name.toLowerCase().includes(contactSearch.toLowerCase())).map((c, i) => (<div key={i} onClick={() => handleSelectCustomer(c.name, c.department)} className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer text-sm border-b border-slate-100 dark:border-white/5 last:border-0 flex justify-between"><span className="text-slate-900 dark:text-white">{c.name}</span><span className="text-xs text-slate-500">{c.department}</span></div>))}{contactSearch && <div onClick={() => setShowAddContactView(true)} className="px-4 py-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 cursor-pointer text-sm flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold"><Plus size={14} /> สร้างรายชื่อใหม่ "{contactSearch}"</div>}</div>)}</div>{selectedCustomer && <div className="text-xs text-emerald-500 flex items-center gap-1"><Check size={12}/> เลือกแล้ว: <b>{selectedCustomer.name}</b></div>}
                                            </div>
                                            <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase">2. สรุปรายละเอียดการสนทนา</label><textarea value={currentSummary} onChange={(e) => setCurrentSummary(e.target.value)} placeholder="สรุปหัวข้อที่ได้พูดคุยหรือความคืบหน้า..." rows={3} className="w-full bg-slate-50 dark:bg-black/30 border-2 border-slate-100 dark:border-white/5 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-cyan-500 focus:bg-white dark:focus:bg-zinc-900 text-sm resize-none shadow-inner" /></div>
                                            <div className="space-y-2"><div className="flex items-center justify-between"><label className="text-[10px] font-bold text-indigo-500 uppercase flex items-center gap-1"><TrendingUp size={12}/> 3. เพิ่มโอกาสการขาย (โอกาสเดิมหรือดีลใหม่)?</label><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={hasOpp} onChange={(e) => setHasOpp(e.target.checked)} className="sr-only peer"/><div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div></label></div>{hasOpp && (<div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl border border-indigo-100 dark:border-indigo-500/20 space-y-2 animate-enter"><div className="flex p-1 bg-white/50 dark:bg-black/20 rounded-lg mb-2"><button onClick={() => { setDealMode('new'); setPipelineProduct(''); setPipelineValue(''); }} className={`flex-1 text-[10px] py-1.5 rounded-md font-bold transition-all ${dealMode === 'new' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-500'}`}>ดีลใหม่</button><button onClick={() => setDealMode('update')} className={`flex-1 text-[10px] py-1.5 rounded-md font-bold transition-all ${dealMode === 'update' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500'}`}>อัปเดตดีลเดิม</button></div>{dealMode === 'update' && (<div className="relative"><select value={selectedExistingDealId} onChange={(e) => handleExistingDealSelect(e.target.value)} className="w-full p-2 rounded-lg bg-white dark:bg-black/20 border border-amber-200 dark:border-amber-500/30 text-xs outline-none focus:border-amber-500 text-slate-700 dark:text-white appearance-none"><option value="">-- เลือกดีลที่ต้องการอัปเดต --</option>{(profile?.activePipeline || []).map(deal => (<option key={deal.id} value={deal.id}>{deal.product} ({stageLabels[deal.stage] || deal.stage})</option>))}</select></div>)}<div className="grid grid-cols-2 gap-2"><input value={pipelineProduct} onChange={e => setPipelineProduct(e.target.value)} placeholder="ชื่อสินค้า / โปรเจกต์" className="w-full p-2 rounded-lg bg-white dark:bg-black/20 border border-indigo-200 dark:border-indigo-500/30 text-xs outline-none focus:border-indigo-500"/><input type="number" value={pipelineValue} onChange={e => setPipelineValue(e.target.value)} placeholder="มูลค่า (บาท)" className="w-full p-2 rounded-lg bg-white dark:bg-black/20 border border-indigo-200 dark:border-indigo-500/30 text-xs outline-none focus:border-indigo-500"/></div><div className="grid grid-cols-2 gap-2"><select value={pipelineStage} onChange={e => setPipelineStage(e.target.value)} className="w-full p-2 rounded-lg bg-white dark:bg-black/20 border border-indigo-200 dark:border-indigo-500/30 text-xs outline-none">{['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'].map(s => <option key={s} value={s}>{stageLabels[s] || s}</option>)}</select><div className="flex items-center gap-2 px-1 text-xs text-slate-500"><span>โอกาส: {pipelineProb}%</span><input type="range" min="0" max="100" step="10" value={pipelineProb} onChange={e => setPipelineProb(parseInt(e.target.value))} className="w-16 accent-indigo-500"/></div></div></div>)}</div>
                                        </div>
                                        <button onClick={() => addInteractionToDraft(idx)} disabled={!selectedCustomer || !currentSummary} className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 text-center"><Plus size={16} /> บันทึกกิจกรรมลงร่าง</button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="pt-4 pb-12 z-[100] relative">{isFinalCheckout ? (<button onClick={() => confirmCheckOut(true)} disabled={isSavingReport} className={`w-full bg-gradient-to-r ${isCheckedOut ? 'from-amber-500 to-orange-600' : 'from-emerald-500 to-cyan-600'} text-white font-bold py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 transform active:scale-95 transition-all text-center`}>{isSavingReport ? <Loader2 className="animate-spin" /> : <><Check size={24} /> {isCheckedOut ? 'อัปเดตข้อมูลรายงาน' : 'ส่งรายงานทั้งหมดและเช็คเอาท์'}</>}</button>) : (<button onClick={(e) => { e.preventDefault(); e.stopPropagation(); confirmCheckOut(false); }} disabled={isSavingReport} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-4 rounded-2xl shadow-xl border-2 border-white/10 flex items-center justify-center gap-2 disabled:opacity-50 transform active:scale-95 transition-all text-center">{isSavingReport ? <Loader2 className="animate-spin" /> : <><Save size={20} /> บันทึกร่างกิจกรรมและกลับ</>}</button>)}</div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl mx-auto space-y-6">
            {/* Sticky Header Section - Unified for smooth scroll with small top margin */}
            <div className="sticky top-2 z-30 pt-0 pb-2 bg-[#F5F5F7]/80 dark:bg-black/80 backdrop-blur-xl border-b border-transparent transition-all rounded-[32px] px-0.5">
                <div className="flex items-stretch gap-2">
                    {/* Profile Card Container */}
                    <div className={`flex-1 relative rounded-[28px] shadow-lg pb-6 pt-6 px-6 overflow-hidden transition-all duration-500 ${theme.cardBg}`}>
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="relative shrink-0">
                                    <div className={`w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-sm overflow-hidden border-2 ${theme.avatarBorder}`}>{profile?.photoBase64 ? (<img src={profile.photoBase64} alt="Profile" className="w-full h-full object-cover" />) : (<div className="w-full h-full flex items-center justify-center text-white text-lg font-bold">{profile?.name?.[0] || user.email?.[0]?.toUpperCase()}</div>)}</div>
                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
                                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border uppercase shadow-md whitespace-nowrap backdrop-blur-md ${badge.bg}`}>
                                            {badge.label}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex flex-col leading-tight ml-1">
                                    <h1 className={`text-lg font-bold truncate max-w-[160px] flex items-center gap-1.5 ${theme.textPrimary}`}>
                                        {profile?.name || user.email?.split('@')[0]}
                                        <BadgeCheck size={18} className="text-emerald-500 fill-white shrink-0" />
                                    </h1>
                                    <p className={`text-[11px] font-black uppercase tracking-tight mt-0.5 opacity-80 ${theme.textSecondary}`}>
                                        {profile?.area || 'Happy Joby Workspace'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1"><button onClick={() => navigate('/settings')} className={`p-2 rounded-full ${theme.settingsBtn} shadow-sm border border-white/10 active:scale-90 transition-all`}><Settings size={18} /></button></div>
                        </div>
                        <div className="flex items-center gap-3 relative z-10">
                            <div className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center relative overflow-hidden backdrop-blur-md bg-black/5 border border-white/10 shadow-inner"><span className={`text-xl font-black ${theme.textPrimary}`}>{currentLevel}</span>{isHudBouncing && <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-ping"></div>}</div>
                            <div className="flex-1">
                                <div className="flex justify-between items-end mb-1"><span className={`text-[8px] font-black tracking-widest uppercase opacity-80 ${theme.textPrimary}`}>{rank.title}</span><div className="flex items-baseline gap-1"><span className={`text-xs font-bold ${theme.textPrimary}`}>{profile?.xp || 0}</span><span className={`text-[8px] ${theme.textSecondary}`}>XP</span></div></div>
                                <div className={`h-2 w-full rounded-full overflow-hidden ${theme.progressTrack}`}><div style={{ width: `${Math.min(100, Math.max(0, (((profile?.xp || 0) - ((currentLevel - 1) * (currentLevel - 1) * 100)) / ((currentLevel * currentLevel * 100) - ((currentLevel - 1) * (currentLevel - 1) * 100))) * 100))}%` }} className={`h-full rounded-full transition-all duration-700 ${theme.progressFill}`}></div></div>
                            </div>
                            <div className={`flex flex-col items-center pl-2 border-l ${theme.divider}`}><div className={`flex items-center gap-0.5 ${theme.statIcon}`}><Flame size={16} /><span className={`text-lg font-bold ${theme.textPrimary}`}>{profile?.currentStreak || 0}</span></div><span className={`text-[7px] font-black uppercase tracking-wider ${theme.textSecondary}`}>STREAK</span></div>
                        </div>
                    </div>

                    {/* Monthly Quest Pill Button on the Right - Aligned vertically to Profile Card */}
                    <button onClick={() => setShowQuestPage(true)} className="w-16 flex flex-col items-center justify-center bg-slate-200 dark:bg-zinc-900 rounded-[28px] shadow-lg active:scale-95 transition-all group relative border-2 border-white/30 overflow-hidden shrink-0">
                        <div className={`absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-out z-0 ${monthlyQuestStats.isClaimed ? 'bg-emerald-500' : 'bg-gradient-to-t from-amber-600 via-orange-500 to-yellow-400'}`} style={{ height: `${monthlyQuestStats.progress}%` }}>
                            <div className="absolute top-0 left-[-50%] w-[200%] h-12 bg-white/20 blur-sm animate-[wave_3s_linear_infinite] rounded-[45%]"></div>
                        </div>
                        <div className="relative z-10 flex flex-col items-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
                            {monthlyQuestStats.isClaimed ? <CheckCircle2 size={28} className="text-white" /> : <Box size={28} className={`${monthlyQuestStats.progress > 50 ? 'text-white' : 'text-orange-500'} group-hover:scale-110 transition-transform`} />}
                            <span className={`text-[8px] font-black ${monthlyQuestStats.progress > 30 ? 'text-white' : 'text-slate-500'} uppercase tracking-tighter mt-1`}>{monthlyQuestStats.isClaimed ? 'DONE' : 'QUEST'}</span>
                            <div className={`text-[7px] font-black ${monthlyQuestStats.progress > 70 ? 'text-white/80' : monthlyQuestStats.isClaimed ? 'text-white' : 'text-amber-600'} mt-0.5`}>{Math.round(monthlyQuestStats.progress)}%</div>
                        </div>
                    </button>
                </div>
            </div>

            <div className="space-y-6 pt-2">
                {xpParticles.map((p) => (<div key={p.id} className="animate-fly-xp flex items-center justify-center fixed inset-0 pointer-events-none z-[200]"><div className="bg-gradient-to-br from-amber-400 to-orange-500 text-white font-black text-3xl px-6 py-3 rounded-full shadow-lg border-2 border-white/40"><Zap className="fill-white" size={28} /> +{p.xp}</div></div>))}
                
                <div className="relative rounded-[32px] border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-xl overflow-visible" ref={dropdownRef}>
                    <div className="h-56 w-full relative overflow-hidden rounded-t-[32px]">
                        {location ? (
                            <MapDisplay lat={location.lat} lng={location.lng} markers={[{lat: location.lat, lng: location.lng, text: profile?.name || user.email || 'ตำแหน่งของฉัน', photo: profile?.photoBase64}]} className="h-full w-full" zoom={15} />
                        ) : (
                            <div className="h-full w-full bg-slate-100 dark:bg-black flex items-center justify-center text-slate-500 text-xs gap-2"><Navigation size={14} className="animate-spin" /> ค้นหาตำแหน่ง GPS...</div>
                        )}
                        <button onClick={getLocation} className="absolute top-3 right-3 bg-white/30 dark:bg-zinc-900/40 backdrop-blur-md p-2 rounded-full text-white shadow-lg border border-white/20 z-20 hover:bg-white/50 transition-all active:scale-90"><Navigation size={18} /></button>
                        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/60 via-black/30 to-transparent pointer-events-none z-10"></div>
                        <div className="absolute bottom-4 left-4 z-20 pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"><div className="text-3xl font-black text-white leading-none">{time.toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}</div><div className="text-[10px] text-white/90 font-black uppercase tracking-wider mt-1">{time.toLocaleDateString('th-TH', {weekday: 'short', day: 'numeric', month: 'short'})}</div></div>
                        <div className="absolute bottom-4 right-4 z-20"><div className={`px-3 py-1 rounded-full text-[9px] font-black border uppercase tracking-widest shadow-xl backdrop-blur-md ${currentStage === 'working' ? 'bg-emerald-500/80 border-emerald-400 text-white' : currentStage === 'completed' ? 'bg-slate-600/80 border-slate-50 text-white' : 'bg-cyan-500/80 border-cyan-400 text-white'}`}>{currentStage === 'working' ? 'กำลังทำงาน' : currentStage === 'completed' ? 'เลิกงานแล้ว' : 'พร้อมทำงาน'}</div></div>
                    </div>
                    <div className="p-4 space-y-4">
                        {todayPlan && todayPlan.itinerary && todayPlan.itinerary.length > 0 && !isCheckedOut && (
                            <div className="animate-enter"><label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2 mb-2 ml-1"><Target size={12} /> แผนงานวันนี้</label><div className="flex flex-wrap gap-2">{todayPlan.itinerary.map((it, idx) => { const isCheckedIn = todayData?.checkIns.some(ci => ci.location === it.location); return (<button key={idx} onClick={() => handleSelectLocation(it.location)} className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 border shadow-sm active:scale-95 ${selectedPlace === it.location ? 'bg-indigo-600 border-indigo-500 text-white shadow-indigo-500/20' : isCheckedIn ? 'bg-slate-50 dark:bg-zinc-900 border-emerald-500/30 text-emerald-500 opacity-60' : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-indigo-500'}`}>{isCheckedIn ? <Check size={14} /> : <MapPin size={14} />}{it.location}</button>); })}</div></div>
                        )}
                        <div className="relative group shadow-lg rounded-2xl"><div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Search size={18} className="text-slate-400" /></div><input type="text" value={searchQuery} onChange={(e) => { const val = e.target.value; setSearchQuery(val); setIsDropdownOpen(true); if(val === '') setSelectedPlace(''); }} onFocus={() => setIsDropdownOpen(true)} placeholder="เลือกสถานที่เพื่อเช็คอิน..." className="block w-full pl-11 pr-4 py-4 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all text-sm font-medium" />{isDropdownOpen && (<div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-950/95 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-[100] max-h-52 overflow-y-auto ring-1 ring-black/5">{filteredLocations.length > 0 ? (filteredLocations.map((loc, idx) => (<button key={idx} onClick={() => handleSelectLocation(loc)} className="w-full text-left px-5 py-4 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 text-sm flex justify-between items-center border-b border-slate-100 dark:border-white/5 last:border-0 transition-colors"><div className="flex items-center gap-3"><Building size={16} className="text-slate-400" /><span className="font-bold">{loc}</span></div>{selectedPlace === loc && <Check size={14} className="text-cyan-500" />}</button>))) : (<div className="px-5 py-8 text-center text-slate-400 text-sm italic">ไม่พบสถานที่ที่ตรงกับคำค้นหา</div>)}{searchQuery && !profile?.hospitals.some(h => h.toLowerCase() === searchQuery.toLowerCase()) && (<button onClick={handleAddNewLocation} className="w-full text-left px-5 py-4 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 text-sm flex items-center gap-3 border-t-2 border-slate-100 dark:border-white/10 sticky bottom-0 bg-white dark:bg-zinc-950 font-black text-center"><div className="bg-cyan-500 text-white p-1 rounded-full inline-block mr-2"><Plus size={14} /></div>เพิ่มรายชื่อใหม่: "{searchQuery}"</button>)}</div>)}</div>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4"><button onClick={handleCheckIn} disabled={isCheckedOut || !selectedPlace} className={`relative group h-32 rounded-[32px] flex flex-col items-center justify-center transition-all duration-300 overflow-hidden ${isCheckedOut || !selectedPlace ? 'bg-slate-100 dark:bg-zinc-900 opacity-50 cursor-not-allowed text-slate-400' : 'bg-gradient-to-br from-emerald-400 to-emerald-600 dark:from-emerald-600 dark:to-emerald-800 shadow-emerald-500/20 active:scale-95 text-center'}`}><Plus size={36} className={`${isCheckedOut || !selectedPlace ? 'text-slate-400' : 'text-white'} mb-2`} /><span className={`${isCheckedOut || !selectedPlace ? 'text-slate-400' : 'text-white'} font-black text-xl tracking-tight`}>เช็คอิน</span></button><button onClick={handleCheckOutStart} disabled={!isCheckedInToday} className={`relative group h-32 rounded-[32px] flex flex-col items-center justify-center transition-all duration-300 overflow-hidden ${!isCheckedInToday ? 'bg-slate-100 dark:bg-zinc-900 opacity-50 cursor-not-allowed text-slate-400' : isCheckedOut ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-gradient-to-br from-rose-400 to-rose-600 shadow-rose-500/20 active:scale-95 text-center'}`}>{isCheckedOut ? <Edit size={36} className="text-white mb-2" /> : <LogOut size={36} className={`${!isCheckedInToday ? 'text-slate-400' : 'text-white'} mb-2`} />}<span className={`${!isCheckedInToday ? 'text-slate-400' : 'text-white'} font-black text-xl tracking-tight uppercase`}>{isCheckedOut ? 'แก้ไขรายงาน' : 'เช็คเอาท์'}</span></button></div>
                {statusMsg && <div className="text-center text-cyan-600 text-sm py-3 bg-cyan-50 dark:bg-cyan-950/30 rounded-2xl border border-cyan-100 dark:border-cyan-500/20">{statusMsg}</div>}
                <div className="pt-2">
                    <div className="flex items-center gap-2 mb-4 px-2 opacity-60"><Calendar size={14} className="text-slate-500" /><h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">เส้นทางวันนี้</h3></div>
                    <div className="relative pl-4 space-y-4 border-l border-slate-200 dark:border-white/10 ml-3">{todayData?.checkIns.map((ci, idx) => { const draft = visitDrafts[idx] || { interactions: [] }; const hasInteractions = draft.interactions.length > 0; return (<div key={idx} className="relative pl-6 group"><div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-lg ring-4 ring-white dark:ring-black transition-transform group-hover:scale-125"></div><div className="flex justify-between items-center bg-white dark:bg-zinc-950 border border-slate-100 dark:border-white/10 p-4 rounded-2xl shadow-sm hover:border-cyan-500/30 transition-all"><div className="flex-1 min-w-0 pr-4 text-left"><div className="text-slate-900 dark:text-white font-bold text-sm truncate">{ci.location}</div><div className="flex items-center gap-2 mt-1"><span className="text-slate-500 dark:text-slate-400 font-mono text-[10px]">{ci.timestamp.toDate().toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}</span>{hasInteractions && (<span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[8px] font-black rounded-full uppercase border border-emerald-200 dark:border-emerald-500/20 flex items-center gap-1"><Check size={8}/> บันทึก {draft.interactions.length} รายการ</span>)}</div></div><button onClick={() => handleOpenVisitReport(idx)} className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-slate-50 dark:bg-zinc-900/50 text-slate-400 hover:bg-cyan-50 hover:text-cyan-600 rounded-xl transition-all active:scale-90 border border-transparent" title="บันทึกกิจกรรม"><MessageSquare size={18} /></button></div></div>); })}</div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes fly-xp { 
                    0% { opacity: 0; transform: translateY(0) scale(0.5); } 
                    20% { opacity: 1; transform: translateY(-50px) scale(1.2); } 
                    100% { opacity: 0; transform: translateY(-150px) scale(1); } 
                } 
                .animate-fly-xp { animation: fly-xp 1.2s ease-out forwards; }
                @keyframes progress-shine {
                    from { background-position: 0 0; }
                    to { background-position: 40px 0; }
                }
                @keyframes bounce-in {
                    0% { transform: scale(0.3); opacity: 0; }
                    50% { transform: scale(1.05); }
                    70% { transform: scale(0.9); }
                    100% { transform: scale(1); opacity: 1; }
                }
                .animate-bounce-in { animation: bounce-in 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
                @keyframes wave {
                    0% { transform: translateX(-50%) skewY(-2deg) scale(1); }
                    50% { transform: translateX(-50%) skewY(2deg) scale(1.1); }
                    100% { transform: translateX(-50%) skewY(-2deg) scale(1); }
                }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}} />
        </div>
    )
}

export default TimeAttendance;