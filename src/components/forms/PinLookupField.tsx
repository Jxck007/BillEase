import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { postalProvider, PostalResult } from '../../services/integrations';

type Props = {
  value: string;
  enabled: boolean;
  onChange: (value: string) => void;
  onApply: (result: PostalResult) => void;
};

export default function PinLookupField({ value, enabled, onChange, onApply }: Props) {
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
      setStatus('PIN lookup is unavailable. Enter the address manually.');
      return;
    }
    if (!/^\d{6}$/.test(value)) return;

    const timer = window.setTimeout(async () => {
      const user = auth?.currentUser;
      if (!user) {
        setStatus('PIN lookup needs an active login. Enter the address manually.');
        return;
      }

      setLoading(true);
      try {
        const token = await user.getIdToken();
        const result = await postalProvider.lookup(value, token);
        if (sequence !== requestSequence.current) return;

        if (result.ok) {
          setResults(result.value);
          setStatus(result.value.length ? '' : 'No locality found. Enter the address manually.');
        } else {
          setStatus(`${'message' in result ? result.message : 'PIN lookup is unavailable.'} Enter the address manually.`);
        }
      } catch {
        if (sequence === requestSequence.current) {
          setStatus('PIN lookup is unavailable. Enter the address manually.');
        }
      } finally {
        if (sequence === requestSequence.current) setLoading(false);
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [enabled, value]);

  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-stone-700">PIN code</label>
      <div className="relative">
        <input
          inputMode="numeric"
          maxLength={6}
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
          className="min-h-12 w-full rounded-xl border px-3 pr-11"
          placeholder="6-digit PIN"
          aria-describedby={status ? 'pin-lookup-status' : undefined}
        />
        {loading
          ? <Loader2 className="absolute right-3 top-3 animate-spin text-stone-400" aria-label="Looking up PIN code" />
          : <MapPin className="absolute right-3 top-3 text-stone-400" size={20} aria-hidden="true" />}
      </div>

      {status && <p id="pin-lookup-status" className="mt-1 text-xs text-amber-700" role="status">{status}</p>}
      {results.length > 0 && (
        <div className="mt-2 space-y-2 rounded-xl border bg-stone-50 p-2">
          <p className="px-1 text-xs text-stone-600">Choose a locality to confirm the address update.</p>
          {results.map((result) => (
            <button
              type="button"
              key={`${result.locality}-${result.district}-${result.state}`}
              onClick={() => {
                onApply(result);
                setResults([]);
                setStatus('Address updated from the selected locality.');
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
