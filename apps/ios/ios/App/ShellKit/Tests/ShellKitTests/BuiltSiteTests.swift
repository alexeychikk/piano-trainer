import Foundation
import ShellKit
import XCTest

/// The router against the real `apps/web` build — what the app bundles as
/// `public/`. Proves that every route the shell can be reloaded on answers
/// with a page whose scripts, styles and links all resolve to files that
/// are in the bundle, i.e. that it loads offline at that depth.
///
/// Needs `STATIC_SITE_ROOT` (CI sets it to the synced `App/App/public`);
/// skipped without it, so `swift test` alone stays a pure unit run.
final class BuiltSiteTests: XCTestCase {
    private var root: URL!

    /// A route that is not prerendered: the runtime-param exercise screen.
    private let exerciseRoute = "/practice/chord-quality/"

    override func setUpWithError() throws {
        guard let path = ProcessInfo.processInfo.environment["STATIC_SITE_ROOT"]
        else {
            throw XCTSkip("STATIC_SITE_ROOT is not set")
        }
        root = URL(fileURLWithPath: path, isDirectory: true).standardizedFileURL
        XCTAssertTrue(
            exists("/index.html"), "no index.html under \(root.path)")
    }

    private func exists(_ sitePath: String) -> Bool {
        var isDirectory: ObjCBool = false
        let found = FileManager.default.fileExists(
            atPath: root.path + sitePath, isDirectory: &isDirectory)
        return found && !isDirectory.boolValue
    }

    private func route(_ path: String) -> String {
        StaticSiteRoutes.file(for: path, fileExists: exists)
    }

    /// Every prerendered page, as the URL path it is served at (`/x/y/`).
    private func prerenderedRoutes() throws -> [String] {
        let files = FileManager.default.enumerator(
            at: root, includingPropertiesForKeys: nil)
        var routes: [String] = []
        while let file = files?.nextObject() as? URL {
            guard file.lastPathComponent == StaticSiteRoutes.indexFile else {
                continue
            }
            let directory = file.deletingLastPathComponent().standardizedFileURL
            let relative = String(directory.path.dropFirst(root.path.count))
            routes.append(relative.hasSuffix("/") ? relative : relative + "/")
        }
        return routes.sorted()
    }

    func testTheNamedDeepRoutesArePrerenderedAndServedAsThemselves() {
        for page in ["/settings/", "/progress/", "/play/", "/session/"] {
            XCTAssertEqual(route(page), page + StaticSiteRoutes.indexFile)
        }
    }

    func testEveryPrerenderedPageIsServedAtItsOwnRoute() throws {
        let routes = try prerenderedRoutes()
        XCTAssertTrue(routes.contains("/"))
        for page in routes {
            XCTAssertEqual(route(page), page + StaticSiteRoutes.indexFile)
        }
    }

    func testAnExerciseRouteIsTheSpaFallbackAndItExists() {
        XCTAssertEqual(route(exerciseRoute), StaticSiteRoutes.fallbackPath)
        XCTAssertTrue(exists(StaticSiteRoutes.fallbackPath))
    }

    /// Every `href`, `src` and `import("…")` on every page, resolved against
    /// the URL the page is served at, must route to a file in the bundle.
    func testEveryPageLoadsOnlyFilesThatAreInTheBundle() throws {
        var pages = try prerenderedRoutes()
        pages.append(exerciseRoute)

        for page in pages {
            let file = route(page)
            let html = try String(
                contentsOf: URL(fileURLWithPath: root.path + file),
                encoding: .utf8)
            let base = URL(string: "capacitor://localhost" + page)!
            let references = Self.references(in: html)
            XCTAssertFalse(references.isEmpty, "\(page) references nothing")

            for reference in references {
                guard let url = URL(string: reference, relativeTo: base),
                    url.scheme == base.scheme, url.host == base.host
                else { continue }
                let target = route(url.path.isEmpty ? "/" : url.path)
                XCTAssertTrue(
                    exists(target),
                    "\(page) → \(reference) → \(target) is not in the bundle")
            }
        }
    }

    private static let referencePattern = try! NSRegularExpression(
        pattern: ##"(?:href|src)="([^"#][^"]*)"|import\("([^"]+)"\)"##)

    static func references(in html: String) -> [String] {
        let range = NSRange(html.startIndex..., in: html)
        return referencePattern.matches(in: html, range: range).compactMap {
            match in
            for group in 1...2 {
                if let found = Range(match.range(at: group), in: html) {
                    return String(html[found])
                }
            }
            return nil
        }
    }
}
