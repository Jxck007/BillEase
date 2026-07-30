import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import { LanguageProvider } from './context/LanguageContext';
import { HelpProvider } from './context/HelpContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import LoadingSpinner from './components/ui/LoadingSpinner';
import AppErrorBoundary from './components/errors/AppErrorBoundary';
import { ToastProvider } from './context/ToastContext';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Payments = lazy(() => import('./pages/Payments'));
const Expenses = lazy(() => import('./pages/Expenses'));
const DeliveryNotes = lazy(() => import('./pages/DeliveryNotes'));
const Customers = lazy(() => import('./pages/Customers'));
const Products = lazy(() => import('./pages/Products'));
const InvoiceForm = lazy(() => import('./pages/InvoiceForm'));
const InvoicePreview = lazy(() => import('./pages/InvoicePreview'));
const Estimates = lazy(() => import('./pages/Estimates'));
const Settings = lazy(() => import('./pages/Settings'));
const DeliveryNoteForm = lazy(() => import('./pages/DeliveryNoteForm'));
const DeliveryNotePreview = lazy(() => import('./pages/DeliveryNotePreview'));
const Reports = lazy(() => import('./pages/Reports'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!user || !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function RouteLoadingFallback() {
  const location = useLocation();
  const previewRoute = /\/(invoices|estimates|delivery-notes)\/[^/]+$/.test(location.pathname);
  return <LoadingSpinner fullScreen text={previewRoute ? 'Opening preview...' : 'Opening page...'} />;
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <DataProvider>
          <HelpProvider>
            <BrowserRouter>
              <AppErrorBoundary>
              <ToastProvider>
              <Suspense fallback={<RouteLoadingFallback />}>
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
              </ToastProvider>
              </AppErrorBoundary>
            </BrowserRouter>
          </HelpProvider>
        </DataProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
