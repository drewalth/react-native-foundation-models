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

```typescript
import { isAvailable, generateResponse } from "react-native-foundation-models";

// Check availability
if (isAvailable()) {
  const response = await generateResponse({
    prompt: "Explain quantum computing in one sentence.",
    config: {
      instructions: "You are a concise science educator.",
    },
  });

  console.log(response.content);
}
```

## API

### `isAvailable(): boolean`

Returns `true` if FoundationModels is available on the current device.

### `generateResponse(options): Promise<GenerateResponse>`

Generates a response using the on-device language model.

| Option                | Type      | Description                                 |
| --------------------- | --------- | ------------------------------------------- |
| `prompt`              | `string`  | The user prompt                             |
| `config.instructions` | `string?` | System instructions to guide model behavior |

## Roadmap

- [ ] Stateful sessions (multi-turn conversations)
- [ ] Streaming responses
- [ ] Tool calling

## Contributing

Contributions are welcome! This is a new framework and there's a lot to explore.

- Check the [roadmap](#roadmap) for planned features
- Open an [issue](https://github.com/drewalth/react-native-foundation-models/issues) to discuss ideas or report bugs
- PRs for bug fixes, documentation, and new features are appreciated

## License

MIT
