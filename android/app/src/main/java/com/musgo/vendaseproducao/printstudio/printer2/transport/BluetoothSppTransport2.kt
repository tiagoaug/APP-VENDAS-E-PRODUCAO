package com.musgo.vendaseproducao.printstudio.printer2.transport

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.content.Context
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.util.UUID

/**
 * Segundo módulo Ablemark — transporte Bluetooth Classic/SPP, reimplementado do zero
 * (independente do módulo original em printstudio/printer/transport/BluetoothSppTransport.kt).
 * UUID padrão do Bluetooth SIG pra SPP.
 */
class BluetoothSppTransport2(private val context: Context) : PrinterTransport2 {

    companion object {
        private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    }

    private var socket: BluetoothSocket? = null
    private var outputStream: OutputStream? = null
    private var inputStream: InputStream? = null

    override var lastError: String? = null
        private set

    @SuppressLint("MissingPermission", "DiscouragedPrivateApi")
    private fun createFallbackSocket(device: BluetoothDevice): BluetoothSocket {
        val method = device.javaClass.getMethod("createRfcommSocket", Int::class.javaPrimitiveType)
        return method.invoke(device, 1) as BluetoothSocket
    }

    @SuppressLint("MissingPermission")
    override fun connect(address: String): Boolean {
        disconnect()
        lastError = null
        val adapter = BluetoothAdapter.getDefaultAdapter()
        if (adapter == null) {
            lastError = "Adaptador Bluetooth indisponível"
            return false
        }
        val device = try {
            adapter.getRemoteDevice(address)
        } catch (e: IllegalArgumentException) {
            lastError = "Endereço MAC inválido: ${e.message}"
            return false
        }

        try {
            val sock = device.createRfcommSocketToServiceRecord(SPP_UUID)
            sock.connect()
            attach(sock)
            return true
        } catch (e: Exception) {
            lastError = "SDP: ${e.javaClass.simpleName} ${e.message}"
        }

        try {
            val sock = createFallbackSocket(device)
            sock.connect()
            attach(sock)
            lastError = null
            return true
        } catch (e: Exception) {
            lastError = "${lastError}; Fallback: ${e.javaClass.simpleName} ${e.message}"
            disconnect()
            return false
        }
    }

    private fun attach(sock: BluetoothSocket) {
        socket = sock
        outputStream = sock.outputStream
        inputStream = sock.inputStream
    }

    override fun disconnect() {
        try { inputStream?.close() } catch (e: IOException) { /* ignore */ }
        try { outputStream?.close() } catch (e: IOException) { /* ignore */ }
        try { socket?.close() } catch (e: IOException) { /* ignore */ }
        inputStream = null
        outputStream = null
        socket = null
    }

    override fun isConnected(): Boolean = socket?.isConnected == true

    override fun write(bytes: ByteArray): Boolean {
        val out = outputStream ?: run { lastError = "Sem outputStream (não conectado)"; return false }
        return try {
            out.write(bytes)
            out.flush()
            true
        } catch (e: IOException) {
            lastError = "write: ${e.javaClass.simpleName} ${e.message}"
            false
        }
    }

    override fun read(timeoutMs: Int): ByteArray? {
        val input = inputStream ?: return null
        return try {
            val buffer = ByteArray(4096)
            val deadline = System.currentTimeMillis() + timeoutMs
            while (System.currentTimeMillis() < deadline) {
                if (input.available() > 0) {
                    val read = input.read(buffer)
                    if (read > 0) return buffer.copyOf(read)
                }
                Thread.sleep(20)
            }
            null
        } catch (e: IOException) {
            lastError = "read: ${e.javaClass.simpleName} ${e.message}"
            null
        } catch (e: InterruptedException) {
            Thread.currentThread().interrupt()
            null
        }
    }
}
