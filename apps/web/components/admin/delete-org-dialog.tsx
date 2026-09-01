"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function DeleteOrgDialog({ orgId, orgSlug, orgName }: { orgId: string; orgSlug: string; orgName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteOrg() {
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/admin/orgs/${orgId}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to delete workspace");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <>
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
          <CardDescription>
            Permanently deletes {orgName} and everything in it — bots, conversations, knowledge sources, connections. This cannot
            be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
            <Trash2 className="h-4 w-4" /> Delete organization
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {orgName}?</DialogTitle>
            <DialogDescription>
              This permanently deletes the workspace and all of its data. Type <span className="font-mono font-semibold">{orgSlug}</span> to
              confirm.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm-slug">Workspace slug</Label>
              <Input id="confirm-slug" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={orgSlug} />
            </div>
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteOrg} disabled={deleting || confirmText !== orgSlug}>
              {deleting ? "Deleting..." : "Permanently delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
