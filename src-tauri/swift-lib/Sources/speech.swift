/// ClawBody Native Speech Recognition
/// Uses macOS SFSpeechRecognizer for on-device / cloud speech-to-text.
/// Exposes C-compatible functions via @_cdecl for swift-rs FFI.

import Foundation
import Speech
import AVFoundation
import SwiftRs

// MARK: - Thread-safe State

private let lock = NSLock()
private var currentText: String = ""
private var currentIsFinal: Bool = false
private var currentError: String = ""
private var currentIsRunning: Bool = false

private var audioEngine: AVAudioEngine?
private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
private var recognitionTask: SFSpeechRecognitionTask?

private func setState(text: String? = nil, isFinal: Bool? = nil, error: String? = nil, isRunning: Bool? = nil) {
    lock.lock()
    if let t = text { currentText = t }
    if let f = isFinal { currentIsFinal = f }
    if let e = error { currentError = e }
    if let r = isRunning { currentIsRunning = r }
    lock.unlock()
}

private func resetState() {
    lock.lock()
    currentText = ""
    currentIsFinal = false
    currentError = ""
    currentIsRunning = false
    lock.unlock()
}

// MARK: - Recognition Logic

private func doStop() {
    audioEngine?.stop()
    audioEngine?.inputNode.removeTap(onBus: 0)
    recognitionRequest?.endAudio()
    recognitionTask?.cancel()
    audioEngine = nil
    recognitionRequest = nil
    recognitionTask = nil
}

private func doStart(locale: String) {
    doStop()

    guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: locale)),
          recognizer.isAvailable else {
        setState(error: "recognizer-unavailable", isRunning: false)
        return
    }

    let engine = AVAudioEngine()
    let request = SFSpeechAudioBufferRecognitionRequest()
    request.shouldReportPartialResults = true

    let inputNode = engine.inputNode
    let format = inputNode.outputFormat(forBus: 0)

    inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
        request.append(buffer)
    }

    do {
        engine.prepare()
        try engine.start()
    } catch {
        setState(error: "audio-engine-failed: \(error.localizedDescription)", isRunning: false)
        return
    }

    audioEngine = engine
    recognitionRequest = request
    setState(text: "", isFinal: false, error: "", isRunning: true)

    recognitionTask = recognizer.recognitionTask(with: request) { result, error in
        if let result = result {
            let text = result.bestTranscription.formattedString
            if result.isFinal {
                setState(text: text, isFinal: true, isRunning: false)
                doStop()
            } else {
                setState(text: text, isFinal: false, isRunning: true)
            }
        }
        if let error = error {
            let nsError = error as NSError
            // Ignore user-initiated cancellation
            if nsError.domain == "kAFAssistantErrorDomain" && nsError.code == 216 { return }
            if nsError.domain == "kAFAssistantErrorDomain" && nsError.code == 209 { return }
            setState(error: error.localizedDescription, isRunning: false)
        }
    }
}

// MARK: - Exported FFI Functions

@_cdecl("native_speech_available")
public func nativeSpeechAvailable() -> Bool {
    if #available(macOS 10.15, *) {
        return SFSpeechRecognizer.self != nil
    }
    return false
}

@_cdecl("native_speech_start")
public func nativeSpeechStart(lang: SRString) {
    let locale = lang.toString()
    resetState()

    SFSpeechRecognizer.requestAuthorization { status in
        switch status {
        case .authorized:
            DispatchQueue.main.async {
                doStart(locale: locale)
            }
        case .denied:
            setState(error: "permission-denied", isRunning: false)
        case .restricted:
            setState(error: "permission-restricted", isRunning: false)
        case .notDetermined:
            setState(error: "permission-not-determined", isRunning: false)
        @unknown default:
            setState(error: "permission-unknown", isRunning: false)
        }
    }
}

@_cdecl("native_speech_stop")
public func nativeSpeechStop() {
    DispatchQueue.main.async {
        doStop()
        lock.lock()
        if !currentText.isEmpty && !currentIsFinal {
            currentIsFinal = true
        }
        currentIsRunning = false
        lock.unlock()
    }
}

@_cdecl("native_speech_poll")
public func nativeSpeechPoll() -> SRString {
    lock.lock()
    let status: String
    if !currentError.isEmpty {
        status = "error"
    } else if currentIsFinal {
        status = "final"
    } else if currentIsRunning {
        status = "running"
    } else {
        status = "idle"
    }
    let result = "\(status)|\(currentText)|\(currentError)"
    lock.unlock()
    return SRString(result)
}
