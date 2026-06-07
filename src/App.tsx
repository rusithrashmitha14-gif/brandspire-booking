import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from '@/components/layouts/AdminLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import Dashboard from '@/pages/admin/Dashboard';
import Rooms from '@/pages/admin/Rooms';
import Bookings from '@/pages/admin/Bookings';
import ChannelManager from '@/pages/admin/ChannelManager';
import CalendarView from '@/pages/admin/Calendar';
import Settings from '@/pages/admin/Settings';
import Login from '@/pages/admin/Login';
import Gallery from '@/pages/admin/Gallery';
import EmbedWidget from '@/pages/public/EmbedWidget';
import Amenities from '@/pages/admin/Amenities';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/embed/:propertyId" element={<EmbedWidget />} />
        <Route path="/admin/login" element={<Login />} />

        {/* Protected Admin Routes */}
        <Route path="/admin" element={<ProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="rooms" element={<Rooms />} />
            <Route path="bookings" element={<Bookings />} />
            <Route path="sync" element={<ChannelManager />} />
            <Route path="amenities" element={<Amenities />} />
            <Route path="gallery" element={<Gallery />} />
            <Route path="calendar" element={<CalendarView />} />
            <Route path="settings" element={<Settings />} />
            {/* We will add more admin routes here */}
          </Route>
        </Route>

        {/* Catch-all redirect to admin for now */}
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
