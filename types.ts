
import { Timestamp } from 'firebase/firestore';

export interface Customer {
    hospital: string;
    name: string;
    department: string;
    phone: string;
}

export interface PipelineData {
    id?: string; 
    product: string;
    stage: string;
    value: number;
    probability: number; 
    lastUpdated?: string; 
    isNew?: boolean; 
    customerName?: string; 
    expectedCloseDate?: string; 
}

export interface Reminder {
    id: string;
    title: string;
    description?: string;
    dueTime: string; 
    type: 'check-in' | 'follow-up' | 'task';
    isCompleted: boolean;
    notified?: boolean;
    createdAt: string;
}

export interface WorkPlan {
    id: string;
    userId: string;
    userName: string;
    date: string; // YYYY-MM-DD
    title: string;
    content: string;
    itinerary: { location: string; objective: string }[];
    createdAt: string;
    status?: 'draft' | 'pending' | 'approved' | 'rejected';
}

export interface UserProfile {
    email: string;
    name?: string;         
    area?: string;         
    startDate?: string;
    photoBase64?: string;
    lastLogin?: Timestamp;
    hospitals: string[];
    customers: Customer[];
    role?: 'admin' | 'manager' | 'user'; 
    isApproved?: boolean;
    reportsTo?: string;
    activePipeline?: PipelineData[];
    xp?: number;
    level?: number;
    currentStreak?: number;
    lastActiveDate?: string;
    lastRewardClaimedMonth?: string;
    aiApiKey?: string; // New field for Gemini API Key management
}

export interface CheckInRecord {
    location: string;
    timestamp: Timestamp;
    latitude: number;
    longitude: number;
}
export interface Interaction {
    customerName: string;
    department?: string;
    summary: string;
    pipeline?: PipelineData;
}
export interface VisitReport {
    location: string;
    checkInTime: Timestamp;
    summary: string;
    metWith: string[];
    pipeline: PipelineData[];
    interactions?: Interaction[];
    latitude?: number;
    longitude?: number;
}
export interface DailyReport {
    summary?: string; 
    metWith?: string[] | string;
    // Fix: Changed pipeline from recursive union to PipelineData[]
    pipeline?: PipelineData[];
    visits?: VisitReport[];
}
export interface AttendanceDay {
    id: string; 
    checkIns: CheckInRecord[];
    checkOut?: Timestamp;
    report?: DailyReport;
}
export interface UserLocationData {
    userId: string;
    email: string;
    name?: string;
    photoBase64?: string;
    lastCheckIn: CheckInRecord | null;
    isCheckedOut?: boolean;
}
export interface AdminUser extends UserProfile {
    id: string;
}
export interface ActivityLog {
    id: string;
    userId: string;
    userName: string;
    type: 'check-in' | 'check-out' | 'work-plan-submitted';
    location: string;
    timestamp: Timestamp;
}

export interface PostComment {
    id: string;
    userId: string;
    userName: string;
    userPhoto?: string;
    text: string;
    timestamp: Timestamp;
}

export interface ActivityPost {
    id: string;
    userId: string;
    userName: string;
    userPhoto?: string;
    imageUrls: string[];
    caption: string;
    location?: string;
    likes: string[]; // User IDs
    comments: PostComment[];
    timestamp: Timestamp;
}
