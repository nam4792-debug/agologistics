import { HashRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
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
import { InvoiceList } from '@/pages/finance/InvoiceList';
import { SettingsPage } from '@/pages/settings';
import { AdminDashboard } from '@/pages/admin';
import { ActivityLogPage } from '@/pages/admin/ActivityLogPage';
import { AssistantPage } from '@/pages/assistant';
import { ReportingPage } from '@/pages/reports/ReportingPage';
import { TrackingPage } from '@/pages/portal/TrackingPage';
import { NotificationListener } from '@/components/notifications';

function App() {
  // Apply saved theme and accent color on app startup (globally)
  useEffect(() => {
    // Apply theme
    const savedTheme = localStorage.getItem('app-theme') || 'light';
    const root = document.documentElement;
    if (savedTheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
      root.classList.toggle('light', !prefersDark);
    } else {
      root.classList.toggle('dark', savedTheme === 'dark');
      root.classList.toggle('light', savedTheme === 'light');
    }

    // Listen for OS theme changes when system mode is active
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const currentTheme = localStorage.getItem('app-theme') || 'light';
      if (currentTheme === 'system') {
        root.classList.toggle('dark', mediaQuery.matches);
        root.classList.toggle('light', !mediaQuery.matches);
      }
    };
    mediaQuery.addEventListener('change', handler);

    // Apply accent color
    const savedColor = localStorage.getItem('app-accent-color');
    if (savedColor) {
      const r = parseInt(savedColor.slice(1, 3), 16) / 255;
      const g = parseInt(savedColor.slice(3, 5), 16) / 255;
      const b = parseInt(savedColor.slice(5, 7), 16) / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0;
      const l = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }
      root.style.setProperty('--primary', `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`);
    }

    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
  return (
    <SocketProvider>
      <HashRouter>
        {/* Toast notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'hsl(var(--card))',
              color: 'hsl(var(--foreground))',
              border: '1px solid hsl(var(--border))',
            },
          }}
        />

        {/* Real-time notification listener */}
        <NotificationListener />

        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/track" element={<TrackingPage />} />

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
              <Route path="invoices" element={<InvoiceList />} />
              <Route path="assistant" element={<AssistantPage />} />
              <Route path="activity-log" element={<ActivityLogPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="admin" element={<AdminDashboard />} />
              <Route path="reports" element={<ReportingPage />} />
            </Route>
          </Route>
        </Routes>
      </HashRouter>
    </SocketProvider>
  );
}

export default App;
