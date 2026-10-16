import Dexie, { type Table } from 'dexie';

export interface ProductRecord {
  id: string; // UUID
  tenantId: string;
  name: string;
  price: number;
  cost: number;
  barcode?: string;
  category?: string;
  stockQty: number;
  updatedAt: string; // ISO string
}

export interface CustomerRecord {
  id: string; // UUID
  tenantId: string;
  name: string;
  phone: string;
  totalUtangBalance: number;
  updatedAt: string;
}

export interface SaleRecord {
  id: string; // UUID
  tenantId: string;
  totalAmount: number;
  paymentMethod: 'Cash' | 'GCash' | 'Split' | 'Utang';
  date: string;
  userId: string;
  customerId?: string;
  cashReceived?: number;
  changeGiven?: number;
}

export interface SaleItemRecord {
  id: string; // UUID
  tenantId: string;
  saleId: string;
  productId: string;
  productName?: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
}

export interface UtangLedgerRecord {
  id: string; // UUID
  tenantId: string;
  customerId: string;
  amount: number;
  type: 'Credit' | 'Payment'; // Credit (utang) | Payment (bayad)
  date: string;
  refSaleId?: string;
  notes?: string;
}

export interface GCashTxnRecord {
  id: string; // UUID
  tenantId: string;
  type: 'CashIn' | 'CashOut';
  amount: number;
  fee: number;
  refNo: string;
  /** Trimmed, lower-cased refNo used for indexed duplicate detection. */
  refNoNorm?: string;
  customerPhone?: string;
  date: string;
  notes?: string;
  /** Flagged if sync detected a duplicate reference number conflict across devices. */
  needsAttention?: boolean;
  syncStatus?: 'Synced' | 'DuplicateRef' | 'Conflict' | 'Failed';
  conflictReason?: string;
}

/** Local audit record for resolving a GCash transaction rejected before sync. */
export interface GCashTxnResolutionRecord {
  /** ID of the original, rejected transaction. */
  gcashTxnId: string;
  tenantId: string;
  resolution: 'Corrected' | 'Voided';
  resolvedAt: string;
  replacementTxnId?: string;
  correctedRefNo?: string;
}

export interface SyncQueueRecord {
  id: string; // syncId UUID
  entity: 'Product' | 'Customer' | 'Sale' | 'UtangLedger' | 'GCashTxn';
  action: 'Insert' | 'Update' | 'Delete';
  timestamp: string; // ISO string
  payload: any;
  status: 'Pending' | 'InFlight' | 'Failed';
  retryCount: number;
  errorMessage?: string;
  queueOrder?: number;
  /** When status became InFlight. Missing or old values are recovered after a reload. */
  inFlightAt?: string;
}

export interface DeadLetterRecord {
  id: string; // original syncId
  entity: string;
  action: string;
  timestamp: string;
  payload: any;
  retryCount: number;
  errorMessage?: string;
  failedAt: string;
}

export type PlanTier = 'Libre' | 'TindahanPro' | 'NegosyoPlus';

export interface TenantRecord {
  id: string; // UUID
  businessName: string;
  tier?: PlanTier;
  subscriptionEndDate?: string;
  updatedAt: string;
}

export function normalizeRef(refNo: string | undefined | null): string {
  return (refNo || '').trim().toLowerCase();
}

export function isGCashTxnUnresolved(txn: Pick<GCashTxnRecord, 'needsAttention' | 'syncStatus'>): boolean {
  return txn.needsAttention === true || txn.syncStatus === 'DuplicateRef' || txn.syncStatus === 'Conflict';
}

export class FluentTindahanDatabase extends Dexie {
  products!: Table<ProductRecord, string>;
  customers!: Table<CustomerRecord, string>;
  sales!: Table<SaleRecord, string>;
  saleItems!: Table<SaleItemRecord, string>;
  utangLedger!: Table<UtangLedgerRecord, string>;
  gcashTxns!: Table<GCashTxnRecord, string>;
  gcashTxnResolutions!: Table<GCashTxnResolutionRecord, string>;
  syncQueue!: Table<SyncQueueRecord, string>;
  deadLetterQueue!: Table<DeadLetterRecord, string>;
  tenants!: Table<TenantRecord, string>;

  constructor(databaseName = 'FluentTindahanDb') {
    super(databaseName);
    this.version(1).stores({
      products: 'id, tenantId, name, barcode, category, updatedAt',
      customers: 'id, tenantId, name, phone, totalUtangBalance, updatedAt',
      sales: 'id, tenantId, date, paymentMethod, customerId',
      saleItems: 'id, tenantId, saleId, productId',
      utangLedger: 'id, tenantId, customerId, type, date, refSaleId',
      gcashTxns: 'id, tenantId, type, date, refNo',
      syncQueue: 'id, entity, status, retryCount, timestamp',
      deadLetterQueue: 'id, entity, failedAt',
      tenants: 'id, tier, subscriptionEndDate, updatedAt'
    });
    this.version(2)
      .stores({
        gcashTxns: 'id, tenantId, type, date, refNo, refNoNorm'
      })
      .upgrade((tx) =>
        tx
          .table('gcashTxns')
          .toCollection()
          .modify((row: GCashTxnRecord) => {
            row.refNoNorm = normalizeRef(row.refNo);
          })
      );
    this.version(3)
      .stores({
        gcashTxns: 'id, tenantId, type, date, refNo, refNoNorm, [tenantId+refNoNorm]'
      })
      .upgrade((tx) =>
        tx
          .table('gcashTxns')
          .toCollection()
          .modify((row: GCashTxnRecord) => {
            if (!row.refNoNorm) {
              row.refNoNorm = normalizeRef(row.refNo);
            }
          })
      );
    this.version(4).stores({
      gcashTxnResolutions: 'gcashTxnId, tenantId, resolution, resolvedAt'
    });
    this.version(5)
      .stores({
        gcashTxns: 'id, tenantId, type, date, refNo, refNoNorm, [tenantId+refNoNorm]'
      })
      .upgrade((tx) =>
        tx
          .table('gcashTxns')
          .toCollection()
          .modify((row: GCashTxnRecord) => {
            row.refNoNorm = normalizeRef(row.refNo);
          })
      );
  }
}

export const db = new FluentTindahanDatabase();
