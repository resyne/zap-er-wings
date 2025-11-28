import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin } from "lucide-react";

interface Lead {
  id: string;
  company_name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  value?: number;
  source?: string;
  status: string;
  custom_fields?: {
    luogo?: string;
    [key: string]: any;
  };
}

interface LeadMapProps {
  leads: Lead[];
}

const STATUS_COLORS: Record<string, string> = {
  'new': '#3b82f6', // blue
  'qualified': '#22c55e', // green
  'negotiation': '#f97316', // orange
  'won': '#10b981', // emerald
  'lost': '#ef4444', // red
};

export const LeadMap: React.FC<LeadMapProps> = ({ leads }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const mapboxToken = 'pk.eyJ1IjoiemFwcGVyLWl0YWx5IiwiYSI6ImNtZXRyZHppNjAyMHMyanBmaDVjaXRqNGkifQ.a-m1oX08G8vNi9s6uzNr7Q';
  const geocodeCache = useRef<Map<string, [number, number]>>(new Map());

  const initializeMap = () => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = mapboxToken;
    
    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [12.5, 42], // Center on Italy
        zoom: 5,
      });

      map.current.addControl(
        new mapboxgl.NavigationControl(),
        'top-right'
      );

      map.current.on('load', () => {
        addLeadMarkers();
      });
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  };

  const geocodeLocation = async (location: string): Promise<[number, number] | null> => {
    const key = location.trim().toLowerCase();
    if (geocodeCache.current.has(key)) return geocodeCache.current.get(key)!;
    
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?limit=1&access_token=${mapboxToken}`;
      const res = await fetch(url);
      const data = await res.json();
      const center = data?.features?.[0]?.center as [number, number] | undefined;
      if (center) {
        geocodeCache.current.set(key, center);
        return center;
      }
    } catch (e) {
      console.warn('Failed to geocode location:', location, e);
    }
    return null;
  };

  const addLeadMarkers = async () => {
    if (!map.current) return;

    // Clear existing markers properly
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    const leadsWithLocation = leads.filter(lead => lead.custom_fields?.luogo);
    console.log(`[LeadMap] Processing ${leadsWithLocation.length} leads with location out of ${leads.length} total leads`);

    for (const lead of leadsWithLocation) {
      const location = lead.custom_fields?.luogo;
      if (!location) continue;

      console.log(`[LeadMap] Geocoding location: "${location}" for lead: ${lead.company_name} (status: ${lead.status})`);
      
      const coords = await geocodeLocation(location);
      if (!coords) {
        console.warn(`[LeadMap] Failed to geocode location: "${location}"`);
        continue;
      }

      const [lng, lat] = coords;
      console.log(`[LeadMap] Geocoded "${location}" to [${lng}, ${lat}]`);

      const markerColor = STATUS_COLORS[lead.status] || '#6366f1';
      console.log(`[LeadMap] Using color ${markerColor} for status "${lead.status}"`);

      const markerElement = document.createElement('div');
      markerElement.className = 'custom-marker';

      markerElement.style.cssText = `
        width: 32px;
        height: 32px;
        background: ${markerColor};
        border: 3px solid white;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        transition: transform 0.2s;
      `;

      markerElement.addEventListener('mouseenter', () => {
        markerElement.style.transform = 'scale(1.15)';
      });

      markerElement.addEventListener('mouseleave', () => {
        markerElement.style.transform = 'scale(1)';
      });

      const icon = document.createElement('div');
      icon.innerHTML = '📍';
      icon.style.fontSize = '14px';
      markerElement.appendChild(icon);

      const statusLabels: Record<string, string> = {
        'new': 'Nuovo',
        'qualified': 'Qualificato',
        'negotiation': 'Trattativa',
        'won': 'Vinto',
        'lost': 'Perso'
      };

      const popup = new mapboxgl.Popup({ offset: 25 })
        .setHTML(`
          <div style="padding: 10px; min-width: 200px;">
            <h3 style="margin: 0 0 6px 0; font-weight: bold; font-size: 15px;">
              ${lead.company_name}
            </h3>
            ${lead.contact_name ? `
              <p style="margin: 0 0 4px 0; font-size: 13px; color: #666;">
                ${lead.contact_name}
              </p>
            ` : ''}
            <p style="margin: 0 0 4px 0; font-size: 12px; color: #888;">
              📍 ${location}
            </p>
            ${lead.email ? `
              <p style="margin: 0 0 2px 0; font-size: 12px; color: #888;">
                ✉️ ${lead.email}
              </p>
            ` : ''}
            ${lead.phone ? `
              <p style="margin: 0; font-size: 12px; color: #888;">
                📞 ${lead.phone}
              </p>
            ` : ''}
            <div style="margin-top: 8px; padding: 4px 8px; background: ${markerColor}; color: white; border-radius: 4px; font-size: 11px; text-align: center; font-weight: 500;">
              ${statusLabels[lead.status] || lead.status.toUpperCase()}
            </div>
          </div>
        `);

      const marker = new mapboxgl.Marker(markerElement)
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map.current!);
      
      markers.current.push(marker);
    }

    console.log(`[LeadMap] Added ${leadsWithLocation.length} markers to map`);
  };

  useEffect(() => {
    initializeMap();
    return () => {
      markers.current.forEach(marker => marker.remove());
      markers.current = [];
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (map.current && map.current.loaded()) {
      void addLeadMarkers();
    }
  }, [leads]);

  const leadsWithLocation = leads.filter(lead => lead.custom_fields?.luogo);

  return (
    <div className="relative w-full h-[600px]">
      <div ref={mapContainer} className="absolute inset-0 rounded-lg overflow-hidden" />
      {leadsWithLocation.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
          <div className="text-center space-y-2">
            <MapPin className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">Nessun lead con luogo specificato</p>
          </div>
        </div>
      )}
    </div>
  );
};
