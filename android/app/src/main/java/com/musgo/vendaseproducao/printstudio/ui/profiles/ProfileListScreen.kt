package com.musgo.vendaseproducao.printstudio.ui.profiles

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.musgo.vendaseproducao.printstudio.data.ProfileRepository
import com.musgo.vendaseproducao.printstudio.data.ProfileSummary
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Lista de perfis salvos — só abre/exclui (sem renomear, fora do escopo da Fase 4). A tela
 * é "burra" de propósito: quem decide o que fazer com a seleção/exclusão é quem a chama
 * ([com.musgo.vendaseproducao.printstudio.ui.PrintStudioApp]), que é quem tem acesso ao
 * EditorViewModel pra carregar o layout escolhido. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileListScreen(
    repository: ProfileRepository,
    onProfileSelected: (id: Long, name: String) -> Unit,
    onNewProfile: () -> Unit,
    onBack: () -> Unit,
) {
    val summaries by repository.observeSummaries().collectAsState(initial = emptyList())
    val scope = rememberCoroutineScope()
    var pendingDelete by remember { mutableStateOf<ProfileSummary?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Meus Perfis") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "Voltar")
                    }
                },
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onNewProfile) {
                Icon(Icons.Filled.Add, contentDescription = "Novo perfil")
            }
        },
    ) { padding ->
        if (summaries.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize().padding(padding)) {
                Text(
                    text = "Nenhum perfil salvo ainda.",
                    modifier = Modifier.fillMaxWidth().padding(24.dp),
                )
            }
        } else {
            LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
                items(summaries, key = { it.id }) { summary ->
                    Card(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Column(
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable { onProfileSelected(summary.id, summary.name) },
                            ) {
                                Text(summary.name)
                                Text(formatUpdatedAt(summary.updatedAt))
                            }
                            IconButton(onClick = { pendingDelete = summary }) {
                                Icon(Icons.Filled.Delete, contentDescription = "Excluir perfil")
                            }
                        }
                    }
                }
            }
        }
    }

    pendingDelete?.let { toDelete ->
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = { Text("Excluir perfil") },
            text = { Text("Excluir \"${toDelete.name}\"? Essa ação não pode ser desfeita.") },
            confirmButton = {
                TextButton(onClick = {
                    scope.launch { repository.delete(toDelete.id) }
                    pendingDelete = null
                }) { Text("Excluir") }
            },
            dismissButton = {
                TextButton(onClick = { pendingDelete = null }) { Text("Cancelar") }
            },
        )
    }
}

private fun formatUpdatedAt(epochMillis: Long): String =
    SimpleDateFormat("dd/MM/yyyy HH:mm", Locale("pt", "BR")).format(Date(epochMillis))
