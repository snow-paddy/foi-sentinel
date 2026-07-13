import { redirect } from "next/navigation"

// The Response & Refusal Studio now lives inside the case detail view
// (app/cases/[reference]/page.tsx). The standalone page duplicated it with
// less context, so it redirects to the cases list.
export default function StudioPage() {
  redirect("/cases")
}
