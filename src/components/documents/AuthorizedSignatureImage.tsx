import { useVisualAsset } from '../../lib/firebase';
import { useData } from '../../context/DataContext';

export default function AuthorizedSignatureImage({ enabled, documentType, className = '' }: { enabled: boolean; documentType: 'invoice' | 'quotation' | 'deliveryNote'; className?: string }) {
  const signature = useVisualAsset('signature');
  const { state } = useData();
  if (!enabled || !state.settings.integrations.authorizedSignature || !state.settings.signatureVisibility[documentType] || !signature) return null;
  return <img src={signature} alt="Authorized signature" className={`object-contain ${className}`} />;
}
