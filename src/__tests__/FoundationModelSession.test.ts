// Mock expo-modules-core - all logic must be inside the factory
let mockCreateSession: jest.Mock;
let mockSendMessage: jest.Mock;
let mockStartStream: jest.Mock;
let mockGetHistory: jest.Mock;
let mockClearSession: jest.Mock;
let mockDestroySession: jest.Mock;
let mockRespondToToolCall: jest.Mock;
let mockAddListener: jest.Mock;

jest.mock("expo-modules-core", () => {
  // Create mocks inside the factory to avoid hoisting issues
  const mocks = {
    createSession: jest.fn(),
    sendMessage: jest.fn(),
    startStream: jest.fn(),
    cancelStream: jest.fn(),
    getHistory: jest.fn(),
    clearSession: jest.fn(),
    destroySession: jest.fn(),
    respondToToolCall: jest.fn(),
    addListener: jest.fn(() => ({
      remove: jest.fn(),
    })),
    isAvailable: jest.fn(),
    generateResponse: jest.fn(),
  };

  // Expose mocks for test access
  mockCreateSession = mocks.createSession;
  mockSendMessage = mocks.sendMessage;
  mockStartStream = mocks.startStream;
  mockGetHistory = mocks.getHistory;
  mockClearSession = mocks.clearSession;
  mockDestroySession = mocks.destroySession;
  mockRespondToToolCall = mocks.respondToToolCall;
  mockAddListener = mocks.addListener;

  return {
    requireNativeModule: jest.fn(() => mocks),
  };
});

import { FoundationModelSession } from "../FoundationModelSession";

describe("FoundationModelSession", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Restore addListener implementation after clearAllMocks
    mockAddListener.mockImplementation(() => ({
      remove: jest.fn(),
    }));
  });

  describe("constructor", () => {
    it("creates a session with default config", () => {
      new FoundationModelSession();
      expect(mockCreateSession).toHaveBeenCalledWith(null);
    });

    it("creates a session with instructions", () => {
      new FoundationModelSession({ instructions: "You are helpful" });
      expect(mockCreateSession).toHaveBeenCalledWith({
        instructions: "You are helpful",
      });
    });

    it("registers tool handlers", () => {
      const tools = {
        testTool: () => "result",
      };

      new FoundationModelSession({ tools });
      expect(mockAddListener).toHaveBeenCalledWith(
        "onToolCall",
        expect.any(Function)
      );
    });
  });

  describe("sendMessage", () => {
    it("sends a message and returns response", async () => {
      const session = new FoundationModelSession();
      const mockResponse = { content: "Hello!" };
      mockSendMessage.mockResolvedValue(mockResponse);

      const response = await session.sendMessage("Hi");
      expect(response).toEqual(mockResponse);
      expect(mockSendMessage).toHaveBeenCalledWith("Hi");
    });

    it("throws error if session is destroyed", async () => {
      const session = new FoundationModelSession();
      session.destroy();

      await expect(session.sendMessage("Hi")).rejects.toThrow(
        "Session has been destroyed"
      );
    });
  });

  describe("getHistory", () => {
    it("returns conversation history", () => {
      const session = new FoundationModelSession();
      const mockHistory = [
        { role: "user" as const, content: "Hello" },
        { role: "assistant" as const, content: "Hi there!" },
      ];
      mockGetHistory.mockReturnValue(mockHistory);

      const history = session.getHistory();
      expect(history).toEqual(mockHistory);
    });

    it("throws error if session is destroyed", () => {
      const session = new FoundationModelSession();
      session.destroy();

      expect(() => session.getHistory()).toThrow("Session has been destroyed");
    });
  });

  describe("clearHistory", () => {
    it("clears the conversation history", () => {
      const session = new FoundationModelSession();
      session.clearHistory();

      expect(mockClearSession).toHaveBeenCalled();
    });

    it("throws error if session is destroyed", () => {
      const session = new FoundationModelSession();
      session.destroy();

      expect(() => session.clearHistory()).toThrow("Session has been destroyed");
    });
  });

  describe("destroy", () => {
    it("destroys the session", () => {
      const session = new FoundationModelSession();
      session.destroy();

      expect(mockDestroySession).toHaveBeenCalled();
      expect(session.isDestroyed).toBe(true);
    });

    it("can be called multiple times safely", () => {
      const session = new FoundationModelSession();
      session.destroy();
      session.destroy();

      expect(mockDestroySession).toHaveBeenCalledTimes(1);
    });

    it("removes tool subscription", () => {
      const mockRemove = jest.fn();
      mockAddListener.mockReturnValue({ remove: mockRemove });

      const session = new FoundationModelSession({
        tools: { testTool: () => "result" },
      });

      session.destroy();
      expect(mockRemove).toHaveBeenCalled();
    });
  });

  describe("tool handling", () => {
    it("calls tool handler and responds with result", async () => {
      const mockToolHandler = jest.fn().mockReturnValue("Tool result");
      new FoundationModelSession({
        tools: { myTool: mockToolHandler },
      });

      // Get the registered listener
      const listener = mockAddListener.mock.calls[0][1];

      // Simulate tool call event
      await listener({
        toolName: "myTool",
        arguments: { arg1: "value1" },
      });

      expect(mockToolHandler).toHaveBeenCalledWith({ arg1: "value1" });
      expect(mockRespondToToolCall).toHaveBeenCalledWith(
        "Tool result",
        null
      );
    });

    it("handles tool handler errors", async () => {
      const mockToolHandler = jest.fn().mockRejectedValue(new Error("Tool error"));
      new FoundationModelSession({
        tools: { myTool: mockToolHandler },
      });

      const listener = mockAddListener.mock.calls[0][1];
      await listener({
        toolName: "myTool",
        arguments: {},
      });

      expect(mockRespondToToolCall).toHaveBeenCalledWith(
        null,
        "Tool error"
      );
    });

    it("handles missing tool handler", async () => {
      new FoundationModelSession({
        tools: { myTool: () => "result" },
      });

      const listener = mockAddListener.mock.calls[0][1];
      await listener({
        toolName: "unknownTool",
        arguments: {},
      });

      expect(mockRespondToToolCall).toHaveBeenCalledWith(
        null,
        'No handler registered for tool "unknownTool"'
      );
    });
  });

  describe("sendMessageStream", () => {
    it("calls startStream with the prompt", async () => {
      mockStartStream.mockResolvedValue("stream-123");

      const session = new FoundationModelSession();
      const gen = session.sendMessageStream("Tell me a story");

      // Start the generator to trigger startStream call
      gen.next();

      // Wait for async operations
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockStartStream).toHaveBeenCalledWith("Tell me a story");
    });

    it("registers stream event listeners", async () => {
      mockStartStream.mockResolvedValue("stream-123");

      const session = new FoundationModelSession();
      const gen = session.sendMessageStream("Test");

      // Start the generator to trigger listener registration
      gen.next();

      // Wait for async operations
      await new Promise((resolve) => setImmediate(resolve));

      // Check that stream listeners were registered
      const streamListenerCalls = mockAddListener.mock.calls.filter(
        (call) =>
          call[0] === "onStreamUpdate" ||
          call[0] === "onStreamComplete" ||
          call[0] === "onStreamError"
      );

      expect(streamListenerCalls.length).toBeGreaterThanOrEqual(3);
    });

    it("throws error if session is destroyed", async () => {
      const session = new FoundationModelSession();
      session.destroy();

      await expect(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const chunk of session.sendMessageStream("Test")) {
          // Should not reach here
        }
      }).rejects.toThrow("Session has been destroyed");
    });

    it("handles stream with no chunks (immediate completion)", async () => {
      const streamId = "stream-456";
      mockStartStream.mockResolvedValue(streamId);

      let completeListener: ((event: { streamId: string; content: string }) => void) | undefined;
      mockAddListener.mockImplementation((eventName, listener) => {
        if (eventName === "onStreamComplete") {
          completeListener = listener as (event: { streamId: string; content: string }) => void;
        }
        return { remove: jest.fn() };
      });

      const session = new FoundationModelSession();
      const gen = session.sendMessageStream("Quick response");

      // Start iteration
      const iterPromise = (async () => {
        const chunks = [];
        for await (const chunk of gen) {
          chunks.push(chunk);
        }
        return chunks;
      })();

      // Wait for setup
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      // Complete immediately without any chunks
      expect(completeListener).toBeDefined();
      completeListener!({
        streamId,
        content: "Done",
      });

      const chunks = await iterPromise;
      expect(chunks).toEqual([]);
    });

    it("handles stream error with custom Error object", async () => {
      const streamId = "stream-789";
      mockStartStream.mockResolvedValue(streamId);

      let errorListener: ((event: { streamId: string; error: string }) => void) | undefined;
      mockAddListener.mockImplementation((eventName, listener) => {
        if (eventName === "onStreamError") {
          errorListener = listener as (event: { streamId: string; error: string }) => void;
        }
        return { remove: jest.fn() };
      });

      const session = new FoundationModelSession();
      const gen = session.sendMessageStream("Error test");

      const iterPromise = (async () => {
        const chunks = [];
        for await (const chunk of gen) {
          chunks.push(chunk);
        }
        return chunks;
      })();

      // Wait for setup
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      // Trigger error
      expect(errorListener).toBeDefined();
      errorListener!({
        streamId,
        error: "Network timeout",
      });

      await expect(iterPromise).rejects.toThrow("Network timeout");
    });
  });

  describe("isDestroyed", () => {
    it("returns false for active session", () => {
      const session = new FoundationModelSession();
      expect(session.isDestroyed).toBe(false);
    });

    it("returns true for destroyed session", () => {
      const session = new FoundationModelSession();
      session.destroy();
      expect(session.isDestroyed).toBe(true);
    });
  });
});
