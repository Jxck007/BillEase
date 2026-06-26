import { useLanguage } from '../../context/LanguageContext';
import { useHelp } from '../../context/HelpContext';
import { Languages, HelpCircle, PlusCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Navbar() {
  const { language, setLanguage } = useLanguage();
  const { openHelp } = useHelp();

  return (
    <header className="print:hidden h-20 bg-white/95 md:bg-white/90 md:backdrop-blur border-b border-stone-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-20">
      <div className="min-w-0">
        <h2 className="text-xl font-bold text-stone-800 hidden md:block">
          {language === 'en' ? 'Good Morning!' : 'காலை வணக்கம்!'}
        </h2>
        <p className="text-xs text-stone-500 hidden md:block">{language === 'en' ? 'Fast GST billing for small businesses' : 'சிறு வியாபாரங்களுக்கான GST பில்லிங்'}</p>
      </div>
      <div className="flex items-center space-x-2 sm:space-x-3">
        <Link 
          to="/invoices/new" 
          className="hidden sm:flex bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold items-center gap-2 transition-all shadow-lg shadow-emerald-100 mr-1"
        >
          <PlusCircle size={18} />
          <span className="text-sm">{language === 'en' ? 'New Invoice' : 'புதிய பில்'}</span>
        </Link>
        <button
          onClick={() => setLanguage(language === 'en' ? 'ta' : 'en')}
          className="flex items-center text-sm font-medium text-stone-600 hover:text-emerald-600 transition-colors bg-stone-50 px-3 py-2 rounded-xl border border-stone-200"
        >
          <Languages size={16} className="mr-2" />
          <span className="hidden sm:inline">{language === 'en' ? 'தமிழ் (Change to Tamil)' : 'English (Change to English)'}</span>
          <span className="sm:hidden">{language === 'en' ? 'TA' : 'EN'}</span>
        </button>
        <button
          onClick={() => openHelp()}
          className="flex items-center text-sm font-medium text-stone-600 hover:text-emerald-600 transition-colors bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100"
        >
          <HelpCircle size={16} className="mr-2 text-emerald-600" />
          {language === 'en' ? 'Help' : 'உதவி'}
        </button>
      </div>
    </header>
  );
}
