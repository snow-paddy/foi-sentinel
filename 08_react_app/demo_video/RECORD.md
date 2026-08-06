# FOI Sentinel — Recording Runbook (phased, live-narration attempt, VO fallback)

Recorded on the **deployed** app in three phases across pre-authenticated tabs. Logins are primed once up front and never appear in a phase clip. You narrate each phase live over `SCRIPT_3ACT.md`; if a phase's audio is clean we keep it, otherwise that phase gets a post-recorded voiceover. Capture is **full screen 1** (avfoundation index **3**).

## Roles
- **I (agent)** launch every script (`pw_login.mjs`, `run_phase.sh`, assembly).
- **You** complete the logins in the window that opens, then narrate each phase when I start it.

## Prereqs (verified 2026-07-07)
- Part A fixes deployed (badges correct, chain verified, letters table-free).
- Graph intake live; mailbox `foi@exampleton.onmicrosoft.com` cleared.
- SharePoint Openflow corpus synced; redaction cache pre-warmed.
- Optional reset so redaction opens on "no prior decisions":
  `DELETE FROM FOI.FOI_SENTINEL_V2.SAR_REDACTION_DECISION WHERE SOURCE='studio';`

## Phase 0 — prime the authenticated profile (once)
I run `node demo_video/pw_login.mjs`. A real Chrome opens (automation fingerprints stripped, so SSO works) with tabs for **Gmail**, **Outlook** (shared FOI mailbox), the **FOI Sentinel SSO app**, and **SharePoint FOISARDemo**. You sign into each, then I mark it done (`touch /tmp/foi_login_done`). Profile saved to `~/foi_demo_pw_profile` and reused by every phase, so phase clips have no logins.

## Phases — I start each; you narrate
Each command starts the screen recorder (screen 1, mic on for the live take), drives the phase, and stops automatically. Narrate the matching act from `SCRIPT_3ACT.md`.

```
zsh demo_video/run_phase.sh 1 mic 3     # Phase 1 = Act 1  FOI Sentinel walkthrough
zsh demo_video/run_phase.sh 2 mic 3     # Phase 2 = Act 2  Gmail -> Outlook -> intake -> Studio
zsh demo_video/run_phase.sh 3 mic 3     # Phase 3 = Act 3  Redaction Studio -> SharePoint
```
- `mic` keeps your live narration; use `silent` to skip audio and add VO later.
- `3` is Capture screen 1 (full). Use `2` for the primary display (Capture screen 0).
- **Phase 2 note:** the recorder sends the Gmail message and shows the Outlook arrival automatically. Just narrate.
- **Phase 3 note:** drag `2026-04-02_ASC-2026-04021_file_note.docx` into the SharePoint FOISARDemo library by hand just before the SharePoint beat, so the "save a new file → it appears" moment is genuine.
- Re-run any single phase as many times as you like; each overwrites `raw/phaseN.mkv`.

## Trim (only if needed) and assemble
No logins to remove. Trim only dead air at head/tail of a phase:
```
/opt/homebrew/bin/ffmpeg -i demo_video/raw/phase1.mkv -ss <start> -to <end> -c copy -movflags +faststart demo_video/raw/phase1.mp4
```
(If a phase needs no trim, just remux: `... -c copy demo_video/raw/phase1.mp4`.)

Generate slides (`generate_slides.py` → 00_intro_title, 01_architecture, 02_outro). Then assemble:
```
# keep the live narration captured during the phases:
LIVE_AUDIO=1 python demo_video/assemble_video.py            # -> final.mp4

# OR drop live audio (silence) and add a clean voiceover last:
python demo_video/assemble_video.py                          # captioned, silent
VO=1 python demo_video/assemble_video.py                     # -> final_vo.mp4 (needs demo_video/vo.m4a)
```
Captions: author `demo_video/captions.ass` from `SCRIPT_3ACT.md` (lower-third, PlayResY=1080), synced to the assembled body. Burned automatically if present.

## Validation
`node demo_video/validate_selectors.mjs` (headless, localhost) confirms every in-app anchor the recorder targets resolves. All six passed 2026-07-07, including the fixed **Chain verified** badge.
