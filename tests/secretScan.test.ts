import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../scripts/secretScan.ts', import.meta.url), 'utf8');

test('secret scan covers privileged Firebase, Google, GitHub, Slack and Gmail credentials', () => {
  assert.match(source, /private-key/);
  assert.match(source, /google-api-key/);
  assert.match(source, /google-oauth-token/);
  assert.match(source, /github-token/);
  assert.match(source, /slack-token/);
  assert.match(source, /embedded-service-account/);
  assert.match(source, /vite-privileged-variable/);
  assert.match(source, /gmail-app-password/);
});

test('secret scan examines only tracked files and rejects tracked non-example environment files', () => {
  assert.match(source, /git', \['ls-files', '-z'\]/);
  assert.match(source, /tracked-environment-file/);
  assert.match(source, /!file\.endsWith\('\.example'\)/);
});
