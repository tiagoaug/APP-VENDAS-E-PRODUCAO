package com.musgo.vendaseproducao.printstudio.data

import com.musgo.vendaseproducao.printstudio.data.db.ProfileDao
import com.musgo.vendaseproducao.printstudio.data.db.ProfileEntity
import com.musgo.vendaseproducao.printstudio.model.PrintLayout
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.Json

data class ProfileSummary(val id: Long, val name: String, val updatedAt: Long)

class ProfileRepository(private val dao: ProfileDao) {

    // ignoreUnknownKeys = true: se um campo novo for adicionado ao modelo (PrintLayout/
    // ImageBlock/etc.) depois que perfis já existirem salvos, o perfil antigo continua
    // carregando — só ignora o que não existia quando foi salvo, em vez de quebrar.
    private val json = Json { ignoreUnknownKeys = true }

    fun observeSummaries(): Flow<List<ProfileSummary>> =
        dao.observeAll().map { list -> list.map { ProfileSummary(it.id, it.name, it.updatedAt) } }

    suspend fun getLayout(id: Long): PrintLayout? =
        dao.getById(id)?.let { json.decodeFromString(PrintLayout.serializer(), it.layoutJson) }

    suspend fun save(id: Long?, name: String, layout: PrintLayout): Long {
        val payload = json.encodeToString(PrintLayout.serializer(), layout)
        val now = System.currentTimeMillis()
        return if (id == null) {
            dao.insert(ProfileEntity(name = name, updatedAt = now, layoutJson = payload))
        } else {
            dao.update(ProfileEntity(id = id, name = name, updatedAt = now, layoutJson = payload))
            id
        }
    }

    suspend fun delete(id: Long) = dao.deleteById(id)
}
