import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogIn, ArrowRight } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50">
      <div className="text-center space-y-6">
        <h1 className="text-5xl font-bold mb-4">CRM Dashboard</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Gestisci le tue opportunità, attività e richieste in un'unica piattaforma integrata
        </p>
        <div className="flex gap-4 justify-center mt-8">
          <Link to="/auth">
            <Button size="lg" className="gap-2">
              <LogIn className="w-5 h-5" />
              Accedi alla Dashboard
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button variant="outline" size="lg" className="gap-2">
              <ArrowRight className="w-5 h-5" />
              Dashboard (se già loggato)
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Index;
