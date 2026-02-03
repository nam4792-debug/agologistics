// API Configuration
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Helper for API calls
export async function fetchApi(path: string, options: RequestInit = {}) {
    const token = localStorage.getItem('token');

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
        throw new Error(error.error || error.message || 'Request failed');
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
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/documents/upload`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
        });
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
};
