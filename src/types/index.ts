// Types for the Export Logistics Management System

export type ShipmentType = 'FCL' | 'AIR';

export type ShipmentStatus =
    | 'DRAFT'
    | 'BOOKING_CONFIRMED'
    | 'DOCUMENTATION_IN_PROGRESS'
    | 'READY_TO_LOAD'
    | 'LOADING'
    | 'LOADED'
    | 'CUSTOMS_SUBMITTED'
    | 'CUSTOMS_CLEARED'
    | 'IN_TRANSIT'
    | 'ARRIVED'
    | 'DELIVERED'
    | 'COMPLETED';

export type DocumentType =
    | 'COMMERCIAL_INVOICE'
    | 'PACKING_LIST'
    | 'BILL_OF_LADING'
    | 'CERTIFICATE_OF_ORIGIN'
    | 'PHYTOSANITARY'
    | 'CUSTOMS_DECLARATION'
    | 'INSURANCE';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface Shipment {
    id: string;
    shipmentNumber: string;
    type: ShipmentType;
    status: ShipmentStatus;
    customer: Customer;
    forwarder: ServiceProvider;
    origin: string;
    destination: string;
    cargoDescription: string;
    quantity: number;
    weight: number; // in kg
    volume: number; // in CBM
    etd: string; // Estimated Time of Departure
    eta: string; // Estimated Time of Arrival
    actualDeparture?: string;
    actualArrival?: string;
    containerNumber?: string;
    vesselName?: string;
    flightNumber?: string;
    bookingId?: string;
    sealNumber?: string;
    bookingNumber?: string;
    product?: string;
    hsCode?: string;
    vesselFlight?: string;
    voyage?: string;
    totalCost: number;
    currency: string;
    incoterm: string;
    riskScore: number;
    riskLevel: RiskLevel;
    documents: Document[];
    costs: Cost[];
    timeline: TimelineEvent[];
    createdAt: string;
    updatedAt: string;
}

export interface Customer {
    id: string;
    name: string;
    code: string;
    country: string;
    contact: string;
    email: string;
}

export interface ServiceProvider {
    id: string;
    name: string;
    code: string;
    type: 'FORWARDER' | 'TRANSPORT' | 'SHIPPING_LINE' | 'CUSTOMS_BROKER';
    performanceScore: number;
    grade: Grade;
    onTimeRate: number;
    docAccuracyRate: number;
    costCompetitiveness: number;
    communicationScore: number;
    complianceScore: number;
    contact: string;
    email: string;
    status: 'ACTIVE' | 'INACTIVE' | 'BLACKLIST';
}

export interface Booking {
    id: string;
    bookingNumber: string;
    type: ShipmentType;
    forwarder: ServiceProvider;
    status: 'PENDING' | 'AVAILABLE' | 'CONFIRMED' | 'ALLOCATED' | 'USED' | 'CANCELLED' | 'EXPIRED';
    route: string;
    vesselFlight: string;
    etd: string;
    eta: string;
    cutOffSI: string;
    cutOffVGM: string;
    cutOffCargo: string;
    containerType: string;
    freightRate: number;
    currency: string;
    validityDate: string;
    allocatedShipmentId?: string;
    createdAt: string;
}

export interface Document {
    id: string;
    shipmentId: string;
    type: DocumentType;
    documentNumber: string;
    version: number;
    status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
    filePath: string;
    fileName: string;
    ocrData?: Record<string, unknown>;
    validationResults?: ValidationResult;
    aiConfidenceScore?: number;
    discrepancies?: Discrepancy[];
    issueDate?: string;
    expiryDate?: string;
    issuer?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    fieldValidations: FieldValidation[];
}

export interface FieldValidation {
    field: string;
    value: string;
    isValid: boolean;
    message?: string;
    confidence?: number;
}

export interface Discrepancy {
    id: string;
    type: 'PRICE' | 'QUANTITY' | 'CALCULATION' | 'DUPLICATE' | 'MISSING_INFO';
    field: string;
    expectedValue: string;
    actualValue: string;
    difference?: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
}

export interface Cost {
    id: string;
    shipmentId: string;
    type: 'FREIGHT' | 'THC' | 'DOCUMENTATION' | 'CUSTOMS' | 'INSPECTION' | 'TRANSPORT' | 'INSURANCE' | 'STORAGE' | 'OTHER';
    description: string;
    amount: number;
    currency: string;
    exchangeRate: number;
    amountUSD: number;
    chargedBy: string;
    invoiceNumber?: string;
    status: 'ESTIMATED' | 'INVOICED' | 'PAID';
    budgetAmount?: number;
    variance?: number;
    isAnomaly?: boolean;
    anomalyReason?: string;
    dueDate?: string;
    paymentDate?: string;
}

export interface TimelineEvent {
    id: string;
    shipmentId: string;
    event: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED';
    expectedDate: string;
    actualDate?: string;
    notes?: string;
    createdAt: string;
}

export interface Risk {
    id: string;
    shipmentId: string;
    category: 'OPERATIONAL' | 'COMPLIANCE' | 'FINANCIAL' | 'QUALITY' | 'EXTERNAL';
    type: string;
    description: string;
    probability: number; // 0-100
    impact: number; // 1-5
    riskScore: number;
    level: RiskLevel;
    status: 'IDENTIFIED' | 'MITIGATING' | 'RESOLVED' | 'MATERIALIZED';
    mitigationPlan?: string;
    mitigationOwner?: string;
    identifiedAt: string;
    resolvedAt?: string;
    aiDetected: boolean;
    aiConfidence?: number;
    aiRecommendation?: string;
}

export interface Alert {
    id: string;
    type: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
    category: string;
    title: string;
    message: string;
    entityType: 'SHIPMENT' | 'BOOKING' | 'DOCUMENT' | 'INVOICE' | 'PROVIDER';
    entityId: string;
    isRead: boolean;
    createdAt: string;
}

export interface Invoice {
    id: string;
    invoiceNumber: string;
    forwarderId: string;
    shipmentId: string;
    filePath: string;
    ocrData?: Record<string, unknown>;
    lineItems: InvoiceLineItem[];
    totalAmount: number;
    currency: string;
    invoiceDate: string;
    dueDate: string;
    validationStatus: 'PENDING' | 'VALIDATED' | 'DISCREPANCY';
    discrepancies: Discrepancy[];
    approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
    approvedBy?: string;
    approvedAt?: string;
    paymentStatus: 'UNPAID' | 'SCHEDULED' | 'PAID' | 'OVERDUE';
    paidAt?: string;
}

export interface InvoiceLineItem {
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    matchedCostType?: Cost['type'];
}

export interface DashboardMetrics {
    activeShipments: number;
    inTransit: number;
    atCustoms: number;
    loading: number;
    onTimeRate: number;
    onTimeRateTrend: number; // percentage change
    totalShipmentValue: number;
    totalLogisticsCost: number;
    costPercentage: number;
    costSavings: number;
    documentationAccuracy: number;
    avgClearanceTime: number;
    bookingUtilization: number;
    pendingActions: number;
    criticalAlerts: number;
}

export interface AIMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    actions?: AIAction[];
    isLoading?: boolean;
}

export interface AIAction {
    type: 'VIEW' | 'EDIT' | 'DOWNLOAD' | 'APPROVE' | 'REJECT';
    label: string;
    entityType: string;
    entityId: string;
}
