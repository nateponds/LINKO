import { useAuth } from "../../auth/AuthProvider";

export default function Profile() {
  const { user, activeBusiness } = useAuth();
  
  const getInitials = (name) => {
    return name ? name.charAt(0).toUpperCase() : "?";
  };

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2>Profile</h2>
        <p>Manage your account identity and personal details.</p>
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
          <button className="settings-btn settings-btn-outline" disabled>
            Edit Profile &middot; Coming soon
          </button>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card-header">
          <h3>Personal Information</h3>
        </div>
        <div className="settings-card-body">
          <div className="settings-info-grid">
            <div className="settings-info-group">
              <label>Full Name</label>
              <p>{user?.full_name}</p>
            </div>
            <div className="settings-info-group">
              <label>Email Address</label>
              <p>{user?.email}</p>
            </div>
            <div className="settings-info-group">
              <label>Active Business</label>
              <p>{activeBusiness ? activeBusiness.business_name : "None"}</p>
            </div>
            <div className="settings-info-group">
              <label>Current Role</label>
              <p className="role-badge">{user?.global_role === 'platform_admin' ? 'Admin' : 'User'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
