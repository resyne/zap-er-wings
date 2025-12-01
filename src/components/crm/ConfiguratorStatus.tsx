import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Clock, DollarSign, ExternalLink } from 'lucide-react';

interface ConfiguratorStatusProps {
  lead: any;
}

export const ConfiguratorStatus = ({ lead }: ConfiguratorStatusProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Stato Configuratore Vesuviano</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!lead.configurator_session_id && !lead.external_configurator_link && (
          <div className="text-sm text-muted-foreground">
            Link configuratore non ancora generato
          </div>
        )}
        {lead.configurator_session_id && (
          <>
            {/* Link opened */}
            <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Link aperto:</span>
          {lead.configurator_opened ? (
            <Badge variant="default" className="bg-green-600">
              <CheckCircle className="w-3 h-3 mr-1" />
              Aperto {lead.configurator_opened_at && `il ${new Date(lead.configurator_opened_at).toLocaleDateString('it-IT')}`}
            </Badge>
          ) : (
            <Badge variant="outline">
              <XCircle className="w-3 h-3 mr-1" />
              Non ancora aperto
            </Badge>
          )}
        </div>

        {/* Selected model */}
        {lead.configurator_model && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Modello:</span>
            <Badge variant="secondary">{lead.configurator_model}</Badge>
          </div>
        )}

        {/* Quote */}
        {lead.configurator_has_quote && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Preventivo:</span>
            <Badge variant="default">
              <DollarSign className="w-3 h-3 mr-1" />
              €{lead.configurator_quote_price?.toLocaleString('it-IT')}
            </Badge>
          </div>
        )}

        {/* Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Stato:</span>
          {lead.configurator_status === 'interested' && (
            <Badge className="bg-orange-600">Interessato</Badge>
          )}
          {lead.configurator_status === 'paid' && (
            <Badge className="bg-green-600">Pagato</Badge>
          )}
          {lead.configurator_status === 'not_interested' && (
            <Badge variant="destructive">Non interessato</Badge>
          )}
          {!lead.configurator_status && (
            <Badge variant="outline">In corso</Badge>
          )}
        </div>

        {/* Timeline events */}
        {lead.configurator_history && lead.configurator_history.length > 0 && (
          <div className="pt-3 border-t">
            <p className="text-sm font-medium mb-2">Cronologia attività:</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {lead.configurator_history.map((event: any, idx: number) => (
                <div key={idx} className="flex items-start gap-2 text-xs">
                  <Clock className="w-3 h-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
                  <div className="flex-1">
                    <span className="font-medium">{event.event_type}</span>
                    <span className="text-muted-foreground ml-2">
                      {new Date(event.timestamp).toLocaleString('it-IT')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

          </>
        )}

        {/* Link to configurator */}
        {(lead.configurator_link || lead.external_configurator_link) && (
          <a
            href={lead.configurator_link || lead.external_configurator_link || ''}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ExternalLink className="w-4 h-4" />
            Apri configuratore
          </a>
        )}
      </CardContent>
    </Card>
  );
};
