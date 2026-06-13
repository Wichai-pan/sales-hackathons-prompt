# Recording Checklist — HMD Secure CRM demo

Target final length **2:45** (3:00 cap − 15s buffer). Record from the LIVE URL: http://43.165.2.182:3000

## Before you hit record
- [ ] **Fresh seed**: if the live data is dirty from testing, redeploy once (`ssh frankfurt 'cd /opt/hmd-crm && git pull && docker compose up -d --build'`) — then DO NOT redeploy again (it re-seeds and wipes anything you create on camera).
- [ ] Logged in as **Sofia Rep**, sitting on `/rep`.
- [ ] Clean desktop: close all other windows; **notifications OFF** (macOS: Focus / Do Not Disturb).
- [ ] Browser: ONE tab, no other tabs/bookmarks bar visible, no extensions popping. Zoom to ~110–125% for projector legibility.
- [ ] Hide the URL-bar autocomplete (type the URL fresh once, then clear history suggestions) — or pre-open the page.
- [ ] Audio: test mic level; quiet room; no system sounds.

## Recording technique
- [ ] Record in **≤40-second segments** — re-record one beat, not the whole take.
- [ ] Tool: macOS native screen recording (Cmd+Shift+5) or QuickTime; OBS if compositing pre-recorded fallback clips.
- [ ] Move the mouse deliberately and slowly; pause ~1s on each magic-moment panel (intake draft, NBA card).
- [ ] No dead seconds at start or end — trim to first/last spoken word.

## The two magic beats get the most care
- [ ] **AI intake** (beat 2): let the draft preview fully render before clicking Apply; the case + deal + contact must be visible on screen.
- [ ] **Next best action** (beat 4): hold long enough to read the recommendation + at least one reason bullet.

## After recording
- [ ] Final length ≤ 2:55, ideally 2:45.
- [ ] Watch once for: dead air, misclicks, any data that looks wrong/empty, audio dropouts.
- [ ] Export, name it clearly (e.g. `hmd-secure-crm-demo.mp4`), note where it's stored.
- [ ] Record a **safety full-run clip** too (the whole 7-step path) — this is the live-demo fallback.

## Submission (do at T-3h via hackathon-closer)
- [ ] Email to: anssi.ronnemaa@hmdglobal.com, janne.lehtosalo@hmdglobal.com (auto-CC organizers) BY Sun 15:00 Helsinki.
- [ ] Include: live URL http://43.165.2.182:3000 · repo https://github.com/Wichai-pan/sales-hackathons-prompt · demo video.
- [ ] Pick the HMD challenge on the team page first if required.
