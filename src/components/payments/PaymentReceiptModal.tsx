import { useEffect, useRef, useState } from 'react';
import Modal from '../ui/Modal';
import CanonicalDocumentViewport from '../documents/CanonicalDocumentViewport';
import ExportPanel from '../export/ExportPanel';
import PaymentReceiptTemplate from '../../templates/PaymentReceiptTemplate';
import { useData } from '../../context/DataContext';
import type { Invoice, Payment } from '../../lib/types';
import { useLanguage } from '../../context/LanguageContext';

export default function PaymentReceiptModal({ payment, invoice, onClose }: { payment: Payment | null; invoice: Invoice | null; onClose: () => void }) {
  const { state, addAuditLog } = useData();
  const { language } = useLanguage();
  const documentRef = useRef<HTMLDivElement>(null);
  const loggedPaymentId = useRef('');
  const [exportOpen, setExportOpen] = useState(false);
  const customer = invoice ? state.customers.find((entry) => entry.id === invoice.customerId) || invoice.customerSnapshot : null;

  useEffect(() => {
    if (!payment || loggedPaymentId.current === payment.id) return;
    loggedPaymentId.current = payment.id;
    addAuditLog({ entityType: 'receipt', entityId: payment.id, action: 'generated', message: 'receipt generated', meta: { invoiceId: payment.invoiceId } });
  }, [addAuditLog, payment]);

  if (!payment || !invoice) return null;
  return (
    <>
      <Modal isOpen onClose={onClose} title={language === 'ta' ? 'கட்டண ரசீது' : 'Payment receipt'}>
        <div className="max-h-[70vh] overflow-auto">
          <CanonicalDocumentViewport documentRef={documentRef}><PaymentReceiptTemplate payment={payment} invoice={invoice} profile={state.profile} customer={customer as any} /></CanonicalDocumentViewport>
        </div>
        <div className="mt-4 flex justify-end gap-2"><button onClick={onClose} className="rounded-xl px-4 py-3 font-semibold">{language === 'ta' ? 'மூடு' : 'Close'}</button><button onClick={() => setExportOpen(true)} className="rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white">{language === 'ta' ? 'பதிவிறக்கு / பகிர்' : 'Download / share'}</button></div>
      </Modal>
      <ExportPanel isOpen={exportOpen} onClose={() => setExportOpen(false)} documentId={payment.id} documentType="payment-receipt" documentNumber={`R-${payment.id}`} documentLabel="Payment Receipt" updatedAt={payment.createdAt} customerId={invoice.customerId} customerName={customer?.name || 'Customer'} customerPhone={customer?.phone} customerEmail={customer?.email} defaultCcEmail={state.settings.emailCcBusiness ? state.profile.email : ''} emailEnabled={state.settings.integrations.serverEmail} businessName={state.profile.name} exportRootRef={documentRef} onPrint={() => window.print()} widthMm={210} />
    </>
  );
}
