package com.musgo.vendaseproducao;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.musgo.vendaseproducao.printstudio.PrintStudioPlugin;
import com.musgo.vendaseproducao.printstudio.printer.AbleMarkPrinterPlugin;
import com.musgo.vendaseproducao.printstudio.printer.EpsonPrinterPlugin;
import com.musgo.vendaseproducao.printstudio.printer2.AbleMarkPrinterPlugin2;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Precisa ser registrado ANTES do super.onCreate(): é o BridgeActivity.onCreate que
        // constrói a Bridge a partir dos plugins já registrados até esse ponto.
        registerPlugin(PrintStudioPlugin.class);
        registerPlugin(AbleMarkPrinterPlugin.class);
        registerPlugin(EpsonPrinterPlugin.class);
        registerPlugin(GallerySaverPlugin.class);
        registerPlugin(AbleMarkPrinterPlugin2.class);
        super.onCreate(savedInstanceState);
    }
}
