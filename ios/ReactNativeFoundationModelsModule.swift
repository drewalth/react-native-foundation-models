import ExpoModulesCore
import FoundationModels

// MARK: - ReactNativeFoundationModelsModule

public class ReactNativeFoundationModelsModule: Module {

    // MARK: Public

    public func definition() -> ModuleDefinition {
        Name("ReactNativeFoundationModels")

        // Events
        Events("onToolCall", "onStreamUpdate", "onStreamComplete", "onStreamError")

        // Check if FoundationModels is available on this device
        Function("isAvailable") { () -> Bool in
            if #available(iOS 26.0, *) {
                return SystemLanguageModel.default.isAvailable
            }
            return false
        }

        // Respond to a tool call from JavaScript (simplified - no requestId needed)
        Function("respondToToolCall") { (result: String?, error: String?) in
            guard #available(iOS 26.0, *) else { return }
            self.log("respondToToolCall called from JS", "result: \(result?.prefix(100) ?? "nil"), error: \(error ?? "nil")")
            self.toolBridge?.handleToolResponse(result: result, error: error)
        }

        // Create a new session with the given configuration
        Function("createSession") { (config: SessionConfig?) in
            guard #available(iOS 26.0, *) else {
                throw FoundationModelsError.unavailable
            }

            // Set debug flag
            self.debugEnabled = config?.debug ?? false
            self.log("createSession called", config?.instructions ?? "no instructions")

            let model = SystemLanguageModel.default

            guard model.isAvailable else {
                self.log("Model is not available")
                throw FoundationModelsError.unavailable
            }

            // Store the config for session recreation
            self.currentSessionConfig = config

            // Set up tool bridge
            self.log("Setting up tool bridge")
            self.setupToolBridge()

            // Create the session
            self.log("Creating language model session")
            self.currentSession = self.createLanguageModelSession(model: model, config: config)
            self.log("Session created successfully")
        }

        // Send a message to the current session
        AsyncFunction("sendMessage") { (prompt: String) -> GenerateResponse in
            guard #available(iOS 26.0, *) else {
                throw FoundationModelsError.unavailable
            }

            self.log("sendMessage called", "prompt length: \(prompt.count)")

            guard let session = self.currentSession else {
                self.log("sendMessage failed: No active session")
                throw FoundationModelsError.noActiveSession
            }

            do {
                self.log("Calling session.respond()")
                let response = try await session.respond(to: prompt)
                self.log("sendMessage completed", "response length: \(response.content.count)")
                return GenerateResponse(content: response.content)
            } catch let error as NSError {
                self.log("sendMessage error", error.localizedDescription)
                if self.containsModelManagerError(error, code: 1026) {
                    throw FoundationModelsError.appleIntelligenceNotEnabled
                }
                throw FoundationModelsError.generationFailed(error.localizedDescription)
            } catch {
                self.log("sendMessage error", error.localizedDescription)
                throw FoundationModelsError.generationFailed(error.localizedDescription)
            }
        }

        // Get the conversation history from the current session
        Function("getHistory") { () -> [MessageRecord] in
            guard #available(iOS 26.0, *) else {
                return []
            }

            guard let session = self.currentSession else {
                return []
            }

            // Transcript conforms to Sequence, iterate directly
            return session.transcript.compactMap { entry -> MessageRecord? in
                switch entry {
                case .prompt(let prompt):
                    return MessageRecord(role: "user", content: "\(prompt)")
                case .response(let response):
                    return MessageRecord(role: "assistant", content: "\(response)")
                @unknown default:
                    return nil
                }
            }
        }

        // Clear the session history (recreates session with same config)
        Function("clearSession") {
            guard #available(iOS 26.0, *) else { return }

            let model = SystemLanguageModel.default

            guard model.isAvailable else { return }

            // Recreate session with stored config
            self.currentSession = self.createLanguageModelSession(
                model: model,
                config: self.currentSessionConfig)
        }

        // Destroy the current session
        Function("destroySession") {
            self.log("destroySession called")
            self.currentSession = nil
            self.currentSessionConfig = nil
            self.log("Session destroyed")
        }

        // Start streaming response
        AsyncFunction("startStream") { (prompt: String) -> String in
            guard #available(iOS 26.0, *) else {
                throw FoundationModelsError.unavailable
            }

            self.log("startStream called", "prompt length: \(prompt.count)")

            guard let session = self.currentSession else {
                self.log("startStream failed: No active session")
                throw FoundationModelsError.noActiveSession
            }

            // Generate unique stream ID
            let streamId = UUID().uuidString
            self.log("Stream started", "streamId: \(streamId)")

            // Start async task that iterates over stream responses
            let task = Task {
                do {
                    var lastContent = ""
                    var chunkCount = 0
                    for try await partial in session.streamResponse(to: prompt) {
                        let currentContent = partial.content
                        let delta = String(currentContent.dropFirst(lastContent.count))
                        lastContent = currentContent
                        chunkCount += 1

                        self.log("Stream update", "chunk #\(chunkCount), delta length: \(delta.count), accumulated: \(currentContent.count)")

                        self.sendEvent("onStreamUpdate", [
                            "streamId": streamId,
                            "delta": delta,
                            "accumulated": currentContent
                        ])
                    }
                    self.log("Stream completed", "streamId: \(streamId), total content length: \(lastContent.count)")
                    self.sendEvent("onStreamComplete", [
                        "streamId": streamId,
                        "content": lastContent
                    ])
                } catch let error as NSError {
                    self.log("Stream error", error.localizedDescription)
                    if self.containsModelManagerError(error, code: 1026) {
                        let errorMessage = """
              Apple Intelligence is not enabled or there is a version mismatch. \
              Ensure Apple Intelligence is enabled in Settings > Apple Intelligence & Siri, \
              and that your iOS simulator version matches your macOS version.
              """
                        self.sendEvent("onStreamError", [
                            "streamId": streamId,
                            "error": errorMessage
                        ])
                    } else {
                        self.sendEvent("onStreamError", [
                            "streamId": streamId,
                            "error": error.localizedDescription
                        ])
                    }
                } catch {
                    self.log("Stream error", error.localizedDescription)
                    self.sendEvent("onStreamError", [
                        "streamId": streamId,
                        "error": error.localizedDescription
                    ])
                }
                self.activeStreams.removeValue(forKey: streamId)
            }

            self.activeStreams[streamId] = task
            return streamId
        }

        // Cancel active stream
        Function("cancelStream") { (streamId: String) in
            self.log("cancelStream called", "streamId: \(streamId)")
            guard let task = self.activeStreams[streamId] else {
                self.log("cancelStream: Stream not found")
                return
            }
            task.cancel()
            self.activeStreams.removeValue(forKey: streamId)
            self.log("Stream cancelled successfully")
        }

        // Legacy: Generate a response (creates ephemeral session)
        // Kept for backwards compatibility
        AsyncFunction("generateResponse") { (options: GenerateOptions) -> GenerateResponse in
            guard #available(iOS 26.0, *) else {
                throw FoundationModelsError.unavailable
            }

            let model = SystemLanguageModel.default

            guard model.isAvailable else {
                throw FoundationModelsError.unavailable
            }

            // Set up tool bridge
            self.setupToolBridge()

            do {
                let session: LanguageModelSession

                if hasGeneratedTools() {
                    session = createSessionWithTools(
                        model: model,
                        instructions: options.config?.instructions,
                        bridge: self.toolBridge!)
                } else {
                    if let instructions = options.config?.instructions {
                        session = LanguageModelSession(model: model, instructions: instructions)
                    } else {
                        session = LanguageModelSession(model: model)
                    }
                }

                let response = try await session.respond(to: options.prompt)
                return GenerateResponse(content: response.content)
            } catch let error as NSError {
                if self.containsModelManagerError(error, code: 1026) {
                    throw FoundationModelsError.appleIntelligenceNotEnabled
                }
                throw FoundationModelsError.generationFailed(error.localizedDescription)
            } catch {
                throw FoundationModelsError.generationFailed(error.localizedDescription)
            }
        }
    }

    // MARK: Private

    private var toolBridge: ToolBridge?
    private var _currentSession: Any?
    private var currentSessionConfig: SessionConfig?
    private var activeStreams: [String: Task<Void, Never>] = [:]
    private var debugEnabled = false

    @available(iOS 26.0, *)
    private var currentSession: LanguageModelSession? {
        get { _currentSession as? LanguageModelSession }
        set { _currentSession = newValue }
    }

    private func log(_ message: String, _ data: Any? = nil) {
        guard debugEnabled else { return }
        if let data {
            print("[FoundationModels:iOS] \(message): \(data)")
        } else {
            print("[FoundationModels:iOS] \(message)")
        }
    }

    private func setupToolBridge() {
        if toolBridge == nil {
            if #available(iOS 26.0, *) {
                toolBridge = ToolBridge()
                toolBridge?.debugEnabled = debugEnabled
                toolBridge?.sendToolCallEvent = { [weak self] toolName, arguments in
                    self?.sendEvent("onToolCall", [
                        "toolName": toolName,
                        "arguments": arguments
                    ])
                }
            }
        }
    }

    @available(iOS 26.0, *)
    private func createLanguageModelSession(
        model: SystemLanguageModel,
        config: SessionConfig?)
    -> LanguageModelSession {
        if hasGeneratedTools(), let bridge = toolBridge {
            return createSessionWithTools(
                model: model,
                instructions: config?.instructions,
                bridge: bridge)
        } else {
            if let instructions = config?.instructions {
                return LanguageModelSession(model: model, instructions: instructions)
            } else {
                return LanguageModelSession(model: model)
            }
        }
    }

    private func containsModelManagerError(_ error: NSError, code: Int) -> Bool {
        if error.domain.contains("ModelManagerError"), error.code == code {
            return true
        }

        if let underlying = error.userInfo[NSUnderlyingErrorKey] as? NSError {
            if containsModelManagerError(underlying, code: code) {
                return true
            }
        }

        if let multipleErrors = error.userInfo["NSMultipleUnderlyingErrorsKey"] as? [NSError] {
            for underlyingError in multipleErrors {
                if containsModelManagerError(underlyingError, code: code) {
                    return true
                }
            }
        }

        return false
    }
}

// MARK: - SessionConfig

struct SessionConfig: Record {
    @Field var instructions: String?
    @Field var debug = false
}

// MARK: - GenerateOptions

struct GenerateOptions: Record {
    @Field var prompt = ""
    @Field var config: SessionConfig?
}

// MARK: - GenerateResponse

struct GenerateResponse: Record {
    @Field var content = ""
}

// MARK: - MessageRecord

struct MessageRecord: Record {
    @Field var role = ""
    @Field var content = ""

    init() { }

    init(role: String, content: String) {
        self.role = role
        self.content = content
    }
}

// MARK: - FoundationModelsError

enum FoundationModelsError: Error {
    case unavailable
    case appleIntelligenceNotEnabled
    case noActiveSession
    case generationFailed(String)
}

// MARK: LocalizedError

extension FoundationModelsError: LocalizedError {
    var errorDescription: String? {
        switch self {
        case .unavailable:
            return "FoundationModels is not available on this device"
        case .appleIntelligenceNotEnabled:
            return """
        Apple Intelligence is not enabled or there is a version mismatch. \
        Ensure Apple Intelligence is enabled in Settings > Apple Intelligence & Siri, \
        and that your iOS simulator version matches your macOS version.
        """
        case .noActiveSession:
            return "No active session. Call createSession() first."
        case .generationFailed(let message):
            return "Generation failed: \(message)"
        }
    }
}
