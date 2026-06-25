package com.musgo.vendaseproducao.printstudio.model

import android.content.ContentResolver
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

/** Resultado de separar um bloco em dois — usado quando uma linha de corte atravessa o
 * bloco e o usuário pede pra dividi-lo em dois blocos independentes (cada um pode então
 * ser movido pra uma página diferente, ver EditorViewModel.moveBlockToPage). É um recorte
 * real do bitmap (não só um redimensionamento da caixa do bloco) — cada metade vira um
 * arquivo novo no cache; o arquivo original nunca é sobrescrito. */
data class ImageSplitResult(val firstImageUri: String, val secondImageUri: String)

/** [fraction] é a posição relativa do corte dentro do bloco (0 a 1) — já calculada pelo
 * chamador a partir da posição em mm da linha de corte. `isVertical` decide se o corte é
 * left/right (linha vertical) ou top/bottom (linha horizontal). Roda em Dispatchers.IO —
 * decodificar/recortar/gravar um bitmap de ficha em resolução real não é instantâneo. */
suspend fun splitImageAtFraction(
    contentResolver: ContentResolver,
    cacheDir: File,
    imageUri: String,
    isVertical: Boolean,
    fraction: Float,
): ImageSplitResult? = withContext(Dispatchers.IO) {
    val clampedFraction = fraction.coerceIn(0.02f, 0.98f)
    val source = try {
        contentResolver.openInputStream(Uri.parse(imageUri))?.use { stream -> BitmapFactory.decodeStream(stream) }
    } catch (e: Exception) {
        null
    } ?: return@withContext null

    val (first, second) = if (isVertical) {
        val splitX = (source.width * clampedFraction).toInt().coerceIn(1, source.width - 1)
        val left = Bitmap.createBitmap(source, 0, 0, splitX, source.height)
        val right = Bitmap.createBitmap(source, splitX, 0, source.width - splitX, source.height)
        left to right
    } else {
        val splitY = (source.height * clampedFraction).toInt().coerceIn(1, source.height - 1)
        val top = Bitmap.createBitmap(source, 0, 0, source.width, splitY)
        val bottom = Bitmap.createBitmap(source, 0, splitY, source.width, source.height - splitY)
        top to bottom
    }

    ImageSplitResult(saveBitmapToCache(cacheDir, first), saveBitmapToCache(cacheDir, second))
}

private fun saveBitmapToCache(cacheDir: File, bitmap: Bitmap): String {
    val file = File(cacheDir, "print_studio_split_${UUID.randomUUID()}.jpg")
    FileOutputStream(file).use { out -> bitmap.compress(Bitmap.CompressFormat.JPEG, 92, out) }
    return Uri.fromFile(file).toString()
}
