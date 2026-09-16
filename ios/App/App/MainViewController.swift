import Capacitor

/**
 * Registra manualmente plugins Swift que vivem direto no alvo do app (não são um pacote npm
 * de plugin Capacitor de verdade) — o Capacitor só auto-registra plugins listados no
 * `packageClassList` de capacitor.config.json, e esse arquivo é gerado escaneando pacotes de
 * plugin descobertos em node_modules (ver node_modules/@capacitor/cli/dist/util/iosplugin.js,
 * findPluginClasses/getPluginFiles) — nunca arquivos soltos dentro de ios/App/App/. Sem isso,
 * qualquer chamada JS pro GallerySaverPlugin falha com "'GallerySaver' plugin is not
 * implemented on ios", mesmo com a classe certinha, compilada e linkada no app.
 *
 * Mesmo motivo por trás do `registerPlugin(GallerySaverPlugin.class)` já feito manualmente em
 * MainActivity.java no Android — aqui é o equivalente, via `capacitorDidLoad()` (chamado pela
 * CAPBridgeViewController logo depois que a bridge é criada, com `bridge` já disponível — ver
 * node_modules/@capacitor/ios/Capacitor/Capacitor/CAPBridgeViewController.swift).
 *
 * Main.storyboard aponta o ViewController inicial pra esta classe em vez de
 * CAPBridgeViewController direto (ver customClass no Base.lproj/Main.storyboard).
 */
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(GallerySaverPlugin())
    }
}
