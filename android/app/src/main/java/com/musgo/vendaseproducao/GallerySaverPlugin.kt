package com.musgo.vendaseproducao

import android.content.ContentValues
import android.os.Build
import android.provider.MediaStore
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.io.FileInputStream

/**
 * Salva uma imagem (já escrita em disco pelo lado web, via Filesystem.writeFile) na galeria do
 * Android usando MediaStore — funciona sem nenhuma permissão em Android 10+ (API 29+, storage
 * com escopo) já que o app só está inserindo um arquivo próprio, não lendo/escrevendo fora do
 * que criou. Em Android 9 (API 28) e abaixo, cai no caminho legado (File direto em
 * Pictures/), que depende da permissão WRITE_EXTERNAL_STORAGE (maxSdkVersion=28 no Manifest).
 */
@CapacitorPlugin(name = "GallerySaver")
class GallerySaverPlugin : Plugin() {

    @PluginMethod
    fun saveImage(call: PluginCall) {
        val path = call.getString("path")
        if (path.isNullOrBlank()) {
            call.reject("path é obrigatório")
            return
        }
        val albumName = call.getString("album") ?: "LIM.O APP"
        val cleanPath = path.removePrefix("file://")
        val sourceFile = File(cleanPath)
        if (!sourceFile.exists()) {
            call.reject("Arquivo não encontrado: $cleanPath")
            return
        }
        try {
            val fileName = "etiqueta_${System.currentTimeMillis()}.png"
            val resolver = context.contentResolver
            val values = ContentValues().apply {
                put(MediaStore.Images.Media.DISPLAY_NAME, fileName)
                put(MediaStore.Images.Media.MIME_TYPE, "image/png")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/$albumName")
                    put(MediaStore.Images.Media.IS_PENDING, 1)
                }
            }
            val collection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
            } else {
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI
            }
            val uri = resolver.insert(collection, values)
                ?: throw IllegalStateException("Não foi possível criar entrada no MediaStore")

            resolver.openOutputStream(uri)?.use { out ->
                FileInputStream(sourceFile).use { input -> input.copyTo(out) }
            } ?: throw IllegalStateException("Não foi possível abrir stream de escrita")

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.clear()
                values.put(MediaStore.Images.Media.IS_PENDING, 0)
                resolver.update(uri, values, null, null)
            }

            val result = JSObject()
            result.put("saved", true)
            result.put("uri", uri.toString())
            call.resolve(result)
        } catch (e: Exception) {
            call.reject("Erro ao salvar na galeria: ${e.javaClass.simpleName} ${e.message}")
        }
    }
}
