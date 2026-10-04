import Foundation
import WebKit

#if DEBUG
/// CI's simulator smoke (`apps/ios/scripts/simulator-smoke.sh`): proves a
/// deep route loads **and reloads** in the real shell — WKWebView, Capacitor's
/// scheme handler and `StaticSiteRouter` together — which no unit test can.
///
/// Launched with `-smokeRoute /settings/`, the app waits for home to
/// hydrate, navigates to the route, waits for it to hydrate, then calls
/// `webView.reload()` — exactly what Capacitor does after iOS kills the
/// WebContent process — and waits again. "Hydrated" is SvelteKit's
/// `#svelte-announcer`, which only the client renders (the e2e suite's
/// `appIsListening` signal): a page whose scripts did not load never gets it,
/// which is what Capacitor's default router does at `/settings/` (home's HTML,
/// relative asset links resolved one level too deep).
///
/// Each step writes one `SMOKE …` line to stderr (unbuffered, so the script
/// sees it at once); the script fails on `SMOKE FAIL` or a missing
/// `SMOKE DONE`. Debug builds only: nothing here ships in a release.
final class ShellSmoke {
    static let argument = "-smokeRoute"
    static let stepTimeout: TimeInterval = 30
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
        case home, load, reload

        var name: String {
            switch self {
            case .home: return "home"
            case .load: return "load"
            case .reload: return "reload"
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
    private var steps: [Step] = [.home, .load, .reload]
    private var deadline = Date()

    /// Kept alive by the view controller for the length of the run.
    init(webView: WKWebView, serverURL: URL, route: String) {
        self.webView = webView
        self.route = route
        self.routeURL = URL(string: route, relativeTo: serverURL)!.absoluteURL
    }

    func start() {
        report("start route=\(route)")
        next()
    }

    private func next() {
        guard let step = steps.first else {
            report("DONE")
            return
        }
        deadline = Date().addingTimeInterval(Self.stepTimeout)
        switch step {
        case .home:
            poll(step, expectedPath: "/")
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
                    "FAIL \(step.name) not hydrated after \(Int(Self.stepTimeout)) s: \(result ?? "no document")"
                )
                return
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + Self.pollInterval) {
                self.poll(step, expectedPath: expectedPath)
            }
        }
    }

    private func report(_ line: String) {
        FileHandle.standardError.write(Data("SMOKE \(line)\n".utf8))
    }
}
#endif
