import { ROLE_RANK, type Role } from "@velobot/shared";

/** Server-side conditional render helper — client-side hiding is UX only, never a security boundary. */
export function RoleGate({
  role,
  atLeast,
  children,
}: {
  role: Role;
  atLeast: Role;
  children: React.ReactNode;
}) {
  if (ROLE_RANK[role] < ROLE_RANK[atLeast]) return null;
  return <>{children}</>;
}
