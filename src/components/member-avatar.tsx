import { cn } from "@/lib/utils";
import type { MemberRow } from "@/types/database";

const SIZES = {
  xs: "size-5 text-[10px]",
  sm: "size-7 text-xs",
  md: "size-9 text-sm",
  lg: "size-12 text-base",
  xl: "size-16 text-xl",
};

/** Avatar: foto, emoji-icoon of initiaal in de kleur van het gezinslid. */
export function MemberAvatar({
  member,
  size = "sm",
  className,
  ring,
}: {
  member: Pick<MemberRow, "display_name" | "color" | "icon" | "avatar_url"> | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
  ring?: boolean;
}) {
  if (!member) {
    return (
      <span
        className={cn("inline-flex shrink-0 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30 text-muted-foreground", SIZES[size], className)}
        title="Niet toegewezen"
      >
        ?
      </span>
    );
  }
  return (
    <span
      title={member.display_name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white select-none",
        ring && "ring-2 ring-card",
        SIZES[size],
        className,
      )}
      style={{ backgroundColor: member.color }}
    >
      {member.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- externe profielfoto, geen optimalisatie nodig
        <img src={member.avatar_url} alt="" className="size-full object-cover" />
      ) : member.icon ? (
        <span aria-hidden>{member.icon}</span>
      ) : (
        member.display_name.charAt(0).toUpperCase()
      )}
    </span>
  );
}
