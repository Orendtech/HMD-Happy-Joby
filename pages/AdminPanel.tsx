
import React, { useEffect, useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import { 
    getAllUsers, 
    toggleUserStatus, 
    updateUserRole, 
    getGlobalReportRange, 
    getTodayDateId, 
    updateUserProfile, 
    adminCreateUser, 
    getAllGlobalCustomers, 
    getWorkPlans, 
    getUserHistory,
    undoCheckOut,
    getAllUsersTodayLocations
} from '../services/dbService';
import { AdminUser, UserProfile, Customer, WorkPlan, AttendanceDay, UserLocationData } from '../types';
import { 
    ShieldCheck, Users, Download, UserCheck, UserX, FileText, 
    MapPin, CheckCircle, Calendar, Edit, X, Save, Search, 
    Eye, Plus, AlertCircle, Loader2, Building, Phone, 
    User as UserIcon, ChevronRight, LayoutList, TrendingUp, 
    ChevronDown, RotateCcw, Zap
} from 'lucide-react';

interface AdminPanelProps {
    viewerProfile: UserProfile | null;
}

type ReportType = 'activity' | 'performance' | 'pipeline';

const AdminPanel: React.FC<AdminPanelProps> = ({ viewerProfile }) => {
    const [activeTab, setActiveTab] = useState<'users' | 'reports' | 'customers'>('users');
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [userStatuses, setUserStatuses] = useState<Record<string, UserLocationData>>({});
    const [loading, setLoading] = useState(false);
    const [startDate, setStartDate] = useState(getTodayDateId());
    const [endDate, setEndDate] = useState(getTodayDateId());
    const [reportType, setReportType] = useState<ReportType>('activity');
    const [reportData, setReportData] = useState<any[]>([]);
    const [customers, setCustomers] = useState<Array<Customer & { addedBy: string, userId: string }>>([]);
    const [customerSearch, setCustomerSearch] = useState('');
    const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
    const [editForm, setEditForm] = useState({ name: '', area: '', startDate: '', reportsTo: '' });
    const [showAddUser, setShowAddUser] = useState(false);
    const [addUserForm, setAddUserForm] = useState({ email: '', password: '', reportsTo: '' });
    const [addUserLoading, setAddUserLoading] = useState(false);
    const [addUserError, setAddUserError] = useState('');

    const isAdmin = viewerProfile?.role === 'admin';
    const isManager = viewerProfile?.role === 'manager';
    const potentialManagers = users.filter(u => u.role === 'admin' || u.role === 'manager');

    const fetchUsers = async () => { 
        const allUsers = await getAllUsers();
        setUsers(allUsers);
        
        // Fetch today's status for each user
        const todayLocations = await getAllUsersTodayLocations();
        const statusMap: Record<string, UserLocationData> = {};
        todayLocations.forEach(loc => {
            statusMap[loc.userId] = loc;
        });
        setUserStatuses(statusMap);
    };

    const fetchReport = async () => { 
        setLoading(true);
        setReportData(await getGlobalReportRange(startDate, endDate)); 
        setLoading(false);
    }
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

    const handleUndoCheckout = async (userId: string) => {
        if (!isAdmin) return;
        if (!window.confirm("ยืนยันการถอยกลับการเช็คเอาท์? พนักงานจะกลับสู่สถานะ On Duty ทันที")) return;
        
        try {
            await undoCheckOut(userId, getTodayDateId());
            alert("ถอยกลับรายการเช็คเอาท์เรียบร้อยแล้ว");
            fetchUsers();
        } catch (e) {
            alert("เกิดข้อผิดพลาดในการ Undo");
        }
    };

    const exportToCSV = async () => {
        setLoading(true);
        try {
            let headers: string[] = [];
            let rows: any[] = [];
            let filename = `report_${startDate}_to_${endDate}.csv`;

            if (reportType === 'activity') {
                headers = ["วันที่", "อีเมล", "ชื่อ", "จำนวนเช็คอิน", "จำนวนสถานพยาบาล", "เวลาเข้างาน", "เวลาเลิกงาน", "สถานที่เช็คอิน", "ผู้ที่เข้าพบ", "สรุปรายงาน"];
                const data = await getGlobalReportRange(startDate, endDate);
                rows = data.map(row => [
                    row.date, row.userEmail, row.userName, row.checkInCount, row.hospitalCount, `"${row.checkInTime}"`, `"${row.checkOutTime}"`, `"${row.locations}"`, `"${row.metWith}"`, `"${row.reportSummary.replace(/"/g, '""')}"`
                ]);
                filename = `global_activity_${startDate}_to_${endDate}.csv`;
            } 
            else if (reportType === 'performance') {
                headers = ["วันที่", "พนักงาน", "แผนงาน: หัวข้อ", "แผนงาน: รายละเอียด", "แผนงาน: จุดนัดพบ/เป้าหมาย", "รายงาน: สถานที่เช็คอิน", "รายงาน: เวลาเช็คอิน", "รายงาน: เวลาเลิกงาน", "รายงาน: ผู้ติดต่อ", "รายงาน: แผนก", "รายงาน: สรุปกิจกรรม"];
                const allUsersData = await getAllUsers();
                for (const u of allUsersData) {
                    const uPlans = await getWorkPlans(u.id);
                    const uHistory = await getUserHistory(u.id);
                    let curr = new Date(startDate);
                    const endD = new Date(endDate);
                    while (curr <= endD) {
                        const dateStr = curr.toISOString().split('T')[0];
                        const dayPlan = uPlans.find(p => p.date === dateStr);
                        const dayReport = uHistory.find(h => h.id === dateStr);
                        const planTitle = dayPlan?.title || '-';
                        const planContent = dayPlan?.content || '-';
                        const planItinerary = dayPlan?.itinerary ? dayPlan.itinerary.map(it => `${it.location} (${it.objective})`).join(' | ') : '-';

                        if (dayReport?.report?.visits && dayReport.report.visits.length > 0) {
                            dayReport.report.visits.forEach((v: any) => {
                                if (v.interactions && v.interactions.length > 0) {
                                    v.interactions.forEach((i: any) => {
                                        rows.push([
                                            dateStr, `"${u.name || u.email}"`, `"${planTitle.replace(/"/g, '""')}"`, `"${planContent.replace(/"/g, '""')}"`, `"${planItinerary.replace(/"/g, '""')}"`,
                                            `"${v.location}"`, v.checkInTime?.toDate().toLocaleTimeString('th-TH'), dayReport.checkOut?.toDate().toLocaleTimeString('th-TH') || '-',
                                            `"${i.customerName}"`, `"${i.department || '-'}"`, `"${(i.summary || '').replace(/"/g, '""')}"`
                                        ]);
                                    });
                                } else {
                                    rows.push([
                                        dateStr, `"${u.name || u.email}"`, `"${planTitle.replace(/"/g, '""')}"`, `"${planContent.replace(/"/g, '""')}"`, `"${planItinerary.replace(/"/g, '""')}"`,
                                        `"${v.location}"`, v.checkInTime?.toDate().toLocaleTimeString('th-TH'), dayReport.checkOut?.toDate().toLocaleTimeString('th-TH') || '-', '-', '-', '"(ไม่มีบันทึกกิจกรรม)"'
                                    ]);
                                }
                            });
                        } else if (dayPlan) {
                            rows.push([
                                dateStr, `"${u.name || u.email}"`, `"${planTitle.replace(/"/g, '""')}"`, `"${planContent.replace(/"/g, '""')}"`, `"${planItinerary.replace(/"/g, '""')}"`,
                                '-', '-', '-', '-', '-', '"(ยังไม่มีข้อมูลรายงาน)"'
                            ]);
                        }
                        curr.setDate(curr.getDate() + 1);
                    }
                }
                filename = `team_performance_${startDate}_to_${endDate}.csv`;
            }
            else if (reportType === 'pipeline') {
                headers = ["วันที่สร้าง", "พนักงาน", "สินค้า/โปรเจกต์", "โรงพยาบาล/สถานที่", "มูลค่า (บาท)", "สถานะ", "โอกาสสำเร็จ (%)", "วันที่คาดว่าจะปิด", "ผู้ติดต่อ"];
                const allUsersData = await getAllUsers();
                allUsersData.forEach(u => {
                    if (u.activePipeline) {
                        u.activePipeline.forEach(deal => {
                            const dealDate = deal.expectedCloseDate || deal.lastUpdated?.split('T')[0] || '';
                            if (dealDate >= startDate && dealDate <= endDate) {
                                rows.push([
                                    deal.lastUpdated?.split('T')[0] || '-', `"${u.name || u.email}"`, `"${deal.product}"`, `"-"`, deal.value, deal.stage, `${deal.probability}%`, deal.expectedCloseDate || '-', `"${deal.customerName || '-'}"`
                                ]);
                            }
                        });
                    }
                });
                filename = `global_pipeline_${startDate}_to_${endDate}.csv`;
            }

            if (rows.length === 0) { alert("ไม่พบข้อมูลในช่วงวันที่เลือก"); return; }
            const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
            const link = document.createElement("a");
            link.href = encodeURI("data:text/csv;charset=utf-8,\uFEFF" + csvContent);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) { console.error(e); alert("เกิดข้อผิดพลาดในการส่งออกข้อมูล"); } finally { setLoading(false); }
    };

    const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.hospital.toLowerCase().includes(customerSearch.toLowerCase()) || c.addedBy.toLowerCase().includes(customerSearch.toLowerCase()));

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-enter pb-20 px-4 pt-6">
             <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{isManager ? 'Manager Console' : 'Admin Console'}</h2>
                    <p className="text-slate-500 text-sm">{isManager ? 'View reports and user data' : 'System overview and controls'}</p>
                </div>
                <div className={`p-3 rounded-2xl shadow-lg ${isManager ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-gradient-to-r from-cyan-500 to-blue-500 shadow-cyan-500/20'}`}>{isManager ? <Eye size={24} className="text-white" /> : <ShieldCheck size={24} className="text-white" />}</div>
            </div>

            <div className="flex gap-4 border-b border-slate-200 dark:border-white/10 overflow-x-auto pb-1">
                {['users', 'reports', 'customers'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab as any)} className={`pb-3 px-4 text-sm font-bold capitalize transition-all relative whitespace-nowrap ${activeTab === tab ? 'text-slate-900 dark:text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>{tab}{activeTab === tab && <div className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full ${isManager ? 'bg-emerald-500' : 'bg-cyan-500'}`}></div>}</button>
                ))}
            </div>

            {activeTab === 'users' && (
                <div className="space-y-4">
                     {!isManager && (<button onClick={() => setShowAddUser(true)} className="w-full py-3 border border-dashed border-slate-300 dark:border-white/20 rounded-xl text-slate-500 hover:text-cyan-600 hover:border-cyan-500 hover:bg-cyan-50 dark:hover:bg-white/5 transition-all flex items-center justify-center gap-2"><Plus size={20} /> Add New User</button>)}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {users.map(u => {
                            const status = userStatuses[u.id];
                            const isCheckedOut = status?.isCheckedOut;
                            const isCheckedIn = !!status;

                            return (
                                <div key={u.id} className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 p-5 rounded-2xl hover:shadow-md transition-all group relative overflow-hidden shadow-sm flex flex-col h-full">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-white/10">
                                                    {u.photoBase64 ? <img src={u.photoBase64} className="w-full h-full object-cover" /> : <UserIcon size={20} className="text-slate-400" />}
                                                </div>
                                                {isCheckedIn && (
                                                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-4 border-white dark:border-slate-900 ${isCheckedOut ? 'bg-slate-300' : 'bg-emerald-500 animate-pulse'}`}></div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="text-slate-900 dark:text-white font-bold text-lg leading-tight">{u.name || 'Unnamed User'}</div>
                                                <div className="text-slate-400 text-xs truncate max-w-[120px]">{u.email}</div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            {isAdmin && isCheckedOut && (
                                                <button 
                                                    onClick={() => handleUndoCheckout(u.id)} 
                                                    className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-full text-amber-600 hover:bg-amber-100 transition-colors shadow-sm border border-amber-200/50"
                                                    title="Undo Checkout"
                                                >
                                                    <RotateCcw size={14} />
                                                </button>
                                            )}
                                            {!isManager && <button onClick={() => handleEditClick(u)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 hover:text-cyan-600 transition-colors"><Edit size={14} /></button>}
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-3 flex-1 flex flex-col">
                                        <div className="flex gap-2 flex-wrap">
                                            {u.area && <span className="text-[10px] bg-slate-100 dark:bg-slate-950 text-slate-500 px-2 py-1 rounded border border-slate-200 dark:border-white/5">{u.area}</span>}
                                            <span className={`text-[10px] px-2 py-1 rounded border font-bold ${u.role === 'admin' ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600' : u.role === 'manager' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{u.role?.toUpperCase() || 'USER'}</span>
                                        </div>

                                        {/* Status Indicators */}
                                        <div className="bg-slate-50 dark:bg-black/20 rounded-xl p-3 border border-slate-100 dark:border-white/5 space-y-1.5 mt-auto">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Today Status</span>
                                                {isCheckedIn ? (
                                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${isCheckedOut ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                        {isCheckedOut ? 'OFF DUTY' : 'ON DUTY'}
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 italic">IDLE</span>
                                                )}
                                            </div>
                                            {status && status.lastCheckIn && (
                                                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                                    <MapPin size={10} className="text-cyan-500"/>
                                                    <span className="truncate">{status.lastCheckIn.location}</span>
                                                    <span className="opacity-50">•</span>
                                                    <span>{status.lastCheckIn.timestamp.toDate().toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}</span>
                                                </div>
                                            )}
                                        </div>

                                        {!isManager && (
                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                                <button onClick={() => handleToggleStatus(u.id, u.isApproved)} className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 ${u.isApproved !== false ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>{u.isApproved !== false ? <><UserX size={12}/> Suspend</> : <><UserCheck size={12}/> Approve</>}</button>
                                                <select value={u.role || 'user'} onChange={(e) => handleRoleChange(u.id, e.target.value as any)} className="bg-slate-100 dark:bg-slate-800 rounded-lg text-xs text-center py-2 appearance-none outline-none border-0"><option value="user">User</option><option value="manager">Manager</option><option value="admin">Admin</option></select>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {activeTab === 'reports' && (
                <div className="space-y-6">
                    <GlassCard className="p-6 border-slate-200 dark:border-white/5 shadow-sm space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs text-slate-500 font-bold uppercase tracking-wider ml-1">ประเภทรายงาน (Report Type)</label>
                            <div className="relative">
                                <select value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)} className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-cyan-500 appearance-none font-bold">
                                    <option value="activity">Daily Activity Log (เช็คอิน-สรุปวัน)</option>
                                    <option value="performance">Team Performance (รวมข้อมูลแผนงาน)</option>
                                    <option value="pipeline">Sales Pipeline (รวมข้อมูลการขาย)</option>
                                </select>
                                <ChevronDown className="absolute right-4 top-3.5 text-slate-400 pointer-events-none" size={16} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs text-slate-500 font-bold uppercase tracking-wider ml-1">ช่วงวันที่ (Date Range)</label>
                            <div className="flex gap-2">
                                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="flex-1 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white font-bold" />
                                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="flex-1 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white font-bold" />
                            </div>
                        </div>

                        <button onClick={exportToCSV} disabled={loading} className={`w-full px-6 py-4 rounded-2xl font-black text-white shadow-xl transition-all flex items-center justify-center gap-2 active:scale-95 ${loading ? 'bg-slate-400' : 'bg-emerald-500 shadow-emerald-500/20'}`}>{loading ? <Loader2 className="animate-spin" /> : <><Download size={22} /> Export CSV</>}</button>
                    </GlassCard>

                    <div className="space-y-4">
                         <div className="flex items-center justify-between px-2">
                            <h3 className="text-xs text-slate-500 font-black uppercase tracking-[0.2em]">Preview: Recent Activity</h3>
                            {reportType === 'activity' && <FileText size={14} className="text-cyan-500" />}{reportType === 'performance' && <LayoutList size={14} className="text-indigo-500" />}{reportType === 'pipeline' && <TrendingUp size={14} className="text-emerald-500" />}
                         </div>
                         {reportData.length === 0 ? (<div className="py-12 text-center text-slate-400 italic opacity-50 bg-slate-50 dark:bg-slate-900/20 rounded-[32px] border-2 border-dashed border-slate-200">ไม่พบข้อมูลพรีวิวในช่วงเวลานี้</div>) : (
                            <div className="grid grid-cols-1 gap-3">
                                {reportData.slice(0, 5).map((row, i) => (
                                    <div key={i} className="flex items-center justify-between p-5 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 rounded-[28px] shadow-sm"><div className="flex items-center gap-4"><div className={`p-3 rounded-2xl ${row.reportSummary ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-100 text-slate-400'}`}><UserIcon size={18} /></div><div><div className="font-black text-slate-900 dark:text-white text-sm">{row.userName || row.userEmail}</div><div className="text-[10px] text-slate-500 font-bold flex items-center gap-2 mt-1 uppercase"><Calendar size={10} /> {row.date} • {row.checkInCount} Check-ins</div></div></div><ChevronRight size={18} className="text-slate-300" /></div>
                                ))}
                            </div>
                         )}
                    </div>
                </div>
            )}

            {activeTab === 'customers' && (
                <div className="space-y-4">
                     <div className="relative"><Search className="absolute left-4 top-3.5 text-slate-400" size={18} /><input type="text" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Search by name, hospital..." className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-slate-900 dark:text-white shadow-sm" /></div>
                     <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-3xl overflow-hidden shadow-sm">
                        {filteredCustomers.length === 0 ? <div className="p-8 text-center text-slate-400">No customers found.</div> : (
                            <div className="divide-y divide-slate-100 dark:divide-white/5">
                                {filteredCustomers.map((c, idx) => (
                                    <div key={idx} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><UserIcon size={20} /></div><div><div className="font-bold text-slate-900 dark:text-white">{c.name}</div><div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5"><span className="flex items-center gap-1"><Building size={10} className="text-cyan-500" /> {c.hospital}</span><span>•</span><span className="flex items-center gap-1"><Phone size={10} /> {c.phone || 'No phone'}</span></div></div></div><div className="text-xs bg-slate-100 px-3 py-1.5 rounded-full"><span className="text-slate-500">Rep:</span> <span className="font-medium">{c.addedBy}</span></div></div>
                                ))}
                            </div>
                        )}
                     </div>
                </div>
            )}

            {editingUser && !isManager && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4"><GlassCard className="w-full max-w-md border-cyan-500/30 shadow-2xl relative"><button onClick={() => setEditingUser(null)} className="absolute top-4 right-4 text-slate-400 hover:text-rose-500"><X size={20} /></button><h3 className="text-xl font-bold mb-6 text-slate-900 dark:text-white">Edit Profile</h3><div className="space-y-4"><input value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} placeholder="Full Name" className="w-full bg-slate-50 dark:bg-black/30 border rounded-xl p-3 text-slate-900 dark:text-white focus:border-cyan-500" /><input value={editForm.area} onChange={(e) => setEditForm({...editForm, area: e.target.value})} placeholder="Area / Region" className="w-full bg-slate-50 dark:bg-black/30 border rounded-xl p-3 text-slate-900 dark:text-white focus:border-cyan-500" /><input type="date" value={editForm.startDate} onChange={(e) => setEditForm({...editForm, startDate: e.target.value})} className="w-full bg-slate-50 dark:bg-black/30 border rounded-xl p-3 text-slate-900 dark:text-white focus:border-cyan-500" /><div className="space-y-2"><label className="text-xs text-slate-400 uppercase tracking-wider">Reports To</label><select value={editForm.reportsTo} onChange={(e) => setEditForm({...editForm, reportsTo: e.target.value})} className="w-full bg-slate-50 dark:bg-black/30 border rounded-xl p-3 text-slate-900 dark:text-white"><option value="">-- Select Manager --</option>{potentialManagers.map(m => (<option key={m.id} value={m.id}>{m.name || m.email}</option>))}</select></div><button onClick={handleSaveUser} className="w-full bg-cyan-600 py-3 rounded-xl font-bold text-white shadow-lg">Save Changes</button></div></GlassCard></div>
            )}
            
            {showAddUser && !isManager && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
                    <GlassCard className="w-full max-w-md border-emerald-500/30 shadow-2xl relative">
                        <button onClick={() => setShowAddUser(false)} className="absolute top-4 right-4 text-slate-400 hover:text-rose-500"><X size={20} /></button>
                        <h3 className="text-xl font-bold mb-6 text-slate-900 dark:text-white">Add New User</h3>
                        <div className="space-y-4">
                            <input type="email" value={addUserForm.email} onChange={(e) => setAddUserForm({...addUserForm, email: e.target.value})} placeholder="User Email" className="w-full bg-slate-50 dark:bg-black/30 border rounded-xl p-3 text-slate-900 dark:text-white focus:border-emerald-500" />
                            <input type="password" value={addUserForm.password} onChange={(e) => setAddUserForm({...addUserForm, password: e.target.value})} placeholder="Temporary Password" className="w-full bg-slate-50 dark:bg-black/30 border rounded-xl p-3 text-slate-900 dark:text-white focus:border-emerald-500" />
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400 uppercase tracking-wider">Manager</label>
                                <select value={addUserForm.reportsTo} onChange={(e) => setAddUserForm({...addUserForm, reportsTo: e.target.value})} className="w-full bg-slate-50 dark:bg-black/30 border rounded-xl p-3 text-slate-900 dark:text-white">
                                    <option value="">-- Select Manager --</option>
                                    {potentialManagers.map(m => (<option key={m.id} value={m.id}>{m.name || m.email}</option>))}
                                </select>
                            </div>
                            {addUserError && <p className="text-rose-500 text-xs font-bold">{addUserError}</p>}
                            <button onClick={handleAddUserSubmit} disabled={addUserLoading} className="w-full bg-emerald-600 py-3 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2">
                                {addUserLoading ? <Loader2 className="animate-spin" /> : 'Create User'}
                            </button>
                        </div>
                    </GlassCard>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;
