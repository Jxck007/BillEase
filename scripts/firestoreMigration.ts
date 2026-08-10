import fs from 'node:fs';
import path from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, GeoPoint, Timestamp, getFirestore } from 'firebase-admin/firestore';
import type { AppState } from '../src/lib/types';
import {
  DEFAULT_COMPANY_ID,
  NORMALIZED_COLLECTIONS,
  NormalizedEntityDocument,
  NormalizedMigrationPlan,
  assembleAppState,
  buildNormalizedMigrationPlan,
  compareIntegrity,
  prepareAggregateStateForMigration,
  summarizeIntegrity,
} from '../src/services/normalizedFirestoreModel';
import {
  AggregateBackup,
  canonicalJson,
  createAggregateBackup,
  revivePortable,
  sha256,
  verifyAggregateBackup,
} from './lib/migrationBackup';

type Args = Record<string, string | boolean | string[]> & { _: string[] };

function parseArgs(argv: string[]): Args {
  const result: Args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) result._.push(token);
    else if (argv[index + 1] && !argv[index + 1].startsWith('--')) result[token.slice(2)] = argv[++index];
    else result[token.slice(2)] = true;
  }
  return result;
}

function readEnvFile(filename: string) {
  if (!fs.existsSync(filename)) return;
  for (const line of fs.readFileSync(filename, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
}

function safeCompanyId(value: unknown) {
  const companyId = String(value || DEFAULT_COMPANY_ID);
  if (!/^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/.test(companyId)) throw new Error('INVALID_COMPANY_ID');
  return companyId;
}

function initializeDatabase(args: Args) {
  const production = args.production === true;
  readEnvFile('.env.local');
  const serviceAccount = production
    ? JSON.parse(String(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON || ''))
    : null;
  const projectId = production ? String(serviceAccount?.project_id || '') : String(args.project || 'billease-migration-test');
  if (!projectId) throw new Error('PROJECT_ID_MISSING');
  if (production) {
    if (args['confirm-project'] !== projectId) throw new Error('PRODUCTION_PROJECT_CONFIRMATION_REQUIRED');
    delete process.env.FIRESTORE_EMULATOR_HOST;
  } else {
    process.env.FIRESTORE_EMULATOR_HOST = String(process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080');
  }
  const name = `migration-${projectId}`;
  const app = getApps().find((entry) => entry.name === name) || initializeApp(
    production ? { credential: cert(serviceAccount), projectId } : { projectId },
    name,
  );
  return { db: getFirestore(app), projectId, production };
}

function readJson(filename: string) {
  return JSON.parse(fs.readFileSync(path.resolve(filename), 'utf8'));
}

function defaultBackupPath(prefix = 'appData') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.resolve('.vercel/migration-backups', `${prefix}-${timestamp}.json`);
}

function writeSensitiveJson(filename: string, value: unknown) {
  const output = path.resolve(filename);
  fs.mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
  fs.writeFileSync(output, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(output, 0o600);
  return output;
}

function safeIntegrity(value: ReturnType<typeof summarizeIntegrity>) {
  return {
    counts: value.counts,
    idSetChecksums: Object.fromEntries(Object.entries(value.ids).map(([name, ids]) => [name, sha256(ids)])),
    invoiceTotalPaise: value.invoiceTotalPaise,
    quotationTotalPaise: value.quotationTotalPaise,
    paymentEffectPaise: value.paymentEffectPaise,
    outstandingPaise: value.outstandingPaise,
    customerSnapshotChecksum: sha256(value.customerSnapshotHashes),
    paymentOperationIdChecksum: sha256(value.paymentOperationIds),
    stateHash: value.stateHash,
  };
}

function backupFromFile(filename: string) {
  const backup = readJson(filename);
  verifyAggregateBackup(backup);
  return backup;
}

function migrationPlan(backup: AggregateBackup) {
  const sourceState = prepareAggregateStateForMigration(backup.envelope.data);
  const plan = buildNormalizedMigrationPlan({
    state: sourceState,
    aggregateRevision: Number(backup.envelope.revision || 0),
    aggregateOperationId: String(backup.envelope.clientOperationId || backup.checksum),
    aggregateSourceDeviceId: String(backup.envelope.sourceDeviceId || 'aggregate-migration'),
    sourceChecksum: backup.checksum,
  });
  return { plan, sourceState };
}

function normalizedDocuments(companyId: string, plan: NormalizedMigrationPlan) {
  const documents: Array<{ path: string; value: unknown }> = [
    { path: `companies/${companyId}`, value: plan.company },
    { path: `companies/${companyId}/settings/company`, value: plan.settings },
    { path: `companies/${companyId}/migrations/aggregate-v1`, value: {
      schemaVersion: plan.company.schemaVersion,
      sourceChecksum: plan.company.sourceChecksum,
      sourceAggregateRevision: plan.company.sourceAggregateRevision,
      state: 'prepared',
    } },
  ];
  for (const collection of NORMALIZED_COLLECTIONS) {
    for (const entry of plan.collections[collection]) {
      documents.push({ path: `companies/${companyId}/${collection}/${String(entry.data.id)}`, value: entry });
    }
  }
  return documents;
}

async function inspectMigration(db: FirebaseFirestore.Firestore, companyId: string, plan: NormalizedMigrationPlan) {
  const documents = normalizedDocuments(companyId, plan);
  const snapshots = await db.getAll(...documents.map((entry) => db.doc(entry.path)));
  const conflicts: string[] = [];
  let matching = 0;
  let missing = 0;
  snapshots.forEach((snapshot, index) => {
    if (!snapshot.exists) missing += 1;
    else if (canonicalJson(snapshot.data()) === canonicalJson(documents[index].value)) matching += 1;
    else conflicts.push(documents[index].path);
  });
  return { documents, matching, missing, conflicts };
}

async function applyPlan(db: FirebaseFirestore.Firestore, inspection: Awaited<ReturnType<typeof inspectMigration>>) {
  if (inspection.conflicts.length) throw new Error(`NORMALIZED_DOCUMENT_CONFLICT:${inspection.conflicts.join(',')}`);
  const missing = inspection.documents.filter((entry) => true);
  for (let offset = 0; offset < missing.length; offset += 400) {
    const batch = db.batch();
    for (const entry of missing.slice(offset, offset + 400)) {
      const existing = await db.doc(entry.path).get();
      if (!existing.exists) batch.create(db.doc(entry.path), entry.value as FirebaseFirestore.DocumentData);
    }
    await batch.commit();
  }
}

async function readNormalizedPlan(db: FirebaseFirestore.Firestore, companyId: string): Promise<NormalizedMigrationPlan> {
  const [companySnapshot, settingsSnapshot] = await Promise.all([
    db.doc(`companies/${companyId}`).get(),
    db.doc(`companies/${companyId}/settings/company`).get(),
  ]);
  if (!companySnapshot.exists || !settingsSnapshot.exists) throw new Error('NORMALIZED_ROOT_MISSING');
  const collections = {} as NormalizedMigrationPlan['collections'];
  await Promise.all(NORMALIZED_COLLECTIONS.map(async (name) => {
    const snapshot = await db.collection(`companies/${companyId}/${name}`).get();
    collections[name] = snapshot.docs.map((entry) => entry.data() as NormalizedEntityDocument);
  }));
  return {
    company: companySnapshot.data() as NormalizedMigrationPlan['company'],
    settings: settingsSnapshot.data() as NormalizedMigrationPlan['settings'],
    collections,
  };
}

async function commandBackup(args: Args) {
  const { db, projectId } = initializeDatabase(args);
  const snapshot = await db.doc('billease/appData').get();
  if (!snapshot.exists || !snapshot.data()?.data) throw new Error('AGGREGATE_NOT_FOUND');
  const backup = createAggregateBackup(projectId, snapshot.data() as AggregateBackup['envelope']);
  const output = writeSensitiveJson(String(args.output || defaultBackupPath()), backup);
  console.log(JSON.stringify({ command: 'backup', projectId, output, checksum: backup.checksum, integrity: safeIntegrity(summarizeIntegrity(prepareAggregateStateForMigration(backup.envelope.data))) }, null, 2));
}

async function commandMigrate(args: Args) {
  if (!args.backup) throw new Error('BACKUP_ARGUMENT_REQUIRED');
  const backup = backupFromFile(String(args.backup));
  const { db, projectId, production } = initializeDatabase(args);
  if (backup.projectId !== projectId && production) throw new Error('BACKUP_PROJECT_MISMATCH');
  const companyId = safeCompanyId(args.company);
  const { plan, sourceState } = migrationPlan(backup);
  const currentAggregate = await db.doc('billease/appData').get();
  const currentAggregateChecksum = currentAggregate.exists ? sha256(currentAggregate.data()) : null;
  if (production && currentAggregateChecksum !== backup.checksum) throw new Error('AGGREGATE_CHANGED_SINCE_BACKUP');
  const roundTrip = compareIntegrity(sourceState, assembleAppState(plan));
  if (!roundTrip.ok) throw new Error(`MIGRATION_INTEGRITY_FAILED:${roundTrip.differences.join(',')}`);
  const inspection = await inspectMigration(db, companyId, plan);
  if (inspection.conflicts.length) throw new Error(`NORMALIZED_DOCUMENT_CONFLICT:${inspection.conflicts.join(',')}`);
  if (args.apply === true) {
    await applyPlan(db, inspection);
    if (production) {
      const after = await db.doc('billease/appData').get();
      if (!after.exists || sha256(after.data()) !== backup.checksum) throw new Error('AGGREGATE_CHANGED_DURING_MIGRATION');
    }
  }
  console.log(JSON.stringify({ command: 'migrate', mode: args.apply === true ? 'apply' : 'dry-run', projectId, companyId, production, sourceChecksum: backup.checksum, matchingDocuments: inspection.matching, missingDocuments: inspection.missing, integrity: { ok: roundTrip.ok, differences: roundTrip.differences, source: safeIntegrity(roundTrip.source), target: safeIntegrity(roundTrip.target) } }, null, 2));
}

async function commandVerify(args: Args) {
  if (!args.backup) throw new Error('BACKUP_ARGUMENT_REQUIRED');
  const backup = backupFromFile(String(args.backup));
  const { db, projectId } = initializeDatabase(args);
  const companyId = safeCompanyId(args.company);
  const target = assembleAppState(await readNormalizedPlan(db, companyId));
  const comparison = compareIntegrity(prepareAggregateStateForMigration(backup.envelope.data), target);
  if (!comparison.ok) throw new Error(`NORMALIZED_VERIFICATION_FAILED:${comparison.differences.join(',')}`);
  console.log(JSON.stringify({ command: 'verify', projectId, companyId, sourceChecksum: backup.checksum, comparison: { ok: comparison.ok, differences: comparison.differences, source: safeIntegrity(comparison.source), target: safeIntegrity(comparison.target) } }, null, 2));
}

async function commandRestore(args: Args) {
  if (!args.backup) throw new Error('BACKUP_ARGUMENT_REQUIRED');
  const backup = backupFromFile(String(args.backup));
  const { db, projectId, production } = initializeDatabase(args);
  if (backup.projectId !== projectId && production) throw new Error('BACKUP_PROJECT_MISMATCH');
  const snapshot = await db.doc('billease/appData').get();
  const currentChecksum = snapshot.exists ? sha256(snapshot.data()) : null;
  const alreadyRestored = currentChecksum === backup.checksum;
  if (args.apply === true && !alreadyRestored) {
    const safetyBackup = snapshot.exists && snapshot.data()?.data
      ? createAggregateBackup(projectId, snapshot.data() as AggregateBackup['envelope'])
      : null;
    if (safetyBackup) writeSensitiveJson(String(args.output || defaultBackupPath('pre-restore-appData')), safetyBackup);
    await db.doc('billease/appData').set(revivePortable(backup.envelope, { Timestamp, GeoPoint }) as FirebaseFirestore.DocumentData);
  }
  console.log(JSON.stringify({ command: 'restore', mode: args.apply === true ? 'apply' : 'dry-run', projectId, production, backupChecksum: backup.checksum, currentChecksum, alreadyRestored }, null, 2));
}

async function commandRollback(args: Args) {
  const { db, projectId, production } = initializeDatabase(args);
  const companyId = safeCompanyId(args.company);
  const normalized = await readNormalizedPlan(db, companyId);
  const state = assembleAppState(normalized);
  const integrity = summarizeIntegrity(state);
  const aggregateSnapshot = await db.doc('billease/appData').get();
  const currentEnvelope = aggregateSnapshot.data() || {};
  if (args.apply === true) {
    if (aggregateSnapshot.exists && currentEnvelope.data) {
      const safetyBackup = createAggregateBackup(projectId, currentEnvelope as AggregateBackup['envelope']);
      writeSensitiveJson(String(args.output || defaultBackupPath('pre-rollback-appData')), safetyBackup);
    }
    await db.doc('billease/appData').set({
      data: state,
      revision: Number(currentEnvelope.revision || 0) + 1,
      updatedAt: FieldValue.serverTimestamp(),
      clientOperationId: `rollback:${Date.now()}`,
      sourceDeviceId: 'normalized-rollback-tool',
      schemaVersion: 1,
    });
  }
  console.log(JSON.stringify({ command: 'rollback', mode: args.apply === true ? 'apply' : 'dry-run', projectId, companyId, production, normalizedStateHash: integrity.stateHash, integrity: safeIntegrity(integrity) }, null, 2));
}

function usage() {
  console.log(`Usage:
  tsx scripts/firestoreMigration.ts backup [--production --confirm-project PROJECT] [--output FILE]
  tsx scripts/firestoreMigration.ts migrate --backup FILE [--apply] [--company ID]
  tsx scripts/firestoreMigration.ts verify --backup FILE [--company ID]
  tsx scripts/firestoreMigration.ts restore --backup FILE [--apply]
  tsx scripts/firestoreMigration.ts rollback [--apply] [--company ID]

Commands use the Firestore Emulator by default. Production access always requires both
--production and --confirm-project matching the service-account project ID. The aggregate
document is never deleted.`);
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0];
try {
  if (!command || command === 'help') usage();
  else if (command === 'backup') await commandBackup(args);
  else if (command === 'migrate') await commandMigrate(args);
  else if (command === 'verify') await commandVerify(args);
  else if (command === 'restore') await commandRestore(args);
  else if (command === 'rollback') await commandRollback(args);
  else throw new Error('UNKNOWN_COMMAND');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'MIGRATION_COMMAND_FAILED');
  process.exitCode = 1;
}
