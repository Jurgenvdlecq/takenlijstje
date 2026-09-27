import type { Metadata } from "next";
import { InviteView } from "@/features/invite/invite-view";
import { getUser } from "@/server/context";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Uitnodiging" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { supabase, user } = await getUser();

  const valid = /^[a-f0-9]{64}$/.test(token);
  const { data } = valid ? await supabase.rpc("get_invitation", { p_token: token }) : { data: null };
  const invitation = Array.isArray(data) ? (data[0] ?? null) : null;

  const metaName = typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null;
  const suggestedName = metaName ?? (user?.email ? user.email.split("@")[0] : "");

  return (
    <InviteView
      token={token}
      invitation={invitation}
      loggedIn={Boolean(user)}
      userEmail={user?.email ?? null}
      suggestedName={suggestedName}
    />
  );
}
