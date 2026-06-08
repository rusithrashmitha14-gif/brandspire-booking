import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Resend } from "npm:resend";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Initialize Supabase Client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const type = payload.type; // 'INSERT' or 'UPDATE'
    const record = payload.record;
    const oldRecord = payload.old_record;

    if (!record || !record.guest_email) {
      return new Response(JSON.stringify({ error: "No email or record provided" }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { guest_email, guest_name, check_in, check_out, booking_status, property_id, booking_group_id } = record;

    // Check if this is the primary booking for the group
    if (booking_group_id) {
      const { data: firstBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('booking_group_id', booking_group_id)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();
      
      if (firstBooking?.id !== record.id) {
        return new Response(JSON.stringify({ message: "Not the primary booking in group, skipping email." }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // Fetch the Property details
    const { data: property } = await supabase
      .from('properties')
      .select('name, email, phone, address, currency')
      .eq('id', property_id)
      .single();

    const hotelName = property?.name || "Our Hotel";
    const hotelEmail = property?.email || "contact@ourhotel.com";
    const hotelPhone = property?.phone || "";
    const hotelCurrency = property?.currency || "USD";

    // Fetch all bookings in this group to calculate total and list rooms
    let groupBookings = [record];
    if (booking_group_id) {
      const { data: allBookings } = await supabase
        .from('bookings')
        .select('*, room_units(room_number, room_types(title, price))')
        .eq('booking_group_id', booking_group_id);
      if (allBookings && allBookings.length > 0) {
        groupBookings = allBookings;
      }
    } else {
      // For old bookings without a group ID, fetch the related room info for the single record
      const { data: singleBooking } = await supabase
        .from('bookings')
        .select('*, room_units(room_number, room_types(title, price))')
        .eq('id', record.id)
        .single();
      if (singleBooking) groupBookings = [singleBooking];
    }

    const nights = Math.max(1, Math.ceil((new Date(check_out).getTime() - new Date(check_in).getTime()) / (1000 * 3600 * 24)));
    let rawTotalAmount = 0;
    let roomsListHtml = "";

    groupBookings.forEach((b: any) => {
      const roomTitle = b.room_units?.room_types?.title || 'Room';
      const roomPrice = b.room_units?.room_types?.price || 0;
      rawTotalAmount += roomPrice * nights;
      roomsListHtml += `<p style="margin: 4px 0; color: #4b5563;">• ${roomTitle}</p>`;
    });

    const totalAmountStr = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(rawTotalAmount) + ' ' + hotelCurrency;

    // Generate WhatsApp link if phone exists (strips non-numeric characters)
    let whatsappButton = "";
    if (hotelPhone) {
      const waNumber = hotelPhone.replace(/[^0-9]/g, '');
      whatsappButton = `
        <div style="text-align: center; margin-top: 32px;">
          <a href="https://wa.me/${waNumber}" style="background-color: #25D366; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Message us on WhatsApp
          </a>
        </div>
      `;
    }

    let emailSubject = "";
    let emailTitle = "";
    let emailMessage = "";
    let shouldSend = false;

    if (type === "INSERT") {
      shouldSend = true;
      emailSubject = `Your Booking Request at ${hotelName}`;
      emailTitle = "Booking Received!";
      emailMessage = `Thank you for choosing to stay at <strong>${hotelName}</strong>! We have successfully received your reservation request. It is currently pending confirmation from our team.`;
    } else if (type === "UPDATE" && oldRecord) {
      if (oldRecord.booking_status !== "Confirmed" && booking_status === "Confirmed") {
        shouldSend = true;
        emailSubject = `Your Booking at ${hotelName} is Confirmed!`;
        emailTitle = "Booking Confirmed!";
        emailMessage = `Great news! Your booking at <strong>${hotelName}</strong> has been officially confirmed by our team. We can't wait to host you.`;
      } else if (oldRecord.booking_status !== "Cancelled" && booking_status === "Cancelled") {
        shouldSend = true;
        emailSubject = `Your Booking at ${hotelName} has been Cancelled`;
        emailTitle = "Booking Cancelled";
        emailMessage = `Your booking at <strong>${hotelName}</strong> has been cancelled. If this was a mistake, please reach out to us immediately.`;
      }
    }

    if (!shouldSend) {
      return new Response(JSON.stringify({ message: "Status didn't change to a triggerable state, no email sent." }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Build the Email HTML
    const emailHTML = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #111827; margin-bottom: 24px; text-align: center;">${emailTitle}</h2>
        <p style="color: #374151; font-size: 16px; line-height: 24px;">Hi ${guest_name},</p>
        <p style="color: #374151; font-size: 16px; line-height: 24px;">
          ${emailMessage}
        </p>
        
        <div style="background-color: #f3f4f6; padding: 24px; border-radius: 8px; margin: 32px 0;">
          <h3 style="margin-top: 0; color: #111827;">Reservation Details</h3>
          <p style="margin: 8px 0; color: #4b5563;"><strong>Check-in:</strong> ${new Date(check_in).toLocaleDateString()}</p>
          <p style="margin: 8px 0; color: #4b5563;"><strong>Check-out:</strong> ${new Date(check_out).toLocaleDateString()}</p>
          <p style="margin: 8px 0; color: #4b5563;"><strong>Status:</strong> ${booking_status}</p>
          <div style="margin: 16px 0 8px 0; color: #4b5563;"><strong>Rooms Booked:</strong></div>
          ${roomsListHtml}
          <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #111827; font-size: 18px;"><strong>Total Amount: ${totalAmountStr}</strong></p>
            <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px;">(To be paid on arrival)</p>
          </div>
        </div>
        
        <p style="color: #374151; font-size: 16px; line-height: 24px;">
          If you have any questions, you can reply directly to this email or contact us below:
        </p>
        
        <div style="margin: 24px 0; color: #4b5563; font-size: 15px; line-height: 24px;">
          <strong>${hotelName}</strong><br>
          📧 <a href="mailto:${hotelEmail}" style="color: #2563eb;">${hotelEmail}</a><br>
          ${hotelPhone ? `📞 ${hotelPhone}<br>` : ''}
          ${property?.address ? `📍 ${property.address}<br>` : ''}
        </div>

        ${whatsappButton}
        
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          Sent on behalf of ${hotelName} via the Brandspire Booking System
        </p>
      </div>
    `;

    // Send the email via Resend
    const data = await resend.emails.send({
      from: `${hotelName} <onboarding@resend.dev>`,
      reply_to: hotelEmail,
      to: [guest_email],
      subject: emailSubject,
      html: emailHTML,
    });

    // Send WhatsApp notification via Twilio if it's a new booking
    if (type === "INSERT" && hotelPhone) {
      const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      const twilioNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER");

      if (twilioAccountSid && twilioAuthToken && twilioNumber) {
        // Format the owner's phone number to E.164 (+1234567890)
        let ownerNumber = hotelPhone.replace(/[^0-9+]/g, '');
        if (!ownerNumber.startsWith('+')) {
          // Default to US country code if no + is provided, or you can adjust this logic based on your region
          ownerNumber = '+' + ownerNumber;
        }

        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
        
        const messageBody = `🚨 *New Booking Alert!*\n\n${guest_name} has requested a reservation at ${hotelName}.\n\n📅 Dates: ${new Date(check_in).toLocaleDateString()} to ${new Date(check_out).toLocaleDateString()}\n🛏️ Rooms:\n${roomsListHtml.replace(/<[^>]*>?/gm, '').trim()}\n💰 Total: ${totalAmountStr}\n\nLog in to confirm: https://brandspire-booking.vercel.app/admin/bookings`;

        const twilioBody = new URLSearchParams({
          From: `whatsapp:${twilioNumber.replace('whatsapp:', '')}`, // Ensure format is whatsapp:+...
          To: `whatsapp:${ownerNumber}`,
          Body: messageBody
        });

        const twilioHeaders = {
          'Authorization': `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        };

        try {
          const twilioResponse = await fetch(twilioUrl, {
            method: 'POST',
            headers: twilioHeaders,
            body: twilioBody.toString()
          });
          
          if (!twilioResponse.ok) {
            const errBody = await twilioResponse.text();
            console.error("Twilio Error:", errBody);
          }
        } catch (twErr) {
          console.error("Failed to send WhatsApp message:", twErr);
        }
      } else {
        console.warn("Twilio credentials not found in environment variables. Skipping WhatsApp notification.");
      }
    }

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
});
