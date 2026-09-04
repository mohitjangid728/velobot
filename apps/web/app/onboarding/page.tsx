import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { OnboardingForm } from "@/components/auth/onboarding-form";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: { plan?: string; interval?: string; currency?: string };
}) {
  // Mirrors the POST /api/orgs guard (app/api/orgs/route.ts) — a Super
  // Admin's workspace is the admin panel, not a form that would 403 on
  // submit if they saw it.
  const user = await requireUser();
  if (await isPlatformAdmin(user.id)) redirect("/admin");

  return <OnboardingForm plan={searchParams.plan} interval={searchParams.interval} currency={searchParams.currency} />;
}
