
import React, { useEffect, useState, useRef } from 'react';
import { User, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { getUserProfile, updateUserProfile } from '../services/dbService';
import { UserProfile } from '../types';
import { GlassCard } from '../components/GlassCard';
import { 
    User as UserIcon, MapPin, Calendar, Mail, Lock, Save, 
    LogOut, Settings as SettingsIcon, Camera, Upload, 
    Sun, Moon, BellRing, ShieldCheck, RotateCcw, Sparkles, RefreshCcw, Info, Key, Eye, EyeOff, Bot, Loader2, Sparkle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
    user: User;
}

const Settings: React.FC<Props> = ({ user }) => {
    const navigate = useNavigate();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [name, setName] = useState('');
    const [area, setArea] = useState('');
    const [startDate, setStartDate] = useState('');
    const [photoBase64, setPhotoBase64] = useState('');
    const [aiApiKey, setAiApiKey] = useState('');
    const [isAiEnabled, setIsAiEnabled] = useState(false); // Default to false (closed)
    const [showApiKey, setShowApiKey] = useState(false);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');
    const [msgType, setMsgType] = useState<'success' | 'error'>('success');
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
    const [updateLoading, setUpdateLoading] = useState(false);
    const [appVersion] = useState("1.2.6");
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const load = async () => {
            const p = await getUserProfile(user.uid);
            if (p) {
                setProfile(p);
                setName(p.name || '');
                setArea(p.area || '');
                setStartDate(p.startDate || '');
                setPhotoBase64(p.photoBase64 || '');
                setAiApiKey(p.aiApiKey || '');
                setIsAiEnabled(p.isAiEnabled === true); // Only enable if explicitly true
            }
        };
        load();
        if (document.documentElement.classList.contains('dark')) {
            setIsDarkMode(true);
        } else {
            setIsDarkMode(false);
        }
        if ("Notification" in window) {
            setNotifPermission(Notification.permission);
        }
    }, [user]);

    const toggleTheme = () => {
        const metaThemeColor = document.getElementById('meta-theme-color');
        if (isDarkMode) {
            document.documentElement.classList.remove('dark');
            localStorage.theme = 'light';
            const color = '#F5F5F7';
            if (metaThemeColor) metaThemeColor.setAttribute('content', color);
            document.documentElement.style.backgroundColor = color;
            setIsDarkMode(false);
        } else {
            document.documentElement.classList.add('dark');
            localStorage.theme = 'dark';
            const color = '#020617';
            if (metaThemeColor) metaThemeColor.setAttribute('content', color);
            document.documentElement.style.backgroundColor = color;
            setIsDarkMode(true);
        }
    };

    const handleUpdateApp = () => {
        setUpdateLoading(true);
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    };

    const handleEnableNotifications = async () => {
        if (!("Notification" in window)) {
            alert("เบราว์เซอร์ของคุณไม่รองรับการแจ้งเตือน");
            return;
        }
        const permission = await Notification.requestPermission();
        setNotifPermission(permission);
        if (permission === 'granted') {
            new Notification("🚨 อย่าลืมเช็คอิน!", {
                body: "ขณะนี้เวลา 08:50 น. แล้ว อีก 10 นาทีจะถึงเวลาเข้างาน กรุณาเช็คอินด้วยครับ",
                icon: "https://img2.pic.in.th/pic/Orendtech-1.png",
                badge: "https://img2.pic.in.th/pic/Orendtech-1.png",
                vibrate: [200, 100, 200]
            } as any);
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { 
             setMsg('ไฟล์มีขนาดใหญ่เกินไป (ต้องไม่เกิน 5MB)'); setMsgType('error'); return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 400; const MAX_HEIGHT = 400;
                let width = img.width; let height = img.height;
                if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d'); ctx?.drawImage(img, 0, 0, width, height);
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
                setPhotoBase64(compressedBase64);
            };
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const updateData: Partial<UserProfile> = { name, area, startDate, photoBase64, isAiEnabled };
            if (profile?.role === 'admin') {
                updateData.aiApiKey = aiApiKey;
            }
            await updateUserProfile(user.uid, updateData);
            setMsg('บันทึกข้อมูลเรียบร้อย'); setMsgType('success');
            setTimeout(() => { setMsg(''); window.location.reload(); }, 1500);
        } catch (e) { setMsg('เกิดข้อผิดพลาดในการบันทึก'); setMsgType('error'); }
        setLoading(false);
    };

    const handlePasswordReset = async () => {
        if (!user.email) return;
        try { await sendPasswordResetEmail(auth, user.email); setMsg('ส่งอีเมลเปลี่ยนรหัสผ่านเรียบร้อยแล้ว'); setMsgType('success'); } catch (e) { setMsg('ไม่สามารถส่งอีเมลได้'); setMsgType('error'); }
    };

    const handleLogout = () => { auth.signOut(); navigate('/login'); };

    const isAdmin = profile?.role === 'admin';

    return (
        <div className="max-w-lg mx-auto space-y-6 pb-20">
             <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-white dark:bg-slate-800 rounded-full text-slate-500 dark:text-slate-300 shadow-sm border border-slate-100 dark:border-white/5">
                    <SettingsIcon size={24} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">ตั้งค่า</h2>
                    <p className="text-sm text-slate-500 dark:text-gray-400">จัดการข้อมูลส่วนตัวและบัญชี</p>
                </div>
            </div>

            <GlassCard className="space-y-6 relative overflow-visible">
                 <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-white/5">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-orange-100 text-orange-500'}`}>
                            {isDarkMode ? <Moon size={20} /> : <Sun size={20} />}
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">โหมดแสดงผล</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{isDarkMode ? 'กลางคืน (Dark Mode)' : 'กลางวัน (Light Mode)'}</p>
                        </div>
                    </div>
                    <button onClick={toggleTheme} className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${isDarkMode ? 'bg-cyan-600' : 'bg-slate-300'}`}>
                        <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${isDarkMode ? 'translate-x-6' : 'translate-x-0'}`}></div>
                    </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-500/20">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full bg-indigo-500/10 text-indigo-500`}>
                            <Bot size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">ผู้ช่วย HMD AI <Sparkle size={10} className="fill-indigo-500 text-indigo-500 animate-pulse"/></h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">แสดงเมนู AI ลอยบนหน้าจอ</p>
                        </div>
                    </div>
                    <button onClick={() => setIsAiEnabled(!isAiEnabled)} className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${isAiEnabled ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                        <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${isAiEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                    </button>
                </div>

                <div className="p-5 bg-cyan-50 dark:bg-cyan-900/10 rounded-[28px] border border-cyan-100 dark:border-cyan-500/20 space-y-4">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl text-cyan-600 dark:text-cyan-400 shadow-sm shrink-0">
                            <BellRing size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">ระบบแจ้งเตือนเข้างาน</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                แจ้งเตือนเมื่อลืมเช็คอิน (จ-ศ 08:50 น.) 
                                {notifPermission === 'granted' ? 
                                    <span className="text-emerald-500 font-bold ml-1 flex items-center gap-1 mt-1"><ShieldCheck size={12}/> เปิดใช้งานแล้ว</span> : 
                                    <span className="text-slate-400 ml-1 italic font-medium"> (ยังไม่ได้เปิดใช้งาน)</span>
                                }
                            </p>
                        </div>
                    </div>
                    {notifPermission !== 'granted' && (
                        <button 
                            onClick={handleEnableNotifications}
                            className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-600/20 transition-all active:scale-95 text-sm"
                        >
                            เปิดการแจ้งเตือนบนมือถือ
                        </button>
                    )}
                </div>

                <div className="flex flex-col items-center justify-center -mt-2 mb-2">
                    <div className="relative group mt-4">
                        <div className="w-28 h-28 rounded-full border-4 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 shadow-xl overflow-hidden relative">
                            {photoBase64 ? (
                                <img src={photoBase64} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-400 to-blue-500">
                                    <span className="text-4xl font-bold text-white/80">
                                        {name ? name.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            )}
                            <div onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                <Camera className="text-white" size={28} />
                            </div>
                        </div>
                        <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-1 right-1 bg-cyan-500 p-2 rounded-full border-2 border-white dark:border-slate-900 text-white shadow-lg hover:bg-cyan-400 transition-colors">
                            <Upload size={14} />
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm text-slate-500 dark:text-gray-400 flex items-center gap-2 font-medium">
                            <UserIcon size={14}/> ชื่อ-นามสกุล
                        </label>
                        <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 transition-all" placeholder="ระบุชื่อ-นามสกุลของคุณ" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm text-slate-500 dark:text-gray-400 flex items-center gap-2 font-medium">
                            <MapPin size={14}/> เขตพื้นที่รับผิดชอบ
                        </label>
                        <input value={area} onChange={e => setArea(e.target.value)} className="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 transition-all" placeholder="เช่น กทม., ภาคเหนือ" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm text-slate-500 dark:text-gray-400 flex items-center gap-2 font-medium">
                            <Calendar size={14}/> วันที่เริ่มงาน
                        </label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 transition-all" />
                    </div>
                </div>

                <div className="pt-2">
                    <button onClick={handleSave} disabled={loading} className="w-full bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">
                        {loading ? 'กำลังบันทึก...' : <><Save size={18} /> บันทึกการเปลี่ยนแปลง</>}
                    </button>
                </div>

                {msg && <div className={`text-center text-sm p-3 rounded-xl font-medium ${msgType === 'success' ? 'text-emerald-600 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/20' : 'text-rose-600 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/20'} animate-pulse`}>{msg}</div>}
            </GlassCard>

            {/* Admin Exclusive AI Key Settings */}
            {isAdmin && (
                <GlassCard className="border-indigo-500/30 bg-indigo-50/10 dark:bg-indigo-900/10 shadow-indigo-500/10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg relative">
                            <Bot size={24} />
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse"></div>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Advanced AI Settings</h3>
                                <span className="text-[8px] font-black bg-indigo-500 text-white px-2 py-0.5 rounded-full uppercase tracking-widest">Admin Only</span>
                            </div>
                            <p className="text-[10px] text-indigo-500 dark:text-indigo-400 font-bold uppercase tracking-widest mt-0.5">Gemini AI Engine Configuration</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <Key size={12} className="text-indigo-500" /> Google Gemini API Key
                            </label>
                            <div className="relative group">
                                <input 
                                    type={showApiKey ? "text" : "password"} 
                                    value={aiApiKey} 
                                    onChange={e => setAiApiKey(e.target.value)} 
                                    className="w-full bg-white/70 dark:bg-black/30 border-2 border-indigo-100 dark:border-indigo-500/20 rounded-2xl p-4 text-sm font-mono text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-all shadow-inner" 
                                    placeholder="AIzaSy..." 
                                />
                                <button
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 transition-colors"
                                >
                                    {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            <div className="flex items-start gap-2 mt-2 px-1">
                                <Info size={12} className="text-indigo-400 shrink-0 mt-0.5" />
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed italic">
                                    คีย์นี้จะถูกใช้เป็นลำดับแรกสำหรับการทำงานของ AI Coach หากไม่ได้ระบุไว้ ระบบจะใช้คีย์มาตรฐานจาก Environment Variable
                                </p>
                            </div>
                        </div>
                        
                        <button 
                            onClick={handleSave} 
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-indigo-600 to-indigo-800 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20 active:scale-95 transition-all uppercase tracking-widest text-xs"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <><Save size={18} /> อัปเดตการกำหนดค่าระบบ</>}
                        </button>
                    </div>
                </GlassCard>
            )}

            <GlassCard className="border-indigo-100 dark:border-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-900/5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl text-indigo-500 shadow-sm">
                            <RotateCcw size={22} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">เวอร์ชันของแอป</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Version {appVersion}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-200 dark:border-emerald-500/20">
                        <Sparkles size={10} /> ล่าสุด
                    </div>
                </div>
                
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-5">
                    แอปจะอัปเดตอัตโนมัติเมื่อมีการเปิดใหม่ หากคุณพบปัญหาหรือไม่เห็นฟีเจอร์ใหม่ สามารถกดปุ่มด้านล่างเพื่อตรวจสอบเวอร์ชันล่าสุดและโหลดหน้าใหม่ได้ทันที
                </p>

                <button 
                    onClick={handleUpdateApp} 
                    disabled={updateLoading}
                    className="w-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-black py-3 rounded-xl flex items-center justify-center gap-2 transition-all border border-indigo-100 dark:border-indigo-500/30 shadow-sm active:scale-95 disabled:opacity-50"
                >
                    {updateLoading ? (
                        <RefreshCcw size={18} className="animate-spin" />
                    ) : (
                        <><RefreshCcw size={18} /> ตรวจสอบการอัปเดต</>
                    )}
                </button>
            </GlassCard>

             <GlassCard className="space-y-4 border-rose-100 dark:border-rose-500/20 bg-rose-50/50 dark:bg-rose-900/5">
                <h3 className="text-lg font-bold text-rose-600 dark:text-rose-300 mb-4">ความปลอดภัย & บัญชี</h3>
                <button onClick={handlePasswordReset} className="w-full bg-white dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-slate-700 dark:text-gray-300 py-3 rounded-xl flex items-center justify-between px-4 transition-colors group border border-rose-100 dark:border-transparent">
                    <div className="flex items-center gap-3"><Lock size={18} className="text-slate-400 dark:text-gray-400 group-hover:text-rose-500"/><span>เปลี่ยนรหัสผ่าน</span></div>
                    <span className="text-xs text-slate-500 dark:text-gray-500">ส่งอีเมลรีเซ็ต</span>
                </button>
                 <button onClick={handleLogout} className="w-full bg-rose-100 dark:bg-rose-500/10 hover:bg-rose-200 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 py-3 rounded-xl flex items-center justify-center gap-2 mt-2 transition-colors border border-rose-200 dark:border-rose-500/20">
                    <LogOut size={18} /> ออกจากระบบ
                </button>
             </GlassCard>
        </div>
    );
};
export default Settings;
