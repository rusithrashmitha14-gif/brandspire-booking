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

    const { guest_email, guest_name, check_in, check_out, booking_status, property_id } = record;

    // Fetch the Property details
    const { data: property } = await supabase
      .from('properties')
      .select('name, email, phone, address')
      .eq('id', property_id)
      .single();

    const hotelName = property?.name || "Our Hotel";
    const hotelEmail = property?.email || "contact@ourhotel.com";
    const hotelPhone = property?.phone || "";

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
