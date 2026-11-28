# Watchline

A personal tracker for the movies and series a user watches, shared quietly with a few friends. UI labels are French; the canonical terms below are English.

## Language

### Watch

**Media**:
A movie or a series that a user can track. (To be defined fully with the Media area.)
_Avoid_: Title, show, item, work

**Watch Entry**:
A user's relationship to one **Media**: where they are with it and what they thought of it. A user has at most one per **Media**.
_Avoid_: List item, tracking, title

**Status**:
The stage a **Watch Entry** is at. Every entry has exactly one: **Plan to Watch**, **Watching**, **Completed** or **Dropped**.
_Avoid_: State

**Plan to Watch**:
The **Status** of a **Watch Entry** the user means to watch but hasn't started. UI: « À voir ».
_Avoid_: Planned, to watch, watchlisted

**Watching**:
The **Status** of a **Watch Entry** the user has started and not yet finished. UI: « En cours ».
_Avoid_: In progress, ongoing

**Completed**:
The **Status** of a **Watch Entry** whose **Media** the user has seen in full: a movie watched to the end, or every episode of a series released so far. UI: « Vu ».
_Avoid_: Done, finished, watched

**Dropped**:
The **Status** of a **Watch Entry** the user stopped before the end and doesn't plan to finish. UI: « Abandonné ».
_Avoid_: Abandoned, quit, cancelled

**Returning**:
A **Completed** series that has gained a new season dated after the user finished it. A Returning series is reopened: its entry goes back to **Watching**. A **Dropped** series is never reopened.
_Avoid_: Comeback, renewed, resurfaced

**Paused**:
A **Plan to Watch** or **Watching** entry the user has set aside from the active views without deleting it, meaning to come back to it. Being paused is separate from the entry's **Status**, which it keeps. UI: « En pause ».
_Avoid_: Snoozed, on hold, hidden

**Rating**:
The user's verdict on a **Watch Entry**, from half a star to five stars, optionally with notes. It can be given at any **Status**.
_Avoid_: Score, review

**Watchlist**:
The user's **Plan to Watch** entries that aren't **Paused**.
_Avoid_: Queue, to-watch list

**Now Watching**:
The series the user is **Watching** and hasn't **Paused**, each shown with its progress and next episode.
_Avoid_: In progress, current shows

**Timeline**:
What's coming up, or just came out in the last few days, from the **Watchlist** and **Now Watching**, grouped by how soon (Aujourd'hui / Demain / Dans X jours).
_Avoid_: Upcoming, calendar, schedule

**Catch-up**:
Things from the **Watchlist** and **Now Watching** that came out more than a few days ago and are still unwatched, the ones that have aged out of the **Timeline**. UI: « À rattraper ».
_Avoid_: Backlog, overdue, missed

**Remove**:
Taking a **Media** off the user's lists entirely, erasing its **Watch Entry** as if it had never been tracked. Unlike **Dropped**, nothing is kept.
_Avoid_: Delete, untrack
