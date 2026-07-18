import assert from "node:assert/strict";
import { readFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const personasFile = path.join(__dirname, "personas.json");
const personasExampleFile = path.join(__dirname, "personas.example.json");
const errorsLogFile = path.join(__dirname, ".seed-unknown-errors.jsonl");

// Known error messages from backend routes
const KNOWN_ERRORS = [
  "Pin your business location in Settings before placing orders",
  "Pin your business location in Settings before shipping orders",
  "Email already registered",
  "all order items must come from one wholesaler",
  "all order items must reference active products",
  "business_id is required",
  "buyer and wholesaler businesses must be different",
  "insufficient stock to accept order",
  "latitude and longitude must be provided together",
  "latitude and longitude must be finite numbers"
];

// Helper to run assert-based payload validations
function runSelfCheck() {
  console.log("Running seeder payload self-check...");
  
  const sampleWholesaler = {
    business_name: "Test Wholesaler",
    business_type: "wholesaler",
    full_name: "Test Owner",
    email_local_part: "test.owner",
    contact_number: "+639170000000",
    province: "Metro Manila",
    city_municipality: "Manila",
    barangay: "Intramuros",
    street_address: "123 Street",
    postal_code: "1002",
    latitude: 14.5908,
    longitude: 120.9734,
    products: [
      {
        product_name: "Test Product",
        description: "Test Desc",
        sku: "TEST-SKU",
        category_hint: "Produce"
      }
    ]
  };

  // 1. Assert Registration Payload
  const regPayload = {
    email: `${sampleWholesaler.email_local_part}+test@linko.test`,
    password: "Password123!",
    full_name: sampleWholesaler.full_name,
    business_name: sampleWholesaler.business_name,
    business_type: sampleWholesaler.business_type
  };
  assert.ok(regPayload.email.includes("@linko.test"), "Email must be valid");
  assert.equal(regPayload.password, "Password123!", "Password must be Password123!");
  assert.ok(regPayload.full_name, "Full name must be present");
  assert.ok(regPayload.business_name, "Business name must be present");
  assert.ok(["buyer", "wholesaler"].includes(regPayload.business_type), "Business type must be buyer or wholesaler");

  // 2. Assert Location Payload
  const locPayload = {
    province: sampleWholesaler.province,
    city_municipality: sampleWholesaler.city_municipality,
    barangay: sampleWholesaler.barangay,
    street_address: sampleWholesaler.street_address,
    postal_code: sampleWholesaler.postal_code,
    latitude: sampleWholesaler.latitude,
    longitude: sampleWholesaler.longitude
  };
  assert.ok(locPayload.province, "province must be non-empty");
  assert.ok(locPayload.city_municipality, "city_municipality must be non-empty");
  assert.ok(locPayload.barangay, "barangay must be non-empty");
  assert.ok(locPayload.street_address, "street_address must be non-empty");
  assert.ok(locPayload.postal_code, "postal_code must be non-empty");
  assert.ok(typeof locPayload.latitude === "number", "latitude must be number");
  assert.ok(typeof locPayload.longitude === "number", "longitude must be number");

  // 3. Assert Order Payload
  const jitteredQty = Math.floor(Math.random() * 50) + 1; // 1-50
  const orderPayload = {
    items: [
      {
        product_id: 101, // Mock product ID
        quantity: jitteredQty
      }
    ],
    tier_id: 2
  };
  assert.ok(Array.isArray(orderPayload.items) && orderPayload.items.length > 0, "items must be non-empty array");
  assert.ok(orderPayload.items[0].product_id > 0, "product_id must be > 0");
  assert.ok(orderPayload.items[0].quantity >= 1 && orderPayload.items[0].quantity <= 50, "quantity must be 1-50");
  assert.ok([1, 2, 3].includes(orderPayload.tier_id), "tier_id must be 1, 2, or 3");

  // 4. Assert Ship Payload (with weight jitter)
  const jitteredWeight = Number((Math.random() * 24.5 + 0.5).toFixed(2)); // 0.5 - 25
  const shipPayload = {
    status: "shipped",
    weight_kg: jitteredWeight
  };
  assert.equal(shipPayload.status, "shipped");
  assert.ok(shipPayload.weight_kg >= 0.5 && shipPayload.weight_kg <= 25, "weight_kg must be 0.5-25");

  console.log("Seeder payload self-check PASSED!");
}

// Fixed-size Promise Pool
async function runWithPool(tasks, concurrency) {
  const results = [];
  const executing = new Set();
  for (const task of tasks) {
    const p = Promise.resolve().then(() => task());
    results.push(p);
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
}

// Extract Cookie helper
function getCookie(response) {
  const setCookie = response.headers.getSetCookie 
    ? response.headers.getSetCookie() 
    : [response.headers.get('set-cookie')].filter(Boolean);
  
  for (const cookieStr of setCookie) {
    if (cookieStr.includes('linko_session=')) {
      return cookieStr.split(';')[0];
    }
  }
  return null;
}

// Generate Jitters
const getJitteredWeight = () => Number((Math.random() * 24.5 + 0.5).toFixed(2)); // 0.5-25 kg
const getJitteredQty = () => Math.floor(Math.random() * 50) + 1; // 1-50
const getJitteredStock = () => Math.floor(Math.random() * 480) + 20; // 20-500
const getJitteredPrice = () => Math.floor(Math.random() * 4950) + 50; // 50-5000

// Main Seeding Entry
async function main() {
  const args = process.argv.slice(2);
  const countArg = args.find(a => a.startsWith('--count=') || a === '--count');
  const depthArg = args.find(a => a.startsWith('--depth=') || a === '--depth');
  const baseUrlArg = args.find(a => a.startsWith('--base-url=') || a === '--base-url');
  const concurrencyArg = args.find(a => a.startsWith('--concurrency=') || a === '--concurrency');
  const force = args.includes('--force');
  const dryRun = args.includes('--dry-run');

  let count = null;
  if (countArg) {
    if (countArg.includes('=')) {
      count = parseInt(countArg.split('=')[1], 10);
    } else {
      const idx = args.indexOf('--count');
      count = parseInt(args[idx + 1], 10);
    }
  }

  let depth = 'delivered';
  if (depthArg) {
    if (depthArg.includes('=')) {
      depth = depthArg.split('=')[1];
    } else {
      const idx = args.indexOf('--depth');
      depth = args[idx + 1];
    }
  }

  let baseUrl = 'http://localhost:5001';
  if (baseUrlArg) {
    if (baseUrlArg.includes('=')) {
      baseUrl = baseUrlArg.split('=')[1];
    } else {
      const idx = args.indexOf('--base-url');
      baseUrl = args[idx + 1];
    }
  }

  let concurrency = 8;
  if (concurrencyArg) {
    let parsedVal;
    if (concurrencyArg.includes('=')) {
      parsedVal = parseInt(concurrencyArg.split('=')[1], 10);
    } else {
      const idx = args.indexOf('--concurrency');
      parsedVal = parseInt(args[idx + 1], 10);
    }
    if (!Number.isNaN(parsedVal)) {
      concurrency = parsedVal;
    }
  }

  // 1. Self Check
  runSelfCheck();

  // 2. Production Guards
  if (process.env.NODE_ENV === 'production' && !force) {
    console.error("Refusing to seed: NODE_ENV=production. Demo data must not touch production.\n" +
                  "If you really mean to, re-run with --force.");
    process.exit(1);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(baseUrl);
  } catch (err) {
    console.error(`Invalid --base-url: ${baseUrl}`);
    process.exit(1);
  }

  const isLocalhost = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
  if (!isLocalhost && !force) {
    console.error(`Refusing to target non-localhost URL: ${baseUrl}.\n` +
                  "If you really mean to, re-run with --force.");
    process.exit(1);
  }

  // 3. Load Personas
  let personasRaw;
  try {
    personasRaw = await readFile(personasFile, "utf8");
  } catch (err) {
    console.error(`\nError: personas.json is absent.\n` +
                  `Please copy ${personasExampleFile} to ${personasFile} or generate it with your AI.\n` +
                  `Exiting.`);
    process.exit(1);
  }

  let personas;
  try {
    personas = JSON.parse(personasRaw);
  } catch (err) {
    console.error("Error parsing personas.json:", err.message);
    process.exit(1);
  }

  const desiredCount = count !== null ? count : personas.length;
  const targetPersonas = [];
  for (let i = 0; i < desiredCount; i++) {
    const original = personas[i % personas.length];
    targetPersonas.push({
      ...JSON.parse(JSON.stringify(original)),
      originalIndex: i % personas.length,
      runIndex: i
    });
  }

  console.log(`Loaded ${personas.length} personas. Preparing to run ${desiredCount} target entities...`);

  // Dry-run implementation
  if (dryRun) {
    console.log("\n================ DRY-RUN MODE ================");
    console.log(`Depth: ${depth}`);
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Concurrency: ${concurrency}`);
    console.log("Transforming personas to would-be payloads...\n");

    for (const persona of targetPersonas) {
      console.log(`👉 Persona #${persona.runIndex} (${persona.business_type}): ${persona.business_name}`);
      const suffix = `+dr_${persona.runIndex}`;
      const email = `${persona.email_local_part}${suffix}@linko.test`;

      console.log(`  [POST] /api/auth/register -> email: ${email}, name: ${persona.full_name}, business: ${persona.business_name} #${persona.runIndex}`);
      console.log(`  [PUT] /api/settings/location -> province: ${persona.province}, city: ${persona.city_municipality}, coords: (${persona.latitude}, ${persona.longitude})`);

      if (persona.business_type === 'wholesaler') {
        if (persona.products && persona.products.length) {
          for (const p of persona.products) {
            console.log(`  [POST] /api/products -> product: ${p.product_name}, sku: ${p.sku}, category_hint: ${p.category_hint}, unit_price: [Jittered], stock_quantity: [Jittered]`);
          }
        }
      } else if (persona.business_type === 'buyer') {
        if (depth !== 'locations') {
          console.log(`  [POST] /api/orders -> buying product from wholesaler (matching hint: ${persona.pairing_hint || 'random'}), qty: [Jittered], tier_id: [Random]`);
          if (depth !== 'orders') {
            console.log("  [PATCH] /api/orders/:id/status -> status: accepted (as Wholesaler)");
            console.log("  [PATCH] /api/orders/:id/status -> status: preparing (as Wholesaler)");
            console.log(`  [PATCH] /api/orders/:id/status -> status: shipped, weight_kg: [Jittered] (as Wholesaler)`);
            if (depth !== 'shipped') {
              console.log("  [POST] /api/parcels/:id/tracking -> status sequence (as logistics coordinator):");
              console.log("    - Picked Up");
              console.log("    - Arrived at Branch");
              console.log("    - Departed Branch");
              console.log("    - Out for Delivery");
              console.log("    - Delivered (90%) OR Delivery Failed -> Arrived at Branch -> Out for Return -> Returned (10%)");
            }
          }
        }
      }
      console.log("");
    }
    console.log("Dry-run complete. No HTTP requests were sent.");
    return;
  }

  // 4. Test Liveness of API
  try {
    const healthCheck = await fetch(`${baseUrl}/health`);
    if (!healthCheck.ok) {
      throw new Error(`Health status: ${healthCheck.status}`);
    }
  } catch (err) {
    console.error(`\nError: Linko backend is not reachable at ${baseUrl}.\n` +
                  "Please ensure the backend server is running (e.g. npm start) before executing the seeder.\n" +
                  `Details: ${err.message}`);
    process.exit(1);
  }

  // Generate a unique run identifier to guarantee no email collisions
  const runId = Math.floor(Math.random() * 900000) + 100000;

  // 5. Shared State & Registry
  let coordinatorCookie = null;
  let activeCategories = [];
  let activeTiers = [];
  let activeCouriers = [];
  let activeBranches = [];

  // Statistics counters
  let wholesalersRegistered = 0;
  let buyersRegistered = 0;
  let locationsSet = 0;
  let productsCreated = 0;
  let ordersPlaced = 0;
  let ordersAccepted = 0;
  let ordersShipped = 0;
  let parcelsDelivered = 0;
  let parcelsReturned = 0;
  let errorsEncountered = 0;

  const wholesalerProducts = new Map(); // business_name -> Array of { product_id, product_name }
  const wholesalerCookies = new Map(); // business_name -> Cookie string

  // Logger & classification
  async function handleError(persona, step, payload, response, errorMsg = null) {
    errorsEncountered++;
    let status = response ? response.status : 500;
    let message = errorMsg;
    if (!message && response) {
      try {
        const errData = await response.json();
        message = errData.error?.message || errData.message || response.statusText;
      } catch (err) {
        message = response.statusText;
      }
    }
    message = message || "Unknown error";

    // Check against known errors
    const isKnown = KNOWN_ERRORS.some(k => message.includes(k));
    if (isKnown) {
      console.log(`   ⚠️ [Known Error] Step '${step}': ${message}`);
    } else {
      console.log(`   ❌ [Unknown Error] Step '${step}': ${message}. Logged to .seed-unknown-errors.jsonl`);
      const errorLogLine = JSON.stringify({
        timestamp: new Date().toISOString(),
        persona: persona ? { business_name: persona.business_name, email_local_part: persona.email_local_part } : null,
        step,
        payload,
        status,
        message
      }) + "\n";
      await appendFile(errorsLogFile, errorLogLine, "utf8").catch(err => {
        console.error("Failed to write to error log file:", err.message);
      });
    }
    return message;
  }

  // 6. Setup Logistics Coordinator & Fetch reference data
  console.log("\nLogging in as logistics coordinator...");
  try {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // dev_seed.sql demo accounts share the plaintext password "password"
      // (hash at seeds/dev_seed.sql). NOT "Password123!" — that is what the API
      // seeder sets on the personas it registers, a different account set.
      body: JSON.stringify({ email: 'logistics@linko.test', password: 'Password123!' })
    });
    if (!loginRes.ok) {
      throw new Error(`Login failed with status ${loginRes.status}. Run npm run seed:demo first.`);
    }
    coordinatorCookie = getCookie(loginRes);
    if (!coordinatorCookie) {
      throw new Error("No session cookie returned for coordinator.");
    }

    // Fetch categories
    const catRes = await fetch(`${baseUrl}/api/categories`, { headers: { Cookie: coordinatorCookie } });
    activeCategories = await catRes.json();
    if (!activeCategories.length) {
      throw new Error("No categories found in target DB. Seed Reference categories first.");
    }

    // Fetch service tiers
    const tierRes = await fetch(`${baseUrl}/api/service-tiers`, { headers: { Cookie: coordinatorCookie } });
    activeTiers = await tierRes.json();
    if (!activeTiers.length) {
      throw new Error("No service tiers found in target DB.");
    }

    // Fetch couriers
    const courierRes = await fetch(`${baseUrl}/api/couriers`, { headers: { Cookie: coordinatorCookie } });
    activeCouriers = await courierRes.json();

    // Fetch branches
    const branchRes = await fetch(`${baseUrl}/api/branches`, { headers: { Cookie: coordinatorCookie } });
    activeBranches = await branchRes.json();

    // Tracking scans (default depth) need an active courier and branch. Hard-stop
    // if either is empty — same contract as categories/tiers above. Prevents the
    // silent courier_id/branch_id guessing that produced 400s on every scan.
    if (depth === 'delivered') {
      if (!Array.isArray(activeCouriers) || !activeCouriers.length) {
        throw new Error("No active couriers in target DB. Run npm run seed:demo first (need a courier for tracking scans), or use --depth shipped.");
      }
      if (!Array.isArray(activeBranches) || !activeBranches.length) {
        throw new Error("No active branches in target DB. Run npm run seed:demo first (need a branch for tracking scans), or use --depth shipped.");
      }
    }

    console.log("Logistics coordinator logged in. Reference data loaded.");
  } catch (err) {
    console.error(`\nError setting up coordinator: ${err.message}`);
    process.exit(1);
  }

  // Helper to map category_hint to real category_id
  function resolveCategoryId(hint) {
    if (!hint) return activeCategories[0]?.category_id;
    const match = activeCategories.find(c => c.category_name.toLowerCase() === hint.toLowerCase());
    return match ? match.category_id : activeCategories[0]?.category_id;
  }

  // 7. Phase 1: Process Wholesalers
  const wholesalers = targetPersonas.filter(p => p.business_type === 'wholesaler');
  console.log(`\n--- PHASE 1: Processing ${wholesalers.length} Wholesalers ---`);

  const wholesalerTasks = wholesalers.map(persona => async () => {
    const email = `${persona.email_local_part}+w${runId}_${persona.runIndex}@linko.test`;
    const uniqueBusinessName = `${persona.business_name} #${persona.runIndex}`;
    console.log(`[Wholesaler] Registering: ${uniqueBusinessName} (${email})...`);

    // Step 1: Register
    const regPayload = {
      email,
      password: "Password123!",
      full_name: persona.full_name,
      business_name: uniqueBusinessName,
      business_type: 'wholesaler'
    };

    let response;
    try {
      response = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regPayload)
      });
      if (!response.ok) {
        await handleError(persona, 'register', regPayload, response);
        return;
      }
    } catch (err) {
      await handleError(persona, 'register', regPayload, null, err.message);
      return;
    }

    wholesalersRegistered++;
    const cookie = getCookie(response);
    if (!cookie) {
      console.error(`   No session cookie for Wholesaler: ${uniqueBusinessName}`);
      return;
    }
    wholesalerCookies.set(uniqueBusinessName, cookie);

    // Step 2: Set Location
    const locPayload = {
      province: persona.province,
      city_municipality: persona.city_municipality,
      barangay: persona.barangay,
      street_address: persona.street_address,
      postal_code: persona.postal_code,
      latitude: persona.latitude,
      longitude: persona.longitude
    };

    try {
      const locRes = await fetch(`${baseUrl}/api/settings/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookie
        },
        body: JSON.stringify(locPayload)
      });
      if (!locRes.ok) {
        await handleError(persona, 'location', locPayload, locRes);
        return;
      }
      locationsSet++;
    } catch (err) {
      await handleError(persona, 'location', locPayload, null, err.message);
      return;
    }

    // Step 3: Create Products
    const productsList = persona.products || [];
    const createdProducts = [];
    for (const p of productsList) {
      const categoryId = resolveCategoryId(p.category_hint);
      const unitPrice = getJitteredPrice();
      const stockQuantity = getJitteredStock();

      const prodPayload = {
        product_name: p.product_name,
        unit_price: unitPrice,
        sku: `${p.sku || 'SKU'}-${runId}-${persona.runIndex}`,
        description: p.description || "Fresh stock direct from wholesaler.",
        category_id: categoryId,
        stock_quantity: stockQuantity
      };

      try {
        const prodRes = await fetch(`${baseUrl}/api/products`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': cookie
          },
          body: JSON.stringify(prodPayload)
        });
        if (prodRes.ok) {
          const created = await prodRes.json();
          createdProducts.push({
            product_id: created.product_id,
            product_name: created.product_name
          });
          productsCreated++;
        } else {
          await handleError(persona, 'product', prodPayload, prodRes);
        }
      } catch (err) {
        await handleError(persona, 'product', prodPayload, null, err.message);
      }
    }

    if (createdProducts.length > 0) {
      wholesalerProducts.set(uniqueBusinessName, createdProducts);
    }
  });

  await runWithPool(wholesalerTasks, concurrency);

  // 8. Phase 2: Process Buyers
  const buyers = targetPersonas.filter(p => p.business_type === 'buyer');
  console.log(`\n--- PHASE 2: Processing ${buyers.length} Buyers ---`);

  const buyerTasks = buyers.map(persona => async () => {
    const email = `${persona.email_local_part}+b${runId}_${persona.runIndex}@linko.test`;
    const uniqueBusinessName = `${persona.business_name} #${persona.runIndex}`;
    console.log(`[Buyer] Registering: ${uniqueBusinessName} (${email})...`);

    // Step 1: Register
    const regPayload = {
      email,
      password: "Password123!",
      full_name: persona.full_name,
      business_name: uniqueBusinessName,
      business_type: 'buyer'
    };

    let response;
    try {
      response = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regPayload)
      });
      if (!response.ok) {
        await handleError(persona, 'register', regPayload, response);
        return;
      }
    } catch (err) {
      await handleError(persona, 'register', regPayload, null, err.message);
      return;
    }

    buyersRegistered++;
    const cookie = getCookie(response);
    if (!cookie) {
      console.error(`   No session cookie for Buyer: ${uniqueBusinessName}`);
      return;
    }

    // Step 2: Set Location
    const locPayload = {
      province: persona.province,
      city_municipality: persona.city_municipality,
      barangay: persona.barangay,
      street_address: persona.street_address,
      postal_code: persona.postal_code,
      latitude: persona.latitude,
      longitude: persona.longitude
    };

    try {
      const locRes = await fetch(`${baseUrl}/api/settings/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookie
        },
        body: JSON.stringify(locPayload)
      });
      if (!locRes.ok) {
        await handleError(persona, 'location', locPayload, locRes);
        return;
      }
      locationsSet++;
    } catch (err) {
      await handleError(persona, 'location', locPayload, null, err.message);
      return;
    }

    // Depth Gate
    if (depth === 'locations') return;

    // Step 3: Place Order
    // Find paired Wholesaler
    let chosenWholesalerName = null;
    let productsToBuy = [];

    // Look for pairing_hint matching wholesaler's original business name
    if (persona.pairing_hint) {
      // Find wholesaler whose name matches the hint
      for (const wName of wholesalerProducts.keys()) {
        if (wName.startsWith(persona.pairing_hint)) {
          chosenWholesalerName = wName;
          productsToBuy = wholesalerProducts.get(wName);
          break;
        }
      }
    }

    // Fallback: pick any registered wholesaler with products
    if (productsToBuy.length === 0) {
      const keys = Array.from(wholesalerProducts.keys());
      if (keys.length > 0) {
        chosenWholesalerName = keys[Math.floor(Math.random() * keys.length)];
        productsToBuy = wholesalerProducts.get(chosenWholesalerName);
      }
    }

    if (productsToBuy.length === 0) {
      console.log(`   ⚠️ [Skip Order] Buyer ${uniqueBusinessName} has no registered wholesaler with products to buy.`);
      return;
    }

    const targetProduct = productsToBuy[Math.floor(Math.random() * productsToBuy.length)];
    const chosenQty = getJitteredQty();
    const chosenTier = activeTiers[Math.floor(Math.random() * activeTiers.length)]?.tier_id || 1;

    const orderPayload = {
      items: [
        {
          product_id: targetProduct.product_id,
          quantity: chosenQty
        }
      ],
      tier_id: chosenTier
    };

    let order;
    try {
      const orderRes = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookie
        },
        body: JSON.stringify(orderPayload)
      });
      if (!orderRes.ok) {
        await handleError(persona, 'order', orderPayload, orderRes);
        return;
      }
      order = await orderRes.json();
      ordersPlaced++;
    } catch (err) {
      await handleError(persona, 'order', orderPayload, null, err.message);
      return;
    }

    // Depth Gate
    if (depth === 'orders') return;

    // Step 4: Wholesaler Accepts Order
    const wholesalerCookie = wholesalerCookies.get(chosenWholesalerName);
    if (!wholesalerCookie) {
      console.error(`   Missing Wholesaler cookie to accept order for ${chosenWholesalerName}`);
      return;
    }

    const acceptPayload = { status: 'accepted' };
    try {
      const acceptRes = await fetch(`${baseUrl}/api/orders/${order.order_id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': wholesalerCookie
        },
        body: JSON.stringify(acceptPayload)
      });
      if (!acceptRes.ok) {
        await handleError(persona, 'order_accept', acceptPayload, acceptRes);
        return;
      }
      ordersAccepted++;
    } catch (err) {
      await handleError(persona, 'order_accept', acceptPayload, null, err.message);
      return;
    }

    // Step 4.5: Wholesaler Prepares Order
    const preparingPayload = { status: 'preparing' };
    try {
      const preparingRes = await fetch(`${baseUrl}/api/orders/${order.order_id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': wholesalerCookie
        },
        body: JSON.stringify(preparingPayload)
      });
      if (!preparingRes.ok) {
        await handleError(persona, 'order_preparing', preparingPayload, preparingRes);
        return;
      }
    } catch (err) {
      await handleError(persona, 'order_preparing', preparingPayload, null, err.message);
      return;
    }

    // Step 5: Wholesaler Ships Order (Generates Parcel)
    const jitteredWeight = getJitteredWeight();
    const shipPayload = {
      status: 'shipped',
      weight_kg: jitteredWeight
    };

    let shippedOrder;
    try {
      const shipRes = await fetch(`${baseUrl}/api/orders/${order.order_id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': wholesalerCookie
        },
        body: JSON.stringify(shipPayload)
      });
      if (!shipRes.ok) {
        await handleError(persona, 'order_ship', shipPayload, shipRes);
        return;
      }
      shippedOrder = await shipRes.json();
      ordersShipped++;
    } catch (err) {
      await handleError(persona, 'order_ship', shipPayload, null, err.message);
      return;
    }

    // Depth Gate
    if (depth === 'shipped') return;

    // Step 6: Scan tracking sequence (as logistics coordinator)
    const parcelId = shippedOrder.parcel_id;
    if (!parcelId) {
      console.error(`   Order shipped successfully, but no parcel_id found in response.`);
      return;
    }

    const isReturnedOutcome = Math.random() < 0.1; // 10% chance of delivery failure and return
    // Reference data is guaranteed non-empty here (hard-stopped at setup for
    // depth 'delivered'), so no fallback guess — a guessed id could reference an
    // inactive courier and 400 every scan.
    const courierId = activeCouriers[Math.floor(Math.random() * activeCouriers.length)].courier_id;

    // The parcel's serving branch was assigned server-side at ship
    // (resolveInitialBranchId). Read it so branch scans carry a real branch_id
    // instead of null — null-branch 'Arrived at Branch' scans produce empty
    // auto-remarks and cannot enter a courier's branch pool (logistics.js).
    let parcelBranchId = null;
    try {
      const detailRes = await fetch(`${baseUrl}/api/parcels/${parcelId}`, {
        headers: { Cookie: coordinatorCookie }
      });
      if (detailRes.ok) {
        const detail = await detailRes.json();
        parcelBranchId =
          detail.latest_branch_id ??
          detail.planned_route?.find(s => s.branch_id)?.branch_id ??
          null;
      }
    } catch {
      // Non-fatal: fall back to null (scan handler carries the last branch).
    }

    const postScan = async (status, remarks) => {
      const scanPayload = {
        status_update: status,
        remarks,
        courier_id: courierId,
        branch_id: parcelBranchId
      };
      const scanRes = await fetch(`${baseUrl}/api/parcels/${parcelId}/tracking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': coordinatorCookie
        },
        body: JSON.stringify(scanPayload)
      });
      if (!scanRes.ok) {
        throw new Error(`Scan '${status}' failed: ${scanRes.statusText} (${scanRes.status})`);
      }
    };

    try {
      // 1. Picked Up
      await postScan('Picked Up', 'Parcel picked up from wholesaler.');

      // 2. Arrived at Branch
      await postScan('Arrived at Branch', 'Arrived at sorting facility.');

      // 3. Departed Branch
      await postScan('Departed Branch', 'Departed from sorting facility.');

      // 4. Out for Delivery
      await postScan('Out for Delivery', 'Parcel is out for delivery.');

      if (isReturnedOutcome) {
        // Delivery Failed -> Arrived at Branch -> Out for Return -> Returned
        await postScan('Delivery Failed', 'Bad address');
        await postScan('Arrived at Branch', 'Arrived at return branch facility.');
        await postScan('Out for Return', 'Out for return dispatch.');
        await postScan('Returned', 'Returned to sender.');
        parcelsReturned++;
      } else {
        // Delivered
        await postScan('Delivered', 'Delivered successfully.');
        parcelsDelivered++;
      }
    } catch (err) {
      await handleError(persona, 'tracking_scans', { parcelId }, null, err.message);
    }
  });

  await runWithPool(buyerTasks, concurrency);

  // 9. Report Results
  console.log("\n==============================================");
  console.log("             API SEEDER COMPLETED             ");
  console.log("==============================================");
  console.table({
    "Wholesalers Registered": wholesalersRegistered,
    "Buyers Registered": buyersRegistered,
    "Locations Pinned": locationsSet,
    "Products Created": productsCreated,
    "Orders Placed": ordersPlaced,
    "Orders Accepted": ordersAccepted,
    "Orders Shipped": ordersShipped,
    "Parcels Delivered": parcelsDelivered,
    "Parcels Returned": parcelsReturned,
    "Errors Encountered": errorsEncountered,
  });
}

main().catch(err => {
  console.error("Unhandled top-level error in API seeder runner:", err);
  process.exit(1);
});
