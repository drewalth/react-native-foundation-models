/**
 * JSON Schema property definition for tool parameters.
 */
export interface JSONSchemaProperty {
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  description?: string;
  enum?: string[];
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
}

/**
 * JSON Schema definition for tool parameters.
 */
export interface ToolParametersSchema {
  type: "object";
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
}

/**
 * Tool definition in the plugin configuration.
 */
export interface ToolDefinition {
  /**
   * The name of the tool. Must be a valid identifier (alphanumeric + underscore).
   */
  name: string;

  /**
   * A description of what the tool does. This is provided to the model.
   */
  description: string;

  /**
   * JSON Schema defining the tool's parameters.
   */
  parameters: ToolParametersSchema;
}

/**
 * Plugin configuration options.
 */
export interface PluginConfig {
  /**
   * Array of tool definitions to generate.
   */
  tools?: ToolDefinition[];
}
