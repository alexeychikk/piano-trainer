import ShellKit
import XCTest

final class SourceConnectionsTests: XCTestCase {
    func testEverySourcePresentAtStartIsConnected() {
        var connections = SourceConnections<UInt32>()
        XCTAssertEqual(connections.toConnect(present: [7, 9]), [7, 9])
    }

    func testAConnectedSourceIsNotConnectedTwice() {
        var connections = SourceConnections<UInt32>()
        for endpoint in connections.toConnect(present: [7, 9]) {
            connections.didConnect(endpoint)
        }
        XCTAssertEqual(connections.toConnect(present: [7, 9]), [])
    }

    func testAHotPluggedSourceIsConnected() {
        var connections = SourceConnections<UInt32>()
        connections.didConnect(7)
        XCTAssertEqual(connections.toConnect(present: [7, 12]), [12])
    }

    /// Unplug, then plug back in: CoreMIDI dropped the connection with the
    /// source, so the same endpoint has to be connected again.
    func testASourceThatLeftAndCameBackIsConnectedAgain() {
        var connections = SourceConnections<UInt32>()
        connections.didConnect(7)
        XCTAssertEqual(connections.toConnect(present: []), [])
        XCTAssertEqual(connections.connected, [])
        XCTAssertEqual(connections.toConnect(present: [7]), [7])
    }

    /// Removed and re-added inside one refresh: the removal notification
    /// forgets it, so the refresh still reconnects it.
    func testAForgottenSourceIsConnectedAgainEvenIfStillPresent() {
        var connections = SourceConnections<UInt32>()
        connections.didConnect(7)
        connections.forget(7)
        XCTAssertEqual(connections.toConnect(present: [7]), [7])
    }

    func testAFailedConnectIsRetriedOnTheNextChange() {
        var connections = SourceConnections<UInt32>()
        XCTAssertEqual(connections.toConnect(present: [7]), [7])
        // `MIDIPortConnectSource` failed, so `didConnect` was never called.
        XCTAssertEqual(connections.toConnect(present: [7]), [7])
    }

    func testADuplicateEndpointIsConnectedOnce() {
        var connections = SourceConnections<UInt32>()
        XCTAssertEqual(connections.toConnect(present: [7, 7, 9]), [7, 9])
    }
}

final class BridgedMidiSourceTests: XCTestCase {
    func testTheIdIsTheUniqueIdAsAString() {
        let source = BridgedMidiSource(
            uniqueID: -1_234_567, displayName: "Digital Piano",
            name: "Port 1", manufacturer: "Roland")
        XCTAssertEqual(source.id, "-1234567")
        XCTAssertEqual(
            source.bridged,
            ["id": "-1234567", "name": "Digital Piano", "manufacturer": "Roland"])
    }

    func testTheDisplayNameWinsAndTheNameIsItsFallback() {
        XCTAssertEqual(
            BridgedMidiSource(
                uniqueID: 1, displayName: nil, name: "Port 1", manufacturer: nil
            ).name,
            "Port 1")
        XCTAssertEqual(
            BridgedMidiSource(
                uniqueID: 1, displayName: "  ", name: "Port 1", manufacturer: nil
            ).name,
            "Port 1")
        XCTAssertEqual(
            BridgedMidiSource(
                uniqueID: 1, displayName: nil, name: nil, manufacturer: nil
            ).name,
            BridgedMidiSource.unnamed)
    }

    func testAMissingManufacturerIsEmpty() {
        let source = BridgedMidiSource(
            uniqueID: 1, displayName: "Keys", name: nil, manufacturer: nil)
        XCTAssertEqual(source.manufacturer, "")
    }

    func testNamesAreTrimmed() {
        let source = BridgedMidiSource(
            uniqueID: 1, displayName: " Keys\n", name: nil, manufacturer: " Yamaha ")
        XCTAssertEqual(source.name, "Keys")
        XCTAssertEqual(source.manufacturer, "Yamaha")
    }
}
