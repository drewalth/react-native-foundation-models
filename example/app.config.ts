import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "react-native-foundation-models-example",
  slug: "react-native-foundation-models-example",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "expo.modules.foundationmodels.example",
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: "expo.modules.foundationmodels.example",
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    [
      "expo-build-properties",
      {
        ios: {
          deploymentTarget: "26.0",
        },
      },
    ],
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
                  description:
                    "Optional timezone (e.g., 'America/New_York'). Defaults to local time.",
                },
                format: {
                  type: "string",
                  enum: ["short", "long"],
                  description:
                    "Output format: 'short' for time only, 'long' for full date and time",
                },
              },
              required: [],
            },
          },
          {
            name: "calculate",
            description: "Perform a mathematical calculation",
            parameters: {
              type: "object",
              properties: {
                expression: {
                  type: "string",
                  description:
                    "The mathematical expression to evaluate (e.g., '2 + 2', '10 * 5')",
                },
              },
              required: ["expression"],
            },
          },
          {
            name: "getPokemon",
            description:
              "Fetch information about a Pokémon from the PokéAPI, including stats, types, abilities, and sprites",
            parameters: {
              type: "object",
              properties: {
                pokemon: {
                  type: "string",
                  description:
                    "The name or ID of the Pokémon to look up (e.g., 'pikachu', 'ditto', '25')",
                },
              },
              required: ["pokemon"],
            },
          },
        ],
      },
    ],
  ],
});
