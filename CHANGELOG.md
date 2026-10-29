# Changelog

All notable changes to doktor-ryadom. Versions are ordered newest first.

<!--
  The format is Keep a Changelog. Each entry says what changed and why it
  was worth changing.

  The traps do not go here. They go in AGENTS.md, because the changelog is
  read by the people who use the software and the traps are read by whoever
  works on the code next.
-->

## [Unreleased]

### Added

- A doctor can leave a phone number or a messenger name in the qualification
  request, and the administrator sees it in the queue. Until now the only way
  to reach a doctor was the comment in the request, and there was no way to
  tell an administrator that the address on file might not reach them.
- The administrator sees whether the address of the doctor is confirmed. A
  decision on an unconfirmed address reaches the doctor only in the app, and
  the administrator had no way to know that before writing the comment.
- The routes by role and by state are described in `docs/ROLE-FLOWS.md`, with
  the diagrams of the transitions and the text of every state.

### Fixed

- An error on the invitation of a doctor is shown again. The messages were
  drawn inside the reminders tab, so a patient with an expired or used link
  saw a button that stopped spinning and nothing else.
- A patient no longer reads that the doctor has no access any more while the
  doctor is connected. The comparison had no doctor to compare with, so the
  sentence about a lost access appeared on every questionnaire.
- The distress signal is marked as delivered only after a channel carried it.
  A doctor with no confirmed address and no device on the list left the signal
  marked as sent, and it was never retried.
- The text after the sent signal tells the patient that it reaches the doctor
  if the doctor has a confirmed address or notifications on the device. It
  promised mail and notifications that the server does not guarantee.
- A change of the name or the specialty no longer leaves the doctor stuck.
  The confirmation was taken back while the old request stayed approved, so
  the screen said the profile was confirmed and hid the form.
- The hint about the type of a specialist no longer sends the administrator
  to a dead end. The type belongs to a confirmed doctor, so the only way
  forward is to ask the doctor for it.
- The newest request of a doctor is the one the administrator decides, even
  when two of them were filed in the same second.
- A notification leads to the screen where the person can act. The notice to
  the administrator about a new request opened the list of the doctors
  instead of the queue of the requests, and the notice to the doctor about a
  refusal opened the profile, where the comment of the administrator is not.

## 0.2.0 — 2026-10-22

### Fixed

- A blocked account no longer keeps its connection to the other side. A
  blocked patient is out of reach for the doctor, a blocked doctor cannot be
  connected to, and both sides are told. Unblocking does not restore the
  link: the consent has to be given again.
- A distress signal reaches the doctor as a notification instead of a counter
  in the patient list.
- The cabinet of a doctor nobody has confirmed is closed. Only the request
  for the confirmation stays open.
- A check-in of the past day can no longer be rewritten, and a check-in for a
  future day is refused. The window is today and the two previous days.
- A medication mark of the day is kept as it was written; to change the
  status the mark is updated, and a second mark for the same day is refused.
- The archive follows the role. A doctor receives the entries, the plans and
  the notes of the patients he leads, together with his own practice library;
  a patient receives his own data without the clinician notes that the
  interface hides from him.
- A review is published once, under the first name of the patient, and the
  doctor no longer sees it under the surname. The administrator can identify
  the author of a review without the label shifting with every new review.
- A doctor can delete a practice that no patient uses, and the library
  refuses with the reason when a patient still has it in a plan.
- A malformed request body is answered with a bad request instead of a
  server failure, and a review can be removed without sending a body.

## 0.1.0 — 2026

### Added

- The first release. What it does, in one paragraph, and what a user can
  do with it that they could not do before.
