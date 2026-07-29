// import React, { useState } from 'react';
// import axios from 'axios';
// import { useNavigate } from 'react-router-dom';

// const Login = ({ setLoginUser }) => {
//   const navigate = useNavigate();
//   const [user, setUser] = useState({ email: '', password: '' });
//   const [error, setError] = useState('');
//   const [loading, setLoading] = useState(false);

//   const handleChange = (e) => {
//     const { name, value } = e.target;
//     setUser({ ...user, [name]: value });
//     setError(''); // Clear error on input change
//   };

//   const login = async (e) => {
//     e.preventDefault();
//     const { email, password } = user;

//     if (!email || !password) {
//       setError('All fields are required');
//       return;
//     }

//     try {
//       setLoading(true);
//       const response = await axios.post('http://localhost:8000/api/v1/user/login', user);
//       setLoginUser(response.data.user);
//       navigate('/'); // Redirect to the homepage
//     } catch (err) {
//       setError(err.response?.data?.message || 'Something went wrong. Please try again.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="flex justify-center items-center min-h-screen bg-gray-100">
//       <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
//         <h2 className="text-2xl font-bold text-center text-gray-700">Welcome Back</h2>
//         <p className="text-center text-gray-500 text-sm mb-6">Login to your account</p>

//         {error && (
//           <div className="bg-red-100 text-red-600 text-sm p-2 rounded mb-4">
//             {error}
//           </div>
//         )}

//         <form onSubmit={login}>
//           <div className="mb-4">
//             <label
//               htmlFor="email"
//               className="block text-sm font-medium text-gray-600"
//             >
//               Email
//             </label>
//             <input
//               type="email"
//               name="email"
//               id="email"
//               value={user.email}
//               onChange={handleChange}
//               className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
//               placeholder="Enter your email"
//             />
//           </div>

//           <div className="mb-4">
//             <label
//               htmlFor="password"
//               className="block text-sm font-medium text-gray-600"
//             >
//               Password
//             </label>
//             <input
//               type="password"
//               name="password"
//               id="password"
//               value={user.password}
//               onChange={handleChange}
//               className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
//               placeholder="Enter your password"
//             />
//           </div>

//           <div className="flex justify-between items-center mb-6">
//             <a
//               href="#"
//               className="text-sm text-purple-500 hover:underline"
//             >
//               Forgot Password?
//             </a>
//           </div>

//           <button
//             type="submit"
//             className={`w-full py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:outline-none ${
//               loading ? 'opacity-50 cursor-not-allowed' : ''
//             }`}
//             disabled={loading}
//           >
//             {loading ? 'Logging in...' : 'Login'}
//           </button>
//         </form>

//         <div className="mt-6 text-center">
//           <p className="text-sm text-gray-600">
//             Don’t have an account?{' '}
//             <a
//               href="#"
//               onClick={() => navigate('/register')}
//               className="text-purple-500 hover:underline"
//             >
//               Register
//             </a>
//           </p>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default Login;
