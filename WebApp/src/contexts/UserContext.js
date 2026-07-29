import { useState, useEffect, createContext } from 'react';
import axiosInstance from '../pages/axiosInstance';

// Create the UserContext
export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Handle loading state
  const [error, setError] = useState(null); // Handle error state

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        // Make the GET request to fetch the user profile data
        const response = await axiosInstance.get('/user/profile');

        // Assuming the API returns the user data
        setUser(response.data);
      } catch (err) {
        setError('Failed to fetch user profile');
        console.error('Error fetching user profile:', err);
      } finally {
        setLoading(false); // Stop loading after the request is completed
      }
    };

    fetchUserProfile();
  }, []); // Empty dependency array, so it runs only once on mount

  return (
    <UserContext.Provider value={{ user, loading, error }}>
      {children}
    </UserContext.Provider>
  );
};
