import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Partner {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string;
  email?: string;
  company_name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
}

interface EditPartnerFormProps {
  partner: Partner;
  onPartnerUpdated: (partner: Partner) => void;
  onCancel: () => void;
}

export const EditPartnerForm: React.FC<EditPartnerFormProps> = ({ 
  partner, 
  onPartnerUpdated, 
  onCancel 
}) => {
  const [formData, setFormData] = useState({
    first_name: partner.first_name,
    last_name: partner.last_name,
    phone: partner.phone || '',
    email: partner.email || '',
    company_name: partner.company_name,
    address: partner.address,
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const geocodeAddress = async (address: string): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      console.log('Trying to geocode address:', address);
      
      // Try Mapbox Geocoding first (more reliable)
      const mapboxToken = 'pk.eyJ1IjoiemFwcGVyLWl0YWx5IiwiYSI6ImNtZXRyZHppNjAyMHMyanBmaDVjaXRqNGkifQ.a-m1oX08G8vNi9s6uzNr7Q';
      const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxToken}&limit=1`;
      
      const mapboxResponse = await fetch(mapboxUrl);
      console.log('Mapbox geocoding response status:', mapboxResponse.status);
      
      if (mapboxResponse.ok) {
        const mapboxData = await mapboxResponse.json();
        console.log('Mapbox geocoding data:', mapboxData);
        
        if (mapboxData.features && mapboxData.features.length > 0) {
          const [lng, lat] = mapboxData.features[0].center;
          const coordinates = {
            latitude: lat,
            longitude: lng
          };
          console.log('Found Mapbox coordinates:', coordinates);
          return coordinates;
        }
      }
      
      // Fallback to Nominatim if Mapbox fails
      console.log('Trying Nominatim as fallback...');
      const nominatimResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
        {
          headers: {
            'User-Agent': 'PartnerMap/1.0'
          }
        }
      );
      
      console.log('Nominatim response status:', nominatimResponse.status);
      
      if (nominatimResponse.ok) {
        const nominatimData = await nominatimResponse.json();
        console.log('Nominatim data:', nominatimData);
        
        if (nominatimData && nominatimData.length > 0) {
          const coordinates = {
            latitude: parseFloat(nominatimData[0].lat),
            longitude: parseFloat(nominatimData[0].lon)
          };
          console.log('Found Nominatim coordinates:', coordinates);
          return coordinates;
        }
      }
      
      console.log('No geocoding results found for address:', address);
    } catch (error) {
      console.error('Geocoding error:', error);
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.first_name || !formData.last_name || !formData.company_name || !formData.address) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // If address changed, try to geocode the new address
      let coordinates = null;
      if (formData.address !== partner.address) {
        coordinates = await geocodeAddress(formData.address);
      }

      const partnerData = {
        ...formData,
        ...(coordinates && {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
        }),
      };

      const { data, error } = await supabase
        .from('partners')
        .update(partnerData)
        .eq('id', partner.id)
        .select()
        .single();

      if (error) throw error;

      onPartnerUpdated(data);
      
      toast({
        title: "Partner Updated",
        description: "Partner updated successfully!",
      });
    } catch (error) {
      console.error('Error updating partner:', error);
      toast({
        title: "Error",
        description: "Failed to update partner",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="first_name">First Name *</Label>
          <Input
            id="first_name"
            name="first_name"
            value={formData.first_name}
            onChange={handleInputChange}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name">Last Name *</Label>
          <Input
            id="last_name"
            name="last_name"
            value={formData.last_name}
            onChange={handleInputChange}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="company_name">Company Name *</Label>
        <Input
          id="company_name"
          name="company_name"
          value={formData.company_name}
          onChange={handleInputChange}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address *</Label>
        <Textarea
          id="address"
          name="address"
          value={formData.address}
          onChange={handleInputChange}
          rows={3}
          placeholder="Enter full address (street, city, country)"
          required
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Update Partner
        </Button>
      </div>
    </form>
  );
};