import React, { useEffect, useState } from 'react';
import { auth, googleAuthProvider } from '../lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { LogIn, LogOut, User as UserIcon, ShieldCheck, Database } from 'lucide-react';

export const AuthWidget: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        try {
          const idToken = await currentUser.getIdToken();
          // Sync user with Cloud SQL backend
          await fetch('/api/db/user/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
          });
        } catch (err) {
          console.warn('Failed to sync user with Cloud SQL backend:', err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: any) {
      console.error('Sign in error:', err);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error('Sign out error:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#94A3B8] bg-[#F3F5F8] border border-[#1E293B]/15 rounded-xl font-mono">
        <span className="w-2 h-2 rounded-full bg-[#94A3B8] animate-pulse" />
        Auth state...
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-2 bg-[#F3F5F8] border border-[#1E293B]/20 rounded-xl p-1 shadow-2xs">
        <div className="flex items-center gap-2 px-2.5 py-1">
          {user.photoURL ? (
            <img src={user.photoURL} alt={user.displayName || 'User'} className="w-5 h-5 rounded-full border border-[#1E293B]/20" />
          ) : (
            <div className="w-5 h-5 rounded-full bg-[#1E293B] text-[#F8F9FC] flex items-center justify-center text-[10px] font-mono font-bold">
              {user.displayName?.[0] || 'U'}
            </div>
          )}
          <span className="text-xs font-semibold text-[#1E293B] max-w-[120px] truncate">
            {user.displayName || user.email?.split('@')[0]}
          </span>
          <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#1E293B]/10 text-[#1E293B]" title="Connected to Ledger Workspace">
            <Database className="w-2.5 h-2.5" />
            Connected
          </span>
        </div>
        <button
          onClick={handleSignOut}
          title="Sign Out"
          className="p-1.5 text-[#64748B] hover:text-[#6366F1] hover:bg-[#6366F1]/10 rounded-lg transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleSignIn}
      className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-[#F8F9FC] bg-[#1E293B] hover:bg-[#334155] rounded-xl shadow-2xs transition-colors cursor-pointer"
    >
      <LogIn className="w-3.5 h-3.5" />
      <span>Sign In</span>
    </button>
  );
};
