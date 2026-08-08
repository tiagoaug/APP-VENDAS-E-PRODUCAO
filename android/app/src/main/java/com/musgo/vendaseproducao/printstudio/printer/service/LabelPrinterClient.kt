package com.musgo.vendaseproducao.printstudio.printer.service

import android.content.Context
import android.graphics.Bitmap
import com.musgo.vendaseproducao.printstudio.printer.protocol.AbleMarkL100Protocol
import com.musgo.vendaseproducao.printstudio.printer.transport.BluetoothSppTransport
import com.musgo.vendaseproducao.printstudio.printer.transport.PrinterTransport

/**
 * Fachada de alto nível — isola o resto do app de qual transporte/protocolo está sendo usado.
 * Hoje só sabe falar com a Ablemark BR-L100 (transporte SPP + protocolo X4/L100).
 */
class LabelPrinterClient(context: Context) {
    private val transport: PrinterTransport = BluetoothSppTransport(context)

    fun connect(address: String): Boolean = transport.connect(address)

    fun disconnect() = transport.disconnect()

    fun isConnected(): Boolean = transport.isConnected()

    fun lastError(): String? = transport.lastError

    fun printLabel(bitmap: Bitmap, paperType: Int = 2, density: Int = 2): Boolean {
        if (!transport.isConnected()) return false
        val bytes = AbleMarkL100Protocol.buildPrintJob(bitmap, paperType, density)
        return transport.write(bytes)
    }
}
