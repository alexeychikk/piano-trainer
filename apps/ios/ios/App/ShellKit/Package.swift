// swift-tools-version: 5.9
import PackageDescription

// The shell's native logic, kept out of the app target so it is testable with
// a plain `swift test` (ADR 0005 §7: agents compile Swift only in CI, so the
// native code that can be pure is pure). Foundation only — no Capacitor, no
// UIKit — which is why it builds for macOS as well as iOS.
let package = Package(
    name: "ShellKit",
    platforms: [.iOS(.v15), .macOS(.v13)],
    products: [
        .library(name: "ShellKit", targets: ["ShellKit"])
    ],
    targets: [
        .target(name: "ShellKit"),
        .testTarget(name: "ShellKitTests", dependencies: ["ShellKit"]),
    ]
)
