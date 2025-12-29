import React, { useEffect, useState } from 'react';
import { MapDisplay } from '../components/MapDisplay';
import { GlassCard } from '../components/GlassCard';
import { getAllUsersTodayLocations } from '../services/dbService';
import { UserLocationData } from '../types';
import { 
    Loader2, MapPin, Zap, Activity, Users, 
    ShieldCheck, Cpu, Globe, ArrowUpRight, 
    Layers, Search, Radar
} from 'lucide-react';

const Dashboard: React.FC = () => {
    const [usersData, setUsersData] = useState<UserLocationData[]>([]);
    const [loading, setLoading] = useState(true);
    const [scannedCount, setScannedCount] = useState(0);

    useEffect(() => {
        const fetchAll = async () => {
            const data = await getAllUsersTodayLocations();
            setUsersData(data);
            setLoading(false);
            
            // Animation for the "wow" factor
            let start = 0;
            const end = data.length;
            if (end > 0) {
                const timer = setInterval(() => {
                    start += 1;
                    setScannedCount(start);
                    if (start >= end) clearInterval(timer);
                }, 50);
            }
        };
        fetchAll();
    }, []);

    const markers = usersData.filter(u => u.lastCheckIn).map(u => ({
        lat: u.lastCheckIn!.latitude,
        lng: u.lastCheckIn!.longitude,
        text: `${u.name || u.email.split('@')[0]} @ ${u.lastCheckIn!.location}`,
        photo: u.photoBase64
    }));

    const thailandCenter = { lat: 13.7563, lng: 100.5018 }; // Bangkok Center

    if (loading) return (
        <div className="flex flex-col items-center justify-center pt-40 space-y-4">
            <div className="relative">
                <div className="absolute inset-0 bg-cyan-500 blur-2xl opacity-20 animate-pulse"></div>
                <Loader2 className="animate-spin text-cyan-500 relative z-10" size={48} />
            </div>
            <p className="text-slate-500 font-black text-xs uppercase tracking-[0.3em] animate-pulse">Initializing Neural Link...</p>
        </div>
    );

    return (
        <div className="flex flex-col space-y-8 animate-enter pb-36 px-4 relative">
            {/* Background Atmosphere */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-full blur-[100px] -z-10 pointer-events-none"></div>
            <div className="absolute bottom-40 left-0 w-64 h-64 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

            {/* Futuristic Header */}
            <div className="flex flex-col gap-1 pt-6">
                <div className="flex items-center gap-2 mb-1">
                    <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                    </span>
                    <span className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.4em]">Neural Operations Hub</span>
                </div>
                <div className="flex justify-between items-end">
                    <div>
                        <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter leading-none flex items-center gap-3">
                            Live Space
                            <Radar className="text-slate-200 dark:text-slate-800" size={32} />
                        </h2>
                        <p className="text-slate-500 text-sm mt-2 font-medium">Real-time intelligence feed & workforce mapping</p>
                    </div>
                    <div className="hidden sm:flex gap-4">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Network Status</span>
                            <span className="text-xs font-black text-emerald-500 flex items-center gap-1.5">
                                <ShieldCheck size={14} /> OPTIMAL
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Smart Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <GlassCard className="p-5 bg-gradient-to-br from-white/80 to-slate-50/50 dark:from-slate-900/80 dark:to-slate-950/80 border-cyan-500/20 group hover:border-cyan-500/40">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-cyan-500/10 rounded-xl text-cyan-600 dark:text-cyan-400">
                            <Users size={18} />
                        </div>
                        <ArrowUpRight size={14} className="text-slate-400 group-hover:text-cyan-500 transition-colors" />
                    </div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white leading-none mb-1">{scannedCount}</div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Personnel</div>
                </GlassCard>

                <GlassCard className="p-5 bg-gradient-to-br from-white/80 to-slate-50/50 dark:from-slate-900/80 dark:to-slate-950/80 border-indigo-500/20 group hover:border-indigo-500/40">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400">
                            <Zap size={18} />
                        </div>
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    </div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white leading-none mb-1">100%</div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">System Health</div>
                </GlassCard>

                <GlassCard className="p-5 hidden md:block border-slate-200 dark:border-white/5">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-purple-500/10 rounded-xl text-purple-600 dark:text-purple-400">
                            <Globe size={18} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white leading-none mb-1">TH-BKK</div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Master Region</div>
                </GlassCard>

                <GlassCard className="p-5 hidden md:block border-slate-200 dark:border-white/5">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400">
                            <Layers size={18} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white leading-none mb-1">LIVE</div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Update Stream</div>
                </GlassCard>
            </div>

            {/* Immersive Map Module */}
            <div className="group relative">
                {/* Visual Flair Elements */}
                <div className="absolute -top-3 -left-3 w-10 h-10 border-t-2 border-l-2 border-cyan-500 rounded-tl-2xl z-20 opacity-40 group-hover:opacity-100 transition-opacity"></div>
                <div className="absolute -bottom-3 -right-3 w-10 h-10 border-b-2 border-r-2 border-indigo-500 rounded-br-2xl z-20 opacity-40 group-hover:opacity-100 transition-opacity"></div>
                
                <div className="w-full h-[450px] rounded-[40px] overflow-hidden border border-slate-200 dark:border-white/10 shadow-2xl relative bg-slate-100 dark:bg-slate-900 ring-1 ring-black/5">
                    <MapDisplay 
                        lat={thailandCenter.lat} 
                        lng={thailandCenter.lng} 
                        markers={markers}
                        zoom={10}
                        className="h-full w-full" 
                    />
                    
                    {/* Floating Map Controls / HUD */}
                    <div className="absolute top-6 left-6 flex flex-col gap-2 z-[400]">
                         <div className="px-4 py-2 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center gap-3 shadow-2xl">
                            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div>
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Neural Scan Active</span>
                         </div>
                         <div className="px-4 py-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl flex items-center gap-2 shadow-lg">
                            <MapPin size={12} className="text-rose-500" />
                            <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">{markers.length} Locations</span>
                         </div>
                    </div>

                    <div className="absolute bottom-6 right-6 z-[400]">
                        <button className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-slate-500 dark:text-slate-400">
                            <Cpu size={20} />
                        </button>
                    </div>

                    {/* Scanner Effect Overlay */}
                    <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent h-[100px] w-full animate-[scan_4s_linear_infinite] opacity-50 hidden dark:block"></div>
                </div>
            </div>

            {/* Neural Activity Feed */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                        <Activity size={14} className="text-cyan-500" /> 
                        Activity Stream
                    </h3>
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/50 px-3 py-1 rounded-full border border-slate-200 dark:border-white/5">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">Latency: 24ms</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {usersData.map((u, idx) => (
                        <div 
                            key={u.userId} 
                            style={{ animationDelay: `${idx * 100}ms` }}
                            className="flex items-center gap-4 p-5 bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-white/5 rounded-[28px] hover:shadow-xl hover:border-cyan-500/30 dark:hover:bg-slate-800/50 transition-all shadow-sm group animate-enter"
                        >
                            <div className="relative shrink-0">
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-900 p-1 shadow-inner relative overflow-hidden ring-1 ring-slate-200 dark:ring-white/10">
                                    {u.photoBase64 ? (
                                        <img src={u.photoBase64} alt="Profile" className="w-full h-full object-cover rounded-full" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-400/20 to-blue-500/20 text-cyan-600 dark:text-cyan-400 font-black text-lg">
                                            {u.name ? u.name.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-4 border-white dark:border-slate-900 shadow-sm ${u.isCheckedOut ? 'bg-slate-300' : 'bg-emerald-500 animate-pulse'}`}></div>
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <div className="font-black text-slate-900 dark:text-white text-base truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                                        {u.name || u.email.split('@')[0]}
                                    </div>
                                    <div className="text-[10px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-950 px-2 py-1 rounded-lg shrink-0">
                                        {u.lastCheckIn?.timestamp.toDate().toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}
                                    </div>
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-1 truncate font-medium">
                                    <div className="p-1 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-lg">
                                        <MapPin size={10} className="text-cyan-500 shrink-0"/>
                                    </div>
                                    {u.lastCheckIn?.location}
                                </div>
                            </div>
                            
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <ArrowUpRight size={18} className="text-slate-300" />
                            </div>
                        </div>
                    ))}
                    {usersData.length === 0 && (
                        <div className="col-span-full py-20 text-center flex flex-col items-center justify-center space-y-4 bg-slate-50 dark:bg-slate-900/30 rounded-[40px] border-2 border-dashed border-slate-200 dark:border-white/10">
                            <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-300">
                                <Radar size={40} />
                            </div>
                            <div>
                                <h4 className="text-slate-900 dark:text-white font-black uppercase tracking-widest">No Signal Detected</h4>
                                <p className="text-slate-400 text-sm mt-1">Waiting for neural link check-ins...</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Spacer for bottom navigation clearance */}
            <div className="h-10"></div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes scan {
                    0% { transform: translateY(-100%); }
                    100% { transform: translateY(500%); }
                }
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}} />
        </div>
    );
};

export default Dashboard;