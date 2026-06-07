import React, { useState } from 'react';
import { format, addDays, startOfDay, eachDayOfInterval, isWithinInterval, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useProperty, useCalendarData } from '@/hooks/useSupabase';

export default function CalendarView() {
  const { data: property } = useProperty();
  
  // 14 day view by default
  const [startDate, setStartDate] = useState(startOfDay(new Date()));
  const endDate = addDays(startDate, 13);
  
  const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

  const { data, isLoading } = useCalendarData(
    property?.id, 
    format(startDate, 'yyyy-MM-dd'), 
    format(endDate, 'yyyy-MM-dd')
  );

  const handlePrevious = () => setStartDate(prev => addDays(prev, -7));
  const handleNext = () => setStartDate(prev => addDays(prev, 7));
  const handleToday = () => setStartDate(startOfDay(new Date()));

  // Group units by room type
  const groupedUnits = data?.units.reduce((acc: any, unit: any) => {
    const typeTitle = unit.room_types.title;
    if (!acc[typeTitle]) acc[typeTitle] = [];
    acc[typeTitle].push(unit);
    return acc;
  }, {});

  return (
    <div className="p-8 flex flex-col h-[calc(100vh-theme(spacing.16))]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Availability Calendar</h1>
          <p className="text-muted-foreground mt-1">View and manage all your room assignments.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleToday} className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" /> Today
          </Button>
          <Button variant="outline" size="icon" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="flex-1 overflow-auto border rounded-xl shadow-sm bg-card relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-sm flex items-center justify-center">
            <p className="text-lg font-medium animate-pulse">Loading calendar...</p>
          </div>
        )}

        <div className="min-w-[1200px] inline-block w-full">
          {/* Header Row (Dates) */}
          <div className="flex sticky top-0 z-20 bg-muted/90 backdrop-blur border-b">
            <div className="w-64 min-w-[256px] border-r p-4 font-semibold flex items-center sticky left-0 bg-muted/90 backdrop-blur z-30">
              Rooms
            </div>
            {dateRange.map((date, i) => (
              <div key={i} className="flex-1 min-w-[100px] p-2 border-r text-center">
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{format(date, 'EEE')}</div>
                <div className={`text-lg font-semibold ${isSameDay(date, new Date()) ? 'text-primary' : ''}`}>
                  {format(date, 'd')}
                </div>
              </div>
            ))}
          </div>

          {/* Body Rows (Room Types and Units) */}
          <div className="relative">
            {!isLoading && (!groupedUnits || Object.keys(groupedUnits).length === 0) && (
              <div className="p-8 text-center text-muted-foreground">
                No room units found. Please create a Room Type with a quantity first.
              </div>
            )}

            {groupedUnits && Object.entries(groupedUnits).map(([typeTitle, units]: [string, any]) => (
              <React.Fragment key={typeTitle}>
                {/* Room Type Group Header */}
                <div className="flex bg-secondary/30 border-b">
                  <div className="w-full p-2 pl-4 font-semibold text-sm text-secondary-foreground sticky left-0">
                    {typeTitle}
                  </div>
                </div>

                {/* Individual Room Units */}
                {units.map((unit: any) => (
                  <div key={unit.id} className="flex border-b group hover:bg-muted/30 relative h-16">
                    {/* Y-Axis Label */}
                    <div className="w-64 min-w-[256px] border-r p-4 text-sm font-medium sticky left-0 bg-card group-hover:bg-muted/30 z-10 flex flex-col justify-center">
                      <span>{unit.room_number}</span>
                    </div>

                    {/* X-Axis Cells */}
                    {dateRange.map((date, i) => (
                      <div key={i} className="flex-1 min-w-[100px] border-r border-r-border/50 relative">
                        {/* We could render cell-specific UI here, but we will render bookings as absolute overlay items instead for smoothness */}
                      </div>
                    ))}

                    {/* Bookings Overlay for this Row */}
                    {data?.bookings
                      .filter((b: any) => b.room_unit_id === unit.id)
                      .map((booking: any) => {
                        // Calculate position and width of the booking block
                        const checkInDate = startOfDay(new Date(booking.check_in));
                        const checkOutDate = startOfDay(new Date(booking.check_out));
                        
                        // If booking is completely outside our view, skip it (should be filtered by query but just in case)
                        if (checkOutDate <= startDate || checkInDate > endDate) return null;

                        // Calculate visual start
                        let startIndex = dateRange.findIndex(d => isSameDay(d, checkInDate));
                        let isCutLeft = false;
                        if (startIndex === -1) {
                          startIndex = 0;
                          isCutLeft = true;
                        }

                        // Calculate visual end
                        let endIndex = dateRange.findIndex(d => isSameDay(d, checkOutDate));
                        let isCutRight = false;
                        if (endIndex === -1) {
                          endIndex = dateRange.length;
                          isCutRight = true;
                        }

                        const span = endIndex - startIndex;

                        return (
                          <div
                            key={booking.id}
                            className={`absolute top-2 bottom-2 bg-primary text-primary-foreground rounded-md shadow-sm overflow-hidden text-xs p-2 whitespace-nowrap cursor-pointer hover:bg-primary/90 transition-colors z-10 border border-primary-foreground/20
                              ${isCutLeft ? 'rounded-l-none border-l-0' : ''}
                              ${isCutRight ? 'rounded-r-none border-r-0' : ''}
                            `}
                            style={{
                              left: `calc(256px + ${startIndex} * min(100px, calc((100% - 256px) / 14)))`, // 256px is sidebar width, 14 is days
                              width: `calc(${span} * min(100px, calc((100% - 256px) / 14)))`,
                            }}
                          >
                            <div className="font-semibold truncate">{booking.guest_name}</div>
                            <div className="opacity-80 truncate">{booking.booking_status}</div>
                          </div>
                        );
                      })}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
