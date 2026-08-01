import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useHelp } from '../../context/HelpContext';
import { useLanguage } from '../../context/LanguageContext';
import Modal from '../ui/Modal';

type HelpTopic = { id: string; title: { en: string; ta: string }; body: { en: string[]; ta: string[] } };

const topics: HelpTopic[] = [
  {
    id: 'sync', title: { en: 'Saving and cloud sync', ta: 'சேமிப்பு மற்றும் மேக ஒத்திசைவு' }, body: {
      en: ['Saved on this device means the durable local save completed.', 'Syncing to cloud means a change is waiting for Firestore acknowledgement. Synced to cloud means the matching server revision was confirmed.', 'When offline, your work remains safe locally. Reconnect or choose Retry sync. View details shows connection, sign-in, service availability, pending count, last attempt and a safe error reference.'],
      ta: ['இந்தச் சாதனத்தில் சேமிக்கப்பட்டது என்பது நிலையான உள்ளூர் சேமிப்பு முடிந்தது.', 'மேகத்துடன் ஒத்திசைக்கப்படுகிறது என்பது Firestore உறுதிப்படுத்தலுக்காக மாற்றம் காத்திருக்கிறது. மேகத்துடன் ஒத்திசைக்கப்பட்டது என்பது பொருந்தும் சேவையகப் பதிப்பு உறுதிசெய்யப்பட்டது.', 'இணையம் இல்லாதபோதும் உங்கள் பணி சாதனத்தில் பாதுகாப்பாக இருக்கும். மீண்டும் இணைக்கவும் அல்லது மீண்டும் ஒத்திசை என்பதைத் தேர்ந்தெடுக்கவும். விவரங்களில் இணைப்பு, உள்நுழைவு, சேவை, நிலுவை எண்ணிக்கை, கடைசி முயற்சி மற்றும் பாதுகாப்பான பிழைக் குறிப்பு தெரியும்.'],
    },
  },
  {
    id: 'payment-status', title: { en: 'Invoice payment status', ta: 'விலைப்பட்டியல் கட்டண நிலை' }, body: {
      en: ['Unpaid has no recorded payment. Partially paid has a remaining balance. Paid has no balance. Overdue is unpaid after the due date.', 'The payment-status badge can be hidden from customer PDFs using the company default or invoice override. Hiding it never changes payments, balances, history or reports.'],
      ta: ['செலுத்தப்படவில்லை என்பது கட்டணம் பதிவாகவில்லை. பகுதி செலுத்தப்பட்டது என்பதில் நிலுவை உள்ளது. செலுத்தப்பட்டது என்பதில் நிலுவை இல்லை. காலாவதியானது என்பது கடைசி தேதிக்குப் பிறகும் செலுத்தப்படாதது.', 'நிறுவன இயல்புநிலை அல்லது விலைப்பட்டியல் தேர்வின் மூலம் வாடிக்கையாளர் PDF-ல் கட்டண நிலைக் குறியை மறைக்கலாம். மறைப்பது கட்டணம், நிலுவை, வரலாறு அல்லது அறிக்கையை மாற்றாது.'],
    },
  },
  {
    id: 'payment-history', title: { en: 'Payment History actions', ta: 'கட்டண வரலாறு செயல்கள்' }, body: {
      en: ['Correct: Fix an incorrect date, method, amount or reference. The original record remains in the audit history.', 'Reverse: Undo a payment entered by mistake or later refunded. The invoice balance and reports are recalculated. A reason is required.', 'Receipt: View, download, print, email or share a receipt for this payment.'],
      ta: ['திருத்து: தவறான தேதி, முறை, தொகை அல்லது குறிப்பைச் சரிசெய்யவும். அசல் பதிவு தணிக்கை வரலாற்றில் இருக்கும்.', 'மாற்று: தவறாகப் பதிவிட்ட அல்லது பின்னர் திருப்பிய கட்டணத்தை ரத்து செய்யவும். விலைப்பட்டியல் நிலுவையும் அறிக்கைகளும் மீண்டும் கணக்கிடப்படும். காரணம் அவசியம்.', 'ரசீது: இந்தக் கட்டணத்தின் ரசீதைப் பார்க்க, பதிவிறக்க, அச்சிட, மின்னஞ்சல் அல்லது பகிர பயன்படுத்தவும்.'],
    },
  },
  {
    id: 'preview', title: { en: 'Document preview modes', ta: 'ஆவண முன்னோட்ட முறைகள்' }, body: {
      en: ['Fit Content is a compact screen view that includes totals, authorization and the computer-generated footer.', 'Full A4 shows the exact printable page. Full Screen gives a larger preview. PDF, sharing and print always use physical A4 output.'],
      ta: ['உள்ளடக்கத்தைப் பொருத்து என்பது மொத்தம், அங்கீகாரம் மற்றும் கணினி உருவாக்கிய அடிக்குறிப்புடன் கூடிய சுருக்கமான திரைக் காட்சி.', 'முழு A4 சரியான அச்சுப் பக்கத்தைக் காட்டும். முழுத்திரை பெரிய முன்னோட்டம் தரும். PDF, பகிர்வு மற்றும் அச்சு எப்போதும் A4 வெளியீட்டைப் பயன்படுத்தும்.'],
    },
  },
  {
    id: 'address', title: { en: 'Customer address', ta: 'வாடிக்கையாளர் முகவரி' }, body: {
      en: ['Use one primary address for the normal workflow. Enable Use a different shipping address only when goods must go elsewhere.', 'When the option is off, documents use the primary address. Existing different shipping details are retained for compatibility.'],
      ta: ['வழக்கமான பணிக்கு ஒரு முதன்மை முகவரியைப் பயன்படுத்தவும். பொருட்கள் வேறு இடத்துக்குச் செல்ல வேண்டுமென்றால் மட்டும் வேறு அனுப்பும் முகவரியை இயக்கு.', 'தேர்வு அணைக்கப்பட்டால் ஆவணங்கள் முதன்மை முகவரியைப் பயன்படுத்தும். ஏற்கனவே உள்ள வேறு அனுப்பும் முகவரி இணக்கத்திற்காக பாதுகாக்கப்படும்.'],
    },
  },
  {
    id: 'sharing', title: { en: 'Sharing documents', ta: 'ஆவணங்களைப் பகிர்தல்' }, body: {
      en: ['Share PDF opens the Android share sheet with the generated PDF when the browser supports file sharing.', 'Open WhatsApp Chat opens only the customer chat. A WhatsApp URL cannot attach a local PDF automatically.'],
      ta: ['உலாவி கோப்புப் பகிர்வை ஆதரித்தால் PDF பகிர் உருவாக்கிய PDF உடன் Android பகிர்வுத் தாளைத் திறக்கும்.', 'WhatsApp உரையாடலைத் திற என்பது வாடிக்கையாளர் உரையாடலை மட்டும் திறக்கும். WhatsApp URL உள்ளூர் PDF-ஐ தானாக இணைக்க முடியாது.'],
    },
  },
  {
    id: 'upi', title: { en: 'Static UPI QR', ta: 'நிலையான UPI QR' }, body: {
      en: ['Scanning a static UPI QR does not confirm payment or mark an invoice paid.', 'Record the verified payment manually unless a verified payment gateway is added.'],
      ta: ['நிலையான UPI QR-ஐ ஸ்கேன் செய்வது கட்டணத்தை உறுதிப்படுத்தாது அல்லது விலைப்பட்டியலை செலுத்தியதாகக் குறிக்காது.', 'சரிபார்க்கப்பட்ட கட்டண வாயில் சேர்க்கப்படாத வரை உறுதிப்படுத்திய கட்டணத்தை கைமுறையாகப் பதிவு செய்யவும்.'],
    },
  },
];

export default function FloatingHelp() {
  const { isOpen, closeHelp, currentTopic } = useHelp();
  const { language } = useLanguage();
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return topics.filter((topic) => !needle || `${topic.title[language]} ${topic.body[language].join(' ')}`.toLowerCase().includes(needle));
  }, [language, query]);

  return (
    <Modal isOpen={isOpen} onClose={closeHelp} title={language === 'en' ? 'Help & guide' : 'உதவி வழிகாட்டி'} maxWidth="max-w-2xl" mobileSheet>
      <div className="font-sans">
        <label className="relative block"><span className="sr-only">{language === 'en' ? 'Search help topics' : 'உதவித் தலைப்புகளைத் தேடு'}</span><Search className="absolute left-3 top-3.5 text-stone-400" size={19} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={language === 'en' ? 'Search help topics' : 'உதவித் தலைப்புகளைத் தேடு'} className="min-h-12 w-full rounded-xl border border-stone-200 pl-10 pr-3" /></label>
        <div className="mt-4 space-y-2">
          {filtered.map((topic) => <details key={topic.id} open={!query && topic.id === currentTopic} className="rounded-xl border border-stone-200 bg-white"><summary className="flex min-h-12 cursor-pointer items-center px-4 py-3 font-semibold text-stone-900">{topic.title[language]}</summary><div className="space-y-2 border-t border-stone-100 px-4 py-3">{topic.body[language].map((paragraph) => <p key={paragraph} className="text-sm leading-6 text-stone-700">{paragraph}</p>)}</div></details>)}
          {!filtered.length ? <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">{language === 'en' ? 'No matching help topic.' : 'பொருந்தும் உதவித் தலைப்பு இல்லை.'}</p> : null}
        </div>
      </div>
    </Modal>
  );
}
