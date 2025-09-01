import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailActionRequest {
  action: 'delete' | 'mark_read' | 'mark_unread' | 'star' | 'unstar';
  email_id: string;
  imap_config: {
    server: string;
    port: number;
    email: string;
    password: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Email action function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const { action, email_id, imap_config }: EmailActionRequest = await req.json();

    console.log("Performing action:", action, "on email:", email_id);

    // Simulate IMAP connection and action
    const result = await performEmailAction(action, email_id, imap_config);

    console.log("Action completed successfully:", result);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: getActionMessage(action),
        action_performed: action,
        email_id: email_id
      }), 
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in email-action function:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "Errore durante l'azione sull'email", 
        details: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

async function performEmailAction(action: string, emailId: string, config: any) {
  console.log("Connecting to IMAP server for action:", action);
  
  // Simulate IMAP connection
  await new Promise(resolve => setTimeout(resolve, 800));
  
  switch (action) {
    case 'delete':
      console.log("Moving email to Trash folder");
      break;
    case 'mark_read':
      console.log("Marking email as read");
      break;
    case 'mark_unread':
      console.log("Marking email as unread");
      break;
    case 'star':
      console.log("Adding star to email");
      break;
    case 'unstar':
      console.log("Removing star from email");
      break;
    default:
      throw new Error("Azione non supportata");
  }
  
  return { success: true, action, emailId };
}

function getActionMessage(action: string): string {
  const messages = {
    'delete': 'Email spostata nel cestino',
    'mark_read': 'Email contrassegnata come letta',
    'mark_unread': 'Email contrassegnata come non letta',
    'star': 'Email aggiunta ai preferiti',
    'unstar': 'Email rimossa dai preferiti'
  };
  
  return messages[action as keyof typeof messages] || 'Azione completata';
}

serve(handler);