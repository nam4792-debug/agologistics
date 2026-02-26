import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

interface MenuItem {
    name: string;
    shortName: string; // 2-3 letter abbreviation for collapsed state
    path: string;
}

interface MenuSection {
    label: string;
    items: MenuItem[];
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
    const { t } = useTranslation();

    const menuSections: MenuSection[] = [
        {
            label: 'Overview',
            items: [
                { name: t('nav.dashboard'), shortName: 'DB', path: '/' },
            ],
        },
        {
            label: 'Operations',
            items: [
                { name: t('nav.shipments'), shortName: 'SH', path: '/shipments' },
                { name: 'FCL ' + t('nav.bookings'), shortName: 'FCL', path: '/bookings/fcl' },
                { name: 'Air ' + t('nav.bookings'), shortName: 'AIR', path: '/bookings/air' },
                { name: t('nav.documents'), shortName: 'DOC', path: '/documents' },
                { name: t('nav.logistics'), shortName: 'LOG', path: '/logistics' },
            ],
        },
        {
            label: 'Finance',
            items: [
                { name: t('nav.vendors'), shortName: 'VC', path: '/vendors' },
                { name: t('nav.invoices'), shortName: 'INV', path: '/invoices' },
            ],
        },
        {
            label: 'Monitoring',
            items: [
                { name: t('nav.risks'), shortName: 'RA', path: '/risks' },
                { name: t('nav.analytics'), shortName: 'AN', path: '/analytics' },
                { name: t('nav.reports'), shortName: 'RPT', path: '/reports' },
            ],
        },
    ];

    const bottomMenuItems = [
        { name: t('nav.assistant'), shortName: 'AI', path: '/assistant' },
        { name: t('nav.activityLog'), shortName: 'ACT', path: '/activity-log' },
        { name: t('nav.settings'), shortName: 'SET', path: '/settings' },
        { name: t('nav.admin'), shortName: 'ADM', path: '/admin' },
    ];

    return (
        <aside
            className={cn(
                'fixed left-0 top-0 z-40 h-screen bg-gradient-to-b from-emerald-800 via-emerald-900 to-emerald-950 border-r border-white/10 transition-all duration-300 flex flex-col',
                collapsed ? 'w-16' : 'w-64'
            )}
        >
            {/* Logo Section */}
            <div className="flex h-16 items-center justify-between px-4 border-b border-white/10">
                {!collapsed && (
                    <div className="flex items-center gap-2">
                        <img src="./logo-agofruit.png" alt="Ago Fruit" className="w-9 h-9 rounded-lg object-contain" />
                        <div>
                            <h1 className="text-sm font-bold text-white leading-tight">Ago Import Export</h1>
                            <p className="text-[10px] text-emerald-300/60 -mt-0.5">Co.,Ltd</p>
                        </div>
                    </div>
                )}
                {collapsed && (
                    <img src="./logo-agofruit.png" alt="Ago Fruit" className="w-8 h-8 rounded-lg object-contain mx-auto" />
                )}
            </div>

            {/* Navigation Menu */}
            <nav className="flex-1 min-h-0 px-2 py-2 space-y-0.5 overflow-y-auto">
                {menuSections.map((section, sectionIdx) => (
                    <div key={section.label} className={cn(sectionIdx > 0 && 'mt-3')}>
                        {/* Section Label */}
                        {!collapsed && (
                            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300/40">
                                {section.label}
                            </p>
                        )}
                        {collapsed && sectionIdx > 0 && (
                            <div className="mx-3 mb-1 border-t border-white/10" />
                        )}
                        {section.items.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                title={collapsed ? item.name : undefined}
                                className={({ isActive }) =>
                                    cn(
                                        'flex items-center px-3 py-1.5 rounded-md transition-all duration-200 group relative',
                                        collapsed && 'justify-center',
                                        isActive
                                            ? 'bg-white/15 text-white font-semibold'
                                            : 'text-emerald-100/70 hover:bg-white/8 hover:text-white'
                                    )
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        {isActive && (
                                            <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-emerald-300" />
                                        )}
                                        {collapsed ? (
                                            <span className="text-[10px] font-bold tracking-wide">{item.shortName}</span>
                                        ) : (
                                            <span className="text-sm">{item.name}</span>
                                        )}
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </div>
                ))}
            </nav>

            {/* Bottom Menu */}
            <div className="shrink-0 border-t border-white/10 px-2 py-2">
                {bottomMenuItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        title={collapsed ? item.name : undefined}
                        className={({ isActive }) =>
                            cn(
                                'flex items-center px-3 py-1.5 rounded-md transition-all duration-200 relative',
                                collapsed && 'justify-center',
                                isActive
                                    ? 'bg-white/15 text-white font-semibold'
                                    : 'text-emerald-100/70 hover:bg-white/8 hover:text-white'
                            )
                        }
                    >
                        {({ isActive }) => (
                            <>
                                {isActive && (
                                    <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-emerald-300" />
                                )}
                                {collapsed ? (
                                    <span className="text-[10px] font-bold tracking-wide">{item.shortName}</span>
                                ) : (
                                    <span className="text-sm">{item.name}</span>
                                )}
                            </>
                        )}
                    </NavLink>
                ))}

                {/* Collapse Toggle */}
                <button
                    onClick={onToggle}
                    className={cn(
                        'mt-2 w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 text-emerald-200/50 hover:bg-white/8 hover:text-emerald-100',
                        collapsed && 'justify-center'
                    )}
                >
                    {collapsed ? (
                        <ChevronRight className="w-4 h-4" />
                    ) : (
                        <>
                            <ChevronLeft className="w-4 h-4" />
                            <span className="text-sm">Collapse</span>
                        </>
                    )}
                </button>
            </div>
        </aside>
    );
}
