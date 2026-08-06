# FOI Sentinel — Demo Operator Guide

A step-by-step guide for running the FOI Sentinel demonstration live. The order below matches the demo video exactly, so you can narrate along with it or run it standalone. Allow about 12 minutes end to end.

This guide is for internal use. It contains the live application URL and the demo login, so do not commit it to a public repository.

---

## 1. Before you start

**You will need four browser tabs, signed in ahead of time so no login appears during the demo:**

| Tab | Purpose | Sign in as |
| --- | --- | --- |
| FOI Sentinel | The application | `FOI_APP_DEMO` |
| Gmail | The member of the public sending the request | any Gmail account |
| Outlook | The council's shared FOI mailbox | `foi@exampleton.onmicrosoft.com` |
| SharePoint | The `FOISARDemo` documents library | the same Microsoft 365 account |

**Application URL:** `https://a7zt2t-sfseeurope-us-west-demo-pg.snowflakecomputing.app`

**Login:** user `FOI_APP_DEMO`, with the password set when the account was created. This user can reach every feature of the app and holds no access to any other Snowflake data, so it is safe to demo with.

**Two things to do 10 minutes before the audience arrives:**

1. **Reset the demo state.** Act 1 sends a batch and moves a case, so the app must be returned to baseline first. From the project directory run:
   ```bash
   snow sql -f demo_video/RESET_DEMO.sql --connection PG-SNOWFLAKE
   ```
2. **Warm up the SAR redaction.** The first redaction run of the day is slow (a few minutes) because the document is parsed cold. Open the SAR request (Act 3, step 1 below), click **Run AI redaction** once, and let it finish. After that it responds in seconds for the live run.

Have the example email (section 2) already composed in the Gmail tab, ready to send.

---

## 2. The example email to send

In the Gmail tab, compose this message before the demo so you only have to press **Send** during Act 2.

> **To:** `foi@exampleton.onmicrosoft.com`
> **Subject:** Freedom of Information request: senior officer salaries
>
> Dear Information Governance Team,
>
> Under the Freedom of Information Act 2000, please provide a list of all council staff earning more than £100,000 per year, including their job title and total remuneration for the most recent financial year.
>
> Please provide the information in electronic form. If you need any clarification, do let me know.
>
> Yours faithfully,
> A. Requester

---

## 3. Running the demo

### Act 1 — The command centre and the caseload

1. **Command Centre (home).** Land on the home page and let the SLA gauge sweep up. Point out the statutory-clock view and the peer benchmark. Scroll to "Where requests are in the process" and expand the **Triage & allocation** stage. Then scroll to the **Intelligence** section, toggle the "Most frequent terms" card between **Ranked** and **Word cloud**, and click a term to see the cases behind it.
2. **Cases.** Open **Cases** in **Focus** view and show the three lanes (Quick wins, Needs review, Complex). Switch to **List** view and click the **FOI**, **EIR** and **SAR** filter chips in turn, then back to **All open**. Switch to **Board** view and show the six statutory phases, the **Challenge (s.50)** column held apart, and the `Cx` complexity chips. Hover a complexity chip and a precedent-match pill. Drag one card one column to the right. Return to **Focus**, open **Needs review**, and open **FOI-2026-0115** (a partial). Show "How AI triaged this case", the "Why this is a partial disclosure" panel, and the **Chain verified** audit badge. Open the **Complex** tab as a view only and point to the driver chips.
3. **Quick wins.** Switch to the **Quick wins** lane. Untick **FOI-2026-0114** (it overlaps the Act 2 email, so leave it fresh), then click **Send responses**, confirm in the sign-off dialog, and watch the cases flip to **Sent, case closed**.
4. **Knowledge Base.** Open **Knowledge Base** from the top nav. Show the three grouped sections. Open the **Legislation library** tab and click a section to open it on legislation.gov.uk. Return to **Guidance & precedent**, search **personal data**, then search **how much is council tax going up next year** and let the green **Already published, section 21** card resolve.

### Act 2 — A real request, from inbox to grounded draft

5. **Send the request (Gmail tab).** Switch to Gmail and click **Send** on the pre-composed message.
6. **Receive it (Outlook tab).** Switch to Outlook and show the message arriving at the top of the shared FOI mailbox.
7. **Intake and triage (FOI Sentinel, Intake).** Switch to the app's **Intake** page (Outlook Test tab). The unread message shows under "Waiting to be triaged". Click **Run the pipeline** and let the six steps reveal: classification, triage (section 14 and section 21 checks), precedent match, suggested answer, evaluation, compiled draft. Expand one "Under the hood" to show the SQL and prompt.
8. **Response Studio.** Open the new case and go to **Response Studio**. Show the four outcome buttons with **Disclosure** pre-selected. Click **Generate**, then show the grounded letter with inline citations, the verified-source provenance strip, and the disclosure badges (internal-review right and ICO route present, no exemption stated).

### Act 3 — Subject access, redaction, and the live document estate

9. **SAR queue and redaction (FOI Sentinel, SAR).** Open the **SAR** page. Show the queue of pseudonymised requesters on the one-calendar-month clock. Click **SAR-2026-0107**. The header resolves to the verified data subject (James Whitfield). Hover the **Identity verified** badge to show the out-of-band verification. Point out that the AI clears two of the six documents as the subject's own and flags four for review. Scroll to the **Redaction Studio**, click **Run AI redaction** (already warmed), and show the findings with confidence scores. Untick the council officer's email (`thomas.lee@`) to keep it, redact the rest, then click **Confirm & release**. Click **Re-run** to show the prior decisions being pre-applied.
10. **SharePoint continuous sync (SharePoint tab).** Switch to the **FOISARDemo** library where the case files live. Save the file `2026-04-02_ASC-2026-04021_file_note.docx` into the library. Switch back to the app's **SAR** page and **refresh**: the new document appears in the findings, surfaced by relevance and flagged as containing third-party data, linked back to SharePoint.

---

## 4. After the demo

Run the reset again so the environment is clean for the next run:

```bash
snow sql -f demo_video/RESET_DEMO.sql --connection PG-SNOWFLAKE
```

---

## 5. Talking points and accuracy notes

- **Third-party data in a SAR** is withheld under the UK GDPR Article 15 balancing test in the Data Protection Act 2018, and an officer approves each item. Section 40 is the parallel FOIA exemption. Keep the two straight if asked.
- **The redaction "memory"** recalls each officer's prior decision on the same value and pre-applies it. It is deterministic recall, not model retraining. Model fine-tuning is a separate future step.
- **Nothing leaves Snowflake.** The application reasons in-database with Cortex, and disclosures are officer-approved and hash-chained for audit.

The full narration script is in `SCRIPT_3ACT.md`, and the objection-handling FAQ is in `FAQ_BATTLECARD.md`.
