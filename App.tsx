
import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebaseConfig';
import { initializeUser, getUserProfile } from './services/dbService';
import { Loader2, Lock } from 'lucide-react';
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
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <Loader2 className="animate-spin w-10 h-10 text-cyan-400" />
      </div>
    );
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
