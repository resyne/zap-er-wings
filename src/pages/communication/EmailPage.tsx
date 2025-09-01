import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail } from "lucide-react";

const EmailPage = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Mail className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Email</h1>
          <p className="text-muted-foreground">
            Accesso alla webmail aziendale
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Webmail Aziendale</CardTitle>
          <CardDescription>
            Sistema di posta elettronica integrato
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <iframe
            src="https://webmail.abbattitorizapper.it/"
            className="w-full h-[800px] border-0 rounded-b-lg"
            title="Webmail Aziendale"
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailPage;