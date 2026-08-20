package com.musgo.vendaseproducao.printstudio.printer2.protocol

import android.graphics.Bitmap
import android.graphics.Color
import com.musgo.vendaseproducao.printstudio.printer2.codec.JbigEncoder2
import java.io.ByteArrayOutputStream

/**
 * Segundo módulo Ablemark BR-L100 — reconstrução independente do protocolo "X4"/L100 (ver
 * printstudio/printer/protocol/AbleMarkL100Protocol.kt pro módulo original), criado depois de
 * uma regressão de dias inteiros parada: etiquetas passaram a sair só com bipe (nada impresso)
 * ou com caracteres corrompidos, mesmo com os dados enviados sempre decodificando perfeitos
 * (verificado byte a byte contra um decodificador JBIG fiel à especificação, inclusive
 * decodificando com sucesso a captura real do app oficial da Ablemark).
 *
 * CAUSA RAIZ CONFIRMADA EM HARDWARE REAL (2026-08-19): o campo de altura no cabeçalho precisa
 * ser SEMPRE exatamente 1 byte — mesmo quando a altura real não cabe nele (ex.: 320px numa
 * etiqueta 100x40mm a 8dots/mm vira 320 & 0xFF = 64, truncado, e mesmo assim imprime certo).
 * A firmware da impressora aparentemente usa a altura real de dentro dos próprios dados JBIG
 * (BIH, sempre 4 bytes, nunca trunca) pra saber o tamanho da imagem — o byte de altura aqui
 * fora só precisa ter a CONTAGEM certa de bytes pra não desalinhar o resto do pacote. A
 * "correção" de 2026-08-15 no módulo original (trocar pra 2 bytes de altura, achando que
 * corrigia truncamento em etiquetas rotacionadas) empurrou o início dos dados JBIG uma posição
 * a mais no pacote pra QUALQUER etiqueta que precisasse dos 2 bytes — a impressora, esperando
 * um cabeçalho de tamanho fixo, começava a ler a imagem 1 byte adiantada, corrompendo a
 * decodificação inteira a partir dali. Confirmado testando ao vivo: com altura sempre em 2
 * bytes → falha; com altura sempre em 1 byte (mesmo truncando etiquetas grandes) → imprime
 * normalmente, em 75x24mm e 100x40mm.
 *
 * NÃO reintroduza o formato de 2 bytes aqui, mesmo que pareça "mais correto" no papel — já foi
 * tentado e comprovadamente quebra a impressão real.
 */
object AbleMarkL100Protocol2 {

    private fun densityByte(density: Int): Byte = when (density) {
        1 -> 4
        2 -> 9
        3 -> 13
        else -> 10
    }.toByte()

    private fun paperTypeCommand(paperType: Int): ByteArray? {
        val marker: Int = when (paperType) {
            1 -> 16
            2 -> 32
            3 -> 20
            4 -> 10
            else -> return null
        }
        return byteArrayOf(0x1F, 0x80.toByte(), 1, marker.toByte())
    }

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

    /**
     * ██ NÃO MUDE ISTO PRA 2 BYTES. NÃO TORNE CONDICIONAL. NÃO "CORRIJA" TRUNCAMENTO. ██
     *
     * Devolve SEMPRE 1 byte (`height and 0xFF`), mesmo truncando etiquetas com altura > 255px.
     * Isso já foi "corrigido" pra 2 bytes little-endian uma vez (2026-08-15, no módulo
     * original) achando que consertava rotação — na prática quebrou TODA impressão (bipe sem
     * sair nada, ou caracteres corrompidos) porque desalinha por 1 byte o início dos dados JBIG
     * que vêm logo depois no pacote. A impressora não usa este byte pra saber a altura real da
     * imagem (isso vem de dentro do JBIG, no BIH, que é sempre 4 bytes corretos) — ele só
     * precisa ocupar a MESMA quantidade fixa de bytes que a firmware espera nessa posição.
     * Confirmado ao vivo em hardware real, duas vezes, em 75x24mm e 100x40mm — ver
     * project_ablemark_printer.md na memória e o cabeçalho deste arquivo pro histórico
     * completo. Se etiquetas rotacionadas/grandes precisarem de outro ajuste no futuro, a
     * correção tem que estar em outro lugar — NÃO no número de bytes deste campo.
     */
    private fun headerHeightByte(height: Int): ByteArray = byteArrayOf((height and 0xFF).toByte())

    private fun header(jbigLen: Int, width: Int, height: Int): ByteArray {
        val height2 = ((height / 8.0f) / ((jbigLen / 1024.0f) / 256.0f)).toInt()
        val b8 = (height2 and 0xFF).toByte()
        val b9 = ((height2 ushr 8) and 0xFF).toByte()
        val lenLo = (jbigLen and 0xFF).toByte()
        val lenHi = ((jbigLen ushr 8) and 0xFF).toByte()
        val widthLo = (width and 0xFF).toByte()
        val widthHi = ((width ushr 8) and 0xFF).toByte()

        val out = ByteArrayOutputStream()
        out.write(byteArrayOf(0x1F, 40, 115, 2, 0, b8, b9))
        out.write(byteArrayOf(0x1D, 87, 32, 3))
        out.write(byteArrayOf(0x1B, 97, 1))
        out.write(byteArrayOf(0x1A, 12, 0xFF.toByte()))
        out.write(byteArrayOf(0x1F, 40, 74))
        out.write(byteArrayOf(lenLo, lenHi, widthLo, widthHi))
        out.write(headerHeightByte(height))
        return out.toByteArray()
    }

    private fun trailer(paperType: Int): ByteArray =
        if (paperType == 4) byteArrayOf(0x1D, 12) else byteArrayOf(0x1A, 12, 0)

    fun buildPrintJob(bitmap: Bitmap, paperType: Int = 2, density: Int = 2): ByteArray {
        val (packed, stride, height) = toPacked1bpp(bitmap)
        val jbig = JbigEncoder2.encodeBie(packed, bitmap.width, height, stride)

        val out = ByteArrayOutputStream()
        paperTypeCommand(paperType)?.let { out.write(it) }
        out.write(byteArrayOf(18, 35, densityByte(density)))
        out.write(header(jbig.size, bitmap.width, height))
        out.write(jbig)
        out.write(trailer(paperType))
        return out.toByteArray()
    }
}
