import { InvoiceTemplateId, TemplateCustomization, TemplateVisibilitySettings } from '../lib/types';

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

export const TEMPLATE_PRESETS: Record<InvoiceTemplateId, Omit<TemplateCustomization, 'templateId'>> = {
  classic: {
    themeColor: '#0f766e',
    fontFamily: 'Inter, sans-serif',
    footerText: 'Thank you for your business',
    headerAlignment: 'left',
    visibility: DEFAULT_TEMPLATE_VISIBILITY,
  },
  modern: {
    themeColor: '#0f172a',
    fontFamily: 'Inter, sans-serif',
    footerText: 'Invoice generated digitally',
    headerAlignment: 'center',
    visibility: { ...DEFAULT_TEMPLATE_VISIBILITY, bankDetails: false },
  },
  thermal: {
    themeColor: '#111827',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    footerText: 'Save paper, print clean',
    headerAlignment: 'center',
    visibility: { ...DEFAULT_TEMPLATE_VISIBILITY, logo: false, address: false, bankDetails: false, signature: false, qrCode: false },
  },
  wholesale: {
    themeColor: '#7c2d12',
    fontFamily: 'Inter, sans-serif',
    footerText: 'Wholesale supply document',
    headerAlignment: 'left',
    visibility: { ...DEFAULT_TEMPLATE_VISIBILITY, discountColumn: true, hsnSac: true, qrCode: true },
  },
  minimal: {
    themeColor: '#1f2937',
    fontFamily: 'Inter, sans-serif',
    footerText: 'Minimal invoice',
    headerAlignment: 'left',
    visibility: { ...DEFAULT_TEMPLATE_VISIBILITY, logo: false, address: false, phoneEmail: false, bankDetails: false, signature: false, qrCode: false, hsnSac: false },
  },
};

export const INVOICE_TEMPLATES = [
  { id: 'classic' as const, title: 'Classic Invoice', tamil: 'பாரம்பரிய பில்' },
  { id: 'modern' as const, title: 'Modern SaaS style', tamil: 'நவீன ஸ்டைல்' },
  { id: 'thermal' as const, title: 'Thermal receipt', tamil: 'தெர்மல் ரெசீட்' },
  { id: 'wholesale' as const, title: 'Wholesale invoice', tamil: 'மொத்த விற்பனை பில்' },
  { id: 'minimal' as const, title: 'Minimal clean', tamil: 'எளிய வடிவம்' },
];