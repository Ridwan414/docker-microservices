import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const navClass = ({ isActive }) =>
    `px-3 py-2 rounded-md text-sm font-medium ${
      isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
    }`;

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
        <Link to="/" className="flex items-center gap-2 font-semibold text-brand-700">
          <span className="inline-block w-2 h-2 bg-brand-600 rounded-full" />
          Microservices Shop
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink to="/products" className={navClass}>
            Products
          </NavLink>
          {isAuthenticated && (
            <>
              <NavLink to="/orders" className={navClass}>
                My Orders
              </NavLink>
              <NavLink to="/profile" className={navClass}>
                Profile
              </NavLink>
              {user?.id != null && (
                <NavLink to="/inventory" className={navClass}>
                  Inventory
                </NavLink>
              )}
            </>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <span className="text-sm text-gray-600">
                {user?.first_name ? `Hi, ${user.first_name}` : user?.email}
              </span>
              <button onClick={handleLogout} className="btn-secondary text-sm">
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-gray-700 hover:text-gray-900">
                Sign in
              </Link>
              <Link to="/register" className="btn-primary text-sm">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}