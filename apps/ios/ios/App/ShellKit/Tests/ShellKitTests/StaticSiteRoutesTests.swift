import ShellKit
import XCTest

final class StaticSiteRoutesTests: XCTestCase {
    /// What `pnpm build` prerenders, plus one asset.
    private let site: Set<String> = [
        "/index.html",
        "/404.html",
        "/settings/index.html",
        "/progress/index.html",
        "/play/index.html",
        "/session/index.html",
        "/favicon.svg",
        "/v1.2/index.html",
    ]

    private func route(_ path: String) -> String {
        StaticSiteRoutes.file(for: path) { site.contains($0) }
    }

    func testTheRootIsHome() {
        XCTAssertEqual(route("/"), "/index.html")
        XCTAssertEqual(route(""), "/index.html")
    }

    func testAPrerenderedRouteIsItsOwnPage() {
        XCTAssertEqual(route("/settings/"), "/settings/index.html")
        XCTAssertEqual(route("/progress/"), "/progress/index.html")
        XCTAssertEqual(route("/play/"), "/play/index.html")
        XCTAssertEqual(route("/session/"), "/session/index.html")
    }

    /// The bug the router exists for: Capacitor's default serves home here.
    func testARouteThatIsNotPrerenderedIsTheSpaFallback() {
        XCTAssertEqual(route("/practice/chord-quality/"), "/404.html")
        XCTAssertEqual(route("/nowhere/"), "/404.html")
    }

    /// Pages redirects `/settings` to `/settings/`; a scheme handler cannot,
    /// and the page's relative asset links only work at the slashed URL.
    func testAPathWithoutItsTrailingSlashIsTheSpaFallback() {
        XCTAssertEqual(route("/settings"), "/404.html")
        XCTAssertEqual(route("/practice/chord-quality"), "/404.html")
    }

    func testAFileIsServedAsItIs() {
        XCTAssertEqual(route("/favicon.svg"), "/favicon.svg")
        XCTAssertEqual(
            route("/_app/immutable/entry/app.B1rNcmbJ.js"),
            "/_app/immutable/entry/app.B1rNcmbJ.js"
        )
        XCTAssertEqual(route("/index.html"), "/index.html")
        XCTAssertEqual(route("/404.html"), "/404.html")
    }

    /// A missing asset is not a page: the scheme handler fails it, as it
    /// would without this router, rather than answering a script with HTML.
    func testAMissingFileIsStillServedAsItIs() {
        XCTAssertEqual(route("/_app/missing.js"), "/_app/missing.js")
    }

    func testOnlyTheLastSegmentDecidesWhetherAPathIsAFile() {
        XCTAssertEqual(route("/v1.2/"), "/v1.2/index.html")
        XCTAssertEqual(route("/v1.2/settings"), "/404.html")
        XCTAssertEqual(route("/trailing."), "/404.html")
    }

    func testAPathIsReadAsSiteRelative() {
        XCTAssertEqual(route("settings/"), "/settings/index.html")
    }
}
