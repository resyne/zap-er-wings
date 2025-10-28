import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const PRIMARY_COLOR = '#38AC4F';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    backgroundColor: '#ffffff',
  },
  // Header verde
  header: {
    backgroundColor: PRIMARY_COLOR,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    color: 'white',
  },
  headerLeft: {
    flex: 1,
  },
  website: {
    fontSize: 12,
    marginBottom: 5,
  },
  contacts: {
    fontSize: 9,
    lineHeight: 1.5,
    marginTop: 5,
  },
  tagline: {
    fontSize: 8,
    marginTop: 8,
    opacity: 0.9,
  },
  headerRight: {
    textAlign: 'right',
  },
  docNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  docDate: {
    fontSize: 10,
  },
  docUser: {
    fontSize: 9,
    marginTop: 5,
    opacity: 0.9,
  },
  clientBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
  },
  clientLabel: {
    fontSize: 8,
    opacity: 0.9,
    marginBottom: 3,
  },
  clientName: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  clientAddress: {
    fontSize: 9,
    marginTop: 2,
  },
  // Content
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingBottom: 3,
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY_COLOR,
  },
  oggetto: {
    fontSize: 12,
    lineHeight: 1.6,
    padding: 12,
    backgroundColor: '#f9f9f9',
  },
  // Table
  table: {
    marginTop: 10,
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: PRIMARY_COLOR,
    color: 'white',
    padding: 8,
    fontWeight: 'bold',
    fontSize: 9,
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    fontSize: 9,
  },
  col1: { width: '40%' },
  col2: { width: '10%', textAlign: 'right' },
  col3: { width: '15%', textAlign: 'right' },
  col4: { width: '15%', textAlign: 'right' },
  col5: { width: '20%', textAlign: 'right' },
  // Totals
  totals: {
    marginTop: 15,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    width: 250,
  },
  totalLabel: {
    width: 150,
    textAlign: 'right',
    fontWeight: 'bold',
  },
  totalValue: {
    width: 100,
    textAlign: 'right',
  },
  totalFinal: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    borderTopWidth: 2,
    borderTopColor: PRIMARY_COLOR,
    paddingTop: 8,
    marginTop: 5,
  },
  // Includes section
  includesSection: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 15,
    marginVertical: 15,
  },
  includesTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    marginBottom: 10,
    textAlign: 'center',
  },
  includesItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 6,
    marginBottom: 5,
    backgroundColor: 'white',
    borderRadius: 6,
  },
  includesIcon: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    marginRight: 6,
  },
  includesText: {
    flex: 1,
    fontSize: 9,
    lineHeight: 1.4,
  },
  // Excludes section
  excludesBox: {
    backgroundColor: '#fffdf0',
    borderLeftWidth: 3,
    borderLeftColor: '#f0e68c',
    padding: 12,
    marginVertical: 15,
    borderRadius: 4,
  },
  excludesTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 6,
  },
  excludesContent: {
    fontSize: 9,
    lineHeight: 1.5,
    color: '#555',
  },
  // Info box
  infoBox: {
    flexDirection: 'row',
    gap: 15,
    marginVertical: 15,
  },
  infoItem: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: PRIMARY_COLOR,
  },
  infoLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 10,
  },
  // Payment section
  paymentInfo: {
    lineHeight: 1.6,
    fontSize: 10,
  },
  bankBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderLeftWidth: 4,
    borderLeftColor: PRIMARY_COLOR,
  },
  bankTitle: {
    fontWeight: 'bold',
    marginBottom: 3,
  },
  bankCompany: {
    fontWeight: 'bold',
    fontSize: 12,
    marginBottom: 2,
  },
  bankIban: {
    fontWeight: 'bold',
  },
  // Summary box
  summaryBox: {
    backgroundColor: '#f8fff9',
    borderWidth: 2,
    borderColor: PRIMARY_COLOR,
    borderRadius: 8,
    padding: 15,
    marginVertical: 15,
  },
  summaryTitle: {
    fontSize: 11,
    color: PRIMARY_COLOR,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  summaryContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryDetails: {
    flex: 1,
    lineHeight: 1.6,
    fontSize: 10,
  },
  summaryTotal: {
    backgroundColor: PRIMARY_COLOR,
    color: 'white',
    padding: 15,
    borderRadius: 6,
    textAlign: 'center',
    minWidth: 120,
  },
  summaryTotalLabel: {
    fontSize: 8,
    opacity: 0.9,
    marginBottom: 3,
  },
  summaryTotalAmount: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  // Timeline
  timelineBox: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 15,
    marginVertical: 15,
    borderLeftWidth: 4,
    borderLeftColor: PRIMARY_COLOR,
  },
  timelineTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  timelineSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  timelineStep: {
    flex: 1,
    textAlign: 'center',
    padding: 10,
    backgroundColor: 'white',
    borderRadius: 6,
  },
  timelineIcon: {
    fontSize: 20,
    marginBottom: 5,
  },
  timelineLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  timelineDuration: {
    fontSize: 12,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
  },
  // Footer
  footer: {
    backgroundColor: PRIMARY_COLOR,
    color: 'white',
    padding: 15,
    textAlign: 'center',
    fontSize: 8,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  footerBold: {
    fontWeight: 'bold',
    fontSize: 10,
    marginBottom: 3,
  },
  footerSmall: {
    fontSize: 7,
    marginTop: 6,
  },
});

interface OfferItem {
  product_name: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
}

interface OfferPDFDocumentProps {
  offer: {
    number: string;
    created_at: string;
    title: string;
    description?: string;
    valid_until?: string;
    amount: number;
    template?: string;
    timeline_produzione?: string;
    timeline_consegna?: string;
    timeline_installazione?: string;
    incluso_fornitura?: string;
    escluso_fornitura?: string;
    payment_method?: string;
    payment_agreement?: string;
    metodi_pagamento?: string;
  };
  customer: {
    name: string;
    address?: string;
    email?: string;
    tax_id?: string;
  };
  items: OfferItem[];
  user?: {
    full_name?: string;
    email?: string;
  };
}

export const OfferPDFDocument = ({ offer, customer, items, user }: OfferPDFDocumentProps) => {
  // Calculate totals
  const totaleImponibile = items.reduce((sum, item) => {
    const itemTotal = item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100);
    return sum + itemTotal;
  }, 0) || offer.amount;

  const totaleIva = totaleImponibile * 0.22;
  const totaleLordo = totaleImponibile + totaleIva;

  // Brand info
  const brandName = 'ZAPPER S.r.l.';

  // Payment info
  const paymentMethodText = offer.payment_method === 'bonifico' ? 'Bonifico bancario' : 'Contrassegno';
  const paymentAgreementText = offer.payment_agreement === 'altro' 
    ? (offer.metodi_pagamento || '30% acconto - 70% alla consegna')
    : offer.payment_agreement || '50% acconto - 50% a consegna';

  // Parse incluso items
  const inclusoItems = offer.incluso_fornitura 
    ? offer.incluso_fornitura.split('\n').filter(Boolean) 
    : ['Fornitura e installazione completa'];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header Verde */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.website}>WWW.ABBATTITORIZAPPER.IT</Text>
            <Text style={styles.contacts}>
              📧 info@abbattitorizapper.it{'\n'}
              📞 081 19968436 | 📱 +39 324 8996189
            </Text>
            <Text style={styles.tagline}>
              Marchio di proprietà della ditta CLIMATEL DI ELEFANTE Pasquale{'\n'}
              Via G. Ferraris n° 24 - 84018 SCAFATI (SA) - Italia{'\n'}
              C.F. LFNPQL67L02I483U | P.Iva 03895390650
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.docNumber}>OFFERTA N. {offer.number}</Text>
            <Text style={styles.docDate}>Data: {new Date(offer.created_at).toLocaleDateString('it-IT')}</Text>
            <Text style={styles.docUser}>Creata da: {user?.full_name || user?.email || 'N/A'}</Text>
            <View style={styles.clientBox}>
              <Text style={styles.clientLabel}>Spett.le Cliente:</Text>
              <Text style={styles.clientName}>{customer.name}</Text>
              {customer.address && <Text style={styles.clientAddress}>{customer.address}</Text>}
            </View>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Oggetto */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Oggetto</Text>
            <Text style={styles.oggetto}>{offer.title}</Text>
          </View>

          {/* Dettaglio Prodotti */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dettaglio Prodotti/Servizi</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.col1}>Descrizione</Text>
                <Text style={styles.col2}>Q.tà</Text>
                <Text style={styles.col3}>Prezzo Unit.</Text>
                <Text style={styles.col4}>Sconto</Text>
                <Text style={styles.col5}>Totale</Text>
              </View>
              {items && items.length > 0 ? (
                items.map((item, index) => {
                  const itemTotal = item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100);
                  return (
                    <View key={index} style={styles.tableRow}>
                      <Text style={styles.col1}>{item.description || item.product_name}</Text>
                      <Text style={styles.col2}>{item.quantity}</Text>
                      <Text style={styles.col3}>€ {item.unit_price.toFixed(2)}</Text>
                      <Text style={styles.col4}>{item.discount_percent || 0}%</Text>
                      <Text style={styles.col5}>€ {itemTotal.toFixed(2)}</Text>
                    </View>
                  );
                })
              ) : (
                <View style={styles.tableRow}>
                  <Text style={styles.col1}>{offer.description || offer.title}</Text>
                  <Text style={styles.col2}>1</Text>
                  <Text style={styles.col3}>€ {offer.amount.toFixed(2)}</Text>
                  <Text style={styles.col4}>0%</Text>
                  <Text style={styles.col5}>€ {offer.amount.toFixed(2)}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Cosa Include */}
          <View style={styles.includesSection}>
            <Text style={styles.includesTitle}>Cosa Include la Fornitura</Text>
            {inclusoItems.map((item, index) => (
              <View key={index} style={styles.includesItem}>
                <Text style={styles.includesIcon}>✓</Text>
                <Text style={styles.includesText}>{item}</Text>
              </View>
            ))}
          </View>

          {/* Cosa Esclude */}
          {offer.escluso_fornitura && (
            <View style={styles.excludesBox}>
              <Text style={styles.excludesTitle}>Cosa Esclude la Fornitura</Text>
              <Text style={styles.excludesContent}>{offer.escluso_fornitura}</Text>
            </View>
          )}

          {/* Totali */}
          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Totale Imponibile:</Text>
              <Text style={styles.totalValue}>€ {totaleImponibile.toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>IVA:</Text>
              <Text style={styles.totalValue}>€ {totaleIva.toFixed(2)}</Text>
            </View>
            <View style={[styles.totalRow, styles.totalFinal]}>
              <Text style={styles.totalLabel}>Totale Offerta:</Text>
              <Text style={styles.totalValue}>€ {totaleLordo.toFixed(2)}</Text>
            </View>
          </View>

          {/* Validità e Tempi */}
          <View style={styles.infoBox}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Validità Offerta</Text>
              <Text style={styles.infoValue}>
                {offer.valid_until ? new Date(offer.valid_until).toLocaleDateString('it-IT') : '30 giorni'}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Tempi di Consegna</Text>
              <Text style={styles.infoValue}>Da concordare</Text>
            </View>
          </View>

          {/* Metodi di Pagamento */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Metodi di Pagamento</Text>
            <Text style={styles.paymentInfo}>{paymentAgreementText}</Text>
            <View style={styles.bankBox}>
              <Text style={styles.bankTitle}>Coordinate Bancarie:</Text>
              <Text style={styles.bankCompany}>CLIMATEL DI ELEFANTE PASQUALE</Text>
              <Text>Banca: INTESA SANPAOLO</Text>
              <Text style={styles.bankIban}>IBAN: IT82 S030 6976 4511 0000 0003 441</Text>
            </View>
          </View>

          {/* Riepilogo Offerta */}
          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>📋 Riepilogo Offerta</Text>
            <View style={styles.summaryContent}>
              <View style={styles.summaryDetails}>
                <Text>Offerta n. {offer.number}</Text>
                <Text>Cliente: {customer.name}</Text>
                <Text>Oggetto: {offer.title}</Text>
              </View>
              <View style={styles.summaryTotal}>
                <Text style={styles.summaryTotalLabel}>TOTALE OFFERTA</Text>
                <Text style={styles.summaryTotalAmount}>€ {totaleLordo.toFixed(2)}</Text>
                <Text style={styles.summaryTotalLabel}>IVA inclusa</Text>
              </View>
            </View>
          </View>

          {/* Timeline Operativa */}
          {(offer.timeline_produzione || offer.timeline_consegna || offer.timeline_installazione) && (
            <View style={styles.timelineBox}>
              <Text style={styles.timelineTitle}>⏱️ Timeline Operativa</Text>
              <View style={styles.timelineSteps}>
                <View style={styles.timelineStep}>
                  <Text style={styles.timelineIcon}>🏭</Text>
                  <Text style={styles.timelineLabel}>Produzione</Text>
                  <Text style={styles.timelineDuration}>{offer.timeline_produzione || 'Da definire'}</Text>
                </View>
                <View style={styles.timelineStep}>
                  <Text style={styles.timelineIcon}>🚚</Text>
                  <Text style={styles.timelineLabel}>Consegna</Text>
                  <Text style={styles.timelineDuration}>{offer.timeline_consegna || 'Da definire'}</Text>
                </View>
                <View style={styles.timelineStep}>
                  <Text style={styles.timelineIcon}>🔧</Text>
                  <Text style={styles.timelineLabel}>Installazione</Text>
                  <Text style={styles.timelineDuration}>{offer.timeline_installazione || 'Da definire'}</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Footer Verde */}
        <View style={styles.footer}>
          <Text style={styles.footerBold}>ZAPPER® - RENEWED AIR</Text>
          <Text>WWW.ABBATTITORIZAPPER.IT</Text>
          <Text>📧 info@abbattitorizapper.it | 📞 081 19968436 | 📱 +39 324 8996189</Text>
          <Text style={styles.footerSmall}>
            CLIMATEL DI ELEFANTE Pasquale - Via G. Ferraris n° 24, 84018 SCAFATI (SA) - Italia{'\n'}
            C.F. LFNPQL67L02I483U | P.Iva 03895390650 | Reg. imprese 330786
          </Text>
        </View>
      </Page>
    </Document>
  );
};
