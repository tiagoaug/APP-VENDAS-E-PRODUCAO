package com.musgo.vendaseproducao.printstudio

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import com.musgo.vendaseproducao.printstudio.ui.PrintStudioApp
import com.musgo.vendaseproducao.printstudio.ui.theme.PrintStudioTheme

class PrintStudioActivity : ComponentActivity() {

    // Callback "pendente" setado pela tela no momento em que pede pra importar uma imagem —
    // precisa viver na Activity porque é aqui que o ActivityResultLauncher tem que ser
    // registrado (antes da Activity chegar a STARTED), não dentro do Composable.
    private var onImagePicked: ((String) -> Unit)? = null

    private val pickImageLauncher = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            // OpenDocument (não GetContent) é o que permite essa permissão persistente — a
            // URI fica salva dentro do layout do perfil e precisa continuar legível depois
            // de reiniciar o app/aparelho.
            contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            onImagePicked?.invoke(uri.toString())
        }
        onImagePicked = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val initialImages = intent.getStringArrayExtra(EXTRA_INITIAL_IMAGES)?.toList() ?: emptyList()
        setContent {
            PrintStudioTheme {
                PrintStudioApp(
                    initialImages = initialImages,
                    onPickImage = { callback ->
                        onImagePicked = callback
                        pickImageLauncher.launch(arrayOf("image/*"))
                    },
                    onClose = {
                        finish()
                        // Mesmo motivo do overridePendingTransition em PrintStudioPlugin.open —
                        // sem isso, a animação padrão de saída deixa a WebView (MainActivity)
                        // visível por baixo por um instante ao fechar o Print Studio.
                        overridePendingTransition(0, 0)
                    },
                )
            }
        }
    }
}
