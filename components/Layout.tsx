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
        { path: '/', icon: <Clock size={22} />, label: 'ลงเวลา' },
        { path: '/reports', icon: <FileText size={22} />, label: 'รายงาน' },
        { path: '/management', icon: <Users size={22} />, label: 'รายชื่อ' },
        { path: '/dashboard', icon: <MapIcon size={22} />, label: 'แผนที่' },
    ];

    // Add Admin Tab if user is admin or manager
    if (['admin', 'manager'].includes(userProfile?.role || '')) {
        navItems.push({ path: '/admin', icon: <ShieldCheck size={22} />, label: 'Admin' });
    }

    return (
        <div className="min-h-screen flex flex-col bg-slate-950 text-white font-sans relative overflow-hidden selection:bg-cyan-500/30">
             {/* Dynamic Background Aura */}
             <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen animate-pulse duration-[10000ms]"></div>
             <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none mix-blend-screen"></div>

             {/* Minimal Header with Safe Area Padding */}
            <header className="px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-2 flex justify-between items-center z-20">
                <div className="flex items-center gap-4">
                   <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                        <img src="https://img2.pic.in.th/pic/Happy-joby.png" alt="Logo" className="relative h-12 w-auto object-contain drop-shadow-lg" />
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
                    className="p-3 bg-slate-900/50 border border-white/5 rounded-full hover:bg-slate-800 transition-all hover:scale-110 active:scale-95 group"
                >
                    <Settings size={20} className="text-slate-400 group-hover:text-white transition-colors" />
                </button>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto pb-32 px-4 z-10 pt-2 scroll-smooth">
                <Outlet />
            </main>

            {/* Floating Dock Navigation */}
            <nav className="fixed bottom-6 left-4 right-4 z-50 pb-[env(safe-area-inset-bottom)]">
                <div className="bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 p-2 max-w-md mx-auto flex justify-between items-center relative overflow-hidden">
                    {/* Shine effect on dock */}
                    <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                    
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={`relative flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all duration-500 group ${
                                    isActive ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                {isActive && (
                                    <div className="absolute inset-0 bg-white/10 rounded-xl blur-md scale-75 animate-pulse"></div>
                                )}
                                <div className={`relative z-10 transform transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                                    {item.icon}
                                </div>
                                {isActive && (
                                    <div className="absolute -bottom-1 w-1 h-1 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,1)]"></div>
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