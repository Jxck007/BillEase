import { Language } from './types';

export const TRANSLATIONS: Record<string, Record<Language, string>> = {
  // Navigation
  dashboard: { en: 'Dashboard', ta: 'டேஷ்போர்டு (முகப்பு)' },
  customers: { en: 'Customers', ta: 'வாடிக்கையாளர்கள்' },
  products: { en: 'Items / Products', ta: 'பொருட்கள் (Items)' },
  invoices: { en: 'Invoices', ta: 'பில்கள் (Invoices)' },
  estimates: { en: 'Estimates', ta: 'மதிப்பீடுகள் (Estimates)' },
  payments: { en: 'Payments', ta: 'ரசீதுகள் (Payments)' },
  expenses: { en: 'Expenses', ta: 'செலவுகள் (Expenses)' },
  reports: { en: 'Reports', ta: 'அறிக்கைகள் (Reports)' },
  settings: { en: 'Settings', ta: 'அமைப்புகள் (Settings)' },
  language: { en: 'Language', ta: 'மொழி' },
  help: { en: 'Help', ta: 'உதவி' },
  theme: { en: 'Theme', ta: 'தீம்' },
  template: { en: 'Template', ta: 'டெம்ப்ளேட்' },

  // Common Actions
  save: { en: 'Save', ta: 'சேமி (Save)' },
  cancel: { en: 'Cancel', ta: 'ரத்து செய் (Cancel)' },
  delete: { en: 'Delete', ta: 'அழி (Delete)' },
  edit: { en: 'Edit', ta: 'மாற்று (Edit)' },
  add: { en: 'Add New', ta: 'புதிதாக சேர் (Add New)' },
  addNew: { en: 'Add New', ta: 'புதிதாக சேர்' },
  search: { en: 'Search...', ta: 'தேடு... (Search)' },
  view: { en: 'View', ta: 'பார் (View)' },
  print: { en: 'Print', ta: 'பிரிண்ட் (Print)' },
  share: { en: 'Share', ta: 'பகிர் (Share)' },
  back: { en: 'Back', ta: 'பின்செல் (Back)' },
  export: { en: 'Export', ta: 'ஏற்றுமதி' },
  duplicate: { en: 'Duplicate', ta: 'நகலெடு' },
  draft: { en: 'Draft', ta: 'வரைவு' },

  // Dashboard
  todaySales: { en: "Today's Sales", ta: 'இன்றைய விற்பனை' },
  unpaidInvoices: { en: 'Unpaid Invoices', ta: 'பணம் வராத பில்கள்' },
  totalCustomers: { en: 'Total Customers', ta: 'மொத்த வாடிக்கையாளர்கள்' },
  recentActivity: { en: 'Recent Activity', ta: 'சமீபத்திய நடவடிக்கைகள்' },
  quickActions: { en: 'Quick Actions', ta: 'உடனடி செயல்கள்' },
  createInvoice: { en: 'Create Invoice', ta: 'புதிய பில் போடு' },
  addCustomer: { en: 'Add Customer', ta: 'புதிய வாடிக்கையாளர்' },

  // Customers
  customerName: { en: 'Customer Name', ta: 'பெயர்' },
  phone: { en: 'Phone Number', ta: 'போன் நம்பர்' },
  email: { en: 'Email', ta: 'இமெயில்' },
  address: { en: 'Address', ta: 'முகவரி' },
  gstin: { en: 'GSTIN / Tax ID', ta: 'GST எண்' },
  notes: { en: 'Notes', ta: 'குறிப்புகள்' },
  noCustomers: { en: 'No customers yet', ta: 'வாடிக்கையாளர்கள் இல்லை' },
  addCustomerToStart: { en: 'Add your first customer to get started.', ta: 'தொடங்க முதல் வாடிக்கையாளரை உள்ளிடவும்.' },
  saveCustomer: { en: 'Save Customer', ta: 'வாடிக்கையாளரை சேமி' },

  // Products
  itemName: { en: 'Item Name', ta: 'பொருள் பெயர்' },
  price: { en: 'Price', ta: 'விலை' },
  unit: { en: 'Unit (e.g. kg, pcs)', ta: 'அலகு (kg, pcs)' },
  taxRate: { en: 'Tax Rate (%)', ta: 'வரி (%)' },
  noProducts: { en: 'No items yet', ta: 'பொருட்கள் இல்லை' },
  addItemToStart: { en: 'Add items or services you sell.', ta: 'நீங்கள் விற்கும் பொருட்களை உள்ளிடவும்.' },

  // Invoices
  invoiceNumber: { en: 'Invoice Number', ta: 'பில் எண்' },
  date: { en: 'Date', ta: 'தேதி' },
  dueDate: { en: 'Due Date', ta: 'கடைசி தேதி' },
  selectCustomer: { en: 'Select Customer', ta: 'வாடிக்கையாளரை தேர்வு செய்' },
  addItem: { en: 'Add Item', ta: 'பொருள் சேர்' },
  quantity: { en: 'Quantity', ta: 'அளவு (Qty)' },
  total: { en: 'Total', ta: 'மொத்தம்' },
  subtotal: { en: 'Subtotal', ta: 'கூட்டுத்தொகை' },
  tax: { en: 'Tax', ta: 'வரி (Tax)' },
  cgst: { en: 'CGST', ta: 'CGST' },
  sgst: { en: 'SGST', ta: 'SGST' },
  igst: { en: 'IGST', ta: 'IGST' },
  discount: { en: 'Discount', ta: 'தள்ளுபடி' },
  balanceDue: { en: 'Balance Due', ta: 'வர வேண்டிய தொகை' },
  status: { en: 'Status', ta: 'நிலை' },
  paid: { en: 'Paid', ta: 'பணம் வந்தது (Paid)' },
  unpaid: { en: 'Unpaid', ta: 'பணம் வரவில்லை (Unpaid)' },
  partial: { en: 'Partial', ta: 'பாதி பணம் (Partial)' },
  recordPayment: { en: 'Record Payment', ta: 'பணம் வரவு வை' },
  gstNumber: { en: 'GST Number', ta: 'ஜிஎஸ்டி எண்' },
  placeOfSupply: { en: 'Place of Supply', ta: 'விநியோக இடம்' },
  reverseCharge: { en: 'Reverse Charge', ta: 'ரிவர்ஸ் சார்ஜ்' },
  hsnSac: { en: 'HSN / SAC Code', ta: 'HSN / SAC குறியீடு' },
  shipping: { en: 'Shipping', ta: 'கப்பல்/அனுப்புதல்' },
  adjustment: { en: 'Adjustment', ta: 'சரி செய்த தொகை' },
  taxableAmount: { en: 'Taxable Amount', ta: 'வரி விதிக்கப்படும் தொகை' },
  grandTotal: { en: 'Grand Total', ta: 'மொத்தத் தொகை' },
  invoiceSaved: { en: 'Invoice saved', ta: 'பில் சேமிக்கப்பட்டது' },
  draftSaved: { en: 'Draft saved automatically', ta: 'வரைவு தானாக சேமிக்கப்பட்டது' },
  noData: { en: 'No data yet', ta: 'தரவுகள் இல்லை' },

  // Help Panel
  helpTitle: { en: 'How can I help you?', ta: 'நான் எப்படி உதவலாம்?' },
  helpSearchPlaceholder: { en: 'Ask a question...', ta: 'கேள்வி கேளுங்கள்...' },
  faq: { en: 'Frequently Asked Questions', ta: 'பொதுவான கேள்விகள்' },
  whatIsGst: { en: 'What is GST?', ta: 'GST என்றால் என்ன?' },
  createInvoiceHelp: { en: 'How to create an invoice', ta: 'பில் உருவாக்குவது எப்படி?' },
  exportPdfHelp: { en: 'How to export PDF', ta: 'PDF ஆக எடுப்பது எப்படி?' },
  whatsappHelp: { en: 'How to send via WhatsApp', ta: 'WhatsApp மூலம் அனுப்புவது எப்படி?' },
  paymentTrackingHelp: { en: 'How to track payments', ta: 'பண வரவை கண்காணிப்பது எப்படி?' },
};

export function t(key: string, lang: Language): string {
  return TRANSLATIONS[key]?.[lang] || key;
}
