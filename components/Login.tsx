import React, { useState } from 'react';
import { ShieldCheck, Mail, Lock, LogIn, UserPlus, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, username);
        if (error) setError(error.message);
        else setMessage('Account created. You can sign in now.');
      } else {
        const { error } = await signIn(email, password);
        if (error) setError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setMessage(null);
    setGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) setError(error.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-ypsom-deep rounded-sm flex items-center justify-center">
            <span className="text-white font-bold text-lg font-serif italic">YP</span>
          </div>
          <div className="flex flex-col">
            <span className="font-black text-xl text-ypsom-deep tracking-wider leading-none">
                CAFE <span className="font-light">DE LA PLACE</span>
            </span>
            <span className="text-[0.6rem] tracking-[0.25em] text-ypsom-slate uppercase font-bold">
                Suivi financier
            </span>
          </div>
        </div>

        <div className="bg-white border border-ypsom-alice rounded-lg shadow-audit p-6">
          <div className="flex items-center gap-2 mb-6">
            <ShieldCheck className="w-5 h-5 text-ypsom-deep" />
            <h1 className="font-black text-ypsom-deep uppercase tracking-tight">
              {isSignUp ? 'Create account' : 'Sign in'}
            </h1>
          </div>

          {!isSignUp && (
            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading || loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-ypsom-alice bg-white text-ypsom-deep font-black text-[10px] uppercase tracking-widest rounded-sm hover:bg-gray-50 disabled:opacity-60 transition-colors mb-4"
            >
              {googleLoading ? '…' : 'Continuer avec Google'}
            </button>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-ypsom-slate mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ypsom-slate/60" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Display name"
                    className="w-full pl-10 pr-4 py-2.5 border border-ypsom-alice rounded-sm text-sm text-ypsom-deep placeholder:text-ypsom-slate/50 focus:outline-none focus:ring-2 focus:ring-ypsom-deep/20 focus:border-ypsom-deep"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-ypsom-slate mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ypsom-slate/60" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 border border-ypsom-alice rounded-sm text-sm text-ypsom-deep placeholder:text-ypsom-slate/50 focus:outline-none focus:ring-2 focus:ring-ypsom-deep/20 focus:border-ypsom-deep"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-ypsom-slate mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ypsom-slate/60" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full pl-10 pr-4 py-2.5 border border-ypsom-alice rounded-sm text-sm text-ypsom-deep placeholder:text-ypsom-slate/50 focus:outline-none focus:ring-2 focus:ring-ypsom-deep/20 focus:border-ypsom-deep"
                />
              </div>
            </div>
            {error && (
              <p className="text-xs text-red-600 font-medium">{error}</p>
            )}
            {message && (
              <p className="text-xs text-emerald-600 font-medium">{message}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-ypsom-deep text-white font-black text-[10px] uppercase tracking-widest rounded-sm hover:bg-ypsom-deep/90 disabled:opacity-60 transition-colors"
            >
              {loading ? (
                <span className="animate-pulse">…</span>
              ) : isSignUp ? (
                <>
                  <UserPlus className="w-4 h-4" /> Sign up
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" /> Sign in
                </>
              )}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setMessage(null);
              if (!isSignUp) setUsername('');
            }}
            className="mt-4 w-full text-center text-[10px] font-bold uppercase tracking-widest text-ypsom-slate hover:text-ypsom-deep transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>

        <p className="mt-6 text-center text-[10px] text-ypsom-slate/70 uppercase tracking-widest">
          Acces sécurisé • Vos donnees restent a vous
        </p>
      </div>
    </div>
  );
}
