import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Check, CheckCheck } from "lucide-react";
import { NotificationItem } from "./NotificationItem";
import type { Notification } from "./NotificationBell";

interface NotificationListProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  unreadCount: number;
}

export function NotificationList({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  unreadCount,
}: NotificationListProps) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between p-4">
        <h3 className="font-semibold">Notifiche</h3>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkAllAsRead}
            className="h-8 text-xs"
          >
            <CheckCheck className="h-4 w-4 mr-1" />
            Segna tutte lette
          </Button>
        )}
      </div>
      <Separator />
      <ScrollArea className="h-[400px]">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Check className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nessuna notifica</p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={onMarkAsRead}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
