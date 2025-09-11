import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";

interface Partner {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string;
  address: string;
  country?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  acquisition_status?: string;
}

interface PartnerMapProps {
  partners: Partner[];
}

export const PartnerMap: React.FC<PartnerMapProps> = ({ partners }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const mapboxToken = 'pk.eyJ1IjoiemFwcGVyLWl0YWx5IiwiYSI6ImNtZXRyZHppNjAyMHMyanBmaDVjaXRqNGkifQ.a-m1oX08G8vNi9s6uzNr7Q';
  const countryCenterCache = useRef<Map<string, [number, number]>>(new Map());

  const initializeMap = () => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = mapboxToken;
    
    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [0, 20],
        zoom: 2,
      });

      map.current.addControl(
        new mapboxgl.NavigationControl(),
        'top-right'
      );

      map.current.on('load', () => {
        addPartnerMarkers();
      });
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  };

  // Resolve country center via Mapbox Geocoding and cache results
  const getCountryCenter = async (country: string): Promise<[number, number] | null> => {
    const key = country.trim().toLowerCase();
    if (countryCenterCache.current.has(key)) return countryCenterCache.current.get(key)!;
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(country)}.json?types=country&limit=1&access_token=${mapboxToken}`;
      const res = await fetch(url);
      const data = await res.json();
      const center = data?.features?.[0]?.center as [number, number] | undefined;
      if (center) {
        countryCenterCache.current.set(key, center);
        return center;
      }
    } catch (e) {
      console.warn('Failed to geocode country:', country, e);
    }
    return null;
  };

  // Deterministic small jitter based on partner id to avoid overlapping pins
  const jitterFromId = (id: string): [number, number] => {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) {
      h ^= id.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    const latJ = ((h & 0xffff) / 0xffff - 0.5) * 0.6; // ~ +/-0.3°
    const lngJ = (((h >>> 16) & 0xffff) / 0xffff - 0.5) * 0.6;
    return [lngJ, latJ];
  };

  const addPartnerMarkers = async () => {
    if (!map.current) return;

    for (const partner of partners) {
      let lat: number | null = null;
      let lng: number | null = null;

      const hasCoords = partner.latitude !== undefined && partner.longitude !== undefined && partner.latitude !== null && partner.longitude !== null;

      if (hasCoords) {
        let latNum = Number(partner.latitude);
        let lngNum = Number(partner.longitude);
        if (Number.isNaN(latNum) || Number.isNaN(lngNum)) continue;

        const isInGlobalRange = (latNum >= -90 && latNum <= 90) && (lngNum >= -180 && lngNum <= 180);
        if (!isInGlobalRange) {
          const swappedLat = Number(partner.longitude);
          const swappedLng = Number(partner.latitude);
          if ((swappedLat >= -90 && swappedLat <= 90) && (swappedLng >= -180 && swappedLng <= 180)) {
            console.warn('Swapped lat/lng due to out-of-range values for partner:', partner);
            latNum = swappedLat;
            lngNum = swappedLng;
          } else {
            console.warn('Skipping marker due to invalid coordinates:', partner);
            continue;
          }
        }

        // Italy-specific sanity check based on address content
        const addr = (partner.address || '').toLowerCase();
        const looksItalian = addr.includes('italia') || addr.includes('italy') || addr.includes(', it') || addr.endsWith(' it') || addr.includes(' it ');
        if (looksItalian) {
          const latInItaly = latNum >= 35 && latNum <= 48;
          const lngInItaly = lngNum >= 6 && lngNum <= 19;
          if (!(latInItaly && lngInItaly)) {
            const swappedLat2 = lngNum;
            const swappedLng2 = latNum;
            const swappedLatInItaly = swappedLat2 >= 35 && swappedLat2 <= 48;
            const swappedLngInItaly = swappedLng2 >= 6 && swappedLng2 <= 19;
            if (swappedLatInItaly && swappedLngInItaly) {
              console.warn('Swapped lat/lng for Italian address outside bounds:', partner);
              latNum = swappedLat2;
              lngNum = swappedLng2;
            } else {
              console.warn('Italian address has coordinates outside Italy bounds:', { partner, lat: latNum, lng: lngNum });
            }
          }
        }

        lat = latNum;
        lng = lngNum;
      } else {
        const country = (partner.country || '').trim();
        const region = (partner as any).region ? String((partner as any).region).trim() : '';
        if (country && !region) {
          const center = await getCountryCenter(country);
          if (!center) continue;
          const [cLng, cLat] = center;
          const [jLng, jLat] = jitterFromId(partner.id);
          lng = cLng + jLng;
          lat = cLat + jLat;
        } else {
          // No usable info to place marker
          continue;
        }
      }

      if (lat === null || lng === null) continue;

      const markerElement = document.createElement('div');
      markerElement.className = 'custom-marker';

      const markerColor = (partner.acquisition_status === 'attivo' || partner.acquisition_status === 'active') 
        ? 'hsl(142, 76%, 36%)'
        : 'hsl(var(--primary))';

      markerElement.style.cssText = `
        width: 30px;
        height: 30px;
        background: ${markerColor};
        border: 2px solid white;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      `;

      const icon = document.createElement('div');
      icon.innerHTML = '📍';
      icon.style.fontSize = '12px';
      markerElement.appendChild(icon);

      const popup = new mapboxgl.Popup({ offset: 25 })
        .setHTML(`
          <div style="padding: 8px;">
            <h3 style="margin: 0 0 4px 0; font-weight: bold;">
              ${partner.first_name} ${partner.last_name}
            </h3>
            <p style="margin: 0 0 4px 0; font-size: 14px; color: #666;">
              ${partner.company_name}
            </p>
            <p style="margin: 0; font-size: 12px; color: #888;">
              ${partner.address}
            </p>
          </div>
        `);

      new mapboxgl.Marker(markerElement)
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map.current!);
    }
  };

  useEffect(() => {
    initializeMap();
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (map.current && partners.length > 0) {
      // Clear existing markers
      const markers = document.querySelectorAll('.custom-marker');
      markers.forEach(marker => marker.remove());
      // Add new markers
      void addPartnerMarkers();
    }
  }, [partners]);


  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0 rounded-lg overflow-hidden" />
      {partners.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
          <div className="text-center space-y-2">
            <MapPin className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">No partners with location data</p>
          </div>
        </div>
      )}
    </div>
  );
};