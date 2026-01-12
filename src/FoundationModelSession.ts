import {
  requireNativeModule,
  type EventSubscription,
} from "expo-modules-core";

import type {
  SessionConfig,
  GenerateResponse,
  Message,
} from "./ReactNativeFoundationModels.types";
import type { ToolHandlers } from "./generated/tools";

/**
 * Configuration for creating a FoundationModelSession.
 */
export interface FoundationModelSessionConfig extends SessionConfig {
  /**
   * Tool handlers that the model can invoke during conversation.
   * Each handler receives typed arguments and must return a string result.
   */
  tools?: ToolHandlers;
}

/**
 * Event payload when the model calls a tool.
 */
interface ToolCallEvent {
  toolName: string;
  arguments: Record<string, unknown>;
}

/**
 * Native module interface for session management.
 */
interface NativeSessionModule {
  createSession(config: SessionConfig | null): void;
  sendMessage(prompt: string): Promise<GenerateResponse>;
  getHistory(): Message[];
  clearSession(): void;
  destroySession(): void;
  respondToToolCall(result: string | null, error: string | null): void;
  addListener(
    eventName: "onToolCall",
    listener: (event: ToolCallEvent) => void
  ): EventSubscription;
}

const NativeModule = requireNativeModule<NativeSessionModule>(
  "ReactNativeFoundationModels"
);

/**
 * A session for conversing with Apple's on-device FoundationModels.
 *
 * The session maintains conversation history across multiple messages and
 * handles tool invocations automatically. Creating a new session will
 * destroy any existing session (single session at a time).
 *
 * @example
 * ```typescript
 * import { FoundationModelSession } from 'react-native-foundation-models';
 *
 * const session = new FoundationModelSession({
 *   instructions: "You are a helpful assistant.",
 *   tools: {
 *     getCurrentTime: () => new Date().toLocaleTimeString(),
 *     calculate: ({ expression }) => String(eval(expression)),
 *   }
 * });
 *
 * const response = await session.sendMessage("What time is it?");
 * console.log(response.content);
 *
 * // Multi-turn conversation - history is maintained
 * const followUp = await session.sendMessage("And what's 2 + 2?");
 *
 * // Get conversation history
 * const history = session.getHistory();
 *
 * // Clean up when done
 * session.destroy();
 * ```
 */
export class FoundationModelSession {
  private destroyed = false;
  private toolHandlers: Record<
    string,
    (args: unknown) => Promise<string> | string
  > | null = null;
  private toolSubscription: EventSubscription | null = null;

  /**
   * Create a new FoundationModelSession.
   *
   * @param config - Optional configuration including instructions and tool handlers
   * @throws Error if FoundationModels is unavailable on this device
   */
  constructor(config?: FoundationModelSessionConfig) {
    const { tools, ...sessionConfig } = config ?? {};

    // Register tool handlers if provided
    if (tools) {
      this.registerTools(tools);
    }

    // Create native session
    NativeModule.createSession(
      Object.keys(sessionConfig).length > 0 ? sessionConfig : null
    );
  }

  /**
   * Send a message to the model and receive a response.
   *
   * The conversation history is automatically maintained, allowing for
   * multi-turn conversations where the model remembers previous exchanges.
   *
   * @param prompt - The message to send to the model
   * @returns Promise resolving to the model's response
   * @throws Error if the session has been destroyed or generation fails
   */
  async sendMessage(prompt: string): Promise<GenerateResponse> {
    this.ensureNotDestroyed();
    return NativeModule.sendMessage(prompt);
  }

  /**
   * Get the conversation history for this session.
   *
   * @returns Array of messages exchanged in this session
   */
  getHistory(): Message[] {
    this.ensureNotDestroyed();
    return NativeModule.getHistory();
  }

  /**
   * Clear the conversation history.
   *
   * This creates a fresh session with the same configuration (instructions
   * and tools) but removes all previous messages from context.
   */
  clearHistory(): void {
    this.ensureNotDestroyed();
    NativeModule.clearSession();
  }

  /**
   * Destroy this session and clean up resources.
   *
   * After calling destroy(), the session cannot be used. Create a new
   * FoundationModelSession if you need to continue conversing.
   */
  destroy(): void {
    if (this.destroyed) return;

    this.destroyed = true;

    // Clean up tool subscription
    if (this.toolSubscription) {
      this.toolSubscription.remove();
      this.toolSubscription = null;
    }
    this.toolHandlers = null;

    // Destroy native session
    NativeModule.destroySession();
  }

  /**
   * Check if this session has been destroyed.
   */
  get isDestroyed(): boolean {
    return this.destroyed;
  }

  private registerTools(tools: ToolHandlers): void {
    this.toolHandlers = tools as unknown as Record<
      string,
      (args: unknown) => Promise<string> | string
    >;

    this.toolSubscription = NativeModule.addListener(
      "onToolCall",
      async (event) => {
        const { toolName, arguments: args } = event;

        if (!this.toolHandlers) {
          NativeModule.respondToToolCall(null, "No tool handlers registered");
          return;
        }

        const handler = this.toolHandlers[toolName];
        if (!handler) {
          NativeModule.respondToToolCall(
            null,
            `No handler registered for tool "${toolName}"`
          );
          return;
        }

        try {
          const result = await handler(args);
          NativeModule.respondToToolCall(result, null);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          NativeModule.respondToToolCall(null, errorMessage);
        }
      }
    );
  }

  private ensureNotDestroyed(): void {
    if (this.destroyed) {
      throw new Error(
        "Session has been destroyed. Create a new FoundationModelSession to continue."
      );
    }
  }
}
