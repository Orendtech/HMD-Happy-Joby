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
        <div className="flex flex-col space-y-5 animate-enter pb-24 px-3 sm:px-4 relative">
            {/* Soft Ambient Accents */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-slate-200/40 dark:bg-orange-500/5 rounded-full blur-[80px] -z-10 pointer-events-none"></div>

            {/* Corporate Header Section */}
            <div className="flex flex-col gap-1 pt-4">
                <div className="flex items-center gap-1.5 mb-1 bg-orange-500/5 dark:bg-orange-500/10 w-fit px-2.5 py-1 rounded-full border border-orange-500/10">
                    <span className="flex h-1.5 w-1.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500"></span>
                    </span>
                    <span className="text-[9px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest">
                        กระดานดำเนินการภาคสนาม
                    </span>
                </div>
                <div className="flex justify-between items-end">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                            ข้อมูลติดตามล่าสุด
                        </h2>
                        <span className="text-xs text-slate-500 font-medium">ภาพรวมพิกัดและขั้นตอนการเข้าพบสถานพยาบาลวันนี้</span>
                    </div>
                    <div className="text-right hidden sm:block">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">สถานะสัญญาณ</span>
                        <span className="text-xs font-bold text-emerald-500 inline-flex items-center gap-1">
                            <ShieldCheck size={14} /> บันทึกเรียบร้อย
                        </span>
                    </div>
                </div>
            </div>

            {/* Premium Compact KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white/90 dark:bg-slate-950/45 border border-slate-150 dark:border-white/5 rounded-2xl p-3.5 shadow-sm">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">เจ้าหน้าที่ภาคสนาม</span>
                        <Users size={14} className="text-orange-500" />
                    </div>
                    <div className="text-xl font-extrabold text-slate-900 dark:text-white leading-none">{scannedCount}</div>
                    <span className="text-[8px] text-slate-400 block mt-1 font-medium">กำลังปฏิบัติงานวันนี้</span>
                </div>

                <div className="bg-white/90 dark:bg-slate-950/45 border border-slate-150 dark:border-white/5 rounded-2xl p-3.5 shadow-sm">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ความเสถียรระบบ</span>
                        <Zap size={14} className="text-emerald-500" />
                    </div>
                    <div className="text-xl font-extrabold text-slate-900 dark:text-white leading-none">100%</div>
                    <span className="text-[8px] text-slate-400 block mt-1 font-medium">พร้อมรับส่งสัญญาณพิกัด</span>
                </div>

                <div className="bg-white/90 dark:bg-slate-950/45 border border-slate-150 dark:border-white/5 rounded-2xl p-3.5 shadow-sm">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">พื้นที่ดำเนินการ</span>
                        <Globe size={14} className="text-indigo-500" />
                    </div>
                    <div className="text-xl font-extrabold text-slate-900 dark:text-white leading-none">TH-BKK</div>
                    <span className="text-[8px] text-slate-400 block mt-1 font-medium">ภูมิภาคกรุงเทพฯ เเละปริมณฑล</span>
                </div>

                <div className="bg-white/90 dark:bg-slate-950/45 border border-slate-150 dark:border-white/5 rounded-2xl p-3.5 shadow-sm">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">สถานะอัปเดต</span>
                        <Layers size={14} className="text-cyan-500" />
                    </div>
                    <div className="text-xl font-extrabold text-slate-900 dark:text-white leading-none">LIVE</div>
                    <span className="text-[8px] text-slate-400 block mt-1 font-medium">อัปเดตเรียลไทม์พารามิเตอร์</span>
                </div>
            </div>

            {/* Immersive Compact Map Module */}
            <div className="relative rounded-[24px] overflow-hidden border border-slate-200 dark:border-white/10 shadow-md bg-white dark:bg-slate-950 p-1">
                <div className="w-full h-80 rounded-[20px] overflow-hidden relative bg-slate-100 dark:bg-slate-900">
                    <MapDisplay 
                        lat={thailandCenter.lat} 
                        lng={thailandCenter.lng} 
                        markers={markers}
                        zoom={10}
                        className="h-full w-full" 
                    />
                    
                    {/* Compact floating indicator badges on Map */}
                    <div className="absolute top-4 left-4 flex flex-col gap-1.5 z-[100] pointer-events-none">
                         <div className="px-3 py-1.5 bg-slate-950/90 text-white backdrop-blur-md rounded-xl flex items-center gap-2 border border-white/10 shadow-lg text-[9px] font-bold uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                            <span>ติดตามสถานะเรียลไทม์</span>
                         </div>
                         <div className="px-3 py-1.5 bg-white/90 dark:bg-slate-950/90 text-slate-700 dark:text-slate-350 backdrop-blur-md rounded-xl flex items-center gap-1.5 border border-slate-200/50 dark:border-white/10 shadow text-[9px] font-bold uppercase tracking-wider">
                            <MapPin size={10} className="text-rose-500" />
                            <span>ตรวจพบ {markers.length} ตำแหน่งเข้างาน</span>
                         </div>
                    </div>
                </div>
            </div>

            {/* Field Staff Activity Stream */}
            <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Activity size={12} className="text-orange-500" /> 
                        รายงานกิจกรรมของเจ้าหน้าที่วันนี้
                    </h3>
                    <div className="text-[9px] font-bold text-slate-400 uppercase bg-slate-150/50 dark:bg-slate-900/40 px-2 py-0.5 rounded border border-slate-200 dark:border-white/5 shrink-0">
                        เครือข่ายสัญญาณปกติ
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {usersData.map((u, idx) => (
                        <div 
                            key={u.userId} 
                            style={{ animationDelay: `${idx * 60}ms` }}
                            className="flex items-center gap-3.5 p-3.5 bg-white dark:bg-slate-900/30 border border-slate-150 dark:border-white/5 rounded-2xl hover:border-orange-500/25 dark:hover:bg-slate-900/50 transition-all shadow-xs group animate-enter"
                        >
                            <div className="relative shrink-0">
                                <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 p-0.5 shadow-inner relative overflow-hidden border border-slate-200/40 dark:border-white/10">
                                    {u.photoBase64 ? (
                                        <img src={u.photoBase64} alt="Profile" className="w-full h-full object-cover rounded-full" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-400/10 to-amber-500/10 text-orange-600 dark:text-orange-400 font-bold text-sm">
                                            {u.name ? u.name.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 shadow-sm ${u.isCheckedOut ? 'bg-slate-300' : 'bg-emerald-500'}`}></div>
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center">
                                    <span className="font-extrabold text-slate-800 dark:text-white text-xs truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                                        {u.name || u.email.split('@')[0]}
                                    </span>
                                    <span className="text-[9px] font-mono font-medium text-slate-400 shrink-0 bg-slate-50 dark:bg-slate-950 px-1.5 py-0.5 rounded border border-slate-100 dark:border-white/5">
                                        {u.lastCheckIn?.timestamp.toDate().toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1 truncate">
                                    <MapPin size={10} className="text-orange-400 shrink-0"/>
                                    <span className="truncate">{u.lastCheckIn?.location || 'ยังไม่ได้เข้าพิกัด'}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {usersData.length === 0 && (
                        <div className="col-span-full py-16 text-center flex flex-col items-center justify-center space-y-3 bg-slate-50/50 dark:bg-slate-900/10 rounded-2xl border border-dashed border-slate-200 dark:border-white/5">
                            <span className="text-slate-300 dark:text-slate-700">
                                <Radar size={32} />
                            </span>
                            <div>
                                <h4 className="text-slate-800 dark:text-white text-xs font-bold uppercase tracking-wider">ไม่พบข้อมููลพิกัดขณะนี้</h4>
                                <p className="text-[10px] text-slate-400 mt-0.5">รอเจ้าหน้าที่ทำการบันทึกเวลาเข้าพบโรงพยาบาล</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;