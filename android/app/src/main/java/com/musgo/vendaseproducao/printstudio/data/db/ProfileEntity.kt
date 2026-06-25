package com.musgo.vendaseproducao.printstudio.data.db

import androidx.room.Entity
import androidx.room.PrimaryKey

/** Uma linha por perfil salvo. O layout inteiro (papel + páginas + blocos) fica serializado
 * em [layoutJson] — ver [com.musgo.vendaseproducao.printstudio.data.ProfileRepository]. Não
 * normalizado em tabelas de página/bloco: eles nunca são consultados isoladamente entre
 * perfis, e blocos/páginas sempre são lidos/gravados juntos como uma unidade. */
@Entity(tableName = "print_studio_profiles")
data class ProfileEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val updatedAt: Long,
    val layoutJson: String,
)
