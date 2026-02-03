import { io, Socket } from 'socket.io-client';
import { API_URL } from './api';

let socket: Socket | null = null;

export function connectSocket(userId?: string): Socket {
    if (socket?.connected) {
        return socket;
    }

    socket = io(API_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
        console.log('🔌 Socket connected:', socket?.id);

        // Join user's room for targeted notifications
        if (userId) {
            socket?.emit('join', `user_${userId}`);
        }
    });

    socket.on('disconnect', () => {
        console.log('🔌 Socket disconnected');
    });

    socket.on('connect_error', (error) => {
        console.error('🔌 Socket connection error:', error.message);
    });

    return socket;
}

export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

export function getSocket(): Socket | null {
    return socket;
}

// Subscribe to notifications
export function onNotification(callback: (notification: Notification) => void): () => void {
    if (!socket) {
        console.warn('Socket not connected');
        return () => { };
    }

    socket.on('notification', callback);
    socket.on('notification:new', callback);

    return () => {
        socket?.off('notification', callback);
        socket?.off('notification:new', callback);
    };
}

// Notification type
export interface Notification {
    id: string;
    type: string;
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    title: string;
    message: string;
    bookingId?: string;
    shipmentId?: string;
    actionUrl?: string;
    actionLabel?: string;
    createdAt: string;
    isRead?: boolean;
}
