import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <FileQuestion className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="text-center">
        <h1 className="text-3xl font-bold">404</h1>
        <p className="mt-1 text-muted-foreground">Page not found</p>
      </div>
      <Link href="/dashboard" className={buttonVariants({ variant: "default" })}>
        Back to Dashboard
      </Link>
    </div>
  );
}
