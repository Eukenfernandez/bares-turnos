import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1612] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#c4a77d] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#c4a77d] font-medium">Cargando...</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
