# LINKO Beginner Backend Guide

Welcome to the backend development guide for **LINKO**! If you are a beginner backend developer transitioning from a vanilla web development mindset to building servers and databases, this guide is written specifically for you.

We will hold your hand through setting up your first database, creating an API server, and writing your first queries to make the **LINKO** backend function.

---

## Table of Contents

1. [The Backend Architecture: The Client-Server Model](#1-the-backend-architecture-the-client-server-model)
2. [Why stick with PERN? (Node.js, Express.js, PostgreSQL)](#why-stick-with-pern-nodejs-expressjs-postgresql)
3. [Concept 1: Setting up Node.js & Express (The API Server)](#concept-1-setting-up-nodejs--express-the-api-server)
   - _Exercise 1: Building a "Hello World" Express API_
4. [Concept 2: REST APIs & Routing (GET, POST, requests, responses)](#concept-2-rest-apis--routing-get-post-requests-responses)
   - _Exercise 2: Building Mock API endpoints for LINKO Inventory_
5. [Concept 3: Database & SQL Basics (PostgreSQL)](#concept-3-database--sql-basics-postgresql)
   - _Exercise 3: Creating the LINKO database structure_
6. [Concept 4: Connecting the Server to the Database (`pg` library)](#concept-4-connecting-the-server-to-the-database-pg-library)
   - _Exercise 4: Retrieving live Inventory data from PostgreSQL_
7. [Proximity Matching Logic (The LINKO MVP Matcher)](#proximity-matching-logic-the-LINKO-mvp-matcher)
8. [Summary & Next Steps](#summary--next-steps)

---

## 1. The Backend Architecture: The Client-Server Model

In frontend web dev, your code runs inside the user's browser (the **client**). But a web browser cannot safely store data permanently or run heavy calculations (like supplier proximity matching) in a shared way.

For that, we use the **backend** (the **server** and **database**):

1. **The Client (React)** sends an HTTP request (e.g. "Give me inventory list") to the server.
2. **The Server (Node/Express)** receives the request, runs validation logic, and talks to the database.
3. **The Database (PostgreSQL)** retrieves or updates the records and returns them to the server.
4. **The Server** packages that data into JSON (JavaScript Object Notation) and sends it back as an HTTP response.
5. **The Client** receives the JSON and updates the screen.

```text
  [ React Client ]
       |       ^
  (HTTP Request) (JSON Response)
       v       |
  [ Node.js/Express Server ]
       |       ^
   (SQL Query) (SQL Result)
       v       |
  [ PostgreSQL Database ]
```

---

## Why stick with PERN? (Node.js, Express.js, PostgreSQL)

If your team does not know any backend stack, **Node.js + Express.js + PostgreSQL** is the best choice:

1. **Single Language (JavaScript)**: React is written in JavaScript. Node.js lets you write your backend in JavaScript too. You do _not_ need to learn Python, PHP, or Ruby!
2. **Express.js is lightweight**: Unlike heavy frameworks (like Spring Boot or Django), Express has very little boilerplate code.
3. **PostgreSQL is Relational (SQL)**: LINKO handles shipments, users, warehouses, and orders. These have rigid relationships (e.g. "an Order belongs to a Customer"). A relational SQL database is perfect for keeping this data accurate and linked.

---

## Concept 1: Setting up Node.js & Express (The API Server)

To write server-side JavaScript, we use **Node.js**. To convert Node into a web server that responds to requests, we use **Express.js**.

### Let's initialize a Node/Express backend from scratch:

In a real backend project, you create a new directory and install Express using `npm`:

```bash
npm init -y
npm install express
```

This creates a `package.json` file inside your backend directory, similar to your frontend.

---

### Exercise 1: Building a "Hello World" Express API

Let's inspect how simple it is to build a server. Create a file in a temporary workspace directory or study this structure:

```javascript
// server.js (Node.js + Express.js server example)
const express = require("express"); // 1. Import Express
const app = express(); // 2. Create the Express application instance
const PORT = 5000; // 3. Define the port number (e.g., 5000)

// 4. Enable the server to read JSON bodies in requests
app.use(express.json());

// 5. Define your first endpoint (a GET request to '/')
app.get("/", (req, res) => {
  res.send("Welcome to the LINKO Backend API!");
});

// 6. Tell the server to start listening for traffic
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
```

#### Why we did this:

- **`app.get('/', ...)`**: Defines a listener for HTTP **GET** requests at the root URL `/`.
- **`req` (Request object)**: Contains information about the incoming request (headers, query parameters, data).
- **`res` (Response object)**: Contains functions used to send data back to the client (like `res.send` or `res.json`).

---

## Concept 2: REST APIs & Routing

We use the **REST** (Representational State Transfer) standard to write API endpoints. In REST, we use HTTP verbs to perform actions:

- `GET`: Retrieve data (e.g., list of inventory items).
- `POST`: Create new data (e.g., add a new supplier).
- `PATCH` / `PUT`: Update existing data (e.g., edit stock quantity).
- `DELETE`: Delete data.

---

### Exercise 2: Building Mock API endpoints for LINKO Inventory

Let's write a mock API endpoint inside our Express server to return the inventory data we designed in Phase 1, using local JavaScript variables.

```javascript
// Add to server.js

// Initial Mock database array
let inventory = [
  { id: 1, name: "Premium Solar Panels 400W", sku: "SOL-400W-PREM", stock: 45 },
  { id: 2, name: "Lithium-Ion Battery 100Ah", sku: "BAT-100AH-LI", stock: 8 },
];

// Endpoint to GET all inventory items
app.get("/api/inventory", (req, res) => {
  // We send the list formatted as JSON
  res.json(inventory);
});

// Endpoint to POST (create) a new inventory item
app.post("/api/inventory", (req, res) => {
  const { name, sku, stock } = req.body; // Destructure the fields sent by the frontend client

  // Simple validation
  if (!name || !sku) {
    return res.status(400).json({ error: "Name and SKU are required!" });
  }

  // Create new object
  const newItem = {
    id: inventory.length + 1,
    name,
    sku,
    stock: parseInt(stock) || 0,
  };

  // Push to local array
  inventory.push(newItem);

  // Return the newly created item with a 201 Created status
  res.status(201).json(newItem);
});
```

#### Why we did this:

- **`res.status(400)`**: Sends a `400 Bad Request` status code, indicating the client did not send the correct details.
- **`req.body`**: Reads the variables sent in the JSON payload of the POST request.

---

## Concept 3: Database & SQL Basics (PostgreSQL)

Storing data in a local array variable (`let inventory = [...]`) inside our Node server means **our data disappears whenever the server restarts**.
We need a **database** to write records to a storage disk.

### PostgreSQL (SQL) vs. JavaScript:

- JavaScript stores data in **Arrays** of **Objects**.
- PostgreSQL stores data in **Tables** composed of **Rows** and **Columns**.

Each table requires a **Schema** (a layout definition describing what column name holds what type of data).

Refer to the LINKO database specification file [docs/LINKO_database_specification.md](./LINKO_database_specification.md) to see how we define SQL tables.

Here is the standard SQL script to create a simplified Customer table for our database:

```sql
-- SQL: Create Customers Table
CREATE TABLE Customers (
    customer_id SERIAL PRIMARY KEY,      -- SERIAL automatically numbers the ID (1, 2, 3...)
    full_name VARCHAR(100) NOT NULL,     -- Text column, maximum 100 characters
    phone_number VARCHAR(20) NOT NULL,
    email VARCHAR(100) UNIQUE,           -- Ensures no two customers share the same email
    city VARCHAR(50) NOT NULL
);
```

### Writing SQL Queries:

Once tables exist, we use SQL statements to select or insert records:

```sql
-- Read all customers:
SELECT * FROM Customers;

-- Read customers in Manila:
SELECT * FROM Customers WHERE city = 'Manila';

-- Insert a new customer:
INSERT INTO Customers (full_name, phone_number, email, city)
VALUES ('Aries Logistics', '+63912345678', 'aries@logistics.com', 'Cebu');
```

---

### Exercise 3: Creating the LINKO database structure

If you have PostgreSQL installed on your computer, you can run the following SQL queries inside your PostgreSQL database console (e.g. pgAdmin or psql) to set up tables matching LINKO's specifications:

```sql
-- 1. Create Service Tiers table
CREATE TABLE Service_Tiers (
    tier_id SERIAL PRIMARY KEY,
    tier_name VARCHAR(50) NOT NULL UNIQUE,
    base_rate_per_kg DECIMAL(10,2) NOT NULL,
    estimated_days INT NOT NULL
);

-- 2. Insert default Service Tiers
INSERT INTO Service_Tiers (tier_name, base_rate_per_kg, estimated_days) VALUES
('Standard', 50.00, 5),
('Express', 120.00, 2),
('Next-Day', 250.00, 1);

-- 3. Create Parcels table
CREATE TABLE Parcels (
    parcel_id VARCHAR(20) PRIMARY KEY,
    sender_name VARCHAR(100) NOT NULL,
    receiver_name VARCHAR(100) NOT NULL,
    tier_id INT REFERENCES Service_Tiers(tier_id), -- Relational reference key
    weight_kg DECIMAL(6,2) NOT NULL,
    total_cost DECIMAL(10,2) NOT NULL,
    current_status VARCHAR(50) NOT NULL DEFAULT 'Order Created'
);
```

---

## Concept 4: Connecting the Server to the Database (`pg` library)

To connect our Node.js server with our PostgreSQL database, we use a Node driver library called `pg`.

```bash
# How to install it in your project folder
npm install pg
```

We configure a **Database Pool**. The Pool handles open connections between our server and the Postgres engine.

---

### Exercise 4: Retrieving live Inventory data from PostgreSQL

Let's write a module inside Express that queries real PostgreSQL records.

1. Create a `db.js` file to store credentials:

```javascript
// db.js
const { Pool } = require("pg");

// Setup connection details
const pool = new Pool({
  user: "postgres", // Your PostgreSQL username
  host: "localhost",
  database: "LINKO_db", // The database name we created
  password: "your_password", // Your database login password
  port: 5432, // Default PostgreSQL port
});

module.exports = pool;
```

2. Refactor your API endpoint inside `server.js` to query the database:

```javascript
// server.js
const express = require("express");
const app = express();
const pool = require("./db"); // Import our Database connection pool

app.use(express.json());

// GET: Query live customers from the database
app.get("/api/customers", async (req, res) => {
  try {
    // Run the SQL command using await
    const result = await pool.query("SELECT * FROM Customers");

    // The results reside in the '.rows' array property
    res.json(result.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Database query failed!" });
  }
});

// POST: Insert a new customer into the database
app.post("/api/customers", async (req, res) => {
  try {
    const { full_name, phone_number, email, city } = req.body;

    // Execute SQL with parameterized variables ($1, $2) to prevent SQL Injection security attacks
    const queryText = `
      INSERT INTO Customers (full_name, phone_number, email, city)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const values = [full_name, phone_number, email, city];

    const result = await pool.query(queryText, values);

    // Return the newly created database row
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Failed to create customer!" });
  }
});

app.listen(5000, () => console.log("Server listening on port 5000"));
```

#### Why we did this:

- **`async` and `await`**: Accessing database files on a disk takes time. We use JavaScript's `async/await` syntax to wait for the query to return without blocking other incoming API requests!
- **`$1, $2, $3, $4` placeholders**: We never insert strings from the user directly into database queries (e.g. do _not_ do `'INSERT ... VALUES (' + req.body.name + ')'`). That exposes the database to **SQL Injection** security hacks. Parameterizing variables with `$` placeholders keeps our queries safe.

---

## Proximity Matching Logic (The LINKO MVP Matcher)

In Phase 5 of the roadmap, we must rank suppliers by location and proximity.
For our Minimum Viable Product (MVP), we rank nearby partners by checking if their city matches the buyer's city:

```javascript
// server.js
// Endpoint to find matching suppliers in the same city

app.get("/api/matching/suppliers", async (req, res) => {
  try {
    const { buyerCity } = req.query; // E.g., /api/matching/suppliers?buyerCity=Manila

    if (!buyerCity) {
      return res
        .status(400)
        .json({ error: "buyerCity query parameter is required" });
    }

    const queryText = `
      SELECT * FROM Customers 
      WHERE city = $1 AND customer_id IN (
        -- Select only those who act as suppliers
        SELECT customer_id FROM Customers WHERE email LIKE '%supplier%'
      );
    `;

    const result = await pool.query(queryText, [buyerCity]);
    res.json(result.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Proximity matching query failed" });
  }
});
```

As the platform scales to handle coordinate ranges, you can install the PostgreSQL extension **PostGIS** to calculate exact distances in kilometers using spatial GPS coordinates!

---

## Summary & Next Steps

Congratulations! You now understand the basic blocks of the LINKO Backend:

1. You set up a Node/Express app that listens on a Port.
2. You created REST API endpoints to support GET and POST operations.
3. You modeled relational database schemas using standard SQL queries in PostgreSQL.
4. You linked Node.js and PostgreSQL using the async `pg` pool connector.

To keep moving forward:

1. Coordinate with your frontend developers to match API JSON responses with their React layouts.
2. Review the full data specifications in [LINKO_database_specification_aligned_updated.md](./LINKO_database_specification_aligned_updated.md) and implement table migrations for Warehouses, Parcels, and Tracking Logs.
3. Once those tables are complete, write Express API endpoints to query, insert, and update parcel delivery tracking details.

Keep it simple, avoid overengineering, and write clean, safe SQL! 📦🔌🚛
