import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

type Finding = { file: string; rule: string };

const trackedFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const textExtensions = new Set([
  '.cjs', '.css', '.html', '.js', '.json', '.jsx', '.md', '.mjs', '.rules', '.ts', '.tsx', '.txt', '.yaml', '.yml',
]);
const ignoredFiles = new Set(['package-lock.json']);
const findings: Finding[] = [];

const detectors: Array<{ name: string; pattern: RegExp }> = [
  { name: 'private-key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'google-api-key', pattern: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'google-oauth-token', pattern: /ya29\.[0-9A-Za-z_-]{20,}/ },
  { name: 'github-token', pattern: /gh[oprsu]_[0-9A-Za-z]{30,}/ },
  { name: 'slack-token', pattern: /xox[baprs]-[0-9A-Za-z-]{20,}/ },
  { name: 'embedded-service-account', pattern: /FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON\s*=\s*\{[^\n]*"private_key"/ },
  { name: 'vite-privileged-variable', pattern: /VITE_[A-Z0-9_]*(?:SECRET|PASSWORD|PRIVATE_KEY|SERVICE_ACCOUNT)\s*=/ },
];

for (const file of trackedFiles) {
  if (ignoredFiles.has(file) || !fs.existsSync(file)) continue;
  const extension = file.includes('.') ? file.slice(file.lastIndexOf('.')) : '';
  if (!textExtensions.has(extension) && !file.startsWith('.env')) continue;
  const content = fs.readFileSync(file, 'utf8');
  for (const detector of detectors) {
    if (detector.pattern.test(content)) findings.push({ file, rule: detector.name });
  }
  for (const match of content.matchAll(/GMAIL_SMTP_APP_PASSWORD\s*=\s*([^\r\n]+)/g)) {
    const assigned = match[1].trim().replace(/;$/, '').trim().replace(/^['"`]|['"`]$/g, '');
    if (assigned && !/^(replace_|mock-|test-)/.test(assigned) && !assigned.includes('process.env')) {
      findings.push({ file, rule: 'gmail-app-password' });
    }
  }
}

const trackedEnvironmentFiles = trackedFiles.filter((file) => /(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith('.example'));
for (const file of trackedEnvironmentFiles) findings.push({ file, rule: 'tracked-environment-file' });

if (findings.length) {
  console.error('Secret scan failed. Potential credentials were found:');
  findings.forEach((finding) => console.error(`- ${finding.file}: ${finding.rule}`));
  process.exitCode = 1;
} else {
  console.log(`Secret scan passed (${trackedFiles.length} tracked files inspected).`);
}
