import { useState, useEffect } from "react";
import axiosInstance from './axiosInstance';
import styled, { createGlobalStyle, ThemeProvider } from "styled-components";
import { FaUserCircle } from "react-icons/fa";
import { useNavigate } from "react-router-dom";  // Use useNavigate instead of useHistory

// Global Styles
const GlobalStyles = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: 'Poppins', sans-serif;
    background-color: rgb(37, 37, 37);
    color: white;
    overflow-x: hidden;
  }
`;

// Theme
const theme = {
  primary: "rgb(40, 0, 65)",
  secondary: "#fd1d1d",
  lightGray: "#f1f1f1",
};

// Styled Components
const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const HeaderContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  background: linear-gradient(135deg, #000, rgb(40, 0, 65));
  color: white;
  padding: 1rem 2rem 2rem 2rem;
  border-radius: 0 0 20px 20px;
  width: 100%;
`;

const Avatar = styled.div`
  margin-top: -50px;
  font-size: 100px;

  @media (max-width: 768px) {
    font-size: 80px;
  }
`;

const Info = styled.div`
  text-align: center;
  margin-top: 10px;

  h1 {
    font-size: 2rem;
    margin: 0.5rem 0;
  }

  p {
    font-size: 1rem;
    opacity: 0.8;
  }
`;

const Stats = styled.div`
  display: flex;
  gap: 2rem;
  margin-top: 1rem;

  div {
    text-align: center;

    span {
      font-weight: bold;
      font-size: 1.2rem;
    }

    p {
      font-size: 0.9rem;
    }
  }
`;

const FormContainer = styled.div`
  width: 100%;
  max-width: 600px;
  padding: 2rem;
  background-color: #222;
  border-radius: 10px;
  margin-top: 2rem;
`;

const InputField = styled.input`
  width: 100%;
  padding: 1rem;
  margin-bottom: 1rem;
  background-color: #444;
  color: white;
  border: 1px solid #333;
  border-radius: 10px;
  font-size: 1rem;

  &:focus {
    border-color: ${(props) => props.theme.primary};
    outline: none;
  }
`;

const ProfileImage = styled.img`
  width: 100px;
  height: 100px;
  border-radius: 50%;
  object-fit: cover;
  margin-top: 1rem;
`;

const SaveButton = styled.button`
  width: 100%;
  padding: 1rem;
  background-color: ${(props) => props.theme.primary};
  color: white;
  border: none;
  font-size: 1.1rem;
  border-radius: 10px;
  cursor: pointer;
  margin-top: 1rem;

  &:hover {
    background-color: ${(props) => props.theme.secondary};
  }
`;

export default function EditProfile() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [profileImage, setProfileImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [error, setError] = useState(null);
  const navigate = useNavigate();  // Use useNavigate for redirection

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axiosInstance.get('http://localhost:8000/user/profile'); // Fetch user data
        setUser(response.data.user);
        setName(response.data.user.name);
        setImagePreview(response.data.user.profileImage);
      } catch (err) {
        setError("Failed to fetch user data.");
      }
    };
    fetchProfile();
  }, []);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("name", name);
    if (profileImage) {
      formData.append("profilePhoto", profileImage);
    }

    try {
      const response = await axiosInstance.put('http://localhost:8000/user/profile/update', formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      if (response.data.success) {
        alert("Profile updated successfully!");
        navigate("/myprofile"); // Use navigate for redirection
      } else {
        setError(response.data.message);
      }
    } catch (err) {
      setError("An error occurred while updating your profile.");
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfileImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  if (error) {
    return <div>{error}</div>;
  }

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <ThemeProvider theme={theme}>
      <PageContainer>
        <GlobalStyles />
        <HeaderContainer>
          <h4 className="mb-5 text-uppercase ">
            <a href="" className="text-decoration-none text-white text-center">
              {user.name || "Unknown"}
            </a>
          </h4>
          <Avatar>
            <FaUserCircle />
          </Avatar>
          <Info>
            <h4>
              <a href="" className="text-decoration-none text-white text-center">
                @{user.username}
              </a>
            </h4>
            <p>{user.bio}</p>
          </Info>
        </HeaderContainer>

        <FormContainer>
          <h3>Edit Profile</h3>
          <form onSubmit={handleProfileUpdate}>
            <InputField
              type="text"
              value={name}
              className="mb-5"
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              required
            />
            <div className="w-100 text-center">
              {imagePreview ? (
                <ProfileImage src={imagePreview} alt="Profile Preview" />
              ) : (
                <Avatar>
                  <FaUserCircle />
                </Avatar>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{ marginTop: "1rem" }}
              />
            </div>
            <SaveButton type="submit">Save Changes</SaveButton>
          </form>
        </FormContainer>
      </PageContainer>
    </ThemeProvider>
  );
}
