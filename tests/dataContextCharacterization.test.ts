import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sourceFiles(directory: string): string[] {
  const absolute = path.join(repositoryRoot, directory);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute).flatMap((entry) => {
    const candidate = path.join(absolute, entry);
    if (statSync(candidate).isDirectory()) return sourceFiles(path.relative(repositoryRoot, candidate));
    return /\.(ts|tsx)$/.test(entry) ? [candidate] : [];
  });
}

const contextSource = readFileSync(path.join(repositoryRoot, 'src/context/DataContext.tsx'), 'utf8');
const dataArchitectureSource = [
  ...sourceFiles('src/context'),
  ...sourceFiles('src/persistence'),
  ...sourceFiles('src/repositories'),
  ...sourceFiles('src/sync'),
].map((file) => readFileSync(file, 'utf8')).join('\n');

test('DataContext public command and sync-status contract remains stable', () => {
  const commands = [
    'retrySync', 'addCustomer', 'updateCustomer', 'deleteCustomer', 'addProduct', 'updateProduct', 'deleteProduct',
    'addInvoice', 'updateInvoice', 'deleteInvoice', 'addPayment', 'reversePayment', 'correctPayment', 'cancelInvoice',
    'addExpense', 'deleteExpense', 'updateProfile', 'updateSettings', 'addAuditLog',
    'addDeliveryNote', 'updateDeliveryNote', 'deleteDeliveryNote',
  ];
  commands.forEach((command) => assert.match(contextSource, new RegExp(`\\b${command}\\b`)));
  ['loading', 'unsaved', 'saving', 'local', 'online', 'offline', 'failed', 'action-required']
    .forEach((status) => assert.match(dataArchitectureSource, new RegExp(`'${status}'`)));
  assert.match(contextSource, /saveIndicator: syncStatus/);
});

test('provider output continues to hide only customer, invoice and delivery-note tombstones', () => {
  assert.match(contextSource, /customers: state\.customers\.filter\(\(entry\) => !entry\.deletedAt\)/);
  assert.match(contextSource, /invoices: state\.invoices\.filter\(\(entry\) => !entry\.deletedAt\)/);
  assert.match(contextSource, /deliveryNotes: state\.deliveryNotes\.filter\(\(entry\) => !entry\.deletedAt\)/);
});

test('hydration preserves legacy payments, customer snapshots and default settings', () => {
  assert.match(dataArchitectureSource, /legacy-payment-/);
  assert.match(dataArchitectureSource, /invoice\.payment\.legacyPreserved/);
  assert.match(dataArchitectureSource, /customerSnapshot\(linkedCustomer\)/);
  assert.match(dataArchitectureSource, /getDefaultSettings\(profile\)/);
  assert.match(dataArchitectureSource, /new Map\(\[\.\.\.normalizedLedger, \.\.\.invoices\.flatMap/);
});

test('local durability and recovery remain ahead of destructive and financial mutations', () => {
  assert.match(dataArchitectureSource, /operation === 'delete' \|\| entityType === 'payment'/);
  assert.match(dataArchitectureSource, /before-delete:/);
  assert.match(dataArchitectureSource, /before-payment-change/);
  assert.match(dataArchitectureSource, /durableWriteQueue\.current\.enqueue/);
  assert.match(dataArchitectureSource, /createNormalizedOutboxOperation/);
  assert.match(dataArchitectureSource, /restoreLegacyOutbox/);
});

test('Firestore listeners ignore cache and pending metadata and preserve conflict copies', () => {
  assert.match(dataArchitectureSource, /includeMetadataChanges: true/);
  assert.match(dataArchitectureSource, /metadata\.hasPendingWrites \|\| .*metadata\.fromCache/);
  assert.match(dataArchitectureSource, /mergeRemoteWithPendingEntities/);
  assert.match(dataArchitectureSource, /incoming-cloud-conflict/);
  assert.match(dataArchitectureSource, /subscribeNormalizedAppState/);
  assert.match(dataArchitectureSource, /return onSnapshot/);
});

test('payment authorization, idempotence and reversal history remain explicit', () => {
  assert.match(dataArchitectureSource, /Administrator access is required/);
  assert.match(dataArchitectureSource, /validateNewPayment/);
  assert.match(dataArchitectureSource, /payment\.operationId === operationId/);
  assert.match(dataArchitectureSource, /kind: 'reversal'/);
  assert.match(dataArchitectureSource, /originalPaymentId/);
  assert.match(dataArchitectureSource, /recalculateInvoicePayments/);
});

test('sync failure messages continue to promise local safety without false acknowledgement', () => {
  assert.match(dataArchitectureSource, /Cloud sync succeeded, but the local recovery copy could not be updated/);
  assert.match(dataArchitectureSource, /Cloud overwrite is blocked/);
  assert.match(dataArchitectureSource, /Your work remains saved on this device/);
  assert.match(dataArchitectureSource, /pendingAcknowledgement\.current = null/);
  assert.match(dataArchitectureSource, /pendingChanges: 0/);
});
