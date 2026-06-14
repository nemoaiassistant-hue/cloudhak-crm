import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AIAssistant } from "@/components/ai/ai-assistant";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto bg-muted/30">{children}</main>
      </div>
      <AIAssistant />
    </div>
  );
}
