
import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebaseConfig';
import { initializeUser, getUserProfile } from './services/dbService';
import { Lock, Sparkles, Orbit } from 'lucide-react';
import { UserProfile } from './types';

// Pages
import Login from './pages/Login';
import Layout from './components/Layout';
import TimeAttendance from './pages/TimeAttendance';
import Management from './pages/Management';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import AdminPanel from './pages/AdminPanel';
import Settings from './pages/Settings';
import Reminders from './pages/Reminders';
import WorkPlanner from './pages/WorkPlanner';

const FullPageLoader = () => {
  const brandName = "Happy Joby";
  
  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#020617] flex flex-col items-center justify-center relative overflow-hidden transition-colors duration-700">
      {/* Dynamic Background Elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] opacity-20 dark:opacity-30 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600 rounded-full blur-[120px] animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center">
        {/* Animated Text Logo */}
        <div className="flex flex-wrap justify-center items-center gap-x-2 sm:gap-x-4">
          <div className="flex">
            {"Happy".split("").map((char, i) => (
              <span 
                key={i} 
                className="text-5xl sm:text-7xl font-black tracking-tighter text-slate-900 dark:text-white letter-anim glow-text"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                {char}
              </span>
            ))}
          </div>
          <div className="flex">
            {"Joby".split("").map((char, i) => (
              <span 
                key={i} 
                className="text-5xl sm:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-cyan-500 to-blue-600 letter-anim glow-text"
                style={{ animationDelay: `${(i + 5) * 0.1}s` }}
              >
                {char}
              </span>
            ))}
          </div>
        </div>
        
        {/* Animated Subtitle */}
        <div 
          className="mt-8 flex items-center gap-3 px-5 py-2.5 bg-white/40 dark:bg-white/5 backdrop-blur-xl rounded-full border border-slate-200 dark:border-white/10 shadow-lg animate-enter opacity-0"
          style={{ animationDelay: '1.2s' }}
        >
          <div className="relative">
            <Sparkles className="text-cyan-500 w-4 h-4 animate-pulse" />
            <div className="absolute inset-0 bg-cyan-500/20 blur-sm rounded-full animate-ping"></div>
          </div>
          <span className="text-[10px] sm:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.4em]">
            Intelligent Workspace
          </span>
        </div>
      </div>

      {/* Progress/Status Indicator */}
      <div 
        className="absolute bottom-16 flex flex-col items-center gap-4 animate-enter opacity-0"
        style={{ animationDelay: '1.5s' }}
      >
        <div className="w-48 h-[2px] bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500 to-transparent w-full h-full animate-[glow-line_2s_infinite]"></div>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">
           <Orbit size={12} className="animate-spin duration-[3s]" />
           Connecting to cloud services
        </div>
      </div>
    </div>
  );
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
         await initializeUser(currentUser.uid, currentUser.email || 'unknown');
         const profile = await getUserProfile(currentUser.uid);
         setUserProfile(profile);
      } else {
         setUserProfile(null);
      }
      setUser(currentUser);
      
      // หน่วงเวลา 3 วินาทีเพื่อให้เห็น Animation สวยๆ ครบวงจร
      const timer = setTimeout(() => {
        setLoading(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <FullPageLoader />;
  }

  if (user && userProfile && userProfile.isApproved === false) {
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-6 text-center space-y-4">
            <div className="p-4 bg-red-500/10 rounded-full">
                <Lock className="w-12 h-12 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold">รอการอนุมัติบัญชี</h1>
            <p className="text-gray-400">บัญชีของคุณ ({user.email}) กำลังรอการตรวจสอบจากผู้ดูแลระบบ<br/>กรุณาติดต่อ Admin เพื่อเปิดใช้งาน</p>
            <button 
                onClick={() => auth.signOut()}
                className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
            >
                กลับสู่หน้าล็อกอิน
            </button>
        </div>
      );
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        
        <Route path="/" element={user ? <Layout user={user} userProfile={userProfile} /> : <Navigate to="/login" />}>
           <Route index element={<TimeAttendance user={user!} userProfile={userProfile} />} />
           <Route path="reminders" element={<Reminders user={user!} />} />
           <Route path="planner" element={<WorkPlanner user={user!} userProfile={userProfile} />} />
           <Route path="reports" element={<Reports user={user!} />} />
           <Route path="management" element={<Management user={user!} />} />
           <Route path="dashboard" element={<Dashboard />} />
           <Route path="settings" element={<Settings user={user!} />} />
           
           {['admin', 'manager'].includes(userProfile?.role || '') && (
               <Route path="admin" element={<AdminPanel viewerProfile={userProfile} />} />
           )}
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
