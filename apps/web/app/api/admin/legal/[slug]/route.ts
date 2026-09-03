import { NextResponse, type NextRequest } from "next/server";
import { UpdateLegalPageSchema, type LegalPageSlug } from "@velobot/shared";
import { requireFullPlatformAdminApi } from "@/lib/auth/platform-admin";
import { updateLegalPage } from "@/lib/legal/content";
import { logAdminAction } from "@/lib/admin/audit-log";

const VALID_SLUGS: LegalPageSlug[] = ["terms", "privacy", "subprocessors"];

export async function PATCH(req: NextRequest, { params }: { params: { slug: string } }) {
  const admin = await requireFullPlatformAdminApi();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!VALID_SLUGS.includes(params.slug as LegalPageSlug)) {
    return NextResponse.json({ error: "Unknown legal page" }, { status: 404 });
  }
  const slug = params.slug as LegalPageSlug;

  const parsed = UpdateLegalPageSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const page = await updateLegalPage(slug, { ...parsed.data, updatedBy: admin.id });
    await logAdminAction(admin.id, "legal.update_page", null, { slug });
    return NextResponse.json({ page });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to save page" }, { status: 500 });
  }
}
