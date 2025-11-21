import { Timestamp } from 'firebase/firestore';

export interface Customer {
    hospital: string;
    name: string;
    department: string;
    phone: string;
}

export interface PipelineData {
    id?: string; // Unique ID for the deal
    product: string;
    stage: string;
    value: number;
    probability: number; // 0-100
    lastUpdated?: string; // ISO Date
    isNew?: boolean; // UI helper
}

export interface UserProfile {
    email: string;
    name?: string;         
    area?: string;         
    startDate?: string;    
    lastLogin?: Timestamp;
    hospitals: string[];
    customers: Customer[];
    role?: 'admin' | 'manager' | 'user'; 
    isApproved?: boolean;
    reportsTo?: string; // UID of the manager this user reports to
    
    // Smart Pipeline Memory
    activePipeline?: PipelineData[];

    // Gamification Fields
    xp?: number;
    level?: number;
    currentStreak?: number;
    lastActiveDate?: string; // YYYY-MM-DD to track daily streaks
}

export interface CheckInRecord {
    location: string;
    timestamp: Timestamp;
    latitude: number;
    longitude: number;
}

export interface DailyReport {
    summary: string;
    metWith: string[]; // Changed to array for multiple contacts
    hospital: string;
    pipeline?: PipelineData[]; // Changed to array for multiple opportunities
}

export interface AttendanceDay {
    id: string; // YYYY-MM-DD
    checkIns: CheckInRecord[];
    checkOut?: Timestamp;
    report?: DailyReport;
}

// For Admin Dashboard
export interface UserLocationData {
    userId: string;
    email: string;
    lastCheckIn: CheckInRecord | null;
}

// For Admin User Management
export interface AdminUser extends UserProfile {
    id: string;
}