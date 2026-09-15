import Foundation
import Capacitor
import Photos

/**
 * Salva uma imagem (já escrita em disco pelo lado web, via Filesystem.writeFile) na galeria do
 * iOS usando PHPhotoLibrary — mesmo contrato JS do GallerySaverPlugin.kt do Android
 * (`saveImage({ path, album })` -> `{ saved, uri }`), pra o código web (gallerySaver.ts,
 * LabelEditorView.tsx) não precisar de nenhum branch por plataforma além de
 * `isGallerySaverPlatform()`. Usa `.addOnly` (iOS 14+) — só pede permissão de ADICIONAR fotos,
 * não de ler a galeria inteira (NSPhotoLibraryAddUsageDescription no Info.plist), evitando pedir
 * mais acesso do que a função precisa.
 */
@objc(GallerySaverPlugin)
public class GallerySaverPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GallerySaverPlugin"
    public let jsName = "GallerySaver"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "saveImage", returnType: CAPPluginReturnPromise)
    ]

    @objc func saveImage(_ call: CAPPluginCall) {
        guard let path = call.getString("path"), !path.isEmpty else {
            call.reject("path é obrigatório")
            return
        }
        let albumName = call.getString("album") ?? "LIM.O APP"

        // Mesma convenção do Android: `path` pode vir com prefixo file:// (URI do
        // Filesystem.writeFile) — precisa virar um caminho de arquivo puro pro FileManager.
        let cleanPath: String
        if let url = URL(string: path), url.scheme == "file" {
            cleanPath = url.path
        } else {
            cleanPath = path
        }
        guard FileManager.default.fileExists(atPath: cleanPath) else {
            call.reject("Arquivo não encontrado: \(cleanPath)")
            return
        }
        let fileURL = URL(fileURLWithPath: cleanPath)

        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            guard status == .authorized || status == .limited else {
                call.reject("Permissão de galeria negada.")
                return
            }

            var placeholder: PHObjectPlaceholder?
            PHPhotoLibrary.shared().performChanges({
                let request = PHAssetChangeRequest.creationRequestForAssetFromImage(atFileURL: fileURL)
                placeholder = request?.placeholderForCreatedAsset
                if let placeholder = placeholder {
                    self.addToAlbum(assetPlaceholder: placeholder, albumName: albumName)
                }
            }, completionHandler: { success, error in
                DispatchQueue.main.async {
                    if success {
                        let result = JSObject()
                        result["saved"] = true
                        result["uri"] = placeholder?.localIdentifier ?? ""
                        call.resolve(result)
                    } else {
                        call.reject("Erro ao salvar na galeria: \(error?.localizedDescription ?? "desconhecido")")
                    }
                }
            })
        }
    }

    // Cria (se preciso) e adiciona o novo asset num álbum próprio — chamado DENTRO do mesmo
    // `performChanges` do asset acima; criar o álbum e adicionar o asset placeholder na mesma
    // transação funciona normalmente na Photos framework (padrão documentado pela Apple), não
    // precisa de uma segunda chamada a `performChanges`.
    private func addToAlbum(assetPlaceholder: PHObjectPlaceholder, albumName: String) {
        let fetchOptions = PHFetchOptions()
        fetchOptions.predicate = NSPredicate(format: "title = %@", albumName)
        let collections = PHAssetCollection.fetchAssetCollections(with: .album, subtype: .any, options: fetchOptions)

        if let album = collections.firstObject {
            if let addRequest = PHAssetCollectionChangeRequest(for: album) {
                addRequest.addAssets([assetPlaceholder] as NSArray)
            }
        } else {
            let createRequest = PHAssetCollectionChangeRequest.creationRequestForAssetCollection(withTitle: albumName)
            createRequest.addAssets([assetPlaceholder] as NSArray)
        }
    }
}
