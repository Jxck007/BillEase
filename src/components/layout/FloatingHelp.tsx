import { useHelp } from '../../context/HelpContext';
import { useLanguage } from '../../context/LanguageContext';
import { X, Info, MessageSquareQuote, ShieldQuestion, FileText, Smartphone, CreditCard } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

export default function FloatingHelp() {
  const { isOpen, closeHelp } = useHelp();
  const { language } = useLanguage();
  const location = useLocation();
  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && (window.innerWidth < 1024 || window.matchMedia('(prefers-reduced-motion: reduce)').matches),
    [],
  );

  const getHelpContent = () => {
    let topicKey = 'general';
    if (location.pathname.includes('/invoices')) topicKey = 'invoices';
    if (location.pathname.includes('/estimates')) topicKey = 'estimates';
    if (location.pathname.includes('/customers')) topicKey = 'customers';
    if (location.pathname.includes('/products')) topicKey = 'products';
    if (location.pathname.includes('/payments')) topicKey = 'payments';

    const content: Record<string, { title: { en: string; ta: string }, desc: { en: string; ta: string }, points: {en: string; ta: string}[], faqs: {en: string; ta: string}[], mistakes: {en: string; ta: string}[] }> = {
      'general': {
        title: { en: 'Welcome to BillEase', ta: 'பில்-ஈஸ் தளத்திற்கு நல்வரவு' },
        desc: { en: 'Here you can easily manage your billing.', ta: 'இங்கு நீங்கள் எளிதாக உங்கள் பில்களை நிர்வகிக்கலாம்.' },
        points: [
          { en: 'Click Invoices to create a new bill.', ta: 'புதிய பில் போட "பில்கள்" (Invoices) பகுதிக்கு செல்லவும்.' },
          { en: 'Click Customers to save your client details.', ta: 'உங்கள் வாடிக்கையாளர் விவரங்களை "வாடிக்கையாளர்கள்" (Customers) பகுதியில் சேமிக்கலாம்.' },
        ]
        ,faqs: [
          { en: 'What is GST?', ta: 'GST என்பது பொருட்கள் மற்றும் சேவைகளுக்கான வரி.' },
          { en: 'Can I work in Tamil?', ta: 'ஆம். முழு செயலியும் தமிழிலும் இயங்கும்.' },
        ],
        mistakes: [
          { en: 'Don\'t leave customer phone blank if you want WhatsApp sharing.', ta: 'WhatsApp அனுப்ப வேண்டுமெனில் வாடிக்கையாளர் போன் எண் வேண்டும்.' },
          { en: 'Use the correct GST number and state code for tax split.', ta: 'சரியான GST எண் மற்றும் state code பயன்படுத்தவும்.' },
        ]
      },
      'invoices': {
        title: { en: 'How to use Invoices', ta: 'பில்கள் (Invoices) பயன்படுத்துவது எப்படி?' },
        desc: { en: 'Create, print and share your bills from here.', ta: 'புதிய பில்களை உருவாக்க, பிரிண்ட் எடுக்க மற்றும் வாடிக்கையாளருக்கு பகிரலாம்.' },
        points: [
          { en: 'Click "Create Invoice" to start a new bill.', ta: '"புதிய பில் போடு" பட்டனை கிளிக் செய்து ஆரம்பிக்கவும்.' },
          { en: 'Select a customer or add a new one.', ta: 'பழைய வாடிக்கையாளரை தேர்வு செய்யலாம் அல்லது புதியவரை சேர்க்கலாம்.' },
          { en: 'Add your items and quantities.', ta: 'பொருட்கள் மற்றும் அளவை உள்ளிடவும்.' },
          { en: 'Save and then you can Print or Share.', ta: 'சேமித்து பிரிண்ட் அல்லது ஷேர் செய்து கொள்ளலாம்.' }
        ],
        faqs: [
          { en: 'How do I save a draft?', ta: 'விவரங்கள் உள்ளிடும்போதே draft தானாக சேமிக்கப்படும்.' },
          { en: 'Can I duplicate an invoice?', ta: 'ஆம். புதிய பில் உருவாக்க duplicate பயன்படுத்தலாம்.' },
        ],
        mistakes: [
          { en: 'Always select a customer before saving.', ta: 'சேமிப்பதற்கு முன் வாடிக்கையாளரை தேர்வு செய்யுங்கள்.' },
          { en: 'Check GST mode and place of supply for interstate billing.', ta: 'Interstate billing-க்கு GST mode மற்றும் place of supply சரிபார்க்கவும்.' },
        ]
      },
      'estimates': {
        title: { en: 'Estimates/Quotations', ta: 'மதிப்பீடுகள் (Quotations)' },
        desc: { en: 'Create quotes before the actual bill.', ta: 'உண்மையான பில் போடுவதற்கு முன் கொடுக்கும் தோராய மதிப்பீடுகள்.' },
        points: [
          { en: 'Click "Create Estimate".', ta: '"புதிய மதிப்பீடு" பட்டனை கிளிக் செய்யவும்.' },
          { en: 'Select customer and items like a regular invoice.', ta: 'சாதாரண பில் போடுவது போலவே பொருட்களையும் வாடிக்கையாளரையும் தேர்வு செய்யவும்.' },
          { en: 'This will not affect your total sales until paid.', ta: 'இது உங்கள் விற்பனை கணக்கில் சேராது.' }
        ],
        faqs: [
          { en: 'Does an estimate become an invoice automatically?', ta: 'அது draft ஆக மட்டும் இருக்கும்; பின்னர் invoice ஆக மாற்றலாம்.' },
        ],
        mistakes: [
          { en: 'Do not record payments against estimates.', ta: 'மதிப்பீடுகளுக்கு payment பதிவு செய்ய வேண்டாம்.' },
        ]
      },
      'customers': {
         title: { en: 'Managing Customers', ta: 'வாடிக்கையாளர் நிர்வகிப்பு' },
         desc: { en: 'Save customer details to reuse them later.', ta: 'வாடிக்கையாளர் விவரங்களை சேமித்து வைத்தால் பில் போடும்போது எளிதாக இருக்கும்.' },
         points: [
           { en: 'Click "Add Customer" to save a new contact.', ta: 'புதிய நபரை சேர்க்க "புதிய வாடிக்கையாளர்" கிளிக் செய்யவும்.' },
           { en: 'GSTIN and Email are optional.', ta: 'GST எண் மற்றும் இமெயில் கட்டாயம் இல்லை.' }
         ],
         faqs: [
           { en: 'Can I store WhatsApp numbers?', ta: 'ஆம். போன் எண்ணை சேமித்தால் WhatsApp share வேலை செய்யும்.' },
         ],
         mistakes: [
           { en: 'Keep the customer name short and clear.', ta: 'வாடிக்கையாளர் பெயரை சுருக்கமாகவும் தெளிவாகவும் பதிவு செய்யவும்.' },
         ]
      },
      'products': {
         title: { en: 'Items & Products', ta: 'பொருட்கள் நிர்வகிப்பு' },
         desc: { en: 'Save items you frequently sell.', ta: 'அடிக்கடி விற்கும் பொருட்களை சேமித்து வைக்கலாம்.' },
         points: [
           { en: 'Add standard name, price and tax.', ta: 'பெயர், விலை மற்றும் வரியை பதிவு செய்யவும்.' },
           { en: 'These items will auto-suggest when you create an invoice.', ta: 'பில் போடும் போது இந்த பொருட்கள் தாமாகவே காட்டும்.' }
         ],
         faqs: [
           { en: 'Do I need HSN/SAC?', ta: 'GST invoice-க்கு HSN/SAC code சேர்த்தால் சிறப்பு.' },
         ],
         mistakes: [
           { en: 'Use the right tax rate per product.', ta: 'ஒவ்வொரு பொருளுக்கும் சரியான tax rate பயன்படுத்தவும்.' },
         ]
      },
      'payments': {
         title: { en: 'Record Payments', ta: 'பணம் வரவு வைப்பது எப்படி?' },
         desc: { en: 'Track how much cash you received.', ta: 'வந்த பணத்தை கணக்கு வைத்துக்கொள்ளும் இடம்.' },
         points: [
           { en: 'Click "Record Payment".', ta: '"பணம் வரவு வை" கிளிக் செய்யவும்.' },
           { en: 'Select the Unpaid invoice.', ta: 'பணம் வர வேண்டிய பில்லை தேர்வு செய்யவும்.' },
           { en: 'Enter amount and save.', ta: 'தொகையை உள்ளிட்டு சேமிக்கவும்.' }
         ],
         faqs: [
           { en: 'Can I record partial payments?', ta: 'ஆம். Partial payment பதிவு செய்யலாம்.' },
         ],
         mistakes: [
           { en: 'Never record more than the balance due.', ta: 'வரவேண்டிய தொகையை விட அதிகமாக பதிவு செய்ய வேண்டாம்.' },
         ]
      }
    };

    const topic = content[topicKey];

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-bold text-stone-800 mb-2">{topic.title[language]}</h3>
          <p className="text-stone-600 text-sm leading-relaxed">{topic.desc[language]}</p>
        </div>

        <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100">
          <h4 className="font-semibold text-emerald-900 text-sm mb-3">
            {language === 'en' ? 'Step-by-step Guide' : 'வழிகாட்டுதல் (Guide)'}
          </h4>
          <ul className="space-y-3">
            {topic.points.map((point, i) => (
               <li key={i} className="flex gap-3 text-sm text-stone-700">
                 <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-medium text-xs">
                   {i + 1}
                 </span>
                 <span className="pt-1">{point[language]}</span>
               </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-stone-800 text-sm mb-2 flex items-center gap-2"><MessageSquareQuote size={16} className="text-emerald-600" /> {language === 'en' ? 'FAQ' : 'கேள்விகள்'}</h4>
            <div className="space-y-2">
              {topic.faqs.map((faq, index) => (
                <div key={index} className="bg-stone-50 rounded-xl p-3 text-sm text-stone-700">
                  {faq[language]}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-stone-800 text-sm mb-2 flex items-center gap-2"><ShieldQuestion size={16} className="text-amber-600" /> {language === 'en' ? 'Common mistakes' : 'பொதுவான தவறுகள்'}</h4>
            <div className="space-y-2">
              {topic.mistakes.map((item, index) => (
                <div key={index} className="bg-amber-50 rounded-xl p-3 text-sm text-stone-700">
                  {item[language]}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeHelp}
              className="print:hidden fixed inset-0 bg-black/20 z-40"
            />
            <motion.div
              initial={reduceMotion ? false : { x: '100%' }}
              animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { x: '100%' }}
              transition={reduceMotion ? { duration: 0.15 } : { type: 'spring', damping: 25, stiffness: 200 }}
              className="print:hidden fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col border-l"
            >
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
                    <Info size={20} />
                  </span>
                  <h2 className="font-semibold text-stone-800">
                    {language === 'en' ? 'Help & Guide' : 'உதவி வழிகாட்டி'}
                  </h2>
                </div>
                <button
                  onClick={closeHelp}
                  aria-label="Close help"
                  title="Close help"
                  className="p-2 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {getHelpContent()}
              </div>

              <div className="p-4 border-t bg-stone-50">
                 <p className="text-xs text-center text-stone-500">
                   {language === 'en' ? 'Tip: You can change the language anytime using the button at the top.' : 'குறிப்பு: திரையின் மேற்புறம் உள்ள பட்டனை கொண்டு மொழியை மாற்றிக்கொள்ளலாம்.'}
                 </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
