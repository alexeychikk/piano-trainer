import ShellKit
import XCTest

final class UniversalPacketsTests: XCTestCase {
    /// A type 0x2 word: `[2 | group | status | data1 | data2]`.
    private func midi1(
        _ status: UInt32, _ data1: UInt32, _ data2: UInt32 = 0, group: UInt32 = 0
    ) -> UInt32 {
        0x2000_0000 | group << 24 | status << 16 | data1 << 8 | data2
    }

    func testANoteOnIsItsThreeBytes() {
        XCTAssertEqual(
            UniversalPackets.channelVoiceBytes(midi1(0x90, 60, 100)),
            [0x90, 60, 100])
    }

    func testANoteOffAndAZeroVelocityNoteOnPassAsTheyAre() {
        // `$lib/midi` reads a velocity-0 note-on as a note-off; the bridge
        // does not rewrite it.
        XCTAssertEqual(
            UniversalPackets.channelVoiceBytes(midi1(0x80, 60, 64)),
            [0x80, 60, 64])
        XCTAssertEqual(
            UniversalPackets.channelVoiceBytes(midi1(0x93, 60, 0)),
            [0x93, 60, 0])
    }

    func testEveryChannelVoiceStatusOnEveryChannel() {
        for kind: UInt32 in [0x80, 0x90, 0xA0, 0xB0, 0xE0] {
            for channel: UInt32 in 0...15 {
                let status = kind | channel
                XCTAssertEqual(
                    UniversalPackets.channelVoiceBytes(midi1(status, 1, 2)),
                    [UInt8(status), 1, 2])
            }
        }
    }

    func testProgramChangeAndChannelPressureAreTwoBytes() {
        XCTAssertEqual(
            UniversalPackets.channelVoiceBytes(midi1(0xC0, 5, 0)), [0xC0, 5])
        XCTAssertEqual(
            UniversalPackets.channelVoiceBytes(midi1(0xD7, 90, 0)), [0xD7, 90])
    }

    func testTheSustainPedalPasses() {
        XCTAssertEqual(
            UniversalPackets.channelVoiceBytes(midi1(0xB0, 64, 127)),
            [0xB0, 64, 127])
    }

    func testTheGroupIsIgnored() {
        XCTAssertEqual(
            UniversalPackets.channelVoiceBytes(midi1(0x90, 60, 100, group: 0xF)),
            [0x90, 60, 100])
    }

    func testSystemMessagesAreDropped() {
        // Type 0x1: clock, active sensing, start/stop, song position.
        for status: UInt32 in [0xF8, 0xFE, 0xFA, 0xFC, 0xF2] {
            XCTAssertNil(
                UniversalPackets.channelVoiceBytes(0x1000_0000 | status << 16))
        }
    }

    func testAType2WordWithASystemStatusIsDropped() {
        XCTAssertNil(UniversalPackets.channelVoiceBytes(midi1(0xF8, 0, 0)))
        XCTAssertNil(UniversalPackets.channelVoiceBytes(midi1(0xF0, 0x7E, 0)))
    }

    func testARunningStatusOrDataByteInTheStatusSlotIsDropped() {
        XCTAssertNil(UniversalPackets.channelVoiceBytes(midi1(0x3C, 100, 0)))
    }

    func testADataByteWithItsTopBitSetIsDropped() {
        XCTAssertNil(UniversalPackets.channelVoiceBytes(midi1(0x90, 0x80, 100)))
        XCTAssertNil(UniversalPackets.channelVoiceBytes(midi1(0x90, 60, 0xFF)))
        XCTAssertNil(UniversalPackets.channelVoiceBytes(midi1(0xC0, 0x80, 0)))
    }

    func testOnlyTheData1ByteIsCheckedForATwoByteMessage() {
        // The unused third byte of a program change is not part of it.
        XCTAssertEqual(
            UniversalPackets.channelVoiceBytes(midi1(0xC0, 5, 0xFF)), [0xC0, 5])
    }

    func testWordCountsFollowTheMessageType() {
        let sizes: [UInt32: Int] = [
            0x0: 1, 0x1: 1, 0x2: 1, 0x3: 2, 0x4: 2, 0x5: 4, 0x6: 1, 0x7: 1,
            0x8: 2, 0x9: 2, 0xA: 2, 0xB: 3, 0xC: 3, 0xD: 4, 0xE: 4, 0xF: 4,
        ]
        for (type, size) in sizes {
            XCTAssertEqual(
                UniversalPackets.wordCount(of: type << 28), size, "type \(type)")
        }
    }

    func testAChordArrivesAsOneMessagePerNote() {
        let words = [midi1(0x90, 60, 90), midi1(0x90, 64, 90), midi1(0x90, 67, 90)]
        XCTAssertEqual(
            UniversalPackets.channelVoiceMessages(in: words),
            [[0x90, 60, 90], [0x90, 64, 90], [0x90, 67, 90]])
    }

    func testActiveSensingBetweenNotesIsSkipped() {
        let words: [UInt32] = [
            0x10FE_0000, midi1(0x90, 60, 90), 0x10F8_0000, midi1(0x80, 60, 0),
        ]
        XCTAssertEqual(
            UniversalPackets.channelVoiceMessages(in: words),
            [[0x90, 60, 90], [0x80, 60, 0]])
    }

    func testAnEventListOfOnlyRealtimeIsEmpty() {
        XCTAssertEqual(
            UniversalPackets.channelVoiceMessages(in: [0x10FE_0000, 0x10F8_0000]),
            [])
        XCTAssertEqual(UniversalPackets.channelVoiceMessages(in: [UInt32]()), [])
    }

    /// A multi-word packet is skipped whole: its trailing words are payload,
    /// and one that happens to look like a note-on must not be read as one.
    func testSysexIsSkippedWholeWithoutMisreadingItsPayload() {
        let sysexLookingLikeNoteOn: [UInt32] = [
            0x3006_7E7F,  // sysex7, group 0, complete, 6 bytes
            midi1(0x90, 1, 2),  // its second word, which is payload
            midi1(0x90, 60, 90),
        ]
        XCTAssertEqual(
            UniversalPackets.channelVoiceMessages(in: sysexLookingLikeNoteOn),
            [[0x90, 60, 90]])
    }

    func testAMidi2NoteOnIsSkippedWhole() {
        // Type 0x4, two words; a 1.0 port is never sent one, but its size
        // still has to keep the words after it in step.
        let words: [UInt32] = [0x4090_3C00, 0xFFFF_0000, midi1(0x80, 60, 0)]
        XCTAssertEqual(
            UniversalPackets.channelVoiceMessages(in: words), [[0x80, 60, 0]])
    }

    func testFourWordPacketsAreSkippedWhole() {
        let words: [UInt32] = [
            0xF000_0000, midi1(0x90, 1, 1), midi1(0x90, 2, 2), midi1(0x90, 3, 3),
            midi1(0x90, 60, 90),
        ]
        XCTAssertEqual(
            UniversalPackets.channelVoiceMessages(in: words), [[0x90, 60, 90]])
    }

    func testAPacketCutShortAtTheEndIsDropped() {
        let words: [UInt32] = [midi1(0x90, 60, 90), 0x4090_3C00]
        XCTAssertEqual(
            UniversalPackets.channelVoiceMessages(in: words), [[0x90, 60, 90]])
    }

    func testItReadsAnyCollectionOfWords() {
        let words: [UInt32] = [0, midi1(0x90, 60, 90), midi1(0x80, 60, 0)]
        XCTAssertEqual(
            UniversalPackets.channelVoiceMessages(in: words.dropFirst()),
            [[0x90, 60, 90], [0x80, 60, 0]])
        words.withUnsafeBufferPointer { buffer in
            XCTAssertEqual(
                UniversalPackets.channelVoiceMessages(in: buffer).count, 2)
        }
    }
}
