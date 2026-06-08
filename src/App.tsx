import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import { LanguageProvider } from './context/LanguageContext';
import { HelpProvider } from './context/HelpContext';
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
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import DeliveryNotes from './pages/DeliveryNotes';
import DeliveryNoteForm from './pages/DeliveryNoteForm';
import DeliveryNotePreview from './pages/DeliveryNotePreview';

export default function App() {
  return (
    <LanguageProvider>
      <DataProvider>
        <HelpProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<AppLayout />}>
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
          </BrowserRouter>
        </HelpProvider>
      </DataProvider>
    </LanguageProvider>
  );
}
