import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import {
    Ship,
    Plane,
    ArrowLeft,
    FileText,
    DollarSign,
    AlertTriangle,
    Package,
    MapPin,
    User,
    Building,
    Upload,
    CheckCircle,
    Circle,
    Loader2,
    RefreshCw,
    X,
    Save,
    Edit,
    Download,
    Plus,
    Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, StatusBadge, Badge, Input, Select } from '@/components/ui';
import { formatCurrency, formatDate, formatWeight, cn } from '@/lib/utils';
import type { ShipmentStatus } from '@/types';
import toast from 'react-hot-toast';

const statusLabels: Record<string, string> = {
    DRAFT: 'Draft',
    BOOKING_CONFIRMED: 'Booking Confirmed',
    DOCUMENTATION_IN_PROGRESS: 'Documentation In Progress',
    READY_TO_LOAD: 'Ready to Load',
    LOADING: 'Loading',
    LOADED: 'Loaded',
    CUSTOMS_SUBMITTED: 'Customs Submitted',
    CUSTOMS_CLEARED: 'Customs Cleared',
    IN_TRANSIT: 'In Transit',
    ARRIVED: 'Arrived',
    DELIVERED: 'Delivered',
    COMPLETED: 'Completed',
};

const documentTypeLabels: Record<string, string> = {
    COMMERCIAL_INVOICE: 'Commercial Invoice',
    PACKING_LIST: 'Packing List',
    BILL_OF_LADING: 'Bill of Lading',
    CERTIFICATE_OF_ORIGIN: 'Certificate of Origin',
    PHYTOSANITARY: 'Phytosanitary Certificate',
    CUSTOMS_DECLARATION: 'Customs Declaration',
    INSURANCE: 'Insurance Certificate',
};

const statusFlow: ShipmentStatus[] = [
    'DRAFT',
    'BOOKING_CONFIRMED',
    'DOCUMENTATION_IN_PROGRESS',
    'READY_TO_LOAD',
    'LOADING',
    'LOADED',
    'CUSTOMS_SUBMITTED',
    'CUSTOMS_CLEARED',
    'IN_TRANSIT',
    'ARRIVED',
    'DELIVERED',
    'COMPLETED',
];

interface ShipmentData {
    id: string;
    shipment_number: string;
    type: string;
    status: string;
    customer_id: string;
    customer_name?: string;
    customer_code?: string;
    customer_country?: string;
    customer_contact?: string;
    customer_email?: string;
    forwarder_id?: string;
    forwarder_name?: string;
    origin_port: string;
    destination_port: string;
    origin_country: string;
    destination_country: string;
    container_number?: string;
    container_type?: string;
    container_count?: number;
    cargo_description?: string;
    cargo_weight_kg?: number;
    cargo_volume_cbm?: number;
    incoterm?: string;
    etd: string;
    eta: string;
    atd?: string;
    ata?: string;
    total_cost_usd?: number;
    created_at: string;
}

interface DocumentData {
    id: string;
    shipment_id: string;
    document_type: string;
    document_number?: string;
    version: number;
    status: string;
    file_name: string;
    created_at: string;
}

function getStatusIndex(status: string): number {
    return statusFlow.indexOf(status as ShipmentStatus);
}

export function ShipmentDetail() {
    const { id } = useParams<{ id: string }>();
    const [shipment, setShipment] = useState<ShipmentData | null>(null);
    const [documents, setDocuments] = useState<DocumentData[]>([]);
    const [loading, setLoading] = useState(true);
    const [showEditModal, setShowEditModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editData, setEditData] = useState<Partial<ShipmentData>>({});

    // Upload modal state
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadFiles, setUploadFiles] = useState<{ file: File; name: string; type: string }[]>([]);
    const [uploading, setUploading] = useState(false);

    const fetchShipment = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const [shipmentRes, docsRes] = await Promise.all([
                fetch(`http://localhost:3001/api/shipments/${id}`),
                fetch(`http://localhost:3001/api/documents?shipmentId=${id}`),
            ]);

            const shipmentData = await shipmentRes.json();
            const docsData = await docsRes.json();

            if (shipmentData.shipment) {
                setShipment(shipmentData.shipment);
            }
            if (docsData.documents) {
                setDocuments(docsData.documents);
            }
        } catch (error) {
            console.error('Failed to fetch shipment:', error);
            toast.error('Failed to fetch shipment');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchShipment();
    }, [id]);

    // Open edit modal if ?edit=true in URL
    const location = useLocation();
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('edit') === 'true' && shipment && !showEditModal) {
            openEditModal();
        }
    }, [location.search, shipment]);

    const openEditModal = () => {
        if (shipment) {
            setEditData({
                status: shipment.status,
                origin_port: shipment.origin_port,
                destination_port: shipment.destination_port,
                cargo_description: shipment.cargo_description,
                container_number: shipment.container_number || '',
                container_type: shipment.container_type || '40GP',
                container_count: shipment.container_count || 1,
                cargo_weight_kg: shipment.cargo_weight_kg || 0,
                cargo_volume_cbm: shipment.cargo_volume_cbm || 0,
                etd: shipment.etd?.split('T')[0] || '',
                eta: shipment.eta?.split('T')[0] || '',
                atd: shipment.atd?.split('T')[0] || '',
                ata: shipment.ata?.split('T')[0] || '',
                incoterm: shipment.incoterm,
            });
            setShowEditModal(true);
        }
    };

    const handleSaveEdit = async () => {
        if (!id) return;
        setSaving(true);
        try {
            const res = await fetch(`http://localhost:3001/api/shipments/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editData),
            });
            if (res.ok) {
                toast.success('Shipment updated successfully!');
                setShowEditModal(false);
                fetchShipment();
            } else {
                toast.error('Failed to update shipment');
            }
        } catch (error) {
            console.error('Error updating shipment:', error);
            toast.error('Error updating shipment');
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!id) return;
        try {
            const res = await fetch(`http://localhost:3001/api/shipments/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                toast.success(`Status changed to ${statusLabels[newStatus] || newStatus}`);
                fetchShipment();
            } else {
                toast.error('Failed to update status');
            }
        } catch (error) {
            toast.error('Error updating status');
        }
    };

    const handleUploadDocument = () => {
        setUploadFiles([]);
        setShowUploadModal(true);
    };

    const handleAddFiles = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx,.xls';
        input.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files && files.length > 0) {
                const newFiles = Array.from(files).map((file) => ({
                    file,
                    name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension for name
                    type: 'GENERAL',
                }));
                setUploadFiles((prev) => [...prev, ...newFiles]);
            }
        };
        input.click();
    };

    const handleRemoveFile = (index: number) => {
        setUploadFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleUploadFiles = async () => {
        if (!id || uploadFiles.length === 0) return;

        setUploading(true);
        try {
            for (const fileData of uploadFiles) {
                const formData = new FormData();
                formData.append('file', fileData.file);
                formData.append('shipmentId', id);
                formData.append('documentType', fileData.type);
                formData.append('documentName', fileData.name);

                await fetch('http://localhost:3001/api/documents/upload', {
                    method: 'POST',
                    body: formData,
                });
            }
            toast.success(`${uploadFiles.length} document(s) uploaded successfully!`);
            setShowUploadModal(false);
            setUploadFiles([]);
            fetchShipment();
        } catch (error) {
            toast.error('Upload error');
        } finally {
            setUploading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
            </div>
        );
    }

    if (!shipment) {
        return (
            <div className="text-center py-20">
                <Ship className="w-16 h-16 mx-auto text-[hsl(var(--muted-foreground))] mb-4" />
                <h2 className="text-2xl font-bold text-[hsl(var(--foreground))]">Shipment not found</h2>
                <p className="text-[hsl(var(--muted-foreground))] mt-2">
                    The shipment you're looking for doesn't exist.
                </p>
                <Link to="/shipments">
                    <Button className="mt-4">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Shipments
                    </Button>
                </Link>
            </div>
        );
    }

    const currentStatusIndex = getStatusIndex(shipment.status);
    const progressPercentage = ((currentStatusIndex + 1) / statusFlow.length) * 100;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link to="/shipments">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">
                                {shipment.shipment_number}
                            </h1>
                            <span className={cn(
                                'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
                                shipment.type === 'FCL'
                                    ? 'bg-blue-500/10 text-blue-400'
                                    : 'bg-purple-500/10 text-purple-400'
                            )}>
                                {shipment.type === 'FCL' ? <Ship className="w-3 h-3" /> : <Plane className="w-3 h-3" />}
                                {shipment.type}
                            </span>
                            <StatusBadge status={shipment.status} />
                        </div>
                        <p className="text-[hsl(var(--muted-foreground))] mt-1">
                            {shipment.cargo_description || 'No cargo description'}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchShipment}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                    <Button onClick={openEditModal}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Shipment
                    </Button>
                </div>
            </div>

            {/* Progress Bar */}
            <Card>
                <CardContent className="p-6">
                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-[hsl(var(--foreground))]">Shipment Progress</span>
                            <span className="text-sm text-[hsl(var(--muted-foreground))]">{Math.round(progressPercentage)}% Complete</span>
                        </div>
                        <div className="h-2 bg-[hsl(var(--secondary))] rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
                                style={{ width: `${progressPercentage}%` }}
                            />
                        </div>
                    </div>
                    <div className="flex justify-between overflow-x-auto pb-2">
                        {statusFlow.slice(0, 6).map((status, index) => {
                            const isCompleted = index < currentStatusIndex;
                            const isCurrent = index === currentStatusIndex;
                            const canAdvance = index === currentStatusIndex + 1;
                            return (
                                <div
                                    key={status}
                                    className={cn(
                                        "flex flex-col items-center min-w-[80px]",
                                        canAdvance && "cursor-pointer hover:opacity-80"
                                    )}
                                    onClick={() => canAdvance && handleStatusChange(status)}
                                    title={canAdvance ? `Click to advance to ${statusLabels[status]}` : ''}
                                >
                                    <div className={cn(
                                        'w-8 h-8 rounded-full flex items-center justify-center mb-2 transition-all',
                                        isCompleted && 'bg-green-500 text-white',
                                        isCurrent && 'bg-[hsl(var(--primary))] text-white',
                                        canAdvance && 'bg-yellow-500/50 text-yellow-300 ring-2 ring-yellow-400 animate-pulse',
                                        !isCompleted && !isCurrent && !canAdvance && 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]'
                                    )}>
                                        {isCompleted ? <CheckCircle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                                    </div>
                                    <span className={cn(
                                        'text-xs text-center',
                                        (isCompleted || isCurrent) ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'
                                    )}>
                                        {statusLabels[status]?.split(' ').slice(0, 2).join(' ') || status}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Details */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Shipment Details */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Package className="w-5 h-5" />
                                Shipment Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                <div>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Container</p>
                                    <p className="font-medium text-[hsl(var(--foreground))]">
                                        {shipment.container_number || '—'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Container Type</p>
                                    <p className="font-medium text-[hsl(var(--foreground))]">
                                        {shipment.container_type || '—'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Incoterm</p>
                                    <p className="font-medium text-[hsl(var(--foreground))]">{shipment.incoterm || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Container Count</p>
                                    <p className="font-medium text-[hsl(var(--foreground))]">{shipment.container_count || 1}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Weight</p>
                                    <p className="font-medium text-[hsl(var(--foreground))]">
                                        {shipment.cargo_weight_kg ? formatWeight(shipment.cargo_weight_kg) : '—'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Volume</p>
                                    <p className="font-medium text-[hsl(var(--foreground))]">
                                        {shipment.cargo_volume_cbm ? `${shipment.cargo_volume_cbm} CBM` : '—'}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Route & Timing */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MapPin className="w-5 h-5" />
                                Route & Schedule
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div className="text-center flex-1">
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Origin</p>
                                    <p className="font-medium text-[hsl(var(--foreground))] text-lg">
                                        {shipment.origin_port || shipment.origin_country}
                                    </p>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{shipment.origin_country}</p>
                                </div>
                                <div className="flex-shrink-0 px-4">
                                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                                        <div className="w-8 h-0.5 bg-[hsl(var(--border))]"></div>
                                        {shipment.type === 'FCL' ? <Ship className="w-5 h-5" /> : <Plane className="w-5 h-5" />}
                                        <div className="w-8 h-0.5 bg-[hsl(var(--border))]"></div>
                                    </div>
                                </div>
                                <div className="text-center flex-1">
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Destination</p>
                                    <p className="font-medium text-[hsl(var(--foreground))] text-lg">
                                        {shipment.destination_port || shipment.destination_country}
                                    </p>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{shipment.destination_country}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-[hsl(var(--border))]">
                                <div>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">ETD</p>
                                    <p className="font-medium text-[hsl(var(--foreground))]">
                                        {shipment.etd ? formatDate(shipment.etd) : '—'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">ETA</p>
                                    <p className="font-medium text-[hsl(var(--foreground))]">
                                        {shipment.eta ? formatDate(shipment.eta) : '—'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Actual Departure</p>
                                    <p className="font-medium text-[hsl(var(--foreground))]">
                                        {shipment.atd ? formatDate(shipment.atd) : '—'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Actual Arrival</p>
                                    <p className="font-medium text-[hsl(var(--foreground))]">
                                        {shipment.ata ? formatDate(shipment.ata) : '—'}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Documents */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="w-5 h-5" />
                                Documents ({documents.length})
                            </CardTitle>
                            <Button size="sm" onClick={handleUploadDocument}>
                                <Upload className="w-4 h-4 mr-2" />
                                Upload
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {documents.length > 0 ? (
                                <div className="space-y-3">
                                    {documents.map((doc) => (
                                        <div
                                            key={doc.id}
                                            className="flex items-center justify-between p-4 rounded-lg bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary))]/80 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-[hsl(var(--primary))]/20 flex items-center justify-center">
                                                    <FileText className="w-5 h-5 text-[hsl(var(--primary))]" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-[hsl(var(--foreground))]">
                                                        {documentTypeLabels[doc.document_type] || doc.document_type}
                                                    </p>
                                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                                        {doc.document_number || doc.file_name} • v{doc.version}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <StatusBadge status={doc.status} />
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => window.open(`http://localhost:3001/api/documents/${doc.id}/download`, '_blank')}
                                                >
                                                    <Download className="w-4 h-4 mr-1" />
                                                    Download
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <FileText className="w-12 h-12 mx-auto text-[hsl(var(--muted-foreground))] mb-3" />
                                    <p className="text-[hsl(var(--muted-foreground))]">No documents uploaded yet</p>
                                    <Button size="sm" className="mt-3" onClick={handleUploadDocument}>
                                        <Upload className="w-4 h-4 mr-2" />
                                        Upload Document
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column - Sidebar Info */}
                <div className="space-y-6">
                    {/* Customer Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="w-5 h-5" />
                                Customer
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="font-medium text-[hsl(var(--foreground))]">
                                    {shipment.customer_name || 'N/A'}
                                </p>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                    {shipment.customer_code || '—'}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">Country</p>
                                <p className="text-[hsl(var(--foreground))]">{shipment.customer_country || '—'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">Contact</p>
                                <p className="text-[hsl(var(--foreground))]">{shipment.customer_contact || '—'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">Email</p>
                                <p className="text-[hsl(var(--primary))]">{shipment.customer_email || '—'}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Forwarder Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Building className="w-5 h-5" />
                                Forwarder
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="font-medium text-[hsl(var(--foreground))]">
                                    {shipment.forwarder_name || 'Not assigned'}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Risk Score */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                                Risk Assessment
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-3xl font-bold text-[hsl(var(--foreground))]">—</span>
                                <Badge className="bg-gray-500/20 text-gray-400">
                                    Not Assessed
                                </Badge>
                            </div>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                Risk assessment will be calculated based on shipment progress
                            </p>
                        </CardContent>
                    </Card>

                    {/* Cost Summary */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <DollarSign className="w-5 h-5" />
                                Cost Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-[hsl(var(--muted-foreground))]">Total Cost</span>
                                    <span className="text-xl font-bold text-[hsl(var(--foreground))]">
                                        {shipment.total_cost_usd ? formatCurrency(shipment.total_cost_usd) : '—'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-[hsl(var(--muted-foreground))]">Currency</span>
                                    <span className="text-[hsl(var(--foreground))]">USD</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Edit Shipment Modal - Wide Grid Layout */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-[hsl(var(--background))] rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-[hsl(var(--border))]">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">Edit Shipment</h2>
                            <Button variant="ghost" size="icon" onClick={() => setShowEditModal(false)}>
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        {/* Section: Status & Route */}
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-3">Status & Route</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Status</label>
                                    <Select
                                        value={editData.status || ''}
                                        onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                                        options={statusFlow.map(s => ({ value: s, label: statusLabels[s] || s }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Incoterm</label>
                                    <Select
                                        value={editData.incoterm || ''}
                                        onChange={(e) => setEditData({ ...editData, incoterm: e.target.value })}
                                        options={[
                                            { value: 'FOB', label: 'FOB' },
                                            { value: 'CIF', label: 'CIF' },
                                            { value: 'CFR', label: 'CFR' },
                                            { value: 'EXW', label: 'EXW' },
                                            { value: 'DDP', label: 'DDP' },
                                        ]}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Origin Port</label>
                                    <Input
                                        value={editData.origin_port || ''}
                                        onChange={(e) => setEditData({ ...editData, origin_port: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Destination Port</label>
                                    <Input
                                        value={editData.destination_port || ''}
                                        onChange={(e) => setEditData({ ...editData, destination_port: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section: Cargo Description */}
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-3">Cargo</h3>
                            <Input
                                value={editData.cargo_description || ''}
                                onChange={(e) => setEditData({ ...editData, cargo_description: e.target.value })}
                                placeholder="Cargo description"
                            />
                        </div>

                        {/* Section: Container Details */}
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-3">Container Details</h3>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Container #</label>
                                    <Input
                                        value={editData.container_number || ''}
                                        onChange={(e) => setEditData({ ...editData, container_number: e.target.value })}
                                        placeholder="MSKU1234567"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Type</label>
                                    <Select
                                        value={editData.container_type || '40GP'}
                                        onChange={(e) => setEditData({ ...editData, container_type: e.target.value })}
                                        options={[
                                            { value: '20GP', label: '20GP' },
                                            { value: '40GP', label: '40GP' },
                                            { value: '40HC', label: '40HC' },
                                            { value: '40RF', label: '40RF' },
                                            { value: '45HC', label: '45HC' },
                                        ]}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Count</label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={editData.container_count || 1}
                                        onChange={(e) => setEditData({ ...editData, container_count: parseInt(e.target.value) || 1 })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Weight (kg)</label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={editData.cargo_weight_kg || 0}
                                        onChange={(e) => setEditData({ ...editData, cargo_weight_kg: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Volume (CBM)</label>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        value={editData.cargo_volume_cbm || 0}
                                        onChange={(e) => setEditData({ ...editData, cargo_volume_cbm: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section: Schedule */}
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-3">Schedule</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">ETD</label>
                                    <Input
                                        type="date"
                                        value={editData.etd || ''}
                                        onChange={(e) => setEditData({ ...editData, etd: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">ETA</label>
                                    <Input
                                        type="date"
                                        value={editData.eta || ''}
                                        onChange={(e) => setEditData({ ...editData, eta: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">ATD (Actual)</label>
                                    <Input
                                        type="date"
                                        value={editData.atd || ''}
                                        onChange={(e) => setEditData({ ...editData, atd: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">ATA (Actual)</label>
                                    <Input
                                        type="date"
                                        value={editData.ata || ''}
                                        onChange={(e) => setEditData({ ...editData, ata: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t border-[hsl(var(--border))]">
                            <Button variant="outline" onClick={() => setShowEditModal(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleSaveEdit} disabled={saving}>
                                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                Save Changes
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload Documents Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-[hsl(var(--background))] rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto border border-[hsl(var(--border))]">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">Upload Documents</h2>
                            <Button variant="ghost" size="icon" onClick={() => setShowUploadModal(false)}>
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        {/* Add files button */}
                        <div className="mb-4">
                            <Button variant="outline" onClick={handleAddFiles}>
                                <Plus className="w-4 h-4 mr-2" />
                                Add Files
                            </Button>
                            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2">
                                Supported formats: PDF, JPG, PNG, DOC, DOCX, XLS, XLSX
                            </p>
                        </div>

                        {/* File list */}
                        {uploadFiles.length > 0 ? (
                            <div className="space-y-3 mb-4">
                                {uploadFiles.map((fileData, index) => (
                                    <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(var(--secondary))]">
                                        <FileText className="w-5 h-5 text-[hsl(var(--primary))] flex-shrink-0" />
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                                            <div className="md:col-span-1">
                                                <label className="text-xs text-[hsl(var(--muted-foreground))]">Document Name</label>
                                                <Input
                                                    value={fileData.name}
                                                    onChange={(e) => {
                                                        const newFiles = [...uploadFiles];
                                                        newFiles[index].name = e.target.value;
                                                        setUploadFiles(newFiles);
                                                    }}
                                                    placeholder="Enter document name"
                                                    className="h-8"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-[hsl(var(--muted-foreground))]">Type</label>
                                                <Select
                                                    value={fileData.type}
                                                    onChange={(e) => {
                                                        const newFiles = [...uploadFiles];
                                                        newFiles[index].type = e.target.value;
                                                        setUploadFiles(newFiles);
                                                    }}
                                                    options={[
                                                        { value: 'GENERAL', label: 'General' },
                                                        { value: 'BILL_OF_LADING', label: 'Bill of Lading' },
                                                        { value: 'COMMERCIAL_INVOICE', label: 'Commercial Invoice' },
                                                        { value: 'PACKING_LIST', label: 'Packing List' },
                                                        { value: 'CERTIFICATE_OF_ORIGIN', label: 'Certificate of Origin' },
                                                        { value: 'CUSTOMS_DECLARATION', label: 'Customs Declaration' },
                                                        { value: 'INSURANCE', label: 'Insurance' },
                                                    ]}
                                                />
                                            </div>
                                            <div className="text-sm text-[hsl(var(--muted-foreground))] flex items-center">
                                                {fileData.file.name}
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-[hsl(var(--destructive))] h-8 w-8 flex-shrink-0"
                                            onClick={() => handleRemoveFile(index)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 border-2 border-dashed border-[hsl(var(--border))] rounded-lg mb-4">
                                <Upload className="w-12 h-12 mx-auto text-[hsl(var(--muted-foreground))] mb-3" />
                                <p className="text-[hsl(var(--muted-foreground))]">Click "Add Files" to select documents</p>
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-4 border-t border-[hsl(var(--border))]">
                            <Button variant="outline" onClick={() => setShowUploadModal(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleUploadFiles} disabled={uploading || uploadFiles.length === 0}>
                                {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                                Upload {uploadFiles.length > 0 && `(${uploadFiles.length})`}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
