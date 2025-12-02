import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { 
  Users, 
  Building2, 
  FileText, 
  ShoppingCart, 
  Package, 
  UserCircle,
  TrendingUp,
  Briefcase,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  url: string;
}

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    const searchTimeout = setTimeout(() => {
      if (search.length >= 2) {
        performSearch(search);
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [search]);

  const performSearch = async (query: string) => {
    setLoading(true);
    console.log('[GlobalSearch] Starting search for:', query);
    try {
      const searchTerm = `%${query}%`;
      const allResults: SearchResult[] = [];

      // Search Customers
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('id, name, email, code')
        .or(`name.ilike.${searchTerm},email.ilike.${searchTerm},code.ilike.${searchTerm}`)
        .limit(5);

      if (customersError) {
        console.error('[GlobalSearch] Customers error:', customersError);
        toast({
          title: "Errore Ricerca Clienti",
          description: customersError.message,
          variant: "destructive",
        });
      } else if (customers) {
        console.log('[GlobalSearch] Found customers:', customers.length);
        allResults.push(...customers.map(c => ({
          id: c.id,
          type: 'customer',
          title: c.name,
          subtitle: c.email || c.code,
          url: '/crm/customers'
        })));
      }

      // Search Leads
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('id, company_name, contact_name, email, pipeline')
        .or(`company_name.ilike.${searchTerm},contact_name.ilike.${searchTerm},email.ilike.${searchTerm}`)
        .limit(5);

      if (leadsError) {
        console.error('[GlobalSearch] Leads error:', leadsError);
      } else if (leads) {
        console.log('[GlobalSearch] Found leads:', leads.length);
        allResults.push(...leads.map(l => ({
          id: l.id,
          type: 'lead',
          title: l.company_name || l.contact_name || 'Lead senza nome',
          subtitle: l.contact_name || l.email,
          url: `/crm/leads?lead=${l.id}`
        })));
      }

      // Search Offers
      const { data: offers } = await supabase
        .from('offers')
        .select('id, number, title, customer_name')
        .or(`number.ilike.${searchTerm},title.ilike.${searchTerm},customer_name.ilike.${searchTerm}`)
        .limit(5);

      if (offers) {
        allResults.push(...offers.map(o => ({
          id: o.id,
          type: 'offer',
          title: o.number,
          subtitle: o.title,
          url: `/crm/offers?offer=${o.id}`
        })));
      }

      // Search Sales Orders
      const { data: salesOrders } = await supabase
        .from('sales_orders')
        .select('id, number, article, notes, customers(name)')
        .or(`number.ilike.${searchTerm},article.ilike.${searchTerm},notes.ilike.${searchTerm}`)
        .limit(5);

      if (salesOrders) {
        allResults.push(...salesOrders.map((o: any) => ({
          id: o.id,
          type: 'order',
          title: o.number,
          subtitle: o.customers?.name || o.article || o.notes?.substring(0, 50),
          url: '/crm/orders'
        })));
      }

      // Search CRM Contacts
      const { data: contacts } = await supabase
        .from('crm_contacts')
        .select('id, first_name, last_name, email, company_name')
        .or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm},company_name.ilike.${searchTerm}`)
        .limit(5);

      if (contacts) {
        allResults.push(...contacts.map(c => ({
          id: c.id,
          type: 'contact',
          title: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
          subtitle: c.email || c.company_name,
          url: '/crm/contacts'
        })));
      }

      // Search Products/Materials
      const { data: materials } = await supabase
        .from('materials')
        .select('id, code, name, description')
        .or(`code.ilike.${searchTerm},name.ilike.${searchTerm},description.ilike.${searchTerm}`)
        .limit(5);

      if (materials) {
        allResults.push(...materials.map(m => ({
          id: m.id,
          type: 'product',
          title: m.code,
          subtitle: m.name,
          url: '/warehouse/materials'
        })));
      }

      // Search Opportunities
      const { data: opportunities } = await supabase
        .from('crm_deals')
        .select('id, name, description')
        .or(`name.ilike.${searchTerm},description.ilike.${searchTerm}`)
        .limit(5);

      if (opportunities) {
        allResults.push(...opportunities.map(o => ({
          id: o.id,
          type: 'opportunity',
          title: o.name,
          subtitle: o.description?.substring(0, 50),
          url: '/crm/opportunities'
        })));
      }

      console.log('[GlobalSearch] Total results found:', allResults.length);
      setResults(allResults);
    } catch (error: any) {
      console.error('[GlobalSearch] Search error:', error);
      toast({
        title: "Errore di Ricerca",
        description: error?.message || "Si è verificato un errore durante la ricerca",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (url: string) => {
    onOpenChange(false);
    navigate(url);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'customer': return <Users className="h-4 w-4" />;
      case 'lead': return <TrendingUp className="h-4 w-4" />;
      case 'offer': return <FileText className="h-4 w-4" />;
      case 'order': return <ShoppingCart className="h-4 w-4" />;
      case 'contact': return <UserCircle className="h-4 w-4" />;
      case 'product': return <Package className="h-4 w-4" />;
      case 'opportunity': return <Briefcase className="h-4 w-4" />;
      default: return <Building2 className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'customer': return 'Cliente';
      case 'lead': return 'Lead';
      case 'offer': return 'Offerta';
      case 'order': return 'Ordine';
      case 'contact': return 'Contatto';
      case 'product': return 'Prodotto';
      case 'opportunity': return 'Opportunità';
      default: return type;
    }
  };

  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = [];
    }
    acc[result.type].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput 
        placeholder="Cerca in tutto l'ERP..." 
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {results.length === 0 && search.length >= 2 && (
              <CommandEmpty>Nessun risultato trovato.</CommandEmpty>
            )}
            {results.length === 0 && search.length < 2 && search.length > 0 && (
              <CommandEmpty>Digita almeno 2 caratteri per cercare...</CommandEmpty>
            )}
            {Object.entries(groupedResults).map(([type, items]) => (
              <CommandGroup key={type} heading={getTypeLabel(type)}>
                {items.map((result) => (
                  <CommandItem
                    key={`${result.type}-${result.id}`}
                    onSelect={() => handleSelect(result.url)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    {getIcon(result.type)}
                    <div className="flex flex-col">
                      <span className="font-medium">{result.title}</span>
                      {result.subtitle && (
                        <span className="text-xs text-muted-foreground">
                          {result.subtitle}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
