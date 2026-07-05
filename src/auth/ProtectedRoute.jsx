import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

function AuthLoading() {
  return <div>Loading...</div>;
}

export default function ProtectedRoute({ roles, redirectTo = "/dashboard" }) {
  const location = useLocation();
  const { loading, user, hasAnyRole } = useAuth();

  if (loading) {
    return <AuthLoading />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (Array.isArray(roles) && roles.length > 0 && !hasAnyRole(roles)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}
