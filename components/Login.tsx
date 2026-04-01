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
    <div className="min-h-screen bg-cdlp-dark flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="w-32 h-32 mb-4 text-cdlp-gold">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" fill="none" className="w-full h-full">
              <circle cx="200" cy="200" r="180" stroke="currentColor" strokeWidth="3" fill="none"/>
              <circle cx="200" cy="200" r="130" stroke="currentColor" strokeWidth="3" fill="none"/>
              <line x1="140" y1="140" x2="260" y2="260" stroke="currentColor" strokeWidth="3"/>
              <line x1="260" y1="140" x2="140" y2="260" stroke="currentColor" strokeWidth="3"/>
              <text x="170" y="190" fontFamily="Arial, sans-serif" fontSize="48" fontWeight="300" fill="currentColor" letterSpacing="8">C</text>
              <text x="220" y="190" fontFamily="Arial, sans-serif" fontSize="48" fontWeight="300" fill="currentColor" letterSpacing="8">D</text>
              <text x="170" y="240" fontFamily="Arial, sans-serif" fontSize="48" fontWeight="300" fill="currentColor" letterSpacing="8">L</text>
              <text x="220" y="240" fontFamily="Arial, sans-serif" fontSize="48" fontWeight="300" fill="currentColor" letterSpacing="8">P</text>
              <path id="topArc" d="M 60,200 A 140,140 0 0,1 340,200" fill="none"/>
              <text fontFamily="Arial, sans-serif" fontSize="28" fontWeight="300" fill="currentColor" letterSpacing="6">
                <textPath href="#topArc" startOffset="50%" textAnchor="middle">
                  CAFÉ DE LA PLACE
                </textPath>
              </text>
              <path id="bottomArc" d="M 340,200 A 140,140 0 0,1 60,200" fill="none"/>
              <text fontFamily="Arial, sans-serif" fontSize="24" fontWeight="300" fill="currentColor" letterSpacing="4">
                <textPath href="#bottomArc" startOffset="50%" textAnchor="middle">
                  BISTROT GENÈVE
                </textPath>
              </text>
            </svg>
          </div>
          <p className="text-cdlp-muted/70 text-[9px] uppercase tracking-[0.3em]">Suivi Financier</p>
        </div>

        <div className="bg-cdlp-black border border-cdlp-border rounded-lg shadow-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <ShieldCheck className="w-5 h-5 text-cdlp-gold" />
            <h2 className="font-black text-cdlp-gold uppercase tracking-tight">
              {isSignUp ? 'Create account' : 'Sign in'}
            </h2>
          </div>

          {!isSignUp && (
            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading || loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-cdlp-border bg-cdlp-card text-white font-bold text-xs uppercase tracking-wider rounded hover:bg-cdlp-border/50 disabled:opacity-60 transition-colors mb-4"
            >
              {googleLoading ? '…' : 'Continue with Google'}
            </button>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-cdlp-muted mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cdlp-muted" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Display name"
                    className="w-full pl-10 pr-4 py-2.5 bg-cdlp-card border border-cdlp-border rounded text-sm text-white placeholder:text-cdlp-muted/50 focus:outline-none focus:ring-2 focus:ring-cdlp-gold/30 focus:border-cdlp-gold"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-cdlp-muted mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cdlp-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-cdlp-card border border-cdlp-border rounded text-sm text-white placeholder:text-cdlp-muted/50 focus:outline-none focus:ring-2 focus:ring-cdlp-gold/30 focus:border-cdlp-gold"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-cdlp-muted mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cdlp-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full pl-10 pr-4 py-2.5 bg-cdlp-card border border-cdlp-border rounded text-sm text-white placeholder:text-cdlp-muted/50 focus:outline-none focus:ring-2 focus:ring-cdlp-gold/30 focus:border-cdlp-gold"
                />
              </div>
            </div>
            {error && (
              <p className="text-xs text-red-400 font-medium">{error}</p>
            )}
            {message && (
              <p className="text-xs text-emerald-400 font-medium">{message}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-cdlp-gold text-cdlp-black font-black text-xs uppercase tracking-wider rounded hover:bg-cdlp-gold-light disabled:opacity-60 transition-colors"
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
            className="mt-4 w-full text-center text-xs font-bold uppercase tracking-wider text-cdlp-muted hover:text-cdlp-gold transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-cdlp-muted/70 uppercase tracking-wider">
          Secure access • Your data stays yours
        </p>
      </div>
    </div>
  );
}
