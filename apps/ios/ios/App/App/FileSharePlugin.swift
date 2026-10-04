import Capacitor
import Foundation
import ShellKit
import UIKit

/// The shell's local share plugin (ADR 0005 §6): what the shim's download
/// handover (`apps/ios/src/file-share.ts`) calls `FileShare`.
///
/// | JS | native |
/// | --- | --- |
/// | `share({ filename, text, mimeType, anchor? })` → `{ completed, activityType? }` | writes `text` to `tmp/share-<uuid>/<filename>` and presents the share sheet with that file |
///
/// WKWebView drops a `blob:` download (Capacitor implements no
/// `WKDownloadDelegate`), so the shim cancels the click and hands the file
/// here; Save to Files and AirDrop come with the share sheet. The promise
/// settles when the sheet closes, and the temporary file goes with it. The
/// name and the iPad popover anchor are ShellKit's `SharedFile.safeName` and
/// `ShareAnchor`, tested there; this file is glue.
@objc(FileSharePlugin)
public class FileSharePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FileSharePlugin"
    public let jsName = "FileShare"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "share", returnType: CAPPluginReturnPromise)
    ]

    #if DEBUG
        /// The last file handed to a share sheet, for `ShellSmoke`'s `share`
        /// step. Debug builds only.
        static var lastShared: URL?
    #endif

    @objc func share(_ call: CAPPluginCall) {
        guard let text = call.getString("text") else {
            call.reject("share needs the file's text")
            return
        }
        let name = SharedFile.safeName(call.getString("filename"))
        let anchor = call.getObject("anchor").map { $0 as [String: Any] }

        DispatchQueue.main.async {
            let webView: UIView? = self.bridge?.webView
            guard let presenter = self.bridge?.viewController,
                let view = webView ?? presenter.view
            else {
                call.reject("No view to present the share sheet from")
                return
            }
            // A second sheet would not present, and its promise never settle.
            guard presenter.presentedViewController == nil else {
                call.reject("Something is already on screen over the app")
                return
            }
            let directory: URL
            let file: URL
            do {
                directory = FileManager.default.temporaryDirectory
                    .appendingPathComponent("share-\(UUID().uuidString)", isDirectory: true)
                try FileManager.default.createDirectory(
                    at: directory, withIntermediateDirectories: true)
                file = directory.appendingPathComponent(name)
                try Data(text.utf8).write(to: file, options: .atomic)
            } catch {
                call.reject("Could not write \(name): \(error.localizedDescription)")
                return
            }

            let sheet = UIActivityViewController(
                activityItems: [file], applicationActivities: nil)
            // iPad presents the sheet as a popover, which must point somewhere.
            if let popover = sheet.popoverPresentationController {
                popover.sourceView = view
                if let rect = ShareAnchor.from(
                    anchor,
                    viewWidth: Double(view.bounds.width),
                    viewHeight: Double(view.bounds.height))
                {
                    popover.sourceRect = CGRect(
                        x: rect.x, y: rect.y, width: rect.width, height: rect.height)
                } else {
                    popover.sourceRect = CGRect(
                        x: view.bounds.midX, y: view.bounds.midY, width: 0, height: 0)
                    popover.permittedArrowDirections = []
                }
            }
            sheet.completionWithItemsHandler = { activityType, completed, _, error in
                try? FileManager.default.removeItem(at: directory)
                if let error {
                    call.reject(error.localizedDescription)
                    return
                }
                var result: JSObject = ["completed": completed]
                if let activityType { result["activityType"] = activityType.rawValue }
                call.resolve(result)
            }
            #if DEBUG
                Self.lastShared = file
            #endif
            presenter.present(sheet, animated: true)
        }
    }
}
