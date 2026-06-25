package com.musgo.vendaseproducao.printstudio.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

// exportSchema = false é deliberado: schema v1, sem histórico de migração ainda. Quando o
// recurso estabilizar e precisar de migrações reais, ligar a exportação nesse ponto.
@Database(entities = [ProfileEntity::class], version = 1, exportSchema = false)
abstract class PrintStudioDatabase : RoomDatabase() {

    abstract fun profileDao(): ProfileDao

    companion object {
        @Volatile private var instance: PrintStudioDatabase? = null

        fun getInstance(context: Context): PrintStudioDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    PrintStudioDatabase::class.java,
                    "print_studio.db",
                ).build().also { instance = it }
            }
    }
}
