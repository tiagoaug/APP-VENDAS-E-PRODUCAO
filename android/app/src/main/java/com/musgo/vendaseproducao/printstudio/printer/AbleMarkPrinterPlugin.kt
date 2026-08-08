package com.musgo.vendaseproducao.printstudio.printer

import android.annotation.SuppressLint
import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import com.musgo.vendaseproducao.printstudio.printer.service.LabelPrinterClient
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

private const val PERM_BT = "bluetooth"

@CapacitorPlugin(
    name = "AbleMarkPrinter",
    permissions = [Permission(strings = [android.Manifest.permission.BLUETOOTH_CONNECT], alias = PERM_BT)]
)
class AbleMarkPrinterPlugin : Plugin() {

    // connect()/write() do BluetoothSocket são bloqueantes (connect() pode levar até ~12s por
    // tentativa) — nunca rodar isso na thread principal, mesmo que o Capacitor já despache
    // @PluginMethod fora da UI thread em algumas versões; melhor garantir explicitamente aqui
    // do que arriscar ANR ("app apresenta falhas contínuas" no MIUI).
    private val ioExecutor = Executors.newSingleThreadExecutor()

    // Trava extra contra chamadas de printLabel() sobrepostas (ex.: bug de duplo-clique/ghost
    // click no lado web) — sem isso, duas chamadas quase simultâneas cada uma abriria/leria seu
    // próprio bitmap e mandaria pra impressora, gerando dois jobs de impressão só de um toque.
    private val printBusy = AtomicBoolean(false)

    private var client: LabelPrinterClient? = null

    private fun getOrCreateClient(): LabelPrinterClient {
        val existing = client
        if (existing != null) return existing
        val created = LabelPrinterClient(context)
        client = created
        return created
    }

    /** Lista dispositivos Bluetooth já pareados no aparelho — usado pra montar um seletor
     * na tela de teste em vez do usuário ter que digitar o endereço MAC na mão. */
    @SuppressLint("MissingPermission")
    @PluginMethod
    fun listPairedDevices(call: PluginCall) {
        if (getPermissionState(PERM_BT) != com.getcapacitor.PermissionState.GRANTED) {
            requestPermissionForAlias(PERM_BT, call, "listPairedDevicesPermCallback")
            return
        }
        doListPairedDevices(call)
    }

    @PermissionCallback
    private fun listPairedDevicesPermCallback(call: PluginCall) {
        if (getPermissionState(PERM_BT) != com.getcapacitor.PermissionState.GRANTED) {
            call.reject("Permissão de Bluetooth negada")
            return
        }
        doListPairedDevices(call)
    }

    private fun doListPairedDevices(call: PluginCall) {
        val adapter = BluetoothAdapter.getDefaultAdapter()
        if (adapter == null) {
            call.reject("Bluetooth não disponível neste aparelho")
            return
        }
        val devices = JSArray()
        adapter.bondedDevices?.forEach { device ->
            val item = JSObject()
            item.put("name", device.name ?: "(sem nome)")
            item.put("address", device.address)
            devices.put(item)
        }
        val result = JSObject()
        result.put("devices", devices)
        call.resolve(result)
    }

    /** Checagem simples — não precisa de permissão especial, só ler o estado do adapter. */
    @PluginMethod
    fun isBluetoothEnabled(call: PluginCall) {
        val result = JSObject()
        result.put("enabled", BluetoothAdapter.getDefaultAdapter()?.isEnabled == true)
        call.resolve(result)
    }

    /** Abre o diálogo nativo do Android pedindo pro usuário ligar o Bluetooth. */
    @PluginMethod
    fun requestEnableBluetooth(call: PluginCall) {
        val adapter = BluetoothAdapter.getDefaultAdapter()
        if (adapter == null) {
            call.reject("Bluetooth não disponível neste aparelho")
            return
        }
        if (adapter.isEnabled) {
            val result = JSObject()
            result.put("enabled", true)
            call.resolve(result)
            return
        }
        startActivityForResult(call, Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE), "requestEnableBluetoothResult")
    }

    @ActivityCallback
    private fun requestEnableBluetoothResult(call: PluginCall, result: ActivityResult) {
        val response = JSObject()
        response.put("enabled", result.resultCode == Activity.RESULT_OK)
        call.resolve(response)
    }

    @PluginMethod
    fun connect(call: PluginCall) {
        val address = call.getString("address")
        if (address.isNullOrBlank()) {
            call.reject("Endereço MAC do dispositivo é obrigatório")
            return
        }
        if (getPermissionState(PERM_BT) != com.getcapacitor.PermissionState.GRANTED) {
            requestPermissionForAlias(PERM_BT, call, "connectPermCallback")
            return
        }
        doConnect(call, address)
    }

    @PermissionCallback
    private fun connectPermCallback(call: PluginCall) {
        val address = call.getString("address")
        if (getPermissionState(PERM_BT) != com.getcapacitor.PermissionState.GRANTED || address.isNullOrBlank()) {
            call.reject("Permissão de Bluetooth negada")
            return
        }
        doConnect(call, address)
    }

    private fun doConnect(call: PluginCall, address: String) {
        ioExecutor.execute {
            try {
                val theClient = getOrCreateClient()
                val ok = theClient.connect(address)
                val result = JSObject()
                result.put("connected", ok)
                if (ok) call.resolve(result) else call.reject("Não foi possível conectar: ${theClient.lastError()}")
            } catch (e: Throwable) {
                call.reject("Erro inesperado ao conectar: ${e.javaClass.simpleName} ${e.message}")
            }
        }
    }

    @PluginMethod
    fun disconnect(call: PluginCall) {
        ioExecutor.execute {
            client?.disconnect()
            call.resolve(JSObject())
        }
    }

    /**
     * Descarta o cliente/transporte inteiro (não só desconecta) — usado como recuperação
     * quando uma impressão falha de um jeito que sugere socket Bluetooth num estado ruim
     * (ex.: trava, erro de I/O sem exceção clara). Forçar `client = null` garante que a
     * próxima connect() crie um BluetoothSocket totalmente novo, em vez de tentar "limpar" um
     * socket que pode estar corrompido — mais confiável do que qualquer reset parcial.
     */
    @PluginMethod
    fun resetConnection(call: PluginCall) {
        ioExecutor.execute {
            try {
                client?.disconnect()
            } catch (e: Throwable) {
                // Ignorado de propósito — o objetivo aqui é descartar o estado mesmo que o
                // disconnect() em si falhe (é exatamente esse tipo de estado que queremos sair).
            }
            client = null
            printBusy.set(false)
            call.resolve(JSObject())
        }
    }

    @PluginMethod
    fun isConnected(call: PluginCall) {
        val result = JSObject()
        result.put("connected", client?.isConnected() ?: false)
        call.resolve(result)
    }

    /**
     * "imagePath": caminho de arquivo (URI de arquivo já salvo pelo lado web, ver
     * Filesystem.writeFile no TS) — mesma convenção do PrintStudioPlugin, nunca base64 bruto.
     */
    @PluginMethod
    fun printLabel(call: PluginCall) {
        if (!printBusy.compareAndSet(false, true)) {
            call.reject("Já existe uma impressão em andamento — aguarde terminar")
            return
        }
        val imagePath = call.getString("imagePath")
        if (imagePath.isNullOrBlank()) {
            printBusy.set(false)
            call.reject("imagePath é obrigatório")
            return
        }
        val currentClient = client
        if (currentClient == null || !currentClient.isConnected()) {
            printBusy.set(false)
            call.reject("Impressora não conectada — chame connect() primeiro")
            return
        }
        val cleanPath = imagePath.removePrefix("file://")
        val file = File(cleanPath)
        if (!file.exists()) {
            printBusy.set(false)
            call.reject("Arquivo de imagem não encontrado: $cleanPath")
            return
        }
        val bitmap: Bitmap? = BitmapFactory.decodeFile(file.absolutePath)
        if (bitmap == null) {
            printBusy.set(false)
            call.reject("Não foi possível decodificar a imagem")
            return
        }
        val paperType = call.getInt("paperType") ?: 2
        val density = call.getInt("density") ?: 2
        ioExecutor.execute {
            try {
                val ok = currentClient.printLabel(bitmap, paperType, density)
                bitmap.recycle()
                val result = JSObject()
                result.put("sent", ok)
                if (ok) call.resolve(result) else call.reject("Falha ao enviar dados: ${currentClient.lastError()}")
            } catch (e: Throwable) {
                call.reject("Erro inesperado ao imprimir: ${e.javaClass.simpleName} ${e.message}")
            } finally {
                printBusy.set(false)
            }
        }
    }
}
