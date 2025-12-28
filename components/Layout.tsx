
import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { User } from 'firebase/auth';
import { Clock, Users, Map as MapIcon, Settings, FileText, ShieldCheck, Bell, MessageSquare } from 'lucide-react';
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

    // Simplified Status Bar Sync - Only ensuring color matches the current HTML class
    useEffect(() => {
        const syncStatusBar = () => {
            const metaThemeColor = document.getElementById('meta-theme-color');
            if (!metaThemeColor) return;

            const isDark = document.documentElement.classList.contains('dark');
            const color = isDark ? '#020617' : '#F5F5F7';
            
            // Only update if current value is different to avoid flickering/bouncing
            if (metaThemeColor.getAttribute('content') !== color) {
                metaThemeColor.setAttribute('content', color);
                document.documentElement.style.backgroundColor = color;
            }
        };

        syncStatusBar();
        
        // Listen for class changes on html tag (triggered by theme toggle)
        const observer = new MutationObserver(syncStatusBar);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        
        return () => observer.disconnect();
    }, []);

    // Update System App Badge
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
                } catch (error) {
                    console.error('Failed to update app badge:', error);
                }
            }
        };
        updateAppBadge();
    }, [pendingRemindersCount, pendingPlansCount]);

    useEffect(() => {
        if (!user) return;

        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

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
                
                if (userProfile.role === 'admin') {
                    setPendingPlansCount(pendingOnly.length);
                } else {
                    const team = await getTeamMembers(user.uid);
                    const teamIds = team.map(m => m.id);
                    setPendingPlansCount(pendingOnly.filter(p => teamIds.includes(p.userId)).length);
                }
            } else {
                const myPlans = await getWorkPlans(user.uid);
                setPendingPlansCount(myPlans.filter(p => p.status === 'rejected').length);
            }

            const day = now.getDay();
            const hour = now.getHours();
            const minute = now.getMinutes();
            const totalMinutes = hour * 60 + minute;
            const checkInTargetMinutes = 8 * 60 + 50; 
            const lastCheckInReminderKey = `attendance_reminder_sent_${user.uid}`;
            const lastCheckInSentDate = localStorage.getItem(lastCheckInReminderKey);

            if (day >= 1 && day <= 5 && totalMinutes >= checkInTargetMinutes && totalMinutes < 10 * 60 && lastCheckInSentDate !== todayStr) {
                const todayAtt = await getTodayAttendance(user.uid);
                if (!todayAtt || todayAtt.checkIns.length === 0) {
                    if ("Notification" in window && Notification.permission === "granted") {
                        new Notification("🚨 อย่าลืมเช็คอิน!", {
                            body: "ขณะนี้เวลา 08:50 น. แล้ว อีก 10 นาทีจะถึงเวลาเข้างาน กรุณาลงเวลาเช็คอินด้วยครับ",
                            icon: "https://img2.pic.in.th/pic/Orendtech-1.png",
                            badge: "https://img2.pic.in.th/pic/Orendtech-1.png",
                            vibrate: [200, 100, 200]
                        } as any);
                        localStorage.setItem(lastCheckInReminderKey, todayStr);
                    }
                }
            }
        };

        const interval = setInterval(checkData, 60000);
        checkData(); 

        let unsubscribe: (() => void) | undefined;
        if (userProfile?.role === 'admin' || userProfile?.role === 'manager') {
            const logsCol = collection(db, `artifacts/${APP_ARTIFACT_ID}/activity_logs`);
            const startTime = Timestamp.now();
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
                        if (log.userId !== user.uid) {
                            if ("Notification" in window && Notification.permission === "granted") {
                                let title = "";
                                let message = "";

                                switch(log.type) {
                                    case 'check-in':
                                        title = "📍 พนักงานเช็คอินแล้ว";
                                        message = `${log.userName} เช็คอินที่ ${log.location}`;
                                        break;
                                    case 'check-out':
                                        title = "🏁 พนักงานเช็คเอาท์แล้ว";
                                        message = `${log.userName} ส่งรายงานและเช็คเอาท์เรียบร้อย`;
                                        break;
                                    case 'work-plan-submitted':
                                        title = "📋 มีคำขออนุมัติแผนงานใหม่";
                                        message = `${log.userName} ได้ส่งแผนงานเพื่อขอการอนุมัติ: ${log.location}`;
                                        break;
                                }

                                if (title) {
                                    new Notification(title, {
                                        body: message,
                                        icon: "https://img2.pic.in.th/pic/Orendtech-1.png",
                                        badge: "https://img2.pic.in.th/pic/Orendtech-1.png",
                                        vibrate: [100, 50, 100]
                                    } as any);
                                    checkData();
                                }
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
        { path: '/reminders', icon: <Bell size={24} />, label: 'แจ้งเตือน', badge: pendingRemindersCount },
        { path: '/planner', icon: <MessageSquare size={24} />, label: 'แผนงาน', badge: pendingPlansCount },
        { path: '/reports', icon: <FileText size={24} />, label: 'รายงาน' },
        { path: '/management', icon: <Users size={24} />, label: 'รายชื่อ' },
    ];

    if (['admin', 'manager'].includes(userProfile?.role || '')) {
        navItems.push({ path: '/admin', icon: <ShieldCheck size={24} />, label: 'Admin' });
    }

    const badge = (() => {
        if (userProfile?.role === 'admin') return { label: 'ADMIN', bg: 'bg-indigo-100 dark:bg-indigo-500/30 border-indigo-200 dark:border-indigo-500/50 text-indigo-600 dark:text-indigo-300' };
        if (userProfile?.role === 'manager') return { label: 'MANAGER', bg: 'bg-emerald-100 dark:bg-emerald-500/30 border-emerald-200 dark:border-emerald-500/50 text-emerald-600 dark:text-emerald-300' };
        return { label: 'USER', bg: 'bg-slate-100 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400' };
    })();

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
