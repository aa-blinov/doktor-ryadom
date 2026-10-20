# Screenshots

The interface captures of the application.

The images live in [../screens/](../screens/README.md), not in this folder.
This file indexes them: what each one shows and where it came
from. The two folders are split because the repository already had
`docs/screens/` with the captures in it, and moving thirty files would
break every reference to them.

## Where the captures come from

Every image was taken by the Playwright browser scenarios in `app/tests/`,
against the built client in `dist/client` with the Hono application and a
SQLite database in the same process. The scenarios create their own
accounts and their own records, so every account and every record on these
images is made up.

The names carry the viewport. `-320` is a phone at 320 pixels wide,
`-desktop` is a full page on a wide screen, and a name with neither is a
single screen at the width the scenario used.

## The captures

| Capture | What it shows |
| --- | --- |
| `patient-desktop.png` | The patient's cabinet on a wide screen: the check-in, the practice of the day and the schedule. |
| `patient-mobile.png` | The same cabinet at the width of a phone. |
| `doctor-desktop.png` | The doctor's overview: the patient, the period and the charts. |
| `question-mobile.png` | A short questionnaire on a phone. |
| `onboarding-desktop.png` | The patient's onboarding on a wide screen. |
| `onboarding-mobile.png` | The patient's onboarding on a phone. |
| `onboarding-doctor.png` | The doctor's onboarding. |
| `report-patient-desktop.png` | The summary the patient sends before the session. |
| `report-patient-320.png` | The same summary on a phone. |
| `report-doctor-desktop.png` | The summary as the doctor reads it. |
| `report-doctor-mobile.png` | The doctor's summary on a phone. |
| `care-patient-desktop.png` | The care records of a patient. |
| `care-patient-320.png` | The same records on a phone. |
| `care-patient-observation-320.png` | The observation a patient writes for the doctor. |
| `care-doctor-desktop.png` | The care records as the doctor sees them. |
| `care-doctor-form-320.png` | The doctor's own form on a phone. |
| `account-patient-desktop.png` | The patient's account settings. |
| `account-patient-320.png` | The same settings on a phone. |
| `account-patient-save-320.png` | The account form after a save. |
| `pwa-offline-mobile.png` | The application with no network. |
| `pwa-update-desktop.png` | The notice that an update is ready. |
| `pwa-patient-settings-320.png` | The patient's notification settings on a phone. |
| `pwa-patient-settings-desktop.png` | The same settings on a wide screen. |
| `pwa-doctor-settings-320.png` | The doctor's notification settings on a phone. |
| `pwa-doctor-settings-desktop.png` | The same settings on a wide screen. |
| `pwa-patient-connected-fixture-320.png` | The patient's settings with a simulated push subscription. |
| `pwa-patient-connected-fixture-desktop.png` | The same view on a wide screen. |

The two files with `fixture` in the name show a simulated subscription, so
that the elements of the interface can be checked. They do not prove that
a push provider delivered anything.

## The demo videos

Two videos sit outside this folder, in `demo/`. They tell the same story
from both sides: three weeks between two sessions, and what each side has
to work with. The posters are `demo/doctor/poster.jpg` and
`demo/patient/poster.jpg`, and the names in the videos are invented.

## Putting a picture here

This folder is part of the standard, and the images the README shows are
referenced by a relative path, so they have to live somewhere the checker
can resolve. A new capture that the README is going to show can go into
`docs/screens/` beside the others, and this index is the place to describe
it.
