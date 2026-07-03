"use client";

// Root-level error boundary — must render its own <html>/<body> because it
// replaces the entire layout when the app shell itself crashes.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#0b0d10", color: "#e8eaed" }}>
        <div style={{ maxWidth: 480, margin: "80px auto", padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>PulseCoach crashed</h1>
          <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 20 }}>
            {error.message || "An unexpected error broke the app shell."}
          </p>
          <button
            onClick={reset}
            style={{
              padding: "10px 18px", borderRadius: 8, border: "1px solid #333",
              background: "#16a34a", color: "#fff", fontSize: 14, cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
