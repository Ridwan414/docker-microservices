import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Wraps a route element so unauthenticated users are sent to /login
// while preserving where they were trying to go.
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, ready } = useAuth();
  const location = useLocation();
  if (!ready) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center text-gray-500">Loading…</div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}