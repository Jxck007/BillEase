import { Language } from './types';

export const TRANSLATIONS: Record<string, Record<Language, string>> = {
  // Navigation
  dashboard: { en: 'Dashboard', ta: 'முகப்பு' },
  customers: { en: 'Customers', ta: 'வாடிக்கையாளர்கள்' },
  products: { en: 'Items / Products', ta: 'பொருட்கள்' },
  invoices: { en: 'Invoices', ta: 'விலைப்பட்டியல்கள்' },
  estimates: { en: 'Estimates', ta: 'மதிப்பீடுகள்' },
  payments: { en: 'Payments', ta: 'கட்டணங்கள்' },
  paymentsReceipts: { en: 'Payments & Receipts', ta: 'கட்டணங்கள் மற்றும் ரசீதுகள்' },
  expenses: { en: 'Expenses', ta: 'செலவுகள்' },
  reports: { en: 'Reports', ta: 'அறிக்கைகள்' },
  settings: { en: 'Settings', ta: 'அமைப்புகள்' },
  language: { en: 'Language', ta: 'மொழி' },
  help: { en: 'Help', ta: 'உதவி' },
  theme: { en: 'Theme', ta: 'தீம்' },
  template: { en: 'Template', ta: 'டெம்ப்ளேட்' },

  // Common Actions
  save: { en: 'Save', ta: 'சேமி' },
  cancel: { en: 'Cancel', ta: 'ரத்து செய்' },
  delete: { en: 'Delete', ta: 'நீக்கு' },
  edit: { en: 'Edit', ta: 'திருத்து' },
  add: { en: 'Add New', ta: 'புதிதாக சேர்' },
  search: { en: 'Search...', ta: 'தேடு...' },
  view: { en: 'View', ta: 'பார்' },
  print: { en: 'Print', ta: 'அச்சிடு' },
  share: { en: 'Share', ta: 'பகிர்' },
  back: { en: 'Back', ta: 'பின்செல்' },
  export: { en: 'Export', ta: 'ஏற்றுமதி' },
  duplicate: { en: 'Duplicate', ta: 'நகலெடு' },
  draft: { en: 'Draft', ta: 'வரைவு' },
  retry: { en: 'Retry', ta: 'மீண்டும் முயலவும்' },
  lastSaved: { en: 'Last saved', ta: 'கடைசியாகச் சேமித்தது' },
  loadingSavedRecords: { en: 'Opening records saved on this device…', ta: 'இந்தச் சாதனத்தில் சேமித்த பதிவுகள் திறக்கப்படுகின்றன…' },
  savingOnDevice: { en: 'Saving changes on this device…', ta: 'மாற்றங்கள் இந்தச் சாதனத்தில் சேமிக்கப்படுகின்றன…' },
  savedOnDeviceSyncPending: { en: 'Saved on this device. Cloud sync is pending.', ta: 'இந்தச் சாதனத்தில் சேமிக்கப்பட்டது. மேக ஒத்திசைவு நிலுவையில் உள்ளது.' },
  syncingToCloud: { en: 'Saved on this device. Syncing to the cloud…', ta: 'இந்தச் சாதனத்தில் சேமிக்கப்பட்டது. மேகத்துடன் ஒத்திசைக்கப்படுகிறது…' },
  savedAndCloudSynced: { en: 'Saved on this device and synced to the cloud.', ta: 'இந்தச் சாதனத்தில் சேமிக்கப்பட்டு மேகத்துடன் ஒத்திசைக்கப்பட்டது.' },
  noInternetSavedOnDevice: { en: 'No internet. Your changes are saved safely on this device.', ta: 'இணையம் இல்லை. உங்கள் மாற்றங்கள் இந்தச் சாதனத்தில் பாதுகாப்பாகச் சேமிக்கப்பட்டுள்ளன.' },
  cloudUnavailableSavedOnDevice: { en: 'Cloud is unavailable. Your work is safe on this device.', ta: 'மேகச் சேவை கிடைக்கவில்லை. உங்கள் பணி இந்தச் சாதனத்தில் பாதுகாப்பாக உள்ளது.' },
  savedOnDeviceCloudUnavailable: { en: 'Saved on this device. Cloud sync is not available.', ta: 'இந்தச் சாதனத்தில் சேமிக்கப்பட்டது. மேக ஒத்திசைவு கிடைக்கவில்லை.' },
  syncFailedSavedOnDevice: { en: 'Cloud sync failed. Your work is safe on this device.', ta: 'மேக ஒத்திசைவு தோல்வியடைந்தது. உங்கள் பணி இந்தச் சாதனத்தில் பாதுகாப்பாக உள்ளது.' },
  savedDataNeedsAttention: { en: 'Your work is saved, but one item needs attention.', ta: 'உங்கள் பணி சேமிக்கப்பட்டது; ஒரு விஷயம் கவனிக்கப்பட வேண்டும்.' },

  // Dashboard
  unpaidInvoices: { en: 'Unpaid Invoices', ta: 'பணம் வராத பில்கள்' },
  createInvoice: { en: 'Create Invoice', ta: 'புதிய பில் போடு' },
  addCustomer: { en: 'Add Customer', ta: 'புதிய வாடிக்கையாளர்' },

  // Customers
  customerName: { en: 'Customer Name', ta: 'பெயர்' },
  phone: { en: 'Phone Number', ta: 'போன் நம்பர்' },
  email: { en: 'Email', ta: 'இமெயில்' },
  address: { en: 'Address', ta: 'முகவரி' },
  gstin: { en: 'GSTIN / Tax ID', ta: 'GST எண்' },
  notes: { en: 'Notes', ta: 'குறிப்புகள்' },
  saveCustomer: { en: 'Save Customer', ta: 'வாடிக்கையாளரை சேமி' },

  // Products
  price: { en: 'Price', ta: 'விலை' },
  unit: { en: 'Unit (e.g. kg, pcs)', ta: 'அலகு (kg, pcs)' },
  taxRate: { en: 'Tax Rate (%)', ta: 'வரி (%)' },

  // Invoices
  invoiceNumber: { en: 'Invoice Number', ta: 'பில் எண்' },
  date: { en: 'Date', ta: 'தேதி' },
  dueDate: { en: 'Due Date', ta: 'கடைசி தேதி' },
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
  paid: { en: 'Paid', ta: 'செலுத்தப்பட்டது' },
  unpaid: { en: 'Unpaid', ta: 'செலுத்தப்படவில்லை' },
  partial: { en: 'Partial', ta: 'பகுதி செலுத்தப்பட்டது' },
  partially_paid: { en: 'Partially Paid', ta: 'பகுதி செலுத்தப்பட்டது' },
  overdue: { en: 'Overdue', ta: 'காலாவதியானது' },
  cancelled: { en: 'Cancelled', ta: 'ரத்து செய்யப்பட்டது' },
  recordPayment: { en: 'Record Payment', ta: 'பணம் வரவு வை' },
  gstNumber: { en: 'GST Number', ta: 'ஜிஎஸ்டி எண்' },
  placeOfSupply: { en: 'Place of Supply', ta: 'விநியோக இடம்' },
  reverseCharge: { en: 'Reverse Charge', ta: 'ரிவர்ஸ் சார்ஜ்' },
  hsnSac: { en: 'HSN / SAC Code', ta: 'HSN / SAC குறியீடு' },
  shipping: { en: 'Shipping', ta: 'கப்பல்/அனுப்புதல்' },
  adjustment: { en: 'Adjustment', ta: 'சரி செய்த தொகை' },
  taxableAmount: { en: 'Taxable Amount', ta: 'வரி விதிக்கப்படும் தொகை' },
  grandTotal: { en: 'Grand Total', ta: 'மொத்தத் தொகை' },

  // Navigation and delivery
  create: { en: 'Create', ta: 'உருவாக்கு' },
  records: { en: 'Records', ta: 'பதிவுகள்' },
  more: { en: 'More', ta: 'மேலும்' },
  company: { en: 'Company', ta: 'நிறுவனம்' },
  logout: { en: 'Logout', ta: 'வெளியேறு' },
  menu: { en: 'Menu', ta: 'பட்டியல்' },
  newInvoice: { en: 'New Invoice', ta: 'புதிய விலைப்பட்டியல்' },
  newQuotation: { en: 'New Quotation', ta: 'புதிய விலைமதிப்பீடு' },
  newDeliveryNote: { en: 'New Delivery Note', ta: 'புதிய விநியோகக் குறிப்பு' },
  quotations: { en: 'Quotations', ta: 'விலைமதிப்பீடுகள்' },
  deliveryNotes: { en: 'Delivery Notes', ta: 'விநியோகக் குறிப்புகள்' },
  quickCreate: { en: 'Quick create', ta: 'விரைவாக உருவாக்கு' },
  openQuickCreate: { en: 'Open quick create menu', ta: 'விரைவாக உருவாக்கும் பட்டியலைத் திற' },
  mobileNavigation: { en: 'Mobile navigation', ta: 'கைபேசி வழிசெலுத்தல்' },
  simpleBusinessBilling: { en: 'Simple business billing', ta: 'எளிய வணிக பில்லிங்' },
  exportShare: { en: 'Export & Share', ta: 'ஏற்றுமதி மற்றும் பகிர்வு' },
  downloadPdf: { en: 'Download PDF', ta: 'PDF பதிவிறக்கு' },
  downloadImage: { en: 'Download Image', ta: 'படமாக பதிவிறக்கு' },
  shareDocument: { en: 'Share Document', ta: 'ஆவணத்தைப் பகிர்' },
  sharePdf: { en: 'Share PDF', ta: 'PDF-ஐப் பகிர்' },
  sendEmail: { en: 'Send Email', ta: 'மின்னஞ்சல் அனுப்பு' },
  openWhatsApp: { en: 'Open Customer Chat', ta: 'வாடிக்கையாளர் உரையாடலைத் திற' },
  browserPrintDialog: { en: 'Browser print dialog', ta: 'உலாவி அச்சு சாளரம்' },
  cachedPdfFile: { en: 'Cached PDF file', ta: 'சேமிக்கப்பட்ட PDF கோப்பு' },
  pngImage: { en: 'PNG image', ta: 'PNG படம்' },
  nativePdfShare: { en: 'Native PDF share', ta: 'சாதன PDF பகிர்வு' },
  pdfViaGmail: { en: 'PDF via Gmail', ta: 'Gmail மூலம் PDF' },
  providerUnavailable: { en: 'Provider unavailable', ta: 'சேவை கிடைக்கவில்லை' },
  customerChatNoAttachment: { en: 'Open customer chat; no automatic attachment', ta: 'வாடிக்கையாளர் உரையாடலைத் திற; கோப்பு தானாக இணைக்கப்படாது' },
  tapToOpenWhatsApp: { en: 'Tap to open WhatsApp', ta: 'WhatsApp திறக்கத் தட்டவும்' },
  systemFileSharingUnavailable: { en: 'System file sharing is unavailable in this browser.', ta: 'இந்த உலாவியில் சாதனக் கோப்பு பகிர்வு கிடைக்கவில்லை.' },
  providerStatusFallbacks: { en: 'Email status is unavailable. Download, print, native share and customer chat remain available.', ta: 'மின்னஞ்சல் நிலை கிடைக்கவில்லை. பதிவிறக்கம், அச்சு, சாதனப் பகிர்வு மற்றும் வாடிக்கையாளர் உரையாடல் தொடர்ந்து கிடைக்கும்.' },
  preparingDocument: { en: 'Preparing document…', ta: 'ஆவணம் தயாராகிறது…' },
  pdfDownloaded: { en: 'PDF downloaded.', ta: 'PDF பதிவிறக்கப்பட்டது.' },
  imageDownloaded: { en: 'Image downloaded.', ta: 'படம் பதிவிறக்கப்பட்டது.' },
  printDialogOpened: { en: 'Print dialog opened.', ta: 'அச்சு சாளரம் திறக்கப்பட்டது.' },
  sendDocumentByEmail: { en: 'Send document by email', ta: 'ஆவணத்தை மின்னஞ்சலில் அனுப்பு' },
  reviewRecipientMessage: { en: 'Review the recipient and message before sending.', ta: 'அனுப்புவதற்கு முன் பெறுநரையும் செய்தியையும் சரிபார்க்கவும்.' },
  closeDeliveryComposer: { en: 'Close delivery composer', ta: 'மின்னஞ்சல் சாளரத்தை மூடு' },
  to: { en: 'To', ta: 'பெறுநர்' },
  ccOptional: { en: 'CC (optional)', ta: 'நகல் (விருப்பம்)' },
  subject: { en: 'Subject', ta: 'தலைப்பு' },
  message: { en: 'Message', ta: 'செய்தி' },
  sending: { en: 'Sending…', ta: 'அனுப்பப்படுகிறது…' },
  sent: { en: 'Sent', ta: 'அனுப்பப்பட்டது' },
  emailSent: { en: 'Email sent.', ta: 'மின்னஞ்சல் அனுப்பப்பட்டது.' },
  alreadySent: { en: 'This document was already sent.', ta: 'இந்த ஆவணம் ஏற்கனவே அனுப்பப்பட்டது.' },
  validRecipientEmail: { en: 'Enter a valid recipient email address.', ta: 'சரியான பெறுநர் மின்னஞ்சல் முகவரியை உள்ளிடவும்.' },
  validCcEmail: { en: 'Enter a valid CC email address.', ta: 'சரியான நகல் மின்னஞ்சல் முகவரியை உள்ளிடவும்.' },
  subjectMessageRequired: { en: 'Subject and message are required.', ta: 'தலைப்பும் செய்தியும் அவசியம்.' },
  attachmentTooLarge: { en: 'The attachment is larger than the 2 MB delivery limit.', ta: 'இணைப்புக் கோப்பு 2 MB வரம்பை மீறுகிறது.' },
  attachmentPreparationFailed: { en: 'Could not prepare the attachment. Try again.', ta: 'இணைப்புக் கோப்பைத் தயாரிக்க முடியவில்லை. மீண்டும் முயலவும்.' },
  emailSendFallback: { en: 'Could not send the document. Try again.', ta: 'ஆவணத்தை அனுப்ப முடியவில்லை. மீண்டும் முயலவும்.' },

  // Canonical documents
  forCompany: { en: 'For {company}', ta: '{company} நிறுவனத்திற்காக' },
  yourBusiness: { en: 'Your Business', ta: 'உங்கள் நிறுவனம்' },
  authorizedSignature: { en: 'Authorized Signature', ta: 'அங்கீகரிக்கப்பட்ட கையொப்பம்' },
  computerGeneratedDocument: { en: 'This is a Computer Generated Document.', ta: 'இது கணினி மூலம் உருவாக்கப்பட்ட ஆவணம்.' },
  taxInvoice: { en: 'TAX INVOICE', ta: 'வரி விலைப்பட்டியல்' },
  invoiceNo: { en: 'Invoice No', ta: 'விலைப்பட்டியல் எண்' },
  buyer: { en: 'Buyer', ta: 'வாங்குபவர்' },
  descriptionOfGoods: { en: 'Description of Goods', ta: 'பொருட்களின் விவரம்' },
  rate: { en: 'Rate', ta: 'விலை' },
  totalAmount: { en: 'Total Amount', ta: 'மொத்தத் தொகை' },
  bankDetails: { en: 'Bank Details', ta: 'வங்கி விவரங்கள்' },
  amountInWords: { en: 'Amount chargeable (in words)', ta: 'செலுத்த வேண்டிய தொகை (எழுத்தில்)' },
  customerSignature: { en: 'Customer Signature', ta: 'வாடிக்கையாளர் கையொப்பம்' },
  deliveryNote: { en: 'DELIVERY NOTE', ta: 'விநியோகக் குறிப்பு' },
  consigneeNameAddress: { en: 'Name and Address of the Consignee', ta: 'பெறுநரின் பெயர் மற்றும் முகவரி' },
  noGoodsAdded: { en: 'No goods added', ta: 'பொருட்கள் சேர்க்கப்படவில்லை' },
};

const missingTranslationKeys = new Set<string>();

if (import.meta.env.DEV) {
  for (const [key, values] of Object.entries(TRANSLATIONS)) {
    for (const language of ['en', 'ta'] as const) {
      if (!values[language]?.trim()) {
        console.warn(`[i18n] Missing ${language} translation for "${key}"`);
      }
    }
  }
}

export function t(key: string, lang: Language): string {
  const value = TRANSLATIONS[key]?.[lang];
  if (!value && import.meta.env.DEV && !missingTranslationKeys.has(key)) {
    missingTranslationKeys.add(key);
    console.warn(`[i18n] Missing ${lang} translation for "${key}"`);
  }
  return value || key;
}
