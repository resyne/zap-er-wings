import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Clock, DollarSign, ExternalLink, Link } from 'lucide-react';

interface ConfiguratorStatusProps {
  lead: any;
}

export const ConfiguratorStatus = ({ lead }: ConfiguratorStatusProps) => {
  const hasConfiguratorLink = lead.configurator_link || lead.external_configurator_link;
  const hasSessionStarted = lead.configurator_session_id;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Stato Configuratore Vesuviano</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasConfiguratorLink && (
          <div className="text-sm text-muted-foreground">
            Link configuratore non ancora generato
          </div>
        )}

        {hasConfiguratorLink && (
          <>
            {/* Link to configurator */}
            <a
              href={lead.configurator_link || lead.external_configurator_link || ''}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              Apri configuratore
            </a>

            {/* Session status */}
            {!hasSessionStarted && (
              <div className="text-sm text-muted-foreground italic">
                Il cliente non ha ancora aperto il configuratore
              </div>
            )}

            {hasSessionStarted && (
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
                    <span className="text-sm text-muted-foreground">Modello selezionato:</span>
                    <Badge variant="secondary">{lead.configurator_model}</Badge>
                  </div>
                )}

                {/* Quote */}
                {lead.configurator_has_quote && lead.configurator_quote_price && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Preventivo:</span>
                    <Badge variant="default" className="bg-blue-600">
                      <DollarSign className="w-3 h-3 mr-1" />
                      €{lead.configurator_quote_price?.toLocaleString('it-IT')}
                    </Badge>
                  </div>
                )}

                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Stato cliente:</span>
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
                    <Badge variant="outline">In valutazione</Badge>
                  )}
                </div>

                {/* Timeline events */}
                {lead.configurator_history && lead.configurator_history.length > 0 && (
                  <div className="pt-3 border-t">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <p className="text-sm font-medium">Cronologia attività:</p>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {lead.configurator_history
                        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                        .map((event: any, idx: number) => {
                          const eventLabels: Record<string, string> = {
                            'link_opened': 'Ha aperto il configuratore',
                            'model_selected': 'Ha selezionato un modello',
                            'quote_saved': 'Ha salvato un preventivo',
                            'contact_requested': 'Ha richiesto il contatto',
                            'payment_completed': 'Ha completato il pagamento',
                            'feedback_not_interested': 'Non è interessato'
                          };

                          return (
                            <div key={idx} className="flex items-start gap-2 text-xs bg-muted/50 p-2 rounded">
                              <Clock className="w-3 h-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
                              <div className="flex-1">
                                <div className="font-medium">
                                  {eventLabels[event.event_type] || event.event_type}
                                </div>
                                <div className="text-muted-foreground">
                                  {new Date(event.timestamp).toLocaleString('it-IT', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </div>
                                {event.data && event.data.model_name && (
                                  <div className="text-muted-foreground mt-1">
                                    Modello: {event.data.model_name}
                                  </div>
                                )}
                                {event.data && event.data.totalPrice && (
                                  <div className="text-muted-foreground mt-1">
                                    Prezzo: €{event.data.totalPrice.toLocaleString('it-IT')}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
