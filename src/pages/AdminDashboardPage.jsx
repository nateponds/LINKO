import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mutatingId, setMutatingId] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [userData, businessData] = await Promise.all([
        apiGet("/api/admin/users"),
        apiGet("/api/admin/businesses"),
      ]);
      setUsers(Array.isArray(userData) ? userData : []);
      setBusinesses(Array.isArray(businessData) ? businessData : []);
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
        const [userData, businessData] = await Promise.all([
          apiGet("/api/admin/users"),
          apiGet("/api/admin/businesses"),
        ]);
        if (active) {
          setUsers(Array.isArray(userData) ? userData : []);
          setBusinesses(Array.isArray(businessData) ? businessData : []);
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

  const businessOptions = useMemo(
    () =>
      businesses.map((business) => ({
        id: business.id,
        name: business.name,
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
          entry.id === userId ? { ...entry, ...updated } : entry,
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
          entry.id === businessId ? { ...entry, ...updated } : entry,
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
    const needsBusiness = form.kind !== "platform_admin";

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
              {form.kind !== "platform_admin" ? (
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
                    const busy = mutatingId === `user-${entry.id}`;
                    return (
                      <tr key={entry.id}>
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
                              toggleUserActive(entry.id, !entry.is_active)
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
                    const busy = mutatingId === `business-${business.id}`;
                    return (
                      <tr key={business.id}>
                        <td>
                          <strong>{business.name}</strong>
                        </td>
                        <td>{business.type ?? "—"}</td>
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
                                business.id,
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
