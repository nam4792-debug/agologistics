import { HashRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { MainLayout } from '@/components/layout';
import { ProtectedRoute } from '@/components/auth';
import { SocketProvider } from '@/contexts';
import { Dashboard } from '@/pages';
import { LoginPage } from '@/pages/auth';
import { ShipmentList, ShipmentDetail } from '@/pages/shipments';
import { BookingList, BookingDetail } from '@/pages/bookings';
import { DocumentList } from '@/pages/documents';
import { LogisticsPage } from '@/pages/logistics';
import { VendorsAndCosts } from '@/pages/vendors';
import { RiskDashboard } from '@/pages/risks';
import { AnalyticsPage } from '@/pages/analytics';
import { AssistantPage } from '@/pages/assistant';
import { SettingsPage } from '@/pages/settings';
import { AdminDashboard } from '@/pages/admin';
import { NotificationListener } from '@/components/notifications';

function App() {
  return (
    <SocketProvider>
      <HashRouter>
        {/* Toast notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'hsl(222.2 84% 4.9%)',
              color: 'hsl(210 40% 98%)',
              border: '1px solid hsl(217.2 32.6% 17.5%)',
            },
          }}
        />

        {/* Real-time notification listener */}
        <NotificationListener />

        <Routes>
          {/* Public route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="shipments" element={<ShipmentList />} />
              <Route path="shipments/:id" element={<ShipmentDetail />} />
              <Route path="bookings/fcl" element={<BookingList type="FCL" />} />
              <Route path="bookings/air" element={<BookingList type="AIR" />} />
              <Route path="bookings/:id" element={<BookingDetail />} />
              <Route path="documents" element={<DocumentList />} />
              <Route path="logistics" element={<LogisticsPage />} />
              <Route path="vendors" element={<VendorsAndCosts />} />
              <Route path="risks" element={<RiskDashboard />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="assistant" element={<AssistantPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="admin" element={<AdminDashboard />} />
            </Route>
          </Route>
        </Routes>
      </HashRouter>
    </SocketProvider>
  );
}

export default App;
