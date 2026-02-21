import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    ChevronDown,
    ChevronRight,
    Loader2,
} from 'lucide-react';
import { Card, CardContent, Button, Input, Badge } from '@/components/ui';
import { formatDate, cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { API_URL, fetchApi } from '@/lib/api';

// Document types
const documentTypeInfo: Record<string, { label: string; color: string }> = {
    COMMERCIAL_INVOICE: { label: 'Commercial Invoice', color: 'text-blue-400' },
    PACKING_LIST: { label: 'Packing List', color: 'text-green-400' },
    BILL_OF_LADING: { label: 'Bill of Lading', color: 'text-cyan-400' },
    PHYTOSANITARY: { label: 'Phytosanitary Certificate', color: 'text-emerald-400' },
    CERTIFICATE_OF_ORIGIN: { label: 'Certificate of Origin', color: 'text-amber-400' },
    CUSTOMS_DECLARATION: { label: 'Customs Declaration', color: 'text-purple-400' },
    INSURANCE: { label: 'Insurance Certificate', color: 'text-indigo-400' },
    OTHER: { label: 'Other Document', color: 'text-gray-400' },
};

interface DocumentData {
    id: string;
    shipment_id: string;
    document_type: string;
    document_number?: string;
    version: number;
    status: string;
    file_name: string;
    file_path?: string;
    created_at: string;
}

interface ShipmentData {
    id: string;
    shipment_number: string;
    customer_name?: string;
    origin_port?: string;
    destination_port?: string;
    origin_country?: string;
    destination_country?: string;
    status: string;
}


// Group documents by shipment
interface ShipmentDocGroup {
    shipmentId: string;
    shipmentNumber: string;
    customer: string;
    route: string;
    status: string;
    documents: DocumentData[];
    isExpanded: boolean;
}

export function DocumentList() {
    const [searchParams] = useSearchParams();
    const shipmentIdFilter = searchParams.get('shipmentId');

    const [searchQuery, setSearchQuery] = useState('');
    const [expandedShipments, setExpandedShipments] = useState<Set<string>>(new Set());
    const [uploadingTo, setUploadingTo] = useState<string | null>(null);
    const [shipments, setShipments] = useState<ShipmentData[]>([]);
    const [documents, setDocuments] = useState<DocumentData[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch data from API
    const fetchData = async () => {
        setLoading(true);
        try {
            const [shipmentsData, documentsData] = await Promise.all([
                fetchApi('/api/shipments'),
                fetchApi('/api/documents'),
            ]);

            if (shipmentsData.shipments) {
                setShipments(shipmentsData.shipments);
            }
            if (documentsData.documents) {
                setDocuments(documentsData.documents);
            }
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Auto-expand shipment if filtered
    useEffect(() => {
        if (shipmentIdFilter) {
            setExpandedShipments(new Set([shipmentIdFilter]));
        }
    }, [shipmentIdFilter]);

    // Only show shipments with confirmed statuses (not DRAFT or PENDING)
    const confirmedStatuses = ['BOOKING_CONFIRMED', 'BOOKED', 'DOCUMENTATION_IN_PROGRESS', 'READY_TO', 'LOADING', 'LOADED', 'IN_TRANSIT', 'CUSTOMS_CLEARANCE', 'DELIVERED', 'DRAFT', 'PENDING'];

    // Group documents by shipment
    const shipmentGroups: ShipmentDocGroup[] = shipments
        .filter(s => confirmedStatuses.includes(s.status)) // Only confirmed statuses
        .filter(s => !shipmentIdFilter || s.id === shipmentIdFilter)
        .map(shipment => {
            const shipmentDocs = documents.filter(d => d.shipment_id === shipment.id);

            // Apply search filter
            const filteredDocs = searchQuery
                ? shipmentDocs.filter(d =>
                    d.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    d.document_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (d.document_number || '').toLowerCase().includes(searchQuery.toLowerCase())
                )
                : shipmentDocs;

            const origin = shipment.origin_port || shipment.origin_country || '';
            const destination = shipment.destination_port || shipment.destination_country || '';

            return {
                shipmentId: shipment.id,
                shipmentNumber: shipment.shipment_number,
                customer: shipment.customer_name || 'N/A',
                route: origin && destination ? `${origin} → ${destination}` : 'N/A',
                status: shipment.status,
                documents: filteredDocs,
                isExpanded: expandedShipments.has(shipment.id),
            };
        })
        .filter(group => group.documents.length > 0 || shipmentIdFilter);

    // Toggle shipment expansion
    const toggleShipment = (shipmentId: string) => {
        setExpandedShipments(prev => {
            const next = new Set(prev);
            if (next.has(shipmentId)) {
                next.delete(shipmentId);
            } else {
                next.add(shipmentId);
            }
            return next;
        });
    };

    // Handle file upload — sends files to backend API
    const handleUpload = (shipmentId: string) => {
        setUploadingTo(shipmentId);
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx';
        input.onchange = async (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (!files || files.length === 0) {
                setUploadingTo(null);
                return;
            }

            const toastId = toast.loading(`Uploading ${files.length} file(s)...`);

            try {
                if (files.length === 1) {
                    // Single file upload
                    const formData = new FormData();
                    formData.append('file', files[0]);
                    formData.append('shipmentId', shipmentId);
                    // Auto-detect document type from filename
                    const fileName = files[0].name.toLowerCase();
                    let docType = 'OTHER';
                    if (fileName.includes('invoice') || fileName.includes('commercial')) docType = 'COMMERCIAL_INVOICE';
                    else if (fileName.includes('packing')) docType = 'PACKING_LIST';
                    else if (fileName.includes('lading') || fileName.includes('bl')) docType = 'BILL_OF_LADING';
                    else if (fileName.includes('phyto')) docType = 'PHYTOSANITARY';
                    else if (fileName.includes('origin') || fileName.includes('co_')) docType = 'CERTIFICATE_OF_ORIGIN';
                    else if (fileName.includes('customs')) docType = 'CUSTOMS_DECLARATION';
                    else if (fileName.includes('insurance')) docType = 'INSURANCE';
                    formData.append('documentType', docType);

                    const token = localStorage.getItem('token');
                    const response = await fetch(`${API_URL}/api/documents/upload`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: formData,
                    });
                    if (!response.ok) throw new Error('Upload failed');
                } else {
                    // Multiple file upload
                    const formData = new FormData();
                    for (let i = 0; i < files.length; i++) {
                        formData.append('files', files[i]);
                    }
                    formData.append('shipmentId', shipmentId);
                    formData.append('documentType', 'OTHER');

                    const token = localStorage.getItem('token');
                    const response = await fetch(`${API_URL}/api/documents/upload-multiple`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: formData,
                    });
                    if (!response.ok) throw new Error('Upload failed');
                }

                toast.success(`${files.length} document(s) uploaded successfully!`, { id: toastId });
                fetchData();
            } catch (error) {
                console.error('Upload error:', error);
                toast.error('Failed to upload documents. Please try again.', { id: toastId });
            } finally {
                setUploadingTo(null);
            }
        };
        input.click();
    };

    // Handle download — uses backend API endpoint with auth
    const handleDownload = async (doc: DocumentData) => {
        if (!doc.file_path) {
            toast.error('File not available for download');
            return;
        }
        try {
            const stored = localStorage.getItem('logispro-auth');
            let token = '';
            if (stored) {
                try { token = JSON.parse(stored)?.state?.token || ''; } catch { /* ignore */ }
            }
            const response = await fetch(`${API_URL}/api/documents/${doc.id}/download`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            });
            if (!response.ok) {
                toast.error('File not found on server');
                return;
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = doc.file_name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success(`Downloaded ${doc.file_name}`);
        } catch (error) {
            console.error('Download error:', error);
            toast.error('Download failed');
        }
    };

    // Handle bulk download
    const handleBulkDownload = (group: ShipmentDocGroup) => {
        const downloadableDocs = group.documents.filter(d => d.file_path);
        if (downloadableDocs.length === 0) {
            toast.error('No files available for download');
            return;
        }
        downloadableDocs.forEach((doc, i) => {
            setTimeout(() => handleDownload(doc), i * 500);
        });
        toast.success(`Downloading ${downloadableDocs.length} documents...`);
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'APPROVED': return 'Approved';
            case 'PENDING':
            case 'DRAFT': return 'Pending';
            case 'REJECTED': return 'Rejected';
            default: return status;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'APPROVED': return 'text-green-400';
            case 'PENDING':
            case 'DRAFT': return 'text-yellow-400';
            case 'REJECTED': return 'text-red-400';
            default: return 'text-gray-400';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">
                        {shipmentIdFilter ? 'Shipment Documents' : 'All Documents'}
                    </h1>
                    <p className="text-[hsl(var(--muted-foreground))] mt-1">
                        {shipmentIdFilter
                            ? 'Manage documents for this shipment'
                            : 'Documents organized by shipment for easy management'}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchData}>
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Search */}
            <Card>
                <CardContent className="p-4">
                    <div className="relative">
                        <Input
                            placeholder="Search documents by name, type, or number..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                                onClick={() => setSearchQuery('')}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Documents by Shipment */}
            <div className="space-y-4">
                {shipmentGroups.map((group) => (
                    <Card key={group.shipmentId} className="overflow-hidden">
                        {/* Shipment Header - Clickable */}
                        <div
                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-[hsl(var(--secondary))] transition-colors"
                            onClick={() => toggleShipment(group.shipmentId)}
                        >
                            <div className="flex items-center gap-4">
                                {/* Expand Icon */}
                                <div className="text-[hsl(var(--muted-foreground))]">
                                    {group.isExpanded ? (
                                        <ChevronDown className="w-5 h-5" />
                                    ) : (
                                        <ChevronRight className="w-5 h-5" />
                                    )}
                                </div>

                                {/* Shipment Info */}
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-[hsl(var(--foreground))]">
                                            {group.shipmentNumber}
                                        </span>
                                        <Badge className="text-xs bg-[hsl(var(--secondary))]">
                                            {group.documents.length} docs
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                        {group.customer} • {group.route}
                                    </p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleUpload(group.shipmentId)}
                                    disabled={uploadingTo === group.shipmentId}
                                >
                                    Upload
                                </Button>
                                {group.documents.length > 0 && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleBulkDownload(group)}
                                    >
                                        Download All
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Documents List - Expanded */}
                        {group.isExpanded && (
                            <div className="border-t border-[hsl(var(--border))]">
                                {group.documents.length > 0 ? (
                                    <div className="divide-y divide-[hsl(var(--border))]">
                                        {group.documents.map((doc) => {
                                            const typeInfo = documentTypeInfo[doc.document_type] || documentTypeInfo.OTHER;
                                            return (
                                                <div
                                                    key={doc.id}
                                                    className="flex items-center justify-between p-4 pl-16 hover:bg-[hsl(var(--secondary))] transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {/* Status */}
                                                        <span className={cn("text-xs font-medium", getStatusColor(doc.status))}>
                                                            {getStatusLabel(doc.status)}
                                                        </span>

                                                        {/* Doc Info */}
                                                        <div>
                                                            <p className="font-medium text-[hsl(var(--foreground))]">
                                                                {doc.file_name}
                                                            </p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className={cn("text-xs", typeInfo.color)}>
                                                                    {typeInfo.label}
                                                                </span>
                                                                {doc.document_number && (
                                                                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                                                        #{doc.document_number}
                                                                    </span>
                                                                )}
                                                                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                                                    • {formatDate(doc.created_at)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Doc Actions */}
                                                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            title="Preview"
                                                        >
                                                            Preview
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            title="Download"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDownload(doc);
                                                            }}
                                                        >
                                                            DL
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-red-400"
                                                            title="Delete"
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                e.preventDefault();
                                                                const shouldDelete = window.confirm(`Delete document "${doc.file_name}"?`);
                                                                if (shouldDelete) {
                                                                    try {
                                                                        await fetchApi(`/api/documents/${doc.id}`, {
                                                                            method: 'DELETE',
                                                                        });
                                                                        toast.success('Document deleted');
                                                                        setDocuments(prev => prev.filter(d => d.id !== doc.id));
                                                                    } catch (error) {
                                                                        toast.error('Failed to delete document');
                                                                    }
                                                                }
                                                            }}
                                                        >
                                                            Del
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center">
                                        <p className="text-[hsl(var(--muted-foreground))]">
                                            No documents uploaded yet
                                        </p>
                                        <Button
                                            className="mt-4"
                                            size="sm"
                                            onClick={() => handleUpload(group.shipmentId)}
                                        >
                                            Upload Documents
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>
                ))}

                {shipmentGroups.length === 0 && (
                    <Card>
                        <CardContent className="p-12 text-center">
                            <h3 className="text-xl font-semibold text-[hsl(var(--foreground))]">
                                No documents found
                            </h3>
                            <p className="text-[hsl(var(--muted-foreground))] mt-2">
                                {searchQuery
                                    ? `No results for "${searchQuery}"`
                                    : 'Upload documents to get started'}
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Summary Stats */}
            <Card>
                <CardContent className="p-4">
                    <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                            <p className="text-2xl font-bold text-[hsl(var(--foreground))]">
                                {documents.length}
                            </p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">Total Documents</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-green-400">
                                {documents.filter(d => d.status === 'APPROVED' || d.status === 'VALIDATED').length}
                            </p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">Approved</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-yellow-400">
                                {documents.filter(d => d.status === 'PENDING' || d.status === 'DRAFT' || d.status === 'UPLOADED').length}
                            </p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">Pending Review</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-[hsl(var(--foreground))]">
                                {shipments.length}
                            </p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">Shipments</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div >
    );
}
