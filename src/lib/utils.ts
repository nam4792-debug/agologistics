import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

export function formatNumber(num: number): string {
    return new Intl.NumberFormat('en-US').format(num);
}

export function formatWeight(kg: number | string | null | undefined): string {
    const value = Number(kg);
    if (isNaN(value) || kg === null || kg === undefined) return '0kg';
    if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}T`;
    }
    return `${value.toFixed(1)}kg`;
}

export function formatDate(date: Date | string | null | undefined): string {
    if (!date) return 'Not set';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'Not set';
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

export function formatDateTime(date: Date | string | null | undefined): string {
    if (!date) return 'Not set';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'Not set';
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function getStatusColor(status: string): string {
    const statusColors: Record<string, string> = {
        draft: 'status-draft',
        pending: 'status-warning',
        active: 'status-active',
        in_progress: 'status-info',
        completed: 'status-success',
        cancelled: 'status-error',
        delayed: 'status-error',
        on_time: 'status-success',
    };
    return statusColors[status.toLowerCase()] || 'status-draft';
}

export function getGradeColor(grade: string): string {
    const gradeColors: Record<string, string> = {
        A: 'grade-a',
        B: 'grade-b',
        C: 'grade-c',
        D: 'grade-d',
        F: 'grade-f',
    };
    return gradeColors[grade.toUpperCase()] || 'grade-c';
}

export function getRiskLevelColor(level: string): string {
    const colors: Record<string, string> = {
        low: 'text-green-500',
        medium: 'text-yellow-500',
        high: 'text-orange-500',
        critical: 'text-red-500',
    };
    return colors[level.toLowerCase()] || 'text-gray-500';
}

export function calculateDaysRemaining(targetDate: Date | string): number {
    const target = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
    const now = new Date();
    const diffTime = target.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getTimeAgo(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const seconds = Math.floor((new Date().getTime() - d.getTime()) / 1000);

    const intervals = [
        { label: 'year', seconds: 31536000 },
        { label: 'month', seconds: 2592000 },
        { label: 'day', seconds: 86400 },
        { label: 'hour', seconds: 3600 },
        { label: 'minute', seconds: 60 },
    ];

    for (const interval of intervals) {
        const count = Math.floor(seconds / interval.seconds);
        if (count >= 1) {
            return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
        }
    }
    return 'just now';
}

export function truncate(str: string, length: number): string {
    if (str.length <= length) return str;
    return str.slice(0, length) + '...';
}

export function generateId(): string {
    return Math.random().toString(36).substring(2, 15);
}

// Alias for backward compatibility
export const formatTimeAgo = getTimeAgo;

