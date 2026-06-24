import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import { LanguageProvider } from './context/LanguageContext';
import { HelpProvider } from './context/HelpContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Products from './pages/Products';
import Invoices from './pages/Invoices';
import InvoiceForm from './pages/InvoiceForm';
import InvoicePreview from './pages/InvoicePreview';
import Estimates from './pages/Estimates';
import Payments from './pages/Payments';
import Expenses from './pages/Expenses';
import Settings from './pages/Settings';
import DeliveryNotes from './pages/DeliveryNotes';
import DeliveryNoteForm from './pages/DeliveryNoteForm';
import DeliveryNotePreview from './pages/DeliveryNotePreview';
import Login from './pages/Login';

const Reports = lazy(() => import('./pages/Reports'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600"></div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <DataProvider>
          <HelpProvider>
            <BrowserRouter>
              <Suspense fallback={
                <div className="flex min-h-screen items-center justify-center bg-stone-50">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600"></div>
                </div>
              }>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                  <Route index element={<Dashboard />} />
                  <Route path="customers" element={<Customers />} />
                  <Route path="products" element={<Products />} />
                  
                  <Route path="invoices" element={<Invoices />} />
                  <Route path="invoices/new" element={<InvoiceForm />} />
                  <Route path="invoices/:id" element={<InvoicePreview />} />
                  <Route path="invoices/:id/edit" element={<InvoiceForm />} />
                  
                  <Route path="estimates" element={<Estimates />} />
                  <Route path="estimates/new" element={<InvoiceForm />} />
                  <Route path="estimates/:id" element={<InvoicePreview />} />
                  <Route path="estimates/:id/edit" element={<InvoiceForm />} />
                  
                  <Route path="delivery-notes" element={<DeliveryNotes />} />
                  <Route path="delivery-notes/new" element={<DeliveryNoteForm />} />
                  <Route path="delivery-notes/:id" element={<DeliveryNotePreview />} />
                  <Route path="delivery-notes/:id/edit" element={<DeliveryNoteForm />} />
                  
                  <Route path="payments" element={<Payments />} />
                  <Route path="expenses" element={<Expenses />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
              </Routes>
            </Suspense>
            </BrowserRouter>
          </HelpProvider>
        </DataProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
