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

  const addPartnerMarkers = () => {
    if (!map.current) return;

    partners.forEach(partner => {
      if (partner.latitude && partner.longitude) {
        // Create a custom marker element with color based on status
        const markerElement = document.createElement('div');
        markerElement.className = 'custom-marker';
        
        // Use green for active importers, default primary color for others
        const markerColor = partner.acquisition_status === 'active' 
          ? 'hsl(142, 76%, 36%)' // Green color for active
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

        // Create popup
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

        // Add marker to map
        new mapboxgl.Marker(markerElement)
          .setLngLat([partner.longitude, partner.latitude])
          .setPopup(popup)
          .addTo(map.current!);
      }
    });
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
      addPartnerMarkers();
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