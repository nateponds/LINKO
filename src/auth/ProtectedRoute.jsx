import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { redirectPathForRoles } from "./roleAccess";

function AuthLoading() {
  return <div>Loading...</div>;
}

export default function ProtectedRoute({ roles, redirectTo }) {
  const location = useLocation();
  const { loading, user, activeBusinessId, activeRoles, hasAnyRole } = useAuth();

  if (loading) {
    return <AuthLoading />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Route unauthorized for the active business (e.g. after a business switch)
  // redirects to that context's mapped default, unless an explicit target is
  // given. This is the only redirect a switch triggers; an authorized route
  // stays put.
  if (Array.isArray(roles) && roles.length > 0 && !hasAnyRole(roles)) {
    const target =
      redirectTo ?? redirectPathForRoles(activeRoles, user.global_role === "platform_admin");
    return <Navigate to={target} replace />;
  }

  // Remount the routed subtree on business switch so all business-scoped local
  // state clears and every page's mount fetch re-fires against the new header.
  return <Outlet key={activeBusinessId ?? "none"} />;
}
