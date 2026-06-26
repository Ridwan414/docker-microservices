import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import AppRoutes from './routes/AppRoutes.jsx';
import Navbar from './components/Navbar.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <main className="flex-1">
            <AppRoutes />
          </main>
          <footer className="border-t border-gray-200 py-4 text-center text-xs text-gray-500">
            Microservices Shop · React frontend for the FastAPI backend.
          </footer>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}