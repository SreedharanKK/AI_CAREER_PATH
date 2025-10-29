import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AnimatedPage from '../hooks/AnimatedPage';
import '../Styles/LearningRecommendations.css'; // Ensure path is correct
import { useApi } from '../hooks/useApi'; // Ensure path is correct
import useParticleBackground from '../hooks/UseParticleBackground'; // Ensure path is correct
import FeedbackStars from '../components/FeedbackStars'; // Import FeedbackStars
import toast from 'react-hot-toast'; // Import toast

export default function LearningRecommendations() {
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null); // { degree, stream }
    const [recommendations, setRecommendations] = useState(null); // List of recommendation objects or null/[]
    const canvasRef = useRef(null);
    const { apiFetch, isLoading, error, setError } = useApi();
    useParticleBackground(canvasRef);

    // Feedback State
    const [feedbackRating, setFeedbackRating] = useState(0);
    const [feedbackComment, setFeedbackComment] = useState("");
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
    const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
    const [feedbackItemId, setFeedbackItemId] = useState(null);

    // Fetch initial or existing recommendations
    const fetchRecommendations = useCallback(async () => {
        // Clear previous state *before* fetching
        setError(null);
        setRecommendations(null);
        setUserData(null); // Also clear userData initially
        setFeedbackRating(0);
        setFeedbackComment("");
        setFeedbackSubmitted(false);
        setFeedbackItemId(null);

        console.log("Fetching recommendations...");
        const data = await apiFetch('/api/user/learning-recommendations');

        // Process data *only if* the fetch didn't result in an error handled by useApi
        if (data && !error) { // Check error state from useApi hook here
            if (data.degree && data.stream && Array.isArray(data.recommendations)) {
                console.log("Recommendations fetched:", data);
                setUserData({ degree: data.degree, stream: data.stream });
                setRecommendations(data.recommendations);
                setFeedbackItemId(`recs-${Date.now()}`);
            } else {
                 console.error("Invalid format received for recommendations:", data);
                 setError("Received recommendations in an unexpected format.");
                 setRecommendations([]); // Set empty array to indicate loaded but invalid/empty
            }
        } else if (!error) { // Handle case where data is null/undefined but no hook error
             console.error("API returned null/undefined for recommendations, but no explicit error.");
             setError("Failed to load recommendations.");
             setRecommendations([]); // Set empty array
        }
        // If apiFetch resulted in an error, the 'error' state is already set
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiFetch, setError]); // Removed error from dependencies to avoid potential loops

    // Generate new recommendations
    const handleRefreshRecommendations = useCallback(async () => {
        // Clear previous state *before* fetching
        setError(null);
        setRecommendations(null);
        setUserData(null); // Clear userData
        setFeedbackRating(0);
        setFeedbackComment("");
        setFeedbackSubmitted(false);
        setFeedbackItemId(null);

        console.log("Refreshing recommendations...");
        const data = await apiFetch('/api/user/learning-recommendations/generate', {
            method: 'POST'
        });

        // Process data *only if* the fetch didn't result in an error
        if (data && !error) { // Check error state from useApi hook here
             if (data.degree && data.stream && Array.isArray(data.recommendations)) {
                console.log("Recommendations refreshed:", data);
                setUserData({ degree: data.degree, stream: data.stream });
                setRecommendations(data.recommendations);
                setFeedbackItemId(`recs-${Date.now()}`);
                toast.success("New recommendations generated!");
             } else {
                 console.error("Invalid format received after refreshing recommendations:", data);
                 setError("Received refreshed recommendations in an unexpected format.");
                 setRecommendations([]);
             }
        } else if (!error){
             console.error("API returned null/undefined after refresh, but no explicit error.");
             setError("Failed to generate new recommendations.");
             setRecommendations([]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiFetch, setError]); // Removed error from dependencies

    // Fetch on initial mount
    useEffect(() => {
        fetchRecommendations();
    }, [fetchRecommendations]);

    // Handle Feedback Submission
    const handleFeedbackSubmit = async () => {
        // ... (Feedback submission logic remains the same) ...
        if (!feedbackItemId || feedbackRating === 0) { toast.error("Please select a rating (1-5 stars)."); return; }
        setIsSubmittingFeedback(true);
        // Don't clear setError here, let useApi manage API errors
        // setError(null);

        const payload = { type: 'recommendation', itemId: feedbackItemId, rating: feedbackRating, comment: feedbackComment.trim() || null };
        const result = await apiFetch("/api/feedback/submit", { method: "POST", body: JSON.stringify(payload) });

        setIsSubmittingFeedback(false);
        if (result?.success) {
            toast.success("Thank you for your feedback!");
            setFeedbackSubmitted(true);
        } else {
            // Error toast will be shown by the useEffect below if 'error' state is set by useApi
             if (!error) { // If useApi didn't set an error, show a generic one
                 toast.error("Could not submit feedback.");
             }
        }
    };

    // Display API errors via toast (only when not loading initial data)
    useEffect(() => {
        // Display error only if it exists and we are NOT in the initial loading phase (recommendations is not null)
        // OR if it exists and we finished loading but recommendations are still null (meaning load failed)
        if (error && (recommendations !== null || !isLoading)) {
            toast.error(`Error: ${error}`);
             // Consider clearing the error *after* the toast to prevent loops if useApi doesn't handle it
             // setTimeout(() => setError(null), 50);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [error]); // Removed isLoading, recommendations, setError - rely only on error changing


    // --- RENDER LOGIC ---

    // Determine content based on loading, error, and data state
    let mainContent = null;
    if (isLoading && recommendations === null) {
        // Initial loading state
        mainContent = (
            <div className="feedback-container">
                <div className="spinner"></div>
                <p>Analyzing your profile and generating recommendations...</p>
            </div>
        );
    } else if (error && recommendations === null) {
        // Error occurred *during* initial load, recommendations never arrived
         mainContent = (
             <div className="feedback-container">
                 <p className="error-message">{error}</p>
                 {/* Optional: Add a retry button */}
                 {/* <button onClick={fetchRecommendations}>Retry</button> */}
             </div>
         );
    } else if (Array.isArray(recommendations)) {
         // Data loaded (successfully or resulted in empty array), or subsequent error occurred
         if (recommendations.length > 0) {
             // Recommendations available - Render Grid and Feedback
             mainContent = (
                 <>
                     <div className="recommendations-grid">
                         {recommendations.map((rec, index) => (
                             <div key={index} className="rec-card">
                                 {/* --- *** Safe Navigation Added *** --- */}
                                 <h3 className="rec-topic">{rec?.topic || 'Recommendation Topic'}</h3>
                                 {rec?.skills_to_learn && Array.isArray(rec.skills_to_learn) && rec.skills_to_learn.length > 0 && (
                                     <div className="rec-section">
                                         <h4>Key Skills to Learn</h4>
                                         <div className="rec-skills-container">
                                             {rec.skills_to_learn.map((skill, i) => (
                                                 <span key={i} className="rec-skill-tag">{skill}</span>
                                             ))}
                                         </div>
                                     </div>
                                 )}
                                 {rec?.current_scope && <div className="rec-section"><h4>Current Scope (2025)</h4><p>{rec.current_scope}</p></div>}
                                 {rec?.future_scope && <div className="rec-section"><h4>Future Scope (3-5 Years)</h4><p>{rec.future_scope}</p></div>}
                                 {rec?.getting_started && <div className="rec-section"><h4>How to Get Started</h4><p>{rec.getting_started}</p></div>}
                                 {rec?.estimated_time && <div className="rec-section"><h4>Estimated Time to Learn</h4><p>{rec.estimated_time}</p></div>}
                                 {rec?.project_idea && <div className="rec-section"><h4>Beginner Project Idea</h4><p>{rec.project_idea}</p></div>}
                                 {rec?.interview_question && <div className="rec-section interview-section"><h4>Sample Interview Question</h4><p>"{rec.interview_question}"</p></div>}
                             </div>
                         ))}
                     </div>

                     {/* Feedback Section */}
                     <div className="feedback-section learning-recs-feedback">
                        <h4>Rate the quality of these recommendations:</h4>
                        <FeedbackStars
                            currentRating={feedbackRating}
                            onRatingChange={setFeedbackRating}
                            disabled={isSubmittingFeedback || feedbackSubmitted}
                        />
                        {feedbackRating > 0 && !feedbackSubmitted && (
                            <>
                                <textarea
                                    className="feedback-comment"
                                    placeholder="Optional: Add comments here..."
                                    value={feedbackComment}
                                    onChange={(e) => setFeedbackComment(e.target.value)}
                                    rows={3}
                                    disabled={isSubmittingFeedback}
                                />
                                <button
                                    className="submit-feedback-btn"
                                    onClick={handleFeedbackSubmit}
                                    disabled={isSubmittingFeedback || feedbackRating === 0}
                                >
                                    {isSubmittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                                </button>
                            </>
                        )}
                        {feedbackSubmitted && (
                             <p className="feedback-thanks">🙏 Thank you for your feedback!</p>
                        )}
                     </div>
                 </>
             );
         } else {
              // Loaded successfully, but the recommendations array is empty
              mainContent = (
                 <div className="feedback-container">
                     <p>No specific learning recommendations could be generated based on your current profile. Ensure your Degree and Stream are set correctly in your profile.</p>
                 </div>
              );
         }
    } else if (error) {
         // Fallback: An error exists, but recommendations might have been previously loaded (e.g., error during feedback submit)
         // Show the error prominently, maybe keep showing old data if desired, or clear it.
         // For simplicity, showing just the error might be best.
          mainContent = (
             <div className="feedback-container">
                 <p className="error-message">{error}</p>
             </div>
         );
    }
    // If none of the above conditions are met (shouldn't happen), mainContent remains null (blank section)


    return (
        <AnimatedPage>
            <div className="recs-page-container">
            <canvas ref={canvasRef} className="live-background-canvas"></canvas>
            <div className="recs-content-wrapper">
                {/* Header */}
                <div className="recs-header">
                    <h1 className="recs-title">AI Learning Recommendations</h1>
                    <p className="recs-subtitle">Personalized suggestions based on your academic profile and industry trends.</p>
                    {/* Safely access userData */}
                    {userData?.degree && userData?.stream && (
                        <div className="user-profile-info">
                            <strong>Your Profile:</strong> {userData.degree} - {userData.stream}
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="recs-actions">
                    <button
                        className="refresh-btn"
                        onClick={handleRefreshRecommendations}
                        disabled={isLoading} // Disable during any loading activity
                    >
                        {/* More specific loading text */}
                        {isLoading && recommendations === null ? 'Generating...' : 'Get New AI Recommendations'}
                    </button>
                    <button
                        className="return-dashboard-btn"
                        onClick={() => navigate('/dashboard')}
                        disabled={isLoading} // Disable during any loading activity
                    >
                        Return to Dashboard
                    </button>
                </div>

                {/* Render the determined main content */}
                {mainContent}

            </div> {/* End recs-content-wrapper */}
            </div> {/* End recs-page-container */}
        </AnimatedPage>
    );
}