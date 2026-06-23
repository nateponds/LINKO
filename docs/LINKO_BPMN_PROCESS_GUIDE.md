# LINKO Horizontal BPMN Process Chart Design Blueprint
*Modified on: June 23, 2026 at 9:06 PM (Local Time)*

This reference blueprint organizes the LINKO business process to match the horizontal swimlane layout, color coding, and element mapping shown in [BPMN aqualine.png](file:///mnt/c/Users/Nathaniel/Desktop/DevOps and SysAdmin DIY/LINKO/local-notes/BPMN aqualine.png) (when viewed in its proper horizontal orientation).

---

## 1. Row-Swimlane & Element Definitions

To match the standard BPMN layout, organize your chart into **4 Horizontal Swimlanes (Rows)** running from top to bottom:

| Swimlane (Row) | Aqualine Color | Design Shape | Responsibility in LINKO |
| :--- | :--- | :--- | :--- |
| **Row 1: MSME Buyer** | **Blue** (e.g., `#60a5fa`) | Task Boxes, Start/End | Places orders, negotiates quotes, makes external payments, receives goods. |
| **Row 2: LINKO System** | **Green** (e.g., `#34d399`) | Task Boxes, Gateways, Databases | Automatically matches, holds/deducts wallet balances, updates delivery tracker, commits database changes. |
| **Row 3: Wholesaler** | **Purple** (e.g., `#a78bfa`) | Task Boxes, Gateways | Proposes quote terms, confirms payments, dispatches supplies. |
| **Row 4: Logistics Carrier** | **Pink** (e.g., `#f472b6`) | Task Boxes, Gateways | Pick-up, transports package, manages COD collections. |

### Visual Elements Legend
*   **Start / End Events**: Rounded white pills (e.g., `START`, `END`).
*   **Gateways (Decisions)**: Light-blue diamonds with blue borders.
*   **Database Stores**: Dark-green cylinders (representing database operations).
*   **Flow Lines**: Curved lines with arrowheads linking tasks from **left to right** across lanes.

---

## 2. Horizontal Node Sequence (Left-to-Right Flow)

This layout guide traces the step-by-step sequence as it moves from left to right across the horizontal swimlanes.

### Phase 1: Onboarding, Sourcing & Matching
1.  **START** (Pill, MSME Buyer Row, Left) $\rightarrow$ Connects to **Place Sourcing Request** (Task, MSME Buyer Row).
    *   *Inputs*: Location details & product needs.
    *   *Arrow*: Points down to **Process Matches** (Task, LINKO System Row).
2.  **Process Matches** (Task, LINKO System Row).
    *   *Interaction*: Reads from **Supplier Profile Catalog** (Database Cylinder, LINKO System Row).
    *   *Arrow*: Connects to **Is Wallet Active & Funded?** (Gateway Diamond, LINKO System Row).
        *   **No** $\rightarrow$ Exclude Wholesaler.
        *   **Yes** $\rightarrow$ Connects to **Display Matching Suppliers** (Task, LINKO System Row).
    *   *Arrow*: Points up to **Select Wholesaler & Send RFQ** (Task, MSME Buyer Row).
3.  **Select Wholesaler & Send RFQ** (Task, MSME Buyer Row).
    *   *Arrow*: Points down to **Receive RFQ Lead** (Task, Wholesaler Row).

### Phase 2: Quoting & Negotiation
4.  **Receive RFQ Lead** (Task, Wholesaler Row) $\rightarrow$ Connects to **Send Quote Proposal** (Task, Wholesaler Row).
    *   *Content*: Sets MOQ, lead times, and payment terms (Pay in Advance vs. Pay on Delivery).
    *   *Arrow*: Points up to **Evaluate Quote** (Gateway Diamond, MSME Buyer Row).
5.  **Evaluate Quote** (Gateway Diamond, MSME Buyer Row).
    *   **No (Reject)** $\rightarrow$ Connects to **END** (Pill, MSME Buyer Row) on the far right.
    *   **Yes (Accept)** $\rightarrow$ Connects to **Accept Quote & Place Order** (Task, MSME Buyer Row).
    *   *Arrow*: Points down to **Reserve Commission Fee** (Task, LINKO System Row).

### Phase 3: Commission Hold & Payment Branching
6.  **Reserve Commission Fee** (Task, LINKO System Row).
    *   *Interaction*: Writes to **Wholesaler Wallet Database** (Database Cylinder, LINKO System Row) to reserve credits on hold.
    *   *Arrow*: Points down to **Payment Term Check** (Gateway Diamond, Wholesaler Row).
7.  **Payment Term Check** (Gateway Diamond, Wholesaler Row).
    *   **Branch A: Pay in Advance (Pre-Payment)**:
        1.  Flows to **Submit Invoice Details** (Task, Wholesaler Row).
        2.  *Arrow*: Points up to **Make Online/External Payment** (Task, MSME Buyer Row).
        3.  *Arrow*: Points down to **Confirm Payment Received** (Task, Wholesaler Row).
        4.  Flows to **Dispatch Supplies** (Task, Wholesaler Row).
    *   **Branch B: Pay on Delivery (COD)**:
        1.  Flows directly to **Dispatch Supplies** (Task, Wholesaler Row).
    *   *Arrow*: **Dispatch Supplies** points down to **Transport Supplies** (Task, Logistics Carrier Row).

### Phase 4: Transit & Shipment Ingestion
8.  **Transport Supplies** (Task, Logistics Carrier Row).
    *   *Activity*: Emits updates to **Update Live Delivery Progress** (Task, LINKO System Row), rendering the live tracking statuses on both user screens.
    *   *Arrow*: Flows to **Deliver Supplies** (Task, Logistics Carrier Row).
    *   *Arrow*: Points up to **Inspect & Confirm Receipt** (Task, MSME Buyer Row).
9.  **Inspect & Confirm Receipt** (Task, MSME Buyer Row).
    *   *Arrow*: Points down to **Check COD Status** (Gateway Diamond, LINKO System Row).

### Phase 5: Transaction Closure & Database Updates
10. **Check COD Status** (Gateway Diamond, LINKO System Row).
    *   **Yes (Payment Pending)**:
        1.  *Arrow*: Points up to **Pay Wholesaler** (Task, MSME Buyer Row).
        2.  *Arrow*: Points down to **Confirm Payment Received** (Task, Wholesaler Row).
        3.  *Arrow*: Points up to **Deduct Commission Fee** (Task, LINKO System Row).
    *   **No (Already Settled)**:
        1.  Flows directly to **Deduct Commission Fee** (Task, LINKO System Row).
11. **Deduct Commission Fee** (Task, LINKO System Row).
    *   *Interaction*: Updates **Wholesaler Wallet Database** (Database Cylinder) to finalize the deduction.
    *   *Flow*: Connects to **Update Inventory Records** (Task, LINKO System Row).
    *   *Interaction*: Increments values in **MSME Inventory Database** (Database Cylinder) and registers the transaction log.
    *   *Flow*: Connects to **Store Finished Order Record** (Database Cylinder, LINKO System Row) $\rightarrow$ connects to **END** (Pill, LINKO System Row, Far Right).

---

## 3. Dispute & Cancel Loops (Alternative Paths)

*   **Wholesaler Default (No Shipment)**:
    *   If dispatch timing is breached, MSME performs a **Cancel Order** (Task, MSME Buyer Row).
    *   *Link*: From **Cancel Order** $\rightarrow$ points down to **Release Reserved Credits** (Task, LINKO System Row) $\rightarrow$ connects to **END**.
*   **Transit Issues / Lost Shipments**:
    *   During transit, MSME Buyer can trigger **File Dispute** (Task, MSME Buyer Row).
    *   *Gateway*: **Resolve with Redelivery or Cancel?**
        *   *Redelivery*: Points down to **Transport Supplies** (Task, Logistics Carrier Row).
        *   *Cancel*: Points down to **Issue Refund** (Task, Wholesaler Row) $\rightarrow$ points up to **Release Wallet Credits** (Task, LINKO System Row) $\rightarrow$ **END**.
