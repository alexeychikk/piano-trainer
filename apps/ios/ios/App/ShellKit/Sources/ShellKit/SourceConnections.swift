/// Which CoreMIDI sources the plugin's input port is connected to, and which
/// it must connect next (ADR 0005 §4.2, hot-plug).
///
/// CoreMIDI drops a port's connection to a source when the source goes away,
/// and a piano plugged back in is a source the port has never heard of — even
/// when it comes back under the same endpoint ref and unique id. So the plugin
/// keeps the set of endpoints it connected, and on every setup change:
/// - connects each endpoint present that is not in the set (`toConnect`), and
///   records it with `didConnect` only once `MIDIPortConnectSource` succeeded,
///   so a failed connect is retried on the next change;
/// - forgets each endpoint in the set that is no longer present, so its return
///   is connected again.
///
/// `forget` also takes a single endpoint straight from `msgObjectRemoved`, so a
/// remove and a re-add that land in one refresh still reconnect.
///
/// Generic over the endpoint ref (CoreMIDI's `MIDIEndpointRef` is a `UInt32`)
/// so it is tested without CoreMIDI.
public struct SourceConnections<Endpoint: Hashable> {
    public private(set) var connected: Set<Endpoint> = []

    public init() {}

    /// Bring the set in line with the endpoints present now, and return the
    /// ones still to connect, in `present`'s order, without duplicates.
    public mutating func toConnect(present: [Endpoint]) -> [Endpoint] {
        connected.formIntersection(present)
        var seen = connected
        return present.filter { seen.insert($0).inserted }
    }

    public mutating func didConnect(_ endpoint: Endpoint) {
        connected.insert(endpoint)
    }

    public mutating func forget(_ endpoint: Endpoint) {
        connected.remove(endpoint)
    }
}

/// A CoreMIDI source as the shim sees it (`MidiSource` in
/// `apps/ios/src/web-midi-shim.ts`): `id` is `kMIDIPropertyUniqueID`
/// stringified, `manufacturer` is empty when CoreMIDI has none.
public struct BridgedMidiSource: Equatable {
    public let id: String
    public let name: String
    public let manufacturer: String

    public init(uniqueID: Int32, displayName: String?, name: String?, manufacturer: String?) {
        self.id = String(uniqueID)
        self.name = Self.firstNonEmpty(displayName, name) ?? Self.unnamed
        self.manufacturer = Self.firstNonEmpty(manufacturer) ?? ""
    }

    /// What a source with no name at all is called. CoreMIDI names every
    /// driver-backed source, so this is for a nameless virtual one.
    public static let unnamed = "MIDI input"

    /// The dictionary the plugin bridges (Capacitor's `JSObject` is
    /// `[String: JSValue]`; `String` is one, so this converts as it is).
    public var bridged: [String: String] {
        ["id": id, "name": name, "manufacturer": manufacturer]
    }

    private static func firstNonEmpty(_ candidates: String?...) -> String? {
        for candidate in candidates {
            if let text = candidate?.trimmingWhitespace(), !text.isEmpty {
                return text
            }
        }
        return nil
    }
}

extension String {
    fileprivate func trimmingWhitespace() -> String {
        var scalars = Substring(self)
        while let first = scalars.first, first.isWhitespace { scalars.removeFirst() }
        while let last = scalars.last, last.isWhitespace { scalars.removeLast() }
        return String(scalars)
    }
}
