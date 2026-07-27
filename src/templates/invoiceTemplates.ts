import { TemplateCustomization, TemplateVisibilitySettings } from '../lib/types';

export const DEFAULT_TEMPLATE_VISIBILITY: TemplateVisibilitySettings = {
  logo: true,
  gstNumber: true,
  address: true,
  phoneEmail: true,
  discountColumn: true,
  hsnSac: true,
  taxBreakdown: true,
  signature: true,
  terms: true,
  qrCode: true,
  bankDetails: true,
};

export const CANONICAL_TEMPLATE_PRESET: Omit<TemplateCustomization, 'templateId'> = {
  themeColor: '#0f766e',
  fontFamily: 'Inter, sans-serif',
  footerText: 'Thank you for your business',
  headerAlignment: 'left',
  visibility: DEFAULT_TEMPLATE_VISIBILITY,
};

export const CANONICAL_TEMPLATE = { id: 'canonical' as const, title: 'Tax Invoice', tamil: 'வரி பில்' };
