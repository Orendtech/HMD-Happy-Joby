import React, { useEffect, useState, useRef } from 'react';
import { User, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { getUserProfile, updateUserProfile } from '../services/dbService';
import { UserProfile } from '../types';
import { GlassCard } from '../components/GlassCard';
import { User as UserIcon, MapPin, Calendar, Mail, Lock, Save, LogOut, Settings as SettingsIcon, Camera, Upload, Sun, Moon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
    user: User;
}

const Settings: React.FC<Props> = ({ user }) => {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [area, setArea] = useState('');
    const [startDate, setStartDate] = useState('');
    const [photoBase64, setPhotoBase64] = useState('');
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');
    const [msgType, setMsgType] = useState<'success' | 'error'>('success');
    const [isDarkMode, setIsDarkMode] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const load = async () => {
            const p = await getUserProfile(user.uid);
            if (p) {
                setName(p.name || '');
                setArea(p.area || '');
                setStartDate(p.startDate || '');
                setPhotoBase64(p.photoBase64 || '');
            }
        };
        load();
        if (document.documentElement.classList.contains('dark')) {
            setIsDarkMode(true);
        } else {
            setIsDarkMode(false);
        }
    }, [user]);

    const toggleTheme = () => {
        if (isDarkMode) {
            document.documentElement.classList.remove('dark');
            localStorage.theme = 'light';
            document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#F5F5F7');
            setIsDarkMode(false);
        } else {
            document.documentElement.classList.add('dark');
            localStorage.theme = 'dark';
            document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#020617');
            setIsDarkMode(true);
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
            await updateUserProfile(user.uid, { name, area, startDate, photoBase64 });
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
                 {/* Theme Toggle */}
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

                {/* Profile Picture */}
                <div className="flex flex-col items-center justify-center -mt-4 mb-2">
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
                    <div className="space-y-2 opacity-60">
                        <label className="text-sm text-slate-500 dark:text-gray-400 flex items-center gap-2 font-medium">
                            <Mail size={14}/> อีเมล (เปลี่ยนไม่ได้)
                        </label>
                        <input value={user.email || ''} disabled className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl p-3 text-slate-500 dark:text-gray-400 cursor-not-allowed" />
                    </div>
                </div>

                <div className="pt-2">
                    <button onClick={handleSave} disabled={loading} className="w-full bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">
                        {loading ? 'กำลังบันทึก...' : <><Save size={18} /> บันทึกการเปลี่ยนแปลง</>}
                    </button>
                </div>

                {msg && <div className={`text-center text-sm p-3 rounded-xl font-medium ${msgType === 'success' ? 'text-emerald-600 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/20' : 'text-rose-600 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/20'} animate-pulse`}>{msg}</div>}
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