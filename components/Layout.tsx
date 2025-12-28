
import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { User } from 'firebase/auth';
import { Clock, Users, Settings, FileText, ShieldCheck, Bell, MessageSquare, Sparkles, Radar, MoreHorizontal, X, LayoutGrid, CheckSquare } from 'lucide-react';
import { UserProfile } from '../types';
import { getReminders, getWorkPlans } from '../services/dbService';

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
    const [showMoreMenu, setShowMoreMenu] = useState(false);

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

    // Close More menu on navigation
    useEffect(() => {
        setShowMoreMenu(false);
    }, [location.pathname]);

    // Primary Nav Items (Bottom Bar)
    const primaryNav = [
        { path: '/', icon: <Clock size={22} />, label: 'ลงเวลา' },
        { path: '/ai', icon: <Sparkles size={22} />, label: 'AI' },
        { path: '/dashboard', icon: <Radar size={22} />, label: 'Live' },
        { path: '/planner', icon: <MessageSquare size={22} />, label: 'แผนงาน', badge: pendingPlansCount },
    ];

    // Secondary Menu Items (Inside More)
    const secondaryNav = [
        { path: '/reports', icon: <FileText size={24} />, label: 'รายงาน', color: 'text-indigo-500 bg-indigo-500/10' },
        { path: '/reminders', icon: <Bell size={24} />, label: 'แจ้งเตือน', badge: pendingRemindersCount, color: 'text-rose-500 bg-rose-500/10' },
        { 
            path: userProfile?.role === 'admin' || userProfile?.role === 'manager' ? '/admin' : '/management', 
            icon: userProfile?.role === 'admin' || userProfile?.role === 'manager' ? <ShieldCheck size={24} /> : <Users size={24} />, 
            label: userProfile?.role === 'admin' || userProfile?.role === 'manager' ? 'Admin' : 'รายชื่อ',
            color: 'text-emerald-500 bg-emerald-500/10'
        },
        { path: '/settings', icon: <Settings size={24} />, label: 'ตั้งค่า', color: 'text-slate-500 bg-slate-500/10' },
    ];

    const hasSecondaryBadge = pendingRemindersCount > 0;

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
                </header>
            )}

            <main className={`flex-1 overflow-y-auto pb-28 z-0 ${isHomePage ? 'pt-0' : 'pt-4'}`}>
                <Outlet />
            </main>

            {/* More Menu Overlay */}
            {showMoreMenu && (
                <div className="fixed inset-0 z-[60] flex items-end justify-center px-4 pb-24 sm:pb-32 animate-enter">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowMoreMenu(false)}></div>
                    <div className="w-full max-w-sm bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-[40px] p-8 shadow-2xl border border-white/50 dark:border-white/10 relative z-10">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
                                <LayoutGrid size={20} className="text-cyan-500" />
                                เมนูเพิ่มเติม
                            </h3>
                            <button onClick={() => setShowMoreMenu(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {secondaryNav.map((item) => (
                                <button
                                    key={item.path}
                                    onClick={() => navigate(item.path)}
                                    className="flex flex-col items-center justify-center p-6 rounded-[32px] bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:scale-105 active:scale-95 transition-all relative group"
                                >
                                    <div className={`p-3 rounded-2xl mb-3 transition-colors ${item.color}`}>
                                        {item.icon}
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">{item.label}</span>
                                    {item.badge !== undefined && item.badge > 0 && (
                                        <span className="absolute top-4 right-4 bg-rose-500 text-white text-[10px] font-black min-w-[18px] h-[18px] rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">{item.badge}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Navigation Bar */}
            <nav className="fixed bottom-0 left-0 right-0 z-[70] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/50 pb-[env(safe-area-inset-bottom)] pt-2">
                <div className="flex justify-around items-center h-16 max-w-lg mx-auto w-full px-2">
                    {primaryNav.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <button key={item.path} onClick={() => navigate(item.path)} className={`relative flex flex-col items-center justify-center w-full h-full transition-all ${isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                <div className={`transform transition-all duration-300 ${isActive ? '-translate-y-1 scale-110' : ''}`}>
                                    {item.icon}
                                    {item.badge !== undefined && item.badge > 0 && (
                                        <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[8px] font-black min-w-[14px] h-3.5 rounded-full flex items-center justify-center border border-white dark:border-slate-900 px-0.5">{item.badge}</span>
                                    )}
                                </div>
                                <span className={`text-[9px] font-black mt-1 uppercase tracking-tighter transition-all ${isActive ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>{item.label}</span>
                            </button>
                        );
                    })}
                    
                    {/* More Menu Trigger */}
                    <button 
                        onClick={() => setShowMoreMenu(!showMoreMenu)} 
                        className={`relative flex flex-col items-center justify-center w-full h-full transition-all ${showMoreMenu ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-500'}`}
                    >
                        <div className={`transform transition-all duration-300 ${showMoreMenu ? '-translate-y-1 scale-110' : ''}`}>
                            <MoreHorizontal size={24} />
                            {hasSecondaryBadge && !showMoreMenu && (
                                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 rounded-full border border-white dark:border-slate-900 animate-pulse"></span>
                            )}
                        </div>
                        <span className={`text-[9px] font-black mt-1 uppercase tracking-tighter transition-all ${showMoreMenu ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>เพิ่มเติม</span>
                    </button>
                </div>
            </nav>
        </div>
    );
};

export default Layout;
