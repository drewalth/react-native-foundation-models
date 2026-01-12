// Session-based API (recommended)
export {
  FoundationModelSession,
  type FoundationModelSessionConfig,
} from "./FoundationModelSession";

// Utility functions
export { isAvailable } from "./ReactNativeFoundationModelsModule";

// Legacy API (deprecated - use FoundationModelSession instead)
export { generateResponse } from "./ReactNativeFoundationModelsModule";
export {
  registerToolHandlers,
  unregisterToolHandlers,
  isToolHandlerRegistered,
} from "./tools";

// Types
export type {
  SessionConfig,
  GenerateOptions,
  GenerateResponse,
  Message,
  FoundationModelsErrorCode,
} from "./ReactNativeFoundationModels.types";
export type { ToolHandlers, ToolName } from "./generated/tools";
