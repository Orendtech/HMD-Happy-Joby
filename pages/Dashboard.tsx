import React, { useEffect, useState } from 'react';
import { MapDisplay } from '../components/MapDisplay';
import { GlassCard } from '../components/GlassCard';
import { getAllUsersTodayLocations } from '../services/dbService';
import { UserLocationData } from '../types';
import { Loader2, MapPin } from 'lucide-react';

const Dashboard: React.FC = () => {
    const [usersData, setUsersData] = useState<UserLocationData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAll = async () => {
            const data = await getAllUsersTodayLocations();
            setUsersData(data);
            setLoading(false);
        };
        fetchAll();
    }, []);

    const markers = usersData.filter(u => u.lastCheckIn).map(u => ({
        lat: u.lastCheckIn!.latitude,
        lng: u.lastCheckIn!.longitude,
        text: `${u.name || u.email.split('@')[0]} @ ${u.lastCheckIn!.location}`,
        photo: u.photoBase64
    }));

    const thailandCenter = { lat: 13.0000, lng: 101.0000 };

    if (loading) return <div className="flex justify-center pt-20"><Loader2 className="animate-spin text-cyan-500" size={40} /></div>

    return (
        <div className="h-full flex flex-col space-y-4 animate-enter pb-6">
             {/* Header with Stats */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Live Operations</h2>
                    <p className="text-slate-500 text-sm">Real-time field activity</p>
                </div>
                <div className="flex gap-2">
                    <div className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-xl flex flex-col items-center shadow-sm">
                        <span className="text-xs text-slate-400 font-bold uppercase">Active</span>
                        <span className="text-xl font-bold text-emerald-500">{usersData.length}</span>
                    </div>
                </div>
            </div>

            {/* Immersive Map Card */}
            <div className="w-full h-[500px] rounded-[32px] overflow-hidden border border-slate-200 dark:border-white/10 shadow-2xl relative group bg-white dark:bg-slate-900">
                 <MapDisplay 
                    lat={thailandCenter.lat} 
                    lng={thailandCenter.lng} 
                    markers={markers}
                    zoom={6}
                    className="h-full w-full opacity-90 group-hover:opacity-100 transition-all duration-700" 
                 />
                 
                 {/* Floating Overlay inside Map */}
                 <div className="absolute top-4 right-4 bg-white/90 dark:bg-slate-900/80 backdrop-blur-md p-3 rounded-xl border border-slate-200 dark:border-white/10 text-xs z-[400] shadow-lg">
                    <span className="flex items-center gap-2 text-emerald-500"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Live Updates</span>
                 </div>
            </div>

            {/* Active List */}
            <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider ml-2">Recent Activity</h3>
                {usersData.map((u) => (
                    <div key={u.userId} className="flex items-center gap-4 p-4 bg-white dark:bg-slate-900/30 border border-slate-100 dark:border-white/5 rounded-2xl hover:shadow-md dark:hover:bg-slate-800/50 transition-all shadow-sm">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold text-sm shadow-md overflow-hidden relative border border-white dark:border-white/10 shrink-0">
                            {u.photoBase64 ? (
                                <img src={u.photoBase64} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <span>{u.name ? u.name.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}</span>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white text-sm truncate">{u.name || u.email}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                                <MapPin size={10} className="text-cyan-500 shrink-0"/> {u.lastCheckIn?.location}
                            </div>
                        </div>
                         <div className="text-right text-xs font-mono text-slate-500 bg-slate-50 dark:bg-slate-950/50 px-2 py-1 rounded-lg shrink-0">
                            {u.lastCheckIn?.timestamp.toDate().toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}
                        </div>
                    </div>
                ))}
                {usersData.length === 0 && (
                     <div className="text-center text-slate-400 py-6 italic bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-white/5">
                        No active users on duty yet.
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;