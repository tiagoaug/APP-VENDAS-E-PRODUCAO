package com.musgo.vendaseproducao.printstudio.data

import android.content.ContentResolver
import android.net.Uri
import com.musgo.vendaseproducao.printstudio.model.PrintLayout
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Verifica, para cada bloco do layout carregado, se a imagem ainda está acessível (permissão
 * de URI revogada, arquivo apagado, etc.) — retorna os ids dos blocos cuja imagem NÃO abre.
 * Não altera o [PrintLayout] (a flag de "ausente" é um fato de sessão, não do perfil salvo —
 * ver EditorViewModel.loadLayout). */
suspend fun findMissingImageBlockIds(contentResolver: ContentResolver, layout: PrintLayout): Set<String> =
    withContext(Dispatchers.IO) {
        val missing = mutableSetOf<String>()
        layout.pages.forEach { page ->
            page.blocks.forEach { block ->
                val accessible = try {
                    contentResolver.openInputStream(Uri.parse(block.imageUri))?.use { true } ?: false
                } catch (e: Exception) {
                    false
                }
                if (!accessible) missing += block.id
            }
        }
        missing
    }
