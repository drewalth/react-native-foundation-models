import Foundation

// MARK: - ToolBridge

/// Bridges tool calls between Swift FoundationModels and JavaScript handlers.
///
/// Simplified architecture without UUID tracking:
/// - Tool calls within a `respond` call are sequential
/// - Only one continuation is needed at a time
/// - Events signal JS, JS responds via function call
@available(iOS 26.0, *)
final class ToolBridge: @unchecked Sendable {

    // MARK: Internal

    /// Timeout for tool calls in seconds.
    var toolCallTimeout: TimeInterval = 30.0

    /// Event emitter closure to send tool call requests to JavaScript.
    var sendToolCallEvent: ((_ toolName: String, _ arguments: [String: Any]) -> Void)?

    /// Current pending continuation for the active tool call.
    /// Only one tool call can be in-flight at a time (sequential model).
    private var pendingContinuation: CheckedContinuation<String, Error>?

    /// Lock for thread-safe continuation access.
    private let lock = NSLock()

    /// Called by JavaScript to provide the tool call result.
    func handleToolResponse(result: String?, error: String?) {
        lock.lock()
        let continuation = pendingContinuation
        pendingContinuation = nil
        lock.unlock()

        guard let continuation else {
            print("[ToolBridge] Warning: handleToolResponse called with no pending call")
            return
        }

        if let error {
            continuation.resume(throwing: ToolBridgeError.handlerError(error))
        } else if let result {
            continuation.resume(returning: result)
        } else {
            continuation.resume(throwing: ToolBridgeError.invalidResult)
        }
    }

    /// Calls a JavaScript tool handler and waits for the result.
    func callJavaScript(toolName: String, arguments: [String: Any]) async throws -> String {
        guard let sendToolCallEvent else {
            throw ToolBridgeError.eventEmitterNotSet
        }

        return try await withThrowingTaskGroup(of: String.self) { group in
            group.addTask {
                try await withCheckedThrowingContinuation { continuation in
                    self.lock.lock()
                    self.pendingContinuation = continuation
                    self.lock.unlock()

                    // Signal JavaScript to execute the tool
                    sendToolCallEvent(toolName, arguments)
                }
            }

            group.addTask {
                try await Task.sleep(for: .seconds(self.toolCallTimeout))
                throw ToolBridgeError.timeout(toolName)
            }

            guard let result = try await group.next() else {
                throw ToolBridgeError.invalidResult
            }
            group.cancelAll()
            return result
        }
    }
}

// MARK: - ToolBridgeError

enum ToolBridgeError: LocalizedError {
    case eventEmitterNotSet
    case timeout(String)
    case handlerError(String)
    case invalidResult

    var errorDescription: String? {
        switch self {
        case .eventEmitterNotSet:
            return "Tool bridge event emitter not configured"
        case .timeout(let toolName):
            return "Tool call '\(toolName)' timed out waiting for JavaScript response"
        case .handlerError(let message):
            return "Tool handler error: \(message)"
        case .invalidResult:
            return "Tool handler did not return a valid string result"
        }
    }
}
