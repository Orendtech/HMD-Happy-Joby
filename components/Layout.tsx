
import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { User } from 'firebase/auth';
import { Clock, Users, Map as MapIcon, Settings, FileText, ShieldCheck, Bell, MessageSquare, Sparkles } from 'lucide-react';
import { UserProfile, AttendanceDay, ActivityLog, WorkPlan } from '../types';
import { getReminders, markReminderAsNotified, getTodayAttendance, getTodayDateId, getWorkPlans, getTeamMembers } from '../services/dbService';
import { db, APP_ARTIFACT_ID } from '../firebaseConfig';
import { collection, query, orderBy, limit, onSnapshot, where, Timestamp } from 'firebase/firestore';

interface LayoutProps {
    user: User;
    userProfile: UserProfile | null;
}

const Layout: React.FC<LayoutProps> = ({ user, userProfile }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const isHomePage = location.pathname === '/';
    const [pendingRemindersCount, setPendingRemindersCount] = useState(0);
    const [pendingPlansCount, setPendingPlansCount] = useState(0);

    useEffect(() => {
        const syncTheme = () => {
            const isDark = document.documentElement.classList.contains('dark');
            const color = isDark ? '#020617' : '#F5F5F7';
            document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
            document.documentElement.style.backgroundColor = color;
            document.body.style.backgroundColor = color;
            const existingMeta = document.getElementById('meta-theme-color');
            if (existingMeta) existingMeta.remove();
            const newMeta = document.createElement('meta');
            newMeta.id = 'meta-theme-color';
            newMeta.name = 'theme-color';
            newMeta.content = color;
            document.getElementsByTagName('head')[0].appendChild(newMeta);
        };
        syncTheme();
        const timer = setTimeout(syncTheme, 100);
        window.addEventListener('storage', (e) => { if (e.key === 'theme') syncTheme(); });
        return () => { clearTimeout(timer); window.removeEventListener('storage', syncTheme); };
    }, [location.pathname]);

    useEffect(() => {
        if (!user) return;
        const checkData = async () => {
            const list = await getReminders(user.uid);
            setPendingRemindersCount(list.filter(r => !r.isCompleted).length);
            const allPlans = await getWorkPlans(user.uid);
            setPendingPlansCount(allPlans.filter(p => p.status === 'rejected' || p.status === 'pending').length);
        };
        const interval = setInterval(checkData, 60000);
        checkData();
        return () => clearInterval(interval);
    }, [user]);

    const navItems = [
        { path: '/', icon: <Clock size={24} />, label: 'ลงเวลา' },
        { path: '/ai', icon: <Sparkles size={24} />, label: 'AI' },
        { path: '/reminders', icon: <Bell size={24} />, label: 'แจ้งเตือน', badge: pendingRemindersCount },
        { path: '/planner', icon: <MessageSquare size={24} />, label: 'แผนงาน', badge: pendingPlansCount },
        { path: '/reports', icon: <FileText size={24} />, label: 'รายงาน' },
    ];

    return (
        <div className="h-[100dvh] flex flex-col bg-[#F5F5F7] dark:bg-[#020617] text-slate-900 dark:text-white font-sans relative overflow-hidden transition-colors duration-500">
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-cyan-400/10 dark:bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none z-0"></div>
            
            {!isHomePage && (
                <header className="px-5 pt-[max(1.2rem,env(safe-area-inset-top))] pb-2 flex justify-between items-center z-20 sticky top-0 bg-[#F5F5F7]/80 dark:bg-[#020617]/80 backdrop-blur-xl transition-all">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                            {userProfile?.photoBase64 ? <img src={userProfile.photoBase64} className="w-full h-full object-cover" /> : <div className="text-sm font-bold">{userProfile?.name?.[0]}</div>}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold line-clamp-1">{userProfile?.name || 'Happy User'}</span>
                            <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{userProfile?.role}</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => navigate('/settings')} className="p-2.5 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-100 dark:border-slate-700"><Settings size={20} className="text-slate-400" /></button>
                    </div>
                </header>
            )}

            <main className={`flex-1 overflow-y-auto pb-28 z-0 ${isHomePage ? 'pt-0' : 'pt-4'}`}>
                <Outlet />
            </main>

            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/50 pb-[env(safe-area-inset-bottom)] pt-2">
                <div className="flex justify-around items-center h-16 max-w-lg mx-auto w-full px-2">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <button key={item.path} onClick={() => navigate(item.path)} className={`relative flex flex-col items-center justify-center w-full h-full group ${isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`}>
                                <div className={`transform transition-all duration-300 ${isActive ? '-translate-y-1 scale-110' : ''}`}>
                                    {item.icon}
                                    {item.badge !== undefined && item.badge > 0 && (
                                        <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[9px] font-black min-w-[16px] h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 px-1">{item.badge}</span>
                                    )}
                                </div>
                                <span className={`text-[10px] font-bold mt-1 ${isActive ? 'opacity-100' : 'opacity-0 hidden'}`}>{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
};

export default Layout;
