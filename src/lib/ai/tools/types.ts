// ═══════════════════════════════════════════════════════════
// AI Co-Pilot — Tool Types
// ═══════════════════════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js";

/** Context passed to every tool execution */
export interface ToolContext {
  supabase: SupabaseClient;
  userId: string;
  subaccountId: string;
  role: string;
  orgId?: string;
}

/** The result a tool returns — serialized to JSON for the LLM */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/** A tool definition: name, schema for LLM, and executor function */
export interface CrmTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema for OpenAI function calling
  requiresConfirmation?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (params: Record<string, any>, ctx: ToolContext) => Promise<ToolResult>;
}

/** OpenAI function calling format */
export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** Convert a CrmTool to OpenAI function definition */
export function toToolDefinition(tool: CrmTool): ToolDefinition {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}
