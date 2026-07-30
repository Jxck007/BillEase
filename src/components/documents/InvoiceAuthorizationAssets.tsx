import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useData } from '../../context/DataContext';
import { DEFAULT_VISUAL_ASSETS, useVisualAsset } from '../../lib/firebase';

function OptionalDocumentImage({ src, alt, className, defaultAsset = false }: { src: string; alt: string; className: string; defaultAsset?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return <img src={src} alt={alt} className={`${className}${defaultAsset ? ' default-signature-rotation' : ''}`} onError={() => setFailed(true)} />;
}

type DocumentType = 'invoice' | 'quotation' | 'deliveryNote';

export default function InvoiceAuthorizationAssets({ documentType = 'invoice' }: { documentType?: DocumentType }) {
  const signature = useVisualAsset('signature');
  const seal = useVisualAsset('seal');
  const { state } = useData();
  const { t } = useLanguage();
  const signatureEnabled = state.settings.integrations.authorizedSignature
    && state.settings.signatureVisibility[documentType];
  const sealEnabled = state.settings.sealVisibility?.[documentType] !== false;

  return (
    <div className="authorization-assets">
      <div className="company-seal-column">
        {sealEnabled && <OptionalDocumentImage src={seal} alt="Company seal" className="company-seal" />}
      </div>
      <div className="signature-column">
        <span className="authorization-company-name">{t('forCompany').replace('{company}', state.profile.name || t('yourBusiness'))}</span>
        <div className="company-signature-crop">
          {signatureEnabled && (
            <OptionalDocumentImage
              src={signature}
              alt={t('authorizedSignature')}
              className="company-signature"
              defaultAsset={signature === DEFAULT_VISUAL_ASSETS.signature}
            />
          )}
        </div>
        <span className="authorized-signature-label">{t('authorizedSignature')}</span>
      </div>
    </div>
  );
}
