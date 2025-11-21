
import React, { useEffect, useState, useRef } from 'react';
import { User } from 'firebase/auth';
import { MapPin, Navigation, Plus, LogOut, Calendar, ChevronRight, Sparkles, Map as MapIcon, X, Search, Check, Flame, Trophy, Zap, TrendingUp, DollarSign, Percent, BarChart3, Users, RefreshCw, Briefcase } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { MapDisplay } from '../components/MapDisplay';
import { getUserProfile, getTodayAttendance, checkIn, checkOut, addHospital } from '../services/dbService';
import { UserProfile, AttendanceDay, DailyReport, PipelineData } from '../types';

interface Props {
    user: User;
}

const getRankTitle = (level: number) => {
    if (level >= 9) return { title: 'LEGEND', color: 'text-amber-400', bg: 'bg-gradient-to-br from-amber-500/20 to-amber-600/20 border-amber-500/50', glow: 'shadow-amber-500/20' };
    if (level >= 7) return { title: 'ELITE', color: 'text-rose-400', bg: 'bg-gradient-to-br from-rose-500/20 to-rose-600/20 border-rose-500/50', glow: 'shadow-rose-500/20' };
    if (level >= 5) return { title: 'RANGER', color: 'text-purple-400', bg: 'bg-gradient-to-br from-purple-500/20 to-purple-600/20 border-purple-500/50', glow: 'shadow-purple-500/20' };
    if (level >= 3) return { title: 'SCOUT', color: 'text-cyan-400', bg: 'bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 border-cyan-500/50', glow: 'shadow-cyan-500/20' };
    return { title: 'ROOKIE', color: 'text-slate-400', bg: 'bg-gradient-to-br from-slate-700/20 to-slate-800/20 border-slate-600/50', glow: 'shadow-slate-500/20' };
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
    
    // Report Modal State
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportSummary, setReportSummary] = useState('');
    
    // Multi-Contact State
    const [metWithStack, setMetWithStack] = useState<string[]>([]);
    const [selectedContact, setSelectedContact] = useState('');
    
    // Pipeline Stack State
    const [pipelineStack, setPipelineStack] = useState<PipelineData[]>([]);
    
    // Pipeline Form State
    const [dealMode, setDealMode] = useState<'new' | 'update'>('new');
    const [selectedExistingDealId, setSelectedExistingDealId] = useState('');
    const [pipelineProduct, setPipelineProduct] = useState('');
    const [pipelineValue, setPipelineValue] = useState('');
    const [pipelineStage, setPipelineStage] = useState('Prospecting');
    const [pipelineProb, setPipelineProb] = useState(20);

    // Gamification State
    const [xpGained, setXpGained] = useState<number | null>(null);
    const [showLevelUp, setShowLevelUp] = useState(false);
    const [newLevelDisplay, setNewLevelDisplay] = useState(0);

    const refreshData = async () => {
        const p = await getUserProfile(user.uid);
        const a = await getTodayAttendance(user.uid);
        setProfile(p);
        setTodayData(a);
    };

    useEffect(() => {
        refreshData();
        getLocation();
        const timer = setInterval(() => setTime(new Date()), 1000);
        
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
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
                (pos) => {
                    setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                    setLoadingLoc(false);
                },
                (err) => {
                    setStatusMsg('GPS Access Denied');
                    setLoadingLoc(false);
                },
                { enableHighAccuracy: true }
            );
        } else {
            setStatusMsg('GPS Not Supported');
            setLoadingLoc(false);
        }
    };

    const handleCheckIn = async () => {
        if (!location) { getLocation(); return; }
        if (!selectedPlace) { setStatusMsg('Please select or add a location'); return; }
        try {
            const result = await checkIn(user.uid, selectedPlace, location.lat, location.lng);
            setStatusMsg('Checked in successfully');
            
            setXpGained(result.earnedXp);
            setTimeout(() => setXpGained(null), 3000); 

            if (result.isLevelUp) {
                setNewLevelDisplay(result.newLevel);
                setShowLevelUp(true);
            }

            refreshData();
        } catch (e) { setStatusMsg('Check-in failed'); }
    };

    const addContact = () => {
        if (selectedContact && !metWithStack.includes(selectedContact)) {
            setMetWithStack([...metWithStack, selectedContact]);
            setSelectedContact('');
        }
    };

    const removeContact = (name: string) => {
        setMetWithStack(metWithStack.filter(c => c !== name));
    };

    const handleExistingDealSelect = (dealId: string) => {
        const deal = profile?.activePipeline?.find(p => p.id === dealId);
        setSelectedExistingDealId(dealId);
        if (deal) {
            setPipelineProduct(deal.product);
            setPipelineValue(deal.value.toString());
            setPipelineStage(deal.stage);
            setPipelineProb(deal.probability);
        }
    };

    const addPipelineItem = () => {
        if (!pipelineProduct || !pipelineValue) return;
        
        const newItem: PipelineData = {
            id: dealMode === 'update' ? selectedExistingDealId : undefined,
            product: pipelineProduct,
            value: parseFloat(pipelineValue) || 0,
            stage: pipelineStage,
            probability: pipelineProb,
            isNew: dealMode === 'new' // Helper for UI to color code
        };

        // Remove if already in stack (update the update)
        const filteredStack = pipelineStack.filter(p => p.id !== newItem.id || !p.id);
        
        setPipelineStack([...filteredStack, newItem]);
        
        // Reset form
        setPipelineProduct('');
        setPipelineValue('');
        setPipelineStage('Prospecting');
        setPipelineProb(20);
        setDealMode('new');
        setSelectedExistingDealId('');
    };

    const removePipelineItem = (idx: number) => {
        const newStack = [...pipelineStack];
        newStack.splice(idx, 1);
        setPipelineStack(newStack);
    };

    const confirmCheckOut = async () => {
         try {
            const lastCheckInLocation = todayData?.checkIns.length ? todayData.checkIns[todayData.checkIns.length - 1].location : selectedPlace;
            
            const reportData: DailyReport = { 
                summary: reportSummary, 
                metWith: metWithStack,
                hospital: lastCheckInLocation,
                pipeline: pipelineStack.length > 0 ? pipelineStack : undefined
            };
            
            await checkOut(user.uid, reportData);
            setStatusMsg('Shift ended & report saved.');
            setShowReportModal(false);
            
            setReportSummary('');
            setMetWithStack([]);
            setPipelineStack([]);
            setPipelineProduct('');
            setPipelineValue('');
            
            refreshData();
        } catch (e) { setStatusMsg('Check-out failed'); }
    };

    const filteredLocations = profile?.hospitals.filter(h => 
        h.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    const handleSelectLocation = (loc: string) => {
        setSelectedPlace(loc);
        setSearchQuery(loc);
        setIsDropdownOpen(false);
    };

    const handleAddNewLocation = async () => {
        if (!searchQuery.trim()) return;
        try {
            await addHospital(user.uid, searchQuery.trim());
            await refreshData();
            handleSelectLocation(searchQuery.trim());
        } catch (e) {
            setStatusMsg('Failed to add new location');
        }
    };

    const isCheckedInToday = todayData && todayData.checkIns.length > 0;
    const isCheckedOut = todayData && !!todayData.checkOut;
    const currentStage = isCheckedOut ? 'completed' : isCheckedInToday ? 'working' : 'idle';

    const lastCheckInLocation = todayData?.checkIns.length 
        ? todayData.checkIns[todayData.checkIns.length - 1].location 
        : selectedPlace;

    const allCustomers = profile?.customers || [];
    const sortedCustomers = [...allCustomers].sort((a, b) => {
        if (!lastCheckInLocation) return 0;
        const aMatch = a.hospital === lastCheckInLocation;
        const bMatch = b.hospital === lastCheckInLocation;
        if (aMatch && !bMatch) return -1; 
        if (!aMatch && bMatch) return 1;
        return 0;
    });

    // Filter active pipeline (Optional: filter by location if we stored it, but for now show all)
    const activeDeals = profile?.activePipeline || [];

    const currentLevel = profile?.level || 1;
    const currentXP = profile?.xp || 0;
    const getNextLevelXP = (lvl: number) => {
        if (lvl === 1) return 100;
        if (lvl === 2) return 400;
        if (lvl === 3) return 900;
        if (lvl === 4) return 1600;
        if (lvl === 5) return 2500;
        return lvl * lvl * 100; 
    };
    const nextLevelXP = getNextLevelXP(currentLevel);
    const prevLevelXP = getNextLevelXP(currentLevel - 1) || 0;
    const progressPercent = Math.min(100, Math.max(0, ((currentXP - prevLevelXP) / (nextLevelXP - prevLevelXP)) * 100));
    const rank = getRankTitle(currentLevel);

    const pipelineStages = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

    return (
        <div className="max-w-lg mx-auto space-y-4 animate-enter pb-24">
            {/* --- GAMIFICATION HUD --- */}
            <div className="relative overflow-hidden bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-3xl p-4 shadow-2xl sticky top-0 z-50">
                {/* Background Accent */}
                <div className={`absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 opacity-70`}></div>
                
                <div className="flex items-center justify-between relative z-10">
                    {/* Level & XP Section */}
                    <div className="flex items-center gap-4">
                         {/* Level Badge */}
                        <div className="relative">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg border ${rank.bg} relative overflow-hidden group`}>
                                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                                <span className="font-black text-white text-xl drop-shadow-md">{currentLevel}</span>
                            </div>
                            {/* Badge Pulse */}
                            <div className={`absolute -inset-2 rounded-3xl blur-md opacity-30 ${rank.bg.split(' ')[0].replace('bg-gradient-to-br', 'bg')} -z-10 animate-pulse`}></div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-end gap-2">
                                <span className={`text-xs font-black tracking-widest ${rank.color} uppercase drop-shadow-sm leading-none`}>{rank.title}</span>
                                <span className="text-[10px] text-slate-500 font-mono leading-none">{currentXP} XP</span>
                            </div>
                            
                            {/* XP Progress Bar */}
                            <div className="w-36 h-2.5 bg-slate-950 rounded-full relative overflow-hidden shadow-inner border border-white/5">
                                 <div 
                                    style={{width: `${progressPercent}%`}} 
                                    className="h-full bg-gradient-to-r from-cyan-400 to-blue-600 rounded-full relative transition-all duration-1000 ease-out"
                                >
                                    {/* Shimmer Effect */}
                                    <div className="absolute inset-0 bg-white/30 w-full h-full animate-pulse"></div>
                                </div>
                            </div>
                            <div className="text-[9px] text-slate-500 font-medium text-right">
                                {Math.floor(nextLevelXP - currentXP)} XP to next level
                            </div>
                        </div>
                    </div>

                    {/* Streak Counter */}
                    <div className="flex flex-col items-end">
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all duration-500 ${
                            (profile?.currentStreak || 0) > 0 
                            ? 'bg-orange-500/10 border-orange-500/30 shadow-[0_0_15px_-5px_rgba(249,115,22,0.4)]' 
                            : 'bg-slate-800 border-slate-700'
                        }`}>
                            <Flame 
                                size={16} 
                                className={`${(profile?.currentStreak || 0) > 0 ? 'text-orange-500 fill-orange-500 animate-pulse' : 'text-slate-600'}`} 
                            />
                            <span className={`font-black text-sm ${(profile?.currentStreak || 0) > 0 ? 'text-orange-400' : 'text-slate-500'}`}>
                                {profile?.currentStreak || 0}
                            </span>
                        </div>
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1 opacity-70">Day Streak</span>
                    </div>
                </div>
            </div>

            {xpGained && (
                <div className="fixed top-32 left-1/2 transform -translate-x-1/2 z-[60] pointer-events-none animate-float-up">
                    <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white font-black text-xl px-6 py-3 rounded-2xl shadow-2xl shadow-orange-500/40 flex items-center gap-3 border-2 border-white/20">
                        <Zap className="fill-white animate-bounce" size={24} /> 
                        <span>+{xpGained} XP</span>
                    </div>
                </div>
            )}

            {/* --- HERO & LOCATION CONTEXT --- */}
            <div className="space-y-4">
                <div className="flex justify-between items-end px-2 pt-2">
                    <div>
                        <div className="text-3xl font-bold text-white tracking-tight leading-none">
                            {time.toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}
                        </div>
                        <div className="text-xs text-slate-500 font-medium mt-1">
                            {time.toLocaleDateString('en-US', {weekday: 'long', day: 'numeric', month: 'short'})}
                        </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                        currentStage === 'working' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 animate-pulse' :
                        currentStage === 'completed' ? 'bg-slate-800 border-slate-700 text-slate-400' :
                        'bg-blue-500/10 border-blue-500/30 text-blue-400'
                    }`}>
                        {currentStage === 'working' ? 'On Duty' : currentStage === 'completed' ? 'Off Duty' : 'Ready'}
                    </div>
                </div>

                <div className="relative rounded-3xl border border-white/10 bg-slate-900 shadow-xl group" ref={dropdownRef}>
                    <div className="h-40 w-full relative rounded-t-3xl overflow-hidden">
                        {location ? (
                            <MapDisplay lat={location.lat} lng={location.lng} className="h-full w-full opacity-60 group-hover:opacity-80 transition-all duration-500" zoom={15} />
                        ) : (
                            <div className="h-full w-full bg-slate-950 flex items-center justify-center text-slate-600 text-xs gap-2">
                                <Navigation size={14} className="animate-spin" /> Acquiring GPS...
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent pointer-events-none"></div>
                        <button onClick={getLocation} className="absolute top-3 right-3 bg-slate-900/80 p-2 rounded-full text-slate-300 hover:text-white hover:bg-cyan-500 hover:scale-110 transition-all shadow-lg z-10">
                            <Navigation size={14} />
                        </button>
                    </div>
                    
                    <div className="p-4 -mt-8 relative z-20">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Search size={18} className="text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
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
                                onFocus={() => {
                                    if (searchQuery.length > 0) setIsDropdownOpen(true);
                                }}
                                placeholder="Search location to check-in..."
                                className="block w-full pl-11 pr-4 py-4 bg-slate-800/90 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:bg-slate-800 transition-all shadow-lg text-sm font-medium"
                            />
                            {searchQuery && (
                                <button onClick={() => {setSearchQuery(''); setSelectedPlace(''); setIsDropdownOpen(false);}} className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-white">
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                        
                        {isDropdownOpen && (
                            <div className="absolute top-full left-4 right-4 mt-2 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-50 max-h-52 overflow-y-auto">
                                {filteredLocations.map((loc, idx) => (
                                    <button key={idx} onClick={() => handleSelectLocation(loc)} className="w-full text-left px-4 py-3 hover:bg-white/5 text-slate-300 hover:text-white text-sm flex justify-between items-center border-b border-white/5 last:border-0">
                                        {loc}
                                        {selectedPlace === loc && <Check size={14} className="text-cyan-400" />}
                                    </button>
                                ))}
                                {filteredLocations.length === 0 && searchQuery && (
                                    <button onClick={handleAddNewLocation} className="w-full text-left px-4 py-3 hover:bg-cyan-900/20 text-cyan-400 text-sm flex items-center gap-2 border-t border-white/5">
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
                        className={`relative group h-28 rounded-3xl flex flex-col items-center justify-center transition-all duration-300 overflow-hidden ${
                            isCheckedOut ? 'bg-slate-800 opacity-50 cursor-not-allowed' : 'bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-[0_10px_20px_-5px_rgba(16,185,129,0.4)] active:scale-95'
                        }`}
                    >
                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <Plus size={32} className="text-white mb-1 drop-shadow-md" />
                        <span className="text-white font-bold text-lg tracking-wide drop-shadow-md">CHECK IN</span>
                        <span className="text-emerald-200 text-[10px] font-medium uppercase tracking-wider mt-1 bg-black/20 px-2 py-0.5 rounded-full">Start Task</span>
                    </button>

                    <button 
                        onClick={() => setShowReportModal(true)}
                        disabled={!isCheckedInToday || isCheckedOut}
                        className={`relative group h-28 rounded-3xl flex flex-col items-center justify-center transition-all duration-300 overflow-hidden ${
                            !isCheckedInToday || isCheckedOut ? 'bg-slate-800 opacity-50 cursor-not-allowed border border-white/5' : 'bg-gradient-to-br from-slate-800 to-slate-900 border border-rose-500/30 shadow-[0_10px_20px_-5px_rgba(244,63,94,0.2)] active:scale-95'
                        }`}
                    >
                        <div className="absolute inset-0 bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <LogOut size={32} className={`mb-1 drop-shadow-md ${!isCheckedInToday || isCheckedOut ? 'text-slate-500' : 'text-rose-400'}`} />
                        <span className={`font-bold text-lg tracking-wide drop-shadow-md ${!isCheckedInToday || isCheckedOut ? 'text-slate-500' : 'text-rose-400'}`}>CHECK OUT</span>
                        <span className="text-slate-500 text-[10px] font-medium uppercase tracking-wider mt-1 bg-black/20 px-2 py-0.5 rounded-full">Finish Task</span>
                    </button>
                </div>

                {statusMsg && (
                    <div className="text-center text-cyan-400 text-sm py-2 bg-cyan-950/30 rounded-xl border border-cyan-500/20 animate-fade-in-up">
                        {statusMsg}
                    </div>
                )}
            </div>

            {/* --- HISTORY LIST (COMPACT) --- */}
            <div className="pt-4">
                <div className="flex items-center gap-2 mb-4 px-2">
                    <Calendar size={14} className="text-slate-500" />
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Today's Journey</h3>
                </div>
                
                <div className="relative pl-4 space-y-6 border-l border-slate-800 ml-3">
                    {todayData?.checkIns.map((ci, idx) => (
                        <div key={idx} className="relative pl-6 animate-enter" style={{animationDelay: `${idx * 50}ms`}}>
                            <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                            <div className="flex justify-between items-start bg-slate-900/40 border border-white/5 p-3 rounded-xl">
                                <div>
                                    <div className="text-white font-medium text-sm">{ci.location}</div>
                                    <div className="text-emerald-400 text-[10px] font-bold uppercase mt-0.5">Check In</div>
                                </div>
                                <div className="text-slate-500 font-mono text-xs bg-black/30 px-2 py-1 rounded">
                                    {ci.timestamp.toDate().toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}
                                </div>
                            </div>
                        </div>
                    ))}
                    {todayData?.checkOut && (
                        <div className="relative pl-6 animate-enter">
                            <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"></div>
                            <div className="flex justify-between items-start bg-rose-950/10 border border-rose-500/20 p-3 rounded-xl">
                                <div>
                                    <div className="text-slate-300 font-medium text-sm">Shift Ended</div>
                                    <div className="text-rose-400 text-[10px] font-bold uppercase mt-0.5">Check Out</div>
                                </div>
                                <div className="text-rose-400/70 font-mono text-xs bg-rose-950/30 px-2 py-1 rounded border border-rose-500/10">
                                    {todayData.checkOut.toDate().toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}
                                </div>
                            </div>
                        </div>
                    )}
                    {!todayData?.checkIns.length && (
                        <div className="pl-6 text-slate-600 text-xs italic">Ready to start your day...</div>
                    )}
                </div>
            </div>

            {/* Report Modal */}
            {showReportModal && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 overflow-y-auto">
                    <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl animate-enter my-auto">
                        <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                             <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Sparkles className="text-purple-400" size={18}/> Checkout Report
                            </h2>
                            <button onClick={() => setShowReportModal(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white">
                                <X size={18} />
                            </button>
                        </div>
                        
                        <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
                            {/* Section 1: Visit Details */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                    <MapIcon size={12}/> Visit Details
                                </h3>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1.5">Who did you meet?</label>
                                    <div className="flex gap-2 mb-2">
                                         <div className="relative flex-1">
                                            <select 
                                                value={selectedContact}
                                                onChange={(e) => setSelectedContact(e.target.value)}
                                                className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-purple-500 appearance-none text-sm"
                                            >
                                                <option value="">-- Select Customer --</option>
                                                {sortedCustomers.map((c, i) => (
                                                    <option key={i} value={c.name}>
                                                        {c.name} ({c.department}) {c.hospital !== lastCheckInLocation ? ` @ ${c.hospital}` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronRight className="absolute right-3 top-3.5 text-slate-500 rotate-90" size={16} />
                                        </div>
                                        <button 
                                            onClick={addContact}
                                            disabled={!selectedContact}
                                            className="bg-purple-600/20 border border-purple-500/30 text-purple-400 p-3 rounded-xl hover:bg-purple-600 hover:text-white transition-all disabled:opacity-50"
                                        >
                                            <Plus size={18} />
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {metWithStack.map((name, idx) => (
                                            <span key={idx} className="flex items-center gap-1 bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs px-2 py-1 rounded-lg animate-enter">
                                                {name}
                                                <button onClick={() => removeContact(name)} className="hover:text-white"><X size={12}/></button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1.5">Summary / Outcome</label>
                                    <textarea 
                                        value={reportSummary}
                                        onChange={(e) => setReportSummary(e.target.value)}
                                        placeholder="Key takeaways from this visit..."
                                        rows={3}
                                        className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-purple-500 resize-none text-sm placeholder:text-slate-600"
                                    />
                                </div>
                            </div>

                            {/* Section 2: Sales Pipeline Intelligence */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1">
                                        <TrendingUp size={12}/> Sales Opportunities
                                    </h3>
                                    {pipelineStack.length > 0 && (
                                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                                            {pipelineStack.length} Added
                                        </span>
                                    )}
                                </div>

                                {/* Pipeline Stack Display */}
                                {pipelineStack.map((item, idx) => (
                                    <div key={idx} className={`border rounded-xl p-3 flex justify-between items-center animate-enter ${item.isNew ? 'bg-cyan-900/20 border-cyan-500/30' : 'bg-orange-900/20 border-orange-500/30'}`}>
                                        <div>
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.isNew ? 'bg-cyan-500 text-white' : 'bg-orange-500 text-white'}`}>
                                                    {item.isNew ? 'NEW' : 'UPDATE'}
                                                </span>
                                                <div className="text-sm font-bold text-white">{item.product}</div>
                                            </div>
                                            <div className="text-xs text-slate-400">{item.stage} • {item.probability}%</div>
                                        </div>
                                        <div className="text-right flex items-center gap-3">
                                            <div className="font-mono text-emerald-400 text-sm">฿{item.value.toLocaleString()}</div>
                                            <button onClick={() => removePipelineItem(idx)} className="p-1 text-slate-500 hover:text-rose-400 transition-colors">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {/* Pipeline Entry Form */}
                                <div className="bg-gradient-to-br from-indigo-900/10 to-purple-900/10 p-4 rounded-2xl border border-indigo-500/20 space-y-4 relative">
                                    
                                    {/* Deal Mode Toggle */}
                                    <div className="flex p-1 bg-black/40 rounded-lg mb-2">
                                        <button 
                                            onClick={() => { setDealMode('new'); setPipelineProduct(''); setPipelineValue(''); setSelectedExistingDealId(''); }}
                                            className={`flex-1 text-xs py-2 rounded-md font-bold transition-all ${dealMode === 'new' ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            New Opportunity
                                        </button>
                                        <button 
                                            onClick={() => setDealMode('update')}
                                            className={`flex-1 text-xs py-2 rounded-md font-bold transition-all ${dealMode === 'update' ? 'bg-orange-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            Follow Up / Update
                                        </button>
                                    </div>

                                    {/* Smart Selector for Updates */}
                                    {dealMode === 'update' && (
                                        <div className="animate-enter">
                                            <label className="block text-xs text-orange-200/70 mb-1.5">Select Active Deal</label>
                                            <div className="relative">
                                                <select 
                                                    value={selectedExistingDealId}
                                                    onChange={(e) => handleExistingDealSelect(e.target.value)}
                                                    className="w-full bg-black/30 border border-orange-500/30 rounded-xl p-3 text-white outline-none focus:border-orange-400 appearance-none text-sm"
                                                >
                                                    <option value="">-- Select Ongoing Deal --</option>
                                                    {activeDeals.map(deal => (
                                                        <option key={deal.id} value={deal.id}>
                                                            {deal.product} ({deal.stage}) - ฿{deal.value.toLocaleString()}
                                                        </option>
                                                    ))}
                                                </select>
                                                <ChevronRight className="absolute right-3 top-3.5 text-orange-500 rotate-90" size={16} />
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-xs text-indigo-200/70 mb-1.5">Product / Solution</label>
                                        <input 
                                            type="text"
                                            value={pipelineProduct}
                                            onChange={(e) => setPipelineProduct(e.target.value)}
                                            placeholder="e.g. Medical Device Model X"
                                            disabled={dealMode === 'update'} // Auto-filled
                                            className="w-full bg-black/30 border border-indigo-500/30 rounded-xl p-3 text-white outline-none focus:border-indigo-400 text-sm placeholder:text-indigo-200/30 disabled:opacity-50 disabled:bg-black/10"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-indigo-200/70 mb-1.5">Est. Value (THB)</label>
                                            <div className="relative">
                                                <div className="absolute left-3 top-3 text-indigo-400"><DollarSign size={14}/></div>
                                                <input 
                                                    type="number"
                                                    value={pipelineValue}
                                                    onChange={(e) => setPipelineValue(e.target.value)}
                                                    placeholder="0.00"
                                                    className="w-full bg-black/30 border border-indigo-500/30 rounded-xl py-3 pl-8 pr-3 text-white outline-none focus:border-indigo-400 text-sm placeholder:text-indigo-200/30"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-indigo-200/70 mb-1.5">Stage</label>
                                            <div className="relative">
                                                <select 
                                                    value={pipelineStage}
                                                    onChange={(e) => setPipelineStage(e.target.value)}
                                                    className="w-full bg-black/30 border border-indigo-500/30 rounded-xl py-3 px-3 text-white outline-none focus:border-indigo-400 appearance-none text-sm"
                                                >
                                                    {pipelineStages.map(s => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between text-xs text-indigo-200/70 mb-2">
                                            <span>Probability to Close</span>
                                            <span className="font-bold text-indigo-300">{pipelineProb}%</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="0" 
                                            max="100" 
                                            step="5"
                                            value={pipelineProb} 
                                            onChange={(e) => setPipelineProb(parseInt(e.target.value))}
                                            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                        />
                                        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                                            <span>Low</span>
                                            <span>High</span>
                                        </div>
                                    </div>

                                    <button 
                                        onClick={addPipelineItem}
                                        disabled={!pipelineProduct || !pipelineValue}
                                        className={`w-full py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${dealMode === 'new' ? 'bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300' : 'bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-300'}`}
                                    >
                                        <Plus size={16} /> {dealMode === 'new' ? 'Add New Deal' : 'Update Deal'}
                                    </button>
                                </div>
                            </div>

                            <button 
                                onClick={confirmCheckOut}
                                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 py-4 rounded-2xl font-bold text-white shadow-lg shadow-purple-900/40 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <Check size={20} /> Submit Report & End Shift
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* LEVEL UP MODAL */}
            {showLevelUp && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6 animate-enter">
                    <div className="text-center relative">
                         <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-600 blur-[80px] opacity-30 animate-pulse"></div>
                        <div className="relative z-10">
                            <Trophy size={80} className="text-amber-400 mx-auto mb-4 drop-shadow-[0_0_30px_rgba(251,191,36,0.6)]" />
                            <h2 className="text-5xl font-black text-white italic mb-2 tracking-tighter drop-shadow-2xl">LEVEL UP!</h2>
                            <p className="text-cyan-300 text-xl font-bold mb-8 tracking-wide">Welcome to Level {newLevelDisplay}</p>
                            <button 
                                onClick={() => setShowLevelUp(false)}
                                className="px-10 py-3 bg-white text-slate-950 font-black rounded-full hover:scale-110 transition-transform shadow-xl shadow-white/20"
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
