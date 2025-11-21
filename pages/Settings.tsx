import React, { useEffect, useState } from 'react';
import { User, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { getUserProfile, updateUserProfile } from '../services/dbService';
import { UserProfile } from '../types';
import { GlassCard } from '../components/GlassCard';
import { User as UserIcon, MapPin, Calendar, Mail, Lock, Save, LogOut, Settings as SettingsIcon } from 'lucide-react';
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
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');
    const [msgType, setMsgType] = useState<'success' | 'error'>('success');

    useEffect(() => {
        const load = async () => {
            const p = await getUserProfile(user.uid);
            if (p) {
                setProfile(p);
                setName(p.name || '');
                setArea(p.area || '');
                setStartDate(p.startDate || '');
            }
        };
        load();
    }, [user]);

    const handleSave = async () => {
        setLoading(true);
        try {
            await updateUserProfile(user.uid, {
                name,
                area,
                startDate
            });
            setMsg('บันทึกข้อมูลเรียบร้อย');
            setMsgType('success');
            // Refresh window to update header name if needed, or context would be better but reload is simple
            setTimeout(() => {
                setMsg('');
                window.location.reload(); 
            }, 1500);
        } catch (e) {
            setMsg('เกิดข้อผิดพลาดในการบันทึก');
            setMsgType('error');
        }
        setLoading(false);
    };

    const handlePasswordReset = async () => {
        if (!user.email) return;
        try {
            await sendPasswordResetEmail(auth, user.email);
            setMsg('ส่งอีเมลเปลี่ยนรหัสผ่านเรียบร้อยแล้ว กรุณาตรวจสอบกล่องข้อความ');
            setMsgType('success');
        } catch (e) {
            setMsg('ไม่สามารถส่งอีเมลได้');
            setMsgType('error');
        }
    };

    const handleLogout = () => {
        auth.signOut();
        navigate('/login');
    };

    return (
        <div className="max-w-lg mx-auto space-y-6 pb-20">
             <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gray-500/20 rounded-full text-gray-300">
                    <SettingsIcon size={24} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white">ตั้งค่า</h2>
                    <p className="text-sm text-gray-400">จัดการข้อมูลส่วนตัวและบัญชี</p>
                </div>
            </div>

            <GlassCard className="space-y-4">
                <h3 className="text-lg font-bold text-cyan-300 mb-4">ข้อมูลส่วนตัว</h3>
                
                <div className="space-y-2">
                    <label className="text-sm text-gray-400 flex items-center gap-2">
                        <UserIcon size={14}/> ชื่อ-นามสกุล
                    </label>
                    <input 
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-cyan-500 transition-colors"
                        placeholder="ระบุชื่อ-นามสกุลของคุณ"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm text-gray-400 flex items-center gap-2">
                        <MapPin size={14}/> เขตพื้นที่รับผิดชอบ
                    </label>
                    <input 
                        value={area}
                        onChange={e => setArea(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-cyan-500 transition-colors"
                        placeholder="เช่น กทม., ภาคเหนือ, ภาคตะวันออก"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm text-gray-400 flex items-center gap-2">
                        <Calendar size={14}/> วันที่เริ่มงาน
                    </label>
                    <input 
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-cyan-500 transition-colors"
                    />
                </div>

                 <div className="space-y-2 opacity-60">
                    <label className="text-sm text-gray-400 flex items-center gap-2">
                        <Mail size={14}/> อีเมล (เปลี่ยนไม่ได้)
                    </label>
                    <input 
                        value={user.email || ''}
                        disabled
                        className="w-full bg-black/40 border border-white/5 rounded-lg p-3 text-gray-400 cursor-not-allowed"
                    />
                </div>

                <div className="pt-4">
                    <button 
                        onClick={handleSave}
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/20 active:scale-95 transition-all"
                    >
                        {loading ? 'กำลังบันทึก...' : <><Save size={18} /> บันทึกการเปลี่ยนแปลง</>}
                    </button>
                </div>

                {msg && (
                    <div className={`text-center text-sm p-2 rounded-lg ${msgType === 'success' ? 'text-emerald-300 bg-emerald-900/20' : 'text-rose-300 bg-rose-900/20'} animate-pulse`}>
                        {msg}
                    </div>
                )}
            </GlassCard>

             <GlassCard className="space-y-4 border-rose-500/20 bg-rose-900/5">
                <h3 className="text-lg font-bold text-rose-300 mb-4">ความปลอดภัย & บัญชี</h3>
                
                <button 
                    onClick={handlePasswordReset}
                    className="w-full bg-white/5 hover:bg-white/10 text-gray-300 py-3 rounded-xl flex items-center justify-between px-4 transition-colors group"
                >
                    <div className="flex items-center gap-3">
                        <Lock size={18} className="text-gray-400 group-hover:text-white"/>
                        <span>เปลี่ยนรหัสผ่าน</span>
                    </div>
                    <span className="text-xs text-gray-500 group-hover:text-gray-300">ส่งอีเมลรีเซ็ต</span>
                </button>

                 <button 
                    onClick={handleLogout}
                    className="w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 py-3 rounded-xl flex items-center justify-center gap-2 mt-2 transition-colors border border-rose-500/20"
                >
                    <LogOut size={18} /> ออกจากระบบ
                </button>
             </GlassCard>
        </div>
    );
};
export default Settings;