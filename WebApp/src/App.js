import React, { useState, useEffect } from 'react';
import './App.css';
import { Routes, Route, Navigate } from 'react-router-dom';
import Auth from './components/Auth/Auth';
import MyNavbar from './components/MyNavbar'; // Make sure it's used here
import Home from './pages/Home';
import Followings from './pages/Followings';
import Create from './pages/Create';
import Updates from './pages/Updates';
import Profile from './pages/Profile';
import Cookies from 'js-cookie'; // We'll use js-cookie to read cookies
import EditProfile from './pages/EditProfile';
import OtherUserProfilePage from './pages/OtherUserProfilePage';
import PostPage from './pages/PostPage';
import AdminDashboard from './pages/AdminDashboard';
import { UserProvider } from './contexts/UserContext';
import { SocketProvider } from './contexts/SocketContext';

function App() {
  const [user, setLoginUser] = useState(null);


  // Check if the JWT token exists in cookies or localStorage on initial load
  useEffect(() => {
    const token = Cookies.get('token') || localStorage.getItem('token');
    // if (token) {
    // Optionally, you could decode the token to extract user data
    //setLoginUser(decodeJwt(token)); // assuming decodeJwt is a function to decode the token
    // }
  }, []);

  // A helper function to protect routes
  const ProtectedRoute = ({ element }) => {
    const token = Cookies.get('token') || localStorage.getItem('token');
    // If no token is found, redirect to Auth page
    return token ? element : <Navigate to="/auth" />;
  };

  return (
    <div className="App">
      <UserProvider>
        <SocketProvider>
          <Routes>
            <Route element={<MyNavbar />}>
              <Route path="/" element={<Home />} />
              <Route path="/followings" element={<ProtectedRoute element={<Followings />} />} />
              <Route path="/create" element={<ProtectedRoute element={<Create />} />} />
              <Route path="/updates" element={<ProtectedRoute element={<Updates />} />} />
              <Route path="/myprofile" element={<ProtectedRoute element={<Profile />} />} />
              <Route path="/editprofile" element={<ProtectedRoute element={<EditProfile />} />} />
              <Route path='/user/:id' element={<OtherUserProfilePage />} />
              <Route path="/post/:id" element={<PostPage />} />
              <Route path="/admin" element={<ProtectedRoute element={<AdminDashboard />} />} />

            </Route>

            <Route path="/auth" element={<Auth setLoginUser={setLoginUser} />} />
          </Routes>
        </SocketProvider>
      </UserProvider>
    </div>
  );
}

export default App;


