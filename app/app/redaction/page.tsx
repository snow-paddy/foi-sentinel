import { redirect } from "next/navigation"

// The Redaction Studio is now embedded in the SAR flow (Section 3 of /sar) so the
// SAR example is one continuous story rather than two separate pages.
export default function RedactionPage() {
  redirect("/sar")
}
