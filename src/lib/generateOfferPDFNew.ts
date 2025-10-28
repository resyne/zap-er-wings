import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const GREEN = rgb(0.22, 0.67, 0.31); // #38AC4F
const LIGHT_BG = rgb(0.98, 0.98, 0.98); // #f9f9f9
const WHITE = rgb(1, 1, 1);
const BLACK = rgb(0.2, 0.2, 0.2); // #333
const GRAY = rgb(0.33, 0.33, 0.33); // #555

interface OfferData {
  numero_offerta: string;
  data_offerta: string;
  utente: string;
  cliente: {
    nome: string;
    indirizzo: string;
  };
  oggetto_offerta: string;
  items: Array<{
    descrizione: string;
    quantita: number;
    prezzo_unitario: number;
    totale: number;
  }>;
  incluso_fornitura: string[];
  escluso_fornitura: string;
  totale_imponibile: string;
  totale_iva: string;
  totale_lordo: string;
  validita_offerta: string;
  tempi_consegna: string;
  metodi_pagamento: string;
  timeline_produzione: string;
  timeline_consegna: string;
  timeline_installazione: string;
}

export async function generateOfferPDF(offerData: OfferData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([595, 842]); // A4 in points
  const { width, height } = page.getSize();
  
  let yPosition = height - 50; // Start from top
  const margin = 50;
  const contentWidth = width - 2 * margin;

  // ========== HEADER ==========
  page.drawRectangle({
    x: 0,
    y: yPosition - 100,
    width: width,
    height: 100,
    color: GREEN,
  });

  // Logo section (left)
  page.drawText('ZAPPER', {
    x: margin,
    y: yPosition - 25,
    size: 20,
    font: helveticaBold,
    color: WHITE,
  });

  page.drawText('WWW.ABBATTITORIZAPPER.IT', {
    x: margin,
    y: yPosition - 45,
    size: 11,
    font: helveticaBold,
    color: WHITE,
  });

  page.drawText('📧 info@abbattitorizapper.it', {
    x: margin,
    y: yPosition - 62,
    size: 9,
    font: helvetica,
    color: WHITE,
  });

  page.drawText('📞 081 19968436 | 📱 +39 324 8996189', {
    x: margin,
    y: yPosition - 75,
    size: 9,
    font: helvetica,
    color: WHITE,
  });

  page.drawText('CLIMATEL DI ELEFANTE Pasquale', {
    x: margin,
    y: yPosition - 90,
    size: 8,
    font: helvetica,
    color: WHITE,
  });

  // Doc info (right)
  page.drawText(`OFFERTA N. ${offerData.numero_offerta}`, {
    x: width - margin - 150,
    y: yPosition - 25,
    size: 11,
    font: helveticaBold,
    color: WHITE,
  });

  page.drawText(`Data: ${offerData.data_offerta}`, {
    x: width - margin - 150,
    y: yPosition - 40,
    size: 9,
    font: helvetica,
    color: WHITE,
  });

  page.drawText(`Creata da: ${offerData.utente}`, {
    x: width - margin - 150,
    y: yPosition - 55,
    size: 9,
    font: helvetica,
    color: WHITE,
  });

  page.drawText('Spett.le Cliente:', {
    x: width - margin - 150,
    y: yPosition - 75,
    size: 9,
    font: helvetica,
    color: WHITE,
  });

  page.drawText(offerData.cliente.nome, {
    x: width - margin - 150,
    y: yPosition - 90,
    size: 11,
    font: helveticaBold,
    color: WHITE,
  });

  yPosition -= 120;

  // ========== OGGETTO ==========
  yPosition -= 20;
  page.drawText('OGGETTO', {
    x: margin,
    y: yPosition,
    size: 12,
    font: helveticaBold,
    color: GREEN,
  });

  // Green underline
  page.drawLine({
    start: { x: margin, y: yPosition - 5 },
    end: { x: width - margin, y: yPosition - 5 },
    thickness: 2,
    color: GREEN,
  });

  yPosition -= 25;

  // Oggetto box with background
  page.drawRectangle({
    x: margin - 5,
    y: yPosition - 40,
    width: contentWidth + 10,
    height: 45,
    color: LIGHT_BG,
  });

  // Green left border
  page.drawRectangle({
    x: margin - 5,
    y: yPosition - 40,
    width: 4,
    height: 45,
    color: GREEN,
  });

  const oggettoLines = wrapText(offerData.oggetto_offerta, contentWidth - 20, 10, helvetica);
  oggettoLines.forEach((line, index) => {
    page.drawText(line, {
      x: margin + 5,
      y: yPosition - 15 - (index * 12),
      size: 10,
      font: helvetica,
      color: BLACK,
    });
  });

  yPosition -= 60;

  // ========== TABELLA PRODOTTI ==========
  yPosition -= 20;
  page.drawText('DETTAGLIO PRODOTTI/SERVIZI', {
    x: margin,
    y: yPosition,
    size: 12,
    font: helveticaBold,
    color: GREEN,
  });

  page.drawLine({
    start: { x: margin, y: yPosition - 5 },
    end: { x: width - margin, y: yPosition - 5 },
    thickness: 2,
    color: GREEN,
  });

  yPosition -= 25;

  // Table header
  const tableTop = yPosition;
  const colWidths = {
    desc: contentWidth * 0.5,
    qty: contentWidth * 0.15,
    price: contentWidth * 0.175,
    total: contentWidth * 0.175,
  };

  page.drawRectangle({
    x: margin,
    y: tableTop - 20,
    width: contentWidth,
    height: 20,
    color: GREEN,
  });

  page.drawText('Descrizione', {
    x: margin + 5,
    y: tableTop - 15,
    size: 10,
    font: helveticaBold,
    color: WHITE,
  });

  page.drawText('Qtà', {
    x: margin + colWidths.desc + 5,
    y: tableTop - 15,
    size: 10,
    font: helveticaBold,
    color: WHITE,
  });

  page.drawText('Prezzo Unit.', {
    x: margin + colWidths.desc + colWidths.qty + 5,
    y: tableTop - 15,
    size: 10,
    font: helveticaBold,
    color: WHITE,
  });

  page.drawText('Totale', {
    x: margin + colWidths.desc + colWidths.qty + colWidths.price + 5,
    y: tableTop - 15,
    size: 10,
    font: helveticaBold,
    color: WHITE,
  });

  yPosition = tableTop - 25;

  // Table rows
  offerData.items.forEach((item, index) => {
    const rowHeight = 20;
    const rowY = yPosition;

    // Alternate row background
    if (index % 2 === 0) {
      page.drawRectangle({
        x: margin,
        y: rowY - rowHeight,
        width: contentWidth,
        height: rowHeight,
        color: LIGHT_BG,
      });
    }

    // Draw borders
    page.drawRectangle({
      x: margin,
      y: rowY - rowHeight,
      width: contentWidth,
      height: rowHeight,
      borderColor: rgb(0.87, 0.87, 0.87),
      borderWidth: 1,
    });

    page.drawText(item.descrizione.substring(0, 50), {
      x: margin + 5,
      y: rowY - 13,
      size: 9,
      font: helvetica,
      color: BLACK,
    });

    page.drawText(item.quantita.toString(), {
      x: margin + colWidths.desc + 5,
      y: rowY - 13,
      size: 9,
      font: helvetica,
      color: BLACK,
    });

    page.drawText(`€ ${item.prezzo_unitario.toFixed(2)}`, {
      x: margin + colWidths.desc + colWidths.qty + 5,
      y: rowY - 13,
      size: 9,
      font: helvetica,
      color: BLACK,
    });

    page.drawText(`€ ${item.totale.toFixed(2)}`, {
      x: margin + colWidths.desc + colWidths.qty + colWidths.price + 5,
      y: rowY - 13,
      size: 9,
      font: helvetica,
      color: BLACK,
    });

    yPosition -= rowHeight;
  });

  yPosition -= 10;

  // ========== INCLUSIONI ==========
  yPosition -= 20;

  page.drawRectangle({
    x: margin,
    y: yPosition - 80,
    width: contentWidth,
    height: 85,
    color: LIGHT_BG,
    borderColor: rgb(0.93, 0.93, 0.93),
    borderWidth: 1,
  });

  page.drawText('Cosa Include la Fornitura', {
    x: margin + contentWidth / 2 - 70,
    y: yPosition - 15,
    size: 11,
    font: helveticaBold,
    color: GREEN,
  });

  yPosition -= 30;
  offerData.incluso_fornitura.slice(0, 6).forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    page.drawText(`✓ ${item.substring(0, 30)}`, {
      x: margin + 10 + (col * (contentWidth / 2)),
      y: yPosition - (row * 15),
      size: 9,
      font: helvetica,
      color: BLACK,
    });
  });

  yPosition -= 65;

  // ========== ESCLUSIONI ==========
  yPosition -= 20;

  page.drawRectangle({
    x: margin,
    y: yPosition - 40,
    width: contentWidth,
    height: 45,
    color: rgb(1, 0.99, 0.94),
    borderColor: rgb(0.94, 0.90, 0.55),
    borderWidth: 1,
  });

  page.drawRectangle({
    x: margin,
    y: yPosition - 40,
    width: 3,
    height: 45,
    color: rgb(0.94, 0.90, 0.55),
  });

  page.drawText('Cosa Esclude la Fornitura', {
    x: margin + 10,
    y: yPosition - 15,
    size: 10,
    font: helveticaBold,
    color: GRAY,
  });

  const escludeLines = wrapText(offerData.escluso_fornitura, contentWidth - 30, 9, helvetica);
  escludeLines.slice(0, 2).forEach((line, index) => {
    page.drawText(line, {
      x: margin + 10,
      y: yPosition - 30 - (index * 11),
      size: 9,
      font: helvetica,
      color: GRAY,
    });
  });

  yPosition -= 60;

  // ========== TOTALI ==========
  yPosition -= 10;

  page.drawText('Totale Imponibile:', {
    x: width - margin - 250,
    y: yPosition,
    size: 10,
    font: helveticaBold,
    color: BLACK,
  });

  page.drawText(`€ ${offerData.totale_imponibile}`, {
    x: width - margin - 100,
    y: yPosition,
    size: 10,
    font: helvetica,
    color: BLACK,
  });

  yPosition -= 15;

  page.drawText('IVA:', {
    x: width - margin - 250,
    y: yPosition,
    size: 10,
    font: helveticaBold,
    color: BLACK,
  });

  page.drawText(`€ ${offerData.totale_iva}`, {
    x: width - margin - 100,
    y: yPosition,
    size: 10,
    font: helvetica,
    color: BLACK,
  });

  yPosition -= 20;

  page.drawLine({
    start: { x: width - margin - 250, y: yPosition + 5 },
    end: { x: width - margin, y: yPosition + 5 },
    thickness: 2,
    color: GREEN,
  });

  page.drawText('Totale Offerta:', {
    x: width - margin - 250,
    y: yPosition - 10,
    size: 12,
    font: helveticaBold,
    color: GREEN,
  });

  page.drawText(`€ ${offerData.totale_lordo}`, {
    x: width - margin - 100,
    y: yPosition - 10,
    size: 12,
    font: helveticaBold,
    color: GREEN,
  });

  yPosition -= 40;

  // ========== FOOTER ==========
  page.drawRectangle({
    x: 0,
    y: 0,
    width: width,
    height: 50,
    color: GREEN,
  });

  page.drawText('ZAPPER® - RENEWED AIR', {
    x: width / 2 - 80,
    y: 35,
    size: 10,
    font: helveticaBold,
    color: WHITE,
  });

  page.drawText('WWW.ABBATTITORIZAPPER.IT', {
    x: width / 2 - 75,
    y: 22,
    size: 9,
    font: helvetica,
    color: WHITE,
  });

  page.drawText('📧 info@abbattitorizapper.it | 📞 081 19968436', {
    x: width / 2 - 110,
    y: 10,
    size: 8,
    font: helvetica,
    color: WHITE,
  });

  return await pdfDoc.save();
}

function wrapText(text: string, maxWidth: number, fontSize: number, font: any): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach(word => {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}
