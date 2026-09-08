# Deen Daily — Deployment Guide (no coding needed)

The redesigned app includes:
- **index.html** — the app's screens (Prayer, Qur'an, Duas, Qibla, Scholar)
- **styles.css** — the redesigned desktop and mobile styles (upload this alongside index.html)
- **app.js** — the app's logic (upload this alongside index.html)
- **api/scholar.js** — a tiny backend that lets Scholar talk to Claude while keeping your API key secret

What's included: prayer times with 9 calculation methods, auto/manual location, live next-prayer countdown, prayer tracker with streaks and missed counts, Hijri date and upcoming Islamic holidays, the full Qur'an (all 114 surahs, every English translation and reciter the API hosts, transliteration toggle, bookmarks, search, resume reading, play full surah), an authentic adhkar library with favorites and a digital tasbih, a Qibla finder with live compass on phones, and Scholar.

Native-only features (adhan push notifications, home-screen widgets, AR qibla, offline mode) require the App Store version — see the bottom of this guide.

The Qur'an part works instantly with no keys — it loads all 114 surahs, every English translation, and every reciter from the free AlQuran Cloud service. Scholar needs one API key (step 3).

---

## Step 1 — Put the code on GitHub (5 minutes)

1. Go to **github.com** and create a free account (if you don't have one).
2. Click the **+** in the top right → **New repository**. Name it `deen-daily`. Keep it Public or Private — either works. Click **Create repository**.
3. On the new repo page, click **uploading an existing file**.
4. Drag in `index.html`, `styles.css`, AND `app.js` together, then click **Commit changes**.
5. Click **Add file → Create new file**. In the name box type exactly: `api/scholar.js` (the slash creates the folder). Paste the contents of scholar.js into the editor. Click **Commit changes**.

## Step 2 — Deploy on Vercel (5 minutes)

1. Go to **vercel.com** and sign up with your GitHub account (free).
2. Click **Add New → Project**.
3. Find your `deen-daily` repo and click **Import**.
4. Don't change any settings. Click **Deploy**.
5. In ~1 minute you'll get a live link like `deen-daily.vercel.app`. **The Qur'an tab is fully working at this point.**

## Step 3 — Turn on Scholar (5 minutes)

1. Go to **console.anthropic.com**, create an account, and add a small amount of credit ($5 is plenty to start).
2. Go to **API Keys → Create Key**. Copy the key (starts with `sk-ant-`).
3. Back in Vercel: open your project → **Settings → Environment Variables**.
4. Add a variable:
   - Name: `ANTHROPIC_API_KEY`
   - Value: paste your key
5. Go to the **Deployments** tab → click the **⋯** on the latest deployment → **Redeploy**.
6. Done. Scholar is live.

---

## Costs

- GitHub: free
- Vercel: free tier is plenty to start
- Scholar: pay-per-use. A typical answer costs a fraction of a cent; $5 of credit covers hundreds of conversations. If the app grows, add a login/limit so strangers can't drain your credit (ask Claude to build that next).

## Before you promote this to real users

1. **Verify the content.** Qur'an text and translations come from AlQuran Cloud (a well-known free service) — but have someone knowledgeable spot-check surahs and Scholar's answers.
2. **Scholar can make mistakes.** The disclaimer in the app is there for a reason. Don't remove it.
3. **Phone app later.** This works great in a phone browser (users can "Add to Home Screen") — validate it there first.

## Path to the App Store (when you're ready)

1. **Validate on the web first.** Get real people using the Vercel link. Fix what they complain about. This costs $0.
2. **Apple Developer account** — $99/year at developer.apple.com.
3. **Wrap the app with Capacitor** (capacitorjs.com) — it turns this exact web app into a real iOS app. You'll need a Mac with Xcode, or a cloud service like Ionic Appflow if you don't have one. Ask Claude to walk you through the Capacitor setup when you reach this step — it's a guided, doable process.
4. **Add native features.** This is the important part: Apple often rejects apps that are "just a website in a wrapper" (their guideline 4.2). Before submitting, add at least: local adhan notifications, offline surah caching, and a home-screen widget. These are exactly the native-only features from your list — they become possible at this step, and they're also what gets you approved.
5. **Submit for review.** First review takes days to a couple of weeks; rejections are normal — you fix and resubmit.

Realistic budget: $99/year + a Mac (or ~$50/month cloud build service while you need it). Realistic timeline from "web app has users" to "live on App Store": 1–2 months.

## Updating the app

Upload the changed files (`index.html`, `styles.css`, and/or `app.js`) together on GitHub and commit. Vercel redeploys automatically in about a minute.
