import React, { useEffect, useState, useRef, useMemo } from 'react';
import { User } from 'firebase/auth';
import { 
    Navigation, Plus, LogOut, Calendar, Sparkles, X, Search, Check, 
    Flame, Zap, TrendingUp, Loader2, ArrowLeft, ChevronDown, ChevronUp, 
    UserPlus, Save, User as UserIcon, ClipboardList, Settings, Bell, 
    Target, MapPin, Building, MessageSquare, Edit, Send, Map as MapIcon,
    Trophy, Gift, Star, Coins, Box, Info, ChevronLeft, AlertCircle, ChevronRight,
    PartyPopper, CheckCircle2, BadgeCheck, Shield, Crown, Medal
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

const getRankInfo = (level: number) => {
    if (level >= 9) return { title: 'LEGEND', icon: <Crown size={60} />, theme: 'legend' }; 
    if (level >= 7) return { title: 'ELITE', icon: <Medal size={60} />, theme: 'elite' };  
    if (level >= 5) return { title: 'RANGER', icon: <Shield size={60} />, theme: 'ranger' }; 
    if (level >= 3) return { title: 'SCOUT', icon: <Navigation size={60} />, theme: 'scout' };  
    return { title: 'ROOKIE', icon: <Star size={60} />, theme: 'rookie' }; 
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

    // Fix: Added missing filteredLocations definition to resolve the 'Cannot find name' error.
    const filteredLocations = useMemo(() => {
        const list = profile?.hospitals || [];
        if (!searchQuery) return list;
        return list.filter(h => h.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [profile?.hospitals, searchQuery]);

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
        } catch (e) { console.error("Refresh failed", e); }
    };

    const currentLevel = profile?.level || 1; 
    const rankInfo = getRankInfo(currentLevel);

    useEffect(() => {
        refreshData();
        getLocation();
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => { clearInterval(timer); };
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
        } catch (e) { setStatusMsg('การเช็คอินล้มเหลว'); }
    };

    const handleClaimReward = async () => {
        const now = new Date();
        const monthId = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        try {
            setIsSavingReport(true);
            await updateUserProfile(user.uid, { lastRewardClaimedMonth: monthId } as any);
            setShowRewardModal(true);
            await refreshData();
        } catch (e) { console.error(e); } finally { setIsSavingReport(false); }
    };

    const handleSelectLocation = (loc: string) => { setSelectedPlace(loc); setSearchQuery(loc); setIsDropdownOpen(false); };
    const handleAddNewLocation = async () => { if (!searchQuery.trim()) return; try { await addHospital(user.uid, searchQuery.trim()); await refreshData(); handleSelectLocation(searchQuery.trim()); } catch (e) { setStatusMsg('เพิ่มสถานที่ล้มเหลว'); } };

    const isCheckedInToday = todayData && todayData.checkIns.length > 0;
    const isCheckedOut = todayData && !!todayData.checkOut;
    const currentStage = isCheckedOut ? 'completed' : isCheckedInToday ? 'working' : 'idle';
    
    const getTheme = (level: number) => {
        if (level >= 9) return { cardBg: 'bg-gradient-to-br from-[#f3eacb] via-[#e2d1a7] to-[#d4c391]', textPrimary: 'text-slate-800', textSecondary: 'text-slate-600', settingsBtn: 'bg-black/5 text-slate-700', avatarBorder: 'border-white/60', progressTrack: 'bg-black/10', progressFill: 'bg-slate-800', statIcon: 'text-amber-700/80', divider: 'border-slate-800/10' };
        if (level >= 7) return { cardBg: 'bg-gradient-to-br from-[#f8e1e7] via-[#eec5d0] to-[#e4abbb]', textPrimary: 'text-slate-800', textSecondary: 'text-slate-600', settingsBtn: 'bg-black/5 text-slate-700', avatarBorder: 'border-white/60', progressTrack: 'bg-black/10', progressFill: 'bg-rose-700', statIcon: 'text-rose-700/80', divider: 'border-slate-800/10' };
        if (level >= 5) return { cardBg: 'bg-gradient-to-br from-[#e0e7ff] via-[#c7d2fe] to-[#a5b4fc]', textPrimary: 'text-slate-800', textSecondary: 'text-slate-600', settingsBtn: 'bg-black/5 text-slate-700', avatarBorder: 'border-white/60', progressTrack: 'bg-black/10', progressFill: 'bg-indigo-700', statIcon: 'text-indigo-700/80', divider: 'border-slate-800/10' };
        if (level >= 3) return { cardBg: 'bg-gradient-to-br from-[#d1fae5] via-[#a7f3d0] to-[#6ee7b7]', textPrimary: 'text-slate-800', textSecondary: 'text-slate-600', settingsBtn: 'bg-black/5 text-slate-700', avatarBorder: 'border-white/60', progressTrack: 'bg-black/10', progressFill: 'bg-emerald-700', statIcon: 'text-emerald-700/80', divider: 'border-slate-800/10' };
        return { cardBg: 'bg-white/90 dark:bg-slate-900/90', textPrimary: 'text-slate-900 dark:text-white', textSecondary: 'text-slate-500 dark:text-slate-400', settingsBtn: 'bg-slate-100 dark:bg-slate-800 text-slate-500', avatarBorder: 'border-white dark:border-slate-700', progressTrack: 'bg-slate-100 dark:bg-black/20', progressFill: 'bg-gradient-to-r from-emerald-400 to-teal-500', statIcon: 'text-orange-500', divider: 'border-slate-200 dark:border-white/5' };
    };

    const theme = getTheme(currentLevel);
    const badge = { 
        label: profile?.role?.toUpperCase() === 'ADMIN' ? 'Admin' : profile?.role?.toUpperCase() === 'MANAGER' ? 'Manager' : 'User', 
        bg: currentLevel >= 3 ? 'bg-black/5 border-black/10 text-slate-700' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
    };

    const handleOpenVisitReport = (idx: number) => { setExpandedVisitIdx(idx); setIsFinalCheckout(false); setShowReportModal(true); };
    const handleCheckOutStart = () => { setIsFinalCheckout(true); setExpandedVisitIdx(0); setShowReportModal(true); };

    if (showRewardModal) {
        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-6 overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    {Array.from({ length: 20 }).map((_, i) => (
                        <div key={i} className="absolute text-2xl animate-[confetti_3s_ease-in-out_infinite]" style={{ left: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 2}s`, top: `-5%` }}>{['✨', '💰', '🎉', '🌟'][Math.floor(Math.random()*4)]}</div>
                    ))}
                </div>
                <div className="relative w-full max-w-sm text-center space-y-8 animate-bounce-in">
                    <div className="w-32 h-32 bg-gradient-to-br from-amber-400 to-orange-600 rounded-[40px] flex items-center justify-center mx-auto shadow-2xl border-4 border-white/50 relative z-10 rotate-12">
                        <PartyPopper size={64} className="text-white" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Quest Complete!</h2>
                        <p className="text-amber-600 dark:text-amber-400 font-black text-xs uppercase tracking-[0.3em]">ภารกิจรายเดือนสำเร็จแล้ว</p>
                    </div>
                    <div className="bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[32px] p-8 backdrop-blur-xl shadow-xl">
                        <p className="text-slate-500 text-xs font-bold uppercase mb-2">You Unlocked</p>
                        <div className="flex items-center justify-center gap-3">
                            <Coins className="text-amber-500" size={32} />
                            <span className="text-5xl font-black text-slate-900 dark:text-white tracking-tight">฿500</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-[10px] font-medium mt-4">รางวัลจะถูกบันทึกลงในพอร์ตสะสมของคุณโดยอัตโนมัติ</p>
                    </div>
                    <button onClick={() => setShowRewardModal(false)} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-black py-5 rounded-[24px] shadow-2xl active:scale-95 transition-all uppercase tracking-widest text-sm">Great! Continue Work</button>
                </div>
                <style dangerouslySetInnerHTML={{ __html: `@keyframes confetti { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(360deg); opacity: 0; } }`}} />
            </div>
        );
    }

    if (showQuestPage) {
        return (
            <div className="fixed inset-0 z-[150] bg-[#d1fae5] dark:bg-[#020617] pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] px-2 sm:px-4 flex flex-col animate-enter overflow-hidden">
                <div className="flex-1 flex flex-col bg-[#F5F5F7] dark:bg-slate-950 text-slate-900 dark:text-white overflow-hidden transition-colors duration-500 rounded-[40px] shadow-2xl border border-white/50 dark:border-white/5 relative">
                    <header className="px-5 pt-6 pb-4 flex items-center gap-4 z-20 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 shrink-0">
                        <button onClick={() => setShowQuestPage(false)} className="p-2.5 bg-slate-200 dark:bg-white/10 rounded-xl text-slate-700 dark:text-white transition-all active:scale-95"><ChevronLeft size={20} /></button>
                        <div><h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Monthly Quest</h2><p className="text-[9px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest">สะสมรางวัลภารกิจรายเดือน</p></div>
                    </header>

                    <main className="flex-1 overflow-y-auto pb-10 px-4 pt-6 space-y-6 relative">
                        {/* Reward Summary Card */}
                        <div className="flex justify-between items-center bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[32px] p-6 shadow-xl relative overflow-hidden group">
                            <Coins className="absolute -right-6 -bottom-6 text-amber-500/10 w-40 h-40 rotate-12" />
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg"><Trophy size={32} className="text-white" /></div>
                                <div>
                                    <h3 className="text-slate-900 dark:text-white font-black text-3xl tracking-tight leading-none">฿500</h3>
                                    <p className="text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest mt-1">Cash Rewards</p>
                                </div>
                            </div>
                            <div className="text-right relative z-10">
                                <div className={`px-3 py-1 rounded-full text-[9px] font-black ${monthlyQuestStats.isClaimed ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-slate-900'}`}>
                                    {monthlyQuestStats.isClaimed ? 'CLAIMED' : 'ACTIVE'}
                                </div>
                            </div>
                        </div>

                        {/* Progress Tracker & Stamps Grid */}
                        <div className="bg-white/70 dark:bg-white/5 p-6 rounded-[36px] border border-slate-200 dark:border-white/5 shadow-inner space-y-4 backdrop-blur-md">
                            <div className="flex justify-between items-end mb-2">
                                <div className="flex flex-col"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progress Tracker</span><span className="text-lg font-black text-slate-900 dark:text-white">{monthlyQuestStats.completedDays}/{monthlyQuestStats.targetDays} <span className="text-slate-500 font-bold text-sm">DAYS</span></span></div>
                                <div className="flex items-center gap-1 px-3 py-1 bg-amber-500/10 rounded-full border border-amber-500/20"><Star size={12} className="text-amber-600 fill-amber-600" /><span className="text-xs font-black text-amber-600">{Math.round(monthlyQuestStats.progress)}%</span></div>
                            </div>
                            <div className="h-4 w-full bg-slate-100 dark:bg-black/40 rounded-full overflow-hidden border border-slate-200 dark:border-white/5 p-1">
                                <div style={{ width: `${monthlyQuestStats.progress}%` }} className="h-full bg-gradient-to-r from-amber-600 to-amber-300 rounded-full transition-all duration-1000 relative">
                                    <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:20px_20px] animate-[progress-shine_2s_linear_infinite]"></div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-7 gap-2 pt-4">
                                {Array.from({ length: monthlyQuestStats.targetDays }).map((_, i) => {
                                    const isDone = i < monthlyQuestStats.completedDays;
                                    const isCurrent = i === monthlyQuestStats.completedDays;
                                    return (
                                        <div key={i} className={`aspect-square rounded-xl flex items-center justify-center transition-all duration-500 ${isDone ? 'bg-amber-500 text-slate-900 shadow-md' : isCurrent ? 'bg-slate-200 dark:bg-slate-800 border-2 border-dashed border-amber-500/50 animate-pulse' : 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 border border-slate-200 dark:border-white/5'}`}>
                                            {isDone ? <Star size={16} fill="currentColor" /> : <div className="text-[10px] font-black opacity-50">{i + 1}</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Rules Section */}
                        <div className="bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-[40px] p-8 space-y-6 backdrop-blur-md">
                            <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-amber-500/10 rounded-xl text-amber-600"><Info size={20} /></div><h4 className="text-slate-900 dark:text-white font-black text-sm uppercase tracking-widest">กติกาการรับรางวัล</h4></div>
                            <div className="space-y-6">
                                <div className="flex gap-4"><div className="w-8 h-8 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-xs font-black shrink-0 border border-amber-500/10">1</div><p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed"><span className="text-slate-900 dark:text-white font-bold block mb-1">เช็คอิน (Check-in)</span> เข้าปฏิบัติงานจริงทุกวันทำงานจันทร์-ศุกร์ ตลอดทั้งเดือน</p></div>
                                <div className="flex gap-4"><div className="w-8 h-8 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-xs font-black shrink-0 border border-amber-500/10">2</div><p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed"><span className="text-slate-900 dark:text-white font-bold block mb-1">บันทึกรายงานกิจกรรม (Visit Report)</span> ให้ครบถ้วนและละเอียดทุกสถานที่ที่เข้าพบ</p></div>
                                <div className="flex gap-4"><div className="w-8 h-8 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-xs font-black shrink-0 border border-amber-500/10">3</div><p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed"><span className="text-slate-900 dark:text-white font-bold block mb-1">เช็คเอาท์ (Check-out)</span> เพื่อส่งสรุปยอดการทำงานและสรุปกิจกรรมทั้งหมดเมื่อจบวัน</p></div>
                            </div>
                            <div className="pt-6 border-t border-slate-200 dark:border-white/5 flex gap-3"><AlertCircle size={16} className="text-amber-600 shrink-0" /><p className="text-[11px] text-amber-600/80 italic leading-relaxed">* หากทำครบเงื่อนไข ระบบจะปลดล็อกปุ่มรางวัลให้กดรับเข้าพอร์ตสะสมทันที</p></div>
                        </div>

                        {/* Claim Button Logic */}
                        <div className="pb-10 pt-4">
                            {monthlyQuestStats.isClaimed ? (
                                <div className="bg-emerald-500 rounded-[32px] p-6 flex items-center justify-between shadow-lg">
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
                                <button onClick={handleClaimReward} disabled={isSavingReport} className="w-full bg-gradient-to-r from-amber-400 to-orange-600 rounded-[32px] p-6 flex items-center justify-between shadow-2xl animate-pulse active:scale-95 transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-slate-950 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-transform"><Gift className="text-amber-500" size={24} /></div>
                                        <div className="flex flex-col text-left">
                                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">Mission Completed</span>
                                            <span className="text-xl font-black text-slate-950 uppercase">CLAIM ฿500 NOW</span>
                                        </div>
                                    </div>
                                    <ChevronRight className="text-slate-950" size={32} />
                                </button>
                            ) : (
                                <div className="bg-slate-200/50 dark:bg-white/10 rounded-[32px] p-6 flex items-center justify-between border border-slate-300 dark:border-white/5 opacity-80 backdrop-blur-sm">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm"><Gift className="text-slate-400" size={24} /></div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Next Target</span>
                                            <span className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase">อีก {monthlyQuestStats.targetDays - monthlyQuestStats.completedDays} วันเพื่อรับรางวัล</span>
                                        </div>
                                    </div>
                                    <div className="p-1.5 bg-white/50 dark:bg-black/20 rounded-xl"><Info className="text-slate-400" size={20} /></div>
                                </div>
                            )}
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl mx-auto space-y-4">
            {/* Minimalist Premium Profile Header */}
            <div className="sticky top-2 z-30 bg-transparent transition-all px-1 py-1">
                <div className="flex items-stretch gap-2 h-32">
                    {/* Modern Compact Card */}
                    <div className={`flex-1 relative rounded-[28px] shadow-lg p-5 overflow-hidden transition-all duration-700 ${theme.cardBg} border border-white/50 dark:border-white/5`}>
                        {/* Subtle Rank Pattern Background */}
                        <div className="absolute top-2 right-2 opacity-[0.03] dark:opacity-[0.05] pointer-events-none rotate-12 scale-150">
                            {rankInfo.icon}
                        </div>
                        
                        <div className="flex justify-between items-start mb-3 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="relative shrink-0">
                                    <div className={`w-12 h-12 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-md overflow-hidden border-2 ${theme.avatarBorder}`}>
                                        {profile?.photoBase64 ? (
                                            <img src={profile.photoBase64} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400 text-lg font-black uppercase">
                                                {profile?.name?.[0] || user.email?.[0]}
                                            </div>
                                        )}
                                    </div>
                                    <div className="absolute bottom-[-3px] left-1/2 -translate-x-1/2">
                                        <div className={`text-[6px] font-black px-1.5 py-0.5 rounded-full border shadow-sm backdrop-blur-md uppercase tracking-tighter ${badge.bg}`}>
                                            {badge.label}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col leading-none">
                                    <h1 className={`text-sm font-black truncate max-w-[120px] flex items-center gap-1 tracking-tight ${theme.textPrimary}`}>
                                        {profile?.name || user.email?.split('@')[0]}
                                        <BadgeCheck size={14} className="text-emerald-500 fill-white shrink-0" />
                                    </h1>
                                    <p className={`text-[8px] font-black uppercase tracking-[0.1em] opacity-60 mt-1 flex items-center gap-1 ${theme.textSecondary}`}>
                                        <MapPin size={8} /> {profile?.area || 'Field Office'}
                                    </p>
                                </div>
                            </div>
                            
                            <button onClick={() => navigate('/settings')} className={`p-1.5 rounded-xl ${theme.settingsBtn} border border-black/5 dark:border-white/5 active:scale-90 transition-all`}>
                                <Settings size={14} />
                            </button>
                        </div>

                        {/* Minimalist Stats Row */}
                        <div className="flex items-center gap-3 relative z-10">
                            <div className="w-10 h-10 rounded-2xl flex flex-col items-center justify-center bg-black/5 dark:bg-white/5 border border-white/10 shadow-inner shrink-0">
                                <span className={`text-[7px] font-black opacity-50 ${theme.textPrimary}`}>LVL</span>
                                <span className={`text-sm font-black ${theme.textPrimary}`}>{currentLevel}</span>
                            </div>
                            
                            <div className="flex-1 space-y-1.5">
                                <div className="flex justify-between items-end">
                                    <span className={`text-[8px] font-black tracking-widest uppercase opacity-70 ${theme.textPrimary}`}>{rankInfo.title}</span>
                                    <div className="flex items-baseline gap-0.5">
                                        <span className={`text-[9px] font-black ${theme.textPrimary}`}>{profile?.xp || 0}</span>
                                        <span className={`text-[7px] font-bold opacity-50 ${theme.textSecondary}`}>XP</span>
                                    </div>
                                </div>
                                <div className={`h-1 w-full rounded-full ${theme.progressTrack} p-[1px]`}>
                                    <div 
                                        style={{ width: `${Math.min(100, Math.max(0, (((profile?.xp || 0) - ((currentLevel - 1) * (currentLevel - 1) * 100)) / ((currentLevel * currentLevel * 100) - ((currentLevel - 1) * (currentLevel - 1) * 100))) * 100))}%` }} 
                                        className={`h-full rounded-full ${theme.progressFill} transition-all duration-1000 ease-out`}
                                    ></div>
                                </div>
                            </div>

                            <div className={`flex flex-col items-center pl-3 border-l ${theme.divider}`}>
                                <div className={`flex items-center gap-1 ${theme.statIcon}`}>
                                    <Flame size={14} className="fill-current" />
                                    <span className={`text-base font-black ${theme.textPrimary}`}>{profile?.currentStreak || 0}</span>
                                </div>
                                <span className={`text-[6px] font-black uppercase tracking-widest opacity-50 ${theme.textSecondary}`}>STREAK</span>
                            </div>
                        </div>
                    </div>

                    {/* Minimalist Quest Button */}
                    <button onClick={() => setShowQuestPage(true)} className="w-12 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-800/80 rounded-[28px] shadow-md border border-white/50 dark:border-white/5 relative overflow-hidden backdrop-blur-xl active:scale-95 transition-all">
                         <div 
                            className={`absolute bottom-0 left-0 right-0 transition-all duration-1000 z-0 ${monthlyQuestStats.isClaimed ? 'bg-emerald-500' : 'bg-emerald-500/20'}`} 
                            style={{ height: `${monthlyQuestStats.progress}%` }}
                        ></div>
                        <div className="relative z-10 flex flex-col items-center">
                            {monthlyQuestStats.isClaimed ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Box size={16} className="text-slate-400" />}
                            <span className="text-[6px] font-black text-slate-500 uppercase tracking-widest mt-1">QUEST</span>
                            <div className="text-[8px] font-black text-slate-900 dark:text-white mt-0.5">{Math.round(monthlyQuestStats.progress)}%</div>
                        </div>
                    </button>
                </div>
            </div>

            <div className="space-y-6 pt-2">
                {xpParticles.map((p) => (<div key={p.id} className="animate-fly-xp flex items-center justify-center fixed inset-0 pointer-events-none z-[200]"><div className="bg-gradient-to-br from-amber-400 to-orange-500 text-white font-black text-3xl px-6 py-3 rounded-full shadow-lg border-2 border-white/40"><Zap className="fill-white" size={28} /> +{p.xp}</div></div>))}
                
                <div className="relative rounded-[32px] border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl overflow-visible" ref={dropdownRef}>
                    <div className="h-52 w-full relative overflow-hidden rounded-t-[32px]">
                        {location ? (
                            <MapDisplay lat={location.lat} lng={location.lng} markers={[{lat: location.lat, lng: location.lng, text: profile?.name || user.email || 'ตำแหน่งของฉัน', photo: profile?.photoBase64}]} className="h-full w-full" zoom={15} />
                        ) : (
                            <div className="h-full w-full bg-slate-100 dark:bg-slate-950 flex items-center justify-center text-slate-500 text-xs gap-2"><Navigation size={14} className="animate-spin" /> ค้นหาตำแหน่ง GPS...</div>
                        )}
                        <button onClick={getLocation} className="absolute top-3 right-3 bg-white/30 dark:bg-slate-900/40 backdrop-blur-md p-2 rounded-full text-white shadow-lg border border-white/20 z-20 hover:bg-white/50 transition-all active:scale-90"><Navigation size={18} /></button>
                        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/60 via-black/30 to-transparent pointer-events-none z-10"></div>
                        <div className="absolute bottom-4 left-4 z-20 pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"><div className="text-2xl font-black text-white leading-none">{time.toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}</div><div className="text-[9px] text-white/90 font-black uppercase tracking-wider mt-1">{time.toLocaleDateString('th-TH', {weekday: 'short', day: 'numeric', month: 'short'})}</div></div>
                        <div className="absolute bottom-4 right-4 z-20"><div className={`px-3 py-1 rounded-full text-[8px] font-black border uppercase tracking-widest shadow-xl backdrop-blur-md ${currentStage === 'working' ? 'bg-emerald-500/80 border-emerald-400 text-white' : currentStage === 'completed' ? 'bg-slate-600/80 border-slate-500 text-white' : 'bg-cyan-500/80 border-cyan-400 text-white'}`}>{currentStage === 'working' ? 'กำลังทำงาน' : currentStage === 'completed' ? 'เลิกงานแล้ว' : 'พร้อมทำงาน'}</div></div>
                    </div>
                    <div className="p-4 space-y-4">
                        {todayPlan && todayPlan.itinerary && todayPlan.itinerary.length > 0 && !isCheckedOut && (
                            <div className="animate-enter"><label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2 mb-2 ml-1"><Target size={10} /> แผนงานวันนี้</label><div className="flex flex-wrap gap-2">{todayPlan.itinerary.map((it, idx) => { const isCheckedIn = todayData?.checkIns.some(ci => ci.location === it.location); return (<button key={idx} onClick={() => handleSelectLocation(it.location)} className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1.5 border shadow-sm active:scale-95 ${selectedPlace === it.location ? 'bg-indigo-600 border-indigo-500 text-white shadow-indigo-500/20' : isCheckedIn ? 'bg-slate-50 dark:bg-slate-800 border-emerald-500/30 text-emerald-500 opacity-60' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-300 hover:border-indigo-500'}`}>{isCheckedIn ? <Check size={12} /> : <MapPin size={12} />}{it.location}</button>); })}</div></div>
                        )}
                        <div className="relative group shadow-lg rounded-2xl"><div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Search size={16} className="text-slate-400" /></div><input type="text" value={searchQuery} onChange={(e) => { const val = e.target.value; setSearchQuery(val); setIsDropdownOpen(true); if(val === '') setSelectedPlace(''); }} onFocus={() => setIsDropdownOpen(true)} placeholder="เลือกสถานที่เพื่อเช็คอิน..." className="block w-full pl-10 pr-4 py-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all text-xs font-medium" />{isDropdownOpen && (<div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-[100] max-h-48 overflow-y-auto ring-1 ring-black/5">{filteredLocations.length > 0 ? (filteredLocations.map((loc, idx) => (<button key={idx} onClick={() => handleSelectLocation(loc)} className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 text-xs flex justify-between items-center border-b border-slate-100 dark:border-white/5 last:border-0 transition-colors"><div className="flex items-center gap-2"><Building size={14} className="text-slate-400" /><span className="font-bold">{loc}</span></div>{selectedPlace === loc && <Check size={12} className="text-cyan-500" />}</button>))) : (<div className="px-4 py-6 text-center text-slate-400 text-xs italic">ไม่พบสถานที่ที่ตรงกับคำค้นหา</div>)}{searchQuery && !profile?.hospitals.some(h => h.toLowerCase() === searchQuery.toLowerCase()) && (<button onClick={handleAddNewLocation} className="w-full text-left px-4 py-3 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 text-xs flex items-center gap-2 border-t-2 border-slate-100 dark:border-white/10 sticky bottom-0 bg-white dark:bg-slate-900 font-black text-center"><div className="bg-cyan-500 text-white p-1 rounded-full inline-block mr-1"><Plus size={10} /></div>เพิ่มรายชื่อใหม่: "{searchQuery}"</button>)}</div>)}</div>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4"><button onClick={handleCheckIn} disabled={isCheckedOut || !selectedPlace} className={`relative group h-28 rounded-[28px] flex flex-col items-center justify-center transition-all duration-300 overflow-hidden ${isCheckedOut || !selectedPlace ? 'bg-slate-100 dark:bg-slate-800 opacity-50 cursor-not-allowed text-slate-400' : 'bg-gradient-to-br from-emerald-400 to-emerald-600 dark:from-emerald-600 dark:to-emerald-800 shadow-emerald-500/20 active:scale-95 text-center'}`}><Plus size={32} className={`${isCheckedOut || !selectedPlace ? 'text-slate-400' : 'text-white'} mb-1`} /><span className={`${isCheckedOut || !selectedPlace ? 'text-slate-400' : 'text-white'} font-black text-lg tracking-tight`}>เช็คอิน</span></button><button onClick={handleCheckOutStart} disabled={!isCheckedInToday} className={`relative group h-28 rounded-[28px] flex flex-col items-center justify-center transition-all duration-300 overflow-hidden ${!isCheckedInToday ? 'bg-slate-100 dark:bg-slate-800 opacity-50 cursor-not-allowed text-slate-400' : isCheckedOut ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-gradient-to-br from-rose-400 to-rose-600 shadow-rose-500/20 active:scale-95 text-center'}`}>{isCheckedOut ? <Edit size={32} className="text-white mb-1" /> : <LogOut size={32} className={`${!isCheckedInToday ? 'text-slate-400' : 'text-white'} mb-1`} />}<span className={`${!isCheckedInToday ? 'text-slate-400' : 'text-white'} font-black text-lg tracking-tight uppercase`}>{isCheckedOut ? 'แก้ไขรายงาน' : 'เช็คเอาท์'}</span></button></div>
                {statusMsg && <div className="text-center text-cyan-600 text-[10px] py-2 bg-cyan-50 dark:bg-cyan-950/30 rounded-xl border border-cyan-100 dark:border-cyan-500/20 font-bold">{statusMsg}</div>}
                <div className="pt-2">
                    <div className="flex items-center gap-2 mb-4 px-2 opacity-60"><Calendar size={12} className="text-slate-500" /><h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">เส้นทางวันนี้</h3></div>
                    <div className="relative pl-4 space-y-4 border-l border-slate-200 dark:border-800 ml-3">{todayData?.checkIns.map((ci, idx) => { const draft = visitDrafts[idx] || { interactions: [] }; const hasInteractions = draft.interactions.length > 0; return (<div key={idx} className="relative pl-6 group"><div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-emerald-500 shadow-lg ring-4 ring-white dark:ring-slate-950 transition-transform group-hover:scale-125"></div><div className="flex justify-between items-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-3 rounded-2xl shadow-sm hover:border-cyan-500/30 transition-all"><div className="flex-1 min-w-0 pr-4 text-left"><div className="text-slate-900 dark:text-white font-bold text-xs truncate">{ci.location}</div><div className="flex items-center gap-2 mt-1"><span className="text-slate-500 dark:text-slate-400 font-mono text-[9px]">{ci.timestamp.toDate().toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}</span>{hasInteractions && (<span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[8px] font-black rounded-full uppercase border border-emerald-200 dark:border-emerald-500/20 flex items-center gap-1"><Check size={8}/> บันทึก {draft.interactions.length} รายการ</span>)}</div></div><button onClick={() => handleOpenVisitReport(idx)} className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-slate-50 dark:bg-slate-800/50 text-slate-400 hover:bg-cyan-50 hover:text-cyan-600 rounded-xl transition-all active:scale-90" title="บันทึกกิจกรรม"><MessageSquare size={16} /></button></div></div>); })}</div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes fly-xp { 
                    0% { opacity: 0; transform: translateY(0) scale(0.5); } 
                    20% { opacity: 1; transform: translateY(-50px) scale(1.2); } 
                    100% { opacity: 0; transform: translateY(-150px) scale(1); } 
                } 
                .animate-fly-xp { animation: fly-xp 1.2s ease-out forwards; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                @keyframes progress-shine {
                    from { background-position: -200% 0; }
                    to { background-position: 200% 0; }
                }
                @keyframes bounce-in {
                    0% { transform: scale(0.3); opacity: 0; }
                    50% { transform: scale(1.05); }
                    70% { transform: scale(0.9); }
                    100% { transform: scale(1); opacity: 1; }
                }
                .animate-bounce-in { animation: bounce-in 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
            `}} />
        </div>
    )
}

export default TimeAttendance;