package com.musgo.vendaseproducao.printstudio.ui

import android.content.Context
import android.print.PrintAttributes
import android.print.PrintManager
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import com.musgo.vendaseproducao.printstudio.data.ProfileRepository
import com.musgo.vendaseproducao.printstudio.data.db.PrintStudioDatabase
import com.musgo.vendaseproducao.printstudio.data.findMissingImageBlockIds
import com.musgo.vendaseproducao.printstudio.print.PrintStudioPrintAdapter
import com.musgo.vendaseproducao.printstudio.ui.preview.PreviewScreen
import com.musgo.vendaseproducao.printstudio.ui.profiles.ProfileListScreen
import kotlinx.coroutines.launch

private sealed class PrintStudioScreen {
    data object Editor : PrintStudioScreen()
    data object Profiles : PrintStudioScreen()
    data object Preview : PrintStudioScreen()
}

/** Orquestra a navegação entre as telas nativas do Print Studio (sem Navigation-Compose —
 * o app tem só 2-3 telas, uma troca simples de estado já basta). O EditorViewModel é criado
 * UMA VEZ aqui (não dentro de EditorScreen) pra sobreviver à ida-e-volta até a tela de
 * Perfis sem perder o que está em edição. */
@Composable
fun PrintStudioApp(
    initialImages: List<String> = emptyList(),
    onPickImage: (onPicked: (uri: String) -> Unit) -> Unit,
    onClose: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val repository = remember { ProfileRepository(PrintStudioDatabase.getInstance(context).profileDao()) }
    val editorViewModel: EditorViewModel = viewModel()
    var screen by remember { mutableStateOf<PrintStudioScreen>(PrintStudioScreen.Editor) }

    // key fixa (Unit) = roda só na primeira composição, nunca de novo em recomposições —
    // sem isso, as imagens da OS/pedido/mapa de origem seriam re-adicionadas a cada
    // recomposição (ex.: ao digitar nos campos de papel) em vez de só uma vez ao abrir.
    LaunchedEffect(Unit) {
        if (initialImages.isNotEmpty()) {
            val pageId = editorViewModel.layout.value.pages.first().id
            editorViewModel.addImageBlocks(initialImages, pageId)
        }
    }

    when (screen) {
        is PrintStudioScreen.Editor -> EditorScreen(
            viewModel = editorViewModel,
            onPickImage = onPickImage,
            onClose = onClose,
            onOpenProfiles = { screen = PrintStudioScreen.Profiles },
            onSave = { name ->
                scope.launch {
                    val id = repository.save(editorViewModel.currentProfileId.value, name, editorViewModel.layout.value)
                    editorViewModel.markSaved(id, name)
                }
            },
            onPreview = { screen = PrintStudioScreen.Preview },
        )

        is PrintStudioScreen.Profiles -> ProfileListScreen(
            repository = repository,
            onProfileSelected = { id, name ->
                scope.launch {
                    val layout = repository.getLayout(id)
                    if (layout != null) {
                        val missing = findMissingImageBlockIds(context.contentResolver, layout)
                        editorViewModel.loadLayout(layout, id, name, missing)
                    }
                    screen = PrintStudioScreen.Editor
                }
            },
            onNewProfile = {
                editorViewModel.newLayout()
                screen = PrintStudioScreen.Editor
            },
            onBack = { screen = PrintStudioScreen.Editor },
        )

        is PrintStudioScreen.Preview -> {
            val layout by editorViewModel.layout.collectAsState()
            PreviewScreen(
                layout = layout,
                onBack = { screen = PrintStudioScreen.Editor },
                onPrint = {
                    val printManager = context.getSystemService(Context.PRINT_SERVICE) as PrintManager
                    val profileName = editorViewModel.currentProfileName.value ?: "Print Studio"
                    printManager.print(profileName, PrintStudioPrintAdapter(context, layout), PrintAttributes.Builder().build())
                },
            )
        }
    }
}
