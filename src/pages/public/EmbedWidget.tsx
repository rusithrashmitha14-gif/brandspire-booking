import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Calendar as CalendarIcon, Users, BedDouble, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAvailableRooms, useCreateBooking } from '@/hooks/useSupabase';

// Custom hook to fetch property by slug or ID
function usePublicProperty(propertyIdentifier?: string) {
  return useQuery({
    queryKey: ['public_property', propertyIdentifier],
    queryFn: async () => {
      if (!propertyIdentifier) return null;
      let query = supabase.from('properties').select('*');
      
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(propertyIdentifier)) {
        query = query.eq('id', propertyIdentifier);
      } else {
        query = query.eq('slug', propertyIdentifier);
      }
      
      const { data, error } = await query.single();
      if (error) throw error;
      return data;
    },
    enabled: !!propertyIdentifier,
  });
}

const checkoutSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(5, 'Phone number is required'),
});

export default function EmbedWidget() {
  const { propertyId } = useParams();
  const { data: property, isLoading: isPropertyLoading } = usePublicProperty(propertyId);
  
  const [step, setStep] = useState<'search' | 'results' | 'checkout' | 'payment' | 'success'>('search');
  const [guestDetails, setGuestDetails] = useState<any>(null);
  
  const [checkIn, setCheckIn] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [checkOut, setCheckOut] = useState<string>(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [guests, setGuests] = useState<number>(2);
  const [cart, setCart] = useState<{ room: any; quantity: number; guests_per_room: number }[]>([]);
  const [viewingRoom, setViewingRoom] = useState<any>(null);
  const [activeImage, setActiveImage] = useState<string>('');

  const { data: availableRooms = [], isFetching: isSearching } = useAvailableRooms(
    property?.id as string, 
    checkIn, 
    checkOut, 
    guests, 
    step === 'results'
  );

  const { mutateAsync: createBooking, isPending: isBooking } = useCreateBooking();

  const form = useForm<z.infer<typeof checkoutSchema>>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
    },
  });

  // Auto-resize iframe logic
  React.useEffect(() => {
    const observer = new ResizeObserver(() => {
      // Send the current scrollHeight of the body to the parent window
      window.parent.postMessage({ 
        type: 'resize-brandspire-widget', 
        height: document.documentElement.scrollHeight 
      }, '*');
    });

    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  const isFirstRender = React.useRef(true);

  // Scroll to top of widget when step changes
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // 1. Send message to parent website for perfectly smooth mobile scrolling
    window.parent.postMessage({ type: 'scroll-to-top-brandspire-widget' }, '*');
    
    // 2. Fallback for desktop/direct links
    setTimeout(() => {
      document.getElementById('widget-top')?.scrollIntoView();
    }, 100);
  }, [step]);

  const handleSearch = () => {
    if (new Date(checkOut) <= new Date(checkIn)) {
      alert("Check-out date must be after check-in date.");
      return;
    }
    setStep('results');
  };

  const handleAddToCart = (room: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.room.room_type_id === room.room_type_id);
      if (existing) {
        if (existing.quantity >= room.available_units) return prev;
        return prev.map(item => item.room.room_type_id === room.room_type_id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { room, quantity: 1, guests_per_room: guests }];
    });
  };

  const handleRemoveFromCart = (room: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.room.room_type_id === room.room_type_id);
      if (existing && existing.quantity > 1) {
        return prev.map(item => item.room.room_type_id === room.room_type_id ? { ...item, quantity: item.quantity - 1 } : item);
      }
      return prev.filter(item => item.room.room_type_id !== room.room_type_id);
    });
  };

  const onCheckoutSubmit = (data: z.infer<typeof checkoutSchema>) => {
    setGuestDetails(data);
    setStep('payment');
  };

  const onPaymentSubmit = async () => {
    if (!guestDetails) return;
    try {
      await createBooking({
        p_property_id: property.id,
        p_check_in: checkIn,
        p_check_out: checkOut,
        p_guest_name: guestDetails.name,
        p_guest_email: guestDetails.email,
        p_guest_phone: guestDetails.phone,
        p_cart_items: cart.map(item => ({
          room_type_id: item.room.room_type_id,
          quantity: item.quantity,
          guests_per_room: item.guests_per_room
        }))
      });
      setCart([]);
      setStep('success');
    } catch (err: any) {
      alert(err.message || "Failed to create booking.");
    }
  };

  if (isPropertyLoading) return <div className="py-8 text-center">Loading...</div>;
  if (!property) return <div className="py-8 text-center text-destructive">Property not found.</div>;

  return (
    <div id="widget-top" className="bg-transparent p-4 flex flex-col items-center font-sans">
      <Card className="w-full max-w-4xl border-none shadow-xl bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 overflow-hidden">
        <div className="h-2 w-full bg-primary" />
        <CardContent className="p-6 md:p-8">
          
          {/* Header */}
          <div className="flex flex-col items-center justify-center mb-8">
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-2xl mb-3">
              {property.name.charAt(0)}
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Book your stay at {property.name}</h2>
          </div>

          {/* Step 1: Search Form */}
          {step === 'search' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 bg-muted/30 rounded-2xl border">
              <div className="space-y-1.5 md:col-span-1">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Check In</Label>
                <div className="relative">
                  <CalendarIcon className="hidden md:block absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} className="pl-3 md:pl-9 bg-background h-11" />
                </div>
              </div>
              <div className="space-y-1.5 md:col-span-1">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Check Out</Label>
                <div className="relative">
                  <CalendarIcon className="hidden md:block absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} className="pl-3 md:pl-9 bg-background h-11" />
                </div>
              </div>
              <div className="space-y-1.5 md:col-span-1">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Guests</Label>
                <div className="relative">
                  <Users className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input type="number" min="1" value={guests} onFocus={e => e.target.select()} onChange={e => setGuests(parseInt(e.target.value) || 1)} className="pl-9 bg-background h-11" />
                </div>
              </div>
              <div className="md:col-span-1 flex items-end">
                <Button className="w-full h-11" size="lg" onClick={handleSearch}>Check Availability</Button>
              </div>
            </div>
          )}

          {/* Step 2: Results */}
          {step === 'results' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-4 border-b pb-4">
                <div>
                  <h3 className="text-lg font-semibold">Available Rooms</h3>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(checkIn), 'MMM d, yyyy')} - {format(new Date(checkOut), 'MMM d, yyyy')} • {guests} Guests
                  </p>
                </div>
                <Button variant="ghost" onClick={() => setStep('search')}>Modify Search</Button>
              </div>

              {isSearching ? (
                <div className="py-12 text-center text-muted-foreground animate-pulse">Searching for availability...</div>
              ) : availableRooms.length === 0 ? (
                <div className="py-12 text-center border rounded-xl bg-muted/20">
                  <h4 className="text-lg font-medium mb-2">No Rooms Available</h4>
                  <p className="text-muted-foreground mb-4">We're fully booked for these dates, or no room can accommodate {guests} guests.</p>
                  <Button variant="outline" onClick={() => setStep('search')}>Try different dates</Button>
                </div>
              ) : (
                availableRooms.map((room: any) => {
                  const cartItem = cart.find(item => item.room.room_type_id === room.room_type_id);
                  const isConflicting = room.is_entire_property 
                    ? (cart.length > 0 && !cart.some(item => item.room.is_entire_property))
                    : cart.some(item => item.room.is_entire_property);
                  const isMaxReached = isConflicting || (cartItem ? cartItem.quantity >= room.available_units : false);
                  
                  return (
                    <div 
                      key={room.room_type_id} 
                      className={`flex flex-col md:flex-row gap-6 p-4 rounded-xl border bg-card transition-colors shadow-sm cursor-pointer ${isConflicting ? 'opacity-50 grayscale' : 'hover:border-primary/50'}`}
                      onClick={() => { setViewingRoom(room); setActiveImage(room.featured_image || ''); }}
                    >
                      <div className="w-full md:w-1/3 aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center text-muted-foreground relative">
                        {room.featured_image ? <img src={room.featured_image} alt={room.title} className="w-full h-full object-cover" /> : <BedDouble className="w-10 h-10 opacity-20" />}
                      </div>
                      <div className="flex-1 flex flex-col justify-between py-1">
                        <div>
                          <h4 className="text-xl font-semibold mb-2">{room.title} {room.is_entire_property && <span className="text-xs ml-2 bg-primary/10 text-primary px-2 py-1 rounded-full uppercase tracking-wider">Entire Villa</span>}</h4>
                          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{room.description || "A beautiful room ready for your stay."}</p>
                        </div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mt-4 pt-4 border-t gap-4 sm:gap-0">
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">Nightly Rate</p>
                            <p className="text-2xl font-bold text-primary">{formatCurrency(room.price, property?.currency)}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-stretch">
                            <Button className="flex-1 sm:flex-none" size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setViewingRoom(room); setActiveImage(room.featured_image || ''); }}>
                              View Details
                            </Button>
                            {cartItem ? (
                              <div className="flex items-center justify-between border rounded-md flex-1 sm:flex-none" onClick={e => e.stopPropagation()}>
                                <Button size="icon" variant="ghost" className="h-10 w-10 sm:w-8" onClick={() => handleRemoveFromCart(room)}>-</Button>
                                <span className="w-8 text-center font-semibold">{cartItem.quantity}</span>
                                <Button size="icon" variant="ghost" className="h-10 w-10 sm:w-8" onClick={() => handleAddToCart(room)} disabled={isMaxReached}>+</Button>
                              </div>
                            ) : (
                              <Button size="lg" className="px-6 flex-1 sm:flex-none" disabled={isConflicting} onClick={(e) => { e.stopPropagation(); handleAddToCart(room); }}>
                                {isConflicting ? 'Unavailable' : 'Select Room'}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {cart.length > 0 && (
                <div className="sticky bottom-4 mt-8 p-4 bg-primary text-primary-foreground rounded-xl shadow-2xl flex flex-col sm:flex-row justify-between items-center z-10 animate-in slide-in-from-bottom-5 gap-4 sm:gap-0">
                  <div className="text-center sm:text-left w-full sm:w-auto">
                    <p className="font-semibold text-lg">{cart.reduce((sum, item) => sum + item.quantity, 0)} Room(s) Selected</p>
                    <p className="text-primary-foreground/80 text-sm">Total: {formatCurrency(cart.reduce((sum, item) => sum + (item.room.price * item.quantity), 0), property?.currency)} / night</p>
                  </div>
                  <Button size="lg" variant="secondary" className="px-8 font-bold w-full sm:w-auto" onClick={() => setStep('checkout')}>
                    Proceed to Checkout
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Room Details Dialog */}
          <Dialog open={!!viewingRoom} onOpenChange={(open) => !open && setViewingRoom(null)}>
            <DialogContent className="max-w-3xl p-0 overflow-hidden bg-background">
              {viewingRoom && (
                <div className="flex flex-col md:flex-row h-full max-h-[85vh]">
                  {/* Left: Images */}
                  <div className="w-full md:w-1/2 bg-muted flex flex-col">
                    <div className="w-full aspect-video md:aspect-square relative">
                      {activeImage ? (
                        <img src={activeImage} alt={viewingRoom.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><BedDouble className="w-10 h-10 opacity-20" /></div>
                      )}
                    </div>
                    {viewingRoom.gallery_images && viewingRoom.gallery_images.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto p-4 bg-background border-t" style={{ scrollbarWidth: 'thin' }}>
                        {viewingRoom.featured_image && (
                          <img 
                            src={viewingRoom.featured_image} 
                            alt="Featured" 
                            className={`w-20 h-14 object-cover rounded-md cursor-pointer border-2 ${activeImage === viewingRoom.featured_image ? 'border-primary' : 'border-transparent'}`}
                            onClick={() => setActiveImage(viewingRoom.featured_image)}
                          />
                        )}
                        {viewingRoom.gallery_images.map((img: string, i: number) => (
                          <img 
                            key={i} 
                            src={img} 
                            alt={`Gallery ${i+1}`} 
                            className={`w-20 h-14 object-cover rounded-md cursor-pointer border-2 ${activeImage === img ? 'border-primary' : 'border-transparent'}`}
                            onClick={() => setActiveImage(img)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Right: Details */}
                  <div className="w-full md:w-1/2 p-6 flex flex-col overflow-y-auto">
                    <DialogHeader className="text-left mb-4">
                      <DialogTitle className="text-2xl">{viewingRoom.title}</DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4 flex-1">
                      <p className="text-muted-foreground">{viewingRoom.description || "A beautiful room ready for your stay."}</p>
                      
                      <div className="grid grid-cols-2 gap-y-3 text-sm">
                        <div className="flex items-center text-muted-foreground"><Users className="w-4 h-4 mr-2" /> Up to {viewingRoom.max_adults + viewingRoom.max_children} Guests</div>
                        <div className="flex items-center text-muted-foreground"><BedDouble className="w-4 h-4 mr-2" /> {viewingRoom.bed_type || '1 Bed'}</div>
                        <div className="col-span-2 text-muted-foreground"><strong>View:</strong> {viewingRoom.view_type || 'Standard View'}</div>
                      </div>

                      {/* Amenities section (Will populate once SQL is updated) */}
                      {viewingRoom.amenities && viewingRoom.amenities.length > 0 && (
                        <div className="pt-4 border-t mt-4">
                          <h4 className="font-semibold mb-3">Amenities</h4>
                          <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                            {viewingRoom.amenities.map((amenity: string, i: number) => (
                              <div key={i} className="flex items-center">• {amenity}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="pt-6 border-t mt-6 flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0">
                      <div className="text-center sm:text-left">
                        <p className="text-xs text-muted-foreground uppercase font-semibold">Nightly Rate</p>
                        <p className="text-2xl font-bold text-primary">{formatCurrency(viewingRoom.price, property?.currency)}</p>
                      </div>
                      <Button size="lg" className="w-full sm:w-auto px-8 shadow-md hover:shadow-lg transition-all" onClick={() => {
                        setViewingRoom(null);
                        handleAddToCart(viewingRoom);
                      }}>
                        Select Room
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Step 3: Checkout Flow */}
          {step === 'checkout' && cart.length > 0 && (
            <div className="max-w-2xl mx-auto">
              <Button variant="ghost" className="mb-6 -ml-4" onClick={() => setStep('results')}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Rooms
              </Button>
              
              <div className="bg-muted/30 p-6 rounded-xl border mb-8">
                <h3 className="font-semibold text-lg mb-4 border-b pb-2">Booking Summary</h3>
                
                <div className="space-y-4 mb-4 border-b pb-4">
                  {cart.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <div>
                        <span className="font-medium block">{item.room.title}</span>
                        <span className="text-muted-foreground">{item.quantity} room(s) × {item.guests_per_room} guests</span>
                      </div>
                      <span className="font-medium">{formatCurrency(item.room.price * item.quantity, property?.currency)} / night</span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                  <div>
                    <span className="text-muted-foreground block">Dates</span>
                    <span className="font-medium">{format(new Date(checkIn), 'MMM d')} - {format(new Date(checkOut), 'MMM d, yyyy')}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground block">Total Price</span>
                    <span className="font-bold text-primary text-xl">
                      {formatCurrency(cart.reduce((sum, item) => sum + (item.room.price * item.quantity), 0) * Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 3600 * 24)), property?.currency)}
                    </span>
                  </div>
                </div>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onCheckoutSubmit)} className="space-y-6">
                  <h3 className="font-semibold text-lg">Guest Details</h3>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl><Input type="email" placeholder="john@example.com" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl><Input placeholder="+1 (555) 000-0000" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button type="submit" size="lg" className="w-full h-12 text-lg mt-4">
                    Continue to Payment
                  </Button>
                </form>
              </Form>
            </div>
          )}

          {/* Step 4: Payment Flow */}
          {step === 'payment' && guestDetails && (
            <div className="max-w-xl mx-auto">
              <Button variant="ghost" className="mb-6 -ml-4" onClick={() => setStep('checkout')}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Details
              </Button>
              
              <div className="bg-card p-8 rounded-xl border shadow-sm">
                <h3 className="text-2xl font-semibold mb-6">Payment Method</h3>
                
                <div className="border rounded-lg p-4 border-primary bg-primary/5 flex items-center justify-between mb-8 cursor-default">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border-2 border-primary flex items-center justify-center">
                      <div className="w-2.5 h-2.5 bg-primary rounded-full"></div>
                    </div>
                    <div>
                      <p className="font-medium">Pay on Arrival</p>
                      <p className="text-sm text-muted-foreground">You will pay at the property during check-in.</p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6 space-y-4">
                  <div className="flex justify-between text-lg font-medium">
                    <span>Total Amount</span>
                    <span>{formatCurrency(cart.reduce((sum, item) => sum + (item.room.price * item.quantity), 0) * Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 3600 * 24)), property?.currency)}</span>
                  </div>
                  <Button size="lg" className="w-full h-14 text-lg" disabled={isBooking} onClick={onPaymentSubmit}>
                    {isBooking ? 'Processing...' : 'Place Booking'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 'success' && (
            <div className="text-center py-16 max-w-md mx-auto">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-3xl font-bold mb-4">Booking Confirmed!</h3>
              <p className="text-muted-foreground mb-8 text-lg">
                Thank you for booking with {property.name}. We have saved your reservation and look forward to hosting you!
              </p>
              <Button size="lg" variant="outline" onClick={() => { setStep('search'); form.reset(); }}>
                Book Another Room
              </Button>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
