package com.musgo.vendaseproducao.printstudio.printer2.codec

import java.io.ByteArrayOutputStream

/**
 * Codificador JBIG (ITU-T T.82) "generic region" — implementado do zero seguindo, passo a
 * passo, os fluxogramas normativos do Anexo D ("Arithmetic coding") da ITU-T T.81/ISO IEC
 * 10918-1 (o mesmo codificador aritmético QM-coder é compartilhado por T.81/T.82 — ver D.1 do
 * texto público do padrão, hospedado em w3.org/Graphics/JPEG/itu-t81.pdf). NÃO deriva de
 * código da jbigkit (GPL) nem de nenhum wrapper de terceiros — só reproduz os procedimentos e
 * a tabela de estados Qe normativos (Table D.3), que são parte da especificação pública, não
 * de uma implementação com direitos autorais de terceiros.
 *
 * Primeira versão desta classe tinha um bug confirmado em hardware real (Ablemark BR-L100):
 * a troca condicional MPS/LPS (D.1.4) estava incorreta, causando renormalizações em excesso e
 * uma explosão de ~400x no tamanho da saída. Esta versão segue os fluxogramas Figure D.1–D.14
 * exatamente como publicados.
 */
object JbigEncoder2 {

    // Table D.3 — Qe values and probability estimation state machine (113 entradas, índice,
    // Qe_Value, Next_Index_LPS, Next_Index_MPS, Switch_MPS). Tabela normativa do padrão —
    // diferente (maior e com valores distintos) da tabela de 47 estados do MQ-coder mais
    // recente usado em JBIG2/JPEG2000, que não se aplica aqui.
    private data class QeEntry(val qe: Int, val nlps: Int, val nmps: Int, val switchMps: Int)

    private val QE_TABLE = arrayOf(
        QeEntry(0x5A1D, 1, 1, 1), QeEntry(0x2586, 14, 2, 0), QeEntry(0x1114, 16, 3, 0),
        QeEntry(0x080B, 18, 4, 0), QeEntry(0x03D8, 20, 5, 0), QeEntry(0x01DA, 23, 6, 0),
        QeEntry(0x00E5, 25, 7, 0), QeEntry(0x006F, 28, 8, 0), QeEntry(0x0036, 30, 9, 0),
        QeEntry(0x001A, 33, 10, 0), QeEntry(0x000D, 35, 11, 0), QeEntry(0x0006, 9, 12, 0),
        QeEntry(0x0003, 10, 13, 0), QeEntry(0x0001, 12, 13, 0), QeEntry(0x5A7F, 15, 15, 1),
        QeEntry(0x3F25, 36, 16, 0), QeEntry(0x2CF2, 38, 17, 0), QeEntry(0x207C, 39, 18, 0),
        QeEntry(0x17B9, 40, 19, 0), QeEntry(0x1182, 42, 20, 0), QeEntry(0x0CEF, 43, 21, 0),
        QeEntry(0x09A1, 45, 22, 0), QeEntry(0x072F, 46, 23, 0), QeEntry(0x055C, 48, 24, 0),
        QeEntry(0x0406, 49, 25, 0), QeEntry(0x0303, 51, 26, 0), QeEntry(0x0240, 52, 27, 0),
        QeEntry(0x01B1, 54, 28, 0), QeEntry(0x0144, 56, 29, 0), QeEntry(0x00F5, 57, 30, 0),
        QeEntry(0x00B7, 59, 31, 0), QeEntry(0x008A, 60, 32, 0), QeEntry(0x0068, 62, 33, 0),
        QeEntry(0x004E, 63, 34, 0), QeEntry(0x003B, 32, 35, 0), QeEntry(0x002C, 33, 9, 0),
        QeEntry(0x5AE1, 37, 37, 1), QeEntry(0x484C, 64, 38, 0), QeEntry(0x3A0D, 65, 39, 0),
        QeEntry(0x2EF1, 67, 40, 0), QeEntry(0x261F, 68, 41, 0), QeEntry(0x1F33, 69, 42, 0),
        QeEntry(0x19A8, 70, 43, 0), QeEntry(0x1518, 72, 44, 0), QeEntry(0x1177, 73, 45, 0),
        QeEntry(0x0E74, 74, 46, 0), QeEntry(0x0BFB, 75, 47, 0), QeEntry(0x09F8, 77, 48, 0),
        QeEntry(0x0861, 78, 49, 0), QeEntry(0x0706, 79, 50, 0), QeEntry(0x05CD, 48, 51, 0),
        QeEntry(0x04DE, 50, 52, 0), QeEntry(0x040F, 50, 53, 0), QeEntry(0x0363, 51, 54, 0),
        QeEntry(0x02D4, 52, 55, 0), QeEntry(0x025C, 53, 56, 0), QeEntry(0x01F8, 54, 57, 0),
        QeEntry(0x01A4, 55, 58, 0), QeEntry(0x0160, 56, 59, 0), QeEntry(0x0125, 57, 60, 0),
        QeEntry(0x00F6, 58, 61, 0), QeEntry(0x00CB, 59, 62, 0), QeEntry(0x00AB, 61, 63, 0),
        QeEntry(0x008F, 61, 32, 0), QeEntry(0x5B12, 65, 65, 1), QeEntry(0x4D04, 80, 66, 0),
        QeEntry(0x412C, 81, 67, 0), QeEntry(0x37D8, 82, 68, 0), QeEntry(0x2FE8, 83, 69, 0),
        QeEntry(0x293C, 84, 70, 0), QeEntry(0x2379, 86, 71, 0), QeEntry(0x1EDF, 87, 72, 0),
        QeEntry(0x1AA9, 87, 73, 0), QeEntry(0x174E, 72, 74, 0), QeEntry(0x1424, 72, 75, 0),
        QeEntry(0x119C, 74, 76, 0), QeEntry(0x0F6B, 74, 77, 0), QeEntry(0x0D51, 75, 78, 0),
        QeEntry(0x0BB6, 77, 79, 0), QeEntry(0x0A40, 77, 48, 0), QeEntry(0x5832, 80, 81, 1),
        QeEntry(0x4D1C, 88, 82, 0), QeEntry(0x438E, 89, 83, 0), QeEntry(0x3BDD, 90, 84, 0),
        QeEntry(0x34EE, 91, 85, 0), QeEntry(0x2EAE, 92, 86, 0), QeEntry(0x299A, 93, 87, 0),
        QeEntry(0x2516, 86, 71, 0), QeEntry(0x5570, 88, 89, 1), QeEntry(0x4CA9, 95, 90, 0),
        QeEntry(0x44D9, 96, 91, 0), QeEntry(0x3E22, 97, 92, 0), QeEntry(0x3824, 99, 93, 0),
        QeEntry(0x32B4, 99, 94, 0), QeEntry(0x2E17, 93, 86, 0), QeEntry(0x56A8, 95, 96, 1),
        QeEntry(0x4F46, 101, 97, 0), QeEntry(0x47E5, 102, 98, 0), QeEntry(0x41CF, 103, 99, 0),
        QeEntry(0x3C3D, 104, 100, 0), QeEntry(0x375E, 99, 93, 0), QeEntry(0x5231, 105, 102, 0),
        QeEntry(0x4C0F, 106, 103, 0), QeEntry(0x4639, 107, 104, 0), QeEntry(0x415E, 103, 99, 0),
        QeEntry(0x5627, 105, 106, 1), QeEntry(0x50E7, 108, 107, 0), QeEntry(0x4B85, 109, 103, 0),
        QeEntry(0x5597, 110, 109, 0), QeEntry(0x504F, 111, 107, 0), QeEntry(0x5A10, 110, 111, 1),
        QeEntry(0x5522, 112, 109, 0), QeEntry(0x59EB, 112, 111, 1)
    )

    private class ContextState {
        var index = 0
        var mps = 0
    }

    /** Codificador aritmético — estado e procedimentos do encoder (D.1.3–D.1.8). */
    private class ArithEncoder {
        private var a = 0
        private var c = 0L
        private var ct = 0
        private var st = 0L
        // Buffer de saída — bp = -1 significa "nenhum byte real escrito ainda" (equivalente a
        // BP = BPST - 1 do padrão). out[bp] corresponde a "B" nos fluxogramas.
        private val out = ArrayList<Int>()
        private var bp = -1

        fun initEnc() {
            a = 0x10000
            c = 0L
            ct = 11
            st = 0L
            out.clear()
            bp = -1
        }

        private fun setB(v: Int) {
            if (bp == out.size) out.add(v and 0xFF) else out[bp] = v and 0xFF
        }

        private fun getB(): Int = if (bp in out.indices) out[bp] else 0

        // Figure D.9 — Output_stacked_zeros
        private fun outputStackedZeros() {
            while (st != 0L) {
                bp++; setB(0)
                st--
            }
        }

        // Figure D.10 — Output_stacked_X'FF's
        private fun outputStackedFFs() {
            while (st != 0L) {
                bp++; setB(0xFF)
                bp++; setB(0)
                st--
            }
        }

        // Figure D.11 — Stuff_0
        private fun stuff0() {
            if (getB() == 0xFF) {
                bp++; setB(0)
            }
        }

        // Figure D.8 — Byte_out
        private fun byteOut() {
            val t = (c ushr 19)
            if (t > 0xFF) {
                setB(getB() + 1)
                stuff0()
                outputStackedZeros()
                bp++; setB((t and 0xFF).toInt())
            } else {
                if (t == 0xFFL) {
                    st++
                } else {
                    outputStackedFFs()
                    bp++; setB(t.toInt())
                }
            }
            c = c and 0x7FFFFL
        }

        // Figure D.7 — Renorm_e
        private fun renormE() {
            do {
                a = a shl 1
                c = c shl 1
                ct--
                if (ct == 0) {
                    byteOut()
                    ct = 8
                }
            } while ((a and 0x8000) == 0)
        }

        // Figure D.5 — Estimate_Qe(S)_after_MPS
        private fun estimateAfterMps(cx: ContextState) {
            cx.index = QE_TABLE[cx.index].nmps
        }

        // Figure D.6 — Estimate_Qe(S)_after_LPS
        private fun estimateAfterLps(cx: ContextState) {
            val entry = QE_TABLE[cx.index]
            if (entry.switchMps == 1) cx.mps = 1 - cx.mps
            cx.index = entry.nlps
        }

        // Figure D.4 — Code_MPS(S), com troca condicional MPS/LPS
        private fun codeMps(cx: ContextState) {
            val qe = QE_TABLE[cx.index].qe
            a -= qe
            if ((a and 0x8000) == 0) {
                if (a < qe) {
                    c += a
                    a = qe
                }
                // else: a >= qe -> nenhuma troca, A permanece reduzido (a - qe já aplicado)
                estimateAfterMps(cx)
                renormE()
            }
            // else: a >= 0x8000, nada a fazer (sem renormalização)
        }

        // Figure D.3 — Code_LPS(S), com troca condicional MPS/LPS (sempre renormaliza)
        private fun codeLps(cx: ContextState) {
            val qe = QE_TABLE[cx.index].qe
            a -= qe
            if (a < qe) {
                // troca: A já contém o valor reduzido correto, C não muda
            } else {
                c += a
                a = qe
            }
            estimateAfterLps(cx)
            renormE()
        }

        /** Code_0(S) / Code_1(S) (Figures D.1/D.2) — codifica o bit usando o contexto cx. */
        fun encode(cx: ContextState, bit: Int) {
            if (bit == cx.mps) codeMps(cx) else codeLps(cx)
        }

        // Figure D.14 — Clear_final_bits (chamado por Flush)
        private fun clearFinalBits() {
            var t = (c + a - 1) and 0xFFFFFFFFL
            t = t and 0xFFFF0000L
            if (t < c) t += 0x8000L
            c = t
        }

        // Figure D.13 — Flush (sem Discard_final_zeros: o protocolo já declara o tamanho
        // exato dos dados JBIG no cabeçalho, então bytes finais redundantes não atrapalham).
        fun flush(): ByteArray {
            clearFinalBits()
            c = c shl ct
            byteOut()
            c = c shl 8
            byteOut()
            return ByteArray(out.size) { out[it].toByte() }
        }
    }

    /**
     * Codifica um bitmap 1bpp (empacotado, MSB primeiro, 1 = preto) como "generic region"
     * JBIG template 0. `stride` é o número de bytes por linha (tipicamente ceil(width/8)).
     */
    fun encodeGenericRegion(packed: ByteArray, width: Int, height: Int, stride: Int): ByteArray {
        fun getPixel(x: Int, y: Int): Int {
            if (x < 0 || x >= width || y < 0) return 0
            val byteIndex = y * stride + (x ushr 3)
            if (byteIndex >= packed.size) return 0
            val bit = 7 - (x and 7)
            return (packed[byteIndex].toInt() ushr bit) and 1
        }

        // Template padrão (Figure 14 do T.82, "Three-line model template") — 9 pixels fixos +
        // 1 pixel adaptativo AT1 na posição default (+2,-1), total 10 bits de contexto (1024
        // estados). Confirmado direto na figura do padrão — versão anterior tinha um pixel
        // extra inventado (11 bits, AT em +3,-1) que não existe no template real.
        val contexts = Array(1 shl 10) { ContextState() }
        val enc = ArithEncoder()
        enc.initEnc()

        for (y in 0 until height) {
            for (x in 0 until width) {
                val ctx =
                    (getPixel(x - 1, y - 2) shl 9) or
                    (getPixel(x, y - 2) shl 8) or
                    (getPixel(x + 1, y - 2) shl 7) or
                    (getPixel(x - 2, y - 1) shl 6) or
                    (getPixel(x - 1, y - 1) shl 5) or
                    (getPixel(x, y - 1) shl 4) or
                    (getPixel(x + 1, y - 1) shl 3) or
                    (getPixel(x + 2, y - 1) shl 2) or  // AT1 (posição default)
                    (getPixel(x - 2, y) shl 1) or
                    getPixel(x - 1, y)

                enc.encode(contexts[ctx], getPixel(x, y))
            }
        }

        return enc.flush()
    }

    /**
     * Monta uma BIE (Bi-level Image Entity) completa — BIH de 20 bytes + dado da região
     * genérica + terminador de stripe (ESC + SDNORM) — formato normativo do T.82 §6.2
     * ("Bi-level image entity and header", Table 6/Table 12), lido direto do texto público do
     * padrão (T-REC-T.82).
     *
     * Faltava esse envelope: comparando com o app oficial decompilado, `getData()` deles não
     * manda os bytes aritméticos crus pro protocolo X4 — o `encodeV2()` é uma chamada JNI pra
     * `libjbigkit.so` (a implementação de referência, GPL, que só usamos aqui como
     * documentação/formato, não como código copiado), que devolve essa BIE completa. Sem o
     * BIH, um decodificador conforme ao padrão não sabe onde a imagem começa (dimensões,
     * layers, stripes) nem onde termina — o que bate com o sintoma observado (impressora não
     * responde nada, só ignora o job).
     *
     * Parâmetros escolhidos (todos declarados no Options byte, todos "desligados"): imagem de
     * layer única (DL=D=0, sem modo progressivo), 1 bit-plane, 1 stripe cobrindo a imagem
     * inteira (L0 = height — evita ter que fatiar/repetir terminadores por stripe), sem
     * TPBON/TPDON/DPON — esses são atalhos de compressão opcionais que o encoder acima não
     * implementa, então declarar Options=0 informa ao decodificador pra não esperar por eles
     * (fica menos comprimido que o jbigkit real, mas continua 100% válido pelo padrão).
     */
    fun encodeBie(packed: ByteArray, width: Int, height: Int, stride: Int): ByteArray {
        val pscd = encodeGenericRegion(packed, width, height, stride)

        val bih = ByteArray(20)
        bih[2] = 1 // P: 1 bit-plane
        writeUInt32BE(bih, 4, width)   // XD
        writeUInt32BE(bih, 8, height)  // YD
        writeUInt32BE(bih, 12, height) // L0: uma stripe só
        bih[16] = 8 // MX (padrão, sem efeito — não usamos ATMOVE)
        // bih[17] MY, bih[18] Order, bih[19] Options: todos 0

        val out = ByteArrayOutputStream()
        out.write(bih)
        out.write(pscd)
        out.write(0xFF) // ESC
        out.write(0x02) // SDNORM — fim de stripe, estado preservado (irrelevante com 1 stripe só)
        return out.toByteArray()
    }

    private fun writeUInt32BE(arr: ByteArray, offset: Int, value: Int) {
        arr[offset] = ((value ushr 24) and 0xFF).toByte()
        arr[offset + 1] = ((value ushr 16) and 0xFF).toByte()
        arr[offset + 2] = ((value ushr 8) and 0xFF).toByte()
        arr[offset + 3] = (value and 0xFF).toByte()
    }
}
