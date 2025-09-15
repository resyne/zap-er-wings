import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Palette, Image, FileImage } from "lucide-react";
import { useNavigate } from "react-router-dom";

const BrandSelectionPage = () => {
  const navigate = useNavigate();
  
  const brandNames = ["ZAPPER", "ZAPPER Pro", "Vesuviano", "VesuvioBuono"];

  const getBrandColor = (brandName: string) => {
    const colors = {
      "ZAPPER": "from-blue-500 to-blue-600",
      "ZAPPER Pro": "from-purple-500 to-purple-600", 
      "Vesuviano": "from-orange-500 to-orange-600",
      "VesuvioBuono": "from-green-500 to-green-600"
    };
    return colors[brandName as keyof typeof colors] || "from-gray-500 to-gray-600";
  };

  const handleBrandClick = (brandName: string) => {
    const brandId = brandName.toLowerCase().replace(/\s+/g, '-');
    navigate(`/marketing/brandkit/${brandId}`);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Brandkit</h1>
        <p className="text-gray-600 mt-2">Seleziona un brand per gestire i suoi asset</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {brandNames.map((brandName) => (
          <Card 
            key={brandName} 
            className="hover:shadow-lg transition-all duration-200 cursor-pointer border-2 hover:border-primary/20"
            onClick={() => handleBrandClick(brandName)}
          >
            <CardHeader className="pb-4">
              <div className={`w-full h-32 rounded-lg bg-gradient-to-br ${getBrandColor(brandName)} flex items-center justify-center mb-4`}>
                <div className="text-white text-2xl font-bold">
                  {brandName.charAt(0)}
                </div>
              </div>
              <CardTitle className="text-lg text-center">{brandName}</CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Palette className="h-4 w-4" />
                  <span>Colori</span>
                </div>
                <Badge variant="outline" className="text-xs">0</Badge>
              </div>
              
              <div className="flex items-center justify-between text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Image className="h-4 w-4" />
                  <span>Icone</span>
                </div>
                <Badge variant="outline" className="text-xs">0</Badge>
              </div>
              
              <div className="flex items-center justify-between text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <FileImage className="h-4 w-4" />
                  <span>Loghi</span>
                </div>
                <Badge variant="outline" className="text-xs">0</Badge>
              </div>
              
              <Button className="w-full mt-4" variant="outline">
                Gestisci Asset
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default BrandSelectionPage;