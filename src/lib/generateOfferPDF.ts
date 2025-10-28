import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface OfferItem {
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number | null;
  total_price: number;
}

interface OfferData {
  number: string;
  created_at: string;
  customer_name: string;
  title: string;
  amount: number;
  valid_until?: string;
  timeline_consegna?: string;
  payment_agreement?: string;
  incluso_fornitura?: string;
  escluso_fornitura?: string;
  items: OfferItem[];
}

export async function generateOfferPDF(offerData: OfferData): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  let yPosition = height - 60;

  // Header verde
  page.drawRectangle({
    x: 0,
    y: height - 80,
    width,
    height: 80,
    color: rgb(0.22, 0.67, 0.31), // #38AC4F
  });

  // Logo/Titolo
  page.drawText('ZAPPER', {
    x: 40,
    y: height - 50,
    size: 24,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText('WWW.ABBATTITORIZAPPER.IT', {
    x: 40,
    y: height - 68,
    size: 9,
    font,
    color: rgb(1, 1, 1),
  });

  // Info offerta (destra header)
  page.drawText(`OFFERTA N. ${offerData.number}`, {
    x: width - 200,
    y: height - 45,
    size: 11,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText(`Data: ${new Date(offerData.created_at).toLocaleDateString('it-IT')}`, {
    x: width - 200,
    y: height - 60,
    size: 9,
    font,
    color: rgb(1, 1, 1),
  });

  page.drawText(`Cliente: ${offerData.customer_name}`, {
    x: width - 200,
    y: height - 73,
    size: 9,
    font,
    color: rgb(1, 1, 1),
  });

  yPosition = height - 110;

  // Oggetto
  page.drawText('OGGETTO', {
    x: 40,
    y: yPosition,
    size: 11,
    font: fontBold,
    color: rgb(0.22, 0.67, 0.31),
  });
  
  yPosition -= 20;
  page.drawRectangle({
    x: 40,
    y: yPosition - 15,
    width: width - 80,
    height: 30,
    color: rgb(0.98, 0.98, 0.98),
    borderColor: rgb(0.22, 0.67, 0.31),
    borderWidth: 2,
  });

  page.drawText(offerData.title.substring(0, 80), {
    x: 50,
    y: yPosition,
    size: 10,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });

  yPosition -= 50;

  // Tabella prodotti
  page.drawText('DETTAGLIO PRODOTTI/SERVIZI', {
    x: 40,
    y: yPosition,
    size: 11,
    font: fontBold,
    color: rgb(0.22, 0.67, 0.31),
  });

  yPosition -= 25;

  // Header tabella
  const tableStartY = yPosition;
  page.drawRectangle({
    x: 40,
    y: yPosition - 18,
    width: width - 80,
    height: 20,
    color: rgb(0.22, 0.67, 0.31),
  });

  page.drawText('Descrizione', { x: 45, y: yPosition - 12, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText('Q.tà', { x: 350, y: yPosition - 12, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText('Prezzo', { x: 400, y: yPosition - 12, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText('Sconto', { x: 460, y: yPosition - 12, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText('Totale', { x: 510, y: yPosition - 12, size: 9, font: fontBold, color: rgb(1, 1, 1) });

  yPosition -= 20;

  // Calcola totali
  const totaleImponibile = offerData.items.reduce((sum, item) => {
    const itemTotal = item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100);
    return sum + itemTotal;
  }, 0);
  
  const totaleIva = totaleImponibile * 0.22;
  const totaleLordo = totaleImponibile + totaleIva;

  // Righe prodotti (max 10 per non uscire dalla pagina)
  const maxItems = Math.min(offerData.items.length, 10);
  for (let i = 0; i < maxItems; i++) {
    const item = offerData.items[i];
    const itemTotal = item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100);
    
    yPosition -= 18;
    
    page.drawText(item.description.substring(0, 40), { x: 45, y: yPosition, size: 8, font });
    page.drawText(item.quantity.toString(), { x: 355, y: yPosition, size: 8, font });
    page.drawText(`€ ${item.unit_price.toFixed(2)}`, { x: 400, y: yPosition, size: 8, font });
    page.drawText(`${item.discount_percent || 0}%`, { x: 465, y: yPosition, size: 8, font });
    page.drawText(`€ ${itemTotal.toFixed(2)}`, { x: 510, y: yPosition, size: 8, font });
  }

  if (offerData.items.length > 10) {
    yPosition -= 18;
    page.drawText(`... e altri ${offerData.items.length - 10} prodotti`, { 
      x: 45, y: yPosition, size: 8, font, color: rgb(0.5, 0.5, 0.5) 
    });
  }

  yPosition -= 30;

  // Totali
  page.drawText(`Totale Imponibile:`, { x: width - 250, y: yPosition, size: 10, font: fontBold });
  page.drawText(`€ ${totaleImponibile.toFixed(2)}`, { x: width - 100, y: yPosition, size: 10, font });
  
  yPosition -= 18;
  page.drawText(`IVA 22%:`, { x: width - 250, y: yPosition, size: 10, font: fontBold });
  page.drawText(`€ ${totaleIva.toFixed(2)}`, { x: width - 100, y: yPosition, size: 10, font });
  
  yPosition -= 22;
  page.drawLine({
    start: { x: width - 250, y: yPosition + 15 },
    end: { x: width - 40, y: yPosition + 15 },
    thickness: 2,
    color: rgb(0.22, 0.67, 0.31),
  });
  
  page.drawText(`TOTALE OFFERTA:`, { x: width - 250, y: yPosition, size: 12, font: fontBold, color: rgb(0.22, 0.67, 0.31) });
  page.drawText(`€ ${totaleLordo.toFixed(2)}`, { x: width - 100, y: yPosition, size: 12, font: fontBold, color: rgb(0.22, 0.67, 0.31) });

  yPosition -= 40;

  // Info aggiuntive
  if (yPosition > 150) {
    page.drawText('CONDIZIONI', { x: 40, y: yPosition, size: 10, font: fontBold, color: rgb(0.22, 0.67, 0.31) });
    yPosition -= 18;
    
    page.drawText(`Validità: ${offerData.valid_until ? new Date(offerData.valid_until).toLocaleDateString('it-IT') : '30 giorni'}`, 
      { x: 45, y: yPosition, size: 9, font });
    yPosition -= 15;
    
    page.drawText(`Consegna: ${offerData.timeline_consegna || 'Da concordare'}`, 
      { x: 45, y: yPosition, size: 9, font });
    yPosition -= 15;
    
    page.drawText(`Pagamento: ${offerData.payment_agreement || '50% acconto - 50% a consegna'}`, 
      { x: 45, y: yPosition, size: 9, font });
  }

  // Footer
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height: 60,
    color: rgb(0.22, 0.67, 0.31),
  });

  page.drawText('ZAPPER - RENEWED AIR', {
    x: width / 2 - 70,
    y: 40,
    size: 10,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText('WWW.ABBATTITORIZAPPER.IT | info@abbattitorizapper.it | 081 19968436', {
    x: width / 2 - 140,
    y: 25,
    size: 8,
    font,
    color: rgb(1, 1, 1),
  });

  page.drawText('Via G. Ferraris 24, 84018 SCAFATI (SA) | P.IVA 03895390650', {
    x: width / 2 - 120,
    y: 12,
    size: 7,
    font,
    color: rgb(1, 1, 1),
  });

  const pdfBytes = await pdfDoc.save();
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
}
