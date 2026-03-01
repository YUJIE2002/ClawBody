fn main() {
    #[cfg(target_os = "macos")]
    {
        swift_rs::SwiftLinker::new("13.0")
            .with_package("ClawBodyNative", "./swift-lib/")
            .link();
    }

    tauri_build::build();
}
