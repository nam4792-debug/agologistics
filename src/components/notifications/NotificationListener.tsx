import { useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { connectSocket, onNotification, type Notification } from '@/lib/socket';
import { Bell, AlertTriangle, Check, Info } from 'lucide-react';

interface NotificationListenerProps {
    userId?: string;
    onNotification?: (notification: Notification) => void;
}

export function NotificationListener({ userId, onNotification: onNotify }: NotificationListenerProps) {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        // Connect socket
        connectSocket(userId);

        // Request browser notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        // Subscribe to notifications
        const unsubscribe = onNotification((notification) => {
            // Show toast notification
            showToast(notification);

            // Play sound for critical alerts
            if (notification.priority === 'CRITICAL') {
                playAlertSound();
            }

            // Show browser notification
            if ('Notification' in window && Notification.permission === 'granted') {
                new window.Notification(notification.title, {
                    body: notification.message,
                    icon: '/icon.png',
                    tag: notification.id,
                });
            }

            // Call custom handler
            onNotify?.(notification);
        });

        return () => {
            unsubscribe();
        };
    }, [userId, onNotify]);

    const showToast = (notification: Notification) => {
        const icons = {
            CRITICAL: <AlertTriangle className="w-5 h-5 text-red-500" />,
            HIGH: <AlertTriangle className="w-5 h-5 text-orange-500" />,
            MEDIUM: <Info className="w-5 h-5 text-yellow-500" />,
            LOW: <Check className="w-5 h-5 text-blue-500" />,
        };

        const durations = {
            CRITICAL: 10000,
            HIGH: 7000,
            MEDIUM: 5000,
            LOW: 4000,
        };

        toast.custom(
            (t) => (
                <div
                    className={`${t.visible ? 'animate-enter' : 'animate-leave'
                        } max-w-md w-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-lg rounded-lg pointer-events-auto flex`}
                >
                    <div className="flex-1 p-4">
                        <div className="flex items-start">
                            <div className="flex-shrink-0 pt-0.5">
                                {icons[notification.priority] || <Bell className="w-5 h-5" />}
                            </div>
                            <div className="ml-3 flex-1">
                                <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                                    {notification.title}
                                </p>
                                <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                                    {notification.message}
                                </p>
                                {notification.actionUrl && (
                                    <a
                                        href={notification.actionUrl}
                                        className="mt-2 inline-block text-sm font-medium text-[hsl(var(--primary))] hover:underline"
                                    >
                                        {notification.actionLabel || 'View details'}
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="border-l border-[hsl(var(--border))] px-4 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                    >
                        ✕
                    </button>
                </div>
            ),
            { duration: durations[notification.priority] || 5000 }
        );
    };

    const playAlertSound = () => {
        if (!audioRef.current) {
            audioRef.current = new Audio('/alert.mp3');
        }
        audioRef.current.play().catch(() => {
            // Audio autoplay may be blocked
        });
    };

    return null; // This is a listener-only component
}
