import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import * as bwipjs from "bwip-js";
import type { DanfeSimplificadoData } from "./sync";

const MM_TO_PT = 2.83465;
const mm = (v: number) => v * MM_TO_PT;

export interface DanfeCompanyInfo {
  name?: string;
  document?: string;
  address?: string;
}

// Quebra `text` em linhas que cabem em `maxWidthMm`, usando a métrica real da fonte (sem isso,
// texto comprido do endereço/descrição do item vazava pra fora da etiqueta 100x150).
function wrapText(font: PDFFont, text: string, sizePt: number, maxWidthMm: number): string[] {
  const maxWidthPt = mm(maxWidthMm);
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, sizePt) > maxWidthPt && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

const formatChaveAcesso = (chave: string): string => (chave.match(/.{1,4}/g) || [chave]).join(" ");

/**
 * Monta o PDF do "DANFE Simplificado + Etiqueta" 100x150mm inteiramente aqui no servidor (texto
 * via pdf-lib, código de barras via bwip-js) — não usa canvas/DOM, então roda direto no Cloud
 * Function sem depender do navegador. Isso permite juntar essa página com a etiqueta de envio
 * real (também baixada no servidor) num PDF único, sem o problema de CORS que um fetch feito
 * pelo navegador teria pro link assinado da AWS.
 * Layout espelha o modelo que já sai do site do Bling — sem o bloco de tributos aproximados
 * (IBPT): calcular isso corretamente exige a tabela oficial por NCM, fora do escopo aqui.
 */
export async function buildDanfeSimplificadoPdfBytes(data: DanfeSimplificadoData, company: DanfeCompanyInfo | null): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const W_MM = 100;
  const H_MM = 150;
  const page: PDFPage = doc.addPage([mm(W_MM), mm(H_MM)]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const margin = 4;
  const contentW = W_MM - margin * 2;
  const black = rgb(0, 0, 0);

  // y sempre em "mm a partir do topo" — convertido pra pdf-lib (origem embaixo) na hora de desenhar.
  let y = 6;
  const toPdfY = (topMm: number) => mm(H_MM) - mm(topMm);

  const drawCentered = (text: string, topMm: number, sizePt: number, bold = true) => {
    const f = bold ? fontBold : font;
    const width = f.widthOfTextAtSize(text, sizePt);
    page.drawText(text, { x: mm(W_MM) / 2 - width / 2, y: toPdfY(topMm), size: sizePt, font: f, color: black });
  };

  const drawLeft = (text: string, xMm: number, topMm: number, sizePt: number, bold = false) => {
    page.drawText(text, { x: mm(xMm), y: toPdfY(topMm), size: sizePt, font: bold ? fontBold : font, color: black });
  };

  const drawRight = (text: string, rightXMm: number, topMm: number, sizePt: number, bold = false) => {
    const f = bold ? fontBold : font;
    const width = f.widthOfTextAtSize(text, sizePt);
    page.drawText(text, { x: mm(rightXMm) - width, y: toPdfY(topMm), size: sizePt, font: f, color: black });
  };

  const dashedLine = (topMm: number) => {
    page.drawLine({
      start: { x: mm(margin), y: toPdfY(topMm) },
      end: { x: mm(W_MM - margin), y: toPdfY(topMm) },
      thickness: 0.3,
      color: black,
      dashArray: [1.5, 1.5],
    });
  };

  drawCentered("DANFE Simplificado - Etiqueta", y, 9);
  y += 3;
  dashedLine(y);
  y += 5;

  if (company?.name) {
    drawCentered(company.name, y, 9);
    y += 4;
  }
  if (company?.document) {
    drawCentered(`CNPJ: ${company.document}`, y, 6.5, false);
    y += 3;
  }
  if (company?.address) {
    for (const line of wrapText(font, company.address, 6.5, contentW)) {
      drawCentered(line, y, 6.5, false);
      y += 3;
    }
  }
  y += 2;

  if (data.chaveAcesso) {
    try {
      const barcodeBuffer = await bwipjs.toBuffer({
        bcid: "code128",
        text: data.chaveAcesso,
        scale: 3,
        height: 10,
        includetext: false,
      });
      const barcodeImage = await doc.embedPng(barcodeBuffer);
      const bh = 12;
      page.drawImage(barcodeImage, { x: mm(margin), y: toPdfY(y + bh), width: mm(contentW), height: mm(bh) });
      y += bh + 2;
    } catch {
      // Sem barcode se a geração falhar (ex.: chave malformada) — segue o resto da etiqueta.
    }
    drawCentered(formatChaveAcesso(data.chaveAcesso), y, 6, false);
    y += 4;
  }

  if (data.numeroProtocolo) {
    drawCentered("Protocolo de autorização de uso", y, 6, false);
    y += 3;
    const dataAut = data.dataAutorizacao ? ` ${data.dataAutorizacao}` : "";
    drawCentered(`${data.numeroProtocolo}${dataAut}`, y, 6.5);
    y += 4;
  }

  drawCentered(`TIPO: 1 - Saída | Nº NFe: ${data.numero || "—"} | SÉRIE: ${data.serie || "—"}`, y, 7);
  y += 3.5;
  if (data.dataEmissao) {
    drawCentered(`Data de emissão: ${data.dataEmissao}`, y, 6.5, false);
    y += 3.5;
  }
  y += 1;
  dashedLine(y);
  y += 4;

  drawLeft("ITEM", margin, y, 6.5, true);
  drawRight("VL. ITEM", W_MM - margin, y, 6.5, true);
  y += 2;
  dashedLine(y);
  y += 3.5;

  let totalQty = 0;
  for (const item of data.itens) {
    totalQty += item.quantidade;
    const valor = (item.quantidade * item.valorUnitario).toFixed(2);
    const descLines = wrapText(font, item.descricao, 6.5, contentW - 16);
    descLines.forEach((line, idx) => {
      drawLeft(line, margin, y, 6.5, false);
      if (idx === 0) drawRight(`R$ ${valor}`, W_MM - margin, y, 6.5, false);
      y += 3;
    });
    drawLeft(`${item.quantidade.toFixed(2)} par X ${item.valorUnitario.toFixed(2)}`, margin, y, 6, false);
    y += 3.5;
  }
  y += 0.5;
  dashedLine(y);
  y += 3.5;

  drawLeft("QTD. TOTAL DE ITENS", margin, y, 6.5, true);
  drawRight(String(totalQty), W_MM - margin, y, 6.5, true);
  y += 4;
  drawLeft("VALOR NOTA R$", margin, y, 7.5, true);
  drawRight(data.valorTotal.toFixed(2), W_MM - margin, y, 7.5, true);
  y += 3;
  dashedLine(y);
  y += 4;

  if (data.destinatario) {
    drawCentered("CONSUMIDOR", y, 6.5);
    y += 3.5;
    const docLine = `CNPJ/CPF: ${data.destinatario.numeroDocumento} — ${data.destinatario.nome}`;
    for (const line of wrapText(font, docLine, 6, contentW)) {
      drawLeft(line, margin, y, 6, false);
      y += 3;
    }
    const enderecoLinha = `${data.destinatario.endereco || ""}${data.destinatario.numero ? `, ${data.destinatario.numero}` : ""}${data.destinatario.bairro ? ` — ${data.destinatario.bairro}` : ""}`;
    if (enderecoLinha.trim()) {
      for (const line of wrapText(font, enderecoLinha, 6, contentW)) {
        drawLeft(line, margin, y, 6, false);
        y += 3;
      }
    }
    if (data.destinatario.municipio) {
      drawLeft(`${data.destinatario.municipio}${data.destinatario.uf ? ` / ${data.destinatario.uf}` : ""}`, margin, y, 6, false);
      y += 3.5;
    }
    y += 1;
    dashedLine(y);
    y += 4;
  }

  drawCentered("Consulte a chave de acesso em www.nfe.fazenda.gov.br", y, 6, false);
  y += 3.5;
  if (data.numeroPedidoLoja) {
    drawCentered(`Nº Pedido Loja: ${data.numeroPedidoLoja}`, y, 6.5);
  }

  return doc.save();
}
