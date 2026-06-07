import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useProperty, useUpdateProperty } from '@/hooks/useSupabase';

const settingsSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  address: z.string().min(5, 'Address is required'),
  phone: z.string(),
  email: z.string().email(),
  currency: z.string().min(3).max(3),
  timezone: z.string(),
});

type SettingsValues = z.infer<typeof settingsSchema>;

export default function Settings() {
  const { data: property, isLoading } = useProperty();
  const { mutateAsync: updateProperty, isPending } = useUpdateProperty();

  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: '',
      address: '',
      phone: '',
      email: '',
      currency: 'USD',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });

  // Populate form when property data loads
  useEffect(() => {
    if (property) {
      form.reset({
        name: property.name || '',
        address: property.address || '',
        phone: property.phone || '',
        email: property.email || '',
        currency: property.currency || 'USD',
        timezone: property.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    }
  }, [property, form]);

  async function onSubmit(data: SettingsValues) {
    if (!property?.id) return;
    try {
      await updateProperty({
        id: property.id,
        ...data,
      });
      alert("Settings saved successfully!");
    } catch (err: any) {
      alert("Failed to save settings: " + err.message);
    }
  }

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading settings...</div>;

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Property Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your property details, branding, and localization.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General Information</CardTitle>
          <CardDescription>
            These details will be displayed on your booking engine and customer emails.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
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
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency Code</FormLabel>
                      <FormControl>
                        <select 
                          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          {...field}
                        >
                          <option value="USD">USD - US Dollar</option>
                          <option value="LKR">LKR - Sri Lankan Rupee</option>
                        </select>
                      </FormControl>
                      <FormDescription>Select the currency for your booking widget.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timezone</FormLabel>
                      <FormControl>
                        <Input {...field} readOnly className="bg-muted text-muted-foreground" />
                      </FormControl>
                      <FormDescription>Automatically detected from your device.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="mt-8">
          <CardHeader>
            <CardTitle>Booking Widget Embed Code</CardTitle>
            <CardDescription>
              Copy and paste this code into your website's HTML to embed the public booking widget.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-md relative group">
              <pre className="text-sm overflow-x-auto whitespace-pre-wrap font-mono text-muted-foreground">
{`<iframe 
  src="${window.location.origin}/embed/${property?.slug || property?.id}" 
  width="100%" 
  height="900px" 
  style="border:none;"
>${'</'}iframe>`}
              </pre>
              <Button 
                variant="secondary" 
                size="sm" 
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => {
                  const code = `<iframe src="${window.location.origin}/embed/${property?.slug || property?.id}" width="100%" height="900px" style="border:none;">${'</'}iframe>`;
                  navigator.clipboard.writeText(code);
                  alert("Copied to clipboard!");
                }}
              >
                Copy Code
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Note: We recommend setting the height to 800px-1000px depending on the amount of content you have.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
