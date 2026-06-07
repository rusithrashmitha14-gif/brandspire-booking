import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useProperty, useEnsureProperty, useRoomTypes, useCreateRoomType, useUpdateRoomType, useDeleteRoomType, useAmenities } from '@/hooks/useSupabase';

const roomTypeSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters.'),
  description: z.string().optional(),
  max_adults: z.coerce.number().min(1, 'Must allow at least 1 adult.'),
  max_children: z.coerce.number().min(0, 'Cannot be negative.'),
  bed_type: z.string().optional(),
  view_type: z.string().optional(),
  featured_image: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  gallery_images_text: z.string().optional(),
  quantity: z.coerce.number().min(1, 'Must have at least 1 room unit.'),
  price: z.coerce.number().min(0, 'Price must be positive.'),
  amenity_ids: z.array(z.string()).default([]),
});

type RoomTypeFormValues = z.infer<typeof roomTypeSchema>;

export default function Rooms() {
  const [open, setOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<any>(null);
  
  const { data: property, isLoading: isPropertyLoading } = useProperty();
  const { mutateAsync: ensureProperty } = useEnsureProperty();
  const { data: rooms = [], isLoading: isRoomsLoading } = useRoomTypes(property?.id);
  const { data: amenities = [] } = useAmenities();
  
  const { mutateAsync: createRoomType, isPending: isCreating } = useCreateRoomType();
  const { mutateAsync: updateRoomType, isPending: isUpdating } = useUpdateRoomType();
  const { mutateAsync: deleteRoomType } = useDeleteRoomType();

  const isPending = isCreating || isUpdating;

  useEffect(() => {
    if (!isPropertyLoading && !property) {
      ensureProperty();
    }
  }, [property, isPropertyLoading, ensureProperty]);

  const form = useForm<RoomTypeFormValues>({
    resolver: zodResolver(roomTypeSchema),
    defaultValues: {
      title: '',
      description: '',
      max_adults: 2,
      max_children: 0,
      bed_type: '1 King Bed',
      view_type: 'City View',
      featured_image: '',
      quantity: 1,
      price: 0,
      amenity_ids: [],
    },
  });

  // Handle opening the dialog for editing
  const handleEditClick = (room: any) => {
    setEditingRoom(room);
    
    // Map existing amenities to just an array of IDs
    const currentAmenityIds = room.room_amenities?.map((a: any) => a.amenity_id) || [];

    form.reset({
      title: room.title,
      description: room.description || '',
      max_adults: room.max_adults,
      max_children: room.max_children || 0,
      bed_type: room.bed_type || '',
      view_type: room.view_type || '',
      featured_image: room.featured_image || '',
      gallery_images_text: room.gallery_images ? room.gallery_images.join('\n') : '',
      quantity: room.quantity,
      price: room.price,
      amenity_ids: currentAmenityIds,
    });
    setOpen(true);
  };

  // Handle opening the dialog for a new room
  const handleAddNewClick = () => {
    setEditingRoom(null);
    form.reset({
      title: '',
      description: '',
      max_adults: 2,
      max_children: 0,
      bed_type: '1 King Bed',
      view_type: 'City View',
      featured_image: '',
      quantity: 1,
      price: 0,
      amenity_ids: [],
    });
    setOpen(true);
  };

  async function onSubmit(data: RoomTypeFormValues) {
    if (!property) return;
    try {
      const { gallery_images_text, ...rest } = data;
      const gallery_images = gallery_images_text 
        ? gallery_images_text.split('\n').map(u => u.trim()).filter(u => u.length > 0) 
        : [];

      if (editingRoom) {
        await updateRoomType({
          id: editingRoom.id,
          property_id: property.id,
          gallery_images,
          ...rest
        });
      } else {
        await createRoomType({
          property_id: property.id,
          gallery_images,
          ...rest
        });
      }
      setOpen(false);
      setEditingRoom(null);
      form.reset();
    } catch (error) {
      console.error("Failed to save room:", error);
    }
  }

  const handleDeleteClick = async (roomId: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete the ${title} room type? This will permanently delete all physical room units and bookings associated with it.`)) {
      try {
        await deleteRoomType(roomId);
      } catch (error) {
        alert("Failed to delete room type. Please try again.");
      }
    }
  };

  return (
    <div className="p-8 flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rooms</h1>
          <p className="text-muted-foreground mt-1">Manage your property's room types and physical room units.</p>
        </div>

        <Dialog open={open} onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) {
            setEditingRoom(null);
            form.reset();
          }
        }}>
          <div className="flex gap-4">
            <Button variant="outline" asChild>
              <Link to="/admin/amenities">Manage Amenities</Link>
            </Button>
            <DialogTrigger asChild>
              <Button disabled={!property} onClick={handleAddNewClick}>
                <Plus className="mr-2 h-4 w-4" /> Add Room Type
              </Button>
            </DialogTrigger>
          </div>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRoom ? 'Edit Room Type' : 'Add Room Type'}</DialogTitle>
              <DialogDescription>
                {editingRoom 
                  ? 'Update the details for this room category.' 
                  : 'Create a new room category and assign amenities.'}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem className="col-span-2 md:col-span-1">
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Deluxe Suite" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem className="col-span-2 md:col-span-1">
                        <FormLabel>Base Price (Nightly)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input placeholder="A spacious suite with..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bed_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bed Type</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 1 King Bed" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="featured_image"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Featured Image URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://... or paste from Gallery" {...field} />
                        </FormControl>
                        <FormDescription>
                          Paste a URL here from the Photo Gallery to display an image for this room.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="gallery_images_text"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Gallery Image URLs (One per line)</FormLabel>
                        <FormControl>
                          <textarea 
                            placeholder="https://..." 
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Paste multiple URLs from the Photo Gallery here. Put each URL on a new line.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="view_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>View Type</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Ocean View" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="max_adults"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Adults</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="max_children"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Children</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Units</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" {...field} />
                        </FormControl>
                        <FormDescription className="text-xs">
                          {editingRoom ? 'Increasing this creates new units.' : ''}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Amenities Selection Section */}
                <div className="border-t pt-4">
                  <h4 className="text-base font-medium mb-1">Room Amenities</h4>
                  <p className="text-[0.8rem] text-muted-foreground mb-4">
                    Select the amenities included in this room type.
                  </p>
                  {amenities.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-md">
                      No amenities found in the database. Please run the SQL seed script to add them.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {amenities.map((item) => (
                        <FormField
                          key={item.id}
                          control={form.control}
                          name="amenity_ids"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={item.id}
                                className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 bg-card"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(item.id)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, item.id])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== item.id
                                            )
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer flex-1">
                                  {item.icon && <span className="mr-2 text-muted-foreground">{item.icon}</span>}
                                  {item.name}
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <Button type="submit" disabled={isPending}>
                    {isPending ? 'Saving...' : (editingRoom ? 'Save Changes' : 'Create Room')}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-card flex-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Bed & View</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>Amenities</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Price</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isRoomsLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">Loading rooms...</TableCell>
              </TableRow>
            )}
            {!isRoomsLoading && rooms.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No rooms created yet. Click "Add Room Type" to get started.</TableCell>
              </TableRow>
            )}
            {rooms.map((room) => (
              <TableRow key={room.id}>
                <TableCell className="font-medium">
                  {room.title}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  <div>{room.bed_type || '-'}</div>
                  <div>{room.view_type || '-'}</div>
                </TableCell>
                <TableCell className="text-sm">
                  {room.max_adults} Adults, {room.max_children} Children
                </TableCell>
                <TableCell className="text-sm">
                  {room.room_amenities?.length || 0} selected
                </TableCell>
                <TableCell>{room.quantity}</TableCell>
                <TableCell>${room.price}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEditClick(room)}>Edit</Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDeleteClick(room.id, room.title)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
