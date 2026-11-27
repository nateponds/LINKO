import { useAuth } from "../../auth/AuthProvider";
import { formatRoleLabel } from "../../auth/roleAccess";

export default function BusinessSwitcher() {
  const { businesses, activeBusinessId, setActiveBusiness } = useAuth();

  return (
    <select
      className="business-switcher"
      aria-label="Active business"
      value={activeBusinessId ?? ""}
      onChange={(event) => setActiveBusiness(event.target.value)}
    >
      {businesses.map((business) => (
        <option key={business.business_id} value={business.business_id}>
          {business.business_name} ({business.roles.map(formatRoleLabel).join(", ")})
        </option>
      ))}
    </select>
  );
}
