import { redirect } from "next/navigation"

// Published information is now a tab inside the Knowledge Base (/guidance),
// since it is thematically the same: knowledge an FOI officer reaches for.
export default function PublishedPage() {
  redirect("/guidance?tab=published")
}
