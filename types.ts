
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
    pipeline?: PipelineData[] | PipelineData;
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
