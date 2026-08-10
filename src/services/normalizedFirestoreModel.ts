import type { AppState } from '../lib/types';
import { contentHash, sanitizeForFirestore } from './firestoreSerialization';
import { toPaise } from './paymentService';

export const NORMALIZED_SCHEMA_VERSION = 2;
export const DEFAULT_COMPANY_ID = 'kimera-vel-tech';

export const NORMALIZED_COLLECTIONS = [
  'customers',
  'products',
  'invoices',
  'quotations',
  'deliveryNotes',
  'payments',
  'expenses',
  'auditLogs',
] as const;

export type NormalizedCollection = typeof NORMALIZED_COLLECTIONS[number];

export type NormalizedEntityDocument = {
  data: Record<string, unknown>;
  position: number;
  revision: number;
  clientOperationId: string;
  sourceDeviceId: string;
  contentHash: string;
  baseHash: string | null;
  deleted?: boolean;
};

export type NormalizedMigrationPlan = {
  company: {
    schemaVersion: number;
    data: { profile: AppState['profile'] };
    sourceAggregatePath: 'billease/appData';
    sourceAggregateRevision: number;
    sourceChecksum: string;
    migrationState: 'prepared';
    revision: number;
    contentHash: string;
    baseHash: null;
    clientOperationId: string;
    sourceDeviceId: string;
  };
  settings: {
    data: AppState['settings'];
    revision: number;
    clientOperationId: string;
    sourceDeviceId: string;
    contentHash: string;
    baseHash: null;
  };
  collections: Record<NormalizedCollection, NormalizedEntityDocument[]>;
};

export type IntegritySummary = {
  counts: Record<NormalizedCollection, number>;
  ids: Record<NormalizedCollection, string[]>;
  invoiceTotalPaise: number;
  quotationTotalPaise: number;
  paymentEffectPaise: number;
  outstandingPaise: number;
  customerSnapshotHashes: Record<string, string | null>;
  paymentOperationIds: string[];
  stateHash: string;
};

function requiredEntityArray(value: unknown, name: string) {
  if (!Array.isArray(value)) throw new Error(`INVALID_AGGREGATE_COLLECTION:${name}`);
  value.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`INVALID_AGGREGATE_ENTITY:${name}:${index}`);
  });
  return value as Array<{ id: string }>;
}

/**
 * Converts the stored aggregate into its runtime-equivalent state without
 * changing invoice documents. Older aggregate writes could serialize a shared
 * top-level payment reference as null; the same complete payment remains in
 * the invoice history and is recovered into the normalized payment ledger.
 */
export function prepareAggregateStateForMigration(input: AppState): AppState {
  const customers = requiredEntityArray(input.customers, 'customers') as AppState['customers'];
  const products = requiredEntityArray(input.products, 'products') as AppState['products'];
  const invoices = requiredEntityArray(input.invoices, 'invoices') as AppState['invoices'];
  const expenses = requiredEntityArray(input.expenses, 'expenses') as AppState['expenses'];
  const deliveryNotes = requiredEntityArray(input.deliveryNotes, 'deliveryNotes') as AppState['deliveryNotes'];
  const auditLogs = requiredEntityArray(input.auditLogs, 'auditLogs') as AppState['auditLogs'];
  if (!Array.isArray(input.payments)) throw new Error('INVALID_AGGREGATE_COLLECTION:payments');
  const paymentCandidates = [
    ...input.payments.filter((entry): entry is AppState['payments'][number] => Boolean(entry && typeof entry === 'object' && !Array.isArray(entry))),
    ...invoices.flatMap((invoice) => Array.isArray(invoice.payments) ? invoice.payments : []),
  ];
  const payments = new Map<string, AppState['payments'][number]>();
  for (const payment of paymentCandidates) {
    const id = ensureSafeDocumentId(payment.id, 'payments');
    const existing = payments.get(id);
    if (existing && contentHash(existing) !== contentHash(payment)) throw new Error(`CONFLICTING_PAYMENT_COPY:${id}`);
    payments.set(id, payment);
  }
  return {
    ...input,
    customers,
    products,
    invoices,
    payments: [...payments.values()],
    expenses,
    deliveryNotes,
    auditLogs,
  };
}

function ensureSafeDocumentId(id: unknown, collection: string) {
  const value = String(id || '');
  if (!value || value.includes('/') || value === '.' || value === '..') {
    throw new Error(`INVALID_DOCUMENT_ID:${collection}`);
  }
  return value;
}

function ensureUniqueIds(entries: Array<{ id: string }>, collection: string) {
  const ids = entries.map((entry) => ensureSafeDocumentId(entry.id, collection));
  if (new Set(ids).size !== ids.length) throw new Error(`DUPLICATE_ENTITY_ID:${collection}`);
}

function wrap(entries: Array<{ id: string }>, collection: string, sourceOperationId: string, sourceDeviceId: string, positions?: number[]) {
  ensureUniqueIds(entries, collection);
  return entries.map((entry, position) => ({
    data: sanitizeForFirestore(entry) as Record<string, unknown>,
    position: positions?.[position] ?? position,
    revision: 1,
    clientOperationId: `migration:${sourceOperationId}`,
    sourceDeviceId,
    contentHash: contentHash(entry),
    baseHash: null,
  }));
}

export function buildNormalizedMigrationPlan(input: {
  state: AppState;
  aggregateRevision: number;
  aggregateOperationId: string;
  aggregateSourceDeviceId: string;
  sourceChecksum: string;
}): NormalizedMigrationPlan {
  const invoiceEntries = input.state.invoices.map((entry, position) => ({ entry, position }));
  const invoices = invoiceEntries.filter(({ entry }) => entry.type !== 'estimate');
  const quotations = invoiceEntries.filter(({ entry }) => entry.type === 'estimate');
  return {
    company: {
      schemaVersion: NORMALIZED_SCHEMA_VERSION,
      data: { profile: sanitizeForFirestore(input.state.profile) as AppState['profile'] },
      sourceAggregatePath: 'billease/appData',
      sourceAggregateRevision: input.aggregateRevision,
      sourceChecksum: input.sourceChecksum,
      migrationState: 'prepared',
      revision: 1,
      contentHash: contentHash(input.state.profile),
      baseHash: null,
      clientOperationId: `migration:${input.aggregateOperationId}`,
      sourceDeviceId: input.aggregateSourceDeviceId,
    },
    settings: {
      data: sanitizeForFirestore(input.state.settings) as AppState['settings'],
      revision: 1,
      clientOperationId: `migration:${input.aggregateOperationId}`,
      sourceDeviceId: input.aggregateSourceDeviceId,
      contentHash: contentHash(input.state.settings),
      baseHash: null,
    },
    collections: {
      customers: wrap(input.state.customers, 'customers', input.aggregateOperationId, input.aggregateSourceDeviceId),
      products: wrap(input.state.products, 'products', input.aggregateOperationId, input.aggregateSourceDeviceId),
      invoices: wrap(invoices.map(({ entry }) => entry), 'invoices', input.aggregateOperationId, input.aggregateSourceDeviceId, invoices.map(({ position }) => position)),
      quotations: wrap(quotations.map(({ entry }) => entry), 'quotations', input.aggregateOperationId, input.aggregateSourceDeviceId, quotations.map(({ position }) => position)),
      deliveryNotes: wrap(input.state.deliveryNotes, 'deliveryNotes', input.aggregateOperationId, input.aggregateSourceDeviceId),
      payments: wrap(input.state.payments, 'payments', input.aggregateOperationId, input.aggregateSourceDeviceId),
      expenses: wrap(input.state.expenses, 'expenses', input.aggregateOperationId, input.aggregateSourceDeviceId),
      auditLogs: wrap(input.state.auditLogs, 'auditLogs', input.aggregateOperationId, input.aggregateSourceDeviceId),
    },
  };
}

function unwrap<T>(entries: NormalizedEntityDocument[]): T[] {
  return [...entries]
    .sort((left, right) => left.position - right.position)
    .map((entry) => entry.data as T);
}

export function assembleAppState(plan: NormalizedMigrationPlan): AppState {
  const invoices = [
    ...plan.collections.invoices,
    ...plan.collections.quotations,
  ].sort((left, right) => left.position - right.position).map((entry) => entry.data) as unknown as AppState['invoices'];
  return {
    customers: unwrap(plan.collections.customers),
    products: unwrap(plan.collections.products),
    invoices,
    payments: unwrap(plan.collections.payments),
    expenses: unwrap(plan.collections.expenses),
    deliveryNotes: unwrap(plan.collections.deliveryNotes),
    auditLogs: unwrap(plan.collections.auditLogs),
    profile: plan.company.data.profile,
    settings: plan.settings.data,
  };
}

function ids(entries: Array<{ id: string }>) {
  return entries.map((entry) => String(entry.id)).sort();
}

export function summarizeIntegrity(state: AppState): IntegritySummary {
  const invoices = state.invoices.filter((entry) => entry.type !== 'estimate');
  const quotations = state.invoices.filter((entry) => entry.type === 'estimate');
  const collections = {
    customers: state.customers,
    products: state.products,
    invoices,
    quotations,
    deliveryNotes: state.deliveryNotes,
    payments: state.payments,
    expenses: state.expenses,
    auditLogs: state.auditLogs,
  };
  const paymentOperationIds = state.payments.map((entry) => entry.operationId).sort();
  if (new Set(paymentOperationIds).size !== paymentOperationIds.length) {
    throw new Error('DUPLICATE_PAYMENT_OPERATION_ID');
  }
  return {
    counts: Object.fromEntries(NORMALIZED_COLLECTIONS.map((name) => [name, collections[name].length])) as IntegritySummary['counts'],
    ids: Object.fromEntries(NORMALIZED_COLLECTIONS.map((name) => [name, ids(collections[name])])) as IntegritySummary['ids'],
    invoiceTotalPaise: invoices.reduce((sum, entry) => sum + toPaise(entry.total), 0),
    quotationTotalPaise: quotations.reduce((sum, entry) => sum + toPaise(entry.total), 0),
    paymentEffectPaise: state.payments.reduce((sum, entry) => sum + (entry.kind === 'reversal' ? -1 : 1) * Math.max(0, toPaise(entry.amount)), 0),
    outstandingPaise: invoices.filter((entry) => entry.paymentStatus !== 'cancelled').reduce((sum, entry) => sum + toPaise(entry.balanceDue), 0),
    customerSnapshotHashes: Object.fromEntries(state.invoices.map((entry) => [entry.id, entry.customerSnapshot ? contentHash(entry.customerSnapshot) : null])),
    paymentOperationIds,
    // Firestore serialization removes object identity. Clone before hashing so a
    // payment referenced both in the ledger and an invoice is not mistaken for a cycle.
    stateHash: contentHash(JSON.parse(JSON.stringify(state))),
  };
}

export function compareIntegrity(before: AppState, after: AppState) {
  const source = summarizeIntegrity(before);
  const target = summarizeIntegrity(after);
  const differences: string[] = [];
  for (const collection of NORMALIZED_COLLECTIONS) {
    if (source.counts[collection] !== target.counts[collection]) differences.push(`count:${collection}`);
    if (JSON.stringify(source.ids[collection]) !== JSON.stringify(target.ids[collection])) differences.push(`ids:${collection}`);
  }
  for (const field of ['invoiceTotalPaise', 'quotationTotalPaise', 'paymentEffectPaise', 'outstandingPaise', 'customerSnapshotHashes', 'paymentOperationIds', 'stateHash'] as const) {
    if (JSON.stringify(source[field]) !== JSON.stringify(target[field])) differences.push(field);
  }
  return { ok: differences.length === 0, differences, source, target };
}
