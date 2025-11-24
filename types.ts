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
    customerName?: string; // Link deal to a specific person/customer
    expectedCloseDate?: string; // NEW: YYYY-MM-DD
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
    
    // Smart Pipeline Memory
    activePipeline?: PipelineData[];

    // Gamification Fields
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

// NEW: Granular Report per Visit
export interface VisitReport {
    location: string;
    checkInTime: Timestamp;
    summary: string;
    metWith: string[];
    pipeline: PipelineData[];
}

export interface DailyReport {
    // Optional legacy fields for backward compatibility
    summary?: string; 
    metWith?: string[] | string;
    pipeline?: PipelineData[] | PipelineData;

    // New Structure: Array of specific visits matches checkIns
    visits?: VisitReport[];
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
    name?: string;
    photoBase64?: string;
    lastCheckIn: CheckInRecord | null;
    isCheckedOut?: boolean;
}

// For Admin User Management
export interface AdminUser extends UserProfile {
    id: string;
}