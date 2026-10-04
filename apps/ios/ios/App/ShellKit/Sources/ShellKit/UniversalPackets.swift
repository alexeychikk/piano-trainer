/// Reads CoreMIDI's Universal MIDI Packets (UMP) back into the MIDI 1.0 bytes
/// the Web MIDI shim forwards (ADR 0005 §4.2).
///
/// `CoreMidiPlugin` opens its input port with
/// `MIDIInputPortCreateWithProtocol(._1_0)`, so CoreMIDI hands it event lists
/// of 32-bit words in which every channel-voice message of a MIDI 1.0 piano is
/// one **type 0x2** packet: `[type:4 group:4 | status:8 | data1:8 | data2:8]`.
///
/// Only those travel to JS. Everything else is dropped here, natively, so the
/// bridge stays quiet while nobody plays:
/// - system messages (type 0x1) — `0xF8` clock and `0xFE` active sensing,
///   which many digital pianos send every 300 ms;
/// - sysex (type 0x3, two words) — the app never asks for it;
/// - utility, MIDI 2.0 (type 0x4, which a 1.0 port is not sent), flex data,
///   stream and reserved types — skipped by their declared size, so one of
///   them cannot shift the words after it out of step.
///
/// The UMP group is ignored: Web MIDI has one stream per port, and a piano
/// sends on group 0. This is pure (Foundation-free arithmetic), so it is what
/// `swift test` checks; the plugin only copies the words out of CoreMIDI.
public enum UniversalPackets {
    /// The packet's size in 32-bit words, from the message type in the top
    /// nibble of its first word (UMP 1.1 §2.1.4).
    public static func wordCount(of firstWord: UInt32) -> Int {
        switch firstWord >> 28 {
        case 0x0, 0x1, 0x2, 0x6, 0x7: return 1
        case 0x3, 0x4, 0x8, 0x9, 0xA: return 2
        case 0xB, 0xC: return 3
        default: return 4  // 0x5, 0xD, 0xE, 0xF
        }
    }

    /// The MIDI 1.0 bytes of one type 0x2 word, or `nil` for any other word:
    /// another message type, a status outside `0x80`–`0xEF`, or a data byte
    /// with its top bit set (a malformed packet is dropped, never repaired).
    /// Program change (`0xCn`) and channel pressure (`0xDn`) are two bytes,
    /// the rest three.
    public static func channelVoiceBytes(_ word: UInt32) -> [UInt8]? {
        guard word >> 28 == 0x2 else { return nil }
        let status = UInt8(truncatingIfNeeded: word >> 16)
        let data1 = UInt8(truncatingIfNeeded: word >> 8)
        let data2 = UInt8(truncatingIfNeeded: word)
        guard status >= 0x80, status <= 0xEF else { return nil }
        switch status & 0xF0 {
        case 0xC0, 0xD0:
            guard data1 <= 0x7F else { return nil }
            return [status, data1]
        default:
            guard data1 <= 0x7F, data2 <= 0x7F else { return nil }
            return [status, data1, data2]
        }
    }

    /// Every channel-voice message in a run of UMP words, in order. A packet
    /// whose declared size runs past the end of the words is dropped.
    public static func channelVoiceMessages<Words: Collection>(
        in words: Words
    ) -> [[UInt8]] where Words.Element == UInt32 {
        var messages: [[UInt8]] = []
        var index = words.startIndex
        while index != words.endIndex {
            let first = words[index]
            let size = wordCount(of: first)
            guard
                let next = words.index(
                    index, offsetBy: size, limitedBy: words.endIndex)
            else { break }
            if size == 1, let bytes = channelVoiceBytes(first) {
                messages.append(bytes)
            }
            index = next
        }
        return messages
    }
}
