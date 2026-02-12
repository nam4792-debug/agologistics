import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

// Get API URL from environment or default to localhost
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
});

export function SocketProvider({ children }: { children: ReactNode }) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Initialize socket connection
        const newSocket = io(API_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        newSocket.on('connect', () => {
            console.log('🔌 Socket connected:', newSocket.id);
            setIsConnected(true);
        });

        newSocket.on('disconnect', () => {
            console.log('🔌 Socket disconnected');
            setIsConnected(false);
        });

        newSocket.on('connect_error', (error) => {
            console.error('🔌 Socket connection error:', error);
        });

        setSocket(newSocket);

        return () => {
            newSocket.close();
        };
    }, []);

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
}

export function useSocket() {
    return useContext(SocketContext);
}

// Custom hook to listen for real-time data updates
export function useRealTimeData<T>(
    eventName: string,
    onUpdate: (data: T) => void
) {
    const { socket } = useSocket();

    useEffect(() => {
        if (!socket) return;

        socket.on(eventName, onUpdate);

        return () => {
            socket.off(eventName, onUpdate);
        };
    }, [socket, eventName, onUpdate]);
}
