import Foundation

/// The pure half of the shell's `FileShare` plugin (ADR 0005 §6): the name a
/// shared download is written under, and where the share sheet's popover
/// points on iPad. The plugin is glue over these.
public enum SharedFile {
    /// `<a download>` with no usable name (the shim's fallback too).
    public static let fallbackName = "download"
    /// APFS names are at most 255 UTF-8 bytes.
    public static let maxNameBytes = 255

    /// A file name that stays one file in the temporary directory: path
    /// separators, `:` and control characters become `-`, surrounding space
    /// and leading dots go (no hidden file, no `..`), and an over-long name
    /// keeps its extension. Nothing usable left → `download`.
    public static func safeName(_ requested: String?) -> String {
        let trimmed = (requested ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let replaced = String(
            String.UnicodeScalarView(
                trimmed.unicodeScalars.map { scalar in
                    scalar == "/" || scalar == "\\" || scalar == ":"
                        || scalar.properties.generalCategory == .control
                        ? "-" : scalar
                }))
        var name = replaced[...]
        while name.first == "." { name.removeFirst() }
        name = Substring(name.trimmingCharacters(in: .whitespaces))
        guard !name.isEmpty else { return fallbackName }
        return truncated(String(name))
    }

    private static func truncated(_ name: String) -> String {
        guard name.utf8.count > maxNameBytes else { return name }
        let dot = name.lastIndex(of: ".")
        let ext = dot.map { String(name[$0...]) } ?? ""
        let stem = dot.map { String(name[..<$0]) } ?? name
        if ext.utf8.count >= maxNameBytes { return trim(name, to: maxNameBytes) }
        return trim(stem, to: maxNameBytes - ext.utf8.count) + ext
    }

    private static func trim(_ text: String, to bytes: Int) -> String {
        var text = text
        while text.utf8.count > bytes { text.removeLast() }
        return text.isEmpty ? fallbackName : text
    }
}

/// Where the share sheet's popover points, in the web view's points: the
/// control the shim says was last clicked (the Export button), clipped to the
/// view. `nil` means "no usable anchor" and the plugin centres the popover.
public struct ShareAnchor: Equatable {
    public let x: Double
    public let y: Double
    public let width: Double
    public let height: Double

    public init(x: Double, y: Double, width: Double, height: Double) {
        self.x = x
        self.y = y
        self.width = width
        self.height = height
    }

    /// Reads the shim's `{ x, y, width, height }` (numbers arrive as
    /// `Double`, `Int` or `NSNumber` depending on the bridge) and clips it to
    /// a view of `viewWidth` × `viewHeight`. Missing, non-finite, empty or
    /// wholly off-screen → `nil`.
    public static func from(
        _ values: [String: Any]?, viewWidth: Double, viewHeight: Double
    ) -> ShareAnchor? {
        guard let values,
            let x = number(values["x"]), let y = number(values["y"]),
            let width = number(values["width"]), let height = number(values["height"]),
            width > 0, height > 0
        else { return nil }
        let left = max(x, 0)
        let top = max(y, 0)
        let right = min(x + width, viewWidth)
        let bottom = min(y + height, viewHeight)
        guard right > left, bottom > top else { return nil }
        return ShareAnchor(x: left, y: top, width: right - left, height: bottom - top)
    }

    private static func number(_ value: Any?) -> Double? {
        let number: Double?
        switch value {
        case let value as Double: number = value
        case let value as Int: number = Double(value)
        case let value as NSNumber: number = value.doubleValue
        default: number = nil
        }
        guard let number, number.isFinite else { return nil }
        return number
    }
}
