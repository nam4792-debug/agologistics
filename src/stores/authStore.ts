import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
    id: string;
    email: string;
    fullName: string;
    role: string;
    department?: string;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => void;
    setUser: (user: User, token: string) => void;
}

// Get API URL from environment or default to localhost
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            isAuthenticated: false,

            login: async (email: string, password: string): Promise<boolean> => {
                try {
                    const response = await fetch(`${API_URL}/api/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password }),
                    });

                    const data = await response.json();

                    if (data.success && data.token) {
                        set({
                            user: data.user,
                            token: data.token,
                            isAuthenticated: true,
                        });
                        return true;
                    }
                    return false;
                } catch (error) {
                    console.error('Login error:', error);
                    return false;
                }
            },

            logout: () => {
                set({
                    user: null,
                    token: null,
                    isAuthenticated: false,
                });
            },

            setUser: (user: User, token: string) => {
                set({
                    user,
                    token,
                    isAuthenticated: true,
                });
            },
        }),
        {
            name: 'logispro-auth',
        }
    )
);
