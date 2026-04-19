import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import FPDashboard from './pages/FPDashboard';
import NGODashboard from './pages/NGODashboard';
import ListingDetail from './pages/ListingDetail';
import ChatWindow from './pages/ChatWindow';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/fp/dashboard" element={<FPDashboard />} />
        <Route path="/ngo/dashboard" element={<NGODashboard />} />
        <Route path="/listings/:id" element={<ListingDetail />} />
        <Route path="/chat" element={<ChatWindow />} />
        <Route path="/chat/:chatId" element={<ChatWindow />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
