import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import AnimatedPage from '../hooks/AnimatedPage';
import '../Styles/SkillGapAnalysis.css';
import { useApi } from '../hooks/useApi';
import useParticleBackground from '../hooks/UseParticleBackground';
import toast from 'react-hot-toast';
import FeedbackStars from '../components/FeedbackStars'; // Import FeedbackStars

export default function SkillGapAnalysis() {
    const navigate = useNavigate();
    const [editedSkills, setEditedSkills] = useState("");
    const [domain, setDomain] = useState("");
    const [analysisResult, setAnalysisResult] = useState(null); // Holds the analysis data {missing_skills, acquired_skills, recommendations, id?, created_at?}
    const canvasRef = useRef(null);

    const { apiFetch, isLoading: isApiLoading, error, setError } = useApi();
    useParticleBackground(canvasRef);

    // --- Feedback State ---
    const [feedbackRating, setFeedbackRating] = useState(0);
    const [feedbackComment, setFeedbackComment] = useState("");
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
    const [feedbackSubmittedForId, setFeedbackSubmittedForId] = useState(null); // Use analysis ID if available

    // --- Fetch initial skills and last domain ---
    useEffect(() => {
        const fetchInitialData = async () => {
            setError(null);
            setAnalysisResult(null);
            // Reset feedback when component loads initially
            setFeedbackRating(0);
            setFeedbackComment("");
            setFeedbackSubmittedForId(null);

            const [skillsData, domainData] = await Promise.all([
                apiFetch(`/api/user/skill-gap/skills`),
                apiFetch(`/api/user/skill-gap/last-domain`)
            ]);
            if (skillsData?.skills) {
                setEditedSkills(skillsData.skills.join(", "));
            }
            if (domainData?.last_domain) {
                setDomain(domainData.last_domain);
                // fetchLatestAnalysis will be triggered by the domain state change effect
            }
        };
        fetchInitialData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiFetch, setError]); // Run only on mount

    // --- Fetch latest analysis *when domain changes* ---
     const fetchLatestAnalysis = useCallback(async (selectedDomain) => {
         if (!selectedDomain) {
             setAnalysisResult(null);
             setFeedbackRating(0); // Reset feedback if domain cleared
             setFeedbackComment("");
             setFeedbackSubmittedForId(null);
             return;
         }
         console.log(`Fetching latest analysis for domain: ${selectedDomain}`);
         setError(null);
         setAnalysisResult(null); // Clear previous results
         // Reset feedback state when fetching latest for a domain
         setFeedbackRating(0);
         setFeedbackComment("");
         setFeedbackSubmittedForId(null);

         const data = await apiFetch(`/api/user/skill-gap/latest?domain=${encodeURIComponent(selectedDomain)}`);
         if (data?.analysis) {
             console.log("Latest analysis data:", data.analysis);
             // Store analysis ID if available (assuming backend sends it)
             setAnalysisResult({ ...data.analysis, id: data.analysis.id || Date.now() }); // Use timestamp as fallback ID if needed
         } else if (!error && data?.message) {
             console.log(data.message); // "No analysis found"
             setAnalysisResult(null);
         }
         // Error handled by useApi
     // eslint-disable-next-line react-hooks/exhaustive-deps
     }, [apiFetch, setError]); // Removed error, setAnalysisResult

     // This effect runs whenever 'domain' changes
     useEffect(() => {
         fetchLatestAnalysis(domain);
     }, [domain, fetchLatestAnalysis]);


    // --- Handle clicking the Analyze button ---
    const handleAnalyze = async () => {
        if (!domain) {
            toast.error("Please select a domain to analyze.");
            return;
        }
        setError(null);
        setAnalysisResult(null); // Clear previous results
        // Reset feedback state when triggering new analysis
        setFeedbackRating(0);
        setFeedbackComment("");
        setFeedbackSubmittedForId(null);

        const skillsArray = editedSkills.split(",").map(s => s.trim()).filter(s => s);

        console.log("Sending for analysis:", { skills: skillsArray, domain });
        const data = await apiFetch("/api/user/skill-gap/analyze", {
            method: "POST",
            body: JSON.stringify({ skills: skillsArray, domain })
        });

        console.log("Analysis response:", data);
        if (data) {
            // Check if expected fields exist before setting
            if (data.missing_skills && data.acquired_skills && data.recommendations) {
                 // Store analysis ID if backend sends it, otherwise use a fallback like timestamp
                 // Assuming the backend might return the ID of the newly created/updated record
                 setAnalysisResult({ ...data, id: data.id || Date.now() });
            } else if (!error) {
                 console.error("Analysis API response missing expected fields", data);
                 setError("Received incomplete analysis results from the AI.");
                 setAnalysisResult(null); // Ensure result is null on incomplete data
            }
        }
        // Error handled by useApi
    };

    // --- Handle Feedback Submission ---
    const handleFeedbackSubmit = async () => {
        // Use analysisResult.id (or fallback) as itemId
        const currentAnalysisId = analysisResult?.id;

        if (!currentAnalysisId || feedbackRating === 0) {
            toast.error("Please select a rating (1-5 stars).");
            return;
        }
        setIsSubmittingFeedback(true);
        setError(null);

        const payload = {
            type: 'skill_analysis', // Set type specific to skill gap
            itemId: currentAnalysisId.toString(), // Ensure itemId is a string
            rating: feedbackRating,
            comment: feedbackComment.trim() || null,
        };

        const result = await apiFetch("/api/feedback/submit", {
            method: "POST",
            body: JSON.stringify(payload),
        });

        setIsSubmittingFeedback(false);
        if (result?.success) {
            toast.success("Thank you for your feedback!");
            setFeedbackSubmittedForId(currentAnalysisId); // Mark as submitted
        } else {
            toast.error(error || "Could not submit feedback.");
        }
    };


     // Display API errors via toast
     useEffect(() => {
         if (error) {
             toast.error(`Error: ${error}`);
             // Maybe clear error after showing? Depends on useApi hook behavior
             // setError(null);
         }
     }, [error]);

    return (
        <AnimatedPage>
            <div className="skill-gap-page">
            <canvas ref={canvasRef} className="live-background-canvas"></canvas>
            <div className="skill-gap-container">
                <div className="skill-gap-header">
                    <h2>Skill Gap Analysis</h2>
                    <p>Compare your skills against your desired career path.</p>
                </div>

                {/* Skills Textarea */}
                <label htmlFor="skills-textarea-id">Your Combined Skills (Profile, Resume):</label>
                <textarea
                    id="skills-textarea-id"
                    value={editedSkills}
                    onChange={(e) => setEditedSkills(e.target.value)}
                    className="skills-textarea"
                    placeholder={isApiLoading && !editedSkills ? "Loading your skills..." : "Enter/edit skills separated by commas"}
                    disabled={isApiLoading && !editedSkills}
                />

                {/* Domain Select */}
                <label htmlFor="domain-select-id">Select Your Interested Domain:</label>
                <select
                    id="domain-select-id"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="domain-select"
                    disabled={isApiLoading}
                   >
                    <option value="">-- Select Your Career Path --</option>
                    <optgroup label="Web & App Development"> <option value="Frontend Developer">Frontend Developer</option> <option value="Backend Developer">Backend Developer</option> <option value="Full Stack Developer">Full Stack Developer</option> <option value="Android Developer">Android Developer</option> <option value="iOS Developer">iOS Developer</option> </optgroup>
                    <optgroup label="AI, Data Science & ML"> <option value="AI / Machine Learning Engineer">AI / ML Engineer</option> <option value="Data Scientist">Data Scientist</option> <option value="Data Analyst">Data Analyst</option> <option value="Data Engineer">Data Engineer</option> </optgroup>
                    <optgroup label="Cloud & DevOps"> <option value="DevOps Engineer">DevOps Engineer</option> <option value="Cloud Platform Engineer (AWS, Azure, or GCP)">Cloud Platform Engineer</option> </optgroup>
                    <optgroup label="Cyber Security"> <option value="Cyber Security Analyst">Cyber Security Analyst</option> <option value="Penetration Tester (Ethical Hacking)">Penetration Tester</option> <option value="Security Engineer">Security Engineer</option> </optgroup>
                    <optgroup label="Specialized Engineering"> <option value="Blockchain Developer">Blockchain Developer</option> <option value="Game Developer">Game Developer</option> <option value="Software Quality Assurance (QA) Engineer">QA Engineer</option> </optgroup>
                </select>

                {/* Action Buttons */}
                <div className="actions-footer">
                    <button className="return-btn" onClick={() => navigate('/dashboard')} disabled={isApiLoading}>Return to Dashboard</button>
                    <button
                        className="analyze-btn"
                        onClick={handleAnalyze}
                        disabled={isApiLoading || !domain}
                        title={!domain ? "Please select a domain first" : "Run AI analysis"}
                    >
                        {isApiLoading && !analysisResult ? 'Analyzing...' : 'Analyze with AI'}
                    </button>
                </div>

                {/* Loading Indicator */}
                {isApiLoading && !analysisResult && !error && ( // Show only during active analysis/fetch
                    <div className="loading-spinner">
                        <div className="spinner"></div>
                        <p>AI is analyzing your profile...</p> {}
                    </div>
                )}

                {/* --- Analysis Results Display --- */}
                {!isApiLoading && analysisResult && (
                    <div className="analysis-result">
                        <h3>Analysis Results for {analysisResult.interested_domain || domain}</h3>

                        {/* Acquired Skills Section */}
                        <div className="result-section">
                             <h4><span className="result-icon">✅</span>Acquired Skills (Relevant to Domain):</h4>
                             <div className="acquired-skills-container">
                                 {analysisResult.acquired_skills?.length > 0 ? (
                                     analysisResult.acquired_skills.map((skill, i) => (
                                         <span key={`acq-${i}`} className="skill-tag acquired">{skill}</span>
                                     ))
                                 ) : (
                                     <p className="no-skills-message">No relevant acquired skills identified from completed topics.</p>
                                 )}
                             </div>
                         </div>

                        {/* Missing Skills Section */}
                        <div className="result-section">
                            <h4><span className="result-icon">🎯</span>Missing Skills:</h4>
                            <div className="missing-skills-container">
                                {analysisResult.missing_skills?.length > 0 ? (
                                    analysisResult.missing_skills.map((skill, i) => (
                                        <span key={`miss-${i}`} className="skill-tag missing">{skill}</span>
                                    ))
                                ) : (
                                    <p className="no-skills-message">None! Looks like you have the key skills covered.</p>
                                )}
                            </div>
                        </div>

                        {/* AI Recommendations Section */}
                        <div className="result-section">
                            <h4><span className="result-icon">💡</span>AI Learning Recommendations:</h4>
                            {analysisResult.recommendations?.length > 0 ? (
                                <ul>
                                    {analysisResult.recommendations.map((rec, i) => (
                                        <li key={`rec-${i}`}>{rec}</li>
                                    ))}
                                </ul>
                               ) : (
                                   <p className="no-skills-message">No specific learning recommendations generated.</p>
                               )}
                        </div>

                        {/* --- *** NEW: Feedback Section *** --- */}
                        <div className="feedback-section skill-gap-feedback"> {/* Added specific class */}
                           <h4>Rate the quality of this analysis:</h4>
                           <FeedbackStars
                               currentRating={feedbackRating}
                               onRatingChange={setFeedbackRating}
                               disabled={isSubmittingFeedback || feedbackSubmittedForId === analysisResult.id}
                           />
                           {feedbackRating > 0 && feedbackSubmittedForId !== analysisResult.id && (
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
                           {feedbackSubmittedForId === analysisResult.id && (
                                <p className="feedback-thanks">🙏 Thank you for your feedback on this analysis!</p>
                           )}
                        </div>
                        {/* --- *** END Feedback Section *** --- */}

                    </div> // End analysis-result
                )}

                 {/* Placeholder when no analysis result is shown and not loading */}
                 {!isApiLoading && !analysisResult && !error && (
                     <div className="no-analysis-placeholder">
                         <p>Select a domain and click "Analyze with AI" to see your results.</p>
                     </div>
                 )}
            </div> {/* End skill-gap-container */}
            </div> {/* End skill-gap-page */}
        </AnimatedPage>
    );
}