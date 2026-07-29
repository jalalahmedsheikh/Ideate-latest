import { useState } from "react";
import axiosInstance from "./axiosInstance";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import Cookies from "js-cookie";
import { FaPoll, FaPenNib, FaPlus, FaTrash } from "react-icons/fa";

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 50px;
  padding: 20px;
  background-color: #111;
  border-radius: 12px;
  width: 95%;
  max-width: 600px;
  margin: 40px auto;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  border: 1px solid #222;
  
  @media (max-width: 768px) {
    width: 100%;
    padding: 15px;
    margin-top: 100px;
  }
`;

const Title = styled.h2`
  color: white;
  margin-bottom: 20px;
  font-weight: 700;
  
  @media (max-width: 768px) {
    font-size: 1.5rem;
  }
`;

const TabContainer = styled.div`
  display: flex;
  width: 100%;
  background-color: #1e1e1e;
  border-radius: 8px;
  padding: 4px;
  margin-bottom: 20px;
  border: 1px solid #333;
`;

const TabButton = styled.button`
  flex: 1;
  padding: 10px;
  border-radius: 6px;
  border: none;
  background-color: ${(props) => (props.active ? "rgb(40, 0, 65)" : "transparent")};
  color: ${(props) => (props.active ? "white" : "#888")};
  font-weight: 600;
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;

  &:hover {
    color: white;
    background-color: ${(props) => (props.active ? "rgb(40, 0, 65)" : "rgba(255, 255, 255, 0.05)")};
  }
`;

const FormContainer = styled.form`
  width: 100%;
  background-color: #1e1e1e;
  padding: 24px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  border: 1px solid #2a2a2a;
  
  @media (max-width: 768px) {
    padding: 16px;
  }
`;

const Label = styled.label`
  color: #aaa;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: -4px;
  text-align: left;
`;

const Input = styled.input`
  padding: 12px;
  font-size: 15px;
  border-radius: 8px;
  border: 1px solid #333;
  background-color: #2a2a2a;
  color: white;
  transition: border-color 0.2s;
  
  &:focus {
    outline: none;
    border-color: rgb(70, 0, 110);
  }
`;

const TextArea = styled.textarea`
  padding: 12px;
  font-size: 15px;
  border-radius: 8px;
  border: 1px solid #333;
  background-color: #2a2a2a;
  color: white;
  min-height: 150px;
  resize: vertical;
  transition: border-color 0.2s;
  
  &:focus {
    outline: none;
    border-color: rgb(70, 0, 110);
  }
`;

const OptionRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const DeleteBtn = styled.button`
  background: transparent;
  border: none;
  color: #ff4d4d;
  cursor: pointer;
  padding: 8px;
  font-size: 16px;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.8;
  }
`;

const AddOptionBtn = styled.button`
  background: transparent;
  border: 1px dashed rgb(70, 0, 110);
  color: rgb(150, 100, 200);
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.2s;

  &:hover {
    background-color: rgba(70, 0, 110, 0.1);
  }
`;

const Button = styled.button`
  padding: 12px;
  font-size: 16px;
  background-color: rgb(40, 0, 65);
  border: none;
  color: white;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: rgb(60, 0, 95);
  }
`;

const ErrorMessage = styled.div`
  color: #ff4d4d;
  background-color: rgba(255, 77, 77, 0.1);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 77, 77, 0.2);
  width: 100%;
  font-size: 14px;
  font-weight: 500;
`;

const SuccessMessage = styled.div`
  color: #2ecc71;
  background-color: rgba(46, 204, 113, 0.1);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(46, 204, 113, 0.2);
  width: 100%;
  font-size: 14px;
  font-weight: 500;
`;

export default function Create() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("post"); // 'post' or 'poll'

  // Post State
  const [caption, setCaption] = useState("");

  // Poll State
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]); // start with 2 options
  const [generatingOptions, setGeneratingOptions] = useState(false);

  // Status State
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGenerateAIOptions = async () => {
    if (!question.trim()) {
      setError("Please write a question first before requesting AI suggestions.");
      return;
    }
    setGeneratingOptions(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await axiosInstance.post("/ai/generate-options", { question });
      if (res.data.success && res.data.options) {
        setOptions(res.data.options);
        setSuccess("AI options suggested successfully!");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to generate AI options. Please write a clearer question.");
    } finally {
      setGeneratingOptions(false);
    }
  };

  const handleAddOption = () => {
    if (options.length < 5) {
      setOptions([...options, ""]);
    }
  };

  const handleRemoveOption = (indexToRemove) => {
    if (options.length > 2) {
      setOptions(options.filter((_, idx) => idx !== indexToRemove));
    }
  };

  const handleOptionChange = (idx, val) => {
    const nextOptions = [...options];
    nextOptions[idx] = val;
    setOptions(nextOptions);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (activeTab === "post") {
        if (!caption.trim()) {
          setError("Caption is required!");
          setLoading(false);
          return;
        }

        const response = await axiosInstance.post("/post/createPost", {
          caption,
        });

        if (response.status === 201 || response.data.success) {
          setSuccess("Post created successfully!");
          setTimeout(() => navigate("/"), 1500);
        }
      } else {
        // Create Poll
        if (!question.trim()) {
          setError("Poll question is required!");
          setLoading(false);
          return;
        }

        // Validate options
        const filteredOptions = options.map((opt) => opt.trim()).filter((opt) => opt !== "");
        if (filteredOptions.length < 2) {
          setError("At least 2 non-empty options are required!");
          setLoading(false);
          return;
        }

        const response = await axiosInstance.post("/poll/createPoll", {
          question,
          options: filteredOptions,
        });

        if (response.status === 201 || response.data.success) {
          setSuccess("Poll created successfully!");
          setTimeout(() => navigate("/"), 1500);
        }
      }
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message || `Failed to create ${activeTab}. Please check login.`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid bg-black min-vh-100 py-4">
      <PageContainer>
        <Title>Share Something New</Title>

        <TabContainer>
          <TabButton active={activeTab === "post"} onClick={() => setActiveTab("post")}>
            <FaPenNib /> Write Post
          </TabButton>
          <TabButton active={activeTab === "poll"} onClick={() => setActiveTab("poll")}>
            <FaPoll /> Create Poll
          </TabButton>
        </TabContainer>

        {error && <ErrorMessage className="mb-3">{error}</ErrorMessage>}
        {success && <SuccessMessage className="mb-3">{success}</SuccessMessage>}

        <FormContainer onSubmit={handleSubmit}>
          {activeTab === "post" ? (
            <>
              <Label>Caption</Label>
              <TextArea
                placeholder="What is on your mind?..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </>
          ) : (
            <>
              <Label>Poll Question</Label>
              <div style={{ display: "flex", gap: "10px", width: "100%" }}>
                <Input
                  style={{ flex: 1 }}
                  placeholder="Ask a question..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
                <Button 
                  type="button" 
                  onClick={handleGenerateAIOptions} 
                  disabled={generatingOptions}
                  style={{ fontSize: "14px", padding: "0 15px", whiteSpace: "nowrap", background: "linear-gradient(135deg, #fd1d1d, #833ab4)" }}
                >
                  {generatingOptions ? "Thinking..." : "✨ AI Options"}
                </Button>
              </div>

              <Label>Options</Label>
              {options.map((option, index) => (
                <OptionRow key={index}>
                  <Input
                    className="flex-grow-1"
                    placeholder={`Option ${index + 1}`}
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                  />
                  {options.length > 2 && (
                    <DeleteBtn type="button" onClick={() => handleRemoveOption(index)}>
                      <FaTrash />
                    </DeleteBtn>
                  )}
                </OptionRow>
              ))}

              {options.length < 5 && (
                <AddOptionBtn type="button" onClick={handleAddOption}>
                  <FaPlus /> Add Option
                </AddOptionBtn>
              )}
            </>
          )}

          <Button type="submit" disabled={loading}>
            {loading ? "Publishing..." : activeTab === "post" ? "Publish Post" : "Publish Poll"}
          </Button>
        </FormContainer>
      </PageContainer>
    </div>
  );
}
