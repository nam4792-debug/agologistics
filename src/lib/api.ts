// API Configuration
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Helper to get auth token from zustand persist storage
function getAuthToken(): string | null {
    try {
        const authData = localStorage.getItem('logispro-auth');
        if (authData) {
            const parsed = JSON.parse(authData);
            return parsed?.state?.token || null;
        }
    } catch {
        // ignore parse errors
    }
    return null;
}

// Helper for API calls
export async function fetchApi(path: string, options: RequestInit = {}) {
    const token = getAuthToken();

    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));

        // Build descriptive error message for validation errors
        let message = error.error || error.message || 'Request failed';
        if (error.details && Array.isArray(error.details) && error.details.length > 0) {
            // Show up to 3 validation errors
            const shown = error.details.slice(0, 3);
            message = shown.join('. ');
            if (error.details.length > 3) {
                message += ` (+${error.details.length - 3} more)`;
            }
        }

        // Special case for conflict (optimistic locking)
        if (response.status === 409) {
            message = error.error || 'This record was modified by another user. Please refresh and try again.';
        }

        throw new Error(message);
    }


    return response.json();
}

// API endpoints
export const api = {
    // Auth
    login: (data: { email: string; password: string }) =>
        fetchApi('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),

    getMe: () => fetchApi('/api/auth/me'),

    // Bookings
    getBookings: (params?: Record<string, string>) => {
        const query = params ? '?' + new URLSearchParams(params).toString() : '';
        return fetchApi(`/api/bookings${query}`);
    },

    getBooking: (id: string) => fetchApi(`/api/bookings/${id}`),

    createBooking: (data: Record<string, unknown>) =>
        fetchApi('/api/bookings', { method: 'POST', body: JSON.stringify(data) }),

    confirmBooking: (id: string) =>
        fetchApi(`/api/bookings/${id}/confirm`, { method: 'POST' }),

    // Shipments
    getShipments: (params?: Record<string, string>) => {
        const query = params ? '?' + new URLSearchParams(params).toString() : '';
        return fetchApi(`/api/shipments${query}`);
    },

    getShipment: (id: string) => fetchApi(`/api/shipments/${id}`),

    updateShipmentStatus: (id: string, status: string) =>
        fetchApi(`/api/shipments/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        }),

    // Documents
    getDocuments: (shipmentId: string) =>
        fetchApi(`/api/documents/shipment/${shipmentId}`),

    uploadDocument: async (formData: FormData) => {
        const token = getAuthToken();
        const response = await fetch(`${API_URL}/api/documents/upload`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Upload failed' }));
            throw new Error(error.error || error.message || 'Upload failed');
        }
        return response.json();
    },

    // Tasks
    getTasks: (params?: Record<string, string>) => {
        const query = params ? '?' + new URLSearchParams(params).toString() : '';
        return fetchApi(`/api/tasks${query}`);
    },

    completeTask: (id: string) =>
        fetchApi(`/api/tasks/${id}/complete`, { method: 'PATCH' }),

    // Truck Dispatches
    createTruckDispatch: (data: Record<string, unknown>) =>
        fetchApi('/api/truck-dispatches', { method: 'POST', body: JSON.stringify(data) }),

    // Notifications
    getNotifications: (unreadOnly = false) =>
        fetchApi(`/api/notifications?unreadOnly=${unreadOnly}`),

    markNotificationRead: (id: string) =>
        fetchApi(`/api/notifications/${id}/read`, { method: 'PATCH' }),

    markAllNotificationsRead: () =>
        fetchApi('/api/notifications/read-all', { method: 'PATCH' }),

    // Test
    sendTestNotification: () =>
        fetchApi('/api/notifications/test', { method: 'POST' }),

    triggerDeadlineCheck: () =>
        fetchApi('/api/test/trigger-deadline-check', { method: 'POST' }),

    // AI Assistant (General Chat)
    assistantChat: (message: string, sessionId?: string) =>
        fetchApi('/api/ai/assistant/chat', {
            method: 'POST',
            body: JSON.stringify({ message, sessionId }),
        }),

    getAssistantHistory: (sessionId?: string) => {
        const query = sessionId ? `?sessionId=${sessionId}` : '';
        return fetchApi(`/api/ai/assistant/history${query}`);
    },

    clearAssistantHistory: (sessionId?: string) => {
        const query = sessionId ? `?sessionId=${sessionId}` : '';
        return fetchApi(`/api/ai/assistant/history${query}`, { method: 'DELETE' });
    },
};
