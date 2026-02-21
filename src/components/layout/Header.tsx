import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, Loader2, LogOut } from 'lucide-react';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { fetchApi } from '@/lib/api';

interface HeaderProps {
    sidebarCollapsed: boolean;
}

interface SearchResult {
    shipments: Array<{
        id: string;
        shipment_number: string;
        type: string;
        status: string;
        origin_port: string;
        destination_port: string;
    }>;
    bookings: Array<{
        id: string;
        booking_number: string;
        type: string;
        status: string;
        origin_port: string;
        destination_port: string;
    }>;
    exact_match?: {
        type: string;
        id: string;
        redirect: string;
    };
}

export function Header({ sidebarCollapsed }: HeaderProps) {
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState(false);
    const [results, setResults] = useState<SearchResult | null>(null);
    const [showResults, setShowResults] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);

    const handleSearch = useCallback(async (query: string) => {
        if (query.trim().length < 2) {
            setResults(null);
            setShowResults(false);
            setSearchError(false);
            return;
        }

        setSearching(true);
        setSearchError(false);
        try {
            const data = await fetchApi(`/api/search?q=${encodeURIComponent(query)}`);

            if (data.success) {
                setResults(data.results);
                setShowResults(true);

                // If exact match, navigate directly
                if (data.results.exact_match) {
                    navigate(data.results.exact_match.redirect);
                    setShowResults(false);
                    setSearchQuery('');
                }
            }
        } catch (error) {
            console.error('Search error:', error);
            setSearchError(true);
            setShowResults(true);
        } finally {
            setSearching(false);
        }
    }, [navigate]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch(searchQuery);
        }
        if (e.key === 'Escape') {
            setShowResults(false);
        }
    };

    const handleResultClick = (type: 'shipment' | 'booking', id: string) => {
        if (type === 'shipment') {
            navigate(`/shipments/${id}`);
        } else {
            navigate(`/bookings`);
        }
        setShowResults(false);
        setSearchQuery('');
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <header
            className={cn(
                'fixed top-0 right-0 z-30 h-16 bg-[hsl(var(--background))]/80 backdrop-blur-md border-b border-[hsl(var(--border))] transition-all duration-300 flex items-center justify-between px-6',
                'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-gradient-to-r after:from-emerald-500/40 after:via-green-500/20 after:to-transparent',
                sidebarCollapsed ? 'left-16' : 'left-64'
            )}
        >
            {/* Search Bar */}
            <div className="flex-1 max-w-md relative">
                <div className="relative">
                    {searching ? (
                        <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--primary))] animate-spin" />
                    ) : (
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                    )}
                    <input
                        type="text"
                        placeholder="Search shipments, bookings... (Enter to search)"
                        className="w-full h-10 pl-10 pr-4 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={() => setTimeout(() => setShowResults(false), 200)}
                    />
                </div>

                {/* Search Results Dropdown */}
                {showResults && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-xl max-h-80 overflow-y-auto z-50">
                        {searchError ? (
                            <div className="p-4 text-center">
                                <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] mb-1">
                                    Search unavailable
                                </p>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                    Server offline — search unavailable
                                </p>
                            </div>
                        ) : results && results.shipments.length === 0 && results.bookings.length === 0 ? (
                            <div className="p-4 text-center text-[hsl(var(--muted-foreground))]">
                                No results found
                            </div>
                        ) : results ? (
                            <>
                                {results.shipments.length > 0 && (
                                    <div>
                                        <div className="px-3 py-2 text-xs font-semibold text-[hsl(var(--muted-foreground))] bg-[hsl(var(--secondary))]">
                                            Shipments ({results.shipments.length})
                                        </div>
                                        {results.shipments.map((s) => (
                                            <button
                                                key={s.id}
                                                onClick={() => handleResultClick('shipment', s.id)}
                                                className="w-full px-3 py-2 text-left hover:bg-[hsl(var(--secondary))] transition-colors"
                                            >
                                                <p className="font-medium text-[hsl(var(--foreground))]">{s.shipment_number}</p>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                                    {s.origin_port} → {s.destination_port} • {s.status}
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {results.bookings.length > 0 && (
                                    <div>
                                        <div className="px-3 py-2 text-xs font-semibold text-[hsl(var(--muted-foreground))] bg-[hsl(var(--secondary))]">
                                            Bookings ({results.bookings.length})
                                        </div>
                                        {results.bookings.map((b) => (
                                            <button
                                                key={b.id}
                                                onClick={() => handleResultClick('booking', b.id)}
                                                className="w-full px-3 py-2 text-left hover:bg-[hsl(var(--secondary))] transition-colors"
                                            >
                                                <p className="font-medium text-[hsl(var(--foreground))]">{b.booking_number}</p>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                                    {b.origin_port} → {b.destination_port} • {b.status}
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : null}
                    </div>
                )}
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-4">
                {/* Notifications Dropdown */}
                <NotificationCenter />

                {/* User Profile with Menu */}
                <div className="relative">
                    <button
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className="flex items-center gap-3 pl-4 border-l border-[hsl(var(--border))] hover:opacity-80 transition-opacity"
                    >
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                                {user?.fullName || 'User'}
                            </p>
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                {user?.role || 'Staff'}
                            </p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-green-700 flex items-center justify-center shadow-sm">
                            <User className="w-5 h-5 text-white" />
                        </div>
                    </button>

                    {/* User Menu Dropdown */}
                    {showUserMenu && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-xl overflow-hidden z-50">
                            <div className="p-3 border-b border-[hsl(var(--border))]">
                                <p className="text-sm font-medium text-[hsl(var(--foreground))]">{user?.fullName}</p>
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">{user?.email}</p>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="w-full px-3 py-2 flex items-center gap-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                                Log out
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
