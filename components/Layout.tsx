
import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { User } from 'firebase/auth';
import { Clock, Users, Map as MapIcon, Settings, FileText, ShieldCheck, Bell, MessageSquare } from 'lucide-react';
import { UserProfile, AttendanceDay, ActivityLog } from '../types';
// Fix: Import db and APP_ARTIFACT_ID from firebaseConfig instead of dbService
import { getReminders, markReminderAsNotified, getTodayAttendance, getTodayDateId } from '../services/dbService';
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
    const [pendingCount, setPendingCount] = useState(0);

    // Update System App Badge (Home Screen Icon)
    useEffect(() => {
        const updateAppBadge = async () => {
            if ('setAppBadge' in navigator) {
                try {
                    if (pendingCount > 0) {
                        await (navigator as any).setAppBadge(pendingCount);
                    } else {
                        await (navigator as any).clearAppBadge();
                    }
                } catch (error) {
                    console.error('Failed to update app badge:', error);
                }
            }
        };
        updateAppBadge();
    }, [pendingCount]);

    // Reset theme color when not on homepage
    useEffect(() => {
        if (!isHomePage) {
            const metaThemeColor = document.querySelector('meta[name="theme-color"]');
            if (metaThemeColor) {
                const isDark = document.documentElement.classList.contains('dark');
                metaThemeColor.setAttribute('content', isDark ? '#020617' : '#f8fafc');
            }
        }
    }, [location.pathname]);

    useEffect(() => {
        if (!user) return;

        // 1. Request Notification Permission on Mount
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

        // 2. Attendance Watchdog and Reminders
        const checkReminders = async () => {
            const list = await getReminders(user.uid);
            const now = new Date();
            const todayStr = getTodayDateId();
            
            const uncompletedList = list.filter(r => !r.isCompleted);
            setPendingCount(uncompletedList.length);
            
            // Custom User Reminders
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

            // Attendance Watchdog Trigger at 08:50 AM
            const day = now.getDay(); // 1-5 (Mon-Fri)
            const hour = now.getHours();
            const minute = now.getMinutes();
            const totalMinutes = hour * 60 + minute;
            const targetMinutes = 8 * 60 + 50; // 08:50 AM

            const lastReminderKey = `attendance_reminder_sent_${user.uid}`;
            const lastSentDate = localStorage.getItem(lastReminderKey);

            if (day >= 1 && day <= 5 && totalMinutes >= targetMinutes && lastSentDate !== todayStr) {
                const todayAtt = await getTodayAttendance(user.uid);
                if (!todayAtt || todayAtt.checkIns.length === 0) {
                    if ("Notification" in window && Notification.permission === "granted") {
                        new Notification("🚨 อย่าลืมเช็คอิน!", {
                            body: "ขณะนี้เวลา 08:50 น. แล้ว อีก 10 นาทีจะถึงเวลาเข้างาน กรุณาลงเวลาเช็คอินด้วยครับ",
                            icon: "https://img2.pic.in.th/pic/Orendtech-1.png",
                            badge: "https://img2.pic.in.th/pic/Orendtech-1.png",
                            vibrate: [200, 100, 200]
                        } as any);
                        localStorage.setItem(lastReminderKey, todayStr);
                    }
                }
            }
        };

        const interval = setInterval(checkReminders, 60000); // Check every minute
        checkReminders(); 

        // 3. Admin/Manager Activity Notification (Real-time)
        let unsubscribe: (() => void) | undefined;
        if (userProfile?.role === 'admin' || userProfile?.role === 'manager') {
            const logsCol = collection(db, `artifacts/${APP_ARTIFACT_ID}/activity_logs`);
            const startTime = Timestamp.now(); // Start listening from now
            const q = query(
                logsCol,
                where('timestamp', '>', startTime),
                orderBy('timestamp', 'desc'),
                limit(1)
            );

            unsubscribe = onSnapshot(q, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added") {
                        const log = change.doc.data() as ActivityLog;
                        // Avoid notifying self
                        if (log.userId !== user.uid) {
                            if ("Notification" in window && Notification.permission === "granted") {
                                const title = log.type === 'check-in' ? "📍 พนักงานเช็คอินแล้ว" : "🏁 พนักงานเช็คเอาท์แล้ว";
                                const message = log.type === 'check-in' 
                                    ? `${log.userName} เช็คอินที่ ${log.location}`
                                    : `${log.userName} ส่งรายงานและเช็คเอาท์เรียบร้อย`;

                                new Notification(title, {
                                    body: message,
                                    icon: "https://img2.pic.in.th/pic/Orendtech-1.png",
                                    badge: "https://img2.pic.in.th/pic/Orendtech-1.png",
                                    vibrate: [100, 50, 100]
                                } as any);
                            }
                        }
                    }
                });
            });
        }

        return () => {
            clearInterval(interval);
            if (unsubscribe) unsubscribe();
        };
    }, [user, userProfile]);

    const navItems = [
        { path: '/', icon: <Clock size={24} />, label: 'ลงเวลา' },
        { path: '/reminders', icon: <Bell size={24} />, label: 'แจ้งเตือน', badge: pendingCount },
        { path: '/planner', icon: <MessageSquare size={24} />, label: 'แผนงาน' },
        { path: '/reports', icon: <FileText size={24} />, label: 'รายงาน' },
        { path: '/management', icon: <Users size={24} />, label: 'รายชื่อ' },
    ];

    if (['admin', 'manager'].includes(userProfile?.role || '')) {
        navItems.push({ path: '/admin', icon: <ShieldCheck size={24} />, label: 'Admin' });
    }

    const roleBadge = () => {
        if (userProfile?.role === 'admin') return { label: 'ADMIN', bg: 'bg-indigo-100 dark:bg-indigo-500/30 border-indigo-200 dark:border-indigo-500/50 text-indigo-600 dark:text-indigo-300' };
        if (userProfile?.role === 'manager') return { label: 'MANAGER', bg: 'bg-emerald-100 dark:bg-emerald-500/30 border-emerald-200 dark:border-emerald-500/50 text-emerald-600 dark:text-emerald-300' };
        return { label: 'USER', bg: 'bg-slate-100 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400' };
    };

    const badge = roleBadge();

    return (
        <div className="h-[100dvh] flex flex-col bg-[#F5F5F7] dark:bg-[#020617] text-slate-900 dark:text-white font-sans relative overflow-hidden transition-colors duration-500">
             <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-cyan-400/10 dark:bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen animate-pulse duration-[10000ms]"></div>
             <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-indigo-400/10 dark:bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none mix-blend-screen"></div>

            {!isHomePage && (
                <header className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-2 flex justify-between items-center z-20 sticky top-0 bg-[#F5F5F7]/80 dark:bg-[#020617]/80 backdrop-blur-xl border-b border-transparent transition-all">
                    <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-md dark:shadow-none border border-white dark:border-slate-700 relative overflow-hidden shrink-0">
                            {userProfile?.photoBase64 ? (
                                <img src={userProfile.photoBase64} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                                    <span className="text-lg font-bold text-white tracking-wider">
                                        {userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            )}
                    </div>
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
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => navigate('/dashboard')} 
                            className="p-2.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95 group shadow-sm"
                            title="แผนที่"
                        >
                            <MapIcon size={20} className="text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
                        </button>
                        <button 
                            onClick={() => navigate('/settings')} 
                            className="p-2.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95 group shadow-sm"
                            title="ตั้งค่า"
                        >
                            <Settings size={20} className="text-slate-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors" />
                        </button>
                    </div>
                </header>
            )}

            <main className={`flex-1 overflow-y-auto pb-28 z-0 scroll-smooth ${isHomePage ? 'pt-0 px-0' : 'pt-4 px-4'}`}>
                <Outlet />
            </main>

            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/50 dark:border-white/5 pb-[env(safe-area-inset-bottom)] pt-2">
                <div className="flex justify-around items-center h-16 max-w-lg mx-auto w-full px-2">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={`relative flex flex-col items-center justify-center w-full h-full group ${
                                    isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                                }`}
                            >
                                <div className={`relative transform transition-all duration-300 ${isActive ? '-translate-y-1' : ''}`}>
                                    {item.icon}
                                    {item.badge !== undefined && item.badge > 0 && (
                                        <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[9px] font-black min-w-[16px] h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-md px-1 animate-pulse">
                                            {item.badge}
                                        </span>
                                    )}
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
