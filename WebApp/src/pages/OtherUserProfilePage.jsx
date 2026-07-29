import { useEffect, useState, useContext } from "react";
import axiosInstance from './axiosInstance';
import styled, { createGlobalStyle, ThemeProvider } from "styled-components";
import '@fortawesome/fontawesome-free/css/all.min.css';
import { motion } from "framer-motion";
import { FaUserCircle, FaCheckCircle, FaUserPlus, FaUserMinus } from "react-icons/fa";
import { Link, useParams } from "react-router-dom";
import { UserContext } from "../contexts/UserContext";
import verifiedBadge from '../assets/images/verified.png';

const GlobalStyles = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: 'Outfit', sans-serif;
    background-color: #0b0b0f;
    color: white;
    overflow-x: hidden;
  }
`;

const theme = {
  primary: "rgb(40, 0, 65)",
  primaryHover: "rgb(60, 0, 95)",
  secondary: "#fd1d1d",
  darkBg: "#11111a",
  cardBg: "#1a1a24",
  textGray: "#888899",
};

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  background-color: #0b0b0f;
  padding-bottom: 50px;
  
  @media (max-width: 768px) {
    margin-top: 80px;
  }
`;

const HeaderContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  background: linear-gradient(180deg, #1b002c 0%, #0b0b0f 100%);
  color: white;
  padding: 40px 20px;
  width: 100%;
  border-bottom: 1px solid #1a1a26;
`;

const ProfileHeader = styled.div`
  max-width: 600px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
`;

const AvatarContainer = styled.div`
  width: 110px;
  height: 110px;
  border-radius: 50%;
  border: 3px solid rgb(120, 40, 180);
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #222;
  box-shadow: 0 8px 20px rgba(120, 40, 180, 0.3);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  svg {
    font-size: 80px;
    color: #444;
  }
`;

const NameInfo = styled.div`
  text-align: center;
  
  h1 {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .username {
    font-size: 14px;
    color: #888899;
    font-weight: 500;
  }

  .bio {
    font-size: 14px;
    color: #cccccc;
    margin-top: 12px;
    max-width: 450px;
    line-height: 1.5;
  }
`;

const Stats = styled.div`
  display: flex;
  justify-content: center;
  gap: 40px;
  margin-top: 24px;
  width: 100%;
  max-width: 450px;
  background-color: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 16px;
  border-radius: 12px;

  div {
    text-align: center;

    span {
      font-weight: 700;
      font-size: 18px;
      color: white;
    }

    p {
      font-size: 12px;
      color: #888899;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  }
`;

const FollowBtn = styled.button`
  margin-top: 20px;
  padding: 10px 32px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 24px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease-in-out;
  background-color: ${(props) => (props.isFollowing ? "rgba(255, 255, 255, 0.1)" : "rgb(120, 40, 180)")};
  color: white;
  border: 1px solid ${(props) => (props.isFollowing ? "rgba(255, 255, 255, 0.2)" : "transparent")};

  &:hover {
    background-color: ${(props) => (props.isFollowing ? "rgba(255, 255, 255, 0.15)" : "rgb(140, 60, 200)")};
    transform: translateY(-1px);
  }
`;

const TabsContainer = styled.div`
  margin: 30px auto;
  width: 90%;
  max-width: 600px;
`;

const TabsHeader = styled.div`
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-bottom: 24px;
  border-bottom: 1px solid #1a1a26;
  padding-bottom: 12px;

  button {
    padding: 8px 20px;
    border: none;
    background: transparent;
    color: #888899;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: 0.2s ease;
    position: relative;

    &.active {
      color: white;
      
      &::after {
        content: '';
        position: absolute;
        bottom: -13px;
        left: 0;
        right: 0;
        height: 2px;
        background-color: rgb(120, 40, 180);
      }
    }
  }
`;

const ContentGrid = styled(motion.div)`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  
  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const CreationCard = styled.div`
  background: #12121a;
  border: 1px solid #1e1e2d;
  border-radius: 12px;
  padding: 20px;
  color: white;
  min-height: 140px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: all 0.3s ease;
  text-align: left;

  &:hover {
    transform: translateY(-4px);
    border-color: rgb(120, 40, 180);
    box-shadow: 0 6px 16px rgba(120, 40, 180, 0.1);
  }

  p {
    font-size: 14px;
    line-height: 1.5;
    color: #e0e0e8;
  }

  .meta {
    font-size: 11px;
    color: #666677;
    margin-top: 12px;
  }
`;

export default function OtherUserProfilePage() {
  const { id } = useParams(); // 'id' matches App.js route param name
  const { user: currentUser } = useContext(UserContext);
  
  const [profileUser, setProfileUser] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("Creations");

  useEffect(() => {
    const fetchProfileData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [profileRes, postsRes] = await Promise.all([
          axiosInstance.get(`/user/profile/${id}`),
          axiosInstance.get(`/post/userpost/all/${id}`)
        ]);

        const u = profileRes.data.user;
        setProfileUser(u);
        setUserPosts(postsRes.data.posts || []);

        const isFollowingTarget = u.followers?.includes(currentUser?.user?._id);
        setIsFollowing(!!isFollowingTarget);
      } catch (err) {
        console.error("Error loading user profile:", err);
        setError("Failed to load user profile. Check back shortly.");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProfileData();
    }
  }, [id, currentUser]);

  const handleFollowToggle = async () => {
    if (!profileUser) return;
    const action = isFollowing ? "unfollow" : "follow";
    try {
      const response = await axiosInstance.post("/user/toggleFollow", {
        targetUserId: id,
        action
      });

      if (response.data.success) {
        setIsFollowing(!isFollowing);
        // Visual updates to statistics
        setProfileUser(prev => ({
          ...prev,
          followers: action === "follow"
            ? [...prev.followers, currentUser?.user?._id]
            : prev.followers.filter(fId => fId !== currentUser?.user?._id)
        }));
      }
    } catch (err) {
      console.error("Error toggling follow:", err);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <GlobalStyles />
        <div className="text-center mt-5 text-secondary">
          <h4>Loading profile...</h4>
        </div>
      </PageContainer>
    );
  }

  if (error || !profileUser) {
    return (
      <PageContainer>
        <GlobalStyles />
        <div className="text-center mt-5 text-danger">
          <h4>{error || "User not found"}</h4>
          <Link to="/" className="btn btn-outline-light rounded-pill px-4 mt-4 text-decoration-none">
            Back to Home
          </Link>
        </div>
      </PageContainer>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <PageContainer>
        <GlobalStyles />
        <HeaderContainer>
          <ProfileHeader>
            <AvatarContainer>
              {profileUser.profileImage ? (
                <img src={profileUser.profileImage} alt={profileUser.username} />
              ) : (
                <FaUserCircle />
              )}
            </AvatarContainer>
            
            <NameInfo>
              <h1>
                {profileUser.name || "Ideate User"}
                {profileUser.isverified && (
                  <img
                    src={verifiedBadge}
                    alt="Verified"
                    style={{ width: '20px', height: '20px' }}
                  />
                )}
              </h1>
              <div className="username">@{profileUser.username}</div>
              {profileUser.bio && <p className="bio">{profileUser.bio}</p>}
            </NameInfo>

            {currentUser?.user?._id !== id && (
              <FollowBtn isFollowing={isFollowing} onClick={handleFollowToggle}>
                {isFollowing ? (
                  <>
                    <FaUserMinus /> Unfollow
                  </>
                ) : (
                  <>
                    <FaUserPlus /> Follow
                  </>
                )}
              </FollowBtn>
            )}

            <Stats>
              <div>
                <span>{profileUser.followers?.length || 0}</span>
                <p>Followers</p>
              </div>
              <div>
                <span>{profileUser.followings?.length || 0}</span>
                <p>Following</p>
              </div>
              <div>
                <span>{userPosts.length}</span>
                <p>Posts</p>
              </div>
            </Stats>
          </ProfileHeader>
        </HeaderContainer>

        <TabsContainer>
          <TabsHeader>
            <button
              className={activeTab === "Creations" ? "active" : ""}
              onClick={() => setActiveTab("Creations")}
            >
              Creations
            </button>
          </TabsHeader>

          <ContentGrid
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            {userPosts.length === 0 ? (
              <div className="text-center w-100 mt-4 text-secondary col-span-full">
                No creations shared yet.
              </div>
            ) : (
              userPosts.map((post) => (
                <Link to={`/post/${post._id}`} key={post._id} className="text-decoration-none">
                  <CreationCard>
                    <p>{post.caption.length > 80 ? post.caption.slice(0, 80) + "..." : post.caption}</p>
                    <div className="meta">
                      {new Date(post.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>
                  </CreationCard>
                </Link>
              ))
            )}
          </ContentGrid>
        </TabsContainer>
      </PageContainer>
    </ThemeProvider>
  );
}
