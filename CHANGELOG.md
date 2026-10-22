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

- Nothing yet.

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
