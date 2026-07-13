import { redirect } from "next/navigation"

// Internal Review & ICO now lives inside the Cases area (Reviews & ICO tab),
// because it acts on cases.
export default function ReviewPage() {
  redirect("/cases?view=reviews")
}
