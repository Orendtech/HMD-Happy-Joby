import React, { useEffect, useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import { getAllUsers, toggleUserStatus, updateUserRole, getGlobalReportRange, getTodayDateId, updateUserProfile, adminCreateUser, getAllGlobalCustomers } from '../services/dbService';
import { AdminUser, UserProfile, Customer } from '../types';
import { ShieldCheck, Users, Download, UserCheck, UserX, FileText, MapPin, CheckCircle, Calendar, Edit, X, Save, Search, Eye, Plus, AlertCircle, Loader2, Building, Phone, User as UserIcon, ChevronRight } from 'lucide-react';

interface AdminPanelProps {
    viewerProfile: UserProfile | null;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ viewerProfile }) => {
    const [activeTab, setActiveTab] = useState<'users' | 'reports' | 'customers'>('users');
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [startDate, setStartDate] = useState(getTodayDateId());
    const [endDate, setEndDate] = useState(getTodayDateId());
    const [reportData, setReportData] = useState<any[]>([]);
    const [customers, setCustomers] = useState<Array<Customer & { addedBy: string, userId: string }>>([]);
    const [customerSearch, setCustomerSearch] = useState('');
    const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
    const [editForm, setEditForm] = useState({ name: '', area: '', startDate: '', reportsTo: '' });
    const [showAddUser, setShowAddUser] = useState(false);
    const [addUserForm, setAddUserForm] = useState({ email: '', password: '', reportsTo: '' });
    const [addUserLoading, setAddUserLoading] = useState(false);
    const [addUserError, setAddUserError] = useState('');

    const isManager = viewerProfile?.role === 'manager';
    const potentialManagers = users.filter(u => u.role === 'admin' || u.role === 'manager');

    const fetchUsers = async () => { setUsers(await getAllUsers()); };
    const fetchReport = async () => { setReportData(await getGlobalReportRange(startDate, endDate)); }
    const fetchCustomers = async () => { setCustomers(await getAllGlobalCustomers()); }

    useEffect(() => {
        if (activeTab === 'users') fetchUsers();
        if (activeTab === 'reports') fetchReport();
        if (activeTab === 'customers') fetchCustomers();
    }, [activeTab]);

    useEffect(() => { if (activeTab === 'reports' && startDate && endDate) fetchReport(); }, [startDate, endDate]);

    const handleToggleStatus = async (uid: string, status: boolean | undefined) => { if (isManager) return; await toggleUserStatus(uid, !!status); fetchUsers(); };
    const handleRoleChange = async (uid: string, newRole: string) => { if (isManager) return; await updateUserRole(uid, newRole as any); fetchUsers(); };
    const handleEditClick = (user: AdminUser) => { if (isManager) return; setEditingUser(user); setEditForm({ name: user.name || '', area: user.area || '', startDate: user.startDate || '', reportsTo: user.reportsTo || '' }); };
    const handleSaveUser = async () => { if (!editingUser || isManager) return; await updateUserProfile(editingUser.id, { name: editForm.name, area: editForm.area, startDate: editForm.startDate, reportsTo: editForm.reportsTo }); await fetchUsers(); setEditingUser(null); };
    const handleAddUserSubmit = async () => { setAddUserError(''); setAddUserLoading(true); try { await adminCreateUser(addUserForm.email, addUserForm.password, addUserForm.reportsTo); await fetchUsers(); setShowAddUser(false); setAddUserForm({ email: '', password: '', reportsTo: '' }); } catch (e: any) { console.error(e); setAddUserError(e.message || 'Failed to create user.'); } finally { setAddUserLoading(false); } };
    const exportToCSV = () => { if (reportData.length === 0) return; const headers = ["Date", "Email", "Name", "Check-ins", "Hospitals", "Start", "End", "Locations", "Met With", "Report"]; const csvContent = [headers.join(','), ...reportData.map(row => [row.date, row.userEmail, row.userName, row.checkInCount, row.hospitalCount, `"${row.checkInTime}"`, `"${row.checkOutTime}"`, `"${row.locations}"`, `"${row.metWith}"`, `"${row.reportSummary.replace(/"/g, '""')}"`].join(','))].join('\n'); const link = document.createElement("a"); link.href = encodeURI("data:text/csv;charset=utf-8,\uFEFF" + csvContent); link.download = `report_${startDate}_to_${endDate}.csv`; document.body.appendChild(link); link.click(); document.body.removeChild(link); };
    const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.hospital.toLowerCase().includes(customerSearch.toLowerCase()) || c.addedBy.toLowerCase().includes(customerSearch.toLowerCase()));

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-enter pb-20">
             <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{isManager ? 'Manager Console' : 'Admin Console'}</h2>
                    <p className="text-slate-500 text-sm">{isManager ? 'View reports and user data' : 'System overview and controls'}</p>
                </div>
                <div className={`p-3 rounded-2xl shadow-lg ${isManager ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-gradient-to-r from-cyan-500 to-blue-500 shadow-cyan-500/20'}`}>
                    {isManager ? <Eye size={24} className="text-white" /> : <ShieldCheck size={24} className="text-white" />}
                </div>
            </div>

            <div className="flex gap-4 border-b border-slate-200 dark:border-white/10 overflow-x-auto pb-1">
                {['users', 'reports', 'customers'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab as any)} className={`pb-3 px-4 text-sm font-bold capitalize transition-all relative whitespace-nowrap ${activeTab === tab ? 'text-slate-900 dark:text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                        {tab}
                        {activeTab === tab && <div className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full ${isManager ? 'bg-emerald-500' : 'bg-cyan-500'}`}></div>}
                    </button>
                ))}
            </div>

            {activeTab === 'users' && (
                <div className="space-y-4">
                     {!isManager && (
                        <button onClick={() => setShowAddUser(true)} className="w-full py-3 border border-dashed border-slate-300 dark:border-white/20 rounded-xl text-slate-500 hover:text-cyan-600 hover:border-cyan-500 hover:bg-cyan-50 dark:hover:bg-white/5 transition-all flex items-center justify-center gap-2">
                            <Plus size={20} /> Add New User
                        </button>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {users.map(u => (
                            <div key={u.id} className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 p-5 rounded-2xl hover:shadow-md dark:hover:bg-slate-800/50 transition-all group relative overflow-hidden shadow-sm">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="text-slate-900 dark:text-white font-bold text-lg">{u.name || 'Unnamed User'}</div>
                                        <div className="text-slate-400 text-xs">{u.email}</div>
                                    </div>
                                    {!isManager && <button onClick={() => handleEditClick(u)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 hover:text-cyan-600 transition-colors"><Edit size={14} /></button>}
                                </div>
                                <div className="flex gap-2 mb-4 flex-wrap">
                                    {u.area && <span className="text-[10px] bg-slate-100 dark:bg-slate-950 text-slate-500 px-2 py-1 rounded border border-slate-200 dark:border-white/5">{u.area}</span>}
                                    <span className={`text-[10px] px-2 py-1 rounded border font-bold ${u.role === 'admin' ? 'bg-indigo-100 dark:bg-indigo-500/20 border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-300' : u.role === 'manager' ? 'bg-emerald-100 dark:bg-emerald-500/20 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}>{u.role?.toUpperCase() || 'USER'}</span>
                                </div>
                                {!isManager && (
                                    <div className="grid grid-cols-2 gap-2 mt-auto">
                                        <button onClick={() => handleToggleStatus(u.id, u.isApproved)} className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${u.isApproved !== false ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'}`}>{u.isApproved !== false ? <><UserX size={12}/> Suspend</> : <><UserCheck size={12}/> Approve</>}</button>
                                        <select value={u.role || 'user'} onChange={(e) => handleRoleChange(u.id, e.target.value)} className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg text-xs text-slate-600 dark:text-slate-300 outline-none text-center py-2"><option value="user">User</option><option value="manager">Manager</option><option value="admin">Admin</option></select>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'reports' && (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                        <div className="flex flex-col md:flex-row gap-4 items-end">
                            <div className="flex-1 w-full">
                                <label className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2 block">Date Range</label>
                                <div className="flex gap-2">
                                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="flex-1 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-cyan-500" />
                                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="flex-1 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-cyan-500" />
                                </div>
                            </div>
                            <button onClick={exportToCSV} disabled={reportData.length === 0} className={`px-6 py-3.5 rounded-xl font-bold flex items-center gap-2 transition-all ${reportData.length > 0 ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'}`}><Download size={18} /> Export CSV</button>
                        </div>
                    </div>
                    <div className="space-y-2">
                         <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2 pl-2">Preview</div>
                         {reportData.slice(0, 5).map((row, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900/30 border border-slate-100 dark:border-white/5 rounded-2xl shadow-sm">
                                <div><div className="font-bold text-slate-900 dark:text-white text-sm">{row.userEmail}</div><div className="text-xs text-slate-500">{row.date} • {row.checkInCount} Check-ins</div></div>
                                {row.reportSummary && <FileText size={16} className="text-purple-400" />}
                            </div>
                         ))}
                    </div>
                </div>
            )}

            {activeTab === 'customers' && (
                <div className="space-y-4">
                     <div className="relative">
                        <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
                        <input type="text" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Search by name, hospital, or rep..." className="w-full bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-slate-900 dark:text-white outline-none focus:border-cyan-500 transition-all shadow-sm" />
                     </div>
                     <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-3xl overflow-hidden shadow-sm">
                        {filteredCustomers.length === 0 ? <div className="p-8 text-center text-slate-400">No customers found.</div> : (
                            <div className="divide-y divide-slate-100 dark:divide-white/5">
                                {filteredCustomers.map((c, idx) => (
                                    <div key={idx} className="p-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"><UserIcon size={20} /></div>
                                            <div><div className="font-bold text-slate-900 dark:text-white">{c.name}</div><div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5"><span className="flex items-center gap-1"><Building size={10} className="text-cyan-500" /> {c.hospital}</span><span>•</span><span className="flex items-center gap-1"><Phone size={10} /> {c.phone || 'No phone'}</span></div></div>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs bg-slate-100 dark:bg-slate-950 px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/5 self-start md:self-auto"><span className="text-slate-500">Rep:</span><span className="text-slate-700 dark:text-slate-300 font-medium">{c.addedBy}</span></div>
                                    </div>
                                ))}
                            </div>
                        )}
                     </div>
                </div>
            )}
            {/* ... Modal Code similar to previous but styled light/dark ... */}
            {editingUser && !isManager && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
                    <GlassCard className="w-full max-w-md relative border-cyan-500/30 bg-white dark:bg-slate-900 shadow-2xl">
                        <button onClick={() => setEditingUser(null)} className="absolute top-4 right-4 text-slate-400 hover:text-rose-500"><X size={20} /></button>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Edit Profile</h3>
                        <div className="space-y-4">
                            <input value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} placeholder="Full Name" className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-cyan-500" />
                            <input value={editForm.area} onChange={(e) => setEditForm({...editForm, area: e.target.value})} placeholder="Area / Region" className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-cyan-500" />
                            <input type="date" value={editForm.startDate} onChange={(e) => setEditForm({...editForm, startDate: e.target.value})} className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-cyan-500" />
                             <div className="space-y-2"><label className="text-xs text-slate-400 uppercase tracking-wider">Reports To (Manager)</label><select value={editForm.reportsTo} onChange={(e) => setEditForm({...editForm, reportsTo: e.target.value})} className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-cyan-500 appearance-none"><option value="">-- Select Manager --</option>{potentialManagers.map(m => (<option key={m.id} value={m.id} className="dark:bg-slate-900">{m.name || m.email} ({m.role})</option>))}</select></div>
                            <button onClick={handleSaveUser} className="w-full bg-cyan-600 py-3 rounded-xl font-bold text-white hover:bg-cyan-500 mt-2">Save Changes</button>
                        </div>
                    </GlassCard>
                </div>
            )}
            {showAddUser && !isManager && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
                    <GlassCard className="w-full max-w-md relative border-emerald-500/30 bg-white dark:bg-slate-900 shadow-2xl">
                        <button onClick={() => setShowAddUser(false)} className="absolute top-4 right-4 text-slate-400 hover:text-rose-500"><X size={20} /></button>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Add New User</h3>
                        <div className="space-y-4">
                            <input type="email" value={addUserForm.email} onChange={(e) => setAddUserForm({...addUserForm, email: e.target.value})} placeholder="employee@company.com" className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-emerald-500" />
                            <input type="password" value={addUserForm.password} onChange={(e) => setAddUserForm({...addUserForm, password: e.target.value})} placeholder="Set initial password" className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-emerald-500" />
                             <div className="space-y-2"><label className="text-xs text-slate-400 uppercase tracking-wider">Reports To (Manager)</label><select value={addUserForm.reportsTo} onChange={(e) => setAddUserForm({...addUserForm, reportsTo: e.target.value})} className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-emerald-500 appearance-none"><option value="">-- Select Manager --</option>{potentialManagers.map(m => (<option key={m.id} value={m.id} className="dark:bg-slate-900">{m.name || m.email} ({m.role})</option>))}</select></div>
                            {addUserError && <div className="flex items-center gap-2 text-rose-500 text-sm bg-rose-50 p-3 rounded-lg"><AlertCircle size={16} />{addUserError}</div>}
                            <button onClick={handleAddUserSubmit} disabled={addUserLoading} className="w-full bg-emerald-600 py-3 rounded-xl font-bold text-white hover:bg-emerald-500 mt-2 flex items-center justify-center gap-2">{addUserLoading ? <Loader2 className="animate-spin" /> : 'Create Account'}</button>
                        </div>
                    </GlassCard>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;