
import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { GlassCard } from '../components/GlassCard';
import { Key, Mail, AlertCircle, Eye, EyeOff, Sparkles, ArrowRight, Loader2 } from 'lucide-react';

const Login: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resetSent, setResetSent] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
        } catch (err: any) {
            console.error(err);
            // Firebase now uses 'auth/invalid-credential' for both wrong email and wrong password
            if (err.code === 'auth/invalid-credential') {
                setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
            } else if (err.code === 'auth/email-already-in-use') {
                setError('อีเมลนี้ถูกใช้งานแล้ว');
            } else if (err.code === 'auth/weak-password') {
                setError('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
            } else if (err.code === 'auth/user-not-found') {
                setError('ไม่พบผู้ใช้งานรายนี้ในระบบ');
            } else if (err.code === 'auth/wrong-password') {
                setError('รหัสผ่านไม่ถูกต้อง');
            } else {
                setError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่ภายหลัง');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!email) {
            setError('กรุณากรอกอีเมลเพื่อรับลิงก์รีเซ็ตรหัสผ่าน');
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            setResetSent(true);
            setError('');
        } catch (err) {
            setError('ไม่สามารถส่งอีเมลรีเซ็ตได้');
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F7] dark:bg-slate-950 p-6 font-sans relative overflow-hidden transition-colors duration-500">
             {/* Cinematic Background */}
             <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-400/10 dark:bg-blue-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[5000ms]"></div>
             <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-400/10 dark:bg-purple-600/20 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="w-full max-w-md z-10 animate-enter">
                <div className="text-center mb-10">
                     <div className="relative inline-block mb-6 group cursor-default">
                        <div className="absolute -inset-2 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                        <img 
                            src="https://img2.pic.in.th/pic/Happy-joby.png" 
                            alt="Happy Joby Logo" 
                            className="relative h-28 w-auto object-contain drop-shadow-2xl rounded-2xl" 
                        />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
                        Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">Happy Joby</span>
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">The intelligent workspace for modern teams.</p>
                </div>

                <GlassCard className="p-8 border-white/50 dark:border-white/5 bg-white/70 dark:bg-slate-900/50 shadow-2xl ring-1 ring-black/5 dark:ring-white/10">
                    <form onSubmit={handleAuth} className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1 uppercase tracking-wider">Email</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-cyan-500 transition-colors" size={18} />
                                <input 
                                    type="email" 
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                                    placeholder="name@company.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1 uppercase tracking-wider">Password</label>
                            <div className="relative group">
                                <Key className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-cyan-500 transition-colors" size={18} />
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-xl py-3 pl-12 pr-12 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-white focus:outline-none transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-3 text-rose-500 dark:text-rose-400 text-sm bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/20 p-3 rounded-xl animate-pulse">
                                <AlertCircle size={18} />
                                {error}
                            </div>
                        )}

                         {resetSent && (
                            <div className="flex items-center gap-3 text-emerald-500 dark:text-emerald-400 text-sm bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/20 p-3 rounded-xl">
                                <Sparkles size={18} />
                                ลิงก์รีเซ็ตรหัสผ่านถูกส่งไปที่อีเมลของคุณแล้ว
                            </div>
                        )}

                        <button 
                            type="submit"
                            disabled={loading}
                            className="w-full group relative bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold py-3.5 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-95 overflow-hidden"
                        >
                            <span className="flex items-center justify-center gap-2">
                                {loading ? <Loader2 className="animate-spin" /> : (
                                    <>
                                        {isLogin ? 'Sign In' : 'Create Account'} 
                                        {!loading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform"/>}
                                    </>
                                )}
                            </span>
                        </button>
                    </form>

                    <div className="mt-8 flex flex-col items-center gap-4 text-sm">
                        <button onClick={() => setIsLogin(!isLogin)} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors flex items-center gap-1.5 group">
                            {isLogin ? 'New here?' : 'Already have an account?'}
                            <span className="text-cyan-600 dark:text-cyan-400 group-hover:underline underline-offset-4">{isLogin ? 'Create an account' : 'Sign in'}</span>
                        </button>
                        
                        {isLogin && (
                             <button onClick={handleForgotPassword} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs transition-colors">
                                ลืมรหัสผ่าน?
                            </button>
                        )}
                    </div>
                </GlassCard>
            </div>
        </div>
    );
};

export default Login;
