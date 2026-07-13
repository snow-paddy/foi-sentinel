import { redirect } from "next/navigation"

// The escalation generator now lives inside the Cases → Reviews & ICO tab,
// alongside the review/ICO queues it feeds.
export default function EscalationsPage() {
  redirect("/cases?view=reviews")
}
