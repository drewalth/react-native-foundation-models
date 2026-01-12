import { requireNativeModule, type EventSubscription } from "expo-modules-core";

import type { ToolHandlers, ToolName } from "./generated/tools";

/**
 * Event payload when the model calls a tool.
 */
interface ToolCallEvent {
  requestId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

/**
 * Events emitted by the native module.
 */
interface ModuleEvents {
  onToolCall: (event: ToolCallEvent) => void;
}

interface NativeToolModule {
  respondToToolCall(
    requestId: string,
    result: string | null,
    error: string | null
  ): void;
  addListener<K extends keyof ModuleEvents>(
    eventName: K,
    listener: ModuleEvents[K]
  ): EventSubscription;
}

const NativeModule = requireNativeModule<NativeToolModule>(
  "ReactNativeFoundationModels"
);

let currentHandlers: Record<
  string,
  (args: unknown) => Promise<string> | string
> | null = null;
let subscription: EventSubscription | null = null;

/**
 * Register tool handlers that will be called when the model invokes tools.
 *
 * You must register handlers before calling `generateResponse` if your
 * configuration includes tools. Each handler receives typed arguments
 * and must return a string result (or a Promise resolving to a string).
 *
 * @param handlers - Object mapping tool names to handler functions
 *
 * @example
 * ```typescript
 * import { registerToolHandlers } from 'react-native-foundation-models';
 *
 * registerToolHandlers({
 *   getWeather: async ({ city, unit }) => {
 *     const weather = await fetchWeather(city, unit);
 *     return `${weather.temp}° ${weather.condition}`;
 *   },
 *   getCurrentTime: () => {
 *     return new Date().toLocaleTimeString();
 *   },
 * });
 * ```
 */
export function registerToolHandlers(handlers: ToolHandlers): void {
  // Store handlers with type erasure for internal use
  currentHandlers = handlers as unknown as Record<
    string,
    (args: unknown) => Promise<string> | string
  >;

  // Remove existing subscription if any
  if (subscription) {
    subscription.remove();
    subscription = null;
  }

  // Set up event listener
  subscription = NativeModule.addListener("onToolCall", async (event) => {
    const { requestId, toolName, arguments: args } = event;

    if (!currentHandlers) {
      NativeModule.respondToToolCall(
        requestId,
        null,
        "No tool handlers registered"
      );
      return;
    }

    const handler = currentHandlers[toolName];
    if (!handler) {
      NativeModule.respondToToolCall(
        requestId,
        null,
        `No handler registered for tool "${toolName}"`
      );
      return;
    }

    try {
      const result = await handler(args);
      NativeModule.respondToToolCall(requestId, result, null);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      NativeModule.respondToToolCall(requestId, null, errorMessage);
    }
  });
}

/**
 * Unregister all tool handlers and clean up event listeners.
 *
 * Call this when you no longer need tool support or when cleaning up.
 */
export function unregisterToolHandlers(): void {
  if (subscription) {
    subscription.remove();
    subscription = null;
  }
  currentHandlers = null;
}

/**
 * Check if a specific tool handler is registered.
 *
 * @param toolName - The name of the tool to check
 * @returns true if a handler is registered for this tool
 */
export function isToolHandlerRegistered(toolName: ToolName): boolean {
  return currentHandlers !== null && toolName in currentHandlers;
}
