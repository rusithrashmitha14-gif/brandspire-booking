import React, { useState } from 'react';
import { useProperty, useAllBookings, useUpdateBookingStatus } from '@/hooks/useSupabase';
import { format } from 'date-fns';
import { Mail, Phone, MoreVertical, XCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Bookings() {
  const { data: property } = useProperty();
  const { data: bookings = [], isLoading, error } = useAllBookings(property?.id);
  const { mutateAsync: updateStatus } = useUpdateBookingStatus();

  const groupedBookings = React.useMemo(() => {
    const groups: Record<string, any> = {};
    for (const b of bookings) {
      const groupId = b.booking_group_id || b.id;
      if (!groups[groupId]) {
        groups[groupId] = {
          id: groupId,
          guest_name: b.guest_name,
          guest_email: b.guest_email,
          guest_phone: b.guest_phone,
          check_in: b.check_in,
          check_out: b.check_out,
          created_at: b.created_at,
          booking_status: b.booking_status,
          total_amount: 0,
          rooms: []
        };
      }
      const nights = Math.max(1, Math.ceil((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / (1000 * 3600 * 24)));
      const price = b.room_units?.room_types?.price || 0;
      groups[groupId].total_amount += price * nights;
      groups[groupId].rooms.push({
        title: b.room_units?.room_types?.title,
        room_number: b.room_units?.room_number
      });
    }
    // Sort by created_at descending
    return Object.values(groups).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [bookings]);

  const handleStatusChange = async (groupId: string, status: string) => {
    if (status === 'Cancelled') {
      if (!window.confirm("Are you sure you want to cancel this booking? This will free up the room in the calendar.")) {
        return;
      }
    }
    
    try {
      await updateStatus({ groupId, status });
    } catch (err) {
      alert("Failed to update booking status.");
      console.error(err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Confirmed':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none"><CheckCircle2 className="w-3 h-3 mr-1" /> Confirmed</Badge>;
      case 'Pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-none"><AlertCircle className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'Cancelled':
        return <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100 border-none"><XCircle className="w-3 h-3 mr-1" /> Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-8 flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Guest Management</h1>
          <p className="text-muted-foreground mt-1">View reservations, contact guests, and manage bookings.</p>
        </div>
      </div>

      <div className="rounded-md border bg-card flex-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Guest</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-red-500 font-medium">Error: {(error as Error).message}</TableCell>
              </TableRow>
            )}
            {isLoading && !error && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading bookings...</TableCell>
              </TableRow>
            )}
            {!isLoading && !error && bookings.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No bookings found.
                </TableCell>
              </TableRow>
            )}
            {groupedBookings.map((booking: any) => (
              <TableRow key={booking.id}>
                <TableCell className="font-medium">
                  {booking.guest_name}
                  <div className="text-xs text-muted-foreground mt-1">
                    Booked on {format(new Date(booking.created_at), 'MMM d, yyyy')}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1 text-sm">
                    <a href={`mailto:${booking.guest_email}`} className="flex items-center text-primary hover:underline">
                      <Mail className="w-3 h-3 mr-2" /> {booking.guest_email}
                    </a>
                    {booking.guest_phone && (
                      <a href={`tel:${booking.guest_phone}`} className="flex items-center text-muted-foreground hover:text-foreground">
                        <Phone className="w-3 h-3 mr-2" /> {booking.guest_phone}
                      </a>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  <div>{format(new Date(booking.check_in), 'MMM d, yyyy')}</div>
                  <div className="text-muted-foreground">to {format(new Date(booking.check_out), 'MMM d, yyyy')}</div>
                </TableCell>
                <TableCell className="text-sm">
                  <div className="space-y-2">
                    {booking.rooms.map((room: any, i: number) => (
                      <div key={i}>
                        <div className="font-medium">{room.title}</div>
                        <div className="text-xs text-muted-foreground">Unit: {room.room_number}</div>
                      </div>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="font-medium">
                  {formatCurrency(booking.total_amount, property?.currency)}
                </TableCell>
                <TableCell>
                  {getStatusBadge(booking.booking_status)}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleStatusChange(booking.id, 'Confirmed')}
                        disabled={booking.booking_status === 'Confirmed'}
                      >
                        Mark as Confirmed
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleStatusChange(booking.id, 'Pending')}
                        disabled={booking.booking_status === 'Pending'}
                      >
                        Mark as Pending
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleStatusChange(booking.id, 'Cancelled')}
                        disabled={booking.booking_status === 'Cancelled'}
                      >
                        Cancel Booking
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
