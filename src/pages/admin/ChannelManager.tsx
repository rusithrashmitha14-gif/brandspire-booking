import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useProperty } from '@/hooks/useSupabase';
import { RefreshCw, Link as LinkIcon, Plus, Copy, Trash2, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ChannelManager() {
  const { data: property } = useProperty();
  const queryClient = useQueryClient();
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch Room Units
  const { data: units = [] } = useQuery({
    queryKey: ['room_units', property?.id],
    queryFn: async () => {
      if (!property?.id) return [];
      const { data, error } = await supabase
        .from('room_units')
        .select(`
          id, 
          room_number, 
          ical_export_token,
          room_types (title)
        `)
        .eq('room_types.property_id', property.id);
      if (error) throw error;
      // Filter out units where room_types is null (meaning it belongs to a different property)
      return data.filter((u: any) => u.room_types !== null);
    },
    enabled: !!property?.id,
  });

  // Fetch iCal Imports
  const { data: imports = [] } = useQuery({
    queryKey: ['ical_imports', property?.id],
    queryFn: async () => {
      if (!property?.id) return [];
      const { data, error } = await supabase
        .from('ical_imports')
        .select('*')
        .eq('property_id', property.id);
      if (error) throw error;
      return data;
    },
    enabled: !!property?.id,
  });

  // Add Import Mutation
  const addImport = useMutation({
    mutationFn: async () => {
      if (!property?.id || !selectedUnit || !newName || !newUrl) return;
      const { error } = await supabase.from('ical_imports').insert({
        property_id: property.id,
        room_unit_id: selectedUnit,
        name: newName,
        url: newUrl,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ical_imports'] });
      setNewUrl('');
      setNewName('');
    }
  });

  // Delete Import Mutation
  const deleteImport = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ical_imports').delete().eq('id', id);
      if (error) throw error;
      
      // Also delete blocked dates associated with this import
      await supabase.from('blocked_dates').delete().eq('external_id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ical_imports'] });
      queryClient.invalidateQueries({ queryKey: ['calendar_data'] });
    }
  });

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      // In production, we would call the Edge Function. 
      // For local development MVP, we simulate the call since the Edge function handles the fetching.
      const res = await supabase.functions.invoke(`ical-manager?action=sync&property_id=${property?.id || ''}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (res.error) throw res.error;
      alert(`Sync completed! Synced ${res.data.synced} calendars.`);
      queryClient.invalidateQueries({ queryKey: ['ical_imports'] });
      queryClient.invalidateQueries({ queryKey: ['calendar_data'] });
    } catch (e: any) {
      alert("Failed to sync: " + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const copyToClipboard = (token: string) => {
    const url = `https://ojborjebrczqndlczrec.supabase.co/functions/v1/ical-manager?action=export&token=${token}`;
    navigator.clipboard.writeText(url);
    alert('Export URL copied to clipboard! Paste this into Airbnb/VRBO.');
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Channel Manager</h1>
          <p className="text-muted-foreground mt-1">Sync your availability automatically with Airbnb, Booking.com, and VRBO via iCal.</p>
        </div>
        <Button onClick={handleSyncAll} disabled={isSyncing} size="lg">
          <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync All Calendars Now'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Col: Export Links */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center"><LinkIcon className="w-5 h-5 mr-2 text-primary" /> Export Calendars</CardTitle>
              <CardDescription>Copy these links and paste them into Airbnb or VRBO to automatically block dates when someone books directly on your site.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {units.map((unit: any) => (
                <div key={unit.id} className="flex flex-col gap-2 p-4 border rounded-lg bg-muted/30">
                  <div className="font-semibold">{unit.room_types?.title} - {unit.room_number}</div>
                  <div className="flex gap-2">
                    <Input 
                      readOnly 
                      value={`https://ojborjebrczqndlczrec.supabase.co/functions/v1/ical-manager?action=export&token=${unit.ical_export_token}`} 
                      className="bg-muted text-muted-foreground"
                    />
                    <Button variant="secondary" onClick={() => copyToClipboard(unit.ical_export_token)}>
                      <Copy className="w-4 h-4 mr-2" /> Copy
                    </Button>
                  </div>
                </div>
              ))}
              {units.length === 0 && <p className="text-sm text-muted-foreground">Create Room Units first to generate export links.</p>}
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Import Links */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center"><CalendarDays className="w-5 h-5 mr-2 text-primary" /> Imported Calendars</CardTitle>
              <CardDescription>Paste iCal links from Airbnb/VRBO here. When those dates are booked externally, they will be blocked on your direct booking site.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mb-8">
                {imports.map((imp: any) => {
                  const unit = units.find((u: any) => u.id === imp.room_unit_id);
                  return (
                    <div key={imp.id} className="flex justify-between items-center p-4 border rounded-lg">
                      <div>
                        <div className="font-semibold text-sm">{imp.name}</div>
                        <div className="text-xs text-muted-foreground mt-1 truncate max-w-[250px]">{imp.url}</div>
                        <div className="text-xs text-primary mt-2">Target: {unit?.room_types?.title} - {unit?.room_number}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Last synced: {imp.last_synced_at ? new Date(imp.last_synced_at).toLocaleString() : 'Never'}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => deleteImport.mutate(imp.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
                {imports.length === 0 && <p className="text-sm text-muted-foreground italic">No calendars imported yet.</p>}
              </div>

              <div className="border-t pt-6 space-y-4">
                <h4 className="font-semibold">Add New Calendar Import</h4>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Platform Name</Label>
                    <Input placeholder="e.g. Airbnb - Villa Ocean View" value={newName} onChange={e => setNewName(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>iCal URL (.ics link)</Label>
                    <Input placeholder="https://www.airbnb.com/calendar/ical/..." value={newUrl} onChange={e => setNewUrl(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Target Room Unit</Label>
                    <select 
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={selectedUnit}
                      onChange={e => setSelectedUnit(e.target.value)}
                    >
                      <option value="" disabled>Select a room unit...</option>
                      {units.map((unit: any) => (
                        <option key={unit.id} value={unit.id}>{unit.room_types?.title} - Unit {unit.room_number}</option>
                      ))}
                    </select>
                  </div>
                  <Button onClick={() => addImport.mutate()} disabled={!newName || !newUrl || !selectedUnit || addImport.isPending}>
                    <Plus className="w-4 h-4 mr-2" /> Add Calendar Import
                  </Button>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
