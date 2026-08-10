package com.musgo.vendaseproducao.printstudio.printer

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Estrutura BASE pra suporte a impressoras Epson (linha TM-m, Wi-Fi Direct) — modelo escolhido
 * como equivalente Epson à Ablemark BR-L100 (ver AbleMarkPrinterPlugin.kt, mesmo pacote), por
 * ter Wi-Fi Direct confirmado e usar o SDK oficial "Epson ePOS SDK for Android" (não a
 * "ePOS-Print SDK" antiga de 2012-2015, já descontinuada pela própria Epson).
 *
 * IMPORTANTE — isto NÃO integra o SDK real ainda: os métodos abaixo só existem pra já deixar a
 * ponte JS↔nativo (nomes de método, formato de retorno) e a tela de seleção de impressora
 * prontas. A API exata de descoberta/conexão/impressão da Epson (classes Epos2, o pareamento
 * Wi-Fi Direct, o formato de comando de imagem) só foi possível confirmar em alto nível via
 * busca — não foi possível extrair a referência exata (PDF protegido) sem baixar o SDK oficial
 * (conta gratuita de desenvolvedor Epson) e ter a impressora em mãos pra validar, o mesmo tipo
 * de validação que a Ablemark exigiu. Quando o SDK/AAR chegar, a implementação de verdade entra
 * aqui — a assinatura dos métodos abaixo foi pensada pra não precisar mudar o lado JS depois.
 */
@CapacitorPlugin(name = "EpsonPrinter")
class EpsonPrinterPlugin : Plugin() {

    private val notImplementedMsg =
        "Integração com o SDK oficial da Epson ainda não foi feita — esta tela já existe, mas a impressão real depende do SDK (Epson ePOS SDK for Android) ser adicionado ao projeto."

    /** Busca impressoras via Wi-Fi Direct/rede local — no SDK real, dispara o Discovery da
     * Epson (com filtro de tipo TM-m/label) e devolve os alvos encontrados. */
    @PluginMethod
    fun discoverPrinters(call: PluginCall) {
        call.reject(notImplementedMsg)
    }

    /** Conecta num alvo já descoberto (endereço/"target" no formato que o SDK da Epson usa,
     * ex.: "TCP:192.168.x.x" ou o identificador Wi-Fi Direct do dispositivo). */
    @PluginMethod
    fun connect(call: PluginCall) {
        call.reject(notImplementedMsg)
    }

    @PluginMethod
    fun disconnect(call: PluginCall) {
        val result = JSObject()
        call.resolve(result)
    }

    @PluginMethod
    fun isConnected(call: PluginCall) {
        // Sem cliente real nenhum ainda — sempre desconectado, isso não é uma suposição sobre a
        // API da Epson, só reflete que essa integração não existe de fato ainda.
        val result = JSObject()
        result.put("connected", false)
        call.resolve(result)
    }

    /** "imagePath": mesma convenção do AbleMarkPrinterPlugin — URI de arquivo já salvo pelo
     * lado web (Filesystem.writeFile), nunca base64 bruto. */
    @PluginMethod
    fun printLabel(call: PluginCall) {
        call.reject(notImplementedMsg)
    }
}
