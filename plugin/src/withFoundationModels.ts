import { ConfigPlugin, withDangerousMod } from "@expo/config-plugins";
import * as fs from "fs";
import * as path from "path";

import type { PluginConfig, ToolDefinition } from "./types";
import { generateSwiftTools } from "./codegen/generateSwift";
import { generateTypeScriptTools } from "./codegen/generateTypes";

/**
 * Validate tool definitions.
 */
function validateTools(tools: ToolDefinition[]): void {
  const names = new Set<string>();

  for (const tool of tools) {
    // Validate name format
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(tool.name)) {
      throw new Error(
        `Invalid tool name "${tool.name}". Tool names must start with a letter and contain only alphanumeric characters and underscores.`
      );
    }

    // Check for duplicates
    if (names.has(tool.name)) {
      throw new Error(`Duplicate tool name "${tool.name}".`);
    }
    names.add(tool.name);

    // Validate parameters schema
    if (tool.parameters.type !== "object") {
      throw new Error(
        `Tool "${tool.name}" parameters must have type "object".`
      );
    }

    if (
      !tool.parameters.properties ||
      typeof tool.parameters.properties !== "object"
    ) {
      throw new Error(
        `Tool "${tool.name}" must have a properties object in parameters.`
      );
    }
  }
}

/**
 * Get the path to the iOS source directory.
 */
function getIosSourcePath(projectRoot: string): string {
  // For a library, the iOS files are in the package's ios/ directory
  // During prebuild, we need to find the node_modules path
  const nodeModulesPath = path.join(
    projectRoot,
    "node_modules",
    "react-native-foundation-models",
    "ios"
  );

  if (fs.existsSync(nodeModulesPath)) {
    return nodeModulesPath;
  }

  // Fallback: Check if we're in development (working directly in the package)
  const localIosPath = path.join(projectRoot, "..", "ios");
  if (fs.existsSync(localIosPath)) {
    return localIosPath;
  }

  throw new Error(
    "Could not find react-native-foundation-models iOS source directory"
  );
}

/**
 * Get the path to write generated TypeScript types.
 */
function getTypeScriptOutputPath(projectRoot: string): string {
  const nodeModulesPath = path.join(
    projectRoot,
    "node_modules",
    "react-native-foundation-models",
    "src",
    "generated"
  );

  if (
    fs.existsSync(
      path.join(
        projectRoot,
        "node_modules",
        "react-native-foundation-models",
        "src"
      )
    )
  ) {
    return nodeModulesPath;
  }

  // Fallback for development
  const localSrcPath = path.join(projectRoot, "..", "src", "generated");
  return localSrcPath;
}

/**
 * Main plugin that generates tool code.
 */
const withFoundationModels: ConfigPlugin<PluginConfig | void> = (
  config,
  pluginConfig
) => {
  const tools = pluginConfig?.tools || [];

  // Validate tools
  if (tools.length > 0) {
    validateTools(tools);
  }

  // Generate Swift code
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;

      try {
        // Generate Swift tools
        const iosPath = getIosSourcePath(projectRoot);
        const swiftCode = generateSwiftTools(tools);
        const swiftOutputPath = path.join(iosPath, "GeneratedTools.swift");

        // Ensure directory exists
        fs.mkdirSync(path.dirname(swiftOutputPath), { recursive: true });
        fs.writeFileSync(swiftOutputPath, swiftCode, "utf-8");

        console.log(
          `[react-native-foundation-models] Generated ${tools.length} tool(s) in GeneratedTools.swift`
        );

        // Generate TypeScript types
        const tsPath = getTypeScriptOutputPath(projectRoot);
        const tsCode = generateTypeScriptTools(tools);
        const tsOutputPath = path.join(tsPath, "tools.ts");

        // Ensure directory exists
        fs.mkdirSync(path.dirname(tsOutputPath), { recursive: true });
        fs.writeFileSync(tsOutputPath, tsCode, "utf-8");

        console.log(
          `[react-native-foundation-models] Generated TypeScript types in generated/tools.ts`
        );
      } catch (error) {
        console.error(
          "[react-native-foundation-models] Failed to generate tools:",
          error
        );
        throw error;
      }

      return config;
    },
  ]);
};

export default withFoundationModels;
