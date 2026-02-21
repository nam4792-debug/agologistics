import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

// Map routes to human-readable labels
const routeLabels: Record<string, string> = {
    '': 'Dashboard',
    'shipments': 'Shipments',
    'bookings': 'Bookings',
    'fcl': 'FCL Bookings',
    'air': 'Air Bookings',
    'documents': 'Documents',
    'logistics': 'Logistics',
    'vendors': 'Vendors & Costs',
    'invoices': 'Invoices',
    'risks': 'Risks & Alerts',
    'analytics': 'Analytics',
    'assistant': 'AI Assistant',
    'settings': 'Settings',
    'admin': 'Admin',
};

function isDetailId(segment: string): boolean {
    // UUIDs or numeric IDs
    return /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(segment) || /^\d+$/.test(segment);
}

export function Breadcrumbs() {
    const location = useLocation();
    const pathSegments = location.pathname.split('/').filter(Boolean);

    // Don't show breadcrumbs on Dashboard
    if (pathSegments.length === 0) return null;

    const crumbs = pathSegments.map((segment, index) => {
        const path = '/' + pathSegments.slice(0, index + 1).join('/');
        const isLast = index === pathSegments.length - 1;
        const isId = isDetailId(segment);

        let label: string;
        if (isId) {
            // For detail pages, show a truncated ID or contextual label
            label = 'Details';
        } else {
            label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
        }

        return { label, path, isLast, isId };
    });

    return (
        <nav className="flex items-center gap-1.5 text-sm mb-4" aria-label="Breadcrumb">
            <Link
                to="/"
                className="flex items-center gap-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
                <Home className="w-3.5 h-3.5" />
                <span className="sr-only">Dashboard</span>
            </Link>

            {crumbs.map((crumb) => (
                <span key={crumb.path} className="flex items-center gap-1.5">
                    <ChevronRight className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]/50" />
                    {crumb.isLast ? (
                        <span className="font-medium text-[hsl(var(--foreground))]">
                            {crumb.label}
                        </span>
                    ) : (
                        <Link
                            to={crumb.path}
                            className={cn(
                                'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors',
                                crumb.isId && 'font-mono text-xs'
                            )}
                        >
                            {crumb.label}
                        </Link>
                    )}
                </span>
            ))}
        </nav>
    );
}
