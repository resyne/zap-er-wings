import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

interface ConversationMessage {
  direction: 'inbound' | 'outbound';
  content: string;
  timestamp: string;
  message_type?: string;
}

interface SendNotificationEmailRequest {
  recipient_email: string;
  customer_phone: string;
  customer_name?: string;
  lead_name?: string;
  company_name?: string;
  message_content: string;
  message_type: string;
  account_name?: string;
  recent_messages?: ConversationMessage[];
}

async function translateMessage(content: string): Promise<{ translated: string; detected_language: string } | null> {
  if (!geminiApiKey) {
    console.log("No Gemini API key, skipping translation");
    return null;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Analyze this message and:
1. Detect the language
2. If NOT Italian, translate to Italian
3. If already Italian, return the same text

Respond ONLY in this exact JSON format, no markdown:
{"detected_language": "XX", "is_italian": true/false, "translation": "translated text or original if Italian"}

Message: "${content}"`
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
          }
        }),
      }
    );

    if (!response.ok) {
      console.error("Gemini API error:", await response.text());
      return null;
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      return null;
    }

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    if (parsed.is_italian) {
      return null; // No translation needed
    }

    return {
      translated: parsed.translation,
      detected_language: parsed.detected_language,
    };
  } catch (error) {
    console.error("Translation error:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const body: SendNotificationEmailRequest = await req.json();
    const { 
      recipient_email, 
      customer_phone, 
      customer_name, 
      lead_name,
      company_name,
      message_content, 
      message_type,
      account_name,
      recent_messages 
    } = body;

    // Determine the best display name
    const displayName = lead_name || customer_name || customer_phone;
    const displayCompany = company_name ? ` (${company_name})` : '';

    console.log(`Sending notification email to ${recipient_email} for message from ${displayName}`);

    // Try to translate the message
    const translation = await translateMessage(message_content);

    const resend = new Resend(resendApiKey);

    // Build email content
    const translationHtml = translation
      ? `
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <p style="margin: 0 0 5px 0; font-size: 12px; color: #92400e;">
            <strong>🌐 Traduzione (${translation.detected_language} → IT):</strong>
          </p>
          <p style="margin: 0; font-size: 16px; color: #78350f;">${translation.translated}</p>
        </div>
      `
      : "";

    // Build conversation history HTML
    let conversationHtml = "";
    if (recent_messages && recent_messages.length > 0) {
      const messagesHtml = recent_messages.map(msg => {
        const isInbound = msg.direction === 'inbound';
        const bgColor = isInbound ? '#dcfce7' : '#e0e7ff';
        const align = isInbound ? 'left' : 'right';
        const borderColor = isInbound ? '#25D366' : '#6366f1';
        const label = isInbound ? '👤 Cliente' : '👨‍💼 Tu';
        const time = new Date(msg.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        
        return `
          <div style="text-align: ${align}; margin-bottom: 10px;">
            <div style="display: inline-block; max-width: 80%; background-color: ${bgColor}; padding: 10px 15px; border-radius: 12px; border-left: 3px solid ${borderColor};">
              <p style="margin: 0 0 5px 0; font-size: 11px; color: #6b7280;">${label} · ${time}</p>
              <p style="margin: 0; font-size: 14px; color: #1f2937;">
                ${msg.message_type && msg.message_type !== 'text' ? `[${msg.message_type}] ` : ''}${msg.content || '[Media]'}
              </p>
            </div>
          </div>
        `;
      }).join('');
      
      conversationHtml = `
        <div style="margin-bottom: 20px;">
          <p style="margin: 0 0 15px 0; font-size: 14px; font-weight: 600; color: #374151;">
            💬 Ultimi messaggi della conversazione:
          </p>
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; max-height: 300px; overflow-y: auto;">
            ${messagesHtml}
          </div>
        </div>
      `;
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background-color: #f4f4f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #25D366; margin: 0; font-size: 24px;">📱 Nuovo Messaggio WhatsApp</h1>
            ${account_name ? `<p style="color: #6b7280; margin: 10px 0 0 0; font-size: 14px;">Account: ${account_name}</p>` : ""}
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0 0 10px 0; font-size: 18px;">
              <strong>👤 ${displayName}${displayCompany}</strong>
            </p>
            <p style="margin: 0; font-size: 14px; color: #6b7280;">
              📞 <a href="https://wa.me/${customer_phone}" style="color: #25D366; text-decoration: none;">${customer_phone}</a>
            </p>
          </div>

          ${translationHtml}

          <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; border-left: 4px solid #25D366; margin-bottom: 20px;">
            <p style="margin: 0 0 5px 0; font-size: 12px; color: #065f46;">
              <strong>🆕 Nuovo messaggio ${translation ? "(originale)" : ""}:</strong>
            </p>
            <p style="margin: 0; font-size: 16px; color: #064e3b;">
              ${message_type !== "text" ? `[${message_type}] ` : ""}${message_content}
            </p>
          </div>

          ${conversationHtml}

          <div style="text-align: center; margin-top: 30px;">
            <a href="https://zap-er-wings.lovable.app/crm/whatsapp" 
               style="display: inline-block; background-color: #25D366; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Apri Chat WhatsApp
            </a>
          </div>

          <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 30px;">
            Questa email è stata inviata perché eri offline quando il messaggio è arrivato.
          </p>
        </div>
      </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "WhatsApp Notifications <notifications@mail.vesuvianoforni.com>",
      to: [recipient_email],
      subject: `📱 WhatsApp: ${displayName}${displayCompany}`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, email_id: emailResponse.id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending notification email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
