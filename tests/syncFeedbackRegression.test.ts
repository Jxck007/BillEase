import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { boundedSyncBackoff, isMatchingServerAcknowledgement, syncPresentationState } from '../src/services/syncPolicy';

test('only a matching authoritative server snapshot acknowledges a pending change', () => {
  const pending = { operationId: 'op-2', hash: 'hash-2' };
  assert.equal(isMatchingServerAcknowledgement({ fromCache: false, hasPendingWrites: false, operationId: 'op-2', hash: 'hash-2' }, pending), true);
  assert.equal(isMatchingServerAcknowledgement({ fromCache: true, hasPendingWrites: false, operationId: 'op-2', hash: 'hash-2' }, pending), false);
  assert.equal(isMatchingServerAcknowledgement({ fromCache: false, hasPendingWrites: true, operationId: 'op-2', hash: 'hash-2' }, pending), false);
  assert.equal(isMatchingServerAcknowledgement({ fromCache: false, hasPendingWrites: false, operationId: 'stale-op', hash: 'hash-2' }, pending), false);
  assert.equal(isMatchingServerAcknowledgement({ fromCache: false, hasPendingWrites: false, operationId: 'op-2', hash: 'stale-hash' }, pending), false);
});

test('sync presentation distinguishes saved, offline, authentication, service and failure states', () => {
  assert.equal(syncPresentationState({ pendingChanges: 0, online: true, signedIn: true, cloudAvailable: true }), 'saved');
  assert.equal(syncPresentationState({ pendingChanges: 1, online: false, signedIn: true, cloudAvailable: true }), 'offline');
  assert.equal(syncPresentationState({ pendingChanges: 1, online: true, signedIn: false, cloudAvailable: true }), 'sign-in-required');
  assert.equal(syncPresentationState({ pendingChanges: 1, online: true, signedIn: true, cloudAvailable: false }), 'cloud-unavailable');
  assert.equal(syncPresentationState({ pendingChanges: 1, online: true, signedIn: true, cloudAvailable: true, failed: true }), 'failed');
});

test('retries use bounded exponential backoff', () => {
  assert.equal(boundedSyncBackoff(0, 0), 250);
  assert.equal(boundedSyncBackoff(1, 0), 500);
  assert.equal(boundedSyncBackoff(2, 149), 1149);
  assert.equal(boundedSyncBackoff(10, 149), 5000);
});

test('DataContext clears real pending state after the matching snapshot without deleting local data', () => {
  const source = readFileSync(new URL('../src/context/DataContext.tsx', import.meta.url), 'utf8');
  const hydrationSource = readFileSync(new URL('../src/persistence/useDataHydration.ts', import.meta.url), 'utf8');
  assert.match(source, /pendingAcknowledgement\.current = null/);
  assert.match(source, /pendingChanges: 0/);
  assert.match(source, /persistLocal\(stateRef\.current, false\)/);
  assert.doesNotMatch(source, /clear.*queue/i);
  assert.match(source, /shouldQueueCloud = firebaseStatus\.configured/);
  assert.match(source, /pendingChanges: shouldQueueCloud \? \(normalizedMode \? normalizedOutbox\.current\.length : 1\) : 0/);
  assert.match(hydrationSource, /effectiveDirty = local\.dirty && firebaseConfigured/);
  assert.match(hydrationSource, /local\.dirty && !effectiveDirty/);
});
