// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "ClawBodyNative",
    platforms: [.macOS(.v13)],
    products: [
        .library(name: "ClawBodyNative", type: .static, targets: ["ClawBodyNative"])
    ],
    dependencies: [
        .package(url: "https://github.com/Brendonovich/swift-rs", from: "1.0.7")
    ],
    targets: [
        .target(
            name: "ClawBodyNative",
            dependencies: [
                .product(name: "SwiftRs", package: "swift-rs")
            ],
            path: "Sources",
            linkerSettings: [
                .linkedFramework("Speech"),
                .linkedFramework("AVFoundation")
            ]
        )
    ]
)
