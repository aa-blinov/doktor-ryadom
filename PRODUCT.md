# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

The application is a progressive web app: React 19 with Mantine 8 on the front, a Hono API, and one SQLite file. It ships as a Docker container on Node 22, and it also builds as a Cloudflare Worker with D1. The interface is Russian. The product is called Рядом, and the domain in use is `doktor-ryadom.duckdns.org`.

## Users

Russian-speaking psychologists, psychotherapists and psychiatrists, and their patients, in Kazakhstan and the wider CIS. Two interfaces, one for the patient and one for the doctor.

The patient's situation: the session ends, and until the next one the doctor knows almost nothing about how the week went. The patient is left alone with a thread of therapy to hold, forgets what they wanted to say, and drops their goals. The doctor has the same gap from the other side, together with the ten minutes before the appointment.

The third audience is the administrator, who checks a specialist's qualification before that specialist appears in the catalogue, moderates the reviews, and reads the action log.

Nobody is counted yet. The pilot in `docs/PILOT.md` is a plan for 2 to 3 specialists and 10 to 15 adult patients over four weeks, and the dates and the participants are not settled.

## Product Purpose

Keep the thread between the sessions. The patient marks the day, does the practices the doctor prescribed, and sends a summary before the appointment. The doctor opens the summary, sees what changed, and changes the plan while the therapy is running rather than once a month.

Success for the patient: the doctor knows what the weeks were like without the patient having to retell it, and the patient can say what they want to discuss. Success for the doctor: the minutes spent reading before the session are worth what they take. Success for the product: the doctor opens the summary before the meeting, and the patient keeps the diary going.

The app does not diagnose, does not replace the appointment or the emergency services, and does not claim to make the therapy more effective. There is no data behind that last claim, and `demo/README.md` states as much.

## Positioning

The neighbours are the symptom trackers, the therapist chat apps and the booking forms. `docs/COMPETITOR-REVIEW.md` checked six of them in October 2026 and found that the diary with doctor access is already covered, Russian interface included. What this product builds its difference on is the summary that the two sides exchange, and the access rules around it.

Three things a neighbour cannot take without becoming a different product:

- **Consent is the way in.** The doctor sees nothing until the patient accepts an invitation that works once. A patient has one doctor at a time, can revoke the access, and the revocation takes effect at once.
- **The clinician's notes stay on the clinician's side.** The complaints, the objective account, the dynamics note, the diagnosis and the visit time are stripped from everything the patient reads.
- **There is no composite score.** The summary is a set of records with a period on it. A PHQ-9 total, a WHO-5 total and a diary are never added together into one number, and the app never states a level of risk.

## Operating Context

The patient's week: one check-in a day, in the evening or whenever suits, with a reminder at the hour the patient chose, in the time zone the patient chose. The extra questions can be left out. A questionnaire arrives on the day the doctor set and takes a minute or two. A practice takes one to three minutes and can be stopped halfway.

The doctor's week: a list of patients ordered by what needs attention, the summary before the session, the follow-up notes after it, and the plan that the patient then sees.

The infrastructure: one container on a server, SQLite on a volume, a Caddyfile shared with other projects. Two backup paths, a copy inside the data volume that keeps seven days and a service that keeps the last fourteen copies in a separate volume, plus an hourly off-site copy encrypted with AES-256-GCM into an S3 bucket.

The interface is Russian only, and the app is used at home, on a phone, often in the evening.

## Capabilities and Constraints

Confirmed by the code:

- Three roles: patient, doctor, administrator. Each one loads its own workspace.
- Registration by email and a password of at least 12 characters, hashed with scrypt (N=16384, r=8, p=5) and a per-user salt. The session is a random token in an HttpOnly, SameSite=Lax cookie that lives seven days, and the database holds only its SHA-256 digest.
- A TOTP second factor, which a doctor or an administrator has to turn on before anything else works, five recovery codes for a lost phone, and a password reset by email.
- One check-in a day, and only for a day within two of today. A saved check-in can be edited later, and every revision is kept.
- Four questionnaires in the public-domain Russian wording: PHQ-2, PHQ-9, GAD-7 and WHO-5, each with a method note and a source. A doctor can write their own with up to 12 questions, and a custom questionnaire has no score.
- Twelve stock practices of one to three minutes, adapted from WHO and NHS material, plus the practices a doctor writes, each with its own steps, photo and video.
- A plan of up to 40 practices, a frequency of every day, three times a week or once a week, and a habit line.
- Up to three goals at a time, with a mark for a step taken, a difficulty, or a goal reached.
- A summary for a chosen period, sent to the doctor and marked as read by the doctor, with the patient seeing that it was read.
- The distress signal, delivered to every doctor the patient is connected to, by push and email, whatever the patient's own reminder settings are.
- A patient card that the doctor appends to, with visit summary, diagnosis, treatment and referral entries that are withdrawn with a reason and never erased.
- A catalogue of verified specialists, with one review per patient and the next free slot on each card. Slots run from 15 to 120 minutes and are generated 62 days at a time, booking opens 14 days ahead, a patient may have five requests without an answer, and a request expires after 24 hours.
- Notifications by web push and email, in the user's own time zone, with at most ten push endpoints per account and an allowlist of the FCM, Mozilla and Apple push hosts.
- Export of the account as JSON or as a zip with the photos, the video and the documents, and deletion of the account.

Deliberately not true, and worth knowing before a change:

- No diagnosis, no composite wellbeing score, and no risk level worked out from an answer. An answer above zero on item 9 of PHQ-9 puts that questionnaire in the doctor's queue for a separate look, and the app says nothing about what it means.
- No automatic crisis detection and no round-the-clock reading of the records.
- The wording of the questions, the scales and the practices has not been checked by a psychiatrist (`docs/review/clinical-wording.md`), and the thresholds behind the attention flags are working values.
- The user agreement is a draft (`docs/review/legal-agreement.md`).
- The place where the data and the copies are kept has not been confirmed for Kazakhstan, and the off-site bucket sits outside it (`docs/KAZAKHSTAN.md`).
- Mail and push have not been verified on real devices.
- The reminder is a schedule inside the app, and a reminder email only goes out to a verified address.

## Brand Commitments

**Name:** Рядом, set in lowercase as "рядом." with the dot in the accent colour `#86a17c`. **Mark:** two leaves, `#326950` and `#a9c3a0`, the same shape in the app favicon and in the demo videos. **Palette:** background `#f5f6f2`, text `#23382f`, secondary text `#5a6860`, accent `#326950`, signal `#a85424`. **Typeface:** Golos Text, under the SIL Open Font License.

**Voice:** plain Russian, second person, no reassurance the app cannot back up. The interface states what it does not do: it does not diagnose, it does not replace an appointment, and in an emergency you call 112. A failure is named rather than swallowed. A blocked account says so on the next open, a refused upload says so, and a mail server that cannot be reached says so instead of letting the button do nothing.

## Evidence on Hand

- `demo/doctor/video.mp4` and `demo/patient/video.mp4`: two finished videos, 77 and 76 seconds, with the scene list in `demo/*/transcript.md` and the poster in `demo/*/poster.jpg`.
- `docs/screens/`: screenshots of the patient and doctor workspaces, taken by the browser test with synthetic accounts.
- `app/src/practices.ts`: the twelve practices, each with its WHO or NHS source and its method note.
- `app/src/assessments.ts`: the four questionnaires, their sources, their method notes, and the rule that an answer above zero on item 9 of PHQ-9 goes to the doctor for a separate look.
- `app/tests/`: 39 test files, covering the API, the role and access checks, the security cases and the browser scenarios.
- `docs/methodology/`: the description of every screen, with its questions, its answers and the limits of the first version.
- `docs/PILOT.md`: the pilot plan, with what is measured and what is not.
- `docs/review/clinical-wording.md` and `docs/review/legal-agreement.md`: the two reviews that are still open.
- `docs/qa/`: the QA passes over the doctor, the patient and the administrator roles.

Absent, and not to be invented: no download counts, no usage numbers, no testimonials, no clinical outcomes, and no measured comparison with another product. The pilot has not run, so there is no retention figure, and the repository has no release history to count.

## Product Principles

1. **The summary is what the two sides exchange.** Not a score, and not a trend line the patient reads alone. The thing being built is the doctor's ten minutes before the session.
2. **Nothing is shared without the patient.** The doctor sees nothing until the invitation is accepted, the patient's own notes never travel to the doctor, and the clinician's notes never travel to the patient.
3. **The app does not judge.** Every threshold it shows is a working value that a psychiatrist has not checked, and where the interface puts one on screen, the interface says what it means and what it does not mean.
4. **The daily check-in stays short and optional.** The extra questions can be skipped, the schedule can be paused, and the frequency is the doctor's choice rather than the product's.
5. **A failure is visible.** No silent fallback, no default that hides a broken configuration, and every refusal reaches the screen as a sentence.

## Accessibility & Inclusion

Known needs, from the code and from the texts:

- The distress screen says to call 112 and not to wait for an answer in the app. The settings carry 103 for the ambulance and 112 for the single emergency number in Kazakhstan.
- Every practice can be stopped at any step, and the 5-4-3-2-1 practice gives an alternative for each sense and says that a step can be skipped.
- The walking practice can be done sitting, and the breathing practice asks the patient to stop if there is dizziness.
- The interface is Russian only. There is no second language, and no screen reader testing is recorded.
- A contrast standard has not been set. The colours come from the tokens in `DESIGN.md`, and the dot after the name had to be darkened to `#7c9573` in the videos, because `#86a17c` does not pass 3:1 against the background.
