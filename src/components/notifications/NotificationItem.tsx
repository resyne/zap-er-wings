import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { Check, CheckSquare, UserPlus, Calendar, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Notification } from "./NotificationBell";

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "assignment":
      return <UserPlus className="h-4 w-4" />;
    case "deadline":
      return <Calendar className="h-4 w-4" />;
    case "tag":
      return <Tag className="h-4 w-4" />;
    default:
      return <CheckSquare className="h-4 w-4" />;
  }
};

const getEntityRoute = (entityType: string | null, entityId: string | null) => {
  if (!entityType || !entityId) return null;
  
  switch (entityType) {
    case "task":
      return `/tasks?taskId=${entityId}`;
    case "lead":
      return `/crm/leads?lead=${entityId}`;
    case "work_order":
      return `/production/work-orders?orderId=${entityId}`;
    case "service_work_order":
      return `/support/service-orders?orderId=${entityId}`;
    case "shipping_order":
      return `/warehouse/shipping-commissions?orderId=${entityId}`;
    default:
      return null;
  }
};

export function NotificationItem({ notification, onMarkAsRead }: NotificationItemProps) {
  const navigate = useNavigate();

  const handleClick = async () => {
    if (!notification.is_read) {
      onMarkAsRead(notification.id);
    }
    
    // For lead_activity, we need to get the lead_id from the activity
    if (notification.entity_type === "lead_activity" && notification.entity_id) {
      try {
        const { data: activity } = await supabase
          .from("lead_activities")
          .select("lead_id")
          .eq("id", notification.entity_id)
          .single();
        
        if (activity?.lead_id) {
          navigate(`/crm/leads?lead=${activity.lead_id}`);
          return;
        }
      } catch (error) {
        console.error("Error fetching lead_id from activity:", error);
      }
    }
    
    const route = getEntityRoute(notification.entity_type, notification.entity_id);
    if (route) {
      navigate(route);
    }
  };

  return (
    <div
      className={cn(
        "p-4 hover:bg-muted/50 transition-colors cursor-pointer",
        !notification.is_read && "bg-primary/5"
      )}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "mt-0.5",
          !notification.is_read ? "text-primary" : "text-muted-foreground"
        )}>
          {getNotificationIcon(notification.type)}
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <p className={cn(
              "text-sm font-medium",
              !notification.is_read && "text-primary"
            )}>
              {notification.title}
            </p>
            {!notification.is_read && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 -mr-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkAsRead(notification.id);
                }}
              >
                <Check className="h-3 w-3" />
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {notification.message}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(notification.created_at), {
              addSuffix: true,
              locale: it,
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
