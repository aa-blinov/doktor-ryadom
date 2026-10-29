# Documentation

The documents of Рядом, a web app that keeps a patient and their doctor in
touch between appointments.

The documents in this folder are in Russian, and they stay in Russian: they
are written for the clinicians who use the application and for the people
who check it. The house documents at the root of the repository, the
README, AGENTS.md and PRODUCT.md, are in English.

| Document | What it covers |
| --- | --- |
| [architecture.md](architecture.md) | The client, the API, the database and the boundaries between them. |
| [screenshots/README.md](screenshots/README.md) | The interface captures, which live in [screens/](screens/README.md). |
| [../README.md](../README.md) | The front door: what the app does and how to run it. |
| [../AGENTS.md](../AGENTS.md) | The commands, the traps and the rules of the project. |
| [../PRODUCT.md](../PRODUCT.md) | The product truth: the users, the purpose, the constraints. |
| [../DESIGN.md](../DESIGN.md) | The palette, the type, the spacing and the components of the interface. |

## The product documents

| Document | What it covers |
| --- | --- |
| [PILOT.md](PILOT.md) | The pilot with patients and specialists: the composition, the script, the feedback and the criteria of use. |
| [methodology/goals.md](methodology/goals.md) | What the marks mean and how the goals are calculated. |
| [BACKUPS.md](BACKUPS.md) | The backups and the check of the restore. |

## How the application works

| Document | What it covers |
| --- | --- |
| [METHODOLOGY.md](METHODOLOGY.md) | The separate documents for the patient's and the doctor's screens, the questions and the answer options, the basis of the practices, the doctor's access and the limits of the first version. |
| [USER-FLOWS.md](USER-FLOWS.md) | The user transitions: the daily mark, the sending of the summary, the doctor's reading of it and the errors. |
| [ROLE-FLOWS.md](ROLE-FLOWS.md) | The routes by role and by state: what each side sees in every state, where the state takes them and what the application promises. |
| [CLINICIAN-AUDIT.md](CLINICIAN-AUDIT.md) | An independent review of the doctor's cabinet down to the mobile menu, with the open remarks. |
| [UX-AUDIT.md](UX-AUDIT.md) | The review of the convenience: the changes to the scripts and the number of actions. |
| [SCREENS.md](SCREENS.md) | The map of the transitions and the rules of the interface. |
| [VALIDATION.md](VALIDATION.md) | The technical checks that were carried out and the limits of the environment. |
| [screens/README.md](screens/README.md) | The captures of the patient's and the doctor's cabinets. |

## The market and the reach

| Document | What it covers |
| --- | --- |
| [COMPETITOR-REVIEW.md](COMPETITOR-REVIEW.md) | A comparison of six products, the gaps for the patient and for the doctor separately, and the priorities. |
| [GAP-CLOSURE.md](GAP-CLOSURE.md) | The new scenarios and the conditions of the launch that are still open. |
| [KAZAKHSTAN.md](KAZAKHSTAN.md) | The time, the emergency help and the placement of the data. |
| [PWA-NOTIFICATIONS.md](PWA-NOTIFICATIONS.md) | The installation, the check of the push, the schedule and the work without a network. |
| [methodology/profiles.md](methodology/profiles.md) | What the patient and the doctor fill in, and who can see it. |
| [methodology/practice-design.md](methodology/practice-design.md) | The description and the design of every practice. |

## The folders

| Folder | What it holds |
| --- | --- |
| [methodology/](methodology/) | The methodology per screen: the patient's screens, the doctor's screens, the goals, the profiles, the surveys and the standard assessments. |
| [qa/](qa/) | The QA passes: the patient's flow, the doctor's flow, the administration, the verification of each role and the final pass of 14 October 2026. |
| [review/](review/) | The reviews: the clinical wording, the legal agreement and the review of the agents. |
| [ui/](ui/) | The catalogue of the screens, the transitions between them and the number of clicks to each target action. |
| [screens/](screens/) | The captures of the interface. |
| [screenshots/](screenshots/) | The index of the captures. |

## Reading order

New here: [../README.md](../README.md), then [METHODOLOGY.md](METHODOLOGY.md)
for the rules and [architecture.md](architecture.md) for the code.

Checking the interface: [SCREENS.md](SCREENS.md) for the map of the
transitions, then [ui/](ui/) for the screen by screen catalogue, and
[UX-AUDIT.md](UX-AUDIT.md) for what was changed and why.

Working on the clinical wording: [review/clinical-wording.md](review/clinical-wording.md)
lists what is waiting for a psychiatrist. The code does not confirm the
clinical correctness of those texts.

## A note on the language

Everything in this folder is in Russian, apart from the three documents
written for the house standard: this index, [architecture.md](architecture.md)
and [screenshots/README.md](screenshots/README.md).
