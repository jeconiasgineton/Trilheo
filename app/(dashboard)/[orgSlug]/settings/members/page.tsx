import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/modules/auth";
import { listOrganizationMembers } from "@/lib/modules/auth/service";
import { can } from "@/lib/modules/permissions";
import { MembersClient } from "./members-client";

export default async function MembersPage({
  params,
}: {
  params: { orgSlug: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const members = await listOrganizationMembers(session.user.organizationId);

  return (
    <MembersClient
      members={members.map((m) => ({ id: m.id, role: m.role, user: m.user }))}
      currentUserRole={session.user.role}
      currentMemberId={members.find((m) => m.userId === session.user.id)?.id ?? null}
      canInvite={can(session.user.role, "member:invite")}
      canChangeRole={can(session.user.role, "member:changeRole")}
      canRemove={can(session.user.role, "member:remove")}
    />
  );
}
