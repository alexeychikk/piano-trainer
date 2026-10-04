import Foundation
import UIKit
import WebKit

#if DEBUG
/// CI's simulator smoke (`apps/ios/scripts/simulator-smoke.sh`): proves a
/// deep route loads **and reloads** in the real shell — WKWebView, Capacitor's
/// scheme handler and `StaticSiteRouter` together — which no unit test can.
///
/// Launched with `-smokeRoute /settings/`, the app waits for home to
/// hydrate, checks that Web MIDI reaches CoreMIDI through the plugin (`midi`),
/// navigates to the route, waits for it to hydrate, then calls
/// `webView.reload()` — exactly what Capacitor does after iOS kills the
/// WebContent process — and waits again. On `/settings/` it then presses
/// Export and checks that the share sheet opened with the backup (`share`,
/// ADR 0005 §6). "Hydrated" is SvelteKit's
/// `#svelte-announcer`, which only the client renders (the e2e suite's
/// `appIsListening` signal): a page whose scripts did not load never gets it,
/// which is what Capacitor's default router does at `/settings/` (home's HTML,
/// relative asset links resolved one level too deep).
///
/// Each step appends one `SMOKE …` line to `Library/Caches/shell-smoke.log` in
/// the app's data container, which the script reads from the host through
/// `simctl get_app_container` (`simctl launch --stderr` proved not to carry the
/// app's stderr on CI), and to stderr for a developer at a console. The script
/// fails on `SMOKE FAIL` or a missing `SMOKE DONE`. Debug builds only: nothing
/// here ships in a release.
final class ShellSmoke {
    static let argument = "-smokeRoute"
    static let stepTimeout: TimeInterval = 30
    /// The first page of a cold launch on a freshly booted simulator pays for
    /// WebKit's own start-up, which is not what this smoke measures.
    static let firstStepTimeout: TimeInterval = 90
    static let logName = "shell-smoke.log"

    /// Where the lines go: the host reads this file, truncated at each start.
    static var logURL: URL? {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)
            .first?.appendingPathComponent(logName)
    }
    static let pollInterval: TimeInterval = 0.25

    /// The route asked for on the command line, if any.
    static func requestedRoute(
        in arguments: [String] = ProcessInfo.processInfo.arguments
    ) -> String? {
        guard let flag = arguments.firstIndex(of: argument),
            arguments.indices.contains(flag + 1)
        else { return nil }
        return arguments[flag + 1]
    }

    private enum Step {
        case home, midi, load, reload, share

        var name: String {
            switch self {
            case .home: return "home"
            case .midi: return "midi"
            case .load: return "load"
            case .reload: return "reload"
            case .share: return "share"
            }
        }
    }

    private struct PageState: Decodable {
        let stale: Bool
        let hydrated: Bool
        let path: String
        let title: String
    }

    private weak var webView: WKWebView?
    private let route: String
    private let routeURL: URL
    /// The route whose page has the Data section's Export button.
    static let shareRoute = "/settings/"

    private var steps: [Step]
    private var deadline = Date()

    /// Kept alive by the view controller for the length of the run.
    init(webView: WKWebView, serverURL: URL, route: String) {
        self.webView = webView
        self.route = route
        self.routeURL = URL(string: route, relativeTo: serverURL)!.absoluteURL
        self.steps = [.home, .midi, .load, .reload]
            + (route == Self.shareRoute ? [.share] : [])
    }

    func start() {
        if let url = Self.logURL {
            try? FileManager.default.removeItem(at: url)
        }
        report("start route=\(route)")
        next()
    }

    private func next() {
        guard let step = steps.first else {
            report("DONE")
            return
        }
        deadline = Date().addingTimeInterval(
            step == .home ? Self.firstStepTimeout : Self.stepTimeout)
        switch step {
        case .home:
            poll(step, expectedPath: "/")
        case .midi:
            checkMidi()
        case .load:
            markStale { [weak self] in
                guard let self else { return }
                self.webView?.load(URLRequest(url: self.routeURL))
                self.poll(step, expectedPath: self.route)
            }
        case .reload:
            markStale { [weak self] in
                guard let self else { return }
                self.webView?.reload()
                self.poll(step, expectedPath: self.route)
            }
        case .share:
            pressExport()
        }
    }

    /// ADR 0005 §9 ticket 5: Export in the shell reaches the share sheet.
    /// The shim cancels the page's `blob:` download and hands the text to
    /// `FileSharePlugin`, which writes the file and presents the sheet; this
    /// checks the sheet is up and the file it was given is a backup, then
    /// closes it. (Import is `<input type="file">`, WKWebView's own document
    /// picker; the e2e suite covers the round trip through the fake bridge.)
    private static let exportPress = """
        const button = document.querySelector('[data-testid="export-json"]');
        if (!button) return 'FAIL no Export button';
        button.focus();
        button.click();
        return 'ok';
        """

    private func pressExport() {
        guard let webView else { return }
        FileSharePlugin.lastShared = nil
        webView.callAsyncJavaScript(
            Self.exportPress, arguments: [:], in: nil, in: .page
        ) { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(let value as String) where value == "ok":
                self.pollShareSheet()
            case .success(let value):
                self.report("FAIL share \(value)")
            case .failure(let error):
                self.report("FAIL share \(error.localizedDescription)")
            }
        }
    }

    /// Just enough of the export payload to know it is one.
    private struct Backup: Decodable {
        struct Record: Decodable {}
        let schemaVersion: Int
        let attempts: [Record]
    }

    private func pollShareSheet() {
        let presenter = webView?.window?.rootViewController
        if let sheet = presenter?.presentedViewController as? UIActivityViewController,
            let file = FileSharePlugin.lastShared
        {
            guard let data = try? Data(contentsOf: file),
                let backup = try? JSONDecoder().decode(Backup.self, from: data)
            else {
                report("FAIL share \(file.lastPathComponent) is not a backup")
                return
            }
            report(
                "share ok file=\(file.lastPathComponent) bytes=\(data.count)"
                    + " schemaVersion=\(backup.schemaVersion)"
                    + " attempts=\(backup.attempts.count)")
            sheet.dismiss(animated: false) { [weak self] in
                guard let self else { return }
                self.steps.removeFirst()
                self.next()
            }
            return
        }
        guard Date() < deadline else {
            report(
                "FAIL share no share sheet in time (presented: "
                    + "\(String(describing: presenter?.presentedViewController)))")
            return
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.pollInterval) {
            self.pollShareSheet()
        }
    }

    /// ADR 0005 §9 ticket 4: the `CoreMidi` plugin is registered, the shim is
    /// installed over it, the `midi` permission reads `granted`, and
    /// `requestMIDIAccess()` resolves — i.e. `start()` went to Swift and came
    /// back through the bridge. The simulator has no piano, so the number of
    /// inputs is reported, not asserted.
    private static let midiProbe = """
        if (typeof navigator.requestMIDIAccess !== 'function') {
          return 'FAIL no navigator.requestMIDIAccess (plugin '
            + (window.Capacitor?.isPluginAvailable?.('CoreMidi') ? 'present' : 'missing') + ')';
        }
        const permission = await navigator.permissions.query({ name: 'midi' });
        const access = await Promise.race([
          navigator.requestMIDIAccess(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('requestMIDIAccess timed out')), timeoutMs)),
        ]);
        const names = [...access.inputs.values()].map((input) => input.name).join(', ');
        return `ok permission=${permission.state} inputs=${access.inputs.size} [${names}]`;
        """

    private func checkMidi() {
        guard let webView else { return }
        webView.callAsyncJavaScript(
            Self.midiProbe,
            arguments: ["timeoutMs": Self.stepTimeout * 1000],
            in: nil,
            in: .page
        ) { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(let value as String) where value.hasPrefix("ok "):
                self.report("midi \(value)")
                self.steps.removeFirst()
                self.next()
            case .success(let value):
                self.report("FAIL midi \(value)")
            case .failure(let error):
                self.report("FAIL midi \(error.localizedDescription)")
            }
        }
    }

    /// Tags the current document, so a poll cannot mistake it for the next.
    private func markStale(then action: @escaping () -> Void) {
        webView?.evaluateJavaScript("window.__shellSmokeStale = true; true") {
            _, _ in action()
        }
    }

    private static let probe = """
        JSON.stringify({
          stale: window.__shellSmokeStale === true,
          hydrated: document.getElementById('svelte-announcer') !== null,
          path: location.pathname,
          title: document.title
        })
        """

    private func poll(_ step: Step, expectedPath: String) {
        webView?.evaluateJavaScript(Self.probe) { [weak self] result, _ in
            guard let self else { return }
            if let json = result as? String,
                let state = try? JSONDecoder().decode(
                    PageState.self, from: Data(json.utf8)),
                !state.stale, state.hydrated
            {
                guard state.path == expectedPath else {
                    self.report(
                        "FAIL \(step.name) path=\(state.path) expected=\(expectedPath)")
                    return
                }
                self.report(
                    "\(step.name) ok path=\(state.path) title=\(state.title)")
                self.steps.removeFirst()
                self.next()
                return
            }
            guard Date() < self.deadline else {
                self.report(
                    "FAIL \(step.name) not hydrated in time: \(result ?? "no document")"
                )
                return
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + Self.pollInterval) {
                self.poll(step, expectedPath: expectedPath)
            }
        }
    }

    private func report(_ line: String) {
        let data = Data("SMOKE \(line)\n".utf8)
        FileHandle.standardError.write(data)
        guard let url = Self.logURL else { return }
        if let handle = try? FileHandle(forWritingTo: url) {
            handle.seekToEndOfFile()
            handle.write(data)
            try? handle.close()
        } else {
            try? data.write(to: url)
        }
    }
}
#endif
