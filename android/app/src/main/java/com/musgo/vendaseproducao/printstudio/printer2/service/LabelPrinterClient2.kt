package com.musgo.vendaseproducao.printstudio.printer2.service

import android.content.Context
import android.graphics.Bitmap
import com.musgo.vendaseproducao.printstudio.printer2.protocol.AbleMarkL100Protocol2
import com.musgo.vendaseproducao.printstudio.printer2.transport.BluetoothSppTransport2
import com.musgo.vendaseproducao.printstudio.printer2.transport.PrinterTransport2

/** Segundo módulo Ablemark — fachada de alto nível, espelhando LabelPrinterClient original. */
class LabelPrinterClient2(context: Context) {
    private val transport: PrinterTransport2 = BluetoothSppTransport2(context)

    fun connect(address: String): Boolean = transport.connect(address)

    fun disconnect() = transport.disconnect()

    fun isConnected(): Boolean = transport.isConnected()

    fun lastError(): String? = transport.lastError

    fun printLabel(bitmap: Bitmap, paperType: Int = 2, density: Int = 2): Boolean {
        if (!transport.isConnected()) return false
        val bytes = AbleMarkL100Protocol2.buildPrintJob(bitmap, paperType, density)
        return transport.write(bytes)
    }
}
