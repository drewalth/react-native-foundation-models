/**
 * Configuration options for a FoundationModels session.
 */
export interface SessionConfig {
  /**
   * System instructions that guide the model's behavior.
   * This sets the context and constraints for all responses in the session.
   */
  instructions?: string;

  /**
   * Enable debug logging to console.
   * When enabled, logs detailed information about query submission,
   * native bridge calls, streaming updates, and tool invocations.
   * @default false
   */
  debug?: boolean;
}

/**
 * Options for generating a response.
 * @deprecated Use FoundationModelSession.sendMessage() instead
 */
export interface GenerateOptions {
  /**
   * The user prompt to send to the model.
   */
  prompt: string;

  /**
   * Optional session configuration.
   */
  config?: SessionConfig;
}

/**
 * Response from the FoundationModels generation.
 */
export interface GenerateResponse {
  /**
   * The generated text content.
   */
  content: string;
}

/**
 * A chunk of streamed content.
 */
export interface StreamChunk {
  /**
   * The new text delta since the last chunk.
   */
  delta: string;

  /**
   * The full accumulated text so far.
   */
  accumulated: string;
}

/**
 * Final result from a completed stream.
 */
export interface StreamResult {
  /**
   * The final complete content.
   */
  content: string;
}

/**
 * A message in the conversation history.
 */
export interface Message {
  /**
   * The role of the message sender.
   * - "user": A message from the user
   * - "assistant": A response from the model
   */
  role: "user" | "assistant";

  /**
   * The text content of the message.
   */
  content: string;
}

/**
 * Error codes that can be thrown by the module.
 */
export enum FoundationModelsErrorCode {
  /**
   * FoundationModels is not available on this device.
   * Requires iOS 26.0+ with Apple Silicon.
   */
  UNAVAILABLE = "UNAVAILABLE",

  /**
   * The generation request failed.
   */
  GENERATION_FAILED = "GENERATION_FAILED",

  /**
   * No active session exists.
   * Create a FoundationModelSession first.
   */
  NO_ACTIVE_SESSION = "NO_ACTIVE_SESSION",
}
