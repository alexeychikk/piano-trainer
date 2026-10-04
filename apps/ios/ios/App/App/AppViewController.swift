import Capacitor
import UIKit
import WebKit

/// The shell's one view controller (ADR 0005 §3.3): Capacitor's bridge with
/// a Pages-shaped router, the local `CoreMidi` plugin, and the Web MIDI shim
/// injected at document start.
class AppViewController: CAPBridgeViewController {
    /// `apps/ios/dist/web-midi-shim.js`, copied into the bundle by
    /// `pnpm --filter ios sync`.
    static let shimResource = "web-midi-shim"

    #if DEBUG
        private var smoke: ShellSmoke?
    #endif

    override func router() -> Router {
        StaticSiteRouter()
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        // Local plugin (ADR §3.1): registered here, not found by package
        // scanning. Its header script is added now, so it runs before the
        // shim's — `Capacitor.isPluginAvailable('CoreMidi')` is true by the
        // time the shim asks.
        bridge?.registerPluginInstance(CoreMidiPlugin())
        injectWebMidiShim()
        #if DEBUG
            startSmokeIfAsked()
        #endif
    }

    #if DEBUG
        /// CI's `-smokeRoute` run (`ShellSmoke`); a no-op on a normal launch.
        private func startSmokeIfAsked() {
            guard let route = ShellSmoke.requestedRoute(),
                let webView, let serverURL = bridge?.config.serverURL
            else { return }
            smoke = ShellSmoke(
                webView: webView, serverURL: serverURL, route: route)
            smoke?.start()
        }
    #endif

    /// Added after Capacitor's own bridge scripts, so `window.Capacitor`
    /// already exists when the shim runs. Main frame only.
    private func injectWebMidiShim() {
        guard
            let url = Bundle.main.url(
                forResource: Self.shimResource, withExtension: "js"),
            let source = try? String(contentsOf: url, encoding: .utf8)
        else {
            CAPLog.print("⚡️  \(Self.shimResource).js is not in the bundle")
            return
        }
        let script = WKUserScript(
            source: source,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true)
        webView?.configuration.userContentController.addUserScript(script)
    }
}
