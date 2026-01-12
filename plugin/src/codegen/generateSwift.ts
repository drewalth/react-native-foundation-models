import type { ToolDefinition, JSONSchemaProperty } from "../types";

/**
 * Convert a tool name to PascalCase for Swift struct naming.
 */
function toPascalCase(name: string): string {
  return name
    .split(/[_-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Convert a JSON Schema type to Swift type.
 */
function jsonSchemaTypeToSwift(
  prop: JSONSchemaProperty,
  isRequired: boolean
): string {
  const optional = isRequired ? "" : "?";

  switch (prop.type) {
    case "string":
      return `String${optional}`;
    case "number":
      return `Double${optional}`;
    case "integer":
      return `Int${optional}`;
    case "boolean":
      return `Bool${optional}`;
    case "array":
      if (prop.items) {
        const itemType = jsonSchemaTypeToSwift(prop.items, true);
        return `[${itemType}]${optional}`;
      }
      return `[Any]${optional}`;
    case "object":
      return `[String: Any]${optional}`;
    default:
      return `String${optional}`;
  }
}

/**
 * Generate the @Guide annotation for a property.
 */
function generateGuideAnnotation(prop: JSONSchemaProperty): string {
  if (!prop.description && (!prop.enum || prop.enum.length === 0)) {
    return "";
  }

  let description = prop.description || "";

  // Include enum values in the description since @Guide doesn't support .enum() directly
  if (prop.enum && prop.enum.length > 0) {
    const enumValues = prop.enum.map((v) => `'${v}'`).join(", ");
    const enumSuffix = ` Must be one of: ${enumValues}.`;
    if (description) {
      description = description + enumSuffix;
    } else {
      description = `Must be one of: ${enumValues}.`;
    }
  }

  return `@Guide(description: "${description.replace(/"/g, '\\"')}")`;
}

/**
 * Generate the Arguments struct for a tool.
 */
function generateArgumentsStruct(tool: ToolDefinition): string {
  const properties = tool.parameters.properties;
  const required = new Set(tool.parameters.required || []);

  const fields = Object.entries(properties)
    .map(([name, prop]) => {
      const swiftType = jsonSchemaTypeToSwift(prop, required.has(name));
      const guide = generateGuideAnnotation(prop);
      const guidePrefix = guide ? `        ${guide}\n` : "";
      return `${guidePrefix}        var ${name}: ${swiftType}`;
    })
    .join("\n\n");

  return `    @Generable
    struct Arguments {
${fields}
    }`;
}

/**
 * Generate the call method that bridges to JavaScript.
 */
function generateCallMethod(tool: ToolDefinition): string {
  const properties = Object.keys(tool.parameters.properties);

  const argsDict = properties
    .map((name) => `"${name}": arguments.${name} as Any`)
    .join(", ");

  return `    func call(arguments: Arguments) async throws -> String {
        try await bridge.callJavaScript(
            toolName: name,
            arguments: [${argsDict}]
        )
    }`;
}

/**
 * Generate a single Tool struct.
 */
function generateToolStruct(tool: ToolDefinition): string {
  const structName = `${toPascalCase(tool.name)}Tool`;
  const escapedDescription = tool.description.replace(/"/g, '\\"');

  return `
@available(iOS 26.0, *)
struct ${structName}: Tool {
    let name = "${tool.name}"
    let description = "${escapedDescription}"

    private let bridge: ToolBridge

    init(bridge: ToolBridge) {
        self.bridge = bridge
    }

${generateArgumentsStruct(tool)}

${generateCallMethod(tool)}
}`;
}

/**
 * Generate a session factory function that creates a session with tools.
 */
function generateSessionFactory(tools: ToolDefinition[]): string {
  if (tools.length === 0) {
    return `
/// Creates a LanguageModelSession with the generated tools.
@available(iOS 26.0, *)
func createSessionWithTools(
    model: SystemLanguageModel,
    instructions: String?,
    bridge: ToolBridge
) -> LanguageModelSession {
    // Bridge unused when no tools are configured
    _ = bridge

    if let instructions {
        return LanguageModelSession(model: model, instructions: instructions)
    } else {
        return LanguageModelSession(model: model)
    }
}

/// Returns true if there are generated tools configured.
@available(iOS 26.0, *)
func hasGeneratedTools() -> Bool {
    false
}`;
  }

  // Generate tool array elements
  const toolArrayElements = tools
    .map((tool) => `        ${toPascalCase(tool.name)}Tool(bridge: bridge)`)
    .join(",\n");

  return `
/// Creates a LanguageModelSession with the generated tools.
@available(iOS 26.0, *)
func createSessionWithTools(
    model: SystemLanguageModel,
    instructions: String?,
    bridge: ToolBridge
) -> LanguageModelSession {
    let tools: [any Tool] = [
${toolArrayElements}
    ]

    if let instructions {
        return LanguageModelSession(model: model, tools: tools, instructions: instructions)
    } else {
        return LanguageModelSession(model: model, tools: tools)
    }
}

/// Returns true if there are generated tools configured.
@available(iOS 26.0, *)
func hasGeneratedTools() -> Bool {
    true
}`;
}

/**
 * Generate the complete Swift file with all tools.
 */
export function generateSwiftTools(tools: ToolDefinition[]): string {
  const header = `// Generated by react-native-foundation-models
// Do not edit this file directly. Modify your tool configuration in app.config.js instead.

import Foundation
import FoundationModels
`;

  if (tools.length === 0) {
    return `${header}
// No tools configured.

/// Creates a LanguageModelSession with the generated tools.
@available(iOS 26.0, *)
func createSessionWithTools(
    model: SystemLanguageModel,
    instructions: String?,
    bridge: ToolBridge
) -> LanguageModelSession {
    // Bridge unused when no tools are configured
    _ = bridge

    if let instructions {
        return LanguageModelSession(model: model, instructions: instructions)
    } else {
        return LanguageModelSession(model: model)
    }
}

/// Returns true if there are generated tools configured.
@available(iOS 26.0, *)
func hasGeneratedTools() -> Bool {
    false
}
`;
  }

  const toolStructs = tools.map(generateToolStruct).join("\n");
  const sessionFactory = generateSessionFactory(tools);

  return `${header}${toolStructs}
${sessionFactory}
`;
}
