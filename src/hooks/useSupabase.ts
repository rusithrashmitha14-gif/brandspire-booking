import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// Fetch the main property
export function useProperty() {
  return useQuery({
    queryKey: ['property'],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('user_id', user.user.id)
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });
}

export function useUpdateProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: {
      id: string;
      name?: string;
      address?: string;
      phone?: string;
      email?: string;
      currency?: string;
      timezone?: string;
    }) => {
      const { id, ...rest } = updates;
      const { data, error } = await supabase
        .from('properties')
        .update(rest)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property'] });
    },
  });
}

export function useEnsureProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data: existing } = await supabase
        .from('properties')
        .select('id')
        .eq('user_id', user.user.id)
        .limit(1)
        .single();
        
      if (existing) return existing;

      const { data, error } = await supabase
        .from('properties')
        .insert([{
          user_id: user.user.id,
          name: 'My Property',
          slug: `property-${Math.random().toString(36).substring(7)}`,
          description: 'A beautiful luxury property.',
        }])
        .select('id')
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property'] });
    }
  });
}

// Fetch all available amenities from the database
export function useAmenities(propertyId?: string) {
  return useQuery({
    queryKey: ['amenities', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      const { data, error } = await supabase
        .from('amenities')
        .select('*')
        .eq('property_id', propertyId)
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!propertyId,
  });
}

// Fetch room types with their attached amenities
export function useRoomTypes(propertyId?: string) {
  return useQuery({
    queryKey: ['room_types', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      const { data, error } = await supabase
        .from('room_types')
        .select(`
          *,
          room_amenities (
            amenity_id,
            amenities ( name, icon )
          )
        `)
        .eq('property_id', propertyId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!propertyId,
  });
}

export function useCreateRoomType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newRoom: {
      property_id: string;
      title: string;
      description?: string;
      max_adults: number;
      max_children: number;
      quantity: number;
      price: number;
      bed_type?: string;
      view_type?: string;
      featured_image?: string;
      gallery_images?: string[];
      amenity_ids?: string[];
    }) => {
      const { amenity_ids, ...roomData } = newRoom;
      
      // 1. Insert the Room Type
      const { data: room, error: roomError } = await supabase
        .from('room_types')
        .insert([
          {
            ...roomData,
            slug: roomData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          }
        ])
        .select()
        .single();
      
      if (roomError) throw roomError;

      // 2. Insert the physical Room Units (Quantity)
      if (roomData.quantity > 0) {
        const unitInserts = Array.from({ length: roomData.quantity }).map((_, idx) => ({
          room_type_id: room.id,
          room_number: `${room.title.substring(0, 3).toUpperCase()}-${idx + 1}`
        }));
        
        const { error: unitsError } = await supabase
          .from('room_units')
          .insert(unitInserts);
          
        if (unitsError) throw unitsError;
      }

      // 3. Insert the Amenities into the join table
      if (amenity_ids && amenity_ids.length > 0) {
        const amenityInserts = amenity_ids.map(id => ({
          room_type_id: room.id,
          amenity_id: id
        }));
        
        const { error: amenityError } = await supabase
          .from('room_amenities')
          .insert(amenityInserts);
          
        if (amenityError) throw amenityError;
      }

      return room;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['room_types', variables.property_id] });
    }
  });
}

// Update a room type
export function useUpdateRoomType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updateRoom: {
      id: string;
      property_id: string;
      title: string;
      description?: string;
      max_adults: number;
      max_children: number;
      quantity: number;
      price: number;
      bed_type?: string;
      view_type?: string;
      featured_image?: string;
      gallery_images?: string[];
      amenity_ids?: string[];
    }) => {
      const { id, amenity_ids, ...roomData } = updateRoom;
      
      const { data: room, error: roomError } = await supabase
        .from('room_types')
        .update({
          ...roomData,
          slug: roomData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        })
        .eq('id', id)
        .select()
        .single();
      
      if (roomError) throw roomError;

      // Update Amenities
      if (amenity_ids !== undefined) {
        // Clear existing
        await supabase.from('room_amenities').delete().eq('room_type_id', id);
        
        // Insert new ones
        if (amenity_ids.length > 0) {
          const amenityInserts = amenity_ids.map(aId => ({
            room_type_id: id,
            amenity_id: aId
          }));
          await supabase.from('room_amenities').insert(amenityInserts);
        }
      }

      // Sync physical room units based on new quantity
      const { data: existingUnits } = await supabase
        .from('room_units')
        .select('*')
        .eq('room_type_id', id)
        .order('room_number', { ascending: true });
        
      if (existingUnits) {
        const currentCount = existingUnits.length;
        if (roomData.quantity > currentCount) {
          // Add more units
          const diff = roomData.quantity - currentCount;
          const unitInserts = Array.from({ length: diff }).map((_, idx) => ({
            room_type_id: room.id,
            room_number: `${room.title.substring(0, 3).toUpperCase()}-${currentCount + idx + 1}`
          }));
          await supabase.from('room_units').insert(unitInserts);
        } else if (roomData.quantity < currentCount) {
          // Delete excess units (removes from the end)
          const diff = currentCount - roomData.quantity;
          const unitsToDelete = existingUnits.slice(-diff).map(u => u.id);
          await supabase.from('room_units').delete().in('id', unitsToDelete);
        }
      }

      return room;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['room_types', variables.property_id] });
      queryClient.invalidateQueries({ queryKey: ['calendar_data'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    }
  });
}

// Delete a room type
export function useDeleteRoomType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (roomTypeId: string) => {
      const { error } = await supabase
        .from('room_types')
        .delete()
        .eq('id', roomTypeId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room_types'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    }
  });
}

// Create a new amenity
export function useCreateAmenity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newAmenity: { name: string; icon?: string; property_id: string }) => {
      const { data, error } = await supabase
        .from('amenities')
        .insert([newAmenity])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['amenities', variables.property_id] });
    }
  });
}

export function useDeleteAmenity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('amenities')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['amenities'] });
      // Might want to invalidate room_types if we want instant UI updates there too
    }
  });
}

// Check availability via RPC function
export function useAvailableRooms(propertyId: string, checkIn: string, checkOut: string, guests: number, enabled: boolean = false) {
  return useQuery({
    queryKey: ['available_rooms', propertyId, checkIn, checkOut, guests],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_available_room_types', {
        p_property_id: propertyId,
        p_check_in: checkIn,
        p_check_out: checkOut,
        p_guests: guests
      });

      if (error) throw error;
      return data;
    },
    enabled: !!propertyId && !!checkIn && !!checkOut && enabled,
  });
}

// Create multiple bookings via cart
export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bookingData: {
      p_property_id: string;
      p_check_in: string;
      p_check_out: string;
      p_guest_name: string;
      p_guest_email: string;
      p_guest_phone: string;
      p_cart_items: { room_type_id: string; quantity: number; guests_per_room: number }[];
    }) => {
      const { data, error } = await supabase.rpc('create_cart_bookings', bookingData);
      
      if (error) throw error;
      return data; // Returns booking_group_id
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['available_rooms'] });
      queryClient.invalidateQueries({ queryKey: ['property_bookings'] });
    }
  });
}

// Fetch dashboard stats
export function useDashboardStats(propertyId?: string) {
  return useQuery({
    queryKey: ['dashboard_stats', propertyId],
    queryFn: async () => {
      if (!propertyId) return null;
      
      const { count: totalBookings } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('property_id', propertyId);
        
      const { count: activeRooms } = await supabase
        .from('room_units')
        .select('ru:room_types!inner(property_id)', { count: 'exact', head: true })
        .eq('room_types.property_id', propertyId);

      return {
        totalBookings: totalBookings || 0,
        activeRooms: activeRooms || 0,
      };
    },
    enabled: !!propertyId
  });
}

// Fetch recent bookings
export function useRecentBookings(propertyId?: string) {
  return useQuery({
    queryKey: ['recent_bookings', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          guest_name,
          guest_email,
          check_in,
          check_out,
          booking_status,
          room_units (
            room_number,
            room_types ( title )
          )
        `)
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false })
        .limit(5);
        
      if (error) throw error;
      return data;
    },
    enabled: !!propertyId
  });
}

// Fetch data for the Calendar View
export function useCalendarData(propertyId?: string, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['calendar_data', propertyId, startDate, endDate],
    queryFn: async () => {
      if (!propertyId || !startDate || !endDate) return { units: [], bookings: [] };

      // Fetch all room units for this property
      const { data: units, error: unitsError } = await supabase
        .from('room_units')
        .select(`
          id,
          room_number,
          room_type_id,
          room_types!inner(title, property_id)
        `)
        .eq('room_types.property_id', propertyId)
        .order('room_type_id', { ascending: true })
        .order('room_number', { ascending: true });
        
      if (unitsError) throw unitsError;

      // Fetch bookings that overlap with this date range
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('property_id', propertyId)
        .lte('check_in', endDate)
        .gte('check_out', startDate)
        .neq('booking_status', 'Cancelled');

      if (bookingsError) throw bookingsError;

      return { units: units || [], bookings: bookings || [] };
    },
    enabled: !!propertyId && !!startDate && !!endDate
  });
}

// Fetch all uploaded images from Supabase Storage
export function useGalleryImages(propertyId?: string) {
  return useQuery({
    queryKey: ['gallery_images', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      const { data, error } = await supabase
        .storage
        .from('property_images')
        .list(propertyId, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (error) throw error;
      
      // Filter out hidden files like .emptyFolderPlaceholder
      // And prefix with propertyId so getImageUrl works if it needs full path
      return data.filter(file => !file.name.startsWith('.')).map(f => ({
        ...f,
        name: `${propertyId}/${f.name}`
      }));
    },
    enabled: !!propertyId
  });
}

// Get public URL for an image
export function getImageUrl(path: string) {
  if (!path) return '';
  const { data } = supabase.storage.from('property_images').getPublicUrl(path);
  return data.publicUrl;
}

// Upload image hook
export function useUploadImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, propertyId }: { file: File, propertyId: string }) => {
      // Create a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `${propertyId}/${fileName}`;

      const { error } = await supabase.storage
        .from('property_images')
        .upload(filePath, file);

      if (error) throw error;
      return filePath;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['gallery_images', variables.propertyId] });
    }
  });
}

// Fetch all bookings for the property (for admin management)
export function useAllBookings(propertyId?: string) {
  return useQuery({
    queryKey: ['all_bookings', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          guest_name,
          guest_email,
          guest_phone,
          check_in,
          check_out,
          booking_status,
          created_at,
          booking_group_id,
          room_units (
            room_number,
            room_types ( title, price )
          )
        `)
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data;
    },
    enabled: !!propertyId
  });
}

// Update a booking's status
export function useUpdateBookingStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ groupId, status }: { groupId: string, status: string }) => {
      const { data, error } = await supabase
        .from('bookings')
        .update({ booking_status: status })
        .eq('booking_group_id', groupId)
        .select();
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_bookings'] });
      queryClient.invalidateQueries({ queryKey: ['recent_bookings'] });
      queryClient.invalidateQueries({ queryKey: ['calendar_data'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    }
  });
}

