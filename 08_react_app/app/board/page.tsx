import { redirect } from "next/navigation"

// Board and Cases are one page now; keep this route as a permanent redirect so
// existing links/bookmarks (and the Command Centre funnel) keep working.
export default function BoardPage() {
  redirect("/cases?view=board")
}
