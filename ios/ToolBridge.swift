import ExpoModulesCore
import Foundation
import os

let logger: os.Logger = {
    let bundleIdentifier = Bundle.main.bundleIdentifier ?? "com.example.app"
    return Logger(subsystem: bundleIdentifier, category: "FoundationModels")
}()

// MARK: - ToolCallRequest

/// Represents a pending tool call waiting for JavaScript response.
struct ToolCallRequest {
    let id: String
    let toolName: String
    let arguments: [String: Any]
}

// MARK: - ToolCallManager

/// Actor to manage pending tool calls in a thread-safe manner.
@available(iOS 26.0, *)
actor ToolCallManager {

    // MARK: Internal

    func addPendingCall(requestId: String, continuation: CheckedContinuation<String, Error>) {
        logger.debug("Adding pending call for request ID: \(requestId)")
        pendingCalls[requestId] = continuation
    }

    func removePendingCall(requestId: String) -> CheckedContinuation<String, Error>? {
        logger.debug("Removing pending call for request ID: \(requestId)")
        return pendingCalls.removeValue(forKey: requestId)
    }

    func hasPendingCall(requestId: String) -> Bool {
        logger.debug("Checking if there is a pending call for request ID: \(requestId)")
        return pendingCalls[requestId] != nil
    }

    // MARK: Private

    private var pendingCalls: [String: CheckedContinuation<String, Error>] = [:]

}

// MARK: - ToolBridge

/// Bridges tool calls between Swift FoundationModels and JavaScript handlers.
///
/// When a tool is called by the model:
/// 1. Swift generates a unique request ID
/// 2. Emits an "onToolCall" event to JavaScript with the request details
/// 3. Suspends execution using CheckedContinuation
/// 4. JavaScript handler executes and calls respondToToolCall(id, result)
/// 5. Swift resumes with the result
@available(iOS 26.0, *)
final class ToolBridge: @unchecked Sendable {

    // MARK: Lifecycle

    init() {
        callManager = ToolCallManager()
    }

    // MARK: Internal

    /// Timeout for tool calls in seconds.
    var toolCallTimeout: TimeInterval = 30.0

    /// Event sender closure that takes the event payload.
    var sendToolCallEvent: ((_ requestId: String, _ toolName: String, _ arguments: [String: Any]) -> Void)?

    /// Called by JavaScript to provide a tool call result.
    func handleToolResponse(requestId: String, result: String?, error: String?) {
        Task {
            guard let continuation = await callManager.removePendingCall(requestId: requestId) else {
                print("[ToolBridge] Warning: No pending call found for request ID: \(requestId)")
                return
            }

            if let error {
                continuation.resume(throwing: ToolBridgeError.handlerError(error))
            } else if let result {
                continuation.resume(returning: result)
            } else {
                continuation.resume(throwing: ToolBridgeError.noResult)
            }
        }
    }

    /// Calls a JavaScript tool handler and waits for the result.
    func callJavaScript(toolName: String, arguments: [String: Any]) async throws -> String {
        let requestId = UUID().uuidString

        return try await withCheckedThrowingContinuation { continuation in
            Task {
                // Store the continuation
                await callManager.addPendingCall(requestId: requestId, continuation: continuation)

                // Emit event to JavaScript
                if let sendToolCallEvent {
                    sendToolCallEvent(requestId, toolName, arguments)
                } else {
                    await callManager.removePendingCall(requestId: requestId)
                    continuation.resume(throwing: ToolBridgeError.eventEmitterNotSet)
                    return
                }

                // Set up timeout
                Task {
                    try? await Task.sleep(for: .seconds(toolCallTimeout))

                    if let pendingContinuation = await callManager.removePendingCall(requestId: requestId) {
                        pendingContinuation.resume(throwing: ToolBridgeError.timeout(toolName))
                    }
                }
            }
        }
    }

    // MARK: Private

    private let callManager: ToolCallManager

}

// MARK: - ToolBridgeError

enum ToolBridgeError: LocalizedError {
    case eventEmitterNotSet
    case timeout(String)
    case handlerError(String)
    case noResult

    // MARK: Internal

    var errorDescription: String? {
        switch self {
        case .eventEmitterNotSet:
            return "Tool bridge event emitter not configured"
        case .timeout(let toolName):
            return "Tool call '\(toolName)' timed out waiting for JavaScript response"
        case .handlerError(let message):
            return "Tool handler error: \(message)"
        case .noResult:
            return "Tool handler did not return a result"
        }
    }
}
