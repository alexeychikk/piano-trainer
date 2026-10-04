import Foundation

/// Maps a request path to the file of the static site that answers it, the
/// way GitHub Pages does (ADR 0005 §3.3).
///
/// Capacitor's default router serves the root `index.html` for every path
/// without an extension. Our routes are prerendered as `/x/y/index.html`
/// (`trailingSlash: 'always'`), so when iOS kills the WebContent process and
/// Capacitor reloads the current URL, the default would hydrate home's HTML
/// at `/settings/`. This mirrors Pages instead:
///
/// - `/x/y/` is `/x/y/index.html` when that file exists;
/// - a path whose last segment has an extension is served as it is;
/// - anything else is `/404.html`, SvelteKit's SPA fallback (it links its
///   assets absolutely, so it works at any depth). That covers the routes
///   that are not prerendered (`/practice/<id>/`) and a path without its
///   trailing slash, which Pages would redirect and a scheme handler cannot.
///
/// Paths are site-relative and start with `/`; `fileExists` is asked about
/// site-relative paths too, so this is pure and the caller owns the disk.
public enum StaticSiteRoutes {
    public static let indexFile = "index.html"
    public static let fallbackPath = "/404.html"

    public static func file(
        for requestPath: String,
        fileExists: (String) -> Bool
    ) -> String {
        let path = requestPath.hasPrefix("/") ? requestPath : "/" + requestPath

        if path.hasSuffix("/") {
            let page = path + indexFile
            return fileExists(page) ? page : fallbackPath
        }

        let lastSegment = path.split(separator: "/").last ?? ""
        if lastSegment.contains(".") && !lastSegment.hasSuffix(".") {
            return path
        }
        return fallbackPath
    }
}
