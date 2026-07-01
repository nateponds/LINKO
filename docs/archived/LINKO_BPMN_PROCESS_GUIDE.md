# LINKO BPMN Process Chart Design Blueprint

*Last Updated: June 29, 2026*

This reference blueprint organizes the LINKO B2B supply chain process using a matrix layout: **4 Horizontal Swimlanes (Roles)** running from top to bottom, and **4 Vertical Swimlanes (Phases)** running from left to right. This structure aligns with standard BPMN 2.0 visualization practices.

---

## 1. Swimlane & Element Definitions

### A. Horizontal Swimlanes (Roles/Pools)
These lanes represent the actors responsible for executing specific tasks.

| Swimlane (Row) | Aqualine Color | Design Shape | Responsibility in LINKO |
| :--- | :--- | :--- | :--- |
| **Row 1: MSME Buyer** | **Blue** (e.g., `#60a5fa`) | Task Boxes, Start/End | Places sourcing requests, evaluates quotes, places orders, makes external payments, receives goods. |
| **Row 2: LINKO System** | **Green** (e.g., `#34d399`) | Task Boxes, Gateways, Databases | Automatically matches, checks wallets, reserves commission, deducts wallet balances, updates live delivery tracker, commits database changes. |
| **Row 3: Wholesaler** | **Purple** (e.g., `#a78bfa`) | Task Boxes, Gateways | Proposes quote terms, confirms payments, dispatches supplies. |
| **Row 4: Logistics Carrier** | **Pink** (e.g., `#f472b6`) | Task Boxes, Gateways | Picks up cargo, transports package, delivers supplies, manages COD collections. |

### B. Vertical Swimlanes (Phases/Milestones)
These phases partition the end-to-end process chronologically from left to right.

| Phase (Column) | Scope / Boundary | Core Objectives |
| :--- | :--- | :--- |
| **Phase 1: Sourcing & Discovery** | Start $\rightarrow$ RFQ Lead Received | MSME Buyer specifies sourcing needs; system identifies and ranks eligible Wholesalers; Buyer selects supplier and initiates request. |
| **Phase 2: Negotiation & Agreement** | RFQ Lead Received $\rightarrow$ Order Placed | Wholesaler proposes terms (MOQ, lead times, price); Buyer evaluates proposal; contract is accepted and order is generated. |
| **Phase 3: Payment & Commitment** | Order Placed $\rightarrow$ Dispatch Preparation | Escrow/commission is held; payment terms are checked; upfront payment is collected/verified (if pre-payment) to secure the order. |
| **Phase 4: Fulfillment & Settlement** | Dispatch $\rightarrow$ Transaction Closed | Wholesaler dispatches cargo; logistics carrier transports and delivers; buyer inspects/confirms; COD collected (if COD); platform completes commission deductions and inventory updates. |

### Visual Elements Legend
* **Start / End Events**: Rounded white pills (e.g., `START`, `END`).
* **Gateways (Decisions)**: Light-blue diamonds with blue borders.
* **Database Stores**: Dark-green cylinders (representing database operations).
* **Flow Lines**: Curved lines with arrowheads linking tasks from **left to right** across lanes and phases.

---

## 2. Horizontal Node Sequence (Left-to-Right Flow)

### Phase 1: Sourcing & Discovery
1. **START** (Pill, MSME Buyer Row, Left) $\rightarrow$ Connects to **Place Sourcing Request** (Task, MSME Buyer Row).
   * *Inputs*: Location details & product needs.
   * *Arrow*: Points down to **Process Matches** (Task, LINKO System Row).
2. **Process Matches** (Task, LINKO System Row).
   * *Interaction*: Reads from **Supplier Profile Catalog** (Database Cylinder, LINKO System Row).
   * *Arrow*: Connects to **Is Wallet Active & Funded?** (Gateway Diamond, LINKO System Row).
     * **No** $\rightarrow$ Exclude Wholesaler.
     * **Yes** $\rightarrow$ Connects to **Display Matching Suppliers** (Task, LINKO System Row).
   * *Arrow*: Points up to **Select Wholesaler & Send RFQ** (Task, MSME Buyer Row).
3. **Select Wholesaler & Send RFQ** (Task, MSME Buyer Row).
   * *Arrow*: Points down to **Receive RFQ Lead** (Task, Wholesaler Row), transitioning into Phase 2.

### Phase 2: Negotiation & Agreement
4. **Receive RFQ Lead** (Task, Wholesaler Row) $\rightarrow$ Connects to **Send Quote Proposal** (Task, Wholesaler Row).
   * *Content*: Sets MOQ, lead times, and payment terms (Pay in Advance vs. Pay on Delivery).
   * *Arrow*: Points up to **Evaluate Quote** (Gateway Diamond, MSME Buyer Row).
5. **Evaluate Quote** (Gateway Diamond, MSME Buyer Row).
   * **No (Reject)** $\rightarrow$ Connects to **END** (Pill, MSME Buyer Row) on the far right.
   * **Yes (Accept)** $\rightarrow$ Connects to **Accept Quote & Place Order** (Task, MSME Buyer Row).
   * *Arrow*: Points down to **Reserve Commission Fee** (Task, LINKO System Row), transitioning into Phase 3.

### Phase 3: Payment & Commitment
6. **Reserve Commission Fee** (Task, LINKO System Row).
   * *Interaction*: Writes to **Wholesaler Wallet Database** (Database Cylinder, LINKO System Row) to reserve credits on hold.
   * *Arrow*: Points down to **Payment Term Check** (Gateway Diamond, Wholesaler Row).
7. **Payment Term Check** (Gateway Diamond, Wholesaler Row).
   * **Branch A: Pay in Advance (Pre-Payment)**:
     1. Flows to **Submit Invoice Details** (Task, Wholesaler Row).
     2. *Arrow*: Points up to **Make Online/External Payment** (Task, MSME Buyer Row).
     3. *Arrow*: Points down to **Confirm Payment Received** (Task, Wholesaler Row).
     4. Flows to **Dispatch Supplies** (Task, Wholesaler Row), transitioning into Phase 4.
   * **Branch B: Pay on Delivery (COD)**:
     1. Flows directly to **Dispatch Supplies** (Task, Wholesaler Row), transitioning into Phase 4.

### Phase 4: Fulfillment & Settlement
8. **Dispatch Supplies** (Task, Wholesaler Row).
   * *Arrow*: Points down to **Transport Supplies** (Task, Logistics Carrier Row).
9. **Transport Supplies** (Task, Logistics Carrier Row).
   * *Activity*: Emits updates to **Update Live Delivery Progress** (Task, LINKO System Row), rendering live tracking status on both user screens.
   * *Arrow*: Flows to **Deliver Supplies** (Task, Logistics Carrier Row).
   * *Arrow*: Points up to **Inspect & Confirm Receipt** (Task, MSME Buyer Row).
10. **Inspect & Confirm Receipt** (Task, MSME Buyer Row).
    * *Arrow*: Points down to **Check COD Status** (Gateway Diamond, LINKO System Row).
11. **Check COD Status** (Gateway Diamond, LINKO System Row).
    * **Yes (Payment Pending)**:
      1. *Arrow*: Points up to **Pay Wholesaler** (Task, MSME Buyer Row).
      2. *Arrow*: Points down to **Confirm Payment Received** (Task, Wholesaler Row).
      3. *Arrow*: Points up to **Deduct Commission Fee** (Task, LINKO System Row).
    * **No (Already Settled)**:
      1. Flows directly to **Deduct Commission Fee** (Task, LINKO System Row).
12. **Deduct Commission Fee** (Task, LINKO System Row).
    * *Interaction*: Updates **Wholesaler Wallet Database** (Database Cylinder) to finalize the deduction.
    * *Flow*: Connects to **Update Inventory Records** (Task, LINKO System Row).
    * *Interaction*: Increments values in **MSME Inventory Database** (Database Cylinder) and registers the transaction log.
    * *Flow*: Connects to **Store Finished Order Record** (Database Cylinder, LINKO System Row) $\rightarrow$ connects to **END** (Pill, LINKO System Row, Far Right).

---

## 3. Dispute & Cancel Loops (Alternative Paths)

> [!NOTE]
> These exception handling routines bypass standard flow transitions and trigger immediate resolution and system rollback.

* **Wholesaler Default (No Shipment)**:
  * If dispatch timing is breached, MSME performs a **Cancel Order** (Task, MSME Buyer Row).
  * *Link*: From **Cancel Order** $\rightarrow$ points down to **Release Reserved Credits** (Task, LINKO System Row) $\rightarrow$ connects to **END**.
* **Transit Issues / Lost Shipments**:
  * During transit, MSME Buyer can trigger **File Dispute** (Task, MSME Buyer Row).
  * *Gateway*: **Resolve with Redelivery or Cancel?**
    * *Redelivery*: Points down to **Transport Supplies** (Task, Logistics Carrier Row).
    * *Cancel*: Points down to **Issue Refund** (Task, Wholesaler Row) $\rightarrow$ points up to **Release Wallet Credits** (Task, LINKO System Row) $\rightarrow$ **END**.
