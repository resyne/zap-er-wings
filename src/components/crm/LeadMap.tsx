import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

interface Lead {
  id: string;
  company_name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  value?: number;
  source?: string;
  status: string;
  country?: string;
  custom_fields?: {
    luogo?: string;
    [key: string]: any;
  };
}

interface LeadMapProps {
  leads: Lead[];
}

const COUNTRY_ISO_MAP: Record<string, string> = {
  Italia: 'IT',
  Italy: 'IT',
  Francia: 'FR',
  France: 'FR',
  Germania: 'DE',
  Germany: 'DE',
  Svezia: 'SE',
  Sweden: 'SE',
  Spagna: 'ES',
  Spain: 'ES',
  Portogallo: 'PT',
  Portugal: 'PT',
  Austria: 'AT',
  Svizzera: 'CH',
  Switzerland: 'CH',
  Belgio: 'BE',
  Belgium: 'BE',
  Olanda: 'NL',
  Netherlands: 'NL',
  'Paesi Bassi': 'NL',
  'Regno Unito': 'GB',
  'United Kingdom': 'GB',
  UK: 'GB',
};

// Alcune traduzioni manuali per paesi scritti in italiano
const LOCATION_NAME_OVERRIDES: Record<string, string> = {
  svezia: 'Sweden',
  slovenia: 'Slovenia',
};

// Cerca il paese sia nel testo del luogo sia nel campo country
const getIsoCountryFromLead = (location: string, country?: string): string | undefined => {
  const normalizedLocation = location.toLowerCase();
  const normalizedCountry = country?.toLowerCase();

  // 1) Prima prova a riconoscere il paese dal testo del luogo / company_name
  const fromLocationKey = Object.keys(COUNTRY_ISO_MAP).find(key =>
    normalizedLocation.includes(key.toLowerCase())
  );
  if (fromLocationKey) return COUNTRY_ISO_MAP[fromLocationKey];

  // 2) Solo se non trovato, prova dal campo country
  if (normalizedCountry) {
    const directMatchKey = Object.keys(COUNTRY_ISO_MAP).find(
      key => key.toLowerCase() === normalizedCountry
    );
    if (directMatchKey) return COUNTRY_ISO_MAP[directMatchKey];
  }

  return undefined;
};
const STATUS_CONFIG = {
  'new': { color: '#3b82f6', label: 'Nuovo' },
  'qualified': { color: '#22c55e', label: 'Qualificato' },
  'negotiation': { color: '#f97316', label: 'Trattativa' },
  'won': { color: '#10b981', label: 'Vinto' },
  'lost': { color: '#ef4444', label: 'Perso' },
};

export const LeadMap: React.FC<LeadMapProps> = ({ leads }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const mapboxToken = 'pk.eyJ1IjoiemFwcGVyLWl0YWx5IiwiYSI6ImNtZXRyZHppNjAyMHMyanBmaDVjaXRqNGkifQ.a-m1oX08G8vNi9s6uzNr7Q';
  const geocodeCache = useRef<Map<string, [number, number]>>(new Map());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(
    new Set(Object.keys(STATUS_CONFIG))
  );

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

  const geocodeLocation = async (
    location: string,
    country?: string
  ): Promise<[number, number] | null> => {
    const normalizedLocation = location.trim();
    const lowerLocation = normalizedLocation.toLowerCase();
    const normalizedCountry = country?.trim();

    // Applica eventuale override del nome (es. "Svezia" -> "Sweden")
    const overriddenQuery = LOCATION_NAME_OVERRIDES[lowerLocation] || normalizedLocation;

    // Determina il paese in modo intelligente (campo country + testo luogo)
    const isoCountry = getIsoCountryFromLead(normalizedLocation, normalizedCountry);

    const cacheKey = `${overriddenQuery.toLowerCase()}__${isoCountry || normalizedCountry?.toLowerCase() || 'any'}`;
    if (geocodeCache.current.has(cacheKey)) return geocodeCache.current.get(cacheKey)!;
    
    try {
      const buildParams = (withCountry: boolean) => {
        const params = new URLSearchParams({
          types: 'place,locality,region',
          limit: '1',
          access_token: mapboxToken,
        });
        if (withCountry && isoCountry) {
          params.append('country', isoCountry);
        }
        return params;
      };

      // Primo tentativo: con country se disponibile
      let params = buildParams(true);
      let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(overriddenQuery)}.json?${params.toString()}`;
      let res = await fetch(url);
      let data = await res.json();

      // Se non trova nulla e abbiamo forzato un paese, riprova senza country (ricerca globale)
      if ((!data?.features || data.features.length === 0) && isoCountry) {
        console.warn(`[LeadMap] No results with country=${isoCountry} for "${overriddenQuery}", retrying globally`);
        params = buildParams(false);
        url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(overriddenQuery)}.json?${params.toString()}`;
        res = await fetch(url);
        data = await res.json();
      }
      
      if (data?.features && data.features.length > 0) {
        const feature = data.features[0];
        const center = feature.center as [number, number];
        
        console.log(`[LeadMap] Geocoded "${normalizedLocation}" (query="${overriddenQuery}", countryField="${normalizedCountry || 'N/A'}", isoCountry="${isoCountry || 'N/A'}") to ${feature.place_name} at [${center[0]}, ${center[1]}]`);
        
        geocodeCache.current.set(cacheKey, center);
        return center;
      } else {
        console.warn(`[LeadMap] No results found for location: "${normalizedLocation}" (query="${overriddenQuery}", countryField="${normalizedCountry || 'N/A'}", isoCountry="${isoCountry || 'N/A'}")`, data);
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

    const leadsWithLocation = leads.filter(
      lead => lead.custom_fields?.luogo && selectedStatuses.has(lead.status)
    );
    console.log(`[LeadMap] Processing ${leadsWithLocation.length} leads with location out of ${leads.length} total leads`);

    for (const lead of leadsWithLocation) {
      const location = lead.custom_fields?.luogo;
      if (!location) continue;

      console.log(`[LeadMap] FULL LEAD DATA:`, {
        company: lead.company_name,
        location: location,
        country: lead.country,
        country_type: typeof lead.country,
        country_value: JSON.stringify(lead.country),
        status: lead.status
      });
      
      const coords = await geocodeLocation(location, lead.country);
      if (!coords) {
        console.warn(`[LeadMap] Failed to geocode location: "${location}"`);
        continue;
      }

      const [lng, lat] = coords;
      console.log(`[LeadMap] Geocoded "${location}" to [${lng}, ${lat}]`);

      const markerColor = STATUS_CONFIG[lead.status as keyof typeof STATUS_CONFIG]?.color || '#6366f1';
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


      const icon = document.createElement('div');
      icon.innerHTML = '📍';
      icon.style.fontSize = '14px';
      markerElement.appendChild(icon);

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
              ${STATUS_CONFIG[lead.status as keyof typeof STATUS_CONFIG]?.label || lead.status.toUpperCase()}
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

  // Clear geocode cache when leads change to ensure fresh geocoding
  useEffect(() => {
    geocodeCache.current.clear();
    console.log('[LeadMap] Cleared geocode cache due to leads update');
  }, [leads]);

  useEffect(() => {
    if (map.current && map.current.loaded()) {
      void addLeadMarkers();
    }
  }, [leads, selectedStatuses]);

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(status)) {
        newSet.delete(status);
      } else {
        newSet.add(status);
      }
      return newSet;
    });
  };

  const leadsWithLocation = leads.filter(lead => lead.custom_fields?.luogo);
  const filteredLeadsWithLocation = leadsWithLocation.filter(lead => selectedStatuses.has(lead.status));

  return (
    <div className="relative w-full h-[600px]">
      <div ref={mapContainer} className="absolute inset-0 rounded-lg overflow-hidden" />
      
      {/* Legend and filters */}
      <Card className="absolute top-4 right-4 p-4 shadow-lg bg-background/95 backdrop-blur-sm z-10">
        <div className="space-y-3">
          <h3 className="font-semibold text-sm mb-2">Legenda e Filtri</h3>
          {Object.entries(STATUS_CONFIG).map(([status, config]) => {
            const count = leadsWithLocation.filter(l => l.status === status).length;
            return (
              <div key={status} className="flex items-center space-x-2">
                <Checkbox
                  id={`status-${status}`}
                  checked={selectedStatuses.has(status)}
                  onCheckedChange={() => toggleStatus(status)}
                />
                <Label
                  htmlFor={`status-${status}`}
                  className="flex items-center gap-2 cursor-pointer text-sm"
                >
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: config.color }}
                  />
                  <span>{config.label}</span>
                  <span className="text-muted-foreground">({count})</span>
                </Label>
              </div>
            );
          })}
        </div>
      </Card>

      {leadsWithLocation.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
          <div className="text-center space-y-2">
            <MapPin className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">Nessun lead con luogo specificato</p>
          </div>
        </div>
      )}
      
      {leadsWithLocation.length > 0 && filteredLeadsWithLocation.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-2 bg-background/80 backdrop-blur-sm p-6 rounded-lg">
            <MapPin className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">Nessun lead con i filtri selezionati</p>
          </div>
        </div>
      )}
    </div>
  );
};
