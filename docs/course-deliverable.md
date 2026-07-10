# Course Deliverable — CIS 2104 (Information Management II)

Requirements as given by the course. Graded via **this repo + live demo**; the 5 core tables must be visible in the running system. A database project proposal/report is due at finals.

Implemented by migrations `002_logistics_schema.sql` + `003_linko_schema.sql`; design documented in [LINKO_ERD.md](./LINKO_ERD.md). This is **course scope, not LINKO product scope** — see the scope note in the ERD doc.

---

## Original requirement text

Courier/Parcel Tracking:
Objective: To manage the lifecycle of a delivery from pickup to drop-off. The system records sender and receiver details, calculates shipping costs based on weight, and maintains a real-time log of the parcel's journey through various transit points.
Functionalities: Log sender/receiver info, package weight, and current delivery status.

The 5 Core Tables

- Service_Tiers: Defines delivery speeds (e.g., Standard, Express, Next-Day) and their base rates per kilogram.
- Customers: A shared table for both Senders and Receivers to store addresses and contact info.
- Branches: The physical hubs or warehouses where parcels are processed (e.g., Cebu Hub, Manila Sortation Center).
- Parcels: The master record for each package, including weight, dimensions, and the current assigned status.
- Tracking_Logs: The "History" table that records every time a parcel is scanned at a new location or changes status.

## Known deviation (defend in report)

Spec says Parcels holds "the current assigned status." Our design keeps status **only** in `Tracking_Logs` (current status = latest row by `scanned_at`): status is event data, and storing it on Parcels would duplicate the log. The demo UI still shows a per-parcel status, derived from the latest log row.

## Commissions & remittances — scope freeze (defend in report)

`commission_brackets`, `commissions`, and the `wholesaler_remittances` view are a deliberate scope **addition** beyond the 5 core tables — they exist as ERD-and-report material (trigger, frozen-fee history, derived view) and are demonstrable live: booking a parcel auto-creates the commission row with zero application code, and the view computes remittances on the fly (`seeds/demo_queries.sql` Q9–Q11).

**Frozen: no application workflow will be built on them.** No collection flow, no reversal on returned parcels, no dedicated UI. The defense line: the settlement *lifecycle* is modeled and seeded (`status`, `settled_at`); the collection *workflow* is application scope, outside a database course's grading surface. Commission and remittance are charged per parcel booked, outcome-blind — a `Returned` parcel still carries them; reversal semantics are deferred indefinitely (`docs/BACKLOG.md` "Returns & Refunds Planning", if ever). Do not propose wiring commissions into marketplace or parcel-tracking workflows.
