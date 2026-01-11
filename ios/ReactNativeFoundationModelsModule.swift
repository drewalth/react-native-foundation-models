import ExpoModulesCore
import FoundationModels

public class ReactNativeFoundationModelsModule: Module {
    
    /// Recursively checks if an NSError or its underlying errors contain a ModelManagerError with the specified code
    private func containsModelManagerError(_ error: NSError, code: Int) -> Bool {
        // Check if this error itself is a ModelManagerError with the target code
        if error.domain.contains("ModelManagerError") && error.code == code {
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
    
    public func definition() -> ModuleDefinition {
        Name("ReactNativeFoundationModels")

        // Check if FoundationModels is available on this device
        Function("isAvailable") { () -> Bool in
            if #available(iOS 26.0, *) {
                return SystemLanguageModel.default.isAvailable
            }
            return false
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

            let session: LanguageModelSession

            if let instructions = options.config?.instructions {
                session = LanguageModelSession(model: model, instructions: instructions)
            } else {
                session = LanguageModelSession(model: model)
            }

            do {
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
}

// MARK: - Types

struct SessionConfig: Record {
    @Field var instructions: String?
}

struct GenerateOptions: Record {
    @Field var prompt: String = ""
    @Field var config: SessionConfig?
}

struct GenerateResponse: Record {
    @Field var content: String = ""
}

// MARK: - Errors

enum FoundationModelsError: Error {
    case unavailable
    case appleIntelligenceNotEnabled
    case generationFailed(String)
}

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
