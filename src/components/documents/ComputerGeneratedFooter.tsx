import { useLanguage } from '../../context/LanguageContext';

export default function ComputerGeneratedFooter() {
  const { t } = useLanguage();

  return <footer className="document-final-footer">{t('computerGeneratedDocument')}</footer>;
}
