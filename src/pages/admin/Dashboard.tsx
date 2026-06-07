import React from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BedDouble, CalendarCheck, Users, Activity } from 'lucide-react';
import { useProperty, useDashboardStats, useRecentBookings } from '@/hooks/useSupabase';

export default function Dashboard() {
  const { data: property } = useProperty();
  const { data: stats, isLoading: statsLoading } = useDashboardStats(property?.id);
  const { data: recentBookings = [], isLoading: bookingsLoading } = useRecentBookings(property?.id);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
        <p className="text-muted-foreground mt-1">Here is what is happening at {property?.name || 'your property'} today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsLoading ? '-' : stats?.totalBookings}</div>
            <p className="text-xs text-muted-foreground">All time reservations</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Room Units</CardTitle>
            <BedDouble className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsLoading ? '-' : stats?.activeRooms}</div>
            <p className="text-xs text-muted-foreground">Physical rooms to manage</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--%</div>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Guests</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">Arriving in next 7 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Bookings */}
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>Recent Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {bookingsLoading ? (
              <div className="text-sm text-muted-foreground">Loading recent bookings...</div>
            ) : recentBookings.length === 0 ? (
              <div className="text-sm text-muted-foreground">No bookings have been made yet. Use the public widget to make one!</div>
            ) : (
              recentBookings.map((booking: any) => (
                <div key={booking.id} className="flex items-center">
                  <div className="ml-4 space-y-1 w-full flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium leading-none">{booking.guest_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {booking.room_units?.room_types?.title} (Unit: {booking.room_units?.room_number})
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {format(new Date(booking.check_in), 'MMM d')} - {format(new Date(booking.check_out), 'MMM d')}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          {booking.booking_status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
