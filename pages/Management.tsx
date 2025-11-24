import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Trash2, Plus, Building, User as UserIcon, Edit, X, Save } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { getUserProfile, addHospital, addCustomer, updateUserProfile } from '../services/dbService';
import { UserProfile, Customer } from '../types';

interface Props { user: User; }

const Management: React.FC<Props> = ({ user }) => {
    const [activeTab, setActiveTab] = useState<'hospitals' | 'customers'>('hospitals');
    const [profile, setProfile] = useState<UserProfile | null>(null);
    
    // Add State
    const [newHospital, setNewHospital] = useState('');
    const [newCustomer, setNewCustomer] = useState<Customer>({ hospital: '', name: '', department: '', phone: '' });

    // Edit State
    const [editingHospital, setEditingHospital] = useState<{ original: string, current: string } | null>(null);
    const [editingCustomer, setEditingCustomer] = useState<{ index: number, data: Customer } | null>(null);

    const refresh = async () => { setProfile(await getUserProfile(user.uid)); };
    useEffect(() => { refresh(); }, [user]);

    // --- HOSPITAL LOGIC ---
    const handleAddHospital = async () => {
        if (!newHospital.trim()) return;
        await addHospital(user.uid, newHospital.trim());
        setNewHospital('');
        refresh();
    };

    const handleUpdateHospital = async () => {
        if (!editingHospital || !profile || !editingHospital.current.trim()) return;
        // ... (Logic unchanged)
        const newHospitalName = editingHospital.current.trim();
        const oldHospitalName = editingHospital.original;
        const updatedList = profile.hospitals.map(h => h === oldHospitalName ? newHospitalName : h);
        let updatedCustomers = profile.customers;
        if (oldHospitalName !== newHospitalName) {
             updatedCustomers = profile.customers.map(c => c.hospital === oldHospitalName ? { ...c, hospital: newHospitalName } : c);
        }
        await updateUserProfile(user.uid, { hospitals: updatedList, customers: updatedCustomers });
        setEditingHospital(null); refresh();
    };

    const handleDeleteHospital = async (h: string) => {
        if(!profile) return;
        if(!window.confirm(`ต้องการลบ "${h}" หรือไม่?`)) return;
        await updateUserProfile(user.uid, { hospitals: profile.hospitals.filter(item => item !== h) });
        refresh();
    }

    // --- CUSTOMER LOGIC ---
    const handleAddCustomer = async () => {
        if (!newCustomer.name || !newCustomer.hospital) return;
        await addCustomer(user.uid, newCustomer);
        setNewCustomer({ hospital: profile?.hospitals[0] || '', name: '', department: '', phone: '' });
        refresh();
    };

    const handleUpdateCustomer = async () => {
        if (!editingCustomer || !profile) return;
        const updatedList = [...profile.customers];
        updatedList[editingCustomer.index] = editingCustomer.data;
        await updateUserProfile(user.uid, { customers: updatedList });
        setEditingCustomer(null); refresh();
    };

    const handleDeleteCustomer = async (idx: number) => {
         if(!profile) return;
         if(!window.confirm("ต้องการลบลูกค้ารายนี้หรือไม่?")) return;
         const newDetails = [...profile.customers];
         newDetails.splice(idx, 1);
         await updateUserProfile(user.uid, { customers: newDetails });
         refresh();
    }

    return (
        <div className="max-w-lg mx-auto space-y-6 animate-enter pb-24">
            {/* Modern Tabs */}
            <div className="flex p-1 bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-white/5 rounded-2xl sticky top-4 z-20 backdrop-blur-md shadow-sm">
                {['hospitals', 'customers'].map((tab) => (
                    <button 
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                            activeTab === tab 
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md' 
                            : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        } capitalize`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {activeTab === 'hospitals' && (
                <div className="space-y-4 animate-enter">
                    {/* Add Hospital Input */}
                    <GlassCard className="p-4 bg-white/50 dark:bg-slate-900/50">
                        <div className="flex gap-3">
                            <input 
                                value={newHospital}
                                onChange={(e) => setNewHospital(e.target.value)}
                                placeholder="Enter hospital name..."
                                className="flex-1 bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:border-cyan-500 outline-none placeholder:text-slate-400"
                            />
                            <button onClick={handleAddHospital} className="bg-cyan-600 px-4 rounded-xl hover:bg-cyan-500 text-white transition-colors shadow-md shadow-cyan-500/20">
                                <Plus size={24} />
                            </button>
                        </div>
                    </GlassCard>

                    <div className="space-y-2">
                        {profile?.hospitals.map((h, i) => (
                            <div key={i} className="group flex justify-between items-center p-4 bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-white/5 rounded-2xl hover:border-cyan-200 dark:hover:bg-slate-800/50 transition-all shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-cyan-100 dark:bg-cyan-500/10 rounded-lg text-cyan-600 dark:text-cyan-400"><Building size={18}/></div>
                                    <span className="text-slate-800 dark:text-slate-200 font-medium">{h}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setEditingHospital({ original: h, current: h })} 
                                        className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteHospital(h)} 
                                        className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {profile?.hospitals.length === 0 && (
                            <div className="text-center text-slate-400 py-4 italic">ยังไม่มีรายชื่อโรงพยาบาล</div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'customers' && (
                <div className="space-y-6 animate-enter">
                    {/* Add Customer Form */}
                    <GlassCard className="bg-white/50 dark:bg-slate-900/50">
                        <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-4 uppercase tracking-wider">Add New Contact</h3>
                        <div className="space-y-3">
                            <select 
                                value={newCustomer.hospital}
                                onChange={(e) => setNewCustomer({...newCustomer, hospital: e.target.value})}
                                className="w-full bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-emerald-500 appearance-none"
                            >
                                <option value="">Select Hospital</option>
                                {profile?.hospitals.map(h => <option key={h} value={h} className="dark:bg-slate-900">{h}</option>)}
                            </select>
                            <input 
                                value={newCustomer.name}
                                onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                                placeholder="Customer Name"
                                className="w-full bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <input 
                                    value={newCustomer.department}
                                    onChange={(e) => setNewCustomer({...newCustomer, department: e.target.value})}
                                    placeholder="Department"
                                    className="bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                                />
                                <input 
                                    value={newCustomer.phone}
                                    onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                                    placeholder="Phone"
                                    className="bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                                />
                            </div>
                            <button onClick={handleAddCustomer} className="w-full bg-emerald-600 py-3 rounded-xl font-bold text-white hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-500/20">
                                Save Contact
                            </button>
                        </div>
                    </GlassCard>

                    <div className="space-y-3">
                         {profile?.customers.map((c, i) => (
                            <div key={i} className="flex justify-between items-center p-4 bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-white/5 rounded-2xl hover:shadow-md dark:hover:bg-slate-800/50 transition-all shadow-sm">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-emerald-100 dark:bg-emerald-500/10 rounded-full text-emerald-600 dark:text-emerald-400">
                                        <UserIcon size={20} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-900 dark:text-white text-lg">{c.name}</div>
                                        <div className="text-sm text-slate-500 dark:text-slate-400">{c.department} • <span className="text-slate-400 dark:text-slate-500">{c.hospital}</span></div>
                                        <div className="text-xs text-slate-400 dark:text-slate-600 mt-1">{c.phone}</div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setEditingCustomer({ index: i, data: c })} 
                                        className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteCustomer(i)} 
                                        className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                         {profile?.customers.length === 0 && (
                            <div className="text-center text-slate-400 py-4 italic">ยังไม่มีรายชื่อลูกค้า</div>
                        )}
                    </div>
                </div>
            )}

            {/* --- EDIT HOSPITAL MODAL --- */}
            {editingHospital && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
                    <GlassCard className="w-full max-w-sm relative border-cyan-500/30 bg-white dark:bg-slate-900 shadow-2xl">
                        <button onClick={() => setEditingHospital(null)} className="absolute top-4 right-4 text-slate-400 hover:text-rose-500"><X size={20} /></button>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Edit Hospital</h3>
                        
                        <input 
                            value={editingHospital.current}
                            onChange={(e) => setEditingHospital({...editingHospital, current: e.target.value})}
                            className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-cyan-500 mb-4"
                            placeholder="Hospital Name"
                        />
                        
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setEditingHospital(null)}
                                className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-slate-200"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleUpdateHospital}
                                className="flex-1 py-2 rounded-xl bg-cyan-600 text-white font-bold hover:bg-cyan-500 flex items-center justify-center gap-2"
                            >
                                <Save size={16} /> Save
                            </button>
                        </div>
                    </GlassCard>
                </div>
            )}

            {/* --- EDIT CUSTOMER MODAL --- */}
            {editingCustomer && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
                    <GlassCard className="w-full max-w-md relative border-emerald-500/30 bg-white dark:bg-slate-900 shadow-2xl">
                        <button onClick={() => setEditingCustomer(null)} className="absolute top-4 right-4 text-slate-400 hover:text-rose-500"><X size={20} /></button>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Edit Contact</h3>
                        
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-slate-500 uppercase ml-1">Hospital</label>
                                <select 
                                    value={editingCustomer.data.hospital}
                                    onChange={(e) => setEditingCustomer({...editingCustomer, data: {...editingCustomer.data, hospital: e.target.value}})}
                                    className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-emerald-500 appearance-none"
                                >
                                    {profile?.hospitals.map(h => <option key={h} value={h} className="dark:bg-slate-900">{h}</option>)}
                                </select>
                            </div>
                            
                            <div>
                                <label className="text-xs text-slate-500 uppercase ml-1">Name</label>
                                <input 
                                    value={editingCustomer.data.name}
                                    onChange={(e) => setEditingCustomer({...editingCustomer, data: {...editingCustomer.data, name: e.target.value}})}
                                    className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-500 uppercase ml-1">Department</label>
                                    <input 
                                        value={editingCustomer.data.department}
                                        onChange={(e) => setEditingCustomer({...editingCustomer, data: {...editingCustomer.data, department: e.target.value}})}
                                        className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 uppercase ml-1">Phone</label>
                                    <input 
                                        value={editingCustomer.data.phone}
                                        onChange={(e) => setEditingCustomer({...editingCustomer, data: {...editingCustomer.data, phone: e.target.value}})}
                                        className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                                    />
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex gap-3 mt-6">
                            <button 
                                onClick={() => setEditingCustomer(null)}
                                className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-slate-200"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleUpdateCustomer}
                                className="flex-1 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 flex items-center justify-center gap-2"
                            >
                                <Save size={16} /> Update
                            </button>
                        </div>
                    </GlassCard>
                </div>
            )}
        </div>
    );
};

export default Management;