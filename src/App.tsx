import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Calendar from './pages/Calendar';
import Tasks from './pages/Tasks';
import Chat from './pages/Chat';
import Admin from './pages/Admin';
import Invitations from './pages/Invitations';
import Onboarding from './pages/Onboarding';
import { handleGoogleRedirect } from './lib/googleAuth';

handleGoogleRedirect();

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/welcome" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/calendar" replace />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="chat" element={<Chat />} />
            <Route path="admin" element={<Admin />} />
            <Route path="invitations" element={<Invitations />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
