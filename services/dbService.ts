
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
    documentId
} from 'firebase/firestore';
import { UserProfile, AttendanceDay, CheckInRecord, Customer, DailyReport, AdminUser, PipelineData, UserLocationData, VisitReport } from '../types';

// Helpers to build paths
const getUserRef = (userId: string) => doc(db, `artifacts/${APP_ARTIFACT_ID}/users/${userId}`);
const getAttendanceRef = (userId: string, dateId: string) => doc(db, `artifacts/${APP_ARTIFACT_ID}/users/${userId}/attendance/${dateId}`);

export const getTodayDateId = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
};

// User Profile
export const initializeUser = async (userId: string, email: string) => {
    const userRef = getUserRef(userId);
    const snap = await getDoc(userRef);
    
    if (!snap.exists()) {
        const initialProfile: UserProfile = {
            email,
            lastLogin: Timestamp.now(),
            hospitals: ["โรงพยาบาลทั่วไป", "โรงพยาบาลศูนย์"],
            customers: [],
            role: 'user',
            isApproved: false, // Default to pending for new users
            activePipeline: [],
            reportsTo: '',
            // Gamification Defaults
            xp: 0,
            level: 1,
            currentStreak: 0,
            lastActiveDate: ''
        };
        await setDoc(userRef, initialProfile);
    } else {
        await updateDoc(userRef, { lastLogin: Timestamp.now() });
    }
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
    const snap = await getDoc(getUserRef(userId));
    return snap.exists() ? snap.data() as UserProfile : null;
};

export const updateUserProfile = async (userId: string, data: Partial<UserProfile>) => {
    await updateDoc(getUserRef(userId), data);
};

export const addHospital = async (userId: string, hospital: string) => {
    await updateDoc(getUserRef(userId), {
        hospitals: arrayUnion(hospital)
    });
};

export const addCustomer = async (userId: string, customer: Customer) => {
    await updateDoc(getUserRef(userId), {
        customers: arrayUnion(customer)
    });
};

// --- GAMIFICATION LOGIC ---
const calculateLevel = (xp: number) => {
    // Simple formula: Level = sqrt(XP / 100) + 1
    if (xp < 100) return 1;
    if (xp < 400) return 2;
    if (xp < 900) return 3;
    if (xp < 1600) return 4;
    if (xp < 2500) return 5;
    if (xp < 3600) return 6;
    if (xp < 4900) return 7;
    if (xp < 6400) return 8;
    if (xp < 8100) return 9;
    return 10; // Max level cap for now
};

export const checkIn = async (userId: string, location: string, lat: number, lng: number): Promise<{ earnedXp: number, isLevelUp: boolean, newLevel: number }> => {
    const today = getTodayDateId();
    const attRef = getAttendanceRef(userId, today);
    const userRef = getUserRef(userId);
    
    // 1. Record Attendance
    const record: CheckInRecord = {
        location,
        timestamp: Timestamp.now(),
        latitude: lat,
        longitude: lng
    };

    const attSnap = await getDoc(attRef);
    let isFirstCheckInToday = false;

    if (attSnap.exists()) {
        await updateDoc(attRef, {
            checkIns: arrayUnion(record)
        });
    } else {
        isFirstCheckInToday = true;
        const newDay: AttendanceDay = {
            id: today,
            checkIns: [record]
        };
        await setDoc(attRef, newDay);
    }

    // 2. Calculate XP & Gamification
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data() as UserProfile;
    
    let currentXp = userData.xp || 0;
    let currentLevel = userData.level || 1;
    let currentStreak = userData.currentStreak || 0;
    const lastActive = userData.lastActiveDate || '';

    let earnedXp = 0;

    if (isFirstCheckInToday) {
        let dailyXp = 15;
        const hour = new Date().getHours();
        if (hour < 9) {
            dailyXp += 35; 
        }

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (lastActive === yesterdayStr) {
            currentStreak += 1;
            dailyXp += Math.min(currentStreak * 5, 50);
        } else if (lastActive !== today) {
            currentStreak = 1;
        }

        earnedXp = dailyXp;
    } else {
        earnedXp = 5; 
    }

    const newXp = currentXp + earnedXp;
    const newLevel = calculateLevel(newXp);
    const isLevelUp = newLevel > currentLevel;

    await updateDoc(userRef, {
        xp: newXp,
        level: newLevel,
        currentStreak: currentStreak,
        lastActiveDate: today
    });

    return { earnedXp, isLevelUp, newLevel };
};

export const checkOut = async (userId: string, reportData: DailyReport) => {
    const today = getTodayDateId();
    const attRef = getAttendanceRef(userId, today);
    const userRef = getUserRef(userId);
    
    // 1. Consolidate ALL Pipeline Items from ALL visits
    let allNewPipelineItems: PipelineData[] = [];
    if (reportData.visits) {
        reportData.visits.forEach(visit => {
            if (visit.pipeline) {
                allNewPipelineItems = [...allNewPipelineItems, ...visit.pipeline];
            }
        });
    }

    // 2. Process Pipeline Logic (Smart Continuity)
    // We need to merge these items into the User's "activePipeline"
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data() as UserProfile;
    let activePipeline = userData.activePipeline || [];

    allNewPipelineItems.forEach(item => {
        // If no ID (New Deal), generate one
        const finalItem = { ...item };
        if (!finalItem.id) {
            finalItem.id = crypto.randomUUID();
            finalItem.isNew = true; // Mark as originally new for this report
        }
        finalItem.lastUpdated = new Date().toISOString();
        
        // Update Active Pipeline List
        const existingIdx = activePipeline.findIndex(p => p.id === finalItem.id);
        if (existingIdx >= 0) {
            // Update existing deal
            activePipeline[existingIdx] = finalItem;
        } else {
            // Add new deal
            activePipeline.push(finalItem);
        }
    });

    // 3. Update User Profile with new Active Pipeline state
    await updateDoc(userRef, {
        activePipeline: activePipeline
    });

    // 4. Save Attendance Report (History)
    const updateData: any = {
        checkOut: Timestamp.now(),
        report: reportData
    };

    await updateDoc(attRef, updateData);
};

export const updatePipelineItem = async (userId: string, dateId: string, updatedPipeline: PipelineData[]) => {
    // Note: Deep update for specific visit is complex in Firestore without reading whole doc.
    // For now, this function might need to be adapted if used for editing past reports.
    // We will disable editing pipeline in the simple view for this iteration or handle it later.
};

export const getTodayAttendance = async (userId: string): Promise<AttendanceDay | null> => {
    const today = getTodayDateId();
    const snap = await getDoc(getAttendanceRef(userId, today));
    return snap.exists() ? snap.data() as AttendanceDay : null;
};

export const getUserHistory = async (userId: string): Promise<AttendanceDay[]> => {
    try {
        const attColRef = collection(db, `artifacts/${APP_ARTIFACT_ID}/users/${userId}/attendance`);
        const q = query(attColRef); 
        const snap = await getDocs(q);
        const results = snap.docs.map(d => d.data() as AttendanceDay);
        return results.sort((a, b) => b.id.localeCompare(a.id));
    } catch (e) {
        return [];
    }
};

// Admin Functions

export const getAllUsers = async (): Promise<AdminUser[]> => {
    try {
        const usersSnap = await getDocs(collection(db, `artifacts/${APP_ARTIFACT_ID}/users`));
        return usersSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data() as UserProfile
        }));
    } catch (e) {
        return [];
    }
};

export const getTeamMembers = async (managerId: string): Promise<AdminUser[]> => {
    try {
        // Fetch all users then filter (Firestore strict queries might need composite indexes)
        // For small teams, client-side filtering is efficient enough and safer without index setup
        const allUsers = await getAllUsers();
        return allUsers.filter(u => u.reportsTo === managerId || u.id === managerId);
    } catch (e) {
        return [];
    }
};

export const getAllGlobalCustomers = async (): Promise<Array<Customer & { addedBy: string, userId: string }>> => {
    try {
        const users = await getAllUsers();
        const allCustomers: Array<Customer & { addedBy: string, userId: string }> = [];
        
        users.forEach(user => {
            if (user.customers && Array.isArray(user.customers)) {
                user.customers.forEach(c => {
                    allCustomers.push({
                        ...c,
                        addedBy: user.name || user.email,
                        userId: user.id
                    });
                });
            }
        });
        
        return allCustomers.sort((a, b) => a.hospital.localeCompare(b.hospital));
    } catch (e) {
        console.error("Error fetching all customers:", e);
        return [];
    }
};

export const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    await updateDoc(getUserRef(userId), { isApproved: !currentStatus });
};

export const updateUserRole = async (userId: string, newRole: 'admin' | 'manager' | 'user') => {
    await updateDoc(getUserRef(userId), { role: newRole });
};

export const adminCreateUser = async (email: string, pass: string, reportsTo?: string) => {
    const secondaryApp = initializeApp(firebaseConfig, "Secondary");
    const secondaryAuth = getAuth(secondaryApp);
    try {
        const cred = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
        await initializeUser(cred.user.uid, email);
        await updateDoc(getUserRef(cred.user.uid), { 
            isApproved: true,
            reportsTo: reportsTo || '' 
        });
        await signOut(secondaryAuth);
        await deleteApp(secondaryApp);
    } catch (e) {
        await deleteApp(secondaryApp);
        throw e;
    }
};

export const getAllUsersTodayLocations = async (): Promise<UserLocationData[]> => {
    try {
        const usersSnap = await getDocs(collection(db, `artifacts/${APP_ARTIFACT_ID}/users`));
        const results: UserLocationData[] = [];
        const today = getTodayDateId();

        for (const userDoc of usersSnap.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data() as UserProfile;
            const attSnap = await getDoc(getAttendanceRef(userId, today));
            if (attSnap.exists()) {
                const attData = attSnap.data() as AttendanceDay;
                if (attData.checkIns && attData.checkIns.length > 0) {
                    const latest = attData.checkIns[attData.checkIns.length - 1];
                    results.push({
                        userId,
                        email: userData.email,
                        name: userData.name,
                        photoBase64: userData.photoBase64,
                        lastCheckIn: latest,
                        isCheckedOut: !!attData.checkOut
                    });
                }
            }
        }
        return results;
    } catch (e) {
        return [];
    }
};

export const getGlobalDailyReport = async (dateId: string): Promise<any[]> => {
    return getGlobalReportRange(dateId, dateId);
};

export const getGlobalReportRange = async (startDate: string, endDate: string): Promise<any[]> => {
    try {
        const usersSnap = await getDocs(collection(db, `artifacts/${APP_ARTIFACT_ID}/users`));
        const reportData: any[] = [];

        for (const userDoc of usersSnap.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data() as UserProfile;
            const attColRef = collection(db, `artifacts/${APP_ARTIFACT_ID}/users/${userId}/attendance`);
            const q = query(
                attColRef, 
                where(documentId(), '>=', startDate), 
                where(documentId(), '<=', endDate)
            );
            const attSnaps = await getDocs(q);

            attSnaps.forEach(attSnap => {
                 const attData = attSnap.data() as AttendanceDay;
                
                // Logic to flatten report based on Visits
                if (attData.report && attData.report.visits && attData.report.visits.length > 0) {
                    // New Structure: Multiple rows per day if multiple visits
                    attData.report.visits.forEach((visit) => {
                        let pipelineStr = '';
                        if (visit.pipeline) {
                            pipelineStr = visit.pipeline.map(p => `${p.product} (${p.stage})`).join(' | ');
                        }
                        let metWithStr = visit.metWith ? visit.metWith.join(', ') : '';

                        reportData.push({
                            userEmail: userData.email,
                            userName: userData.name || userData.email.split('@')[0],
                            date: attData.id, 
                            checkInTime: visit.checkInTime ? visit.checkInTime.toDate().toLocaleTimeString('th-TH') : '-',
                            checkOutTime: attData.checkOut?.toDate().toLocaleTimeString('th-TH') || '-',
                            locations: visit.location, // Specific location
                            checkInCount: 1, // Per row
                            hospitalCount: 1,
                            reportSummary: visit.summary || '',
                            metWith: metWithStr,
                            pipeline: pipelineStr
                        });
                    });
                } else {
                    // Fallback for old data structure
                    const checkInCount = attData.checkIns.length;
                    const locationNames = attData.checkIns.map(c => c.location);
                    const uniqueLocations = new Set(locationNames).size;

                    let metWithStr = '';
                    if (Array.isArray(attData.report?.metWith)) {
                        metWithStr = attData.report.metWith.join(' | ');
                    } else if (typeof attData.report?.metWith === 'string') {
                        metWithStr = attData.report.metWith;
                    }

                    let pipelineStr = '';
                    if (Array.isArray(attData.report?.pipeline)) {
                        pipelineStr = attData.report.pipeline.map(p => `${p.product} (${p.stage})`).join(' | ');
                    }

                    reportData.push({
                        userEmail: userData.email,
                        userName: userData.name || userData.email.split('@')[0],
                        date: attData.id, 
                        checkInTime: attData.checkIns[0]?.timestamp.toDate().toLocaleTimeString('th-TH') || '-',
                        checkOutTime: attData.checkOut?.toDate().toLocaleTimeString('th-TH') || '-',
                        locations: locationNames.join(', '),
                        checkInCount: checkInCount,
                        hospitalCount: uniqueLocations,
                        reportSummary: attData.report?.summary || '',
                        metWith: metWithStr,
                        pipeline: pipelineStr
                    });
                }
            });
        }
        return reportData.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.userEmail.localeCompare(b.userEmail);
        });
    } catch (e) {
        return [];
    }
};
