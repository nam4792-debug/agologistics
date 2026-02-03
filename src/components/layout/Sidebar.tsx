import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    Ship,
    FileText,
    Truck,
    Building,
    AlertTriangle,
    BarChart3,
    MessageSquare,
    Settings,
    ChevronLeft,
    ChevronRight,
    Anchor,
    Plane,
} from 'lucide-react';

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Shipments', icon: Ship, path: '/shipments' },
    { name: 'FCL Bookings', icon: Anchor, path: '/bookings/fcl' },
    { name: 'Air Bookings', icon: Plane, path: '/bookings/air' },
    { name: 'Documents', icon: FileText, path: '/documents' },
    { name: 'Logistics', icon: Truck, path: '/logistics' },
    { name: 'Vendors & Costs', icon: Building, path: '/vendors' },
    { name: 'Risks & Alerts', icon: AlertTriangle, path: '/risks' },
    { name: 'Analytics', icon: BarChart3, path: '/analytics' },
    { name: 'AI Assistant', icon: MessageSquare, path: '/assistant' },
];

const bottomMenuItems = [
    { name: 'Settings', icon: Settings, path: '/settings' },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
    return (
        <aside
            className={cn(
                'fixed left-0 top-0 z-40 h-screen bg-[hsl(var(--card))] border-r border-[hsl(var(--border))] transition-all duration-300 flex flex-col',
                collapsed ? 'w-16' : 'w-64'
            )}
        >
            {/* Logo Section */}
            <div className="flex h-16 items-center justify-between px-4 border-b border-[hsl(var(--border))]">
                {!collapsed && (
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                            <Ship className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-[hsl(var(--foreground))]">LogisPro</h1>
                            <p className="text-[10px] text-[hsl(var(--muted-foreground))] -mt-1">Export Management</p>
                        </div>
                    </div>
                )}
                {collapsed && (
                    <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center mx-auto">
                        <Ship className="w-5 h-5 text-white" />
                    </div>
                )}
            </div>

            {/* Navigation Menu */}
            <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
                {menuItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            cn(
                                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                                collapsed && 'justify-center',
                                isActive
                                    ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                                    : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]'
                            )
                        }
                    >
                        <item.icon className={cn('w-5 h-5 shrink-0', collapsed && 'w-6 h-6')} />
                        {!collapsed && <span className="text-sm font-medium">{item.name}</span>}
                    </NavLink>
                ))}
            </nav>

            {/* Bottom Menu */}
            <div className="border-t border-[hsl(var(--border))] px-2 py-4">
                {bottomMenuItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            cn(
                                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                                collapsed && 'justify-center',
                                isActive
                                    ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                                    : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]'
                            )
                        }
                    >
                        <item.icon className="w-5 h-5 shrink-0" />
                        {!collapsed && <span className="text-sm font-medium">{item.name}</span>}
                    </NavLink>
                ))}

                {/* Collapse Toggle */}
                <button
                    onClick={onToggle}
                    className={cn(
                        'mt-2 w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]',
                        collapsed && 'justify-center'
                    )}
                >
                    {collapsed ? (
                        <ChevronRight className="w-5 h-5" />
                    ) : (
                        <>
                            <ChevronLeft className="w-5 h-5" />
                            <span className="text-sm font-medium">Collapse</span>
                        </>
                    )}
                </button>
            </div>
        </aside>
    );
}
