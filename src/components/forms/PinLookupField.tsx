import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { postalProvider, PostalResult } from '../../services/integrations';
import { useLanguage } from '../../context/LanguageContext';

type Props = {
  value: string;
  enabled: boolean;
  onChange: (value: string) => void;
  onApply: (result: PostalResult) => void;
};

export default function PinLookupField({ value, enabled, onChange, onApply }: Props) {
  const { language } = useLanguage();
  const text = useCallback((english: string, tamil: string) => language === 'ta' ? tamil : english, [language]);
  const inputId = useId();
  const statusId = useId();
  const [results, setResults] = useState<PostalResult[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const requestSequence = useRef(0);

  useEffect(() => {
    const sequence = ++requestSequence.current;
    setResults([]);
    setStatus('');
    setLoading(false);

    if (!enabled) {
      setStatus(text('PIN lookup is unavailable. Enter the address manually.', 'அஞ்சல் குறியீட்டுத் தேடல் கிடைக்கவில்லை. முகவரியை கைமுறையாக உள்ளிடவும்.'));
      return;
    }
    if (!/^\d{6}$/.test(value)) return;

    const timer = window.setTimeout(async () => {
      const user = auth?.currentUser;
      if (!user) {
        setStatus(text('PIN lookup needs an active login. Enter the address manually.', 'அஞ்சல் குறியீட்டுத் தேடலுக்கு உள்நுழைவு தேவை. முகவரியை கைமுறையாக உள்ளிடவும்.'));
        return;
      }

      setLoading(true);
      try {
        const token = await user.getIdToken();
        const result = await postalProvider.lookup(value, token);
        if (sequence !== requestSequence.current) return;

        if (result.ok) {
          setResults(result.value);
          setStatus(result.value.length ? '' : text('No locality found. Enter the address manually.', 'இடம் கிடைக்கவில்லை. முகவரியை கைமுறையாக உள்ளிடவும்.'));
        } else {
          setStatus(text('PIN lookup is unavailable. Enter the address manually.', 'அஞ்சல் குறியீட்டுத் தேடல் கிடைக்கவில்லை. முகவரியை கைமுறையாக உள்ளிடவும்.'));
        }
      } catch {
        if (sequence === requestSequence.current) {
          setStatus(text('PIN lookup is unavailable. Enter the address manually.', 'அஞ்சல் குறியீட்டுத் தேடல் கிடைக்கவில்லை. முகவரியை கைமுறையாக உள்ளிடவும்.'));
        }
      } finally {
        if (sequence === requestSequence.current) setLoading(false);
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [enabled, language, text, value]);

  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-sm font-semibold text-stone-700">{text('PIN / postal code', 'அஞ்சல் குறியீடு')}</label>
      <div className="relative">
        <input
          id={inputId}
          inputMode="numeric"
          maxLength={6}
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
          className="min-h-12 w-full rounded-xl border px-3 pr-11"
          placeholder={text('Enter 6-digit PIN', '6 இலக்க அஞ்சல் குறியீட்டை உள்ளிடவும்')}
          aria-describedby={status ? statusId : undefined}
        />
        {loading
          ? <Loader2 className="absolute right-3 top-3 animate-spin text-stone-400" aria-label={text('Looking up PIN code', 'அஞ்சல் குறியீடு தேடப்படுகிறது')} />
          : <MapPin className="absolute right-3 top-3 text-stone-400" size={20} aria-hidden="true" />}
      </div>

      {status && <p id={statusId} className="mt-1 text-sm text-amber-700" role="status">{status}</p>}
      {results.length > 0 && (
        <div className="mt-2 space-y-2 rounded-xl border bg-stone-50 p-2">
          <p className="px-1 text-sm text-stone-600">{text('Choose a locality to confirm the address update.', 'முகவரைப் புதுப்பிப்பை உறுதிசெய்ய ஒரு இடத்தைத் தேர்ந்தெடுக்கவும்.')}</p>
          {results.map((result) => (
            <button
              type="button"
              key={`${result.locality}-${result.district}-${result.state}`}
              onClick={() => {
                onApply(result);
                setResults([]);
                setStatus(text('Address updated from the selected locality.', 'தேர்ந்தெடுத்த இடத்திலிருந்து முகவரி புதுப்பிக்கப்பட்டது.'));
              }}
              className="min-h-12 w-full rounded-lg bg-white px-3 text-left text-sm font-medium hover:bg-emerald-50"
            >
              {result.locality}, {result.district}, {result.state}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
