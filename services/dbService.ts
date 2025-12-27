
import { db, APP_ARTIFACT_ID, firebaseConfig } from '../firebaseConfig';
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc, 
    arrayUnion, 
    collection, 
    query, 
    where, 
    getDocs, 
    Timestamp,
    orderBy,
    documentId,
    deleteDoc
} from 'firebase/firestore';
import { UserProfile, AttendanceDay, CheckInRecord, Customer, DailyReport, AdminUser, PipelineData, UserLocationData, VisitReport, Reminder } from '../types';

// Helpers to build paths
const getUserRef = (userId: string) => doc(db, `artifacts/${APP_ARTIFACT_ID}/users/${userId}`);
const getAttendanceRef = (userId: string, dateId: string) => doc(db, `artifacts/${APP_ARTIFACT_ID}/users/${userId}/attendance/${dateId}`);
const getRemindersCol = (userId: string) => collection(db, `artifacts/${APP_ARTIFACT_ID}/users/${userId}/reminders`);

export const getTodayDateId = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
};

export const initializeUser = async (userId: string, email: string) => {
    const userRef = getUserRef(userId);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
        const initialProfile: UserProfile = {
            email, lastLogin: Timestamp.now(), hospitals: ["โรงพยาบาลทั่วไป", "โรงพยาบาลศูนย์"], customers: [], role: 'user', isApproved: false, activePipeline: [], reportsTo: '', xp: 0, level: 1, currentStreak: 0, lastActiveDate: ''
        };
        await setDoc(userRef, initialProfile);
    } else { await updateDoc(userRef, { lastLogin: Timestamp.now() }); }
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => { const snap = await getDoc(getUserRef(userId)); return snap.exists() ? snap.data() as UserProfile : null; };
export const updateUserProfile = async (userId: string, data: Partial<UserProfile>) => { await updateDoc(getUserRef(userId), data); };
export const addHospital = async (userId: string, hospital: string) => { await updateDoc(getUserRef(userId), { hospitals: arrayUnion(hospital) }); };
export const addCustomer = async (userId: string, customer: Customer) => { await updateDoc(getUserRef(userId), { customers: arrayUnion(customer) }); };

// Reminders CRUD
export const getReminders = async (userId: string): Promise<Reminder[]> => {
    try {
        const q = query(getRemindersCol(userId), orderBy('dueTime', 'asc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as Reminder));
    } catch (e) {
        console.error("Failed to fetch reminders", e);
        return [];
    }
};

export const addReminder = async (userId: string, reminder: Omit<Reminder, 'id'>) => {
    const ref = doc(getRemindersCol(userId));
    await setDoc(ref, { ...reminder, notified: false });
    return ref.id;
};

export const updateReminderStatus = async (userId: string, reminderId: string, isCompleted: boolean) => {
    const ref = doc(db, `artifacts/${APP_ARTIFACT_ID}/users/${userId}/reminders/${reminderId}`);
    await updateDoc(ref, { isCompleted });
};

export const markReminderAsNotified = async (userId: string, reminderId: string) => {
    const ref = doc(db, `artifacts/${APP_ARTIFACT_ID}/users/${userId}/reminders/${reminderId}`);
    await updateDoc(ref, { notified: true });
};

export const deleteReminder = async (userId: string, reminderId: string) => {
    const ref = doc(db, `artifacts/${APP_ARTIFACT_ID}/users/${userId}/reminders/${reminderId}`);
    await deleteDoc(ref);
};

const calculateLevel = (xp: number) => { if (xp < 100) return 1; if (xp < 400) return 2; if (xp < 900) return 3; if (xp < 1600) return 4; if (xp < 2500) return 5; if (xp < 3600) return 6; if (xp < 4900) return 7; if (xp < 6400) return 8; if (xp < 8100) return 9; return 10; };

export const checkIn = async (userId: string, location: string, lat: number, lng: number): Promise<{ earnedXp: number, isLevelUp: boolean, newLevel: number }> => {
    const today = getTodayDateId(); const attRef = getAttendanceRef(userId, today); const userRef = getUserRef(userId); const record: CheckInRecord = { location, timestamp: Timestamp.now(), latitude: lat, longitude: lng };
    const attSnap = await getDoc(attRef); let isFirstCheckInToday = false;
    if (attSnap.exists()) { await updateDoc(attRef, { checkIns: arrayUnion(record) }); } else { isFirstCheckInToday = true; const newDay: AttendanceDay = { id: today, checkIns: [record] }; await setDoc(attRef, newDay); }
    const userSnap = await getDoc(userRef); const userData = userSnap.data() as UserProfile;
    let currentXp = userData.xp || 0; let currentLevel = userData.level || 1; let currentStreak = userData.currentStreak || 0; const lastActive = userData.lastActiveDate || '';
    let earnedXp = isFirstCheckInToday ? (new Date().getHours() < 9 ? 50 : 15) : 5;
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); const yesterdayStr = yesterday.toISOString().split('T')[0];
    if (isFirstCheckInToday && lastActive === yesterdayStr) { currentStreak += 1; earnedXp += Math.min(currentStreak * 5, 50); } else if (isFirstCheckInToday && lastActive !== today) { currentStreak = 1; }
    const newXp = currentXp + earnedXp; const newLevel = calculateLevel(newXp);
    await updateDoc(userRef, { xp: newXp, level: newLevel, currentStreak: currentStreak, lastActiveDate: today });
    return { earnedXp, isLevelUp: newLevel > currentLevel, newLevel };
};

export const checkOut = async (userId: string, reportData: DailyReport) => {
    const today = getTodayDateId(); const attRef = getAttendanceRef(userId, today); const userRef = getUserRef(userId);
    let allNewPipelineItems: PipelineData[] = [];
    if (reportData.visits) { reportData.visits.forEach(visit => { if (visit.pipeline) { allNewPipelineItems = [...allNewPipelineItems, ...visit.pipeline]; } }); }
    const userSnap = await getDoc(userRef); const userData = userSnap.data() as UserProfile; let activePipeline = userData.activePipeline || [];
    allNewPipelineItems.forEach(item => { const finalItem = { ...item }; if (!finalItem.id) { finalItem.id = crypto.randomUUID(); finalItem.isNew = true; } finalItem.lastUpdated = new Date().toISOString(); const existingIdx = activePipeline.findIndex(p => p.id === finalItem.id); if (existingIdx >= 0) { activePipeline[existingIdx] = finalItem; } else { activePipeline.push(finalItem); } });
    await updateDoc(userRef, { activePipeline: activePipeline });
    await updateDoc(attRef, { checkOut: Timestamp.now(), report: reportData });
};

export const updateOpportunity = async (
    userId: string, 
    dateId: string, 
    location: { visitIdx?: number, interactionIdx?: number, legacyIdx?: number }, 
    updatedData: PipelineData | null // null = delete
) => {
    const attRef = getAttendanceRef(userId, dateId);
    const attSnap = await getDoc(attRef);
    
    if (!attSnap.exists()) return;
    
    const attData = attSnap.data() as AttendanceDay;
    const report = attData.report;
    if (!report) return;

    let targetId: string | undefined;

    if (location.visitIdx !== undefined && location.interactionIdx !== undefined) {
        if (report.visits && report.visits[location.visitIdx]) {
            const visit = report.visits[location.visitIdx];
            if (visit.interactions && visit.interactions[location.interactionIdx]) {
                const interaction = visit.interactions[location.interactionIdx];
                if (interaction.pipeline) targetId = interaction.pipeline.id;

                if (updatedData === null) {
                    delete interaction.pipeline;
                } else {
                    interaction.pipeline = updatedData;
                    targetId = updatedData.id;
                }
            }
        }
    }
    else if (location.visitIdx !== undefined && location.legacyIdx !== undefined) {
         if (report.visits && report.visits[location.visitIdx]) {
            const visit = report.visits[location.visitIdx];
            if (visit.pipeline && visit.pipeline[location.legacyIdx]) {
                targetId = visit.pipeline[location.legacyIdx].id;
                if (updatedData === null) {
                    visit.pipeline.splice(location.legacyIdx, 1);
                } else {
                    visit.pipeline[location.legacyIdx] = updatedData;
                    targetId = updatedData.id;
                }
            }
         }
    }
    else if (location.legacyIdx !== undefined) {
        let pipelines = Array.isArray(report.pipeline) ? report.pipeline : (report.pipeline ? [report.pipeline] : []);
        if (pipelines[location.legacyIdx]) {
            targetId = pipelines[location.legacyIdx].id;
            if (updatedData === null) {
                pipelines.splice(location.legacyIdx, 1);
            } else {
                pipelines[location.legacyIdx] = updatedData;
                targetId = updatedData.id;
            }
            report.pipeline = pipelines;
        }
    }

    await updateDoc(attRef, { report });
    
    if (targetId) {
        const userRef = getUserRef(userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const userData = userSnap.data() as UserProfile;
            let activePipeline = userData.activePipeline || [];
            
            const idx = activePipeline.findIndex(p => p.id === targetId);
            
            if (updatedData === null) {
                 if (idx !== -1) activePipeline.splice(idx, 1);
            } else {
                 if (idx !== -1) activePipeline[idx] = updatedData;
            }
            await updateDoc(userRef, { activePipeline });
        }
    }
};

export const getTodayAttendance = async (userId: string): Promise<AttendanceDay | null> => { const today = getTodayDateId(); const snap = await getDoc(getAttendanceRef(userId, today)); return snap.exists() ? snap.data() as AttendanceDay : null; };
export const getUserHistory = async (userId: string): Promise<AttendanceDay[]> => { try { const attColRef = collection(db, `artifacts/${APP_ARTIFACT_ID}/users/${userId}/attendance`); const q = query(attColRef); const snap = await getDocs(q); const results = snap.docs.map(d => d.data() as AttendanceDay); return results.sort((a, b) => b.id.localeCompare(a.id)); } catch (e) { return []; } };
export const getAllUsers = async (): Promise<AdminUser[]> => { try { const usersSnap = await getDocs(collection(db, `artifacts/${APP_ARTIFACT_ID}/users`)); return usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as UserProfile })); } catch (e) { return []; } };
export const getTeamMembers = async (managerId: string): Promise<AdminUser[]> => { try { const allUsers = await getAllUsers(); return allUsers.filter(u => u.reportsTo === managerId || u.id === managerId); } catch (e) { return []; } };
export const getAllGlobalCustomers = async (): Promise<Array<Customer & { addedBy: string, userId: string }>> => { try { const users = await getAllUsers(); const allCustomers: Array<Customer & { addedBy: string, userId: string }> = []; users.forEach(user => { if (user.customers && Array.isArray(user.customers)) { user.customers.forEach(c => { allCustomers.push({ ...c, addedBy: user.name || user.email, userId: user.id }); }); } }); return allCustomers.sort((a, b) => a.hospital.localeCompare(b.hospital)); } catch (e) { return []; } };
export const toggleUserStatus = async (userId: string, currentStatus: boolean) => { await updateDoc(getUserRef(userId), { isApproved: !currentStatus }); };
export const updateUserRole = async (userId: string, newRole: 'admin' | 'manager' | 'user') => { await updateDoc(getUserRef(userId), { role: newRole }); };
export const adminCreateUser = async (email: string, pass: string, reportsTo?: string) => { const secondaryApp = initializeApp(firebaseConfig, "Secondary"); const secondaryAuth = getAuth(secondaryApp); try { const cred = await createUserWithEmailAndPassword(secondaryAuth, email, pass); await initializeUser(cred.user.uid, email); await updateDoc(getUserRef(cred.user.uid), { isApproved: true, reportsTo: reportsTo || '' }); await signOut(secondaryAuth); await deleteApp(secondaryApp); } catch (e) { await deleteApp(secondaryApp); throw e; } };
export const getAllUsersTodayLocations = async (): Promise<UserLocationData[]> => { try { const usersSnap = await getDocs(collection(db, `artifacts/${APP_ARTIFACT_ID}/users`)); const results: UserLocationData[] = []; const today = getTodayDateId(); for (const userDoc of usersSnap.docs) { const userId = userDoc.id; const userData = userDoc.data() as UserProfile; const attSnap = await getDoc(getAttendanceRef(userId, today)); if (attSnap.exists()) { const attData = attSnap.data() as AttendanceDay; if (attData.checkIns && attData.checkIns.length > 0) { const latest = attData.checkIns[attData.checkIns.length - 1]; results.push({ userId, email: userData.email, name: userData.name, photoBase64: userData.photoBase64, lastCheckIn: latest, isCheckedOut: !!attData.checkOut }); } } } return results; } catch (e) { return []; } };
export const updatePipelineItem = async () => { /* Legacy placeholder */ };
export const getGlobalReportRange = async (startDate: string, endDate: string): Promise<any[]> => { try { const usersSnap = await getDocs(collection(db, `artifacts/${APP_ARTIFACT_ID}/users`)); const reportData: any[] = []; for (const userDoc of usersSnap.docs) { const userId = userDoc.id; const userData = userDoc.data() as UserProfile; const attColRef = collection(db, `artifacts/${APP_ARTIFACT_ID}/users/${userId}/attendance`); const q = query(attColRef, where(documentId(), '>=', startDate), where(documentId(), '<=', endDate)); const attSnaps = await getDocs(q); attSnaps.forEach(attSnap => { const attData = attSnap.data() as AttendanceDay; if (attData.report && attData.report.visits && attData.report.visits.length > 0) { attData.report.visits.forEach((visit) => { let pipelineStr = ''; if (visit.pipeline) { pipelineStr = visit.pipeline.map(p => `${p.product} (${p.stage})`).join(' | '); } let metWithStr = visit.metWith ? visit.metWith.join(', ') : ''; reportData.push({ userEmail: userData.email, userName: userData.name || userData.email.split('@')[0], date: attData.id, checkInTime: visit.checkInTime ? visit.checkInTime.toDate().toLocaleTimeString('th-TH') : '-', checkOutTime: attData.checkOut?.toDate().toLocaleTimeString('th-TH') || '-', locations: visit.location, checkInCount: 1, hospitalCount: 1, reportSummary: visit.summary || '', metWith: metWithStr, pipeline: pipelineStr }); }); } else { const checkInCount = attData.checkIns.length; const locationNames = attData.checkIns.map(c => c.location); const uniqueLocations = new Set(locationNames).size; let metWithStr = ''; if (Array.isArray(attData.report?.metWith)) { metWithStr = attData.report.metWith.join(' | '); } else if (typeof attData.report?.metWith === 'string') { metWithStr = attData.report.metWith; } let pipelineStr = ''; if (Array.isArray(attData.report?.pipeline)) { pipelineStr = attData.report.pipeline.map(p => `${p.product} (${p.stage})`).join(' | '); } reportData.push({ userEmail: userData.email, userName: userData.name || userData.email.split('@')[0], date: attData.id, checkInTime: attData.checkIns[0]?.timestamp.toDate().toLocaleTimeString('th-TH') || '-', checkOutTime: attData.checkOut?.toDate().toLocaleTimeString('th-TH') || '-', locations: locationNames.join(', '), checkInCount: checkInCount, hospitalCount: uniqueLocations, reportSummary: attData.report?.summary || '', metWith: metWithStr, pipeline: pipelineStr }); } }); } return reportData.sort((a, b) => { if (a.date !== b.date) return a.date.localeCompare(b.date); return a.userEmail.localeCompare(b.userEmail); }); } catch (e) { return []; } };
