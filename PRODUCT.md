# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
TypeScript and a component library requested by the user. Proposed implementation: React, Vite, Mantine, vite-plugin-pwa. Deploy through Sites with a Worker API and D1 storage.

## Users
Russian-speaking psychologists, psychotherapists and psychiatrists and their patients in the CIS. Patients can choose a specialist in an in-app catalogue (name, profile, reviews) in the manner of doq.kz, or connect by invitation or code. The current user is preparing a proposal for a psychiatrist.

## Product Purpose
Track patient-reported wellbeing between visits through brief proactive surveys and clinician-selected mindfulness practices. Give the psychiatrist a concise history for the next appointment.

## Capabilities and Constraints
Two role-specific interfaces, daily self-report, history, configurable follow-up questions, short voluntary practices, and reminders. Clinical wording and escalation rules require psychiatrist validation. Never infer diagnoses or suicide risk from a composite score.

## Evidence on Hand
Prior conversation includes NICE, WHO and NIH resources. No real patient data, clinician identity, clinical endorsement, or assets were supplied.

## Product Principles
- Only a verified psychiatrist may prescribe medication. The specialist type (psychologist, psychotherapist, psychiatrist) is chosen at verification and confirmed by the administrator; the server rejects prescriptions from anyone else and the interface never offers the form to them. Apply this everywhere medication is mentioned.
- The doctor catalogue is for signed-in patients only; connection always needs the doctor's acceptance and the patient's explicit consent. Reviews are one per patient per doctor, published immediately under the patient's first name, and the administrator can hide them.
- Keep a routine check-in short and optional.
- Make changes visible without judging the patient.
- Show what is shared and when a clinician reviews it.
- Keep questionnaires distinct from informal daily questions.

## Open Decisions and Session Assumptions
The user confirmed real registration and server-side storage, and code-first implementation. This first implementation stores accounts, invitations, check-ins and practice feedback in D1. Working name: «Рядом». Practices and rules are examples for clinician review. The user confirmed code-first building.
