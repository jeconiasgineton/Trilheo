import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/modules/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  redirect(`/${session.user.organizationSlug}/innovation`);
}
