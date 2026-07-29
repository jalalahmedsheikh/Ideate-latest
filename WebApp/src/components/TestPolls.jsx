import React, { useState, useEffect } from 'react';
import './App.css'; // Optional, for global styles (you can keep this file for styling)

function App() {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [votedPolls, setVotedPolls] = useState({});
  const [pollResults, setPollResults] = useState({});

  // Mock Poll Data (Replace with API call)
  useEffect(() => {
    setTimeout(() => {
      setPolls([
        {
          id: 1,
          question: 'What is your favorite programming language?',
          options: [
            { text: 'JavaScript', votes: 0 },
            { text: 'Python', votes: 0 },
            { text: 'C++', votes: 0 },
            { text: 'Java', votes: 0 },
          ],
        },
        {
          id: 2,
          question: 'Which front-end framework do you prefer?',
          options: [
            { text: 'React', votes: 0 },
            { text: 'Vue', votes: 0 },
            { text: 'Angular', votes: 0 },
            { text: 'Svelte', votes: 0 },
          ],
        },
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  // Handle vote logic
  const handleVote = (pollId, selectedOption) => {
    const updatedPolls = polls.map((poll) => {
      if (poll.id === pollId) {
        const updatedOptions = poll.options.map((option) => {
          if (option.text === selectedOption) {
            option.votes += 1;
          }
          return option;
        });
        poll.options = updatedOptions;
      }
      return poll;
    });

    setPolls(updatedPolls);
    setVotedPolls({
      ...votedPolls,
      [pollId]: selectedOption,
    });

    calculatePollResults(updatedPolls);
  };

  const calculatePollResults = (updatedPolls) => {
    const results = updatedPolls.reduce((acc, poll) => {
      const totalVotes = poll.options.reduce((sum, option) => sum + option.votes, 0);
      const optionsWithPercentages = poll.options.map((option) => {
        return {
          text: option.text,
          percentage: totalVotes === 0 ? 0 : ((option.votes / totalVotes) * 100).toFixed(2),
        };
      });
      acc[poll.id] = optionsWithPercentages;
      return acc;
    }, {});

    setPollResults(results);
  };

  return (
    <div className="app">
      <h1>Poll Feed</h1>
      {loading ? (
        <div>Loading polls...</div>
      ) : (
        <div className="poll-feed">
          {polls.map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              onVote={handleVote}
              votedOption={votedPolls[poll.id]}
              pollResults={pollResults[poll.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const PollCard = ({ poll, onVote, votedOption, pollResults }) => {
  return (
    <div className="poll-card">
      <h3>{poll.question}</h3>
      <div className="poll-options">
        {poll.options.map((option, index) => (
          <PollOption
            key={index}
            option={option}
            onVote={() => onVote(poll.id, option.text)}
            voted={votedOption === option.text}
            percentage={pollResults ? pollResults[index].percentage : 0}
          />
        ))}
      </div>
      <div className="poll-footer">
        <button className="like-button">👍 Like</button>
        <button className="comment-button">💬 Comment</button>
      </div>
    </div>
  );
};

const PollOption = ({ option, onVote, voted, percentage }) => {
  return (
    <div
      className={`poll-option ${voted ? 'selected' : ''}`}
      onClick={!voted ? onVote : undefined}
    >
      <span>{option.text}</span>
      {voted && <span className="vote-indicator">✔</span>}
      {voted && <span className="percentage">{percentage}%</span>}
    </div>
  );
};

// CSS Styles for the component
const style = `
  .app {
    font-family: Arial, sans-serif;
    padding: 20px;
    background-color: #f4f4f4;
  }

  .poll-feed {
    max-width: 800px;
    margin: 0 auto;
  }

  .poll-card {
    background: white;
    margin-bottom: 20px;
    padding: 15px;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }

  .poll-card h3 {
    font-size: 20px;
    font-weight: bold;
    color: #333;
  }

  .poll-options {
    margin: 10px 0;
  }

  .poll-option {
    padding: 12px;
    border: 1px solid #ddd;
    border-radius: 5px;
    margin-bottom: 10px;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .poll-option:hover {
    background-color: #f1f1f1;
  }

  .poll-option.selected {
    background-color: #0073b1;
    color: white;
    border: 1px solid #0073b1;
  }

  .vote-indicator {
    margin-left: 10px;
    font-size: 16px;
  }

  .percentage {
    font-size: 14px;
    color: #555;
  }

  .poll-footer {
    display: flex;
    justify-content: space-between;
    margin-top: 10px;
  }

  .like-button,
  .comment-button {
    background-color: #0073b1;
    color: white;
    border: none;
    padding: 8px 12px;
    border-radius: 5px;
    cursor: pointer;
  }

  .like-button:hover,
  .comment-button:hover {
    background-color: #005f8b;
  }
`;

// Inject the CSS styles into the head of the HTML
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = style;
document.head.appendChild(styleSheet);

export default App;
