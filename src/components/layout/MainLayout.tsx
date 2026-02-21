import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Breadcrumbs } from './Breadcrumbs';
import { cn } from '@/lib/utils';

export function MainLayout() {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    return (
        <div className="min-h-screen bg-[hsl(var(--background))]">
            <Sidebar
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
            <Header sidebarCollapsed={sidebarCollapsed} />
            <main
                className={cn(
                    'pt-16 min-h-screen transition-all duration-300',
                    sidebarCollapsed ? 'ml-16' : 'ml-64'
                )}
            >
                <div className="p-6">
                    <Breadcrumbs />
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
