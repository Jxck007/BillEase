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

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
