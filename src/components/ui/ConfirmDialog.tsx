import Modal from './Modal';
import { useLanguage } from '../../context/LanguageContext';

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', onCancel, onConfirm }: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useLanguage();
  return (
    <Modal isOpen={open} onClose={onCancel} title={title}>
      <p className="text-sm leading-6 text-stone-600">{message}</p>
      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-stone-100 pt-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="min-h-12 rounded-xl border border-stone-300 px-5 font-semibold text-stone-700">{t('cancel')}</button>
        <button type="button" onClick={onConfirm} className="min-h-12 rounded-xl bg-rose-600 px-5 font-semibold text-white hover:bg-rose-700">{confirmLabel}</button>
      </div>
    </Modal>
  );
}
