import { useLanguage } from '../../context/LanguageContext';
import { useHelp } from '../../context/HelpContext';
import { Languages, HelpCircle } from 'lucide-react';
import GlobalSearch from '../search/GlobalSearch';

export default function Navbar() {
  const { language, setLanguage, t } = useLanguage();
  const { openHelp } = useHelp();

  return (
    <header className="print:hidden sticky top-0 z-20 flex min-h-[72px] items-center gap-2 border-b border-stone-200 bg-white px-3 sm:px-4 md:px-6">
      <GlobalSearch />
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setLanguage(language === 'en' ? 'ta' : 'en')}
          className="flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-700 hover:border-emerald-300 hover:text-emerald-700"
          aria-label={language === 'en' ? 'தமிழுக்கு மாற்று' : 'Change language to English'}
        >
          <Languages size={19} />
          <span>{language === 'en' ? 'தமிழ்' : 'English'}</span>
        </button>
        <button
          type="button"
          onClick={() => openHelp()}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700"
          aria-label={t('help')}
        >
          <HelpCircle size={19} />
          <span className="hidden min-[390px]:inline">{t('help')}</span>
        </button>
      </div>
    </header>
  );
}
