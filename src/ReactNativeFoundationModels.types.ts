/**
 * Configuration options for a FoundationModels session.
 */
export interface SessionConfig {
  /**
   * System instructions that guide the model's behavior.
   * This sets the context and constraints for all responses in the session.
   */
  instructions?: string;
}

/**
 * Options for generating a response.
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
}
