"use client";
import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Card, Button, EmptyState } from "@/components/ui";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="animate-fade-up max-w-[560px] mx-auto pt-10">
      <Card>
        <EmptyState
          icon={AlertTriangle}
          title="Something went wrong"
          body={
            error.message ||
            "An unexpected error occurred while rendering this page. The backend may be unreachable."
          }
          action={
            <Button variant="primary" icon={RotateCcw} onClick={reset}>
              Try again
            </Button>
          }
        />
      </Card>
    </div>
  );
}
