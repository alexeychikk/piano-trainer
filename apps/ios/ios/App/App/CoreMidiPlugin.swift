import Capacitor
import CoreMIDI
import Foundation
import ShellKit

/// The shell's local CoreMIDI plugin (ADR 0005 §4.2): what the Web MIDI shim
/// (`apps/ios/src/web-midi-shim.ts`) calls `CoreMidi`.
///
/// | JS | native |
/// | --- | --- |
/// | `start()` → `{ sources }` | one `MIDIClient` + one MIDI 1.0 input port, every source connected; idempotent |
/// | event `sourcesChanged` → `{ sources }` | the full list, after any add/remove/setup/property change that changed it |
/// | event `messages` → `{ id, data }` | one event per CoreMIDI event list, channel-voice messages only |
///
/// The logic that can be pure is in ShellKit and tested there:
/// `UniversalPackets` (UMP words → MIDI 1.0 bytes, realtime and sysex
/// dropped), `SourceConnections` (which endpoints to (re)connect on hot-plug)
/// and `BridgedMidiSource` (the shape the shim reads). This file is glue.
///
/// Threads: CoreMIDI calls the receive block on its own high-priority thread
/// and the notify block on the run loop that created the client. Everything
/// that touches this object's state, and every `notifyListeners`, runs on the
/// main queue, so state has one owner and messages reach JS in order.
@objc(CoreMidiPlugin)
public class CoreMidiPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CoreMidiPlugin"
    public let jsName = "CoreMidi"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise)
    ]

    private var client = MIDIClientRef()
    private var port = MIDIPortRef()
    private var connections = SourceConnections<MIDIEndpointRef>()
    private var lastSources: [BridgedMidiSource] = []

    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let status = self.startClient()
            guard status == noErr else {
                call.reject("CoreMIDI could not start (OSStatus \(status))")
                return
            }
            call.resolve(["sources": self.refreshSources().map(\.bridged)])
        }
    }

    // MARK: - Main queue only

    /// Creates the client and the port once; a second `start()` (another
    /// page load in the same app run) only re-reads the sources.
    private func startClient() -> OSStatus {
        guard client == 0 else { return noErr }
        var newClient = MIDIClientRef()
        var status = MIDIClientCreateWithBlock(
            "Piano Trainer" as CFString, &newClient
        ) { [weak self] notification in
            CoreMidiPlugin.handle(notification, plugin: self)
        }
        guard status == noErr else { return status }

        var newPort = MIDIPortRef()
        status = MIDIInputPortCreateWithProtocol(
            newClient, "Piano Trainer input" as CFString, ._1_0, &newPort
        ) { [weak self] eventList, refCon in
            CoreMidiPlugin.receive(eventList, refCon: refCon, plugin: self)
        }
        guard status == noErr else {
            MIDIClientDispose(newClient)
            return status
        }
        client = newClient
        port = newPort
        return noErr
    }

    /// Connects whatever is new, and returns the full list as the shim sees
    /// it. Offline endpoints (a USB piano unplugged whose device CoreMIDI
    /// still remembers) are not present.
    @discardableResult
    private func refreshSources() -> [BridgedMidiSource] {
        var present: [(endpoint: MIDIEndpointRef, uniqueID: Int32, source: BridgedMidiSource)] = []
        for index in 0..<MIDIGetNumberOfSources() {
            let endpoint = MIDIGetSource(index)
            guard endpoint != 0, !Self.isOffline(endpoint),
                let uniqueID = Self.uniqueID(of: endpoint)
            else { continue }
            let source = BridgedMidiSource(
                uniqueID: uniqueID,
                displayName: Self.string(kMIDIPropertyDisplayName, of: endpoint),
                name: Self.string(kMIDIPropertyName, of: endpoint),
                manufacturer: Self.string(kMIDIPropertyManufacturer, of: endpoint))
            present.append((endpoint, uniqueID, source))
        }

        let uniqueIDs = Dictionary(
            present.map { ($0.endpoint, $0.uniqueID) },
            uniquingKeysWith: { first, _ in first })
        for endpoint in connections.toConnect(present: present.map(\.endpoint)) {
            // The unique id rides along as the connection's refCon, so every
            // event list names its port with no lookup on CoreMIDI's thread.
            // (An id of 0 is a nil refCon, which `receive` reads back as 0.)
            let refCon = UnsafeMutableRawPointer(
                bitPattern: Int(uniqueIDs[endpoint] ?? 0))
            if MIDIPortConnectSource(port, endpoint, refCon) == noErr {
                connections.didConnect(endpoint)
            } else {
                CAPLog.print("⚡️  CoreMIDI could not connect source \(endpoint)")
            }
        }

        let sources = present.map(\.source)
        lastSources = sources
        return sources
    }

    private func sourcesMayHaveChanged() {
        guard client != 0 else { return }
        let before = lastSources
        let sources = refreshSources()
        guard sources != before else { return }
        notifyListeners("sourcesChanged", data: ["sources": sources.map(\.bridged)])
    }

    // MARK: - CoreMIDI callbacks

    private static func handle(
        _ notification: UnsafePointer<MIDINotification>, plugin: CoreMidiPlugin?
    ) {
        let messageID = notification.pointee.messageID
        var removed: MIDIEndpointRef?
        if messageID == .msgObjectRemoved {
            let change = notification.withMemoryRebound(
                to: MIDIObjectAddRemoveNotification.self, capacity: 1
            ) { $0.pointee }
            if change.childType == .source { removed = change.child }
        }
        switch messageID {
        case .msgSetupChanged, .msgObjectAdded, .msgObjectRemoved,
            .msgPropertyChanged:
            DispatchQueue.main.async {
                guard let plugin else { return }
                if let removed { plugin.connections.forget(removed) }
                plugin.sourcesMayHaveChanged()
            }
        default:
            break
        }
    }

    /// CoreMIDI's thread: copy the channel-voice bytes out, drop the rest,
    /// and hop to main only when something is left.
    private static func receive(
        _ eventList: UnsafePointer<MIDIEventList>,
        refCon: UnsafeMutableRawPointer?,
        plugin: CoreMidiPlugin?
    ) {
        var messages: [[Int]] = []
        for packet in eventList.unsafeSequence() {
            for bytes in UniversalPackets.channelVoiceMessages(in: words(of: packet)) {
                messages.append(bytes.map(Int.init))
            }
        }
        guard !messages.isEmpty else { return }
        let id = String(Int32(truncatingIfNeeded: Int(bitPattern: refCon)))
        DispatchQueue.main.async {
            plugin?.notifyListeners("messages", data: ["id": id, "data": messages])
        }
    }

    /// The packet's words, read in place: a packet may be longer than the 64
    /// words `MIDIEventPacket` declares, so copying `pointee` could truncate.
    private static func words(
        of packet: UnsafePointer<MIDIEventPacket>
    ) -> UnsafeBufferPointer<UInt32> {
        let count = Int(packet.pointee.wordCount)
        let offset = MemoryLayout<MIDIEventPacket>.offset(of: \.words) ?? 12
        let start = UnsafeRawPointer(packet).advanced(by: offset)
            .assumingMemoryBound(to: UInt32.self)
        return UnsafeBufferPointer(start: start, count: count)
    }

    // MARK: - Properties

    private static func uniqueID(of object: MIDIObjectRef) -> Int32? {
        var value: Int32 = 0
        let status = MIDIObjectGetIntegerProperty(
            object, kMIDIPropertyUniqueID, &value)
        return status == noErr ? value : nil
    }

    private static func isOffline(_ object: MIDIObjectRef) -> Bool {
        var value: Int32 = 0
        let status = MIDIObjectGetIntegerProperty(
            object, kMIDIPropertyOffline, &value)
        return status == noErr && value != 0
    }

    /// Endpoint string properties fall back to the entity's and the device's
    /// in CoreMIDI, so a manufacturer set on the device is found here.
    private static func string(_ property: CFString, of object: MIDIObjectRef) -> String? {
        var value: Unmanaged<CFString>?
        guard MIDIObjectGetStringProperty(object, property, &value) == noErr,
            let value
        else { return nil }
        return value.takeRetainedValue() as String
    }
}
