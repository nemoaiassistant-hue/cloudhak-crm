"use client";

import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-7 w-7 text-destructive" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred."}
        </p>
      </div>
      <Button onClick={reset} variant="default">
        Try again
      </Button>
    </div>
  );
}
