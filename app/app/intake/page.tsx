import { Mail } from "lucide-react"
import { getCouncilName } from "@/lib/queries"
import { IntakeTabs } from "@/components/intake/intake-tabs"

export const dynamic = "force-dynamic"

// The real mailbox polled by SP_POLL_OUTLOOK_INBOX via Microsoft Graph.
const LIVE_MAILBOX = "foi@exampleton.onmicrosoft.com"

function inboxFor(council: string): string {
  const slug = council.toLowerCase().replace(/\s+/g, "").replace("citycouncil", "").replace("council", "")
  return `foi@${slug || "council"}.gov.uk`
}

export default async function IntakePage() {
  const council = await getCouncilName()
  const inbox = inboxFor(council)

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-4">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Mail className="size-6" style={{ color: "var(--brand-primary)" }} />
          Email intake (demo)
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Two ways to see intake work: <span className="font-medium text-foreground">Outlook Test</span> pulls
          real mail from the shared inbox over Microsoft Graph and triages it live;{" "}
          <span className="font-medium text-foreground">In-App Test</span> lets you write or AI-generate a request
          on the spot. No real email is sent from here, and every case created is real and demo-marked.
        </p>
      </div>

      <IntakeTabs liveMailbox={LIVE_MAILBOX} inbox={inbox} />
    </main>
  )
}
