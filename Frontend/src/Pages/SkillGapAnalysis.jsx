import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from 'react-router-dom';
// Correct import paths
import AnimatedPage from '../hooks/AnimatedPage';
import '../Styles/SkillGapAnalysis.css';
import { useApi } from '../hooks/useApi';
import useParticleBackground from '../hooks/UseParticleBackground'; // Correct capitalization
import toast from 'react-hot-toast'; // Import toast for feedback

export default function SkillGapAnalysis() {
    const navigate = useNavigate();
    const [editedSkills, setEditedSkills] = useState("");
    const [domain, setDomain] = useState("");
    const [analysisResult, setAnalysisResult] = useState(null);
    const canvasRef = useRef(null);

    // Renamed isLoading to isApiLoading for clarity
    const { apiFetch, isLoading: isApiLoading, error, setError } = useApi();
    useParticleBackground(canvasRef);

    // --- Fetch initial skills and last domain ---
    useEffect(() => {
        const fetchInitialData = async () => {
            setError(null); // Clear errors on initial load
            setAnalysisResult(null); // Clear previous results
            const [skillsData, domainData] = await Promise.all([
                apiFetch(`/api/user/skill-gap/skills`),
                apiFetch(`/api/user/skill-gap/last-domain`)
            ]);
            if (skillsData?.skills) {
                setEditedSkills(skillsData.skills.join(", "));
            }
            if (domainData?.last_domain) {
                setDomain(domainData.last_domain);
                // Trigger fetchLatestAnalysis only if a last_domain was found
                // fetchLatestAnalysis(domainData.last_domain); // Moved to separate effect
            }
             // Handle case where initial fetches fail (error handled by useApi)
        };
        fetchInitialData();
    }, [apiFetch, setError]); // Removed fetchLatestAnalysis dependency here

    // --- Fetch latest analysis *when domain changes* ---
     const fetchLatestAnalysis = useCallback(async (selectedDomain) => {
         if (!selectedDomain) {
             setAnalysisResult(null); // Clear results if no domain selected
             return;
         }
         console.log(`Fetching latest analysis for domain: ${selectedDomain}`);
         setError(null); // Clear previous errors before fetching latest
         setAnalysisResult(null); // Clear previous results immediately
         const data = await apiFetch(`/api/user/skill-gap/latest?domain=${encodeURIComponent(selectedDomain)}`); // URL encode domain
         if (data?.analysis) {
              console.log("Latest analysis data:", data.analysis);
              setAnalysisResult(data.analysis); // Set the fetched analysis
         } else if (!error && data?.message) {
              // Handle "No analysis found" message gracefully - keep result null
              console.log(data.message);
              setAnalysisResult(null);
         }
         // If error occurred during fetch, error state is already set by useApi
     }, [apiFetch, setError, error]); // Added error to deps, removed setAnalysisResult

     // This effect runs whenever 'domain' changes OR fetchLatestAnalysis function reference changes
     useEffect(() => {
         if (domain) {
             fetchLatestAnalysis(domain);
         } else {
             setAnalysisResult(null); // Clear results if domain is cleared
         }
     }, [domain, fetchLatestAnalysis]);


    // --- Handle clicking the Analyze button ---
    const handleAnalyze = async () => {
        if (!domain) {
             // Use toast for user feedback instead of setError directly for non-API errors
            toast.error("Please select a domain to analyze.");
            return;
        }
        setError(null); // Clear previous API errors
        setAnalysisResult(null); // Clear previous results to show loading
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
                 setAnalysisResult(data); // Set the new analysis result from the POST request
            } else if (!error) {
                 console.error("Analysis API response missing expected fields", data);
                 setError("Received incomplete analysis results from the AI. Please try again.");
            }
        }
        // Error is handled by useApi hook and displayed via useEffect
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
                    <p>Compare your skills and completed roadmap topics against your desired career path.</p>
                </div>

                {/* Error display is handled by toast now */}
                {/* {error && <div className="error-message">{error}</div>} */}

                <label htmlFor="skills-textarea-id">Your Combined Skills (Profile, Resume):</label>
                <textarea
                    id="skills-textarea-id" // Added id for label association
                    value={editedSkills}
                    onChange={(e) => setEditedSkills(e.target.value)}
                    className="skills-textarea"
                    placeholder={isApiLoading && !editedSkills ? "Loading your skills..." : "Enter/edit skills separated by commas"}
                    disabled={isApiLoading && !editedSkills} // Disable only during initial load
                />

                <label htmlFor="domain-select-id">Select Your Interested Domain:</label>
                <select
                     id="domain-select-id" // Added id
                     value={domain}
                     // Update domain state and trigger fetchLatestAnalysis
                     onChange={(e) => setDomain(e.target.value)}
                     className="domain-select"
                     disabled={isApiLoading} // Disable while any API call is loading
                 >
                    <option value="">-- Select Your Career Path --</option>
                    <optgroup label="Web & App Development"> <option value="Frontend Developer">Frontend Developer</option> <option value="Backend Developer">Backend Developer</option> <option value="Full Stack Developer">Full Stack Developer</option> <option value="Android Developer">Android Developer</option> <option value="iOS Developer">iOS Developer</option> </optgroup>
                    <optgroup label="AI, Data Science & ML"> <option value="AI / Machine Learning Engineer">AI / ML Engineer</option> <option value="Data Scientist">Data Scientist</option> <option value="Data Analyst">Data Analyst</option> <option value="Data Engineer">Data Engineer</option> </optgroup>
                    <optgroup label="Cloud & DevOps"> <option value="DevOps Engineer">DevOps Engineer</option> <option value="Cloud Platform Engineer (AWS, Azure, or GCP)">Cloud Platform Engineer</option> </optgroup>
                    <optgroup label="Cyber Security"> <option value="Cyber Security Analyst">Cyber Security Analyst</option> <option value="Penetration Tester (Ethical Hacking)">Penetration Tester</option> <option value="Security Engineer">Security Engineer</option> </optgroup> {/* Added missing role */}
                    <optgroup label="Specialized Engineering"> <option value="Blockchain Developer">Blockchain Developer</option> <option value="Game Developer">Game Developer</option> <option value="Software Quality Assurance (QA) Engineer">QA Engineer</option> </optgroup>
                </select>

                <div className="actions-footer">
                    <button className="return-btn" onClick={() => navigate('/dashboard')} disabled={isApiLoading}>Return to Dashboard</button>
                    <button
                        className="analyze-btn"
                        onClick={handleAnalyze}
                        // Disable if loading OR if no domain is selected
                        disabled={isApiLoading || !domain}
                        title={!domain ? "Please select a domain first" : "Run AI analysis"}
                    >
                        {/* Show specific loading text */}
                        {isApiLoading && !analysisResult ? 'Analyzing...' : 'Analyze with AI'}
                    </button>
                </div>

                {/* Loading indicator ONLY during analysis POST request */}
                {isApiLoading && !analysisResult && !error && (
                    <div className="loading-spinner">
                        <div className="spinner"></div>
                        <p>AI is analyzing your profile...</p> {}
                    </div>
                )}

                {/* --- UPDATED: Analysis Results Display --- */}
                {/* Show results only if NOT loading AND analysisResult is available */}
                {!isApiLoading && analysisResult && (
                    <div className="analysis-result">
                        <h3>Analysis Results for {analysisResult.interested_domain || domain}</h3>

                        {/* Acquired Skills Section */}
                        <div className="result-section">
                             <h4><span className="result-icon">✅</span>Acquired Skills (Relevant to Domain):</h4>
                             <div className="acquired-skills-container"> {/* Use a different class for potential styling */}
                                 {analysisResult.acquired_skills?.length > 0 ? (
                                     analysisResult.acquired_skills.map((skill, i) => (
                                         <span key={`acq-${i}`} className="skill-tag acquired">{skill}</span>
                                     ))
                                 ) : (
                                     <p className="no-skills-message">No specific relevant skills identified yet based on your profile and completed topics.</p>
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
                                    <p className="no-skills-message">None! Looks like you have the key skills covered for this domain based on your profile.</p>
                                )}
                            </div>
                        </div>

                        {/* AI Recommendations Section */}
                        <div className="result-section">
                            <h4><span className="result-icon">💡</span>AI Learning Recommendations:</h4>
                             {/* Check if recommendations exist and have content */}
                            {analysisResult.recommendations?.length > 0 ? (
                                <ul>
                                    {analysisResult.recommendations.map((rec, i) => (
                                        <li key={`rec-${i}`}>{rec}</li>
                                    ))}
                                </ul>
                             ) : (
                                 <p className="no-skills-message">No specific learning recommendations generated at this time.</p>
                             )}
                        </div>
                    </div>
                )}
                 {/* Placeholder when no analysis result is shown and not loading */}
                 {!isApiLoading && !analysisResult && !error && (
                      <div className="no-analysis-placeholder">
                           <p>Select a domain and click "Analyze with AI" to see your results.</p>
                      </div>
                 )}
            </div>
            </div>
        </AnimatedPage>
    );
}
