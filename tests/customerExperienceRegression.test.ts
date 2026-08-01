import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('customer form defaults to one primary address and reveals shipping only when requested', () => {
  const customers = source('src/pages/Customers.tsx');
  assert.match(customers, /useDifferentShippingAddress: false/);
  assert.match(customers, /Use a different shipping address/);
  assert.match(customers, /formData\.useDifferentShippingAddress &&/);
});

test('legacy shipping data is preserved and automatically recognized', () => {
  const schema = source('src/lib/entitySchemas.ts');
  assert.match(schema, /typeof source\.useDifferentShippingAddress === 'boolean'/);
  assert.match(schema, /Boolean\(shippingAddress && shippingAddress !== address\)/);
  assert.match(schema, /shippingAddress,/);
  assert.match(schema, /shippingPin: text\(source\.shippingPin\)/);
  assert.match(source('src/templates/IndustrialDeliveryNoteTemplate.tsx'), /useDifferentShippingAddress && customer\.shippingAddress/);
});

test('unconfigured PIN lookup is a quiet manual six-digit field', () => {
  const field = source('src/components/forms/PinLookupField.tsx');
  const disabledBranch = field.match(/if \(!enabled\) \{([\s\S]*?)\n    \}/)?.[1] || '';
  assert.doesNotMatch(disabledBranch, /setStatus|postalProvider|auth/);
  assert.match(field, /enabled && \(loading/);
  assert.match(field, /maxLength=\{6\}/);
  assert.match(source('src/lib/entitySchemas.ts'), /customer\.pin\.invalid/);
});

test('customer details use one modal or mobile bottom sheet without inline expansion', () => {
  const customers = source('src/pages/Customers.tsx');
  assert.match(customers, /mobileSheet/);
  assert.match(customers, /View Documents/);
  assert.match(customers, /Payments recorded/);
  assert.doesNotMatch(customers, /selectedCustomer && \(\s*<section/);
  assert.match(source('src/components/ui/Modal.tsx'), /items-end sm:items-center/);
});
