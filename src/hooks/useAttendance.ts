import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ClockEvent {
  id: string;
  employee_id: string;
  event_type: string;
  timestamp: string;
  gps_lat: number | null;
  gps_long: number | null;
  gps_accuracy: number | null;
  geofence_id: string | null;
  distance_from_workplace: number | null;
  device_id: string | null;
  ip_address: string | null;
  note: string | null;
  photo_url: string | null;
  status: string;
  created_at: string;
}

export interface Geofence {
  id: string;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  location_type: string;
  is_active: boolean;
}

export function useAttendance() {
  const { user } = useAuth();
  const [todayEvents, setTodayEvents] = useState<ClockEvent[]>([]);
  const [currentStatus, setCurrentStatus] = useState<string>("out"); // out, working, on_break
  const [loading, setLoading] = useState(true);
  const [todayWorkMinutes, setTodayWorkMinutes] = useState(0);

  const fetchTodayEvents = useCallback(async () => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("clock_events")
      .select("*")
      .eq("employee_id", user.id)
      .gte("timestamp", `${today}T00:00:00`)
      .lte("timestamp", `${today}T23:59:59`)
      .order("timestamp", { ascending: true });

    const events = (data || []) as unknown as ClockEvent[];
    setTodayEvents(events);

    // Determine current status
    if (events.length === 0) {
      setCurrentStatus("out");
    } else {
      const lastEvent = events[events.length - 1];
      if (lastEvent.event_type === "clock_in") setCurrentStatus("working");
      else if (lastEvent.event_type === "clock_out") setCurrentStatus("out");
      else if (lastEvent.event_type === "break_start") setCurrentStatus("on_break");
      else if (lastEvent.event_type === "break_end") setCurrentStatus("working");
    }

    // Calculate work minutes
    let workMinutes = 0;
    let lastClockIn: Date | null = null;
    let breakStart: Date | null = null;
    let breakMinutes = 0;

    for (const ev of events) {
      const t = new Date(ev.timestamp);
      if (ev.event_type === "clock_in") lastClockIn = t;
      else if (ev.event_type === "clock_out" && lastClockIn) {
        workMinutes += (t.getTime() - lastClockIn.getTime()) / 60000;
        lastClockIn = null;
      } else if (ev.event_type === "break_start") breakStart = t;
      else if (ev.event_type === "break_end" && breakStart) {
        breakMinutes += (t.getTime() - breakStart.getTime()) / 60000;
        breakStart = null;
      }
    }

    // If still clocked in, add current time
    if (lastClockIn) {
      workMinutes += (Date.now() - lastClockIn.getTime()) / 60000;
    }
    if (breakStart) {
      breakMinutes += (Date.now() - breakStart.getTime()) / 60000;
    }

    setTodayWorkMinutes(Math.max(0, Math.round(workMinutes - breakMinutes)));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchTodayEvents();
    const interval = setInterval(fetchTodayEvents, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [fetchTodayEvents]);

  const getGPSPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("GPS non disponibile"));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    });
  };

  const checkGeofence = async (lat: number, lng: number) => {
    const { data: geofences } = await supabase
      .from("geofences")
      .select("*")
      .eq("is_active", true);

    if (!geofences || geofences.length === 0) return { geofenceId: null, distance: null, isInZone: true };

    let closestGeofence: Geofence | null = null;
    let minDistance = Infinity;

    for (const gf of geofences as unknown as Geofence[]) {
      const dist = getDistanceMeters(lat, lng, gf.latitude, gf.longitude);
      if (dist < minDistance) {
        minDistance = dist;
        closestGeofence = gf;
      }
    }

    return {
      geofenceId: closestGeofence?.id || null,
      distance: Math.round(minDistance),
      isInZone: closestGeofence ? minDistance <= closestGeofence.radius_meters : false,
    };
  };

  const clockEvent = async (eventType: string, note?: string) => {
    if (!user) throw new Error("Non autenticato");

    let gpsLat: number | null = null;
    let gpsLong: number | null = null;
    let gpsAccuracy: number | null = null;
    let geofenceId: string | null = null;
    let distanceFromWorkplace: number | null = null;
    let status = "valid";

    try {
      const pos = await getGPSPosition();
      gpsLat = pos.coords.latitude;
      gpsLong = pos.coords.longitude;
      gpsAccuracy = pos.coords.accuracy;

      const geoCheck = await checkGeofence(gpsLat, gpsLong);
      geofenceId = geoCheck.geofenceId;
      distanceFromWorkplace = geoCheck.distance;
      if (!geoCheck.isInZone) status = "anomaly";
    } catch {
      // GPS not available - continue without
    }

    const { error } = await supabase.from("clock_events").insert({
      employee_id: user.id,
      event_type: eventType,
      gps_lat: gpsLat,
      gps_long: gpsLong,
      gps_accuracy: gpsAccuracy,
      geofence_id: geofenceId,
      distance_from_workplace: distanceFromWorkplace,
      device_id: navigator.userAgent?.substring(0, 100),
      note: note || null,
      status,
    } as any);

    if (error) throw error;

    // Also manage break_records
    if (eventType === "break_start") {
      await supabase.from("break_records").insert({
        employee_id: user.id,
        date: new Date().toISOString().split("T")[0],
        break_start: new Date().toISOString(),
        break_type: "lunch",
      } as any);
    } else if (eventType === "break_end") {
      const today = new Date().toISOString().split("T")[0];
      const { data: openBreaks } = await supabase
        .from("break_records")
        .select("*")
        .eq("employee_id", user.id)
        .eq("date", today)
        .is("break_end", null)
        .order("break_start", { ascending: false })
        .limit(1);

      if (openBreaks && openBreaks.length > 0) {
        const breakStart = new Date((openBreaks[0] as any).break_start);
        const duration = Math.round((Date.now() - breakStart.getTime()) / 60000);
        await supabase
          .from("break_records")
          .update({ break_end: new Date().toISOString(), duration_minutes: duration } as any)
          .eq("id", (openBreaks[0] as any).id);
      }
    }

    // Upsert attendance_days
    const today = new Date().toISOString().split("T")[0];
    await supabase.from("attendance_days").upsert(
      {
        employee_id: user.id,
        date: today,
        first_clock_in: eventType === "clock_in" ? new Date().toISOString() : undefined,
        last_clock_out: eventType === "clock_out" ? new Date().toISOString() : undefined,
        status: "present",
      } as any,
      { onConflict: "employee_id,date" }
    );

    await fetchTodayEvents();
    return { status, distanceFromWorkplace };
  };

  return {
    todayEvents,
    currentStatus,
    loading,
    todayWorkMinutes,
    clockEvent,
    refresh: fetchTodayEvents,
  };
}

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
