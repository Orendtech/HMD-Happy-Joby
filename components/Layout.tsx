
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
        const syncStatusBar = () => {
            const metaThemeColor = document.getElementById('meta-theme-color');
            if (!metaThemeColor) return;
            const isDark = document.documentElement.classList.contains('dark');
            const color = isDark ? '#020617' : '#F5F5F7';
            if (metaThemeColor.getAttribute('content') !== color) {
                metaThemeColor.setAttribute('content', color);
                document.documentElement.style.backgroundColor = color;
            }
        };
        syncStatusBar();
        const observer = new MutationObserver(syncStatusBar);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const totalPending = pendingRemindersCount + pendingPlansCount;
        const updateAppBadge = async () => {
            if ('setAppBadge' in navigator) {
                try {
                    if (totalPending > 0) {
                        await (navigator as any).setAppBadge(totalPending);
                    } else {
                        await (navigator as any).clearAppBadge();
                    }
                } catch (error) { console.error('Failed to update app badge:', error); }
            }
        };
        updateAppBadge();
    }, [pendingRemindersCount, pendingPlansCount]);

    useEffect(() => {
        if (!user) return;
        if ("Notification" in window && Notification.permission === "default") { Notification.requestPermission(); }

        const checkData = async () => {
            const list = await getReminders(user.uid);
            const now = new Date();
            const todayStr = getTodayDateId();
            const uncompletedList = list.filter(r => !r.isCompleted);
            setPendingRemindersCount(uncompletedList.length);
            
            list.forEach(async (r) => {
                const due = new Date(r.dueTime);
                if (!r.isCompleted && !r.notified && due <= now) {
                    if ("Notification" in window && Notification.permission === "granted") {
                        new Notification("การแจ้งเตือนจาก Happy Joby", {
                            body: `${r.title}\n${r.description || ''}`,
                            icon: "https://img2.pic.in.th/pic/Orendtech-1.png"
                        });
                        await markReminderAsNotified(user.uid, r.id);
                    }
                }
            });

            if (userProfile?.role === 'admin' || userProfile?.role === 'manager') {
                const allPlans = await getWorkPlans();
                const pendingOnly = allPlans.filter(p => p.status === 'pending');
                if (userProfile.role === 'admin') { setPendingPlansCount(pendingOnly.length); } 
                else {
                    const team = await getTeamMembers(user.uid);
                    const teamIds = team.map(m => m.id);
                    setPendingPlansCount(pendingOnly.filter(p => teamIds.includes(p.userId)).length);
                }
            } else {
                const myPlans = await getWorkPlans(user.uid);
                setPendingPlansCount(myPlans.filter(p => p.status === 'rejected').length);
            }
        };

        const interval = setInterval(checkData, 60000);
        checkData(); 
        return () => clearInterval(interval);
    }, [user, userProfile]);

    const navItems = [
        { path: '/', icon: <Clock size={24} />, label: 'ลงเวลา' },
        { path: '/activity', icon: <Sparkles size={24} />, label: 'กิจกรรม' },
        { path: '/planner', icon: <MessageSquare size={24} />, label: 'แผนงาน', badge: pendingPlansCount },
        { path: '/reports', icon: <FileText size={24} />, label: 'รายงาน' },
        { path: '/management', icon: <Users size={24} />, label: 'รายชื่อ' },
    ];

    if (['admin', 'manager'].includes(userProfile?.role || '')) {
        navItems.push({ path: '/admin', icon: <ShieldCheck size={24} />, label: 'Admin' });
    }

    const badgeStyle = (() => {
        if (userProfile?.role === 'admin') return { label: 'ADMIN', bg: 'bg-indigo-100 dark:bg-indigo-500/30 border-indigo-200 dark:border-indigo-500/50 text-indigo-600 dark:text-indigo-300' };
        if (userProfile?.role === 'manager') return { label: 'MANAGER', bg: 'bg-emerald-100 dark:bg-emerald-500/30 border-emerald-200 dark:border-emerald-500/50 text-emerald-600 dark:text-emerald-300' };
        return { label: 'USER', bg: 'bg-slate-100 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400' };
    })();

    return (
        <div className="h-[100dvh] flex flex-col bg-[#F5F5F7] dark:bg-[#020617] text-slate-900 dark:text-white font-sans relative overflow-hidden transition-colors duration-500">
             <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-cyan-400/10 dark:bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen animate-pulse duration-[10000ms]"></div>
             <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-indigo-400/10 dark:bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none mix-blend-screen"></div>

            {!isHomePage && (
                <header className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-3 flex justify-between items-center z-20 sticky top-0 bg-[#F5F5F7]/80 dark:bg-[#020617]/80 backdrop-blur-xl border-b border-transparent transition-all">
                    <div className="flex flex-col items-start gap-2">
                        <div className="w-11 h-11 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-md border border-white dark:border-slate-700 relative overflow-hidden shrink-0">
                                {userProfile?.photoBase64 ? (
                                    <img src={userProfile.photoBase64} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                                        <span className="text-lg font-bold text-white uppercase tracking-wider">
                                            {userProfile?.name ? userProfile.name.charAt(0) : user.email?.charAt(0)}
                                        </span>
                                    </div>
                                )}
                        </div>
                        <div className="flex flex-col leading-tight">
                            <div className="flex items-center gap-2">
                                    <span className="text-base font-bold text-slate-900 dark:text-white tracking-tight line-clamp-1">
                                        {userProfile?.name || user.email?.split('@')[0]}
                                    </span>
                                    <span className={`px-2 py-[2px] rounded-full border text-[9px] font-bold tracking-wider ${badgeStyle.bg}`}>
                                        {badgeStyle.label}
                                    </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-tight mt-1">
                                {userProfile?.area || 'Happy Joby Workspace'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 self-start mt-1">
                        <button onClick={() => navigate('/dashboard')} className="p-2.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full shadow-sm"><MapIcon size={20} className="text-slate-400" /></button>
                        <button onClick={() => navigate('/reminders')} className="p-2.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full shadow-sm relative">
                            <Bell size={20} className="text-slate-400" />
                            {pendingRemindersCount > 0 && <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[8px] font-black min-w-[16px] h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-md">{pendingRemindersCount}</span>}
                        </button>
                        <button onClick={() => navigate('/settings')} className="p-2.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full shadow-sm"><Settings size={20} className="text-slate-400" /></button>
                    </div>
                </header>
            )}

            <main className={`flex-1 overflow-y-auto pb-28 z-0 scroll-smooth ${isHomePage ? 'pt-0 px-0' : 'pt-4 px-4'}`}>
                <Outlet />
            </main>

            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/50 dark:border-white/5 pb-[env(safe-area-inset-bottom)] pt-2">
                <div className="flex justify-around items-center h-16 max-w-xl mx-auto w-full px-2">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={`relative flex flex-col items-center justify-center w-full h-full group ${isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-500'}`}
                            >
                                <div className={`relative transform transition-all duration-300 ${isActive ? '-translate-y-1' : ''}`}>
                                    {item.icon}
                                    {item.badge !== undefined && item.badge > 0 && (
                                        <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[9px] font-black min-w-[16px] h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-md px-1 animate-pulse">
                                            {item.badge}
                                        </span>
                                    )}
                                </div>
                                <span className={`text-[10px] font-medium mt-1 transition-all duration-300 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 hidden'}`}>
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
};

export default Layout;
