"use client";

import { AlertCircle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ display: "flex", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", padding: "1.5rem" }}>
          <div style={{ display: "flex", height: "3.5rem", width: "3.5rem", alignItems: "center", justifyContent: "center", borderRadius: "9999px", backgroundColor: "rgba(239,68,68,0.1)" }}>
            <AlertCircle style={{ height: "1.75rem", width: "1.75rem", color: "#ef4444" }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Application Error</h2>
            <p style={{ marginTop: "0.25rem", fontSize: "0.875rem", color: "#6b7280" }}>
              {error.message || "A critical error occurred."}
            </p>
          </div>
          <button onClick={reset} style={{ padding: "0.5rem 1rem", borderRadius: "0.5rem", backgroundColor: "#4f46e5", color: "white", border: "none", cursor: "pointer", fontWeight: 500 }}>
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}
