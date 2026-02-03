import { useState, useEffect } from 'react';
import { Bell, X, AlertTriangle, Info } from 'lucide-react';
import { api } from '@/lib/api';
import type { Notification } from '@/lib/socket';
import { cn, formatTimeAgo } from '@/lib/utils';

interface NotificationCenterProps {
    className?: string;
}

export function NotificationCenter({ className }: NotificationCenterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const data = await api.getNotifications();
            setNotifications(data.notifications || []);
            setUnreadCount(data.unreadCount || 0);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAsRead = async (id: string) => {
        try {
            await api.markNotificationRead(id);
            setNotifications(prev =>
                prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Failed to mark as read:', error);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await api.markAllNotificationsRead();
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    const getPriorityIcon = (priority: string) => {
        switch (priority) {
            case 'CRITICAL':
                return <AlertTriangle className="w-4 h-4 text-red-500" />;
            case 'HIGH':
                return <AlertTriangle className="w-4 h-4 text-orange-500" />;
            case 'MEDIUM':
                return <Info className="w-4 h-4 text-yellow-500" />;
            default:
                return <Info className="w-4 h-4 text-blue-500" />;
        }
    };

    return (
        <div className={cn('relative', className)}>
            {/* Bell Icon */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors"
            >
                <Bell className="w-5 h-5 text-[hsl(var(--foreground))]" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Panel */}
                    <div className="absolute right-0 top-12 w-96 max-h-[70vh] bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl z-50 flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border))]">
                            <h3 className="font-semibold text-[hsl(var(--foreground))]">
                                Thông Báo
                            </h3>
                            <div className="flex items-center gap-2">
                                {unreadCount > 0 && (
                                    <button
                                        onClick={handleMarkAllRead}
                                        className="text-xs text-[hsl(var(--primary))] hover:underline"
                                    >
                                        Đánh dấu tất cả đã đọc
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Notifications List */}
                        <div className="flex-1 overflow-y-auto">
                            {loading ? (
                                <div className="p-8 text-center text-[hsl(var(--muted-foreground))]">
                                    Đang tải...
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="p-8 text-center text-[hsl(var(--muted-foreground))]">
                                    <Bell className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                    <p>Không có thông báo</p>
                                </div>
                            ) : (
                                notifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className={cn(
                                            'p-4 border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))] transition-colors cursor-pointer',
                                            !notification.isRead && 'bg-[hsl(var(--primary))]/5'
                                        )}
                                        onClick={() => handleMarkAsRead(notification.id)}
                                    >
                                        <div className="flex items-start gap-3">
                                            {getPriorityIcon(notification.priority)}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">
                                                    {notification.title}
                                                </p>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 line-clamp-2">
                                                    {notification.message}
                                                </p>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
                                                    {formatTimeAgo(new Date(notification.createdAt))}
                                                </p>
                                            </div>
                                            {!notification.isRead && (
                                                <span className="w-2 h-2 rounded-full bg-[hsl(var(--primary))]" />
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
