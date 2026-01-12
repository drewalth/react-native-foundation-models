// Mock expo-modules-core - all logic must be inside the factory
let mockRespondToToolCall: jest.Mock;
let mockAddListener: jest.Mock;
let capturedSubscription: { remove: jest.Mock } | null;

jest.mock("expo-modules-core", () => {
  // Create mocks inside the factory to avoid hoisting issues
  const mocks = {
    respondToToolCall: jest.fn(),
    addListener: jest.fn((_eventName, _listener) => {
      const subscription = { remove: jest.fn() };
      capturedSubscription = subscription;
      return subscription;
    }),
    createSession: jest.fn(),
    sendMessage: jest.fn(),
    startStream: jest.fn(),
    cancelStream: jest.fn(),
    getHistory: jest.fn(),
    clearSession: jest.fn(),
    destroySession: jest.fn(),
    isAvailable: jest.fn(),
    generateResponse: jest.fn(),
  };

  // Expose mocks for test access
  mockRespondToToolCall = mocks.respondToToolCall;
  mockAddListener = mocks.addListener;

  return {
    requireNativeModule: jest.fn(() => mocks),
  };
});

import {
  registerToolHandlers,
  unregisterToolHandlers,
  isToolHandlerRegistered,
} from "../tools";

describe("tools", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedSubscription = null;
  });

  describe("registerToolHandlers", () => {
    it("registers tool handlers and sets up event listener", () => {
      const handlers = {
        getCurrentTime: () => new Date().toISOString(),
        calculate: async ({ expression }: { expression: string }) => String(eval(expression)),
      };

      registerToolHandlers(handlers);

      expect(mockAddListener).toHaveBeenCalledWith(
        "onToolCall",
        expect.any(Function)
      );
    });

    it("removes existing subscription when registering new handlers", () => {
      const handlers1 = {
        tool1: () => "result1",
      };
      const handlers2 = {
        tool2: () => "result2",
      };

      registerToolHandlers(handlers1);
      const firstSubscription = capturedSubscription;

      registerToolHandlers(handlers2);

      expect(firstSubscription.remove).toHaveBeenCalled();
      expect(mockAddListener).toHaveBeenCalledTimes(2);
    });

    it("calls tool handler when tool call event is triggered", async () => {
      const mockHandler = jest.fn().mockReturnValue("Tool result");
      const handlers = {
        myTool: mockHandler,
      };

      registerToolHandlers(handlers);

      // Get the registered listener
      const listener = mockAddListener.mock.calls[0][1];

      // Simulate tool call event
      await listener({
        toolName: "myTool",
        arguments: { arg1: "value1" },
      });

      expect(mockHandler).toHaveBeenCalledWith({ arg1: "value1" });
      expect(mockRespondToToolCall).toHaveBeenCalledWith("Tool result", null);
    });

    it("calls async tool handler when tool call event is triggered", async () => {
      const mockHandler = jest.fn().mockResolvedValue("Async result");
      const handlers = {
        asyncTool: mockHandler,
      };

      registerToolHandlers(handlers);

      const listener = mockAddListener.mock.calls[0][1];
      await listener({
        toolName: "asyncTool",
        arguments: { data: "test" },
      });

      expect(mockHandler).toHaveBeenCalledWith({ data: "test" });
      expect(mockRespondToToolCall).toHaveBeenCalledWith("Async result", null);
    });

    it("responds with error when tool handler throws", async () => {
      const mockHandler = jest.fn().mockRejectedValue(new Error("Handler failed"));
      const handlers = {
        failingTool: mockHandler,
      };

      registerToolHandlers(handlers);

      const listener = mockAddListener.mock.calls[0][1];
      await listener({
        toolName: "failingTool",
        arguments: {},
      });

      expect(mockRespondToToolCall).toHaveBeenCalledWith(null, "Handler failed");
    });

    it("responds with error when tool handler throws non-Error object", async () => {
      const mockHandler = jest.fn().mockRejectedValue("String error");
      const handlers = {
        failingTool: mockHandler,
      };

      registerToolHandlers(handlers);

      const listener = mockAddListener.mock.calls[0][1];
      await listener({
        toolName: "failingTool",
        arguments: {},
      });

      expect(mockRespondToToolCall).toHaveBeenCalledWith(null, "String error");
    });

    it("responds with error when tool is not found", async () => {
      const handlers = {
        existingTool: () => "result",
      };

      registerToolHandlers(handlers);

      const listener = mockAddListener.mock.calls[0][1];
      await listener({
        toolName: "nonExistentTool",
        arguments: {},
      });

      expect(mockRespondToToolCall).toHaveBeenCalledWith(
        null,
        'No handler registered for tool "nonExistentTool"'
      );
    });

    it("responds with error when no handlers are registered", async () => {
      // Register handlers first
      registerToolHandlers({ tool1: () => "result" });
      const listener = mockAddListener.mock.calls[0][1];

      // Unregister all handlers
      unregisterToolHandlers();

      // Try to call a tool
      await listener({
        toolName: "tool1",
        arguments: {},
      });

      expect(mockRespondToToolCall).toHaveBeenCalledWith(
        null,
        "No tool handlers registered"
      );
    });
  });

  describe("unregisterToolHandlers", () => {
    it("removes subscription and clears handlers", () => {
      const handlers = {
        myTool: () => "result",
      };

      registerToolHandlers(handlers);
      const subscription = capturedSubscription;

      unregisterToolHandlers();

      expect(subscription.remove).toHaveBeenCalled();
    });

    it("can be called multiple times safely", () => {
      const handlers = {
        myTool: () => "result",
      };

      registerToolHandlers(handlers);
      unregisterToolHandlers();
      unregisterToolHandlers();

      // Should not throw
      expect(true).toBe(true);
    });

    it("can be called without prior registration", () => {
      unregisterToolHandlers();
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("isToolHandlerRegistered", () => {
    it("returns true when tool handler is registered", () => {
      const handlers = {
        myTool: () => "result",
        anotherTool: () => "another",
      };

      registerToolHandlers(handlers);

      expect(isToolHandlerRegistered("myTool")).toBe(true);
      expect(isToolHandlerRegistered("anotherTool")).toBe(true);
    });

    it("returns false when tool handler is not registered", () => {
      const handlers = {
        myTool: () => "result",
      };

      registerToolHandlers(handlers);

      expect(isToolHandlerRegistered("nonExistentTool")).toBe(false);
    });

    it("returns false when no handlers are registered", () => {
      expect(isToolHandlerRegistered("anyTool")).toBe(false);
    });

    it("returns false after unregistering all handlers", () => {
      const handlers = {
        myTool: () => "result",
      };

      registerToolHandlers(handlers);
      expect(isToolHandlerRegistered("myTool")).toBe(true);

      unregisterToolHandlers();
      expect(isToolHandlerRegistered("myTool")).toBe(false);
    });

    it("returns false after registering different handlers", () => {
      const handlers1 = {
        tool1: () => "result1",
      };
      const handlers2 = {
        tool2: () => "result2",
      };

      registerToolHandlers(handlers1);
      expect(isToolHandlerRegistered("tool1")).toBe(true);

      registerToolHandlers(handlers2);
      expect(isToolHandlerRegistered("tool1")).toBe(false);
      expect(isToolHandlerRegistered("tool2")).toBe(true);
    });
  });
});
