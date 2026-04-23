import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { isDemoMode } from "@/lib/demoMode";

export const RequireTeacher = ({ children }: { children: JSX.Element }) => {
  const { loading, user } = useAuth();
  const location = useLocation();

  if (isDemoMode) return children;

  if (loading) return null;

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/teacher/login?next=${next}`} replace />;
  }

  return children;
};
