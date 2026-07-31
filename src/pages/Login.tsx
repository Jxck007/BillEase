import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { motion } from 'motion/react';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useLanguage } from '../context/LanguageContext';

export default function Login() {
  const { language, setLanguage } = useLanguage();
  const text = (english: string, tamil: string) => language === 'ta' ? tamil : english;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  
  const { user, isAdmin, loading: authLoading, error: contextError, clearError } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!authLoading && user && isAdmin) {
      navigate('/', { replace: true });
    }
  }, [user, isAdmin, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();
    setLoading(true);

    if (!auth) {
      setLocalError(text('Sign-in is temporarily unavailable. Check your internet connection and try again.', 'உள்நுழைவு தற்போது கிடைக்கவில்லை. இணைய இணைப்பைச் சரிபார்த்து மீண்டும் முயலவும்.'));
      setLoading(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Success is handled by onAuthStateChanged in AuthContext
      // Redirect happens via useEffect
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setLocalError(text('The email or password is incorrect. Check both fields and try again.', 'மின்னஞ்சல் அல்லது கடவுச்சொல் தவறாக உள்ளது. இரண்டையும் சரிபார்த்து மீண்டும் முயலவும்.'));
      } else {
        setLocalError(text('Sign-in failed. Check your connection and try again.', 'உள்நுழைய முடியவில்லை. இணைய இணைப்பைச் சரிபார்த்து மீண்டும் முயலவும்.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const rawError = localError || contextError;
  const error = rawError && /firebase|auth\//i.test(rawError)
    ? text('Sign-in is temporarily unavailable. Check your internet connection and try again.', 'உள்நுழைவு தற்போது கிடைக்கவில்லை. இணைய இணைப்பைச் சரிபார்த்து மீண்டும் முயலவும்.')
    : rawError;

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-stone-800 via-stone-900 to-black px-4 py-12 sm:px-6 lg:px-8">
      <div className="absolute right-4 top-4 z-20 flex rounded-xl border border-white/20 bg-black/20 p-1" aria-label={text('Choose language', 'மொழியைத் தேர்ந்தெடுக்கவும்')}>
        <button type="button" onClick={() => setLanguage('en')} className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${language === 'en' ? 'bg-white text-stone-900' : 'text-white'}`} aria-pressed={language === 'en'}>English</button>
        <button type="button" onClick={() => setLanguage('ta')} className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${language === 'ta' ? 'bg-white text-stone-900' : 'text-white'}`} aria-pressed={language === 'ta'}>தமிழ்</button>
      </div>
      
      {/* Decorative background elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] h-[50%] w-[50%] rounded-full bg-emerald-600/20 blur-[120px]" />
        <div className="absolute -bottom-[20%] -right-[10%] h-[50%] w-[50%] rounded-full bg-teal-600/20 blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md space-y-8 overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/5 p-10 shadow-2xl backdrop-blur-2xl"
      >
        <div>
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-500/30">
            <LogIn className="h-10 w-10 text-white" />
          </div>
          <h2 className="mt-8 text-center text-3xl font-black tracking-tight text-white">
            {text('Secure access', 'பாதுகாப்பான உள்நுழைவு')}
          </h2>
          <p className="mt-2 text-center text-sm text-stone-400">
            {text('Sign in to continue to BillEase', 'BillEase-ஐத் தொடர உள்நுழையவும்')}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center gap-3 rounded-2xl bg-rose-500/10 p-4 text-rose-400 border border-rose-500/20"
              role="alert"
              aria-live="assertive"
            >
              <AlertCircle size={20} className="shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </motion.div>
          )}

          <div className="space-y-4 rounded-md shadow-sm">
            <div className="relative">
              <label htmlFor="email-address" className="sr-only">{text('Email address', 'மின்னஞ்சல் முகவரி')}</label>
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <Mail className="h-5 w-5 text-stone-400" />
              </div>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-4 text-white placeholder-stone-400 backdrop-blur-sm transition-all focus:border-emerald-500 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:text-sm"
                placeholder={text('Email address', 'மின்னஞ்சல் முகவரி')}
              />
            </div>
            <div className="relative">
              <label htmlFor="password" className="sr-only">{text('Password', 'கடவுச்சொல்')}</label>
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <Lock className="h-5 w-5 text-stone-400" />
              </div>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-12 text-white placeholder-stone-400 backdrop-blur-sm transition-all focus:border-emerald-500 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:text-sm"
                placeholder={text('Password', 'கடவுச்சொல்')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-4 text-stone-400 hover:text-white transition-colors focus:outline-none"
                aria-label={showPassword ? text('Hide password', 'கடவுச்சொல்லை மறை') : text('Show password', 'கடவுச்சொல்லைக் காட்டு')}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.02] hover:shadow-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-stone-900 disabled:opacity-70 disabled:hover:scale-100"
            >
              {loading ? (
                <LoadingSpinner inline size={5} light />
              ) : (
                text('Sign in', 'உள்நுழை')
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
