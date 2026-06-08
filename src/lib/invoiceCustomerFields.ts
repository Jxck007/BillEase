import { CustomerFieldVisibility } from './types';

export const DEFAULT_CUSTOMER_FIELD_VISIBILITY: CustomerFieldVisibility = {
  address: true,
  phone: true,
  email: true,
  gstNumber: true,
};

export const CUSTOMER_FIELD_OPTIONS: Array<{ key: keyof CustomerFieldVisibility; label: string }> = [
  { key: 'address', label: 'Address' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'gstNumber', label: 'GSTIN' },
];

export function withDefaultCustomerFieldVisibility(value?: CustomerFieldVisibility): CustomerFieldVisibility {
  return { ...DEFAULT_CUSTOMER_FIELD_VISIBILITY, ...(value || {}) };
}
