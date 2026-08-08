package com.musgo.vendaseproducao.printstudio.printer.protocol

import android.graphics.Bitmap
import android.graphics.Color
import com.musgo.vendaseproducao.printstudio.printer.codec.JbigEncoder
import java.io.ByteArrayOutputStream

/**
 * Monta os bytes de impressão da Ablemark BR-L100, protocolo "X4" (a L100 é um alias do X4
 * no SDK oficial — confirmado no código decompilado do app AbleMark, classe
 * GlobalConstant.L110_BY_X4). Toda a estrutura de bytes abaixo foi reconstruída comparando,
 * byte a byte, uma captura HCI snoop real (impressão de teste pelo app oficial) com o
 * comportamento documentado do decompilado — não foi copiado código deles, só os valores de
 * bytes que resultam do protocolo (que não são protegidos por direito autoral, são dados de
 * interoperabilidade).
 *
 * IMPORTANTE: os 3 bytes finais (trailer) não bateram 100% na comparação inicial — validar
 * com uma impressão real antes de confiar em produção (ver JbigEncoder, mesmo aviso).
 */
object AbleMarkL100Protocol {

    // Densidade: mapeamento confirmado só pra density=2 (valor 9) via sniff; os demais seguem
    // o padrão observado no BaseProtocol decompilado (não confirmados por captura própria).
    private fun densityByte(density: Int): Byte = when (density) {
        1 -> 4
        2 -> 9
        3 -> 13
        else -> 10
    }.toByte()

    // paperType: só o valor 2 (marker=32) foi confirmado por captura real.
    private fun paperTypeCommand(paperType: Int): ByteArray? {
        val marker: Int = when (paperType) {
            1 -> 16
            2 -> 32
            3 -> 20   // não confirmado por captura
            4 -> 10   // não confirmado por captura
            else -> return null
        }
        return byteArrayOf(0x1F, 0x80.toByte(), 1, marker.toByte())
    }

    /**
     * Converte um Bitmap ARGB em 1bpp empacotado (MSB primeiro, 1 = preto). Fórmula de
     * luminância e limiar (135) confirmados no `BitmapUtils.convertBitmapToGrayBytes` do app
     * oficial decompilado — não é um valor arbitrário, é o que o app real usa antes de mandar
     * pro encoder JBIG.
     */
    private fun toPacked1bpp(bitmap: Bitmap): Triple<ByteArray, Int, Int> {
        val width = bitmap.width
        val height = bitmap.height
        val stride = if (width % 8 == 0) width / 8 else width / 8 + 1
        val packed = ByteArray(stride * height)
        val row = IntArray(width)
        for (y in 0 until height) {
            bitmap.getPixels(row, 0, width, 0, y, width, 1)
            for (x in 0 until width) {
                val p = row[x]
                val luminance = Color.red(p) * 0.3 + Color.green(p) * 0.59 + Color.blue(p) * 0.11
                if (luminance < 135) {
                    val byteIndex = y * stride + (x ushr 3)
                    val bit = 7 - (x and 7)
                    packed[byteIndex] = (packed[byteIndex].toInt() or (1 shl bit)).toByte()
                }
            }
        }
        return Triple(packed, stride, height)
    }

    private fun header(jbigLen: Int, width: Int, height: Int): ByteArray {
        // height2 = (altura/8) / ((tamanhoJbig/1024)/256) — fórmula exata do X4Protocol.getHeader
        // decompilado; função ainda não totalmente entendida (parece uma normalização ligada à
        // taxa de compressão), mas reproduz os bytes vistos na captura real.
        val height2 = ((height / 8.0f) / ((jbigLen / 1024.0f) / 256.0f)).toInt()
        val b8 = (height2 and 0xFF).toByte()
        val b9 = ((height2 ushr 8) and 0xFF).toByte()
        val lenLo = (jbigLen and 0xFF).toByte()
        val lenHi = ((jbigLen ushr 8) and 0xFF).toByte()
        val widthLo = (width and 0xFF).toByte()
        val widthHi = ((width ushr 8) and 0xFF).toByte()
        val heightByte = (height and 0xFF).toByte()
        return byteArrayOf(
            0x1F, 40, 115, 2, 0, b8, b9,
            0x1D, 87, 32, 3,
            0x1B, 97, 1,
            0x1A, 12, 0xFF.toByte(),
            0x1F, 40, 74,
            lenLo, lenHi, widthLo, widthHi, heightByte
        )
    }

    private fun trailer(paperType: Int): ByteArray =
        if (paperType == 4) byteArrayOf(0x1D, 12) else byteArrayOf(0x1A, 12, 0)

    /**
     * Monta o pacote completo de impressão pra uma etiqueta.
     * @param paperType 2 = confirmado por captura real (etiqueta com gap). Outros valores não
     *   testados no hardware ainda.
     * @param density 1..3 (padrão 2, único valor confirmado por captura).
     */
    fun buildPrintJob(bitmap: Bitmap, paperType: Int = 2, density: Int = 2): ByteArray {
        val (packed, stride, height) = toPacked1bpp(bitmap)
        val jbig = JbigEncoder.encodeBie(packed, bitmap.width, height, stride)

        val out = ByteArrayOutputStream()
        paperTypeCommand(paperType)?.let { out.write(it) }
        out.write(byteArrayOf(18, 35, densityByte(density)))
        out.write(header(jbig.size, bitmap.width, height))
        out.write(jbig)
        out.write(trailer(paperType))
        return out.toByteArray()
    }
}
