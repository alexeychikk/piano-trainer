import ShellKit
import XCTest

final class SharedFileTests: XCTestCase {
    func testTheBackupNameIsKeptAsItIs() {
        XCTAssertEqual(
            SharedFile.safeName("piano-trainer-2026-10-04.json"),
            "piano-trainer-2026-10-04.json")
    }

    func testANameCannotLeaveTheDirectory() {
        XCTAssertEqual(SharedFile.safeName("../../etc/passwd"), "-..-etc-passwd")
        XCTAssertEqual(SharedFile.safeName("a/b\\c:d.json"), "a-b-c-d.json")
        XCTAssertEqual(SharedFile.safeName("..."), "download")
        XCTAssertEqual(SharedFile.safeName(".hidden.json"), "hidden.json")
    }

    func testControlCharactersAndSpaceAreCleanedUp() {
        XCTAssertEqual(SharedFile.safeName("  back\nup.json \t"), "back-up.json")
    }

    func testNoUsableNameFallsBack() {
        XCTAssertEqual(SharedFile.safeName(nil), "download")
        XCTAssertEqual(SharedFile.safeName(""), "download")
        XCTAssertEqual(SharedFile.safeName("   "), "download")
    }

    func testAnOverLongNameKeepsItsExtension() {
        let name = SharedFile.safeName(String(repeating: "é", count: 300) + ".json")
        XCTAssertLessThanOrEqual(name.utf8.count, SharedFile.maxNameBytes)
        XCTAssertTrue(name.hasSuffix(".json"))
        XCTAssertTrue(name.hasPrefix("éé"))
    }

    func testTheAnchorIsTheFocusedButton() {
        XCTAssertEqual(
            ShareAnchor.from(
                ["x": 40, "y": 300.5, "width": NSNumber(value: 160), "height": 44.0],
                viewWidth: 1024, viewHeight: 768),
            ShareAnchor(x: 40, y: 300.5, width: 160, height: 44))
    }

    func testTheAnchorIsClippedToTheView() {
        XCTAssertEqual(
            ShareAnchor.from(
                ["x": -10, "y": 740, "width": 100, "height": 60],
                viewWidth: 1024, viewHeight: 768),
            ShareAnchor(x: 0, y: 740, width: 90, height: 28))
    }

    func testNoUsableAnchorCentresThePopover() {
        let view = (width: 1024.0, height: 768.0)
        func anchor(_ values: [String: Any]?) -> ShareAnchor? {
            ShareAnchor.from(values, viewWidth: view.width, viewHeight: view.height)
        }
        XCTAssertNil(anchor(nil))
        XCTAssertNil(anchor(["x": 1, "y": 2, "width": 3]))
        XCTAssertNil(anchor(["x": 1, "y": 2, "width": 0, "height": 4]))
        XCTAssertNil(anchor(["x": "1", "y": 2, "width": 3, "height": 4]))
        XCTAssertNil(anchor(["x": Double.nan, "y": 2, "width": 3, "height": 4]))
        XCTAssertNil(anchor(["x": 2000, "y": 2, "width": 3, "height": 4]))
    }
}
