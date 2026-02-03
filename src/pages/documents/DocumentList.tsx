import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    FileText,
    Upload,
    Search,
    Download,
    Trash2,
    CheckCircle,
    AlertTriangle,
    Sparkles,
    Ship,
    ChevronDown,
    ChevronRight,
    FolderOpen,
    Eye,
    Clock,
    Loader2,
    RefreshCw,
} from 'lucide-react';
import { Card, CardContent, Button, Input, Badge } from '@/components/ui';
import { formatDate, cn } from '@/lib/utils';
import { DocumentAISidebar } from '@/components/documents';
import toast from 'react-hot-toast';

// Document types with icons
const documentTypeInfo: Record<string, { label: string; icon: string; color: string }> = {
    COMMERCIAL_INVOICE: { label: 'Commercial Invoice', icon: '📄', color: 'text-blue-400' },
    PACKING_LIST: { label: 'Packing List', icon: '📦', color: 'text-green-400' },
    BILL_OF_LADING: { label: 'Bill of Lading', icon: '🚢', color: 'text-cyan-400' },
    PHYTOSANITARY: { label: 'Phytosanitary Certificate', icon: '🌿', color: 'text-emerald-400' },
    CERTIFICATE_OF_ORIGIN: { label: 'Certificate of Origin', icon: '📜', color: 'text-amber-400' },
    CUSTOMS_DECLARATION: { label: 'Customs Declaration', icon: '🛃', color: 'text-purple-400' },
    INSURANCE: { label: 'Insurance Certificate', icon: '🛡️', color: 'text-indigo-400' },
    OTHER: { label: 'Other Document', icon: '📎', color: 'text-gray-400' },
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

interface SelectedDocument {
    id: string;
    fileName: string;
    type: string;
    shipmentId: string;
    shipmentNumber?: string;
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
    const [showAISidebar, setShowAISidebar] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState<SelectedDocument | null>(null);
    const [expandedShipments, setExpandedShipments] = useState<Set<string>>(new Set());
    const [uploadingTo, setUploadingTo] = useState<string | null>(null);
    const [shipments, setShipments] = useState<ShipmentData[]>([]);
    const [documents, setDocuments] = useState<DocumentData[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch data from API
    const fetchData = async () => {
        setLoading(true);
        try {
            const [shipmentsRes, documentsRes] = await Promise.all([
                fetch('http://localhost:3001/api/shipments'),
                fetch('http://localhost:3001/api/documents'),
            ]);

            const shipmentsData = await shipmentsRes.json();
            const documentsData = await documentsRes.json();

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
    const confirmedStatuses = ['BOOKING_CONFIRMED', 'DOCUMENTATION_IN', 'READY_TO', 'LOADING', 'LOADED', 'IN_TRANSIT', 'CUSTOMS_CLEARANCE', 'DELIVERED'];

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

    // Open AI Analysis
    const openAIAnalysis = (doc: DocumentData, shipmentNumber: string) => {
        setSelectedDoc({
            id: doc.id,
            fileName: doc.file_name,
            type: doc.document_type,
            shipmentId: doc.shipment_id,
            shipmentNumber,
        });
        setShowAISidebar(true);
    };

    // Handle file upload
    const handleUpload = (shipmentId: string) => {
        setUploadingTo(shipmentId);
        // Create file input
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx';
        input.onchange = async (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files && files.length > 0) {
                toast.success(`Uploading ${files.length} file(s) to shipment...`);
                // In real app, would upload to backend
                setTimeout(() => {
                    toast.success('Documents uploaded successfully!');
                    setUploadingTo(null);
                    fetchData();
                }, 1500);
            }
        };
        input.click();
    };

    // Handle download
    const handleDownload = (doc: DocumentData) => {
        toast.success(`Downloading ${doc.file_name}...`);
    };

    // Handle bulk download
    const handleBulkDownload = (group: ShipmentDocGroup) => {
        toast.success(`Downloading ${group.documents.length} documents as ZIP...`);
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'APPROVED':
                return <CheckCircle className="w-4 h-4 text-green-400" />;
            case 'PENDING':
            case 'DRAFT':
                return <Clock className="w-4 h-4 text-yellow-400" />;
            case 'REJECTED':
                return <AlertTriangle className="w-4 h-4 text-red-400" />;
            default:
                return <FileText className="w-4 h-4 text-gray-400" />;
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
        <>
            <DocumentAISidebar
                isOpen={showAISidebar}
                onClose={() => setShowAISidebar(false)}
                document={selectedDoc}
            />

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
                        <Button variant="outline" onClick={fetchData}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Refresh
                        </Button>
                        <Button variant="outline">
                            <Sparkles className="w-4 h-4 mr-2" />
                            AI Verify All
                        </Button>
                    </div>
                </div>

                {/* Search */}
                <Card>
                    <CardContent className="p-4">
                        <div className="relative">
                            <Input
                                placeholder="Search documents by name, type, or number..."
                                icon={<Search className="w-4 h-4" />}
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

                                    {/* Shipment Icon */}
                                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                        <Ship className="w-5 h-5 text-blue-400" />
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
                                        <Upload className="w-4 h-4 mr-1" />
                                        Upload
                                    </Button>
                                    {group.documents.length > 0 && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleBulkDownload(group)}
                                        >
                                            <Download className="w-4 h-4 mr-1" />
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
                                                            {/* Status Icon */}
                                                            {getStatusIcon(doc.status)}

                                                            {/* Doc Icon */}
                                                            <span className="text-xl">{typeInfo.icon}</span>

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
                                                        <div className="flex items-center gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                title="AI Analyze"
                                                                onClick={() => openAIAnalysis(doc, group.shipmentNumber)}
                                                            >
                                                                <Sparkles className="w-4 h-4 text-purple-400" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                title="Preview"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                title="Download"
                                                                onClick={() => handleDownload(doc)}
                                                            >
                                                                <Download className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-red-400"
                                                                title="Delete"
                                                                onClick={async () => {
                                                                    if (confirm(`Delete document ${doc.document_type}?`)) {
                                                                        try {
                                                                            const response = await fetch(`http://localhost:3001/api/documents/${doc.id}`, {
                                                                                method: 'DELETE',
                                                                            });
                                                                            if (response.ok) {
                                                                                toast.success('Document deleted');
                                                                                fetchData();
                                                                            } else {
                                                                                toast.error('Failed to delete document');
                                                                            }
                                                                        } catch (error) {
                                                                            toast.error('Failed to delete document');
                                                                        }
                                                                    }
                                                                }}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="p-8 text-center">
                                            <FolderOpen className="w-12 h-12 mx-auto text-[hsl(var(--muted-foreground))] mb-4" />
                                            <p className="text-[hsl(var(--muted-foreground))]">
                                                No documents uploaded yet
                                            </p>
                                            <Button
                                                className="mt-4"
                                                onClick={() => handleUpload(group.shipmentId)}
                                            >
                                                <Upload className="w-4 h-4 mr-2" />
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
                                <FileText className="w-16 h-16 mx-auto text-[hsl(var(--muted-foreground))] mb-4" />
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
                                    {documents.filter(d => d.status === 'APPROVED').length}
                                </p>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">Approved</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-yellow-400">
                                    {documents.filter(d => d.status === 'PENDING' || d.status === 'DRAFT').length}
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
            </div>
        </>
    );
}
