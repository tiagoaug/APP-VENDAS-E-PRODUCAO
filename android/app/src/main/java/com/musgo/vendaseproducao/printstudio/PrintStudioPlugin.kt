package com.musgo.vendaseproducao.printstudio

import android.content.Intent
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

const val EXTRA_INITIAL_IMAGES = "initial_images"

@CapacitorPlugin(name = "PrintStudio")
class PrintStudioPlugin : Plugin() {

    @PluginMethod
    fun open(call: PluginCall) {
        // "images": URIs já salvas em arquivo pelo lado web (Filesystem.writeFile, ver
        // src/lib/printStudio.ts) — não bytes/base64, pra não sobrecarregar a ponte
        // JS↔nativo com payloads grandes. Pré-carrega como blocos na primeira página.
        val images: List<String> = try {
            call.getArray("images")?.toList<String>() ?: emptyList()
        } catch (e: Exception) {
            emptyList()
        }

        val intent = Intent(context, PrintStudioActivity::class.java)
        if (images.isNotEmpty()) {
            intent.putExtra(EXTRA_INITIAL_IMAGES, images.toTypedArray())
        }
        activity.startActivity(intent)
        // Sem animação de transição — a animação padrão do sistema (slide/fade) deixava a
        // barra superior da WebView (MainActivity) visível por um instante por trás do
        // Print Studio durante a troca de tela.
        activity.overridePendingTransition(0, 0)
        call.resolve(JSObject())
    }
}
