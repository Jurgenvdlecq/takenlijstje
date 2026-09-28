import { redirect } from "next/navigation";
import { NoAccess } from "@/features/auth/no-access";
import { getUser, isInactiveMember } from "@/server/context";

export const dynamic = "force-dynamic";

export const metadata = { title: "Geen toegang" };

/**
 * Voor een uitgezet lid (V-29): geen taken, geen onderbalk; alleen uitleg en
 * uitloggen. De database geeft zo'n lid overal nul rijen (private.is_member).
 */
export default async function NoAccessPage() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  if (!(await isInactiveMember())) redirect("/");

  const { data } = await supabase.rpc("my_membership");
  const householdName = data?.[0]?.household_name ?? null;
  return <NoAccess householdName={householdName} />;
}
