import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '@/contexts';
import { fetchApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface Shipment {
    id: string;
    shipment_number: string;
    type: string;
    status: string;
    customer_name?: string;
    origin_port: string;
    destination_port: string;
    etd?: string;
    eta?: string;
    created_at: string;
    [key: string]: unknown;
}

export function useShipments() {
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { socket } = useSocket();

    // Fetch all shipments
    const fetchShipments = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchApi('/api/shipments');
            if (data.shipments) {
                setShipments(data.shipments);
            }
            setError(null);
        } catch (err) {
            setError('Failed to fetch shipments');
            console.error('Error fetching shipments:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchShipments();
    }, [fetchShipments]);

    // Real-time listeners
    useEffect(() => {
        if (!socket) return;

        // When new shipment is created
        const handleCreated = (newShipment: Shipment) => {
            setShipments(prev => [newShipment, ...prev]);
            toast.success(`🆕 New shipment: ${newShipment.shipment_number}`, {
                duration: 3000,
                icon: '📦'
            });
        };

        // When shipment is updated
        const handleUpdated = (updatedShipment: Shipment) => {
            setShipments(prev =>
                prev.map(s => s.id === updatedShipment.id ? { ...s, ...updatedShipment } : s)
            );
            toast.success(`✏️ Updated: ${updatedShipment.shipment_number}`, {
                duration: 2000,
            });
        };

        // When shipment is deleted
        const handleDeleted = (data: { id: string }) => {
            setShipments(prev => prev.filter(s => s.id !== data.id));
            toast.success('🗑️ Shipment deleted', {
                duration: 2000,
            });
        };

        socket.on('shipment:created', handleCreated);
        socket.on('shipment:updated', handleUpdated);
        socket.on('shipment:deleted', handleDeleted);

        return () => {
            socket.off('shipment:created', handleCreated);
            socket.off('shipment:updated', handleUpdated);
            socket.off('shipment:deleted', handleDeleted);
        };
    }, [socket]);

    return {
        shipments,
        loading,
        error,
        refetch: fetchShipments,
    };
}
