import React, { useState } from 'react';
import { auth, googleAuthProvider } from '../lib/firebase';
import { signInWithPopup } from 'firebase/auth';
import { 
  ArrowRight, 
  Eye, 
  EyeOff, 
  ShieldCheck
} from 'lucide-react';

interface AuthScreenProps {
  onSuccess?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      setErrorMsg(null);
      setIsSubmitting(true);
      await signInWithPopup(auth, googleAuthProvider);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request'
      ) {
        console.log('Sign in popup closed by user.');
        return;
      }
      console.error('Google Sign In Error:', err);
      setErrorMsg(err.message || 'Failed to sign in with Google');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleGoogleSignIn();
  };

  return (
    <div className="min-h-screen w-full bg-[#F0F2F5] text-[#1E293B] flex items-center justify-center p-4 sm:p-6 md:p-10 lg:p-16 font-sans selection:bg-[#6366F1]/20">
      {/* Outer Card - Ledger Notebook Glassmorphism Style */}
      <div className="max-w-md md:max-w-xl lg:max-w-2xl w-full relative glass-ledger-card rounded-2xl p-6 sm:p-8 md:p-12 pl-9 sm:pl-12 md:pl-16 overflow-hidden bg-[linear-gradient(#00000008_1px,transparent_1px)] [background-size:100%_28px]">
        
        {/* Red Ledger Margin Line */}
        <div className="absolute top-0 bottom-0 left-6 sm:left-8 md:left-10 w-[1px] bg-[#6366F1]/30 pointer-events-none" />

        {/* Top Header Branding */}
        <div className="flex items-center gap-2.5 mb-7 pl-3">
          <img 
            src="/logo.png" 
            alt="AI Data Analysis Logo" 
            className="w-6 h-6 rounded-md object-contain bg-[#1E293B] shadow-xs" 
          />
          <span className="font-mono text-xs tracking-widest uppercase text-[#64748B] font-semibold">
            AI DATA ANALYSIS · LEDGER
          </span>
        </div>

        {/* Main Heading */}
        <div className="flex items-baseline gap-2.5 mb-1 pl-3">
          <span className="font-mono text-xs font-bold text-[#6366F1]">
            {activeTab === 'signin' ? '01' : '02'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#1E293B] tracking-tight">
            {activeTab === 'signin' ? 'Welcome back' : 'Create account'}
          </h1>
        </div>
        <p className="text-xs text-[#64748B] mb-6 pl-3">
          {activeTab === 'signin' ? 'Sign in to access your analysis workspace' : 'Register to start analyzing datasets'}
        </p>

        {/* Navigation Tabs */}
        <div className="flex gap-5 mb-5 pl-3 text-xs sm:text-sm font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('signin')}
            className={`pb-1.5 transition-colors cursor-pointer ${
              activeTab === 'signin'
                ? 'text-[#1E293B] font-semibold border-b-2 border-[#1E293B]'
                : 'text-[#94A3B8] hover:text-[#1E293B]'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('signup')}
            className={`pb-1.5 transition-colors cursor-pointer ${
              activeTab === 'signup'
                ? 'text-[#1E293B] font-semibold border-b-2 border-[#1E293B]'
                : 'text-[#94A3B8] hover:text-[#1E293B]'
            }`}
          >
            Sign up
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="ml-3 mb-4 p-3 rounded-lg bg-[#6366F1]/10 border border-[#6366F1]/30 text-[#6366F1] text-xs font-mono">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Form Grid Box */}
        <form onSubmit={handleSubmit} className="ml-3 space-y-4">
          <div className="glass-ledger-input rounded-xl overflow-hidden shadow-2xs">
            {/* Email Row */}
            <div className="grid grid-cols-[64px_1fr] border-b border-[#1E293B]/10 items-center">
              <label htmlFor="auth-email" className="py-3 pl-3 text-[10px] font-mono tracking-wider text-[#94A3B8] select-none">
                EMAIL
              </label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-transparent font-mono text-xs sm:text-sm py-3 pr-3 text-[#1E293B] placeholder-[#94A3B8]/60 focus:outline-none"
              />
            </div>

            {/* Password Row */}
            <div className="grid grid-cols-[64px_1fr_auto] items-center">
              <label htmlFor="auth-pass" className="py-3 pl-3 text-[10px] font-mono tracking-wider text-[#94A3B8] select-none">
                PASS
              </label>
              <input
                id="auth-pass"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent font-mono text-xs sm:text-sm py-3 text-[#1E293B] placeholder-[#94A3B8]/60 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="px-3 text-[#94A3B8] hover:text-[#1E293B] transition-colors cursor-pointer"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Form Options */}
          <div className="flex justify-between items-center text-xs text-[#64748B] pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-[#1E293B] cursor-pointer"
              />
              <span>Keep me signed in</span>
            </label>
            <button
              type="button"
              onClick={(e) => e.preventDefault()}
              className="text-[#6366F1] hover:underline cursor-pointer font-medium"
            >
              Forgot password
            </button>
          </div>

          {/* Primary Action Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#1E293B] hover:bg-[#334155] text-[#F8F9FC] border border-[#1E293B] rounded-lg py-3 px-4 text-xs sm:text-sm font-medium transition-all duration-150 flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-[0.99] disabled:opacity-50"
          >
            <span>{activeTab === 'signin' ? 'Sign in' : 'Create account'}</span>
            <ArrowRight className="w-4 h-4 stroke-[2]" />
          </button>
        </form>

        {/* Divider */}
        <div className="ml-3 flex items-center gap-3 my-5">
          <div className="flex-1 h-[1px] bg-[#1E293B]/15" />
          <span className="font-mono text-[10px] tracking-wider text-[#94A3B8] uppercase">OR</span>
          <div className="flex-1 h-[1px] bg-[#1E293B]/15" />
        </div>

        {/* Google Sign In Button */}
        <div className="ml-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
            className="w-full bg-transparent hover:bg-[#1E293B]/5 border border-[#1E293B]/20 rounded-lg py-2.5 px-4 text-xs sm:text-sm font-medium text-[#1E293B] transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>
        </div>

        {/* Footer Account Link */}
        <p className="text-center text-xs text-[#64748B] mt-6 ml-3">
          {activeTab === 'signin' ? (
            <>
              New here?{' '}
              <button
                type="button"
                onClick={() => setActiveTab('signup')}
                className="text-[#6366F1] hover:underline font-medium cursor-pointer"
              >
                Open an account
              </button>
            </>
          ) : (
            <>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => setActiveTab('signin')}
                className="text-[#6366F1] hover:underline font-medium cursor-pointer"
              >
                Sign in to your ledger
              </button>
            </>
          )}
        </p>

        {/* Security Badge */}
        <div className="mt-6 pt-4 border-t border-[#1E293B]/10 flex items-center justify-center gap-1.5 text-[11px] text-[#94A3B8] ml-3 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-[#1E293B]" />
          <span>Enterprise-grade security · 256-bit encryption</span>
        </div>

      </div>
    </div>
  );
};

