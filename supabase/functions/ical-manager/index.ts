import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to format Date to YYYYMMDD string
function formatICalDateOnly(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

// Helper to format Date to YYYYMMDDTHHMMSSZ string
function formatICalDateTime(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${h}${min}${s}Z`;
}

// Simple iCal parser
function parseICal(icalString: string) {
  const events = [];
  const lines = icalString.split(/\r?\n/);
  let currentEvent: any = null;
  
  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) {
      currentEvent = {};
    } else if (line.startsWith("END:VEVENT")) {
      if (currentEvent && currentEvent.start && currentEvent.end) {
        events.push(currentEvent);
      }
      currentEvent = null;
    } else if (currentEvent && line.startsWith("DTSTART")) {
      const parts = line.split(":");
      if (parts.length > 1) currentEvent.start = parts[1].substring(0, 8); // YYYYMMDD
    } else if (currentEvent && line.startsWith("DTEND")) {
      const parts = line.split(":");
      if (parts.length > 1) currentEvent.end = parts[1].substring(0, 8);
    } else if (currentEvent && line.startsWith("SUMMARY")) {
      currentEvent.summary = line.substring(8);
    } else if (currentEvent && line.startsWith("UID")) {
      currentEvent.uid = line.substring(4);
    }
  }
  return events;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    
    // Initialize Supabase Client with Service Role Key to bypass RLS for server operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ==========================================
    // ACTION: EXPORT (.ics file download)
    // ==========================================
    if (action === "export") {
      const token = url.searchParams.get("token");
      if (!token) return new Response("Missing token", { status: 400 });

      // Find the room unit by token
      const { data: roomUnit, error: unitError } = await supabase
        .from("room_units")
        .select("id, room_number, property_id, room_types(title)")
        .eq("ical_export_token", token)
        .single();

      if (unitError || !roomUnit) {
        return new Response("Invalid token", { status: 401 });
      }

      // Fetch bookings for this unit
      const { data: bookings } = await supabase
        .from("bookings")
        .select("id, check_in, check_out")
        .eq("room_unit_id", roomUnit.id)
        .in("booking_status", ["Confirmed", "Pending"]);

      // Fetch manual blocked dates
      const { data: blockedDates } = await supabase
        .from("blocked_dates")
        .select("id, start_date, end_date, reason")
        .eq("room_unit_id", roomUnit.id)
        .eq("source", "manual");

      // Generate iCal string
      const unitName = `${roomUnit.room_types?.title} - ${roomUnit.room_number}`;
      let ical = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Brandspire//Booking Engine//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:${unitName}\r\n`;

      const nowStr = formatICalDateTime(new Date());

      // Add Bookings
      for (const b of (bookings || [])) {
        ical += `BEGIN:VEVENT\r\n`;
        ical += `UID:booking-${b.id}@brandspire\r\n`;
        ical += `DTSTAMP:${nowStr}\r\n`;
        ical += `DTSTART;VALUE=DATE:${formatICalDateOnly(new Date(b.check_in))}\r\n`;
        ical += `DTEND;VALUE=DATE:${formatICalDateOnly(new Date(b.check_out))}\r\n`;
        ical += `SUMMARY:Reserved\r\n`;
        ical += `STATUS:CONFIRMED\r\n`;
        ical += `END:VEVENT\r\n`;
      }

      // Add Blocked Dates
      for (const block of (blockedDates || [])) {
        ical += `BEGIN:VEVENT\r\n`;
        ical += `UID:block-${block.id}@brandspire\r\n`;
        ical += `DTSTAMP:${nowStr}\r\n`;
        ical += `DTSTART;VALUE=DATE:${formatICalDateOnly(new Date(block.start_date))}\r\n`;
        ical += `DTEND;VALUE=DATE:${formatICalDateOnly(new Date(block.end_date))}\r\n`;
        ical += `SUMMARY:${block.reason || "Blocked"}\r\n`;
        ical += `STATUS:CONFIRMED\r\n`;
        ical += `END:VEVENT\r\n`;
      }

      ical += `END:VCALENDAR\r\n`;

      return new Response(ical, {
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          "Content-Disposition": `attachment; filename="room-${roomUnit.id}.ics"`,
          ...corsHeaders
        },
      });
    }

    // ==========================================
    // ACTION: SYNC (Import external calendars)
    // ==========================================
    if (action === "sync") {
      const propertyId = url.searchParams.get("property_id");
      if (!propertyId) return new Response("Missing property_id", { status: 400 });

      // Get all ical imports for this property
      const { data: imports, error: importsError } = await supabase
        .from("ical_imports")
        .select("*")
        .eq("property_id", propertyId);

      if (importsError || !imports) {
        return new Response(JSON.stringify({ error: "Failed to fetch imports" }), { headers: corsHeaders, status: 500 });
      }

      let syncCount = 0;

      for (const importRecord of imports) {
        try {
          // Fetch external iCal file
          const response = await fetch(importRecord.url);
          if (!response.ok) continue;
          const icalText = await response.text();
          
          // Parse events
          const events = parseICal(icalText);
          
          // Clear existing imported blocks for this specific calendar
          await supabase
            .from("blocked_dates")
            .delete()
            .eq("source", "ical")
            .eq("external_id", importRecord.id);

          // Insert new blocks
          if (events.length > 0) {
            const blocksToInsert = events.map(ev => {
              // Convert YYYYMMDD to YYYY-MM-DD
              const start = `${ev.start.substring(0,4)}-${ev.start.substring(4,6)}-${ev.start.substring(6,8)}`;
              const end = `${ev.end.substring(0,4)}-${ev.end.substring(4,6)}-${ev.end.substring(6,8)}`;
              
              return {
                property_id: propertyId,
                room_unit_id: importRecord.room_unit_id,
                start_date: start,
                end_date: end,
                reason: `External: ${ev.summary || "Blocked"}`,
                source: "ical",
                external_id: importRecord.id
              };
            });

            await supabase.from("blocked_dates").insert(blocksToInsert);
          }

          // Update last synced
          await supabase
            .from("ical_imports")
            .update({ last_synced_at: new Date().toISOString() })
            .eq("id", importRecord.id);
            
          syncCount++;
        } catch (e) {
          console.error(`Failed to sync calendar ${importRecord.id}`, e);
        }
      }

      return new Response(JSON.stringify({ success: true, synced: syncCount }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response("Unknown action", { status: 400, headers: corsHeaders });
  } catch (err) {
    return new Response(String(err?.message ?? err), { status: 500, headers: corsHeaders });
  }
});
