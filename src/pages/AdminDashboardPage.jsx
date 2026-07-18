import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import { apiGet, apiSend } from "../lib/api";
import { shortDate } from "../lib/format";
import { formatRoleLabel } from "../auth/roleAccess";
import "./AdminDashboardPage.css";

const USER_KINDS = [
  { value: "logistics_coordinator", label: "Logistics Coordinator" },
  { value: "courier", label: "Courier" },
  { value: "platform_admin", label: "Platform Admin" },
];

const EMPTY_FORM = {
  full_name: "",
  email: "",
  password: "",
  kind: "logistics_coordinator",
  business_id: "",
  phone_number: "",
  vehicle_type: "",
  assigned_branch_id: "",
};

function membershipSummary(memberships) {
  if (!Array.isArray(memberships) || memberships.length === 0) {
    return "—";
  }
  return memberships
    .map(
      (membership) =>
        `${membership.business_name ?? "Business"} (${formatRoleLabel(membership.role)})`,
    )
    .join(", ");
}

function memberSummary(members) {
  if (!Array.isArray(members) || members.length === 0) {
    return "—";
  }
  return members
    .map(
      (member) =>
        `${member.full_name ?? member.email ?? "Member"} (${formatRoleLabel(member.role)})`,
    )
    .join(", ");
}

export default function AdminDashboardPage() {
  const [users, setUsers] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mutatingId, setMutatingId] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [creating, setCreating] = useState(false);

  const navigate = useNavigate();

  const [lookupId, setLookupId] = useState("");
  const [cancelId, setCancelId] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [cancelSuccess, setCancelSuccess] = useState(null);

  function submitLookup(event) {
    event.preventDefault();
    const id = lookupId.trim();
    if (!id) {
      return;
    }
    navigate(`/logistics/${id}`);
  }

  async function submitCancel(event) {
    event.preventDefault();
    setCancelError(null);
    setCancelSuccess(null);

    const id = cancelId.trim();
    const reason = cancelReason.trim();
    if (!id || !reason) {
      setCancelError("Parcel ID and reason are required.");
      return;
    }

    setCancelBusy(true);
    try {
      await apiSend(`/api/parcels/${id}/tracking`, {
        method: "POST",
        body: { status_update: "Cancelled", remarks: reason },
      });
      setCancelSuccess(`Parcel ${id} cancelled.`);
      setCancelId("");
      setCancelReason("");
    } catch (caughtError) {
      setCancelError(caughtError.message);
    } finally {
      setCancelBusy(false);
    }
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [userData, businessData, branchData] = await Promise.all([
        apiGet("/api/admin/users"),
        apiGet("/api/admin/businesses"),
        apiGet("/api/branches"),
      ]);
      setUsers(Array.isArray(userData) ? userData : []);
      setBusinesses(Array.isArray(businessData) ? businessData : []);
      setBranches(Array.isArray(branchData) ? branchData : []);
    } catch (caughtError) {
      setError(caughtError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [userData, businessData, branchData] = await Promise.all([
          apiGet("/api/admin/users"),
          apiGet("/api/admin/businesses"),
          apiGet("/api/branches"),
        ]);
        if (active) {
          setUsers(Array.isArray(userData) ? userData : []);
          setBusinesses(Array.isArray(businessData) ? businessData : []);
          setBranches(Array.isArray(branchData) ? branchData : []);
        }
      } catch (caughtError) {
        if (active) {
          setError(caughtError.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  // Only logistics orgs can take a coordinator. Filtered here rather than in
  // the API because /api/admin/businesses also feeds the businesses table and
  // its verify toggle, which need every business.
  const businessOptions = useMemo(
    () =>
      businesses
        .filter((business) => business.business_type === "logistics")
        .map((business) => ({
          id: business.business_id,
          name: business.business_name,
        })),
    [businesses],
  );

  async function toggleUserActive(userId, nextActive) {
    setMutatingId(`user-${userId}`);
    setError(null);

    try {
      const updated = await apiSend(`/api/admin/users/${userId}`, {
        method: "PATCH",
        body: { is_active: nextActive },
      });
      setUsers((current) =>
        current.map((entry) =>
          entry.user_id === userId ? { ...entry, ...updated } : entry,
        ),
      );
      void loadData();
    } catch (caughtError) {
      setError(caughtError.message);
    } finally {
      setMutatingId(null);
    }
  }

  async function toggleBusinessVerified(businessId, nextVerified) {
    setMutatingId(`business-${businessId}`);
    setError(null);

    try {
      const updated = await apiSend(`/api/admin/businesses/${businessId}`, {
        method: "PATCH",
        body: { is_verified: nextVerified },
      });
      setBusinesses((current) =>
        current.map((entry) =>
          entry.business_id === businessId ? { ...entry, ...updated } : entry,
        ),
      );
      void loadData();
    } catch (caughtError) {
      setError(caughtError.message);
    } finally {
      setMutatingId(null);
    }
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitCreate(event) {
    event.preventDefault();
    setFormError(null);

    const fullName = form.full_name.trim();
    const email = form.email.trim();
    const password = form.password;
    // Couriers auto-attach to the canonical logistics org server-side.
    const needsBusiness = form.kind === "logistics_coordinator";

    if (!fullName || !email || !password) {
      setFormError("Full name, email, and password are required.");
      return;
    }
    if (needsBusiness && !form.business_id) {
      setFormError("Select a business for this role.");
      return;
    }

    const body = {
      full_name: fullName,
      email,
      password,
      kind: form.kind,
    };
    if (needsBusiness) {
      body.business_id = Number(form.business_id);
    }
    if (form.kind === "courier") {
      const phone = form.phone_number.trim();
      const vehicle = form.vehicle_type.trim();
      if (phone) body.phone_number = phone;
      if (vehicle) body.vehicle_type = vehicle;
      if (form.assigned_branch_id) {
        body.assigned_branch_id = Number(form.assigned_branch_id);
      }
    }

    setCreating(true);
    try {
      await apiSend("/api/admin/users", { method: "POST", body });
      setForm(EMPTY_FORM);
      void loadData();
    } catch (caughtError) {
      setFormError(caughtError.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <AppLayout>
      <div className="admin-page">
        <div className="page-head">
          <h1>Admin</h1>
        </div>

        {error ? (
          <div className="page-empty admin-error">
            Could not load admin data: {error}
          </div>
        ) : null}

        <section className="admin-section">
          <div className="admin-section-head">
            <h2>Customer Service Tools</h2>
          </div>

          <div className="cs-tools-grid">
            <div className="admin-create-form">
              <h3 className="cs-tool-title">Parcel lookup</h3>
              <form onSubmit={submitLookup}>
                <div className="admin-form-grid">
                  <label>
                    <span>Parcel ID</span>
                    <input
                      type="text"
                      value={lookupId}
                      onChange={(event) => setLookupId(event.target.value)}
                      placeholder="LKO-00000001"
                    />
                  </label>
                </div>
                <div className="admin-form-actions">
                  <button type="submit" className="admin-primary-btn">
                    Open parcel
                  </button>
                </div>
              </form>
            </div>

            <div className="admin-create-form">
              <h3 className="cs-tool-title">Quick Cancel</h3>
              <form onSubmit={submitCancel}>
                <div className="admin-form-grid">
                  <label>
                    <span>Parcel ID</span>
                    <input
                      type="text"
                      value={cancelId}
                      onChange={(event) => setCancelId(event.target.value)}
                      placeholder="LKO-00000001"
                    />
                  </label>
                  <label>
                    <span>Reason</span>
                    <input
                      type="text"
                      value={cancelReason}
                      onChange={(event) => setCancelReason(event.target.value)}
                      placeholder="Customer request"
                    />
                  </label>
                </div>
                <div className="admin-form-actions">
                  {cancelError ? (
                    <span className="admin-form-error">{cancelError}</span>
                  ) : null}
                  {cancelSuccess ? (
                    <span className="admin-form-success">{cancelSuccess}</span>
                  ) : null}
                  <button
                    type="submit"
                    className="admin-primary-btn"
                    disabled={cancelBusy}
                  >
                    {cancelBusy ? "Cancelling…" : "Cancel parcel"}
                  </button>
                </div>
              </form>
            </div>

            <div className="admin-create-form">
              <h3 className="cs-tool-title">Reassign courier</h3>
              <p className="cs-tool-text">
                Courier reassignment is logged with a delivery event — open the
                parcel and use Log Delivery Event.
              </p>
              <div className="cs-tool-links">
                <Link to="/logistics">Parcel list</Link>
                <Link to="/logistics/management">Logistics management</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-head">
            <h2>Users</h2>
          </div>

          <form className="admin-create-form" onSubmit={submitCreate}>
            <div className="admin-form-grid">
              <label>
                <span>Full name</span>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(event) => updateForm("full_name", event.target.value)}
                  placeholder="Jane Dela Cruz"
                />
              </label>
              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateForm("email", event.target.value)}
                  placeholder="user@linko.test"
                />
              </label>
              <label>
                <span>Password</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => updateForm("password", event.target.value)}
                  placeholder="Temporary password"
                />
              </label>
              <label>
                <span>Role</span>
                <select
                  value={form.kind}
                  onChange={(event) => updateForm("kind", event.target.value)}
                >
                  {USER_KINDS.map((kind) => (
                    <option key={kind.value} value={kind.value}>
                      {kind.label}
                    </option>
                  ))}
                </select>
              </label>
              {form.kind === "logistics_coordinator" ? (
                <label>
                  <span>Business</span>
                  <select
                    value={form.business_id}
                    onChange={(event) =>
                      updateForm("business_id", event.target.value)
                    }
                  >
                    <option value="">Select a business…</option>
                    {businessOptions.map((business) => (
                      <option key={business.id} value={business.id}>
                        {business.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {form.kind === "courier" ? (
                <>
                  <label>
                    <span>Phone</span>
                    <input
                      type="text"
                      value={form.phone_number}
                      onChange={(event) =>
                        updateForm("phone_number", event.target.value)
                      }
                      placeholder="+639170000000"
                    />
                  </label>
                  <label>
                    <span>Vehicle</span>
                    <input
                      type="text"
                      value={form.vehicle_type}
                      onChange={(event) =>
                        updateForm("vehicle_type", event.target.value)
                      }
                      placeholder="Motorcycle"
                    />
                  </label>
                  <label>
                    <span>Branch</span>
                    <select
                      value={form.assigned_branch_id}
                      onChange={(event) =>
                        updateForm("assigned_branch_id", event.target.value)
                      }
                    >
                      <option value="">No branch</option>
                      {branches.map((branch) => (
                        <option key={branch.branch_id} value={branch.branch_id}>
                          {branch.branch_name}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
            </div>
            <div className="admin-form-actions">
              {formError ? (
                <span className="admin-form-error">{formError}</span>
              ) : null}
              <button
                type="submit"
                className="admin-primary-btn"
                disabled={creating}
              >
                {creating ? "Creating…" : "Create user"}
              </button>
            </div>
          </form>

          <div className="table-card">
            {loading ? (
              <div className="page-empty">Loading users…</div>
            ) : users.length === 0 ? (
              <div className="page-empty">No users yet.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Global Role</th>
                    <th>Memberships</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((entry) => {
                    const busy = mutatingId === `user-${entry.user_id}`;
                    return (
                      <tr key={entry.user_id}>
                        <td>
                          <strong>{entry.full_name ?? "—"}</strong>
                        </td>
                        <td>{entry.email}</td>
                        <td>
                          {entry.global_role
                            ? formatRoleLabel(entry.global_role)
                            : "—"}
                        </td>
                        <td className="admin-memberships">
                          {membershipSummary(entry.memberships)}
                        </td>
                        <td>
                          <span
                            className={`status ${entry.is_active ? "notified" : "cancelled"}`}
                          >
                            {entry.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>{shortDate(entry.created_at)}</td>
                        <td>
                          <button
                            type="button"
                            className="admin-action-btn"
                            disabled={busy}
                            onClick={() =>
                              toggleUserActive(entry.user_id, !entry.is_active)
                            }
                          >
                            {busy
                              ? "Updating…"
                              : entry.is_active
                                ? "Deactivate"
                                : "Reactivate"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-head">
            <h2>Businesses</h2>
          </div>

          <div className="table-card">
            {loading ? (
              <div className="page-empty">Loading businesses…</div>
            ) : businesses.length === 0 ? (
              <div className="page-empty">No businesses yet.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Members</th>
                    <th>Verified</th>
                    <th>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {businesses.map((business) => {
                    const busy = mutatingId === `business-${business.business_id}`;
                    return (
                      <tr key={business.business_id}>
                        <td>
                          <strong>{business.business_name}</strong>
                        </td>
                        <td>{business.business_type ?? "—"}</td>
                        <td className="admin-memberships">
                          {memberSummary(business.members)}
                        </td>
                        <td>
                          <span
                            className={`status ${business.is_verified ? "notified" : "waiting"}`}
                          >
                            {business.is_verified ? "Verified" : "Unverified"}
                          </span>
                        </td>
                        <td>{shortDate(business.created_at)}</td>
                        <td>
                          <button
                            type="button"
                            className="admin-action-btn"
                            disabled={busy}
                            onClick={() =>
                              toggleBusinessVerified(
                                business.business_id,
                                !business.is_verified,
                              )
                            }
                          >
                            {busy
                              ? "Updating…"
                              : business.is_verified
                                ? "Unverify"
                                : "Verify"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
