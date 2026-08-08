package com.musgo.vendaseproducao.printstudio.printer.transport

/**
 * Abstração de transporte (Strategy) — hoje só temos BluetoothSppTransport (a Ablemark
 * BR-L100 fala Bluetooth Classic/SPP, confirmado via sniff HCI comparado com o app oficial).
 * Existe pra não acoplar LabelPrinterClient a Bluetooth especificamente, caso um dia
 * precisemos de BLE (impressoras mais novas) sem reescrever a camada de protocolo.
 */
interface PrinterTransport {
    fun connect(address: String): Boolean
    fun disconnect()
    fun isConnected(): Boolean
    fun write(bytes: ByteArray): Boolean
    /** Lê até [timeoutMs] esperando por resposta (usado em comandos de consulta, ex: versão/SN). */
    fun read(timeoutMs: Int): ByteArray?

    /** Detalhe do último erro de connect()/write()/read(), pra diagnóstico sem precisar de logcat. */
    val lastError: String?
}
