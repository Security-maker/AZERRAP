import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import type { AppUser, Role } from '../types';

interface AuthContextValue {
  firebaseUser: User | null;
  profile: AppUser | null;
  role: Role | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    setLoading(true);
    const userRef = doc(db, 'users', firebaseUser.uid);
    const unsubProfile = onSnapshot(userRef, async (snap) => {
      if (!snap.exists()) {
        const baseProfile: AppUser = {
          uid: firebaseUser.uid,
          nom: firebaseUser.displayName?.split(' ').slice(-1).join(' ') || 'Utilisateur',
          prenom: firebaseUser.displayName?.split(' ')[0] || 'Nouvel',
          email: firebaseUser.email || '',
          role: 'agent',
          statut: 'hors_poste',
          siteActuel: null,
          isOnline: true,
          createdAt: serverTimestamp() as never,
          updatedAt: serverTimestamp() as never
        };
        await setDoc(userRef, baseProfile, { merge: true });
        return;
      }
      setProfile({ uid: firebaseUser.uid, ...(snap.data() as Omit<AppUser, 'uid'>) });
      setLoading(false);
    });
    return () => unsubProfile();
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) return;
    const ref = doc(db, 'users', firebaseUser.uid);
    setDoc(ref, { isOnline: true, lastSeen: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
    const timer = window.setInterval(() => {
      setDoc(ref, { isOnline: true, lastSeen: serverTimestamp() }, { merge: true });
    }, 45000);
    const offline = () => setDoc(ref, { isOnline: false, lastSeen: serverTimestamp() }, { merge: true });
    window.addEventListener('beforeunload', offline);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('beforeunload', offline);
      offline();
    };
  }, [firebaseUser]);

  const value = useMemo<AuthContextValue>(() => ({
    firebaseUser,
    profile,
    role: profile?.role ?? null,
    loading,
    login: async (email, password) => { await signInWithEmailAndPassword(auth, email, password); },
    logout: () => signOut(auth)
  }), [firebaseUser, loading, profile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
