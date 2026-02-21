import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
    'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    {
        variants: {
            variant: {
                default: 'bg-[hsl(var(--primary))]/12 text-[hsl(var(--primary))] border border-[hsl(var(--primary))]/15',
                secondary: 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] border border-[hsl(var(--border))]/40',
                destructive: 'bg-[hsl(var(--destructive))]/10 text-[hsl(var(--destructive))] border border-[hsl(var(--destructive))]/15',
                outline: 'border border-[hsl(var(--border))] text-[hsl(var(--foreground))]',
                success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15',
                warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/15',
                info: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/15',
                muted: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))]/30',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    }
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    );
}

// Status-specific badge helper
interface StatusBadgeProps {
    status: string;
    className?: string;
}

const statusVariantMap: Record<string, VariantProps<typeof badgeVariants>['variant']> = {
    DRAFT: 'muted',
    PENDING: 'warning',
    AVAILABLE: 'info',
    ALLOCATED: 'secondary',
    USED: 'success',
    BOOKING_CONFIRMED: 'info',
    BOOKED: 'info',
    DOCUMENTATION_IN_PROGRESS: 'warning',
    READY_TO_LOAD: 'info',
    LOADING: 'warning',
    LOADED: 'success',
    CUSTOMS_SUBMITTED: 'info',
    CUSTOMS_CLEARED: 'success',
    IN_TRANSIT: 'default',
    ARRIVED: 'success',
    DELIVERED: 'success',
    COMPLETED: 'success',
    CANCELLED: 'destructive',
    EXPIRED: 'destructive',
    APPROVED: 'success',
    REJECTED: 'destructive',
};

function StatusBadge({ status, className }: StatusBadgeProps) {
    const variant = statusVariantMap[status] || 'muted';
    const label = status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    return (
        <Badge variant={variant} className={className}>
            {label}
        </Badge>
    );
}

export { Badge, badgeVariants, StatusBadge };
