import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { User } from 'firebase/auth';
import { Clock, Users, Map as MapIcon, Settings, FileText, ShieldCheck } from 'lucide-react';
import { UserProfile } from '../types';

interface LayoutProps {
    user: User;
    userProfile: UserProfile | null;
}

const Layout: React.FC<LayoutProps> = ({ user, userProfile }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const navItems = [
        { path: '/', icon: <Clock size={24} />, label: 'ลงเวลา' },
        { path: '/reports', icon: <FileText size={24} />, label: 'รายงาน' },
        { path: '/management', icon: <Users size={24} />, label: 'รายชื่อ' },
        { path: '/dashboard', icon: <MapIcon size={24} />, label: 'แผนที่' },
    ];

    // Add Admin Tab if user is admin or manager
    if (['admin', 'manager'].includes(userProfile?.role || '')) {
        navItems.push({ path: '/admin', icon: <ShieldCheck size={24} />, label: 'Admin' });
    }

    // Determine Role Badge Color
    const roleBadge = () => {
        if (userProfile?.role === 'admin') return { label: 'ADMIN', bg: 'bg-indigo-100 dark:bg-indigo-500/30 border-indigo-200 dark:border-indigo-500/50 text-indigo-600 dark:text-indigo-300' };
        if (userProfile?.role === 'manager') return { label: 'MANAGER', bg: 'bg-emerald-100 dark:bg-emerald-500/30 border-emerald-200 dark:border-emerald-500/50 text-emerald-600 dark:text-emerald-300' };
        return { label: 'USER', bg: 'bg-slate-100 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400' };
    };

    const badge = roleBadge();

    return (
        <div className="min-h-screen flex flex-col bg-[#F5F5F7] dark:bg-[#020617] text-slate-900 dark:text-white font-sans relative overflow-hidden transition-colors duration-500">
             {/* Dynamic Background Aura (Softer in Light Mode) */}
             <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-cyan-400/10 dark:bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen animate-pulse duration-[10000ms]"></div>
             <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-indigo-400/10 dark:bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none mix-blend-screen"></div>

             {/* Header */}
            <header className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-2 flex justify-between items-center z-20 sticky top-0 bg-[#F5F5F7]/80 dark:bg-[#020617]/80 backdrop-blur-xl border-b border-transparent transition-all">
                <div className="flex items-center gap-4">
                    {/* Avatar Circle */}
                   <div className="w-11 h-11 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-md dark:shadow-none border border-white dark:border-slate-700 relative overflow-hidden shrink-0">
                        {userProfile?.photoBase64 ? (
                            <img 
                                src={userProfile.photoBase64} 
                                alt="Profile" 
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                                <span className="text-lg font-bold text-white tracking-wider">
                                    {userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                                </span>
                            </div>
                        )}
                   </div>

                   {/* Name & Role */}
                   <div className="flex flex-col">
                       <div className="flex items-center gap-2">
                            <span className="text-base font-bold text-slate-900 dark:text-white tracking-tight line-clamp-1">
                                {userProfile?.name || user.email?.split('@')[0]}
                            </span>
                            <span className={`px-2 py-[2px] rounded-full border text-[9px] font-bold tracking-wider ${badge.bg}`}>
                                {badge.label}
                            </span>
                       </div>
                       <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                           {userProfile?.area || 'Happy Joby Workspace'}
                       </p>
                   </div>
                </div>

                {/* Settings Button */}
                <button 
                    onClick={() => navigate('/settings')} 
                    className="p-2.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95 group shadow-sm"
                >
                    <Settings size={20} className="text-slate-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors" />
                </button>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto pb-28 px-4 z-10 pt-4 scroll-smooth">
                <Outlet />
            </main>

            {/* Native Bottom Tab Bar */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/50 dark:border-white/5 pb-[env(safe-area-inset-bottom)] pt-2 transition-all duration-300">
                <div className="flex justify-around items-center h-16 max-w-md mx-auto w-full px-2">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={`relative flex flex-col items-center justify-center w-full h-full transition-all duration-300 group ${
                                    isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                                }`}
                            >
                                <div className={`transform transition-all duration-300 ${isActive ? '-translate-y-1' : ''}`}>
                                    {item.icon}
                                </div>
                                
                                <span className={`text-[10px] font-medium mt-1 transition-all duration-300 ${isActive ? 'opacity-100 translate-y-0 text-cyan-600 dark:text-cyan-400' : 'opacity-0 translate-y-2 hidden'}`}>
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