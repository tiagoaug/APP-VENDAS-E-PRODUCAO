package com.musgo.vendaseproducao.printstudio.printer2.transport

/**
 * Segundo módulo Ablemark (do zero) — mesma abstração de transporte do módulo original
 * (ver printstudio/printer/transport/PrinterTransport.kt), reimplementada de forma
 * independente pra permitir comparação lado a lado sem tocar no módulo antigo.
 */
interface PrinterTransport2 {
    fun connect(address: String): Boolean
    fun disconnect()
    fun isConnected(): Boolean
    fun write(bytes: ByteArray): Boolean
    fun read(timeoutMs: Int): ByteArray?
    val lastError: String?
}
