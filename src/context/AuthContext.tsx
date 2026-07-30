import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, signInWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  loading: true,
  error: null,
  logout: async () => {},
  clearError: () => {},
});
const localTestMode = import.meta.env.DEV && import.meta.env.VITE_LOCAL_TEST_MODE === 'true';
const localTestUser = { uid: 'local-test-user' } as User;

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(localTestMode ? localTestUser : null);
  const [isAdmin, setIsAdmin] = useState(localTestMode);
  const [loading, setLoading] = useState(!localTestMode);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (localTestMode) return;
    if (!auth) {
      setLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch (err) {
        console.error("Failed to set persistence:", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {

      if (firebaseUser) {
        try {

          const adminDocRef = doc(db as any, "admins", firebaseUser.uid);
          const adminDoc = await getDoc(adminDocRef);



          if (adminDoc.exists()) {
            const data = adminDoc.data();

            if (data.active === true && data.role === "admin") {

              setUser(firebaseUser);
              setIsAdmin(true);
              setError(null);
              setLoading(false);
              return;
            }
          }

          await signOut(auth);

          setUser(null);
          setIsAdmin(false);
          setError("Access Denied. Contact Administrator.");
        } catch (err) {

          await signOut(auth);

          setUser(null);
          setIsAdmin(false);
          setError("Error verifying access.");
        }
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    if (localTestMode) {
      setUser(null);
      setIsAdmin(false);
      return;
    }
    if (auth) {
      await signOut(auth);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, error, logout: handleLogout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
};
