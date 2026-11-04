# Daily Carousel Maker · Homes.ph

A Windows desktop app (and web app, and Android app) for planning, designing and exporting Homes.ph Facebook/Instagram carousels every day.

- **Home.** Every card lines up: the title always takes two lines, then the date, the status, and the **Checklist** and **PNGs** buttons along the bottom. The first page you see: one month at a time (pick it with the arrows or the month list; it opens on this month), carousels in publication order: October 31, November 1, November 2… Each is a pile of its slides, like stacked photos: the cover on top with its real cards tilted underneath, sharp corners, 5 per row. Posted (Published) carousels are greyed out. Beside the **⋯** menu: a **check** button (mark as posted now, click again to undo) and a **download** button (every slide as its own PNG: 1.png is the cover, then 2.png, 3.png…). Search looks through every month.
- **Posting checklist (17 Facebook pages).** Every carousel has a checklist of the Homes.ph pages: Main Page, Ozamiz, Dumaguete, BGC Taguig, Cebu, Pampanga, Cavite, Iloilo, Bacolod, Davao, Palawan, Bohol, Makati, CDO, Gensan, Caraga and Leyte. Tick a page after posting on it: the person signed in and the time are saved (e.g. *Posted: Frank Gomez | Peter Yares*). The count shows *6/17*; while some pages are done the carousel is **Partially published**, and once all 17 are ticked it becomes **Published** (greyed out on Home). Unticking a page of a finished checklist makes it not posted again. Open it from the ✓ button on a Home card, the carousel preview, or the website.
- **Floating checklist.** **Floating checklist** (in the carousel preview, or *Open in a small window* on the website) opens the checklist in its own small window that stays on top of the browser while you post on Facebook. Its picker shows every carousel with ✓ (posted), ◐ (part-way) or ○ (not yet).
- **Team.** Each person signs in with their own account. **Settings → Team**: set *Your name* (shown as *Made by* and *Posted by*) and add teammates by the email of their account; everyone in the team sees, edits and posts the team's carousels. Only a carousel's owner can delete it for good.
- **New carousels, one a day at 11:00 PM.** **Create New Carousel** starts on the next day that has no carousel yet (e.g. Oct 30 – Nov 3 done → Nov 4) at 11:00 PM; pick another day if you like. Each carousel shows **Made early · N days ahead**, **Made on the day** or **Made late**, and **by** whoever made it.
- **Carousel preview.** Clicking a carousel on Home shows it like the posting sheet: the cover large on the left, the cards three across beside it, the caption underneath, and the pages checklist on the side. Click a slide to edit it.
- **Dark mode (default).** The app, the floating editor and the posting website open in an elegant navy dark mode. The **sun / moon** button (top bar of every page, the editor bar, the website header and the sign-in page) switches to light mode in one click; the choice is remembered on that computer and applies to every open window, and the desktop app's title bar and splash screen follow it. Exported images are never affected.
- **Android app (APK).** *Homes.ph Carousels* for phones and tablets: the carousels ready to post (swipe the slides, **Save all slides to Photos** numbered 1 = cover, **Share…** straight to Facebook or Messenger, one-tap caption copy, the 17-page checklist), the day's **News** posts for PicklePlay, FHI and Homes.ph CARAGA (save or share each), the **Daily Report** image, and **Settings** (dark/light, your name, team). Same account and data as the desktop app. See *Android app* below.
- **Posting website.** A separate light website (no editor) for whoever posts: the carousels ready to post, grouped by day, each with its slides, caption (one-click copy) and downloads. **Mark as posted** saves the date and time; the Carousel Maker then shows the carousel as Published with that time. See *Posting website* below to deploy it.
- **Daily Report (Daily Tasks image).** Sidebar → **Daily Report** (or **Generate report** on News Article): pick a day and download one PNG laid out like the Figma "Daily Tasks" board. **DONE** shows the day's *Pickleplay.ph Article Posting*, *FHI Global Property Article Posting* (each post under its 9 AM / 11 AM / 3 PM / 7 PM / 10 PM label; wide FHI posts at their full 1742 px width) and *Homes.ph CARAGA Article Posting* (11 AM / 1:30 PM / 6 PM / 8 PM / 10 PM), then *Scheduled Carousel Posting (Homes.ph Pages)* — the pages it went out on (with the Homes.ph logo), all its slides and the caption. **PENDING** lists what's still to do: empty article slots (today and tomorrow; *Pickleplay.ph & FHI Global Property* share a line when the same times are missing, *Homes.ph CARAGA* has its own), carousels not (fully) posted with the pages left, and a carousel not made yet. Standard size is 5082 px wide; Full size is the Figma's 10164 px. The page itself is a dashboard: the day and the download on top, a card per brand and for the carousel with progress bars, each brand's posts in a neat row by time (empty times as dashed slots), the carousel's slides, the pages it went out on and its caption, then Pending grouped by day — with the Daily Tasks image beside it (click any picture, or **View full size**, to see it large).
- **News Article: daily posts.** Sidebar → News Article opens **Daily posts**: for the chosen day, a row per brand with its five posting times: **PicklePlay PH** and **FHI Global Property** at **9 AM, 11 AM, 3 PM, 7 PM and 10 PM**, **Homes.ph CARAGA** at **11 AM, 1:30 PM, 6 PM, 8 PM and 10 PM**. Each slot is its template, ready to fill: click its frame and press **Ctrl+V** to paste a picture (or drop one, or use **Paste** / **Photo**), and type the headline under it — the post is created for that day and time and saved as you type. FHI slots switch between **Template 1 · Portrait (1152 × 1408)** and **Template 2 · Wide (1742 × 1436)**, keeping the headline and photo. **PNG** exports at the template's full size, named like `2026-11-01 3PM FHI Global Property.png` (or `… 1.30PM Homes.ph CARAGA.png`); **Edit** opens it in the editor, where the photo can be dragged and zoomed inside its frame (the frame is the mask). **All articles** lists every news article.
- **Homes.ph CARAGA template (Figma).** 1408 × 1408 Homes.ph blue (#1428AE): the white H on top, the photo in a rounded card (1234 × 808, radius 30), a centered 3-line headline (Outfit 600, 76 / 90) and the www.homes.ph / facebook.com/homesphofficial footer.
- **FHI Global Property templates (Figma).** Template 1 · Portrait: navy #002D5C, logo top left, Outfit 700 55/65 headline, www.fhiglobal.ae, and the photo filling the bottom 933 px. Template 2 · Wide: the photo full-bleed under a navy fade, logo with drop shadow, centered Outfit 800 70/80 headline above www.fhiglobal.ae (longer headlines grow upwards).
- **News Article (PicklePlay).** Single **1408 × 1408** news graphics with the PicklePlay template: background art, PicklePlay logo, a rounded photo card with border and shadow, a centered 3-line headline (Outfit 600, 76 px) and the pickleplay.ph / Facebook footer. Type the headline and watch the live preview, add the photo in the editor (paste, drop or upload), and export at the original 1408 × 1408.
- **Trash.** Deleting a carousel asks you to type its title, then moves it to the **Trash**, where it stays for 30 days. From there you can **Restore** it or **Delete forever** (again after typing the title). A deleted carousel disappears from every list at once: Home, Calendar, Unscheduled, Day Board and All Content.
- **Day Board.** A Figma-style workspace that shows every carousel scheduled for a day as a row: the cover and cards side by side with their frame names, and the caption underneath. Pan and zoom like Figma, click any slide to edit it, and add as many carousels per day as you need.
- **Calendar.** Month, week and day views, plus a status board. Drag carousels between days to reschedule them, or between columns to change their status.
- **Editor.** Every slide is an exact **1254 × 1254 px** canvas. The cover is always slide 1, followed by content cards.
- **Homes.ph layouts from Figma:**
  - **Cover (Carousel Cover, default):** photo on navy #0B1F8E, two blurred navy *Title Glow* gradients (the second at 41%), a navy *Top Band* fading down from the top, the gold/blue corner swoosh at the top right **and mirrored at the top left** (Corner Gold Swoosh 560 × 180 and Corner Blue 560 × 125 from left 694; covers made before 1.6 get the left one added once), the bottom blue gradient, the white H logo (88 × 86 at left 583, top 39), and the **Title Block** (1062 px wide, y 394–802):
    - *Headline Line 1 (White)*: Outfit Black, 172 px.
    - 5 px gap.
    - *Headline Line 2 (Gold)*: Outfit Black, 148 px, with a left-to-right #FDBA2F → #FEDF69 gradient.
    - 20 px gap.
    - *Subtitle*: Outfit SemiBold, 50 px on a 63 px line.
    - All three have the soft navy text shadow.
    - Footer: web icon + www.homes.ph, Facebook icon + facebook.com/homesphofficial.
    - The first cover design is still available as **Classic Cover (Blue Fade)**.
  - **Card:** photo, blue gradient, the same navy *Top Band* and white H logo (88 × 86 at 583, 37) as the cover, *Card Title*, *Card Subtitle* (#FFF1B9) and *Card Description*. All card templates have the top band and logo. Leave the subtitle empty and the card switches to the **no-subtitle layout** automatically (title at y 1016).
  - **Card Description: 2–3 lines.** Under the field you see "2 lines — good". With 1 line the app asks for a few more words; with 4 or more it asks you to shorten it. Export lists any card that's off before exporting.
  - Also included: text-focused, full-image and quote/statistic cards, plus your own saved templates.
- **Title Auto-Fit (your Figma plugin, built in).**
  - Each title line stays on **one line** inside 1062 px. It shrinks from its max size (172 / 148 / 50 px) until it fits, and never grows past it.
  - The gap between the two headline lines is 5 px at full size and shrinks with the text, following the plugin formula: `round(5 × ratio²) + extra gap`. Here `ratio` is how far the more-shrunk headline is below its own max size.
  - The subtitle stays 20 px below, and the Title Block stays centered at y 598.
  - It runs live as you type. The plugin's options are in the cover's slide settings: *Same size for white & gold lines*, *Keep Title Block centered* and *Extra line gap*. Set your defaults in **Settings → Brand**.
- **Official logos with automatic color.** The Homes.ph logo is **blue on light photos** and **white on dark photos or the Blue Fade**. The app measures the pixels behind the logo on every slide, so the editor, previews and exports always agree. You can force white or blue per slide.
- **Carousel title = Headline 1 + Headline 2.** You don't type a separate title: it's the two cover lines joined, and it updates as you edit the cover.
- **Captions are required.** You write the caption when you create the carousel, and a carousel can't be scheduled or published without one. On the Day Board the caption sits under the slides in a clean, transparent block, with Copy, Edit and Draft from slides. **Draft from slides** writes a first draft in the Homes.ph style ("Discover …! From … and … to …, …, and …, …") from the cover description and card titles, ready for you to edit and copy.
- **AI suggestions (Groq).** Three ✨ buttons, and nothing changes until you click **Use this** (or **Try again** for another version):
  - **Card description:** *Shorten with AI* appears when a description is longer than 3 lines (or *Write it with AI* when it's under 2). The AI reads the card title, subtitle and the old description, and writes an informative 2–3 line description that doesn't repeat the title or subtitle.
  - **Cover subtitle:** *Write / Improve subtitle with AI* reads the title, the current subtitle and every card, and writes one short line, e.g. "6 Condos In BGC Under ₱10M".
  - **Post caption:** *Write / Rewrite caption with AI* (Caption tab, Day Board and the floating editor) reads every slide and writes a short caption with a hook, in the Homes.ph tone.
  - The AI only uses facts from your slides. It avoids emojis, hashtags and typical "AI" phrases.
  - Each request is small and capped (`openai/gpt-oss-120b`, low reasoning), so it costs a fraction of a cent. There's a limit of 20 requests a minute.
- **Image import.** File picker, drag-and-drop onto the canvas or a slide thumbnail, and **Ctrl+V** paste. JPG, PNG (transparency kept) and WebP.
- **Paste from ChatGPT, Figma or any app.** Copy an image anywhere and press **Ctrl+V** in the editor: it becomes the current slide's background photo, at the back, behind the gradient and text. If the app copied the image as a link (some browsers do), the app downloads the image itself. In Figma, use **Copy as PNG** (Ctrl+Shift+C).
- **Floating editor (desktop).** Click **Float** in the editor. When you switch to Chrome, ChatGPT or any other app, a small always-on-top window pops up with just the current slide's fields (Headline 1, Headline 2, Subtitle, or the card's Title, Subtitle and Description) and a live preview. The post caption appears on the **Cover** tab, and **+ Card** adds a new card after the current slide. Paste text into the fields and Ctrl+V images onto the preview. Come back to the main window and it hides. Move it by its title bar and resize it from any edge; it remembers where you put it.
- **Backup & restore.** **Settings → Backup & restore** saves one .zip with every carousel (text, captions, dates, layouts) and the original images. Restoring adds them back as new carousels; nothing you already have is changed. You can also back up a single carousel from its **⋯** menu or the editor's **Export** menu.
- **Image storage in Settings.** **Settings → Image storage** checks the Cloudinary connection for real and shows Cloudinary's exact error if something is wrong (for example a wrong cloud name). It shows storage used out of your plan (e.g. "1.4 GB of 25 GB") and the monthly credits. If the API key may not read the usage report, it shows the storage used by this app's uploads instead. **Test upload** uploads a tiny image with your key and deletes it again. You also see the images saved on this computer and waiting to upload, with **Upload now**.
- **Fast start.** Lists, Day Board previews, settings and templates are cached on your computer, so pages open instantly with your last data and refresh quietly in the background (also after restarting the app). The cache is per account and is cleared when you sign out.
- **Image quality.** Originals are stored untouched in Cloudinary and exports render from the original. Nothing is downscaled, screenshotted or re-encoded in between.
- **Images never disappear.** Every image you paste or import is saved on this computer first, then uploaded to Cloudinary. If the upload can't happen (offline, Cloudinary not set up, wrong cloud name), the image stays in your slide from the local copy and uploads automatically later. The saved carousels then switch to the Cloudinary original. Cloud images are also kept locally after their first download, so they open instantly. Deleting an image from the library removes the local copy too.
- **Export.** Current slide as PNG or JPEG, or all slides as a ZIP (which includes the caption and slide list) or as separate files. Files are numbered in carousel order: **1.png is the cover**, then 2.png, 3.png… (the ZIP is named after the date and title; in the desktop app, separate files go into their own folder in Downloads). Every carousel file is exactly 1254 × 1254 px (news articles 1408 × 1408), rendered from the full-resolution originals. PNG is lossless (best quality); JPEG is saved at maximum quality (100). Before exporting, the app warns if a photo is smaller than its frame (e.g. a 1024 × 1024 image from ChatGPT on the full 1254 px slide), because it would be enlarged and look softer, and it tells you the size needed for full sharpness.
- **Saving.** Autosave to Supabase with conflict protection, offline retry and local recovery of unsaved work. Undo/redo throughout.

## Desktop app (Windows .exe)

### Install

1. Build the installer (see *Building the installer* below) or use the one already built: `dist\Daily-Carousel-Maker-Setup-1.15.0.exe`. Installing a newer version replaces the old one and keeps your settings.
2. Double-click it. It installs for your Windows user, adds **Daily Carousel Maker** to the desktop and Start menu, and opens the app.
3. The installer isn't code-signed, so Windows SmartScreen may show "Windows protected your PC". Click **More info → Run anyway**.

### First run

1. **Sign in** with your email and password. Create the account in the app or in Supabase (see *Supabase setup*). The desktop app uses password sign-in; email links would open in your normal browser instead.
2. Your Cloudinary settings come from `.env.local` when the installer is built, so normally there's nothing to enter. A newer installer fills in anything that's empty and applies values that changed in `.env.local`. To change them without rebuilding, use **Settings → Desktop app connection**, then **Save and restart**. **Settings → Image storage** confirms they work.

How it works: the app runs its own private server on `http://127.0.0.1:3939` (only reachable from your computer) and shows it in a normal Windows window. Your data is stored in Supabase and your images in Cloudinary, so the app needs an internet connection.

- Exports are saved straight to your **Downloads** folder, with a notification. "Separate files" exports go into their own folder (`Downloads\2026-10-30-title\1.png, 2.png…`).
- Settings, logs and the images saved on this computer live in `%APPDATA%\daily-carousel-maker` (**File → Open app data folder**).
- Close the window to quit. If changes are still saving, the app asks before closing.
- **Floating editor:** in the editor, click **Float** (it stays on until you turn it off). Switch to another app and the quick-edit window appears; click back into Daily Carousel Maker and it hides. **⤢** opens the full editor; **✕** turns the floating editor off.

### Building the installer

```bash
npm install
npm run desktop:dist      # → dist/Daily-Carousel-Maker-Setup-<version>.exe
```

`npm run desktop` builds and opens the desktop app without packaging it. `npm run desktop:start` reopens the last build.

The build bundles the server-side Cloudinary settings from `.env.local` into the app, as a seed for its private settings file. **Don't share the installer publicly**, because it contains your Cloudinary API key and secret. To leave them out, build with empty `CLOUDINARY_*` values and enter them in **Settings** after installing.

## Tech stack

- **App:** Next.js 16 (App Router, TypeScript) · Tailwind CSS v4 · shadcn/ui (Radix) · zustand · date-fns · dnd-kit · Lucide icons
- **Canvas and export:** Konva / react-konva · fflate (ZIP)
- **Services:** Supabase (Auth + Postgres + RLS) · Cloudinary
- **Desktop:** Electron 45 + electron-builder (NSIS installer)
- **Fonts:** self-hosted Outfit, Inter and Plus Jakarta Sans, so the editor and exports always use the same typefaces. Inter also fills in glyphs Outfit lacks, such as the ₱ sign.

## 1. Install (development)

Requires Node.js 22.12+ (tested on Node 24) and npm.

```bash
npm install
```

## 2. Environment variables

```bash
cp .env.example .env.local
```

| Variable | Where to find it | Exposed to browser? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Yes (safe) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → *Publishable key* | Yes (safe — access is enforced by RLS) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary Console → Dashboard → *Cloud name* | No |
| `CLOUDINARY_API_KEY` | Cloudinary → Settings → API Keys | No |
| `CLOUDINARY_API_SECRET` | Cloudinary → Settings → API Keys | No |
| `CLOUDINARY_UPLOAD_PRESET` | Optional *signed* upload preset with extra restrictions | No |
| `CLOUDINARY_FOLDER` | Optional, default `homes-ph-carousel` | No |
| `CLOUDINARY_API_BASE_URL` | Optional, default `https://api.cloudinary.com` (proxies/testing only) | No |
| `GROQ_API_KEY` | Groq → API Keys (AI suggestions; optional) | No |
| `GROQ_MODEL` | Optional, default `openai/gpt-oss-120b` | No |
| `GROQ_API_BASE_URL` | Optional, default `https://api.groq.com/openai/v1` (proxies/testing only) | No |

The Supabase **service-role key is not used** by this app; don't add it anywhere. `.env.local` and `desktop-build/` are gitignored; never commit them.

## 3. Supabase setup

> Run **all four** migrations in order: `20261029000000_daily_carousel_maker.sql` (the app), `20261030000000_trash_and_news.sql` (Trash and News Article), `20261030120000_posted_at.sql` (the posted date and time) and `20261031000000_team_posting.sql` (teams, Made by, and the 17-page posting checklist). All are safe to run again.

1. **Create the tables.** Supabase → **SQL Editor → New query**, paste all of `supabase/migrations/20261029000000_daily_carousel_maker.sql`, and click **Run**. It's safe to run more than once.
2. **Auth URLs.** Go to Authentication → URL Configuration and add these redirect URLs:
   - `http://127.0.0.1:3939/auth/callback` for the desktop app
   - `http://localhost:3000/auth/callback` for `npm run dev`
   - `<your-domain>/auth/callback` if you deploy the web version
3. **Create your account.** Simplest: Authentication → Users → **Add user** → tick *Auto confirm*. Or use *Create account* in the app and click the confirmation email while the app is running, then sign in with your password.
4. **Recommended for a private tool:** once your accounts exist, turn off public sign-ups (Authentication → Sign In / Providers → Email).

The migration creates:

- `carousel_projects`, `carousel_slides` (editable `design_json` per slide), `carousel_assets`, `carousel_templates`, `carousel_settings`.
- Row Level Security on every table: a signed-in user can only see and change their own rows, and anonymous access is denied.
- Atomic RPCs: create (project + cover), save (rejects stale revisions with 409), duplicate, and asset usage.
- Constraints: the cover is always slide 0, the status is draft, scheduled or published, and uploads are unique per user + SHA-256.

## 4. Cloudinary setup

Add your cloud name, API key and secret to `.env.local` (web) or **Settings → Desktop app connection** (desktop). Uploads are signed on the server (`/api/assets`). The route:

- checks the signed-in user;
- validates the real file type (magic bytes) and the 25 MB limit;
- de-duplicates by SHA-256;
- stores the original with no transformation.

Removing an image from a slide never deletes it. Deleting is a deliberate action on the **Image Library** page, which shows how many slides use the image first.

## 5. Run the web version

```bash
npm run dev        # http://localhost:3000
npm run build      # production build
npm start          # serve the production build
```

Checks:

```bash
npm run typecheck && npm run lint && npm test
```

## Daily workflow

1. Open the **Day Board** (or click a date in the Calendar).
2. Click **Create New Carousel**. As soon as you type, a live preview of the cover slides in on the right. Type *Headline line 1* (white), *Headline line 2* (gold) and the *Subtitle*, click the publication date on the calendar, and write the caption (required). The title is Headline 1 + Headline 2. Each line auto-fits to one line; the cover is created and the editor opens.
3. Drop or paste (Ctrl+V) a photo on the cover, then add cards (**Add card**) and give each a photo. Type the text in **Design → Slide text**, or double-click text on the canvas. Keep each card description to 2–3 lines. Leave a card's subtitle empty for the no-subtitle layout. Tip: turn on **Float** and fill the fields while you work in ChatGPT.
4. Write the caption (**Caption** tab, or under the row on the Day Board). **Draft from slides** gives you a starting point.
5. **Export → All slides · ZIP of PNGs** and post — or let the person posting use the **posting website**. Mark the carousel **Published** (or **Mark as posted** on the website) when it's live; this never happens automatically.

### Keyboard shortcuts (editor)

| Keys | Action |
| --- | --- |
| Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y) | Undo / redo |
| Ctrl+C / Ctrl+X / Ctrl+V | Copy / cut / paste the selected element. Ctrl+V with an image copied from another app puts it behind the slide as the background photo; copied text becomes a text box. |
| Ctrl+D | Duplicate the selected element |
| Delete / Backspace | Delete the selected element (not while typing) |
| Ctrl+S | Save now |
| Arrow keys (Shift = 10 px) | Nudge the selected element |
| Enter / double-click | Edit text on the canvas |
| Esc | Finish editing / deselect |

Day Board: scroll to move, Ctrl + scroll to zoom, drag the background to pan, click a slide to edit it.

## How it works

- **Slides** are stored as editable JSON: elements (image, text, shape) in layer order, with positions, fonts, gradients, crop and logo settings. Nothing is saved only as a flattened image.
- **Title Auto-Fit.** Each title line is measured with the real font on a single line, at its max size. If it's too wide, the size becomes `floor(max × 1067 / width)` and then steps down 1 px until it fits (minimum 8 px). This is exactly the plugin's `fitSize()`. Headline line height is 100%; the subtitle keeps its 63 / 50 line height.
- **Glows** (radial gradient + `blur(156.5px)`) are painted with the browser's own canvas blur, so they match Figma's CSS. The same bitmap is used in the editor and the export.
- **Text auto-arrange.** The cover Title Block stays centered where Figma places it. The card text stays bottom-aligned, so longer text pushes the block up instead of overlapping. Empty lines are skipped, which is how the no-subtitle layout works. Dragging one of those text boxes by hand turns auto-arrange off for that slide; switch it back on in the slide settings.
- **Logo color.** Before rendering, the app draws only the layers *behind* the logo in its 88 × 86 area (photo, gradients, top band), measures their average luminance, and picks the logo with the better contrast: blue if luminance is above 0.27, otherwise white. With the navy top band this is almost always the white H; very bright photos still get the blue logo. The blue logo fills 65/72 × 63/70 of the slot, centered, like in Figma.
- **Export** renders each slide offscreen at exactly 1254 × 1254, after every font and full-resolution image has loaded. No editor UI can appear in the file. Text that would be cut off, or that runs into the logo or footer, triggers a warning first.
- **Caching.** Data is cached in memory and in IndexedDB, keyed by your user id and the app version. Screens show the cached copy first and refresh it in the background, on window focus, and after any change. Day Board slides and their rendered previews are keyed by each carousel's last change, so they are reused until you edit it. The sign-in check on each page only looks for the session cookie (no network call); the database still checks every request (Row Level Security). The desktop app starts the window while its server boots and keeps Node's compile cache between launches.
- **Backups** are ZIP files: `backup.json` (format `homes-carousel-backup`, version 1) with every carousel's details and full slide designs, plus `images/` with the original files. Restoring uploads the images again (identical files are reused), gives the slides new ids, and points them at the stored originals.
- **Floating editor.** The editor publishes its slides to the desktop app, which relays them to the floating window. The floating window sends back only small edits: text, caption, slide choice, and pasted images. Each message is accepted only from the window it belongs to.
- **Autosave** runs about 1 second after you stop editing, one request at a time. Each save includes its base revision, so an older save can never overwrite newer edits. When offline, it retries automatically and keeps a local backup that it offers to restore.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Set up the database" screen | Run the SQL migration (step 3.1), then reload (F5 in the desktop app). |
| "Please confirm your email first" | Confirm the user in Supabase → Authentication → Users, or click the confirmation email. |
| Uploads say Cloudinary isn't configured | Desktop: Settings → Desktop app connection. Web: add the `CLOUDINARY_*` variables to `.env.local` and restart. |
| "Image saved on this computer" / images waiting to upload | Open **Settings → Image storage** to see Cloudinary's error. The usual cause is the cloud name: copy it exactly from Cloudinary → Settings → API Keys (lowercase, no spaces or dots, e.g. `dq1abc2de`), not the account's display name. Then click **Upload now**. |
| Image storage says "Exact plan totals aren't available for this API key" (Cloudinary: *missing permissions (actions=["read"])*) | The key works; it just may not read Cloudinary's usage report. Settings then shows the storage used by this app's own uploads instead. Click **Test upload** to confirm uploads work. To see the exact plan totals, give the API key read access in Cloudinary (Settings → Role Management), then click **Check**. |
| "This image was never saved" on a slide | It was added before version 1.3, while uploads were failing, and only existed in memory. Paste or drop it again; from 1.3 on, images are saved on this computer first. |
| Desktop app: "could not start" | Close any other copy of the app. Details are in `%APPDATA%\daily-carousel-maker\logs\server.log`. |
| "Windows protected your PC" when installing | The installer isn't code-signed: **More info → Run anyway**. |
| "Image unavailable" on a slide | The original was deleted from the library, or an upload never finished. Replace the image. |
| The logo color looks wrong for a photo | Select the logo → **Logo color** → White or Blue to override Auto for that slide. |
| Export warns about text | Use **Shrink text to fit**, shorten the text, or choose *Export anyway*. |
| AI: "Your Groq account blocks these AI models" | Open console.groq.com → **Settings → Limits** and turn on `openai/gpt-oss-120b` (or `openai/gpt-oss-20b`), then use **Settings → Connections → Test AI**. |
| AI: "The Groq API key was rejected" | Create a key at console.groq.com → API Keys, then put it in `.env.local` (`GROQ_API_KEY`) or in **Settings → Desktop app connection**. |
| The checklist says "Turn on the 17-page checklist", or Settings → Team asks for a migration | Run `supabase/migrations/20261031000000_team_posting.sql` once in the Supabase SQL Editor, then reload. |
| A teammate can't be added ("No account uses that email yet") | Create their account first: Supabase → Authentication → Users → Add user (tick *Auto confirm*), then add that email in Settings → Team. |
| The posted time doesn't save | Run `supabase/migrations/20261030120000_posted_at.sql` once in the Supabase SQL Editor. Until then, Mark as posted only sets Published. |
| There's no Trash / News Article says "Turn on" | Run `supabase/migrations/20261030000000_trash_and_news.sql` once in the Supabase SQL Editor, then reload. Until then, deleting removes a carousel for good. |
| Pasting from Figma does nothing | Use **Copy as PNG** (Ctrl+Shift+C) in Figma, then Ctrl+V. |
| "Couldn't paste that image" | The website blocked the download, or the link isn't a JPG/PNG/WebP. Save the image and drop it on the canvas instead. |
| Floating window doesn't appear | Turn on **Float** in the editor (desktop app only), then switch to another app. It stays hidden while Daily Carousel Maker is in front. |
| Restore says "isn't a carousel backup" | Choose the .zip made by **Back up**. Slide exports (ZIP of PNGs) aren't backups. |
| "This carousel was changed in another window" | It was edited in two places at once. Choose *Keep my version* or *Load the other version*. |

## Posting website

A light website for whoever posts the carousels. It has no editor: just the carousels, their captions and the downloads.

- **Ready to post** (the default): every scheduled carousel, grouped by day, with anything whose date has passed at the top. **Posted** lists what's live, newest first. **All** shows everything. Search filters instantly.
- **A carousel page**: swipe through the slides (or use the arrows / ← →), then:
  1. **Download all slides (ZIP)**: 1254 × 1254 PNGs named `1.png` (cover), `2.png`, `3.png`… plus a summary. Or download only the slide you're looking at.
  2. **Copy caption** in one click.
  3. **Mark as posted**: pick the date and time it went live (now by default; future times are refused). The Carousel Maker shows it as Published with that time. **Change time** and **Not posted** undo it.
- News articles and deleted carousels never appear here.
- **Fast and light on Supabase and Cloudinary:** the list, the slide previews and the photos are cached in the browser (IndexedDB). A carousel you've opened before shows instantly; only a small "anything new?" check goes to Supabase, and slides are drawn again only after they change.

It's the same project, deployed with one extra setting. Locally you can open it at `http://localhost:3000/site` (or `http://127.0.0.1:3939/site` while the desktop app runs).

### Deploy it (Vercel)

1. Put this project in a **private** GitHub repository (`.env.local` is ignored, so no keys go up).
2. On [vercel.com](https://vercel.com): **Add New → Project**, import the repository (framework: Next.js, nothing else to change).
3. **Environment Variables** (only these three; the website needs no Cloudinary or Groq keys):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | your Supabase publishable key |
   | `SITE_MODE` | `website` |

4. **Deploy.** `SITE_MODE=website` makes every page other than the website lead to `/site`, so the editor isn't reachable on that address.
5. Supabase → Authentication → URL Configuration: add `https://<your-site>.vercel.app/auth/callback` to the redirect URLs (only needed for email links).
6. Sign in with the **same account** you use in the desktop app (each account only sees its own carousels).

Any Next.js host works the same way (`npm run build` then `npm start`, with the three variables set).

## Android app

**Homes.ph Carousels** is the posting side of the Carousel Maker on a phone or tablet (Android 10 or newer). Creating and editing carousels stays in the desktop app; the phone app shows the same data, live.

- **Carousels** (bottom tab): *To post* / *Posted* / *All*, grouped by day, with search. Tap one to open it over the list: swipe the slides, then
  1. **Save all slides to Photos**: 1254 × 1254 PNGs in *Pictures/Homes.ph/<date-title>/*, named 1 (cover), 2, 3… — in Facebook pick them from the gallery in that order. **Share…** copies the caption and opens the share sheet with every slide (Facebook, Messenger, Drive…). **Only slide N** saves the one you're looking at.
  2. **Copy caption** in one tap (Facebook doesn't accept captions from other apps, so paste it into the post).
  3. **Post on the Facebook pages**: the same 17-page checklist; your ticks carry your name and the time, and the desktop app updates.
- **News**: the day's PicklePlay PH and FHI Global Property posts (9 AM, 11 AM, 3 PM, 7 PM, 10 PM) and Homes.ph CARAGA posts (11 AM, 1:30 PM, 6 PM, 8 PM, 10 PM) — **Save** to Photos or **Share** each (named like `2026-11-01 3PM FHI Global Property.png`).
- **Report**: the Daily Tasks image for any day — **Save to Photos** (5082 px wide) or **Share…**.
- **Settings**: dark/light mode, your name and team, sign out, and *Clear data saved on this phone*.
- Smooth on any screen: phones, small phones and tablets, portrait or landscape. Lists and slides open instantly from the phone's cache and refresh in the background (and when you come back to the app); it still shows the saved carousels when offline. Android's **Back** closes the open carousel or dialog first.

**Install:** copy `dist\Homes.ph-Carousels-<version>.apk` to the phone (USB, Google Drive, Messenger…), open it and allow *Install unknown apps* for the app you opened it from. Sign in with your Carousel Maker email and password. A newer APK installs over the old one and keeps you signed in.

### Building the APK

Needs JDK 21 and the Android SDK (platform 36, build-tools 36): set `JAVA_HOME` and `ANDROID_HOME`, or put them in `E:\AndroidBuild\jdk` and `E:\AndroidBuild\sdk`.

```bash
npm run mobile:apk     # static export → secret check → Capacitor sync → signed release APK in dist\
npm run mobile:build   # only update the Android project (android/), e.g. to open it in Android Studio
```

- The app is a static export of one page (`src/app/page.mobile.tsx`, built with `MOBILE_BUILD=1`, see `next.config.ts`) packed by Capacitor; it contains only `NEXT_PUBLIC_SUPABASE_URL` and the publishable key from `.env.local`. The build stops if any other `.env` value appears in it.
- **Signing key:** `android/release-key/` (`homesph-release.jks` and `keystore.properties` with its password) is created once and is **never committed**. Keep a backup of that folder somewhere safe: Android only installs updates signed with the same key. If it's lost, uninstall the app and install the new one.
- Icons and launch screens: `python scripts/android-assets.py` (from `public/brand/app-icon-512.png`).

## Security notes

- Only the Supabase **publishable** key is in the browser bundle. The Cloudinary key and secret stay on the server: in the desktop app they live in your local settings file, and the Settings page only reports whether they are set.
- All database access is protected by Row Level Security. API routes re-check the signed-in user.
- Image links are downloaded by the server only for signed-in users, with a rate limit, http/https only, standard ports, at most 3 redirects, a 15-second timeout and the 25 MB limit. The bytes must really be a JPG, PNG or WebP. Addresses on your computer or private network (localhost, 10.x, 192.168.x, 169.254.x, …) are refused, also after DNS lookups and redirects.
- The device cache only holds your own rows, scoped by user id, and is wiped on sign-out.
- Teams are enforced in the database: a carousel, its slides and its checklist are visible only to its owner and the owner's teammates. Teammates are added only through *Add teammate* (by the email of an existing account), a tick always records the person signed in and the current time, and nobody can change a carousel's owner or maker.
- The Android app holds only the Supabase URL and publishable key (checked at build time); everything else is Row Level Security, exactly like the website. It saves images only into its own *Pictures/Homes.ph* album and needs no storage permission. Its signing key stays on the build computer (gitignored).
- The posting website uses only the Supabase publishable key and Row Level Security: it reads your own carousels and changes only the posted status and time. It needs no server secrets.
- The Groq API key is server-only (no `NEXT_PUBLIC_`). The AI route accepts only the three writing tasks (no free-form prompts), for signed-in users, with size limits and a per-user rate limit.
- The desktop window is sandboxed, with no Node.js access for the page. It never navigates away from the app, and external links open in your browser.
- If a credential was ever committed or shared, **rotate it**: generate a new Cloudinary API secret, and new Supabase API keys.

## Project structure

```
src/app/(app)/…          Calendar, Day Board, All Content, Drafts/Scheduled/Published, Image Library, Templates, Settings
src/app/editor/[id]      Carousel editor (?slide=<id> opens a slide, ?add=card adds a card)
src/app/site             Posting website: carousels ready to post, /site/[id] one carousel (no editor)
src/app/*.mobile.tsx     The Android app's single page (MOBILE_BUILD=1 static export)
src/components/mobile/   Android app: tabs, sign-in, news, settings, Back button / status bar
src/lib/native.ts        Android: save to the gallery, share sheet, clipboard (browser fallbacks)
android/                 Capacitor Android project (GalleryPlugin.java saves into Pictures/Homes.ph)
src/app/api/assets       Server-side Cloudinary upload (POST) and deliberate delete (DELETE /[id])
src/app/api/fetch-image  Guarded download of an image copied as a link (signed-in users only)
src/app/api/cloudinary/usage  Real Cloudinary check + storage/credit usage (signed-in users only)
src/app/api/ai           AI writing suggestions via Groq (description, subtitle, caption)
src/app/float            The desktop app's floating quick-edit window
src/components/board/    Day Board (Figma-style workspace)
src/components/site/     Posting website (list, carousel page)
src/components/posting/  17-page posting checklist, floating checklist window, Made by / Made early
src/app/checklist        The floating posting checklist (its own always-on-top window in the desktop app)
src/components/editor/   Editor store, canvas, panels, autosave, auto logo, image import, shortcuts
src/lib/design/          Design model, Figma templates, Title Auto-Fit, layout, glows, logo color, captions, rendering/export
src/lib/data/            Supabase data access (RLS-protected)
src/lib/cache.ts         Device cache (memory + IndexedDB, stale-while-revalidate)
src/lib/local-images.ts  Images saved on this computer (local first, then Cloudinary)
src/lib/image-sync.ts    Retries waiting uploads and re-links saved carousels
src/lib/backup.ts        Backup ZIP format, backup and restore
src/lib/float.ts         Floating editor messages and fields
electron/                Desktop app (main process, preload bridge, splash screen)
scripts/                 Desktop build helpers
supabase/migrations/     Database schema, RLS policies and RPC functions
public/brand/            Official logos, footer icons and the Top Right Swoosh
tests/                   Unit tests
```

Footer icons: *streamline-plump:web* (Streamline, CC BY 4.0) and *la:facebook* (Line Awesome), as supplied in your Figma file.
