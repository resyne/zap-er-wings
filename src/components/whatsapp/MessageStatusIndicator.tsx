import { Check, CheckCheck, Clock, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

interface MessageStatusIndicatorProps {
  status: string;
  errorMessage?: string | null;
  messageId?: string;
  accountId?: string;
  conversationPhone?: string;
  messageType?: string;
  content?: string | null;
  mediaUrl?: string | null;
  templateName?: string | null;
  templateParams?: string[] | null;
  onRetrySuccess?: () => void;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  isOutbound?: boolean; // For styling on green bubble background
}

const statusConfig: Record<MessageStatus, { 
  icon: typeof Check; 
  label: string; 
  description: string;
  colorClass: string;
  bgClass: string;
  outboundColorClass: string; // For messages on green background
}> = {
  pending: {
    icon: Clock,
    label: 'In attesa',
    description: 'Messaggio in coda per l\'invio',
    colorClass: 'text-amber-500',
    bgClass: 'bg-amber-500/10',
    outboundColorClass: 'text-amber-200'
  },
  sent: {
    icon: Check,
    label: 'Inviato',
    description: 'Messaggio inviato al server WhatsApp',
    colorClass: 'text-gray-400',
    bgClass: 'bg-gray-400/10',
    outboundColorClass: 'text-white/70'
  },
  delivered: {
    icon: CheckCheck,
    label: 'Consegnato',
    description: 'Messaggio consegnato al dispositivo',
    colorClass: 'text-gray-400',
    bgClass: 'bg-gray-400/10',
    outboundColorClass: 'text-white/70'
  },
  read: {
    icon: CheckCheck,
    label: 'Letto',
    description: 'Messaggio visualizzato dal destinatario',
    colorClass: 'text-blue-500',
    bgClass: 'bg-blue-500/10',
    outboundColorClass: 'text-sky-200'
  },
  failed: {
    icon: AlertCircle,
    label: 'Non inviato',
    description: 'Errore nell\'invio del messaggio',
    colorClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
    outboundColorClass: 'text-red-200'
  }
};

export function MessageStatusIndicator({
  status,
  errorMessage,
  messageId,
  accountId,
  conversationPhone,
  messageType,
  content,
  mediaUrl,
  templateName,
  templateParams,
  onRetrySuccess,
  showLabel = false,
  size = 'sm',
  isOutbound = false
}: MessageStatusIndicatorProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  
  const normalizedStatus = (status?.toLowerCase() || 'pending') as MessageStatus;
  const config = statusConfig[normalizedStatus] || statusConfig.pending;
  const Icon = config.icon;
  
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  
  // Use appropriate color based on whether this is on green (outbound) background
  const activeColorClass = isOutbound ? config.outboundColorClass : config.colorClass;
  const failedBgClass = normalizedStatus === 'failed' 
    ? (isOutbound ? 'bg-red-900/40' : config.bgClass) 
    : '';
  
  const handleRetry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!accountId || !conversationPhone) {
      toast.error('Dati insufficienti per riprovare');
      return;
    }
    
    setIsRetrying(true);
    
    try {
      const payload: Record<string, any> = {
        account_id: accountId,
        to: conversationPhone,
      };
      
      // Determine message type and add appropriate fields
      if (templateName) {
        payload.type = 'template';
        payload.template_name = templateName;
        if (templateParams?.length) {
          payload.template_params = templateParams;
        }
      } else if (mediaUrl) {
        payload.type = messageType || 'document';
        payload.media_url = mediaUrl;
        if (content) payload.media_caption = content;
      } else if (content) {
        payload.type = 'text';
        payload.content = content;
      } else {
        toast.error('Impossibile determinare il tipo di messaggio');
        return;
      }
      
      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: payload
      });
      
      if (error || !data?.success) {
        throw new Error(data?.error || 'Errore durante il reinvio');
      }
      
      // If we have the messageId, we could update the old message status
      // but since a new message is created, we just notify success
      toast.success('Messaggio reinviato con successo');
      onRetrySuccess?.();
      
    } catch (err: any) {
      toast.error(err.message || 'Errore durante il reinvio');
    } finally {
      setIsRetrying(false);
    }
  };
  
  const canRetry = normalizedStatus === 'failed' && accountId && conversationPhone;
  
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              "flex items-center gap-1.5 cursor-default",
              showLabel && normalizedStatus === 'failed' && "px-2 py-1 rounded-md",
              showLabel && normalizedStatus === 'failed' && failedBgClass
            )}>
              <Icon className={cn(iconSize, activeColorClass)} />
              {showLabel && (
                <span className={cn(textSize, activeColorClass, "font-semibold")}>
                  {config.label}
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium">{config.label}</p>
              <p className="text-xs text-muted-foreground">{config.description}</p>
              {normalizedStatus === 'failed' && errorMessage && (
                <p className="text-xs text-destructive mt-1">
                  Errore: {errorMessage}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
        
        {canRetry && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "rounded-full hover:bg-white/20",
                  size === 'sm' ? 'h-6 w-6' : 'h-7 w-7'
                )}
                onClick={handleRetry}
                disabled={isRetrying}
              >
                {isRetrying ? (
                  <Loader2 className={cn(iconSize, "animate-spin", isOutbound ? "text-white/70" : "")} />
                ) : (
                  <RefreshCw className={cn(iconSize, isOutbound ? "text-white/80 hover:text-white" : "text-muted-foreground hover:text-foreground")} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Riprova invio</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

// Simplified version for inline use without retry functionality
export function getStatusIcon(status: string, size: 'sm' | 'md' = 'sm') {
  const normalizedStatus = (status?.toLowerCase() || 'pending') as MessageStatus;
  const config = statusConfig[normalizedStatus] || statusConfig.pending;
  const Icon = config.icon;
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Icon className={cn(iconSize, config.colorClass)} />
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{config.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
