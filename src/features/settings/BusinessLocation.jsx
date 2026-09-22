import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { apiGet, apiSend } from "../../lib/api";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import LocationModal from "./LocationModal";
import { addressBookCopy, formatAddress } from "./addressCopy";
import { CheckCircle2, AlertCircle, MapPin } from "lucide-react";

function deleteBlockReason(address, count) {
  if (count <= 1) return "Add another address before deleting the last one";
  if (address.is_default) return "Set another address as the default before deleting this one";
  return null;
}

export default function BusinessLocation() {
  const { activeBusiness, activeBusinessId, refreshAuth } = useAuth();
  const copy = addressBookCopy(activeBusiness);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [editor, setEditor] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const loadAddresses = useCallback(async () => {
    const data = await apiGet("/api/settings/addresses");
    setAddresses(Array.isArray(data.addresses) ? data.addresses : []);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await apiGet("/api/settings/addresses");
        if (!active) return;
        setAddresses(Array.isArray(data.addresses) ? data.addresses : []);
      } catch (err) {
        if (active) {
          setAddresses([]);
          setLoadError(err.message);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [activeBusinessId]);

  async function afterChange(message) {
    setNotice(message);
    setActionError(null);
    await refreshAuth();
    await loadAddresses();
  }

  async function makeDefault(address) {
    setActionError(null);
    try {
      await apiSend(`/api/settings/addresses/${address.address_id}/default`, { method: "POST" });
      await afterChange(`${address.label} is now the default ${copy.noun}.`);
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function removeAddress(address) {
    setActionError(null);
    try {
      await apiSend(`/api/settings/addresses/${address.address_id}`, { method: "DELETE" });
      await afterChange(`${address.label} removed.`);
    } catch (err) {
      setActionError(err.message);
    }
  }

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2>{copy.heading}</h2>
        <p>{copy.intro}</p>
      </div>

      {notice && (
        <div role="status" aria-live="polite" className="settings-alert settings-alert-success">
          {notice}
        </div>
      )}
      {actionError && (
        <div role="alert" className="settings-alert settings-alert-error">
          {actionError}
        </div>
      )}

      <div className="settings-card">
        <div className="settings-card-body">
          {loading ? (
            <p className="location-context">Loading addresses…</p>
          ) : loadError ? (
            <p className="location-context">{loadError}</p>
          ) : addresses.length === 0 ? (
            <p className="location-context">No addresses yet. Add one to pin this business.</p>
          ) : (
            <ul className="address-list">
              {addresses.map((address) => {
                const blocked = deleteBlockReason(address, addresses.length);
                const line = formatAddress(address);
                return (
                  <li key={address.address_id} className="address-row">
                    <div className="address-row-main">
                      <div className="address-row-title">
                        <MapPin size={16} />
                        <strong>{address.label}</strong>
                        {address.is_default && <span className="pill pill-success">Default</span>}
                        {address.has_coordinates ? (
                          <span className="pill pill-success">
                            <CheckCircle2 size={14} /> Pinned
                          </span>
                        ) : (
                          <span className="pill pill-warning">
                            <AlertCircle size={14} /> Not pinned
                          </span>
                        )}
                      </div>
                      <p className="location-context">{line || "No street details yet"}</p>
                    </div>
                    <div className="address-row-actions">
                      <button
                        type="button"
                        className="settings-btn settings-btn-outline"
                        onClick={() => {
                          setNotice(null);
                          setEditor({ mode: "edit", address });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="settings-btn settings-btn-outline"
                        disabled={address.is_default}
                        onClick={() => { void makeDefault(address); }}
                      >
                        Set default
                      </button>
                      <button
                        type="button"
                        className="settings-btn settings-btn-danger"
                        disabled={Boolean(blocked)}
                        title={blocked ?? "Delete this address"}
                        onClick={() => setConfirm({
                          title: `Delete ${address.label}?`,
                          message: "This removes the address from the book. The default pin is unchanged.",
                          confirmLabel: "Delete address",
                          onConfirm: () => { void removeAddress(address); },
                        })}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="location-actions">
            <button
              type="button"
              className="settings-btn settings-btn-primary"
              onClick={() => {
                setNotice(null);
                setEditor({ mode: "add", address: null });
              }}
            >
              {copy.add}
            </button>
          </div>
        </div>
      </div>

      {editor && (
        <LocationModal
          key={editor.address?.address_id ?? "new"}
          open
          address={editor.address}
          onClose={() => setEditor(null)}
          onSaved={async (saved) => {
            setEditor(null);
            await afterChange(
              editor.mode === "add"
                ? `${saved.label} added.`
                : `${saved.label} updated.`,
            );
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        onConfirm={() => { confirm?.onConfirm?.(); setConfirm(null); }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
