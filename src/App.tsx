/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, useRef } from 'react';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut,
  signInAnonymously,
  signInWithRedirect,
  getRedirectResult
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { UserProfile } from './types';
import LobbyList from './components/LobbyList';
import CreateLobbyModal from './components/CreateLobbyModal';
import AimTrainer from './components/AimTrainer';
import ProfileCard from './components/ProfileCard';
import AdminPanel from './components/AdminPanel';
import RulesPanel from './components/RulesPanel';
import standoffBanner from './assets/images/standoff_banner_1779699784330.png';
import standoffAvatar from './assets/images/standoff_avatar_1779701141519.png';
import neuronAvatar from './assets/images/neuron_avatar_1779797653026.png';
import { 
  Users, 
  Target, 
  Zap, 
  User, 
  ShieldAlert, 
  LogOut, 
  Gamepad2, 
  Volume2, 
  VolumeX, 
  Sparkles,
  Info,
  ShieldCheck,
  RefreshCw,
  BookOpen
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<any>(() => {
    try {
      const stored = localStorage.getItem('standoff2_user_v3');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return null;
  });
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const stored = localStorage.getItem('standoff2_profile_v3');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return null;
  });
  const [authReady, setAuthReady] = useState(false);
  const [currentTab, setCurrentTab] = useState<'lobbies' | 'aim_trainer' | 'profile' | 'admin' | 'rules'>('lobbies');
  const [secretUnlocked, setSecretUnlocked] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Exact 4-tap code activator tracker
  const [tapCount, setTapCount] = useState(0);
  const timeoutRef = useRef<any>(null);
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);

  // Synth sounds helpers
  const playSynthBeep = (freq: number, duration: number) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      }
    } catch (e) {}
  };

  const playSuccessSynth = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(500, ctx.currentTime);
        osc.frequency.setValueAtTime(750, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(1000, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch (e) {}
  };

  // Handle Google Redirect Result on load (critical for Telegram WebApp & WebViews where popups fail)
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          console.log("Successfully signed in via Google redirect:", result.user);
        }
      })
      .catch((err) => {
        console.error("Google redirect sign-in error or cancelled:", err);
      });
  }, []);

  // Authenticate listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setAuthReady(false);
      setLoginError(null);
      if (authUser) {
        const simpleUser = {
          uid: authUser.uid,
          email: authUser.email,
          displayName: authUser.displayName,
          photoURL: authUser.photoURL,
          isAnonymous: authUser.isAnonymous
        };
        setUser(simpleUser);
        localStorage.setItem('standoff2_user_v3', JSON.stringify(simpleUser));
        
        // Fetch/generate User Profile doc in Firestore
        const userRef = doc(db, 'users', authUser.uid);
        try {
          const docSnap = await getDoc(userRef);
          
          let cachedProfile: any = null;
          try {
            const stored = localStorage.getItem('standoff2_profile_v3');
            if (stored) cachedProfile = JSON.parse(stored);
          } catch (e) {}

          if (!docSnap.exists()) {
            // Check if designated admin email matches
            const isDefaultAdmin = authUser.email === 'disbalanceg2@gmail.com';
            
            // Create brand new profile using specified inputs or fallbacks
            const newProfile: Partial<UserProfile> = {
              displayName: cachedProfile?.displayName || authUser.displayName || `Боец #${Math.floor(Math.random() * 9000 + 1000)}`,
              avatarUrl: cachedProfile?.avatarUrl || authUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${authUser.uid}`,
              standoffId: cachedProfile?.standoffId || String(Math.floor(Math.random() * 90000000 + 10000000)),
              role: isDefaultAdmin ? 'admin' : (cachedProfile?.role || 'user'),
              joinedAt: serverTimestamp(),
            };
            
            await setDoc(userRef, newProfile);
            const fullProfile = { id: authUser.uid, ...newProfile } as UserProfile;
            setProfile(fullProfile);
            localStorage.setItem('standoff2_profile_v3', JSON.stringify(fullProfile));

            // Admin registry
            if (isDefaultAdmin) {
              const adminRef = doc(db, 'admins', authUser.uid);
              await setDoc(adminRef, { email: authUser.email });
            }
          } else {
            const data = docSnap.data();
            const fullProfile = { id: authUser.uid, ...data } as UserProfile;
            setProfile(fullProfile);
            localStorage.setItem('standoff2_profile_v3', JSON.stringify(fullProfile));
          }
        } catch (err) {
          console.error("Firestore loading missed, falling back to local guest mock:", err);
          let cachedProfile: any = null;
          try {
            const stored = localStorage.getItem('standoff2_profile_v3');
            if (stored) cachedProfile = JSON.parse(stored);
          } catch (e) {}

          // Set a fallback user profile so the app doesn't crash on connection restriction
          const tempProfile: UserProfile = {
            id: authUser.uid,
            displayName: cachedProfile?.displayName || authUser.displayName || `Гость #${Math.floor(Math.random() * 9000 + 1000)}`,
            avatarUrl: cachedProfile?.avatarUrl || authUser.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${authUser.uid}`,
            standoffId: cachedProfile?.standoffId || String(Math.floor(Math.random() * 90000000 + 10000000)),
            role: authUser.email === 'disbalanceg2@gmail.com' ? 'admin' : (cachedProfile?.role || 'user'),
            joinedAt: new Date()
          };
          setProfile(tempProfile);
          localStorage.setItem('standoff2_profile_v3', JSON.stringify(tempProfile));
        }
      } else {
        setUser(null);
        setProfile(null);
        localStorage.removeItem('standoff2_user_v3');
        localStorage.removeItem('standoff2_profile_v3');
        localStorage.removeItem('standoff2_fallback_uid_v3');
      }
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  // Real-time listener for current profile changes
  useEffect(() => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const updated = { id: user.uid, ...snap.data() } as UserProfile;
        setProfile(updated);
        localStorage.setItem('standoff2_profile_v3', JSON.stringify(updated));
      }
    });
    return () => unsub();
  }, [user]);

  const handleGoogleLogin = async () => {
    try {
      setLoginError(null);
      
      const isWebViewOrIframe = 
        /Telegram|FBAN|FBAV|Instagram|LinkedIn|Twitter|GSA|Messenger/i.test(navigator.userAgent) || 
        !!(window as any).Telegram?.WebApp ||
        (typeof window !== 'undefined' && window.parent !== window);

      if (isWebViewOrIframe) {
        // Redirect directly to Google Sign-in to confirm email address
        console.log("Redirecting to Google via signInWithRedirect.");
        await signInWithRedirect(auth, googleProvider);
      } else {
        try {
          await signInWithPopup(auth, googleProvider);
        } catch (popupErr: any) {
          console.warn("Popup authentication failed or was blocked, trying Redirect fallback:", popupErr);
          await signInWithRedirect(auth, googleProvider);
        }
      }
    } catch (err: any) {
      console.error('Google Sign-in failed entirely:', err);
      const code = err?.code || '';
      let errorMsg = 'Не удалось авторизоваться через Google.';
      if (code.includes('popup-blocked')) {
        errorMsg = 'Браузер заблокировал окно входа. Пожалуйста, разрешите всплывающие окна или используйте Вход в новой вкладке.';
      } else if (code.includes('operation-not-supported-in-this-environment')) {
        errorMsg = 'Окружение не поддерживает всплывающие окна. Попробуйте войти в отдельной вкладке или через Гостевой вход.';
      } else {
        errorMsg = `Ошибка авторизации: ${err?.message || 'Неизвестная ошибка'}.`;
      }
      setLoginError(errorMsg);
    }
  };

  const handleGuestLogin = async () => {
    try {
      // Direct guest simulation or auth
      await signInAnonymously(auth);
    } catch (err) {
      // Fallback guest session in case rules are strict or service unavailable
      const mockUid = localStorage.getItem('standoff2_fallback_uid_v3') || `guest_${Math.floor(Math.random() * 89999 + 10000)}`;
      localStorage.setItem('standoff2_fallback_uid_v3', mockUid);
      
      const simpleUser = { uid: mockUid, isAnonymous: true };
      setUser(simpleUser);
      localStorage.setItem('standoff2_user_v3', JSON.stringify(simpleUser));

      let cachedProfile: any = null;
      try {
        const stored = localStorage.getItem('standoff2_profile_v3');
        if (stored) cachedProfile = JSON.parse(stored);
      } catch (e) {}

      const mockProfile: UserProfile = {
        id: mockUid,
        displayName: cachedProfile?.displayName || `Гость #${Math.floor(Math.random() * 9000 + 1000)}`,
        avatarUrl: cachedProfile?.avatarUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${mockUid}`,
        standoffId: cachedProfile?.standoffId || String(Math.floor(Math.random() * 90000000 + 10000000)),
        role: cachedProfile?.role || 'user',
        joinedAt: new Date()
      };
      setProfile(mockProfile);
      localStorage.setItem('standoff2_profile_v3', JSON.stringify(mockProfile));
      setAuthReady(true);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('standoff2_user_v3');
    localStorage.removeItem('standoff2_profile_v3');
    localStorage.removeItem('standoff2_fallback_uid_v3');
    if (user?.isAnonymous || user?.uid?.startsWith('guest_')) {
      setUser(null);
      setProfile(null);
    } else {
      await signOut(auth);
    }
  };

  // Click handler on number "2"
  const handleDigitTwoClick = () => {
    const nextCount = tapCount + 1;
    setTapCount(nextCount);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      if (nextCount === 4) {
        setShowPasscodeModal(true);
        setPasscodeInput('');
        setPasscodeError(false);
        playSynthBeep(600, 0.15);
      }
      setTapCount(0);
    }, 4000);
  };

  if (!authReady) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-950 font-sans text-white">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <span className="mt-4 text-xs font-bold uppercase tracking-widest text-slate-500">Запуск Арены...</span>
      </div>
    );
  }

  // Not Logged In screen
  if (!user || !profile) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 px-4 py-12 text-white font-sans selection:bg-blue-600/30">
        
        {/* Deep blue aesthetic grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#020617_1px,transparent_1px),linear-gradient(to_bottom,#020617_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-35" />

        <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-blue-500/20 bg-slate-900/60 p-8 shadow-2xl shadow-blue-500/5 backdrop-blur-md">
          
          {/* Logo & title Header */}
          <div className="flex flex-col items-center text-center space-y-4 mb-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-xl shadow-violet-500/20 ring-2 ring-violet-400/30 overflow-hidden">
              <img 
                src={neuronAvatar} 
                alt="Neuron Avatar" 
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.src = 'https://api.dicebear.com/7.x/bottts/svg?seed=NeuronPurple';
                }}
              />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-wider text-white">
                Standoff <span className="text-blue-500">2</span> Match Hub
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                Единая СНГ платформа для поиска частных лобби (Deathmatch / Дуэли) и тренировки зажимов в Стендафф 2
              </p>
            </div>
          </div>



          <div className="space-y-4">
            {/* Google Authentication */}
            <button
              onClick={handleGoogleLogin}
              className="w-full inline-flex items-center justify-center gap-3 rounded-lg bg-white hover:bg-slate-100 py-3 text-sm font-bold text-slate-900 transition-all cursor-pointer shadow-lg active:scale-[0.99]"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Войти через Google Auth</span>
            </button>

            {loginError && (
              <div id="login-error-container" className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400 font-sans leading-relaxed animate-fadeIn">
                🛑 <strong>Ошибка:</strong> {loginError}
              </div>
            )}

            {/* Guest Entry */}
            <button
              onClick={handleGuestLogin}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm font-bold text-blue-400 hover:text-white hover:bg-blue-600 transition-colors cursor-pointer active:scale-[0.99] shadow-inner"
            >
              <span>Быстрый Вход (Гость) ⚡</span>
            </button>
          </div>

          <div className="mt-8 text-center pt-4 border-t border-slate-800/80">
            <span className="text-[10px] text-slate-600 font-mono">
              v1.4.2 Production Server Connect Status: Online
            </span>
          </div>

        </div>
      </div>
    );
  }

  if (profile?.isBanned) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-950 font-sans text-white px-6 text-center">
        <div className="rounded-full bg-rose-500/10 border border-rose-500/20 p-5 mb-5 shadow-lg shadow-rose-500/5">
          <ShieldAlert className="h-14 w-14 text-rose-500 animate-bounce" />
        </div>
        <h1 className="text-2xl font-black uppercase tracking-wider text-white">Вы заблокированы</h1>
        <p className="mt-3 text-sm text-slate-400 max-w-md leading-relaxed">
          Ваш профиль (ID: <span className="font-mono text-rose-400">{profile.standoffId || '--'}</span>) заблокирован главным Администратором арены за нарушение правил.
        </p>
        <button
          onClick={handleLogout}
          className="mt-7 rounded-lg bg-rose-600 hover:bg-rose-500 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition-all shadow-lg hover:shadow-rose-600/20 cursor-pointer"
        >
          Выйти из профиля
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-blue-600/30">
      
      {/* Header NavBar */}
      <header className="sticky top-0 z-40 border-b border-slate-900 bg-slate-950/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2 sm:px-4">
          
          <div className="flex items-center gap-1.5 select-none animate-fadeIn">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl border border-blue-500/20 bg-slate-950 shadow-md">
              <img 
                src={standoffAvatar} 
                alt="Standoff Blackout Avatar Logo" 
                className="h-full w-full object-cover" 
                referrerPolicy="no-referrer"
              />
            </div>
            
            {/* Interactive Title with digit "2" admin click listener */}
            <div className="flex flex-col text-left leading-none">
              <h1 className="font-sans text-xs sm:text-sm font-black uppercase tracking-wider text-white select-none">
                Standoff{' '}
                <span 
                  onClick={handleDigitTwoClick}
                  className="text-blue-500 font-extrabold select-none cursor-default inline-block hover:text-blue-400 active:scale-95 transition-transform"
                >
                  2
                </span>
              </h1>
              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-500">
                Blackout DM
              </span>
            </div>
          </div>

          {/* User Status section */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 sm:gap-2 px-1.5 py-0.5 rounded-lg border border-slate-900 bg-slate-950/40">
              <img 
                src={profile.avatarUrl} 
                alt="Profile" 
                className="h-6 w-6 rounded-md border border-slate-800 object-cover bg-slate-100" 
              />
              <div className="text-left font-sans">
                <span className="block text-[10px] font-bold text-white leading-none max-w-[70px] sm:max-w-[120px] truncate">{profile.displayName}</span>
                <span className="text-[8px] font-mono text-slate-500 leading-none">ID: {profile.standoffId || '--'}</span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-850 bg-slate-950 p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Выйти из профиля"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>

        </div>
      </header>

      {/* Main Container Layout */}
      <main className="mx-auto max-w-7xl px-2.5 py-3 sm:px-4 md:py-6">
        
        {/* Navigation Tabs bar */}
        <div className="mb-4 overflow-x-auto">
          <div className="flex border-b border-slate-900 pb-px space-x-4 min-w-max">
            
            {/* Tab: Lobbies */}
            <button
              onClick={() => setCurrentTab('lobbies')}
              className={`relative pb-2 flex items-center gap-1.5 font-sans text-[11px] font-black uppercase tracking-tight transition-colors focus:outline-none cursor-pointer ${
                currentTab === 'lobbies' ? 'text-blue-500' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>DM</span>
              {currentTab === 'lobbies' && (
                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>

            {/* Tab: Aim Trainer */}
            <button
              onClick={() => setCurrentTab('aim_trainer')}
              className={`relative pb-2 flex items-center gap-1.5 font-sans text-[11px] font-black uppercase tracking-tight transition-colors focus:outline-none cursor-pointer ${
                currentTab === 'aim_trainer' ? 'text-blue-500' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Target className="h-3.5 w-3.5" />
              <span>Зал Аима</span>
              {currentTab === 'aim_trainer' && (
                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>

            {/* Tab: Profile */}
            <button
              onClick={() => setCurrentTab('profile')}
              className={`relative pb-2 flex items-center gap-1.5 font-sans text-[11px] font-black uppercase tracking-tight transition-colors focus:outline-none cursor-pointer ${
                currentTab === 'profile' ? 'text-blue-500' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <User className="h-3.5 w-3.5" />
              <span>Профиль</span>
              {currentTab === 'profile' && (
                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>

            {/* Tab: Rules */}
            <button
              onClick={() => setCurrentTab('rules')}
              className={`relative pb-2 flex items-center gap-1.5 font-sans text-[11px] font-black uppercase tracking-tight transition-colors focus:outline-none cursor-pointer ${
                currentTab === 'rules' ? 'text-blue-500' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Правила & ЛС</span>
              {currentTab === 'rules' && (
                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>

            {/* Tab: Secret (Unlocks dynamically on triple click) */}
            {secretUnlocked && (
              <button
                onClick={() => setCurrentTab('admin')}
                className={`relative pb-2 flex items-center gap-1.5 font-sans text-[11px] font-black uppercase tracking-wider transition-colors focus:outline-none cursor-pointer text-red-500 animate-pulse`}
              >
                <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
                <span>Офицерский Штаб</span>
                {currentTab === 'admin' && (
                  <div className="absolute inset-x-0 bottom-0 h-0.5 bg-red-500 rounded-full" />
                )}
              </button>
            )}

          </div>
        </div>

        {/* Dynamic Tab Views container */}
        <div className="min-h-[400px]">
          
          {/* View: Lobbies */}
          {currentTab === 'lobbies' && (
            <div className="space-y-4">
              {/* Epic AI Standoff 2 Header Banner */}
              <div className="relative overflow-hidden rounded-xl border border-slate-900 bg-slate-950 p-3 sm:p-4 shadow-xl shadow-indigo-950/10">
                <div className="absolute inset-0 z-0">
                  <img 
                    src={standoffBanner} 
                    alt="Standoff 2 Blackout" 
                    className="h-full w-full object-cover object-center opacity-30 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
                </div>
                
                <div className="relative z-10 max-w-xl space-y-1">
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/5 border border-blue-500/20 px-2 py-0.5 text-[7px] font-bold uppercase tracking-widest text-slate-400">
                    <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                    Эксклюзивный Режим Арены
                  </span>
                  <h2 className="font-sans text-sm sm:text-base font-black uppercase tracking-wider text-white leading-tight">
                    BLACKOUT DEATHMATCH
                  </h2>
                  <p className="font-sans text-[10px] text-slate-350 leading-normal font-semibold">
                    Добро пожаловать на тренировочную площадку! Подключайтесь к лобби Стендафф 2, совершенствуйте реакцию и соревнуйтесь с другими.
                  </p>
                </div>
              </div>

              <LobbyList 
                currentUserId={user.uid}
                userProfile={profile}
                isAdmin={profile.role === 'admin'}
                onOpenCreateModal={() => setShowCreateModal(true)}
              />
            </div>
          )}

          {/* View: Aim Trainer */}
          {currentTab === 'aim_trainer' && (
            <AimTrainer 
              userId={user.uid}
              currentBestReaction={profile.aimReactionBest}
              currentBestAccuracy={profile.aimAccuracyBest}
              onStatsUpdate={(speed, acc) => {
                setProfile(prev => {
                  if (!prev) return null;
                  const updated = { ...prev, aimReactionBest: speed, aimAccuracyBest: acc };
                  localStorage.setItem('standoff2_profile_v3', JSON.stringify(updated));
                  if (user && !user.uid.startsWith('guest_')) {
                    const userRef = doc(db, 'users', user.uid);
                    updateDoc(userRef, { aimReactionBest: speed, aimAccuracyBest: acc }).catch(console.error);
                  }
                  return updated;
                });
              }}
            />
          )}



          {/* View: Profile */}
          {currentTab === 'profile' && (
            <ProfileCard 
              profile={profile}
              onProfileUpdated={(updatedProfile) => {
                setProfile(updatedProfile);
                localStorage.setItem('standoff2_profile_v3', JSON.stringify(updatedProfile));
              }}
            />
          )}

          {/* View: Rules */}
          {currentTab === 'rules' && (
            <RulesPanel contactEmail="Evgenit2838@gmail.com" />
          )}

          {/* View: Admin Panel */}
          {currentTab === 'admin' && secretUnlocked && (
            <AdminPanel currentUserId={user.uid} />
          )}

        </div>

      </main>

      {/* Host Lobby Modal overlay */}
      {showCreateModal && (
        <CreateLobbyModal 
          userId={user.uid}
          userName={profile.displayName}
          userAvatar={profile.avatarUrl}
          userStandoffId={profile.standoffId}
          userIsVerified={profile.role === 'verified_host' || profile.role === 'admin'}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            // Force return to Lobbies feed after posting successfully
            setCurrentTab('lobbies');
          }}
        />
      )}

      {/* Passcode Verification Modal */}
      {showPasscodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-red-500/20 bg-slate-900/90 p-6 shadow-2xl shadow-red-500/10 text-center animate-zoomIn">
            
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/15 border border-red-500/30 mb-4 animate-pulse">
              <ShieldAlert className="h-6 w-6 text-red-500" />
            </div>

            <h3 className="text-lg font-black uppercase tracking-wider text-white">Вход в Офицерский Штаб</h3>
            <p className="text-xs text-slate-400 mt-2 mb-6 leading-relaxed">
              Для доступа к зашифрованной панели управления требуется ввести секретный код.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (passcodeInput === '1369') {
                  setSecretUnlocked(true);
                  setCurrentTab('admin');
                  setShowPasscodeModal(false);
                  playSuccessSynth();
                } else {
                  setPasscodeError(true);
                  playSynthBeep(250, 0.3);
                  setPasscodeInput('');
                }
              }}
              className="space-y-4"
            >
              <div>
                <input
                  type="password"
                  value={passcodeInput}
                  onChange={(e) => {
                    setPasscodeInput(e.target.value);
                    if (passcodeError) setPasscodeError(false);
                  }}
                  placeholder="КОД ДОСТУПА"
                  className={`w-full text-center tracking-[0.5em] font-mono rounded-lg border bg-slate-950 p-3 text-sm text-white font-extrabold focus:outline-none transition-colors ${
                    passcodeError 
                      ? 'border-red-500 text-red-400 placeholder-red-500/30 focus:border-red-500' 
                      : 'border-slate-800 placeholder-slate-700 focus:border-red-500/50'
                  }`}
                  autoFocus
                />
                {passcodeError && (
                  <span className="block mt-1.5 text-[10px] uppercase font-bold tracking-widest text-red-500">
                    ⚠️ Неверный код доступа
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasscodeModal(false)}
                  className="flex-1 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950/40 p-2.5 text-xs font-bold uppercase tracking-wider text-slate-400 transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-red-600 hover:bg-red-500 p-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors cursor-pointer shadow-md active:scale-95"
                >
                  Ввод
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Small informative prompt during training or secret info */}
      <footer className="mx-auto max-w-7xl border-t border-slate-900 bg-slate-950 px-3 py-4 text-center sm:px-4">
        <p className="text-[9px] text-slate-600 font-sans tracking-wide leading-normal">
          Standoff 2 Match Hub — независимая платформа. Все права на визуальные образы принадлежат Axlebolt Ltd. <br />
          Разработано для повышения личных игровых показателей.
        </p>
      </footer>

    </div>
  );
}
