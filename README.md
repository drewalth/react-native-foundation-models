# react-native-foundation-models

React Native bindings for Apple's on-device [FoundationModels](https://developer.apple.com/documentation/FoundationModels) framework.

> **⚠️ Work in Progress**  
> This library is under active development. The API may change.

## Requirements

- iOS 26.0+
- Apple Silicon (iPhone 15 Pro or later, M-series Macs)
- Apple Intelligence enabled on device

## Installation

> **Note:** This package is not yet published to npm. You must build and link it locally.

```bash
# Clone and build the module
git clone https://github.com/drewalth/react-native-foundation-models.git
cd react-native-foundation-models
npm install
npm run build
npm link

# In your project
npm link react-native-foundation-models
```

## Usage

### Basic Usage

```typescript
import {
  FoundationModelSession,
  isAvailable,
} from "react-native-foundation-models";

if (isAvailable()) {
  // Create a session
  const session = new FoundationModelSession({
    instructions: "You are a concise science educator.",
  });

  // Send a message
  const response = await session.sendMessage(
    "Explain quantum computing in one sentence."
  );
  console.log(response.content);

  // Multi-turn conversation - history is maintained automatically
  const followUp = await session.sendMessage("Can you give me an example?");
  console.log(followUp.content);

  // Clean up when done
  session.destroy();
}
```

### Multi-turn Conversations

The session maintains conversation history automatically, enabling contextual follow-up questions:

```typescript
const session = new FoundationModelSession({
  instructions: "You are a helpful math tutor.",
});

await session.sendMessage("What is 25 * 4?");
// → "25 × 4 = 100"

await session.sendMessage("Now divide that by 5");
// → "100 ÷ 5 = 20" (remembers the previous result)

// Access conversation history
const history = session.getHistory();
// [
//   { role: "user", content: "What is 25 * 4?" },
//   { role: "assistant", content: "25 × 4 = 100" },
//   { role: "user", content: "Now divide that by 5" },
//   { role: "assistant", content: "100 ÷ 5 = 20" }
// ]

// Clear history to start fresh (keeps same instructions)
session.clearHistory();
```

### Tool Calling

Extend the model's capabilities with custom tools. Tools are defined at build time via the Expo config plugin and implemented at runtime via JavaScript handlers passed to the session constructor.

#### 1. Configure Tools in Expo

Define your tools schema in `app.json` or `app.config.js`:

```javascript
// app.config.js
export default {
  expo: {
    plugins: [
      [
        "react-native-foundation-models",
        {
          tools: [
            {
              name: "getCurrentTime",
              description: "Get the current date and time",
              parameters: {
                type: "object",
                properties: {
                  timezone: {
                    type: "string",
                    description: "IANA timezone (e.g., 'America/New_York')",
                  },
                  format: {
                    type: "string",
                    enum: ["short", "long"],
                    description: "Output format",
                  },
                },
                required: [],
              },
            },
            {
              name: "calculate",
              description: "Evaluate a mathematical expression",
              parameters: {
                type: "object",
                properties: {
                  expression: {
                    type: "string",
                    description: "Math expression (e.g., '2 + 2 * 3')",
                  },
                },
                required: ["expression"],
              },
            },
            {
              name: "fetchWeather",
              description: "Get current weather for a city",
              parameters: {
                type: "object",
                properties: {
                  city: {
                    type: "string",
                    description: "City name",
                  },
                },
                required: ["city"],
              },
            },
          ],
        },
      ],
    ],
  },
};
```

#### 2. Implement Tool Handlers

Pass tool handlers directly to the session constructor:

```typescript
import { FoundationModelSession } from "react-native-foundation-models";

const session = new FoundationModelSession({
  instructions:
    "You are a helpful assistant with access to time, calculator, and weather tools.",
  tools: {
    getCurrentTime: ({ timezone, format }) => {
      const now = new Date();
      if (format === "short") {
        return now.toLocaleTimeString("en-US", {
          timeZone: timezone || undefined,
        });
      }
      return now.toLocaleString("en-US", {
        timeZone: timezone || undefined,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
      });
    },

    calculate: ({ expression }) => {
      // Sanitize and evaluate
      const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, "");
      const result = new Function(`return (${sanitized})`)();
      return String(result);
    },

    // Async handlers are supported
    fetchWeather: async ({ city }) => {
      const response = await fetch(
        `https://api.weather.example/current?city=${encodeURIComponent(city)}`
      );
      const data = await response.json();
      return `${data.temp}°F, ${data.condition}`;
    },
  },
});

// The model will automatically use tools when appropriate
const response = await session.sendMessage(
  "What time is it in Tokyo, and what's 15% of 85?"
);
```

#### 3. Run Prebuild

After configuring tools, regenerate native code:

```bash
npx expo prebuild
```

### Using in React Components

```tsx
import { useMemo, useState } from "react";
import {
  FoundationModelSession,
  isAvailable,
  type Message,
} from "react-native-foundation-models";

function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);

  // Create session once - no useEffect needed for tool registration
  const session = useMemo(() => {
    if (!isAvailable()) return null;

    return new FoundationModelSession({
      instructions: "You are a helpful assistant.",
      tools: {
        getCurrentTime: () => new Date().toLocaleTimeString(),
      },
    });
  }, []);

  const sendMessage = async (text: string) => {
    if (!session) return;

    await session.sendMessage(text);
    setMessages(session.getHistory());
  };

  // ...render UI
}
```

## API Reference

### `isAvailable(): boolean`

Returns `true` if FoundationModels is available on the current device.

### `FoundationModelSession`

A stateful session for conversing with the on-device language model.

#### Constructor

```typescript
new FoundationModelSession(config?: {
  instructions?: string;
  tools?: ToolHandlers;
})
```

| Option         | Type           | Description                                    |
| -------------- | -------------- | ---------------------------------------------- |
| `instructions` | `string?`      | System instructions to guide model behavior    |
| `tools`        | `ToolHandlers` | Object mapping tool names to handler functions |

#### Methods

| Method                                           | Description                               |
| ------------------------------------------------ | ----------------------------------------- |
| `sendMessage(prompt: string): Promise<Response>` | Send a message and get a response         |
| `getHistory(): Message[]`                        | Get all messages in the conversation      |
| `clearHistory(): void`                           | Clear conversation history (keeps config) |
| `destroy(): void`                                | Clean up session resources                |
| `isDestroyed: boolean`                           | Whether the session has been destroyed    |

### Types

```typescript
interface Message {
  role: "user" | "assistant";
  content: string;
}

interface GenerateResponse {
  content: string;
}
```

## Roadmap

- [x] Stateful sessions (multi-turn conversations)
- [x] Tool calling
- [ ] Streaming responses
- [ ] Guided generation (response schemas)

## Contributing

Contributions are welcome! This is a new framework and there's a lot to explore.

- Check the [roadmap](#roadmap) for planned features
- Open an [issue](https://github.com/drewalth/react-native-foundation-models/issues) to discuss ideas or report bugs
- PRs for bug fixes, documentation, and new features are appreciated

## License

MIT
