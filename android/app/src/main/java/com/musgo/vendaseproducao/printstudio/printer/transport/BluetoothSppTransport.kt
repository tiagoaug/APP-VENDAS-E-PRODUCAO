package com.musgo.vendaseproducao.printstudio.printer.transport

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
 * Transporte Bluetooth Classic/SPP (Serial Port Profile) — usa a UUID padrão do Bluetooth SIG
 * pra SPP (00001101-0000-1000-8000-00805F9B34FB, número público, não proprietário). Confirmado
 * via sniff HCI que a Ablemark BR-L100 conecta assim (RFCOMM, canal alocado dinamicamente pelo
 * SDP — não fixo).
 *
 * Precisa de BLUETOOTH_CONNECT (Android 12+) ou BLUETOOTH+BLUETOOTH_ADMIN (Android 11-) já
 * concedidos antes de chamar connect().
 */
class BluetoothSppTransport(private val context: Context) : PrinterTransport {

    companion object {
        private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    }

    private var socket: BluetoothSocket? = null
    private var outputStream: OutputStream? = null
    private var inputStream: InputStream? = null

    /** Último erro de connect()/write()/read() — útil pra diagnosticar sem precisar de logcat. */
    override var lastError: String? = null
        private set

    // Fallback via reflection (canal RFCOMM 1 fixo, sem passar pela busca SDP por UUID) — bug
    // conhecido de várias pilhas Bluetooth OEM (Xiaomi/MIUI entre elas) em que
    // createRfcommSocketToServiceRecord + connect() falha mesmo com o dispositivo pareado e
    // funcionando normalmente em outros apps. Prática comum em SDKs de impressora térmica.
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
        // Sem cancelDiscovery() de propósito: exigiria também BLUETOOTH_SCAN em runtime (Android
        // 12+), e a gente nunca inicia discovery próprio aqui (listPairedDevices só lê
        // bondedDevices, não faz scan ativo) — nada realmente pra cancelar.

        // 1ª tentativa: SDP por UUID, socket INSEGURO (sem autenticação/criptografia). Chips
        // Bluetooth SPP baratos/embarcados (como o da BR-L100) são conhecidos por terem bugs de
        // compatibilidade com o modo seguro do Android — a conexão "funciona" (conecta, aceita
        // os bytes, sem erro nenhum visível), mas a impressão física sai corrompida. É a mesma
        // causa por trás de vários SDKs de impressora térmica recomendarem socket inseguro por
        // padrão.
        try {
            val sock = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID)
            sock.connect()
            attach(sock)
            return true
        } catch (e: Exception) {
            lastError = "SDP inseguro: ${e.javaClass.simpleName} ${e.message}"
        }

        // 2ª tentativa: SDP por UUID, socket seguro (comportamento original).
        try {
            val sock = device.createRfcommSocketToServiceRecord(SPP_UUID)
            sock.connect()
            attach(sock)
            lastError = null
            return true
        } catch (e: Exception) {
            lastError = "${lastError}; SDP seguro: ${e.javaClass.simpleName} ${e.message}"
        }

        // 3ª tentativa: fallback por reflection (canal 1 fixo).
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
