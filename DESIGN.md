---
name: Рядом
description: A quiet care journal between appointments, with a plain Russian voice and a fixed place for urgent help.
colors:
  primary: "#326950"
  primary-hover: "#28583f"
  surface: "#ffffff"
  canvas-tint: "#f5f6f2"
  ink: "#23382f"
  muted: "#647168"
  soft: "#e8efe7"
  line: "#dce3db"
  selected: "#edf3e9"
  schedule: "#eaf0e7"
  focus: "#72947a"
  dark-canvas: "#141e19"
  dark-surface: "#1b2921"
  dark-ink: "#e1eae4"
  dark-muted: "#adc0b2"
  dark-primary: "#98caa6"
  dark-soft: "#293e30"
  dark-line: "#405248"
  dark-selected: "#25382d"
  dark-focus: "#a8c0af"
  on-accent: "#ffffff"
  danger: "#b42323"
  dark-danger: "#ff9a9a"
  chart-sleep: "#817054"
  dark-chart-sleep: "#d4b58d"
  sos: "#a85424"
  sos-soft: "#fbf3ee"
  sos-hover: "#954a1f"
  dark-on-accent: "#142017"
typography:
  headline:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "32px"
    fontWeight: 750
    lineHeight: 1.3
    letterSpacing: "-1px"
  title:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "-0.5px"
  body:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "13px"
    fontWeight: 600
rounded:
  control: "8px"
  answer: "12px"
  row: "15px"
  panel: "20px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    height: "42px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    rounded: "{rounded.control}"
    height: "42px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "42px"
  task-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "30px 32px"
  mood-answer:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "13px"
  chip:
    backgroundColor: "{colors.soft}"
    textColor: "#3c614a"
    rounded: "{rounded.control}"
    padding: "7px 12px"
  theme-toggle:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "12px"
  navigation-active:
    backgroundColor: "{colors.soft}"
    textColor: "{colors.primary}"
    rounded: "11px"
---

# Design System: Рядом

## Overview

**Creative North Star: "Quiet care journal"**

A calm working notebook for a brief patient conversation and a readable clinician record. Humanist Cyrillic type, restrained green controls and generous task spacing support everyday use. The interface uses plain Russian labels and makes progress, selected answers and shared access explicit.

**Key Characteristics:**
- Flat work surfaces with fine borders in both themes.
- One subdued green accent for actions and selected states.
- Sequential questions and compact ruled history.
- Labelled choices with accompanying line icons.

## Colors

### Primary
The forest green accent identifies primary actions, links, progress and selection. Its deeper variant is the Mantine filled-button hover state. Pale green supports selected navigation and answers without replacing labels.

### Neutral
In the light theme, the rendered desktop body and panels are white: Mantine's body background overrides the root canvas tint. The pale canvas tint remains on the mobile header and root background. Dark green ink carries content; muted grey-green carries supporting text. Fine grey-green borders separate surfaces. The schedule panel uses its own pale green fill. Warm chips and practice icons provide local context rather than a second global accent.


### Dark variant

The persisted Mantine color scheme keeps the same quiet journal hierarchy with a dark green canvas/surface, pale ink, muted supporting text and a lighter green action accent. Dark tokens above record the exact semantic CSS values; layout, type sizes and spacing remain unchanged. Existing light values are preserved. CSS aliases named `--tone-<light-hex>` retain their original light value and map to dark text, border and fill roles beneath the Mantine dark-scheme attribute. Focus and selected-state aliases change with the scheme as well. Mantine's custom dark ramp aligns native controls with the green surface family. Practice illustrations retain subdued local hue families in dark mode. The dedicated on-accent foreground has a white light value and a dark green dark value, separating text on accent fills from ordinary surface text. Printed reports reset semantic colors and tone aliases to the light palette regardless of the on-screen theme.

**The Labelled State Rule.** Color accompanies a readable label, icon or explicit selected state; it never carries mood meaning alone.

## Typography

Golos Text is self-hosted through bundled Fontsource files: Cyrillic and Latin weights 400, 500, 600 and 700. The fallback is sans-serif. The CSS headline weight of 750 resolves to the nearest static face (700). Text sizes were raised across the app: supporting copy is 14–15px, nothing meaningful is set below 13px, and phone scale labels are the one exception (hidden in favor of a chosen-value hint).

Every font size in the stylesheet comes from one scale: 13, 14, 15, 16, 18, 22, 26 and 32px. Labels, meta and pills are 13px; field and button labels are 14px; supporting copy is 15px; body is 16px; row titles and sub-headings are 18px; section and panel headings are 22px; page and question headings are 26px on mobile and 32px on desktop. A new size snaps to this list. Paragraphs use a relaxed line-height of 1.75. Mobile mood labels remain 14px. Registration uses a 42px introduction heading, reduced to 26px on mobile.

## Layout

Desktop uses a fixed sidebar (240px), a top bar (76px) and a workspace with maximum width 1200px and horizontal padding 46px. Patient check-ins use a flexible main column and a narrower context column. The questionnaire column is capped at 720px. History and settings can use two columns.

At 1150px the sidebar narrows to 210px and workspace padding to 28px; at 900px it narrows to 190px and primary task layouts become one column. At 700px the sidebar gives way to a compact header (68px) and fixed bottom navigation with safe-area padding. The patient bottom bar has five items: Сегодня, Практики, История, Врач, Настройки. History is its own destination, with an inner switch between check-ins and practice notes. The header carries a persistent «Мне плохо» pill that opens the distress dialog. Workspace padding becomes 20px horizontally. Every interactive control on a phone is at least 44px high (answer steps, buttons, inputs, password toggles, text links to 112). Charts, settings and plans become one column; patient rows expose their field labels.

Mobile mood answers are full-width rows with a 54px minimum height. Mobile practice rows use an icon/content/chevron grid with duration below the description. The narrow dashboard and mood-preview grid use zero-minimum flexible columns so content fits at 320px. Registration's two-column story/form layout becomes a concise introduction followed by the form; the notebook illustration is hidden.

## Spacing

One 4 px grid, exposed as custom properties on `:root`. Every vertical and horizontal gap, padding and margin in `styles.css` is one of these steps; there are no literal pixel values left in spacing declarations.

| Token | Value | Used for |
|---|---|---|
| `--sp-1` | 4px | hairlines, icon-to-label gaps |
| `--sp-2` | 8px | inside a control, between a label and its value |
| `--sp-3` | 12px | between closely related blocks |
| `--sp-4` | 16px | the base step: card gutters, list gaps |
| `--sp-5` | 24px | between blocks, card padding |
| `--sp-6` | 32px | between sections, generous card padding |
| `--sp-7` | 48px | page rhythm, empty-state padding |
| `--sp-8` | 64px | rare, large breathing room |

Negative spacing uses `calc(var(--sp-N) * -1)`. Layout maths stays literal: `calc()`, `max()`, `min()` and `clamp()` carry sidebar offsets, viewport widths and safe-area insets, so they are deliberately not tokenised.

Nine literal pixel values remain in spacing declarations, none of them spacing decisions: three `margin-left` values on `.main-shell` mirror the sidebar width at each breakpoint, two `padding-top` values on `body:has(.pwa-notice) #root` offset the install banner (both multiples of 4), three `margin-top:1px` are optical nudges under small labels, and `.sr-only` keeps the standard `margin:-1px` clip.

Mantine style props (`mt`, `mb`, `gap`, `py`) take the same tokens — `mt="var(--sp-4)"`, not `mt="md"` — so the library's own 10/20 px steps cannot reintroduce a second rhythm.

## Elevation & Depth

Workspace panels are flat. Borders, spacing and tonal fills establish separation within the current theme. Decorative notebook illustrations use a restrained shadow: registration uses `0 12px 30px rgba(53,74,42,.07)` and onboarding uses `0 16px 32px #23382f12`. Mantine overlays retain library behavior.

**The Flat Workspace Rule.** Keep task panels flat; use borders and tonal context instead of adding card shadows.

## Shapes

Radii come from four steps: 8px for controls, chips and small tiles; 12px for answer rows, schedule and practice rows, and the overview panel; 16px for lists, containers and modals; 20px for dominant task panels. Circular icons and small rounded chips soften the otherwise ruled journal structure. Borders are one pixel and always use the line token (`--line`), never a separate grey. Transitions share one duration (0.16s for hover and focus, 0.22s for entering content) and one ease-out curve.

## Components

### Buttons and fields
Filled buttons use forest green and white labels; outline and subtle variants retain the same accent. Mantine medium controls are 42px high by default; some primary task actions explicitly use larger sizes. Icon actions are generally 44px square. Inputs keep persistent labels above fields in the current theme. Errors remain visible beside the current task. The shared keyboard focus treatment is a three-pixel muted green outline with four-pixel offset; Mantine fields also use their accent focus border.

### Cards and chips
Task panels use the selected theme surface, fine borders and generous padding. Context uses pale green fills. Small chips label dates and contextual states with compact padding; they are not scores or rewards.

### Navigation
Desktop navigation uses labelled line icons, a tonal selected background and green active text. Hover adds a faint fill. Mobile navigation keeps the icon and readable label together in a fixed bottom bar. The sidebar bottom holds the account (avatar, full name, role) at the left, with theme and logout icon buttons pinned to its right, for every role. Patient settings repeat these two actions as buttons on phones only. Account names wrap at their full length, with long words allowed to break, rather than truncating. The footer shows plain «Рядом, 2026» with no link and a comma rather than a dot. Use Tabler-style line icons consistently.

### Check-in form
The daily entry is a single flat panel. Mood comes first as five labelled face choices. Anxiety, energy and daily functioning follow immediately as visible rows of labelled radio steps, never behind a disclosure. A native «Подробности, по желанию» disclosure holds only sleep and the doctor note, with a «n из 2» counter. Sleep is chosen with hour chips 4–9 plus «Другое»; the 8-hour chip is preselected by default, and a tap on it clears it. Short sleep (under 6 h) reveals a one-line follow-up.

**The Higher-Is-Better Rule.** Every scale reads from worse on the left or bottom to better on the right or top, with the end labels «хуже» and «лучше». Anxiety is 0–4 (4 means not noticed), daily functioning 1–3 (3 means no difficulty), energy and mood 1–5. Stored values follow the same direction, so charts, reports and exports never invert a scale.

### Charts
History and overview charts show every point with a thin grey connecting line and a dashed 4px accent trend line for every metric and role. Points have a 16px invisible hit area and show a dark tooltip («26 сент.: Хорошо») on hover, keyboard focus or tap. The chart text alternative restates the trend and points to the list below for exact values. Chart captions state the direction of the axis in words.

### SOS
«Мне плохо» is a terracotta (`sos`) outline pill in the top bar at every screen size, using the theme radius. It opens a centred dialog straight on the confirm step — a separate screen made the patient press the same action twice before anything happened. The dialog keeps a sent state with the time and a 112 call link, and a retry on error; reopens inside 30 minutes land on the sent state rather than offering a duplicate send. Repeat sends within 60 seconds are de-duplicated on the server. Walking to another screen closes the dialog, and the old `#/sos` link still opens it. Without a connected doctor the dialog says so and offers the 112 call and doctor connection instead of a dead button.

### Clinician overview
The overview reads top to bottom: a period switch (since recommendation, 14, 30 days) with the explicit date range, a three-line status list (last check-in, count, signals), the attention list with a named action per row, the period charts, then Состояние and Динамика as two columns, patient discussion notes, the agreed goal, and the explanation of how figures are counted. Missing data reads «нет данных», never a dash.

### Answers and practice rows
Mood choices pair distinct face icons with text. Hover shifts the fill and border; selection adds the green border and pale selected fill. Desktop mood choices form five columns; mobile choices form full-width rows. Practices expose their description and duration with a small circular illustration and trailing chevron.

Question changes use a short horizontal reveal (220ms, seven pixels). Practice hover transitions last 160ms. Reduced-motion preference disables animations and transitions.

### Practice library

The patient library shows only physician-selected practices; the full twelve-practice catalogue remains in the clinician plan. It uses a two-column list on desktop and one column on mobile, with divider lines rather than boxed cards. Each item includes duration, direction, source disclosure, and either a start link or an explanation of plan availability. Search and labeled direction/time filters precede the list. Existing green colors, Golos Text typography, navigation, and feedback flow are retained.

### Practice flow

A practice opens on an introduction screen: a large scene, duration and step count, the title and subtitle, a plain description, a calm safety line («Можно остановиться на любом шаге»), a «Методика и источник» disclosure and one primary «Начать» button, sticky above the bottom bar on phones. The introduction carries all explanation so the steps can stay bare.

Each step is its own full-screen view on the canvas colour, hiding the shell: a segmented progress bar and «Остановить практику» on top; a single centred column holding that step's scene, «Шаг n из N», a headline and one instruction (22px on large screens, 18px on phones, 34ch measure); «Назад» (or «К описанию» on the first step) and «Дальше» («Завершить» on the last) at the bottom, both 44px or taller. Steps enter with a 280ms fade and 8px rise, removed under reduced motion. After the last step, or after stopping, a flat feedback screen asks «Как вам было?» with three labelled answers and an optional note.

**The One Action Rule.** A practice step shows one picture, one instruction and one forward control. Explanation, methodology and sources live on the introduction, never on the steps.

### Practice scenes

Every step of the twelve practices has its own native SVG scene tied to the instruction (37 in all: a person seated with feet on the floor, an eye over three objects, a doorway, a hand with four contact ripples, an ear with three sound arcs, a flower and a lemon slice, a path with a flag, a staircase of small steps, a circle with space around a feeling, and so on). Scenes use a 260 × 175 view box, 2.5-unit round linework in the category ink on its pale wash, with an occasional 14% soft fill and dashed lines for «space» or thoughts. A fixed vocabulary repeats across practices (seated figure, bust, cup, cloud, heart, floor line) so the set reads as one hand. Each scene has a text alternative. The introduction and the library use the hero scene of the practice; the library shows it compact (12px corners, 100px high). Step scenes use 20px corners, a 520px maximum width and a clamp(190px, 34vh, 320px) height; the introduction scene is 220px high (170px on phones).

Scenes depict an action or an object, never a body in distress or a mood judgement; there is no timer, breathing pace or automatic animation. Plan availability, the stop action and the experience feedback remain part of the same flow. Library rows keep the explanation as a native disclosure capped at 60ch with 15px text.

### Doctor catalogue

Patients find a specialist at `#/doctors`, reached from the Врач tab («Найти врача»). A segmented filter (Все, Психологи, Психотерапевты, Психиатры), a search field and, when there are several, a city select sit above a single ruled list: round photo (64px) or initial, name, a kind pill (psychiatrists tinted, others outlined), the diploma specialty, city, clinic and experience on one muted line, a two-line excerpt and the rating (five warm stars, the average and a review count). A one-line note under the filters states that only psychiatrists prescribe medication. The whole row is the link; hover uses the soft fill.

The specialist page repeats that header larger (96px photo), then a soft connect panel with one action («Выбрать этого врача»). Choosing opens an inline request form with an optional message and an explicit consent checkbox naming what the doctor will see; afterwards the panel reads «Запрос отправлен» with a cancel action, and shows plain states for «Это ваш врач» and for a patient who already has another doctor. Profile sections (about, consultation areas, education, courses, work history, address) follow as ruled blocks, only the populated ones. Reviews close the page: rows of first name, stars and date, then one review form (five 44px star buttons, optional text, publish, edit or delete). Stars use the warm sleep ochre (`chart-sleep`) so they read in both themes; ratings are always shown with a number.

Doctors see incoming requests in a soft panel above their patient list (name, date, message, «Принять» and «Отклонить»). The administrator has an «Отзывы» section listing every review with a hide/restore action. Doctors who are not psychiatrists see a short explanation in place of the prescription form.

### Onboarding stories

First-use onboarding uses a pale green story frame with manual segmented progress. Desktop places the screen illustration beside the text; mobile stacks them. Patient and doctor scripts differ. Examples use existing Golos Text, forest green, and Tabler icons. Skip is always visible, replay lives in settings, and viewed state is per account in browser storage. Record-access explanations appear in patient settings rather than the app shell.

### Appointment reports

The appointment report is a read-focused surface with a definition list of descriptive facts, dated notes and disclosure for raw answers. Patient preview and immutable clinician snapshots use the same component. Send and review are explicit actions; their statuses describe server events. New reports surface in the clinician list through a count and filter, without a risk score or urgency color.

### Care records and account forms

Care, account-security and dashboard follow-up sections start with a fine top divider, 24px top padding and 32px separation. Dated care records use 24px vertical padding and bottom dividers; saved recommendations preserve line breaks. Assessment totals remain attached to their named questionnaire, with source answers available through a disclosure.

Care and correction forms stack labelled Mantine fields with an 18px gap and a maximum width of 640px. Account security and entry editing are capped at 700px. Optional security actions and source answers use native disclosures with green summaries and a 44px minimum activation area. Reminder settings use the same vertical rhythm, labelled switches and visible connection status. Success appears in a green Mantine alert; errors remain beside the current form. Destructive account deletion uses a dark red outline action (`danger`, 4.5:1 on white; a light red in the dark theme) and a centred confirmation dialog.

Task rows place text and actions side by side on desktop and stack them below 680px. At this breakpoint, care-form buttons stretch to the available width and account action groups use full-width buttons. Recovery forms use a compact standalone column capped at 520px. Print output hides navigation and interactive actions and keeps care records together across page breaks.

### UI punctuation

Short headings, labels, single-sentence hints and confirmations omit terminal periods. Preserve punctuation in multi-sentence explanations, clinical forms and patient-entered text.

### Installation, updates and connection status

Installation guidance reuses the ruled care section, muted explanatory copy and an outline action when installation is available. Device notification controls reveal their test action only after connection; green alerts distinguish connection status from a submitted delivery test. Settings keep the surrounding form rhythm and labels.

An available update appears in a sticky notice above the interface, with 12px padding, a pale canvas background and a bottom divider. Its Mantine alert is capped at 860px and presents explicit update and defer actions; preparation or update errors use warning styling. Offline access uses a plain centred explanation and retry action before sign-in, or a yellow in-workspace alert for an existing session. These service states reuse the current typography and controls rather than introducing another visual system.

### Optional profiles and shared details

Profiles reuse the flat account surface: a top divider, 28px vertical padding and a role label beside the section title. Forms are capped at 640px with 18px field gaps. Required name fields remain distinct from optional patient birth date and communication notes, or doctor specialty, workplace, experience and introduction. Doctor specialty and workplace share two columns above 680px and stack below it; the mobile save action fills the form width.

Doctor photos appear as compact rounded avatars (80px in editing, 64px in shared details) beside outline upload and subtle removal actions. Uploaded photos are centre-cropped to a 320px square JPEG; they are account imagery rather than decorative artwork. Shared doctor details pair the non-shrinking avatar with a simple text column; below 680px the avatar stacks above the details with a 16px gap. Shared patient information is a read-only ruled section with a date and labelled note; user-entered prose preserves line breaks and wraps long text. Visibility explanations precede optional profile fields.

Doctor consultation areas, education, courses and work history reuse optional multiline fields. Education and experience have a compact grouping heading; field hints explain one entry per line. Shared details show only populated sections, each with a plain heading and a native list. These sections have 24px top separation, an 8px heading-to-list gap, 20px list indentation and a 1.7 line-height; successive entries are separated by 8px and wrap long text. They extend the existing text column without additional cards or badges.


The doctor's introduction uses a six-row, vertically resizable textarea with a 170px minimum height. Education, course and work-history fields each have a separate visibility switch before the multiline editor. Saved documents follow the same ruled form rhythm: section and saved-entry selectors, an outline upload action, then rows with the entry label, underlined filename, sharing switch and removal action. PDF and supported image formats are limited to 5 MB, with up to twenty documents; new uploads start private. Shared read-only sections expose eligible document download links beneath the matching list entry. Hidden sections or changed/deleted entries also hide their documents from patients.

The clinician code uses an existing settings panel with two labelled read-only fields, wrap-capable copy actions and explicit copy/activation status. The persistent twelve-character code is emphasised at 20px, weight 700 and 0.12em letter spacing. Patient connection becomes available only after clinician verification; the text explains that state without an urgency badge.

The account screen offers sign-in with an authenticator code: password confirms setup, the key shows at 20px, weight 700 and 0.12em spacing in groups of four with an «Открыть в приложении» link, and a code confirms it. Doctors and administrators get a recommendation line, since they see patient records. With the code on, the login form adds a one-time-code field after a correct password and points a user without the phone to recovery codes.

Registration uses a short labelled storage-consent checkbox. A separate helper explains permission to the doctor only for patient registration, keeping the consent control concise.

## Do's and Don'ts

### Do:
- Do preserve fine borders, the current theme surfaces and the restrained green accent.
- Do keep mood labels readable and use full-width answer rows on mobile.
- Do keep duration beneath the practice description on mobile.
- Do preserve keyboard focus, labelled states and reduced-motion support.
- Do keep 44px minimum touch targets on phones and body-text contrast of at least 4.5:1, including field hints and nav labels.
- Do keep every scale reading worse to better, left to right and bottom to top.

### Don't:
- Don't add shadows to ordinary task panels.
- Don't represent mood or access permissions through color alone.
- Don't replace the quiet journal with streaks, risk scores or marketing blocks.
- Don't preselect answers except sleep; unanswered stays unanswered.
- Don't hide the core daily scales inside a disclosure.
- Don't put more than one instruction, or any methodology text, on a practice step.
- Don't offer a prescription form, or imply prescribing, for anyone who is not a verified psychiatrist.
- Don't show a rating without its review count, or a review author's surname.
