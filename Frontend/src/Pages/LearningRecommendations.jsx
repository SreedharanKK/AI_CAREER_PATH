import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../Styles/LearningRecommendations.css'; // The CSS is now imported from this file

export default function LearningRecommendations() {
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);
    const [recommendations, setRecommendations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Function to fetch recommendations (used for initial load)
    const fetchRecommendations = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch('http://localhost:5000/api/user/learning-recommendations', {
                credentials: 'include',
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            setUserData({ degree: data.degree, stream: data.stream });
            setRecommendations(data.recommendations);
        } catch (err) {
            console.error("Error fetching recommendations:", err);
            setError(err.message || "Could not fetch recommendations. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };
    
    // Function to force generate NEW recommendations
    const handleRefreshRecommendations = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch('http://localhost:5000/api/user/learning-recommendations/generate', {
                method: 'POST',
                credentials: 'include',
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            setUserData({ degree: data.degree, stream: data.stream });
            setRecommendations(data.recommendations);
        } catch (err) {
            console.error("Error refreshing recommendations:", err);
            setError(err.message || "Could not refresh recommendations.");
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch initial data on component mount
    useEffect(() => {
        fetchRecommendations();
    }, []);

    return (
        <div className="recs-page-container">
            <div className="recs-header">
                <h1 className="recs-title">AI Learning Recommendations</h1>
                <p className="recs-subtitle">Personalized suggestions based on your academic profile and future industry trends.</p>
                {userData && (
                    <div className="user-profile-info">
                        <strong>Your Profile:</strong> {userData.degree} - {userData.stream}
                    </div>
                )}
            </div>
            
            {/* --- UPDATED: Both buttons are now here --- */}
            <div className="recs-actions">
                <button className="refresh-btn" onClick={handleRefreshRecommendations} disabled={isLoading}>
                    {isLoading ? 'Refreshing...' : 'Get New AI Recommendations'}
                </button>
                <button className="return-dashboard-btn" onClick={() => navigate('/dashboard')}>
                    Return to Dashboard
                </button>
            </div>

            {isLoading && (
                <div className="feedback-container">
                    <div className="spinner"></div>
                    <p>Analyzing your profile and generating recommendations...</p>
                </div>
            )}
            
            {error && (
                <div className="feedback-container">
                    <p className="error-message">{error}</p>
                    {/* A return button is still helpful on the error screen */}
                    <button className="return-dashboard-btn" onClick={() => navigate('/dashboard')}>
                        Return to Dashboard
                    </button>
                </div>
            )}

            {!isLoading && !error && (
                <div className="recommendations-grid">
                    {recommendations.map((rec, index) => (
                        <div key={index} className="rec-card">
                            <h3 className="rec-topic">{rec.topic}</h3>
                            <div className="rec-section">
                                <h4>Key Skills to Learn</h4>
                                <div className="rec-skills-container">
                                    {rec.skills_to_learn?.map((skill, i) => (
                                        <span key={i} className="rec-skill-tag">{skill}</span>
                                    ))}
                                </div>
                            </div>
                            <div className="rec-section">
                                <h4>Current Scope (2025)</h4>
                                <p>{rec.current_scope}</p>
                            </div>
                            <div className="rec-section">
                                <h4>Future Scope (3-5 Years)</h4>
                                <p>{rec.future_scope}</p>
                            </div>
                            <div className="rec-section">
                                <h4>How to Get Started</h4>
                                <p>{rec.getting_started}</p>
                            </div>
                            <div className="rec-section">
                                <h4>Estimated Time to Learn</h4>
                                <p>{rec.estimated_time}</p>
                            </div>
                            <div className="rec-section">
                                <h4>Beginner Project Idea</h4>
                                <p>{rec.project_idea}</p>
                            </div>
                            <div className="rec-section interview-section">
                                <h4>Sample Interview Question</h4>
                                <p>"{rec.interview_question}"</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

