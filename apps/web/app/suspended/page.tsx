import { AlertTriangle } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SuspendedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <CardTitle>This workspace has been suspended</CardTitle>
          <CardDescription>
            Access to the dashboard and this workspace&apos;s bots is currently disabled. Contact
            support if you believe this is a mistake.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}
