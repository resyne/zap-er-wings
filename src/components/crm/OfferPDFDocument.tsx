import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';

// Register fonts if needed
// Font.register({ family: 'Roboto', src: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Me5Q.ttf' });

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 20,
  },
  logo: {
    width: 120,
    height: 60,
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1a1a1a',
  },
  section: {
    marginBottom: 15,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    fontWeight: 'bold',
    width: 120,
  },
  value: {
    flex: 1,
  },
  table: {
    marginTop: 20,
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    padding: 8,
    fontWeight: 'bold',
    borderBottom: '1pt solid #cccccc',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottom: '1pt solid #eeeeee',
  },
  col1: { width: '40%' },
  col2: { width: '10%', textAlign: 'right' },
  col3: { width: '15%', textAlign: 'right' },
  col4: { width: '15%', textAlign: 'right' },
  col5: { width: '20%', textAlign: 'right' },
  totals: {
    marginTop: 20,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    marginBottom: 5,
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
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#666666',
  },
  includesSection: {
    marginTop: 15,
    marginBottom: 15,
  },
  includesTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    fontSize: 12,
  },
  includesItem: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  includesIcon: {
    width: 15,
    color: '#22c55e',
    fontWeight: 'bold',
  },
  includesText: {
    flex: 1,
  },
  timeline: {
    marginTop: 15,
    marginBottom: 15,
  },
  timelineTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    fontSize: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  timelineLabel: {
    width: 150,
    fontWeight: 'bold',
  },
  timelineValue: {
    flex: 1,
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

  // Brand info based on template
  const brandMap = {
    zapper: 'ZAPPER S.r.l.',
    vesuviano: 'VESUVIANO S.r.l.',
    zapperpro: 'ZAPPER PRO S.r.l.'
  };
  const brandName = brandMap[offer.template as keyof typeof brandMap] || 'ZAPPER S.r.l.';

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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>OFFERTA N. {offer.number}</Text>
          <Text>Data: {new Date(offer.created_at).toLocaleDateString('it-IT')}</Text>
          <Text>Validità: {offer.valid_until ? new Date(offer.valid_until).toLocaleDateString('it-IT') : '30 giorni'}</Text>
        </View>

        {/* Customer info */}
        <View style={styles.section}>
          <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>CLIENTE</Text>
          <Text>{customer.name}</Text>
          {customer.address && <Text>{customer.address}</Text>}
          {customer.tax_id && <Text>P.IVA: {customer.tax_id}</Text>}
        </View>

        {/* Offer subject */}
        <View style={styles.section}>
          <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>OGGETTO</Text>
          <Text>{offer.title}</Text>
        </View>

        {/* Products table */}
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
              <Text style={{ width: '100%' }}>{offer.description || offer.title}</Text>
            </View>
          )}
        </View>

        {/* Totals */}
        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Totale Imponibile:</Text>
            <Text style={styles.totalValue}>€ {totaleImponibile.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>IVA (22%):</Text>
            <Text style={styles.totalValue}>€ {totaleIva.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { fontSize: 12 }]}>Totale Lordo:</Text>
            <Text style={[styles.totalValue, { fontSize: 12, fontWeight: 'bold' }]}>€ {totaleLordo.toFixed(2)}</Text>
          </View>
        </View>

        {/* Timeline */}
        {(offer.timeline_produzione || offer.timeline_consegna || offer.timeline_installazione) && (
          <View style={styles.timeline}>
            <Text style={styles.timelineTitle}>TEMPISTICHE</Text>
            {offer.timeline_produzione && (
              <View style={styles.timelineItem}>
                <Text style={styles.timelineLabel}>Produzione:</Text>
                <Text style={styles.timelineValue}>{offer.timeline_produzione}</Text>
              </View>
            )}
            {offer.timeline_consegna && (
              <View style={styles.timelineItem}>
                <Text style={styles.timelineLabel}>Consegna:</Text>
                <Text style={styles.timelineValue}>{offer.timeline_consegna}</Text>
              </View>
            )}
            {offer.timeline_installazione && (
              <View style={styles.timelineItem}>
                <Text style={styles.timelineLabel}>Installazione:</Text>
                <Text style={styles.timelineValue}>{offer.timeline_installazione}</Text>
              </View>
            )}
          </View>
        )}

        {/* Incluso nella fornitura */}
        <View style={styles.includesSection}>
          <Text style={styles.includesTitle}>INCLUSO NELLA FORNITURA</Text>
          {inclusoItems.map((item, index) => (
            <View key={index} style={styles.includesItem}>
              <Text style={styles.includesIcon}>✓</Text>
              <Text style={styles.includesText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Escluso dalla fornitura */}
        {offer.escluso_fornitura && (
          <View style={styles.section}>
            <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>ESCLUSO DALLA FORNITURA</Text>
            <Text>{offer.escluso_fornitura}</Text>
          </View>
        )}

        {/* Payment terms */}
        <View style={styles.section}>
          <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>CONDIZIONI DI PAGAMENTO</Text>
          <Text>Metodo: {paymentMethodText}</Text>
          <Text>Modalità: {paymentAgreementText}</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>{brandName}</Text>
          <Text>Offerta preparata da: {user?.full_name || user?.email || 'N/A'}</Text>
        </View>
      </Page>
    </Document>
  );
};
