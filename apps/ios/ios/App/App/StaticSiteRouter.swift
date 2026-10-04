import Capacitor
import Foundation
import ShellKit

/// Capacitor's `Router`, answering the way GitHub Pages does (ADR 0005 §3.3).
/// The path logic is `StaticSiteRoutes` in ShellKit, where it is tested; this
/// only joins it to the bundle's `public/` folder (`basePath`, set by the
/// scheme handler).
struct StaticSiteRouter: Router {
    var basePath: String = ""

    func route(for path: String) -> String {
        let root = basePath
        let file = StaticSiteRoutes.file(for: path) { sitePath in
            var isDirectory: ObjCBool = false
            let found = FileManager.default.fileExists(
                atPath: root + sitePath, isDirectory: &isDirectory)
            return found && !isDirectory.boolValue
        }
        return root + file
    }
}
