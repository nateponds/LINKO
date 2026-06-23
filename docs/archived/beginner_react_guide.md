# LINKO Beginner React Guide

## Archive Note

This guide has been archived in favor of [PROPOSED_LAYOUT.md](../PROPOSED_LAYOUT.md), which provides the updated frontend structure and component architecture for LINKO development.

---

Welcome to the React guide for **LINKO**! If you are a frontend developer transitioning from vanilla web development (HTML, CSS, and JavaScript) to ReactJS, this guide is designed specifically for you.

We will hold your hand through the basic concepts of React and show you how to build the user interface (UI) and user experience (UX) for LINKO from the ground up, following our project [ROADMAP.md](../ROADMAP.md).

---

## Table of Contents
1. [From Vanilla JS to React: The Mindset Shift](#1-from-vanilla-js-to-react-the-mindset-shift)
2. [Concept 1: JSX (HTML inside JavaScript)](#concept-1-jsx-html-inside-javascript)
   - *Exercise 1: Building a reusable Status Badge (`Badge.jsx`)*
3. [Concept 2: Components and Props (The Lego Bricks)](#concept-2-components-and-props-the-lego-bricks)
   - *Exercise 2: Building a custom Button (`Button.jsx`) and Card (`Card.jsx`)*
4. [Concept 3: State & Event Handling (`useState`)](#concept-3-state--event-handling-usestate)
   - *Exercise 3: Building a mock inventory item quick-editor*
5. [Concept 4: Lists and Keys (Displaying Data)](#concept-4-lists-and-keys-displaying-data)
   - *Exercise 4: Creating the Inventory Grid (`Inventory.jsx`)*
6. [Concept 5: Conditional Rendering & App Layout (State-based Navigation)](#concept-5-conditional-rendering--app-layout-state-based-navigation)
   - *Exercise 5: Building `AppLayout.jsx` and connecting the pages in `App.jsx`*
7. [Design & Styling: Making it Premium (Vanilla CSS)](#design--styling-making-it-premium-vanilla-css)
8. [What Next? Continuing the Roadmap](#what-next-continuing-the-roadmap)

---

## 1. From Vanilla JS to React: The Mindset Shift

In vanilla web dev, when data changes, you write instructions to manually find elements and change them:
```js
// Vanilla JS: Imperative ("Do this, then do that")
const button = document.getElementById("my-btn");
button.textContent = "Clicked!";
button.classList.add("active");
```

In React, you do not write manual updates. Instead, you write **declarative** code. You describe what the UI should look like based on the current *state* (data), and React automatically updates the screen whenever the state changes.

```jsx
// React: Declarative ("This is how it should look when clicked")
const [clicked, setClicked] = useState(false);

return (
  <button className={clicked ? "active" : ""} onClick={() => setClicked(true)}>
    {clicked ? "Clicked!" : "Click Me"}
  </button>
);
```

### Key Differences at a Glance
| Vanilla Web Dev | ReactJS |
| :--- | :--- |
| Writing static `.html` files | Writing `.jsx` files containing Javascript functions that return HTML-like code |
| Manual DOM operations (e.g., `document.getElementById`) | React updates the DOM automatically (State-driven UI) |
| Global styles, easily overridden | Modular CSS (Vanilla CSS classes scoped or styled variables) |
| Multiple pages via links (e.g. `href="about.html"`) | Component rendering switching based on state (Single Page Application) |

---

## Concept 1: JSX (HTML inside JavaScript)

In React, we use **JSX** (JavaScript XML). It allows us to write HTML-like elements directly inside JavaScript code. 

### Crucial JSX Rules for Vanilla Developers:
1. **Use `className` instead of `class`**: Since `class` is a reserved keyword in JavaScript, we must write `className`.
2. **Self-Close Tags**: All tags must close. E.g., `<input type="text">` in HTML must be written as `<input type="text" />` in JSX.
3. **Return a Single Root Element**: A JSX block can only return *one* parent element. If you don't want to wrap your code in a `<div>`, you can use an empty bracket tag, called a **Fragment**: `<> ... </>`.
4. **Evaluate JavaScript with Curly Braces `{}`**: Anything inside `{}` is executed as JavaScript.

#### Example:
```jsx
const username = "Juan";
// Evaluates to: <div className="welcome">Welcome, Juan!</div>
const element = <div className="welcome">Welcome, {username}!</div>;
```

---

### Exercise 1: Building a Reusable Status Badge

Let's build a Status Badge component. In LINKO, badges will show inventory levels (e.g., "In Stock", "Low Stock", "Out of Stock") or order statuses (e.g., "Pending", "Shipped").

1. Open your code editor and look at the empty file at [src/components/ui/Badge.jsx](file:///mnt/c/Users/Nathaniel/Desktop/DevOps%20and%20SysAdmin%20DIY/LINKO/src/components/ui/Badge.jsx).
2. Write the following code into it:

```jsx
// src/components/ui/Badge.jsx
import React from "react";
import "../../assets/css/index.css"; // We will add styles here!

export default function Badge({ text, variant = "default" }) {
  // Variant can be: 'success', 'warning', 'danger', 'info', or 'default'
  return (
    <span className={`badge badge-${variant}`}>
      {text}
    </span>
  );
}
```

#### Why we did this:
- We exported a function named `Badge`.
- Inside the function arguments, we used `{ text, variant }`. This is called **destructuring props** (more on this in Concept 2!).
- We used backticks ` ` and `${variant}` inside `className` to dynamically assign CSS classes based on the status! E.g., `badge-success` or `badge-danger`.

3. Now, let's style it. Open [src/assets/css/index.css](file:///mnt/c/Users/Nathaniel/Desktop/DevOps%20and%20SysAdmin%20DIY/LINKO/src/assets/css/index.css) and append these styles:

```css
/* Add to src/assets/css/index.css */

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge-default {
  background-color: #f3f4f6;
  color: #374151;
}

.badge-success {
  background-color: #d1fae5;
  color: #065f46;
}

.badge-warning {
  background-color: #fef3c7;
  color: #92400e;
}

.badge-danger {
  background-color: #fee2e2;
  color: #991b1b;
}

.badge-info {
  background-color: #e0f2fe;
  color: #075985;
}
```

---

## Concept 2: Components and Props (The Lego Bricks)

Think of your UI as a Lego house. Components are the individual bricks, and **Props** are the studs and properties that allow them to lock together and share configuration.

- **Component**: A JavaScript function that returns JSX. Always starts with a **Capital Letter** (e.g., `Button`, not `button`).
- **Props (Properties)**: Custom attributes you pass into a component from its parent, accessible as a single object argument inside the component function.

```jsx
// Parent component
function App() {
  return (
    <div>
      {/* Passing 'label' and 'onClick' props to the Button component */}
      <Button label="Save Item" onClick={handleSave} />
    </div>
  );
}
```

---

### Exercise 2: Building custom Button and Card components

Let's implement a reusable `Button` and `Card` inside LINKO.

1. Open [src/components/ui/Button.jsx](file:///mnt/c/Users/Nathaniel/Desktop/DevOps%20and%20SysAdmin%20DIY/LINKO/src/components/ui/Button.jsx) and add the code:

```jsx
// src/components/ui/Button.jsx
import React from "react";

export default function Button({ children, onClick, type = "button", variant = "primary", disabled = false }) {
  // 'children' is a special prop that represents whatever text or HTML is nested inside <Button>...</Button>
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${variant}`}
    >
      {children}
    </button>
  );
}
```

2. Open [src/components/ui/Card.jsx](file:///mnt/c/Users/Nathaniel/Desktop/DevOps%20and%20SysAdmin%20DIY/LINKO/src/components/ui/Card.jsx) and write this code:

```jsx
// src/components/ui/Card.jsx
import React from "react";

export default function Card({ title, subtitle, children, footer }) {
  return (
    <div className="card">
      {(title || subtitle) && (
        <div className="card-header">
          {title && <h3 className="card-title">{title}</h3>}
          {subtitle && <p className="card-subtitle">{subtitle}</p>}
        </div>
      )}
      <div className="card-body">
        {children}
      </div>
      {footer && (
        <div className="card-footer">
          {footer}
        </div>
      )}
    </div>
  );
}
```

#### Why we did this:
- **`children` Prop**: In the `Button` and `Card` components, `children` allows the parent component to pass custom content (text, icons, or other HTML tags) inside the component tags like `<Card><span>Custom Content</span></Card>`.
- **Short-circuiting (`&&`)**: In the `Card` component, `{(title || subtitle) && ...}` checks if either prop exists. If neither exists, it won't render the header div at all! This is a very common React pattern.

3. Let's add premium-looking CSS rules for our button and card. Append this to [src/assets/css/index.css](file:///mnt/c/Users/Nathaniel/Desktop/DevOps%20and%20SysAdmin%20DIY/LINKO/src/assets/css/index.css):

```css
/* Add to src/assets/css/index.css */

:root {
  --primary-color: #6366f1; /* Premium indigo tint */
  --primary-hover: #4f46e5;
  --secondary-color: #6b7280;
  --bg-card: #ffffff;
  --border-color: #e5e7eb;
}

body {
  background-color: #f9fafb;
  color: #111827;
}

/* Button Styles */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 0.375rem;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: var(--primary-color);
  color: #ffffff;
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--primary-hover);
}

.btn-secondary {
  background-color: #ffffff;
  border-color: var(--border-color);
  color: #374151;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #f3f4f6;
}

.btn-danger {
  background-color: #ef4444;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: #dc2626;
}

/* Card Styles */
.card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.02);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.card-header {
  padding: 1.25rem;
  border-bottom: 1px solid var(--border-color);
}

.card-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
}

.card-subtitle {
  margin: 0.25rem 0 0 0;
  font-size: 0.875rem;
  color: #6b7280;
}

.card-body {
  padding: 1.25rem;
  flex: 1;
}

.card-footer {
  padding: 0.75rem 1.25rem;
  background-color: #f9fafb;
  border-top: 1px solid var(--border-color);
}
```

---

## Concept 3: State & Event Handling (`useState`)

In vanilla JavaScript, to update a number on a counter, you modify the DOM element directly. 
In React, you change the **state**, and React updates the screen.

### The React rule of thumb: 
> *If a value is supposed to change during user interaction, and it affects what is displayed on the screen, it must be stored in React State.*

To declare a state variable, we import `useState` from React:
```jsx
import React, { useState } from "react";

function Counter() {
  // count: the current value (starts at 0)
  // setCount: the function we must call to update the value
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  );
}
```

---

### Exercise 3: Building a Mock Inventory Item Quick-Editor

Let's make an interactive form component to edit stock levels. This will allow MSME owners or warehouse staff to quickly adjust inventory numbers.

1. Create a new file named `src/components/ui/Input.jsx` or modify the empty one at [src/components/ui/Input.jsx](file:///mnt/c/Users/Nathaniel/Desktop/DevOps%20and%20SysAdmin%20DIY/LINKO/src/components/ui/Input.jsx):

```jsx
// src/components/ui/Input.jsx
import React from "react";

export default function Input({ label, type = "text", value, onChange, placeholder, name, min }) {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        min={min}
        className="form-input"
      />
    </div>
  );
}
```

Let's quickly append input styling to `src/assets/css/index.css`:

```css
/* Add to src/assets/css/index.css */
.form-group {
  margin-bottom: 1rem;
}

.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.375rem;
  color: #374151;
}

.form-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid var(--border-color);
  font-size: 0.875rem;
  color: #111827;
  outline: none;
  transition: border-color 0.15s ease;
}

.form-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}
```

2. Let's create an interactive widget inside our features directory. Let's create a scratch widget, or write a component inside `src/features/inventory/StockAdjuster.jsx`. (Wait, let's create a new component to demonstrate State logic to the developer!). We can create the directory and file `src/features/StockAdjuster.jsx` or just put it in a simple component. Let's keep it simple and put it in a temporary test view or inside `src/components/ui/` or `src/features/`.
Let's define a file at `src/components/ui/StockAdjuster.jsx`.

```jsx
// src/components/ui/StockAdjuster.jsx
import React, { useState } from "react";
import Card from "./Card";
import Button from "./Button";
import Input from "./Input";
import Badge from "./Badge";

export default function StockAdjuster({ itemName, initialStock }) {
  // 1. Declare state for current stock level
  const [stock, setStock] = useState(initialStock);
  // 2. Declare state for the input amount
  const [amount, setAmount] = useState(1);

  // Helper to determine stock status variant
  const getStatusVariant = (qty) => {
    if (qty <= 0) return "danger"; // Out of stock
    if (qty < 10) return "warning"; // Low stock
    return "success"; // In stock
  };

  return (
    <Card 
      title={`Adjust Stock: ${itemName}`}
      subtitle="Simulate quick warehouse receiving and dispatches"
    >
      <div style={{ marginBottom: "1rem" }}>
        <span>Current Status: </span>
        <Badge 
          text={stock <= 0 ? "Out of Stock" : stock < 10 ? "Low Stock" : "In Stock"}
          variant={getStatusVariant(stock)}
        />
        <h4 style={{ fontSize: "1.5rem", margin: "0.5rem 0" }}>{stock} Units</h4>
      </div>

      <Input
        label="Adjustment Amount"
        type="number"
        min="1"
        value={amount}
        onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
      />

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        <Button onClick={() => setStock(stock + amount)} variant="primary">
          Receive Stock (+{amount})
        </Button>
        <Button 
          onClick={() => setStock(Math.max(0, stock - amount))} 
          variant="secondary"
          disabled={stock === 0}
        >
          Dispatch Stock (-{amount})
        </Button>
      </div>
    </Card>
  );
}
```

---

## Concept 4: Lists and Keys (Displaying Data)

In vanilla webdev, to show a list of items, you write loops inside JavaScript that dynamically append HTML strings or create nodes programmatically.
In React, we use the standard JavaScript `.map()` array method.

### The JSX map pattern:
```jsx
const items = ["Apple", "Banana", "Cherry"];

return (
  <ul>
    {items.map((fruit, index) => (
      <li key={index}>{fruit}</li>
    ))}
  </ul>
);
```

### The Crucial Rule: The `key` Prop
React needs a unique identifier for every list item, called `key`. The key helps React track which items changed, were added, or were removed. **Never use array index if the list can be sorted, filtered, or edited.** Always use a unique identifier (like an `id` field).

---

### Exercise 4: Creating the Inventory Grid (`Inventory.jsx`)

Let's populate the empty `src/pages/Inventory.jsx` page with sample mock data and cards using our components.

1. Open [src/pages/Inventory.jsx](file:///mnt/c/Users/Nathaniel/Desktop/DevOps%20and%20SysAdmin%20DIY/LINKO/src/pages/Inventory.jsx) and add the following:

```jsx
// src/pages/Inventory.jsx
import React, { useState } from "react";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";

// 1. Initial Mock Data representing LINKO Inventory
const INITIAL_INVENTORY = [
  { id: "INV-001", name: "Premium Solar Panels 400W", sku: "SOL-400W-PREM", stock: 45, threshold: 10, location: "Warehouse A" },
  { id: "INV-002", name: "Lithium-Ion Battery 100Ah", sku: "BAT-100AH-LI", stock: 8, threshold: 15, location: "Warehouse A" },
  { id: "INV-003", name: "Grid-Tied Inverter 5kW", sku: "INV-5KW-GRID", stock: 0, threshold: 5, location: "Warehouse B" },
  { id: "INV-004", name: "Solar Cable 4mm (100m)", sku: "CAB-4MM-100M", stock: 120, threshold: 20, location: "Warehouse A" },
  { id: "INV-005", name: "MC4 Connectors (100pcs)", sku: "MC4-100PCS", stock: 4, threshold: 10, location: "Warehouse B" }
];

export default function Inventory() {
  const [items, setItems] = useState(INITIAL_INVENTORY);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterWarehouse, setFilterWarehouse] = useState("All");

  // Helper to determine status based on thresholds
  const getItemStatus = (stock, threshold) => {
    if (stock <= 0) return { text: "Out of Stock", variant: "danger" };
    if (stock <= threshold) return { text: "Low Stock", variant: "warning" };
    return { text: "In Stock", variant: "success" };
  };

  // Filter logic
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesWarehouse = filterWarehouse === "All" || item.location === filterWarehouse;
    return matchesSearch && matchesWarehouse;
  });

  // Action: Add one unit
  const handleQuickAdd = (itemId) => {
    setItems(items.map(item => 
      item.id === itemId ? { ...item, stock: item.stock + 1 } : item
    ));
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Warehouse Inventory</h1>
          <p className="page-subtitle">Track and adjust stock levels across local warehouses.</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filters-bar">
        <Input 
          placeholder="Search by Name or SKU..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="select-wrapper">
          <label className="form-label" style={{ margin: 0 }}>Location: </label>
          <select 
            value={filterWarehouse} 
            onChange={(e) => setFilterWarehouse(e.target.value)}
            className="filter-select"
          >
            <option value="All">All Warehouses</option>
            <option value="Warehouse A">Warehouse A</option>
            <option value="Warehouse B">Warehouse B</option>
          </select>
        </div>
      </div>

      {/* Grid of items */}
      <div className="inventory-grid">
        {filteredItems.map(item => {
          const status = getItemStatus(item.stock, item.threshold);
          return (
            <Card 
              key={item.id} 
              title={item.name} 
              subtitle={`SKU: ${item.sku} | ${item.location}`}
              footer={
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Reorder threshold: <strong>{item.threshold}</strong></span>
                  <Button onClick={() => handleQuickAdd(item.id)} variant="secondary">
                    Quick Receive (+1)
                  </Button>
                </div>
              }
            >
              <div className="inventory-card-body">
                <div className="stock-reading">
                  <span className="stock-number">{item.stock}</span>
                  <span className="stock-unit">Units</span>
                </div>
                <Badge text={status.text} variant={status.variant} />
              </div>
            </Card>
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="empty-state-card">
          <h3>No inventory items found</h3>
          <p>Try adjusting your search query or location filter.</p>
        </div>
      )}
    </div>
  );
}
```

Let's append formatting layout styles to `src/assets/css/index.css`:

```css
/* Add to src/assets/css/index.css */

.page-container {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
}

.page-title {
  font-size: 1.875rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  color: #111827;
}

.page-subtitle {
  margin: 0;
  color: #6b7280;
  font-size: 0.975rem;
}

.filters-bar {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.filters-bar .form-group {
  margin-bottom: 0;
  flex: 1;
  min-width: 250px;
}

.select-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-select {
  padding: 0.5rem 2rem 0.5rem 1rem;
  border-radius: 0.375rem;
  border: 1px solid var(--border-color);
  font-size: 0.875rem;
  background-color: white;
  cursor: pointer;
}

.inventory-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.inventory-card-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0;
}

.stock-reading {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
}

.stock-number {
  font-size: 2.25rem;
  font-weight: 700;
  color: #111827;
}

.stock-unit {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.empty-state-card {
  text-align: center;
  padding: 3rem;
  border: 2px dashed var(--border-color);
  border-radius: 0.5rem;
  color: #6b7280;
  grid-column: 1 / -1;
}
```

---

## Concept 5: Conditional Rendering & App Layout (State-based Navigation)

In Phase 1 of our roadmap, we want a minimum usable web app that showcases several pages: Dashboard, Inventory, Suppliers, and Orders.
While a fully production-ready application will eventually use a dedicated routing library (like React Router), we can implement clean page switching inside React using simple **conditional rendering** with a single page-tracker state.

### The conditional rendering pattern:
```jsx
const [page, setPage] = useState("dashboard");

return (
  <div>
    <nav>
      <button onClick={() => setPage("dashboard")}>Dashboard</button>
      <button onClick={() => setPage("inventory")}>Inventory</button>
    </nav>

    <main>
      {page === "dashboard" && <DashboardPage />}
      {page === "inventory" && <InventoryPage />}
    </main>
  </div>
);
```

---

### Exercise 5: Building `AppLayout.jsx` and connecting the pages in `App.jsx`

Let's construct the main layout shell of the app (Sidebar + Topbar + Content Panel) and make navigation links functional.

1. Let's create the template for the top header. Open [src/components/navigation/Topbar.jsx](file:///mnt/c/Users/Nathaniel/Desktop/DevOps%20and%20SysAdmin%20DIY/LINKO/src/components/navigation/Topbar.jsx) (or create it) and write the following code:

```jsx
// src/components/navigation/Topbar.jsx
import React from "react";

export default function Topbar({ currentPageTitle }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <h2 className="topbar-title">{currentPageTitle}</h2>
      </div>
      <div className="topbar-right">
        <div className="user-profile">
          <div className="avatar">MW</div>
          <div className="user-details">
            <span className="user-name">Mario Warehouse</span>
            <span className="user-role">Logistics Admin</span>
          </div>
        </div>
      </div>
    </header>
  );
}
```

2. Let's create the navigation sidebar. Open [src/layouts/AppLayout.jsx](file:///mnt/c/Users/Nathaniel/Desktop/DevOps%20and%20SysAdmin%20DIY/LINKO/src/layouts/AppLayout.jsx) (or create it) and insert:

```jsx
// src/layouts/AppLayout.jsx
import React from "react";
import Topbar from "../components/navigation/Topbar";

export default function AppLayout({ children, currentPage, setCurrentPage }) {
  // Navigation items list
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "inventory", label: "Inventory", icon: "📦" },
    { id: "suppliers", label: "Suppliers", icon: "🤝" },
    { id: "matching", label: "Supplier Matching", icon: "🎯" },
    { id: "orders", label: "Orders & Quotes", icon: "📝" },
    { id: "logistics", label: "Logistics", icon: "🚛" }
  ];

  // Helper to retrieve current page label
  const getCurrentPageTitle = () => {
    const current = navItems.find(item => item.id === currentPage);
    return current ? current.label : "LINKO";
  };

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="logo-icon">🔗</span>
          <h1 className="logo-text">LINKO</h1>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`nav-link ${currentPage === item.id ? "active" : ""}`}
              onClick={() => setCurrentPage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Pane */}
      <div className="main-wrapper">
        <Topbar currentPageTitle={getCurrentPageTitle()} />
        <main className="content-area">
          {children}
        </main>
      </div>
    </div>
  );
}
```

3. Let's build a quick dashboard template to render. Open [src/pages/Dashboard.jsx](file:///mnt/c/Users/Nathaniel/Desktop/DevOps%20and%20SysAdmin%20DIY/LINKO/src/pages/Dashboard.jsx) and add the basic layout:

```jsx
// src/pages/Dashboard.jsx
import React from "react";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import StockAdjuster from "../components/ui/StockAdjuster";

export default function Dashboard({ setCurrentPage }) {
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Operational Dashboard</h1>
          <p className="page-subtitle">Welcome back! Here's your supply chain at a glance.</p>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="metrics-grid">
        <Card title="Inventory Overview">
          <div className="metric-row">
            <span>Total Catalog SKU Items:</span>
            <strong>5</strong>
          </div>
          <div className="metric-row">
            <span>Critical Reorder Alert Items:</span>
            <Badge text="2 Items" variant="warning" />
          </div>
          <button className="dashboard-link" onClick={() => setCurrentPage("inventory")}>
            Manage Stock &rarr;
          </button>
        </Card>

        <Card title="Supplier Connections">
          <div className="metric-row">
            <span>Verified Partners:</span>
            <strong>12 Active</strong>
          </div>
          <div className="metric-row">
            <span>Pending Proximity Matches:</span>
            <Badge text="3 Alerts" variant="info" />
          </div>
          <button className="dashboard-link" onClick={() => setCurrentPage("matching")}>
            Match Near Me &rarr;
          </button>
        </Card>

        <Card title="Active Fulfillments">
          <div className="metric-row">
            <span>Pending Quotes:</span>
            <strong>4 Pending</strong>
          </div>
          <div className="metric-row">
            <span>Dispatched Shipments:</span>
            <strong>1 In-transit</strong>
          </div>
          <button className="dashboard-link" onClick={() => setCurrentPage("orders")}>
            Track Shipments &rarr;
          </button>
        </Card>
      </div>

      <div style={{ marginTop: "2rem", maxWidth: "600px" }}>
        {/* Interactive Stock Adjuster Widget */}
        <StockAdjuster itemName="Lithium-Ion Battery 100Ah" initialStock={8} />
      </div>
    </div>
  );
}
```

Wait, let's also stub out the other page directories with standard components so that selecting them doesn't crash the build.
Open [src/pages/Suppliers.jsx](file:///mnt/c/Users/Nathaniel/Desktop/DevOps%20and%20SysAdmin%20DIY/LINKO/src/pages/Suppliers.jsx) and add:

```jsx
// src/pages/Suppliers.jsx
import React from "react";
import EmptyState from "../components/ui/EmptyState";

export default function Suppliers() {
  return (
    <div className="page-container">
      <h1 className="page-title">Supplier Directory</h1>
      <p className="page-subtitle">Discover and compare wholesale providers.</p>
      <div style={{ marginTop: "2rem" }}>
        <EmptyState title="Supplier Database Coming Soon" message="We are currently building the provider profile repository. Stay tuned!" />
      </div>
    </div>
  );
}
```

Open [src/pages/Matching.jsx](file:///mnt/c/Users/Nathaniel/Desktop/DevOps%20and%20SysAdmin%20DIY/LINKO/src/pages/Matching.jsx) and add:

```jsx
// src/pages/Matching.jsx
import React from "react";
import EmptyState from "../components/ui/EmptyState";

export default function Matching() {
  return (
    <div className="page-container">
      <h1 className="page-title">Proximity Matching</h1>
      <p className="page-subtitle">Find local suppliers nearest to your coordinate location.</p>
      <div style={{ marginTop: "2rem" }}>
        <EmptyState title="Location Engine Paused" message="Proximity coordinates matcher is awaiting active GPS configurations." />
      </div>
    </div>
  );
}
```

Open [src/pages/Orders.jsx](file:///mnt/c/Users/Nathaniel/Desktop/DevOps%20and%20SysAdmin%20DIY/LINKO/src/pages/Orders.jsx) and add:

```jsx
// src/pages/Orders.jsx
import React from "react";
import EmptyState from "../components/ui/EmptyState";

export default function Orders() {
  return (
    <div className="page-container">
      <h1 className="page-title">Quote Requests & Purchase Orders</h1>
      <p className="page-subtitle">Manage procurement cycles and transaction states.</p>
      <div style={{ marginTop: "2rem" }}>
        <EmptyState title="No active purchase cycles" message="Create custom inquiries to request wholesale inventory supply quotations." />
      </div>
    </div>
  );
}
```

Open [src/pages/Logistics.jsx](file:///mnt/c/Users/Nathaniel/Desktop/DevOps%20and%20SysAdmin%20DIY/LINKO/src/pages/Logistics.jsx) and add:

```jsx
// src/pages/Logistics.jsx
import React from "react";
import EmptyState from "../components/ui/EmptyState";

export default function Logistics() {
  return (
    <div className="page-container">
      <h1 className="page-title">Logistics & Shipments</h1>
      <p className="page-subtitle">Track delivery progress and warehouse transfers.</p>
      <div style={{ marginTop: "2rem" }}>
        <EmptyState title="Shipment Dispatcher Inactive" message="Delivery route optimizations will display here." />
      </div>
    </div>
  );
}
```

Let's also make sure `src/components/ui/EmptyState.jsx` is defined:

```jsx
// src/components/ui/EmptyState.jsx
import React from "react";

export default function EmptyState({ title = "No data available", message = "Try adding records to view items here." }) {
  return (
    <div className="empty-state-card">
      <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📂</div>
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}
```

Let's define layout styles inside `src/assets/css/index.css`:

```css
/* Add to src/assets/css/index.css */

.app-shell {
  display: flex;
  min-height: 100vh;
  background-color: #f9fafb;
}

/* Sidebar styling */
.sidebar {
  width: 260px;
  background-color: #1f2937; /* Dark charcoal */
  color: #f3f4f6;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #374151;
}

.sidebar-logo {
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-bottom: 1px solid #374151;
}

.logo-icon {
  font-size: 1.5rem;
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 800;
  margin: 0;
  letter-spacing: 0.05em;
  color: #ffffff;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  padding: 1rem;
  gap: 0.25rem;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  color: #d1d5db;
  text-align: left;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
}

.nav-link:hover {
  background-color: #374151;
  color: #ffffff;
}

.nav-link.active {
  background-color: var(--primary-color);
  color: #ffffff;
}

/* Topbar styling */
.main-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0; /* Prevents layout breakdown with tables */
}

.topbar {
  height: 64px;
  background-color: #ffffff;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 2rem;
}

.topbar-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  color: #111827;
}

.topbar-right {
  display: flex;
  align-items: center;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.avatar {
  width: 36px;
  height: 36px;
  background-color: var(--primary-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 0.875rem;
  font-weight: 600;
}

.user-details {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #111827;
}

.user-role {
  font-size: 0.75rem;
  color: #6b7280;
}

.content-area {
  flex: 1;
  overflow-y: auto;
}

/* Dashboard items styles */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
}

.metric-row strong {
  font-size: 1rem;
  color: #111827;
}

.dashboard-link {
  background: none;
  border: none;
  color: var(--primary-color);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  text-align: left;
  margin-top: 1rem;
  display: inline-block;
}

.dashboard-link:hover {
  color: var(--primary-hover);
  text-decoration: underline;
}
```

4. Finally, write the routing engine inside [src/App.jsx](file:///mnt/c/Users/Nathaniel/Desktop/DevOps%20and%20SysAdmin%20DIY/LINKO/src/App.jsx).

```jsx
// src/App.jsx
import React, { useState } from "react";
import AppLayout from "./layouts/AppLayout";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Suppliers from "./pages/Suppliers";
import Matching from "./pages/Matching";
import Orders from "./pages/Orders";
import Logistics from "./pages/Logistics";
import "./assets/css/index.css";

function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");

  // Conditional renderer function
  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard setCurrentPage={setCurrentPage} />;
      case "inventory":
        return <Inventory />;
      case "suppliers":
        return <Suppliers />;
      case "matching":
        return <Matching />;
      case "orders":
        return <Orders />;
      case "logistics":
        return <Logistics />;
      default:
        return <Dashboard setCurrentPage={setCurrentPage} />;
    }
  };

  return (
    <AppLayout currentPage={currentPage} setCurrentPage={setCurrentPage}>
      {renderPage()}
    </AppLayout>
  );
}

export default App;
```

---

## Design & Styling: Making it Premium (Vanilla CSS)

As mentioned in the `FRONTEND_GUIDE.md`, we use **Vanilla CSS** instead of utility libraries like Tailwind.
This gives us full flexibility. To keep your app looking premium and clean, follow these UI/UX core design standards:

1. **Keep Colors Curated**:
   - Use custom colors in CSS variables. Notice how we used an elegant violet/indigo primary color (`#6366f1`) and dark slate buttons (`#1f2937`) to make the interface feel modern and high-end.
2. **Interactive Animation Hooks**:
   - Add hover state highlights (`transition: all 0.2s ease-in-out;`) on active items (cards, tags, links) so the page feels alive.
3. **Consistent Spacing Hierarchy**:
   - Use `rem` units for margins and paddings, relying on increments of 0.25rem (e.g. `0.25rem`, `0.5rem`, `0.75rem`, `1rem`, `1.5rem`, `2rem`) to align the grids perfectly.

---

## What Next? Continuing the Roadmap

By completing Exercises 1 to 5, you have finished **Phase 0** and **Phase 1** of LINKO's frontend! 

Your app has:
- A responsive main shell (`AppLayout` & `Sidebar`)
- Responsive routing logic without external router downloads
- Fully interactive client-side item lists and search filters (`Inventory`)
- A modular core UI toolkit (`Badge`, `Button`, `Card`, `Input`, `EmptyState`)

To continue developing:
1. Refer to [FRONTEND_GUIDE.md](./FRONTEND_GUIDE.md) to inspect the components and pages we need for the next phases.
2. Dive into **Phase 2: Local State & Data Modeling**, adding forms to create/delete local inventory items and suppliers.
3. Once we align the database, you'll replace the local mock arrays (`INITIAL_INVENTORY`) with backend HTTP `fetch` routes!

Happy coding! You are doing amazing. 📦🚛🔗
