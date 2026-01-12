// Mock expo-modules-core - all logic must be inside the factory
let mockIsAvailable: jest.Mock;
let mockGenerateResponse: jest.Mock;

jest.mock("expo-modules-core", () => {
  // Create mocks inside the factory to avoid hoisting issues
  const mocks = {
    isAvailable: jest.fn(),
    generateResponse: jest.fn(),
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
  };

  // Expose mocks for test access
  mockIsAvailable = mocks.isAvailable;
  mockGenerateResponse = mocks.generateResponse;

  return {
    requireNativeModule: jest.fn(() => mocks),
  };
});

import {
  isAvailable,
  generateResponse,
} from "../ReactNativeFoundationModelsModule";

describe("ReactNativeFoundationModelsModule", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("isAvailable", () => {
    it("returns true when FoundationModels is available", () => {
      mockIsAvailable.mockReturnValue(true);
      expect(isAvailable()).toBe(true);
    });

    it("returns false when FoundationModels is unavailable", () => {
      mockIsAvailable.mockReturnValue(false);
      expect(isAvailable()).toBe(false);
    });
  });

  describe("generateResponse", () => {
    it("generates a response", async () => {
      const mockResponse = { content: "Generated text" };
      mockGenerateResponse.mockResolvedValue(mockResponse);

      const response = await generateResponse({
        prompt: "Test prompt",
      });

      expect(response).toEqual(mockResponse);
      expect(mockGenerateResponse).toHaveBeenCalledWith({
        prompt: "Test prompt",
      });
    });

    it("generates a response with config", async () => {
      const mockResponse = { content: "Generated text" };
      mockGenerateResponse.mockResolvedValue(mockResponse);

      const response = await generateResponse({
        prompt: "Test prompt",
        config: { instructions: "Be concise" },
      });

      expect(response).toEqual(mockResponse);
      expect(mockGenerateResponse).toHaveBeenCalledWith({
        prompt: "Test prompt",
        config: { instructions: "Be concise" },
      });
    });

    it("handles errors from native module", async () => {
      mockGenerateResponse.mockRejectedValue(new Error("Generation failed"));

      await expect(generateResponse({ prompt: "Test prompt" })).rejects.toThrow(
        "Generation failed"
      );
    });
  });
});
