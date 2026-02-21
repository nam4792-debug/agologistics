import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
    id: string;
    email: string;
    fullName: string;
    role: string;
    department?: string;
}

interface License {
    type: string;
    expiresAt?: string;
}

interface AuthState {
    user: User | null;
    token: string | null;
    license: License | null;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    setUser: (user: User, token: string, license?: License) => void;
}

// Get API URL from environment or default to localhost
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            license: null,
            isAuthenticated: false,

            login: async (email: string, password: string) => {
                try {
                    // Get device info with timeout (3s fallback)
                    let deviceInfo;
                    try {
                        const { getDeviceInfo } = await import('../lib/deviceId');
                        const deviceInfoPromise = getDeviceInfo();
                        const timeoutPromise = new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Device info timeout')), 3000)
                        );
                        deviceInfo = await Promise.race([deviceInfoPromise, timeoutPromise]) as { deviceId: string; deviceName: string; osInfo: string };
                    } catch {
                        deviceInfo = {
                            deviceId: 'fallback-device-id',
                            deviceName: 'Unknown',
                            osInfo: navigator.userAgent,
                        };
                    }

                    // Login with 10-second timeout
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000);

                    const response = await fetch(`${API_URL}/api/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email,
                            password,
                            deviceId: deviceInfo.deviceId,
                            deviceName: deviceInfo.deviceName,
                            osInfo: deviceInfo.osInfo,
                        }),
                        signal: controller.signal,
                    });

                    clearTimeout(timeoutId);

                    const data = await response.json();

                    if (!response.ok) {
                        // Return specific error messages
                        return {
                            success: false,
                            error: data.error || data.message || 'Login failed',
                        };
                    }

                    // API returns { token, user, license }
                    if (data.token && data.user) {
                        set({
                            user: {
                                id: data.user.id,
                                email: data.user.email,
                                fullName: data.user.full_name,
                                role: data.user.role,
                                department: data.user.department,
                            },
                            token: data.token,
                            license: data.license || null,
                            isAuthenticated: true,
                        });
                        return { success: true };
                    }
                    return { success: false, error: 'Invalid response from server' };
                } catch (error) {
                    console.error('Login error:', error);
                    if (error instanceof DOMException && error.name === 'AbortError') {
                        return {
                            success: false,
                            error: 'Cannot connect to server. Please check your network connection and try again.',
                        };
                    }
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : 'Network error',
                    };
                }
            },

            logout: () => {
                set({
                    user: null,
                    token: null,
                    license: null,
                    isAuthenticated: false,
                });
            },

            setUser: (user: User, token: string, license?: License) => {
                set({
                    user,
                    token,
                    license: license || null,
                    isAuthenticated: true,
                });
            },
        }),
        {
            name: 'logispro-auth',
        }
    )
);
