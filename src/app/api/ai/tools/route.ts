import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { writeToolMap } from "@/lib/ai/tools/write-tools";
import type { ToolContext } from "@/lib/ai/tools/types";

export const runtime = "nodejs";
export const maxDuration = 15;

// POST /api/ai/tools — execute a confirmed write action
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { toolName, params, subaccountId } = body as {
    toolName: string;
    params: Record<string, unknown>;
    subaccountId: string;
  };

  if (!toolName || !subaccountId) {
    return NextResponse.json({ error: "Missing toolName or subaccountId" }, { status: 400 });
  }

  // Verify the tool exists
  const tool = writeToolMap[toolName];
  if (!tool) {
    return NextResponse.json({ error: `Unknown tool: ${toolName}` }, { status: 400 });
  }

  // Get user role
  const { data: roleData } = await supabase
    .from("user_subaccount_roles")
    .select("role")
    .eq("subaccount_id", subaccountId)
    .eq("user_id", user.id)
    .single();

  const role = roleData?.role || "staff";

  const ctx: ToolContext = {
    supabase: supabase as unknown as import("@supabase/supabase-js").SupabaseClient,
    userId: user.id,
    subaccountId,
    role,
  };

  try {
    const result = await tool.execute(params, ctx);

    if (result.success) {
      return NextResponse.json({ success: true, data: result.data });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
  } catch (error) {
    console.error("Tool execution error:", error);
    return NextResponse.json({ error: "Execution failed" }, { status: 500 });
  }
}
