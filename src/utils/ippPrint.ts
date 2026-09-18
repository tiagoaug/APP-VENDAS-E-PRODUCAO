// Impressão via protocolo IPP puro, direto pro IP da impressora — não depende de descoberta
// automática (AirPrint no iOS, serviço de impressão do fabricante no Android), então funciona
// com impressoras que falam IPP mas não têm certificação AirPrint completa (ex.: alguns
// modelos Epson que aparecem no Android via Mopria mas não no AirPrint do iPhone). Implementa
// só o suficiente do RFC 8010/2911 pra montar um pedido "Print-Job" e ler se deu certo — sem
// discovery, sem negociação de capacidades, o usuário digita o IP manualmente.

function encodeIppAttribute(tag: number, name: string, value: string): number[] {
  const nameBytes = Array.from(new TextEncoder().encode(name));
  const valueBytes = Array.from(new TextEncoder().encode(value));
  return [
    tag,
    (nameBytes.length >> 8) & 0xff, nameBytes.length & 0xff,
    ...nameBytes,
    (valueBytes.length >> 8) & 0xff, valueBytes.length & 0xff,
    ...valueBytes,
  ];
}

export interface IppPrintResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

/**
 * Envia um PDF (base64, sem o prefixo "data:") pra impressora no IP informado via IPP puro
 * (Print-Job, RFC 8010/2911), sem passar pelo AirPrint/PrintManager do sistema.
 */
export async function printPdfViaIpp(
  host: string,
  base64Pdf: string,
  jobName: string,
  port: number = 631,
  resourcePath: string = '/ipp/print',
): Promise<IppPrintResult> {
  try {
    const printerUri = `ipp://${host}:${port}${resourcePath}`;
    const header: number[] = [
      0x01, 0x01, // version 1.1
      0x00, 0x02, // operation-id: Print-Job
      0x00, 0x00, 0x00, 0x01, // request-id
      0x01, // operation-attributes-tag
      ...encodeIppAttribute(0x47, 'attributes-charset', 'utf-8'),
      ...encodeIppAttribute(0x48, 'attributes-natural-language', 'en'),
      ...encodeIppAttribute(0x45, 'printer-uri', printerUri),
      ...encodeIppAttribute(0x42, 'requesting-user-name', 'LimoApp'),
      ...encodeIppAttribute(0x42, 'job-name', jobName),
      ...encodeIppAttribute(0x49, 'document-format', 'application/pdf'),
      0x03, // end-of-attributes-tag
    ];

    const pdfBinary = atob(base64Pdf);
    const pdfBytes = new Uint8Array(pdfBinary.length);
    for (let i = 0; i < pdfBinary.length; i++) pdfBytes[i] = pdfBinary.charCodeAt(i);

    const requestBody = new Uint8Array(header.length + pdfBytes.length);
    requestBody.set(header, 0);
    requestBody.set(pdfBytes, header.length);

    // Sem timeout, um IP errado/inalcançável deixa o fetch() pendurado por muito tempo (o
    // timeout padrão de conexão TCP costuma passar de 1 minuto) — 10s é mais que suficiente
    // pra uma resposta numa rede local; se não responder nesse prazo, quase certamente não
    // tem impressora nesse IP.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    let response: Response;
    try {
      const httpUrl = `http://${host}:${port}${resourcePath}`;
      response = await fetch(httpUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/ipp' },
        body: requestBody,
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { success: false, error: 'Nenhuma resposta da impressora nesse IP (tempo esgotado). Confirme o endereço e se está na mesma rede.' };
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const respBytes = new Uint8Array(await response.arrayBuffer());
    if (respBytes.length < 8) {
      return { success: false, error: 'Resposta inválida da impressora' };
    }
    const statusCode = (respBytes[2] << 8) | respBytes[3];
    // Códigos 0x0000–0x00FF são a faixa "successful" do IPP (successful-ok,
    // successful-ok-ignored-or-substituted-attributes, successful-ok-conflicting-attributes).
    const success = statusCode <= 0x00ff;
    return {
      success,
      statusCode,
      error: success ? undefined : `Código de status IPP: 0x${statusCode.toString(16).padStart(4, '0')}`,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}
