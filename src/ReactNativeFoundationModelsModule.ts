import { requireNativeModule } from "expo-modules-core";

import type {
  GenerateOptions,
  GenerateResponse,
} from "./ReactNativeFoundationModels.types";

interface NativeModule {
  isAvailable(): boolean;
  generateResponse(options: GenerateOptions): Promise<GenerateResponse>;
}

const NativeFoundationModels = requireNativeModule<NativeModule>(
  "ReactNativeFoundationModels"
);

/**
 * Check if FoundationModels is available on this device.
 * Requires iOS 26.0+ with Apple Silicon.
 *
 * @returns true if FoundationModels can be used, false otherwise
 */
export function isAvailable(): boolean {
  return NativeFoundationModels.isAvailable();
}

/**
 * Generate a response using Apple's on-device FoundationModels.
 *
 * @deprecated Use `FoundationModelSession` instead for stateful conversations
 * and proper tool lifecycle management.
 *
 * @param options - The generation options including prompt and optional config
 * @returns Promise resolving to the generated response
 * @throws Error if FoundationModels is unavailable or generation fails
 *
 * @example
 * ```typescript
 * // Deprecated approach:
 * const response = await generateResponse({
 *   prompt: "What is the capital of France?",
 *   config: { instructions: "You are a helpful geography assistant." }
 * });
 *
 * // Recommended approach:
 * const session = new FoundationModelSession({
 *   instructions: "You are a helpful geography assistant."
 * });
 * const response = await session.sendMessage("What is the capital of France?");
 * ```
 */
export function generateResponse(
  options: GenerateOptions
): Promise<GenerateResponse> {
  return NativeFoundationModels.generateResponse(options);
}
