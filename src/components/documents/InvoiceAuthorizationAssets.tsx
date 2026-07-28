import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { useVisualAsset } from '../../lib/firebase';

function OptionalDocumentImage({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
}

type DocumentType = 'invoice' | 'quotation' | 'deliveryNote';

export default function InvoiceAuthorizationAssets({ documentType = 'invoice' }: { documentType?: DocumentType }) {
  const signature = useVisualAsset('signature');
  const seal = useVisualAsset('seal');
  const { state } = useData();
  const signatureEnabled = state.settings.integrations.authorizedSignature
    && state.settings.signatureVisibility[documentType];
  const sealEnabled = state.settings.sealVisibility?.[documentType] !== false;

  return (
    <div className="authorization-assets">
      <div className="company-seal-column">
        {sealEnabled && <OptionalDocumentImage src={seal} alt="Company seal" className="company-seal" />}
      </div>
      <div className="signature-column">
        {signatureEnabled && <OptionalDocumentImage src={signature} alt="Authorized signature" className="company-signature" />}
        <span className="authorized-signature-label">Authorized Signature</span>
      </div>
    </div>
  );
}
