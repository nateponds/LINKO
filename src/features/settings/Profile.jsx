import { useAuth } from "../../auth/AuthProvider";
import { formatRoleLabel } from "../../auth/roleAccess";

export default function Profile() {
  const { user, activeBusiness, activeRoles } = useAuth();
  
  const roleLabel = user?.global_role === "platform_admin"
    ? formatRoleLabel("platform_admin")
    : activeRoles.map(formatRoleLabel).join(", ") || "Member";

  const getInitials = (name) => {
    return name ? name.charAt(0).toUpperCase() : "?";
  };

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2>Profile</h2>
      </div>

      <div className="settings-card">
        <div className="settings-card-body profile-identity">
          <div className="profile-avatar">
            {getInitials(user?.full_name)}
          </div>
          <div className="profile-info">
            <h3>{user?.full_name}</h3>
            <p className="profile-email">{user?.email}</p>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card-body">
          <div className="settings-info-grid">
            <div className="settings-info-group">
              <label>Active Business</label>
              <p>{activeBusiness ? activeBusiness.business_name : "None"}</p>
            </div>
            <div className="settings-info-group">
              <label>Current Role</label>
              <p>{roleLabel}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
