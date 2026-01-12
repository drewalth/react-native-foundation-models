import ExpoModulesCore
import FoundationModels

// MARK: - ReactNativeFoundationModelsModule

public class ReactNativeFoundationModelsModule: Module {

    // MARK: Public

    public func definition() -> ModuleDefinition {
        Name("ReactNativeFoundationModels")

        // Define events that can be sent to JavaScript
        Events("onToolCall")

        // Check if FoundationModels is available on this device
        Function("isAvailable") { () -> Bool in
            if #available(iOS 26.0, *) {
                return SystemLanguageModel.default.isAvailable
            }
            return false
        }

        // Respond to a tool call from JavaScript
        Function("respondToToolCall") { (requestId: String, result: String?, error: String?) in
            guard #available(iOS 26.0, *) else { return }
            self.toolBridge?.handleToolResponse(requestId: requestId, result: result, error: error)
        }

        // Generate a response using FoundationModels
        AsyncFunction("generateResponse") { (options: GenerateOptions) -> GenerateResponse in
            guard #available(iOS 26.0, *) else {
                throw FoundationModelsError.unavailable
            }

            let model = SystemLanguageModel.default

            guard model.isAvailable else {
                throw FoundationModelsError.unavailable
            }

            // Create tool bridge if not exists
            if self.toolBridge == nil {
                self.toolBridge = ToolBridge()
                self.toolBridge?.sendToolCallEvent = { [weak self] requestId, toolName, arguments in
                    self?.sendEvent("onToolCall", [
                        "requestId": requestId,
                        "toolName": toolName,
                        "arguments": arguments
                    ])
                }
            }

            do {
                let session: LanguageModelSession

                if hasGeneratedTools() {
                    // Use session with generated tools
                    session = createSessionWithTools(
                        model: model,
                        instructions: options.config?.instructions,
                        bridge: self.toolBridge!)
                } else {
                    // No tools - use simple session
                    if let instructions = options.config?.instructions {
                        session = LanguageModelSession(model: model, instructions: instructions)
                    } else {
                        session = LanguageModelSession(model: model)
                    }
                }

                let response = try await session.respond(to: options.prompt)
                return GenerateResponse(content: response.content)
            } catch let error as NSError {
                // Check for ModelManagerError code 1026 - Apple Intelligence not enabled or version mismatch
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

    /// Tool bridge for communicating with JavaScript handlers.
    private var toolBridge: ToolBridge?

    /// Recursively checks if an NSError or its underlying errors contain a ModelManagerError with the specified code
    private func containsModelManagerError(_ error: NSError, code: Int) -> Bool {
        // Check if this error itself is a ModelManagerError with the target code
        if error.domain.contains("ModelManagerError"), error.code == code {
            return true
        }

        // Check underlying error
        if let underlying = error.userInfo[NSUnderlyingErrorKey] as? NSError {
            if containsModelManagerError(underlying, code: code) {
                return true
            }
        }

        // Check multiple underlying errors
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

// MARK: - FoundationModelsError

enum FoundationModelsError: Error {
    case unavailable
    case appleIntelligenceNotEnabled
    case generationFailed(String)
}

// MARK: LocalizedError

extension FoundationModelsError: LocalizedError {
    var errorDescription: String? {
        switch self {
        case .unavailable:
            return "FoundationModels is not available on this device"
        case .appleIntelligenceNotEnabled:
            return "Apple Intelligence is not enabled or there is a version mismatch. Ensure Apple Intelligence is enabled in Settings > Apple Intelligence & Siri, and that your iOS simulator version matches your macOS version."
        case .generationFailed(let message):
            return "Generation failed: \(message)"
        }
    }
}
