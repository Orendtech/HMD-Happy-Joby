import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { User } from 'firebase/auth';
import { Clock, Users, Map as MapIcon, Settings, FileText, ShieldCheck, Sparkles } from 'lucide-react';
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

    return (
        <div className="min-h-screen flex flex-col bg-slate-950 text-white font-sans relative overflow-hidden selection:bg-cyan-500/30">
             {/* Dynamic Background Aura */}
             <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen animate-pulse duration-[10000ms]"></div>
             <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none mix-blend-screen"></div>

             {/* Minimal Header with Safe Area Padding */}
            <header className="px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-2 flex justify-between items-center z-20 bg-gradient-to-b from-slate-950 to-transparent">
                <div className="flex items-center gap-4">
                   <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                        <img src="https://img2.pic.in.th/pic/Happy-joby.png" alt="Logo" className="relative h-10 w-auto object-contain drop-shadow-lg" />
                   </div>
                   <div className="flex flex-col">
                       <div className="flex items-center gap-2">
                            <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">Happy Joby</span>
                            {userProfile?.role === 'admin' && <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-[10px] text-indigo-300 font-medium">ADMIN</span>}
                            {userProfile?.role === 'manager' && <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[10px] text-emerald-300 font-medium">MANAGER</span>}
                       </div>
                       <p className="text-xs text-slate-500">
                           {userProfile?.name || user.email?.split('@')[0]}
                       </p>
                   </div>
                </div>
                <button 
                    onClick={() => navigate('/settings')} 
                    className="p-2 bg-slate-900/50 border border-white/5 rounded-full hover:bg-slate-800 transition-all active:scale-95 group"
                >
                    <Settings size={20} className="text-slate-400 group-hover:text-white transition-colors" />
                </button>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto pb-28 px-4 z-10 pt-2 scroll-smooth">
                <Outlet />
            </main>

            {/* Native Bottom Tab Bar */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur-xl border-t border-white/10 pb-[env(safe-area-inset-bottom)] pt-2 transition-all duration-300">
                <div className="flex justify-around items-center h-16 max-w-md mx-auto w-full px-2">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={`relative flex flex-col items-center justify-center w-full h-full transition-all duration-300 group ${
                                    isActive ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                {/* Active Background Glow */}
                                {isActive && (
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-cyan-500/10 rounded-full blur-md -z-10"></div>
                                )}

                                <div className={`transform transition-all duration-300 ${isActive ? '-translate-y-1 scale-110' : ''}`}>
                                    {item.icon}
                                </div>
                                
                                <span className={`text-[10px] font-medium mt-1 transition-all duration-300 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 hidden'}`}>
                                    {item.label}
                                </span>

                                {/* Active Dot Indicator */}
                                {isActive && (
                                    <div className="absolute top-1 w-1 h-1 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.8)]"></div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
};

export default Layout;