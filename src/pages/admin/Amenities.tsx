import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useProperty, useAmenities, useCreateAmenity, useDeleteAmenity } from '@/hooks/useSupabase';

const amenitySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  icon: z.string().optional(),
});

type AmenityFormValues = z.infer<typeof amenitySchema>;

export default function Amenities() {
  const [open, setOpen] = useState(false);
  
  const { data: property } = useProperty();
  const { data: amenities = [], isLoading } = useAmenities(property?.id);
  const { mutateAsync: createAmenity, isPending } = useCreateAmenity();
  const { mutateAsync: deleteAmenity } = useDeleteAmenity();

  const form = useForm<AmenityFormValues>({
    resolver: zodResolver(amenitySchema),
    defaultValues: {
      name: '',
      icon: '',
    },
  });

  async function onSubmit(data: AmenityFormValues) {
    if (!property?.id) return;
    try {
      await createAmenity({ ...data, property_id: property.id });
      setOpen(false);
      form.reset();
    } catch (error) {
      console.error("Failed to create amenity:", error);
    }
  }

  async function handleDelete(id: string) {
    if (confirm("Are you sure you want to delete this amenity?")) {
      try {
        await deleteAmenity(id);
      } catch (error) {
        console.error("Failed to delete amenity:", error);
      }
    }
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="mb-2">
            <Button variant="ghost" size="sm" asChild className="-ml-3 text-muted-foreground">
              <Link to="/admin/rooms">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Rooms
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Amenities</h1>
          <p className="text-muted-foreground mt-1">Manage global amenities available across your properties.</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Amenity
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Amenity</DialogTitle>
              <DialogDescription>
                Create a new amenity tag that you can later assign to specific room types.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amenity Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Free Wi-Fi" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="icon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Icon Name (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. wifi, tv, coffee" {...field} />
                      </FormControl>
                      <FormDescription>
                        Identifier for a front-end icon library.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={isPending}>
                    {isPending ? 'Saving...' : 'Save Amenity'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Amenity Name</TableHead>
              <TableHead>Icon Identifier</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">Loading amenities...</TableCell>
              </TableRow>
            )}
            {!isLoading && amenities.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No amenities found. Create your first one!</TableCell>
              </TableRow>
            )}
            {amenities.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="text-muted-foreground">{item.icon || '-'}</TableCell>
                <TableCell className="text-right">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-destructive"
                    onClick={() => handleDelete(item.id)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>

            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
