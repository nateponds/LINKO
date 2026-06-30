// inventory.js
// Drives the inventory table from a JS data array (no hard-coded rows in HTML).

let inventory = [
  { id: "A2G51", sku: "A2G51", name: "Something Product Name", price: 200, category: "General", stock: 100, notes: "" },
  { id: "AF41W", sku: "AF41W", name: "Something Product Name", price: 200, category: "General", stock: 0, notes: "" }
];

const tbody = document.getElementById("inventoryBody");
const searchInput = document.getElementById("searchInput");

let activeFilters = { category: "", priceMin: null, priceMax: null, stock: "" };

function statusFor(stock) {
  if (stock <= 0) return { label: "Out of Stock", cls: "out-of-stock" };
  if (stock <= 10) return { label: "Low on Stock", cls: "low-on-stock" };
  return { label: "In Stock", cls: "in-stock" };
}

function refreshCategoryOptions() {
  const select = document.getElementById("filterCategory");
  const current = select.value;
  const categories = [...new Set(inventory.map(i => i.category).filter(Boolean))].sort();

  select.innerHTML = `<option value="">All categories</option>` +
    categories.map(c => `<option value="${c}">${c}</option>`).join("");

  if (categories.includes(current)) select.value = current;
}

function matchesFilters(item) {
  if (activeFilters.category && item.category !== activeFilters.category) return false;
  if (activeFilters.priceMin !== null && item.price < activeFilters.priceMin) return false;
  if (activeFilters.priceMax !== null && item.price > activeFilters.priceMax) return false;
  if (activeFilters.stock) {
    const s = statusFor(item.stock);
    if (activeFilters.stock === "in" && s.cls !== "in-stock") return false;
    if (activeFilters.stock === "low" && s.cls !== "low-on-stock") return false;
    if (activeFilters.stock === "out" && s.cls !== "out-of-stock") return false;
  }
  return true;
}

function renderTable(filterText = "") {
  refreshCategoryOptions();
  tbody.innerHTML = "";
  const term = filterText.trim().toLowerCase();

  inventory
    .filter(item =>
      (!term ||
        item.name.toLowerCase().includes(term) ||
        item.sku.toLowerCase().includes(term) ||
        (item.category || "").toLowerCase().includes(term)) &&
      matchesFilters(item)
    )
    .forEach(item => {
      const status = statusFor(item.stock);
      const tr = document.createElement("tr");
      tr.dataset.id = item.id;

      tr.innerHTML = `
        <td><input type="checkbox" class="row-select"></td>
        <td><div class="thumb-box"></div></td>
        <td>${item.sku}</td>
        <td><strong>${item.name}</strong></td>
        <td>₱${Number(item.price).toFixed(2)}</td>
        <td class="stock-cell">
          <input type="checkbox" class="stock-edit-checkbox" title="Edit stock">
          <span class="stock-value">${item.stock}</span>
        </td>
        <td><span class="status ${status.cls}">${status.label}</span></td>
      `;

      tbody.appendChild(tr);
    });
}

searchInput.addEventListener("input", () => renderTable(searchInput.value));

/* ---------- Add / Edit item modal ---------- */

const itemModal = document.getElementById("itemModal");
const modalTitle = document.getElementById("modalTitle");
const itemForm = document.getElementById("itemForm");
const itemIdField = document.getElementById("itemId");
const fieldSku = document.getElementById("fieldSku");
const fieldName = document.getElementById("fieldName");
const fieldPrice = document.getElementById("fieldPrice");
const fieldCategory = document.getElementById("fieldCategory");
const fieldStock = document.getElementById("fieldStock");
const fieldNotes = document.getElementById("fieldNotes");

function openModal({ editing = false, item = null } = {}) {
  itemForm.reset();
  if (editing && item) {
    modalTitle.textContent = "Edit Item";
    itemIdField.value = item.id;
    fieldSku.value = item.sku;
    fieldName.value = item.name;
    fieldPrice.value = item.price;
    fieldCategory.value = item.category;
    fieldStock.value = item.stock;
    fieldNotes.value = item.notes;
  } else {
    modalTitle.textContent = "Add Item";
    itemIdField.value = "";
  }
  itemModal.classList.add("open");
}

function closeModal() {
  itemModal.classList.remove("open");
}

document.getElementById("openAddItem").addEventListener("click", () => openModal());
document.getElementById("closeItemModal").addEventListener("click", closeModal);
document.getElementById("cancelItemModal").addEventListener("click", closeModal);
itemModal.addEventListener("click", e => {
  if (e.target === itemModal) closeModal();
});

itemForm.addEventListener("submit", e => {
  e.preventDefault();

  const sku = fieldSku.value.trim();
  const existingId = itemIdField.value;

  const newItem = {
    id: existingId || sku,
    sku,
    name: fieldName.value.trim(),
    price: parseFloat(fieldPrice.value) || 0,
    category: fieldCategory.value.trim(),
    stock: parseInt(fieldStock.value, 10) || 0,
    notes: fieldNotes.value.trim()
  };

  if (existingId) {
    const idx = inventory.findIndex(i => i.id === existingId);
    if (idx !== -1) inventory[idx] = newItem;
  } else {
    inventory.push(newItem);
  }

  closeModal();
  renderTable(searchInput.value);
});

/* ---------- Inline stock edit (checkbox next to stock) ---------- */

const stockPopover = document.getElementById("stockEditPopover");
const stockEditInput = document.getElementById("stockEditInput");
let activeStockRowId = null;

tbody.addEventListener("change", e => {
  if (!e.target.classList.contains("stock-edit-checkbox")) return;

  const tr = e.target.closest("tr");
  const id = tr.dataset.id;

  if (e.target.checked) {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    activeStockRowId = id;
    stockEditInput.value = item.stock;

    const rect = e.target.getBoundingClientRect();
    stockPopover.style.top = `${window.scrollY + rect.bottom + 6}px`;
    stockPopover.style.left = `${window.scrollX + rect.left}px`;
    stockPopover.classList.add("open");
  } else {
    stockPopover.classList.remove("open");
    activeStockRowId = null;
  }
});

document.getElementById("stockEditSave").addEventListener("click", () => {
  if (!activeStockRowId) return;
  const item = inventory.find(i => i.id === activeStockRowId);
  if (item) {
    item.stock = parseInt(stockEditInput.value, 10) || 0;
  }
  stockPopover.classList.remove("open");
  activeStockRowId = null;
  renderTable(searchInput.value);
});

document.getElementById("stockEditCancel").addEventListener("click", () => {
  stockPopover.classList.remove("open");
  activeStockRowId = null;
  renderTable(searchInput.value);
});

/* ---------- Click a row's name/SKU cell to edit the full item ---------- */

tbody.addEventListener("dblclick", e => {
  const tr = e.target.closest("tr");
  if (!tr) return;
  const item = inventory.find(i => i.id === tr.dataset.id);
  if (item) openModal({ editing: true, item });
});

/* ---------- Filter panel ---------- */

const filterBtn = document.getElementById("filterBtn");
const filterPanel = document.getElementById("filterPanel");

filterBtn.addEventListener("click", e => {
  e.stopPropagation();
  filterPanel.classList.toggle("open");
});

filterPanel.addEventListener("click", e => e.stopPropagation());

document.addEventListener("click", () => {
  filterPanel.classList.remove("open");
});

document.getElementById("applyFilters").addEventListener("click", () => {
  activeFilters = {
    category: document.getElementById("filterCategory").value,
    priceMin: document.getElementById("filterPriceMin").value === "" ? null : parseFloat(document.getElementById("filterPriceMin").value),
    priceMax: document.getElementById("filterPriceMax").value === "" ? null : parseFloat(document.getElementById("filterPriceMax").value),
    stock: document.getElementById("filterStock").value
  };
  filterPanel.classList.remove("open");
  renderTable(searchInput.value);
});

document.getElementById("clearFilters").addEventListener("click", () => {
  activeFilters = { category: "", priceMin: null, priceMax: null, stock: "" };
  document.getElementById("filterCategory").value = "";
  document.getElementById("filterPriceMin").value = "";
  document.getElementById("filterPriceMax").value = "";
  document.getElementById("filterStock").value = "";
  renderTable(searchInput.value);
});

/* ---------- Initial render ---------- */
renderTable();
