import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogIn, ArrowRight } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
      <div className="text-center space-y-6 max-w-4xl w-full">
        <h1 className="text-3xl md:text-5xl font-bold mb-4">CRM Dashboard</h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
          Gestisci le tue opportunità, attività e richieste in un'unica piattaforma integrata
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8 px-4">
          <Link to="/auth" className="w-full sm:w-auto">
            <Button size="lg" className="gap-2 w-full sm:w-auto">
              <LogIn className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-sm md:text-base">Accedi alla Dashboard</span>
            </Button>
          </Link>
          <Link to="/dashboard" className="w-full sm:w-auto">
            <Button variant="outline" size="lg" className="gap-2 w-full sm:w-auto">
              <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-sm md:text-base">Dashboard (se già loggato)</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Index;
