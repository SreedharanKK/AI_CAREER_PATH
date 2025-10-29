import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AnimatedPage from '../hooks/AnimatedPage';
import '../Styles/Roadmap.css'; // Ensure this path is correct
import { useApi } from '../hooks/useApi'; // Ensure this path is correct
import useParticleBackground from '../hooks/UseParticleBackground'; // Ensure this path is correct
import FeedbackStars from '../components/FeedbackStars'; // Ensure this path is correct
import toast from 'react-hot-toast';

// --- Helper Components ---
const ResourceIcon = ({ type }) => {
    const icons = { Course: '🎓', Video: '▶️', Article: '📄', Book: '📚', Project: '💻', Documentation: '📝', "Video Tutorial": '▶️', "Interactive Course": '🎓', "Project Idea": '💡', Default: '⭐' };
    const icon = icons[type] || icons['Default'];
    return <span className="resource-icon" title={type}>{icon}</span>;
};

const CompletionBar = ({ percentage }) => {
    const validPercentage = Math.max(0, Math.min(100, Number(percentage) || 0));
    return (
        <div className="completion-bar-container">
            <div className="completion-bar-track">
                <div className="completion-bar-fill" style={{ width: `${validPercentage}%` }}></div>
            </div>
            <span className="completion-bar-text">{validPercentage.toFixed(0)}%</span>
        </div>
    );
};

// --- Main Roadmap Component ---
export default function Roadmap() {
    const navigate = useNavigate();
    const [newDomain, setNewDomain] = useState("");
    const [activeRoadmaps, setActiveRoadmaps] = useState([]);
    const [selectedRoadmap, setSelectedRoadmap] = useState(null);
    const [selectedDomain, setSelectedDomain] = useState(null);
    const canvasRef = useRef(null);
    const { apiFetch, isLoading, error, setError } = useApi();
    useParticleBackground(canvasRef);

    // Feedback State
    const [feedbackRating, setFeedbackRating] = useState(0);
    const [feedbackComment, setFeedbackComment] = useState("");
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
    const [feedbackSubmittedForId, setFeedbackSubmittedForId] = useState(null);

    // --- State specifically for quiz eligibility check ---
    const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
    const [checkingStepKey, setCheckingStepKey] = useState(null); // Track which button is loading

    // Fetches the list of active roadmaps
    const fetchActiveRoadmaps = useCallback(async (selectDomainOnLoad = null) => {
        const data = await apiFetch('/api/user/get-all-active-roadmaps');
        if (data) {
            setActiveRoadmaps(data);
            if (selectDomainOnLoad && data.length > 0 && !selectedDomain) {
                handleSelectRoadmap(data[0].domain);
            } else if (selectedDomain) {
                 const currentSelectedData = data.find(r => r.domain === selectedDomain);
                 if (currentSelectedData && selectedRoadmap) {
                     setSelectedRoadmap(prev => prev ? ({ ...prev, completion_percentage: currentSelectedData.completion_percentage }) : null);
                 }
            }
        } else {
            setActiveRoadmaps([]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiFetch, selectedDomain, selectedRoadmap]);

    // Initial Load Effect
    useEffect(() => {
        const loadInitial = async () => {
            const listData = await apiFetch('/api/user/get-all-active-roadmaps');
            if (listData) {
                setActiveRoadmaps(listData);
                if (listData.length > 0 && !selectedDomain) {
                    handleSelectRoadmap(listData[0].domain);
                }
            } else {
                setActiveRoadmaps([]);
            }
        };
        loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiFetch]);

    // Handler to Select/Load a Specific Roadmap
    const handleSelectRoadmap = useCallback(async (domainToSelect) => {
        if (!domainToSelect || (isLoading && selectedDomain === domainToSelect)) {
             return;
        }
        setSelectedRoadmap(null);
        setSelectedDomain(domainToSelect);
        setFeedbackRating(0);
        setFeedbackComment("");
        setFeedbackSubmittedForId(null);
        setIsSubmittingFeedback(false);
        setError(null);

        const data = await apiFetch(`/api/user/get-user-roadmap?domain=${encodeURIComponent(domainToSelect)}`);

        if (data && data.id && Array.isArray(data.roadmap)) {
             const listData = await apiFetch('/api/user/get-all-active-roadmaps');
             let completionPercentage = 0;
             if (listData) {
                 setActiveRoadmaps(listData);
                 const activeInfo = listData.find(r => r.id === data.id);
                 if (activeInfo) {
                     completionPercentage = activeInfo.completion_percentage;
                 }
             } else {
                 const currentActiveInfo = activeRoadmaps.find(r => r.id === data.id);
                  if (currentActiveInfo) {
                      completionPercentage = currentActiveInfo.completion_percentage;
                  }
             }
             setSelectedRoadmap({
                 ...data,
                 domain: domainToSelect,
                 completion_percentage: completionPercentage
             });
        } else if (!error) {
             setError(`Could not load roadmap details for ${domainToSelect}.`);
             setSelectedRoadmap(null);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiFetch, setError, activeRoadmaps, selectedDomain, isLoading]);

    // Handler to Generate/Refresh a Roadmap
    const handleGenerateRoadmap = useCallback(async () => {
        if (!newDomain) { toast.error("Please select a domain."); return; }
        const isExisting = activeRoadmaps.some(r => r.domain === newDomain);
        if (!isExisting && activeRoadmaps.length >= 2) { toast.error("Max 2 active roadmaps allowed."); return; }

        setSelectedRoadmap(null);
        setSelectedDomain(newDomain);
        setFeedbackRating(0);
        setFeedbackComment("");
        setFeedbackSubmittedForId(null);
        setError(null);

        const data = await apiFetch("/api/user/generate-roadmap", {
            method: "POST",
            body: JSON.stringify({ domain: newDomain })
        });

        if (data && data.id && Array.isArray(data.roadmap)) {
            const listData = await apiFetch('/api/user/get-all-active-roadmaps');
            let completionPercentage = 0;
            if (listData) {
                setActiveRoadmaps(listData);
                const newlyGeneratedOrFetched = listData.find(r => r.domain === newDomain);
                if (newlyGeneratedOrFetched) {
                    completionPercentage = newlyGeneratedOrFetched.completion_percentage;
                }
            }
             setSelectedRoadmap({
                 ...data,
                 id: data.id,
                 domain: newDomain,
                 completion_percentage: completionPercentage
             });
            setNewDomain("");
            toast.success(`Roadmap for ${newDomain} ${isExisting ? 'loaded' : 'generated'}!`);
        } else if (!error) {
             setError(`Failed to ${isExisting ? 'load' : 'generate'} roadmap for ${newDomain}.`);
             setSelectedRoadmap(null);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [newDomain, activeRoadmaps, apiFetch, setError]);


    // --- MODIFIED: Handle Go To Test Click ---
    const handleGoToTest = async (stepData, stageIndex, stepIndex) => {
        const stepKey = `${stageIndex}-${stepIndex}`; // Unique key for this step
        if (!selectedRoadmap?.id || !stepData) {
            toast.error("Roadmap or step data is missing.");
            console.error("Missing data for quiz navigation:", { selectedRoadmap, stepData });
            return;
        }

        if (isCheckingEligibility || isLoading) return; // Prevent multiple clicks

        setIsCheckingEligibility(true);
        setCheckingStepKey(stepKey); // Set which button is loading
        setError(null);

        const payload = {
            roadmap_id: selectedRoadmap.id,
            stage_index: stageIndex,
            step_index: stepIndex
        };

        const eligibilityData = await apiFetch("/api/user/check-quiz-eligibility", {
            method: "POST",
            body: JSON.stringify(payload),
        });

        setIsCheckingEligibility(false);
        setCheckingStepKey(null); // Clear loading button

        if (eligibilityData) {
            if (eligibilityData.eligible) {
                // Eligible: Navigate to QuizPage
                navigate('/QuizPage', {
                    state: {
                        step: stepData,
                        roadmapId: selectedRoadmap.id,
                        stageIndex,
                        stepIndex
                    }
                });
            } else {
                // Not eligible: Show reason via toast
                if (eligibilityData.reason === "cooldown_active") {
                     toast.error(`Please wait. You can retry this quiz in about ${eligibilityData.minutes_remaining} minute(s).`, { duration: 4000 });
                } else if (eligibilityData.reason === "already_completed" || eligibilityData.reason === "already_passed") {
                     toast.info("You have already passed the quiz for this step.", { duration: 4000 });
                     // Force refresh roadmap data to show 'completed' status
                     handleSelectRoadmap(selectedDomain);
                } else {
                     toast.error("You are not eligible to take this quiz at this time.", { duration: 4000 });
                }
            }
        } else {
             // Handle API call failure (error is set by useApi hook)
             toast.error(error || "Could not check quiz eligibility.");
        }
    };
    // --- END MODIFIED Handler ---


    // Handler for Feedback Submission
    const handleFeedbackSubmit = async () => {
       if (!selectedRoadmap?.id || feedbackRating === 0) { toast.error("Please select a rating (1-5 stars)."); return; }
       setIsSubmittingFeedback(true);
       setError(null);
       const payload = { type: 'roadmap', itemId: selectedRoadmap.id, rating: feedbackRating, comment: feedbackComment.trim() || null };
       const result = await apiFetch("/api/feedback/submit", { method: "POST", body: JSON.stringify(payload) });
       setIsSubmittingFeedback(false);
       if (result?.success) {
           toast.success("Thank you for your feedback!");
           setFeedbackSubmittedForId(selectedRoadmap.id);
       } else {
            toast.error(error || "Could not submit feedback.");
       }
    };

    // Determine layout class
    const layoutClassName = `roadmap-page-container ${selectedRoadmap ? 'layout-shifted' : ''}`;
    let currentTotalStepsCount = 0;

    return (
        <AnimatedPage>
            <div className={layoutClassName}>
                <canvas ref={canvasRef} className="live-background-canvas"></canvas>

                {/* --- Sidebar Controls --- */}
                <aside className="roadmap-controls">
                    <h1 className="roadmap-title">AI Digital Roadmap</h1>
                    {/* Active Roadmaps List */}
                    <div className="active-roadmaps-box">
                         <h2 className="active-roadmaps-title">Your Active Roadmaps</h2>
                         {isLoading && activeRoadmaps.length === 0 && !error && (<p className="no-active-roadmaps">Loading list...</p>)}
                         {error && activeRoadmaps.length === 0 && (<p className="roadmap-error small">Failed to load roadmaps.</p>)}
                         {!isLoading && activeRoadmaps.length > 0 && (
                             activeRoadmaps.map(roadmap => (
                                 <button key={roadmap.id} className={`roadmap-card ${(selectedDomain === roadmap.domain) ? 'active' : ''}`} onClick={() => handleSelectRoadmap(roadmap.domain)} disabled={isLoading}>
                                     <span className="roadmap-card-domain">{roadmap.domain}</span>
                                     <CompletionBar percentage={roadmap.completion_percentage} />
                                 </button>
                             ))
                         )}
                         {!isLoading && activeRoadmaps.length === 0 && !error && (<p className="no-active-roadmaps">You have no active roadmaps yet.</p>)}
                    </div>
                    {/* Generate New Roadmap Section */}
                    <div className="generate-roadmap-box">
                         <h2 className="generate-roadmap-title">Add / View Roadmap</h2>
                         <p className="roadmap-subtitle">Select a path to view or generate (Max 2).</p>
                         <select value={newDomain} onChange={(e) => setNewDomain(e.target.value)} className="domain-select-roadmap" disabled={isLoading} >
                            <option value="">-- Select Career Path --</option>
                            <optgroup label="Software & Web Development"> <option value="Frontend Developer">Frontend Developer</option> <option value="Backend Developer">Backend Developer</option> <option value="Full Stack Developer">Full Stack Developer</option> <option value="DevOps Engineer">DevOps Engineer</option> <option value="Android Developer">Android Developer</option> <option value="iOS Developer">iOS Developer</option> </optgroup>
                            <optgroup label="AI & Data Science"> <option value="AI / Machine Learning Engineer">AI / ML Engineer</option> <option value="Data Scientist">Data Scientist</option> <option value="Data Analyst">Data Analyst</option> <option value="Data Engineer">Data Engineer</option> </optgroup>
                            <optgroup label="Cyber Security"> <option value="Cyber Security Analyst">Cyber Security Analyst</option> <option value="Penetration Tester">Penetration Tester</option> <option value="Security Engineer">Security Engineer</option> </optgroup>
                         </select>
                         <button className="generate-btn-roadmap" onClick={handleGenerateRoadmap} disabled={isLoading || !newDomain} >
                            {isLoading && selectedDomain === newDomain && !selectedRoadmap ? 'Loading...' : (activeRoadmaps.some(r => r.domain === newDomain) ? 'View Selected Roadmap' : 'Generate New Roadmap')}
                         </button>
                    </div>
                    {/* Return to Dashboard Button */}
                    <button className="return-btn-roadmap" onClick={() => navigate('/dashboard')} disabled={isLoading} >
                        Return to Dashboard
                    </button>
                </aside>

                {/* --- Main Content Area --- */}
                <main className="roadmap-main-content">
                    {/* General Loading State */}
                    {isLoading && selectedDomain && !selectedRoadmap && !error && (
                         <div className="loading-spinner"> <div className="spinner"></div> <p>Loading roadmap for {selectedDomain}...</p> </div>
                    )}
                    {/* General Error State */}
                    {error && !isLoading && (<div className="roadmap-error">{error}</div>)}
                    {/* Placeholder */}
                    {!isLoading && !selectedRoadmap && !error && (
                        <div className="no-roadmap-placeholder"> <p>Your personalized roadmap will appear here.</p> <p>{activeRoadmaps.length > 0 ? 'Select an active roadmap or generate/select a new one.' : 'Generate a new roadmap to start.'}</p> </div>
                    )}

                    {/* Selected Roadmap Display */}
                    {selectedRoadmap && !isLoading && (
                        <>
                           {/* Roadmap Header */}
                           <div className="selected-roadmap-header">
                               <h2>Roadmap for: {selectedRoadmap.domain}</h2>
                               <CompletionBar percentage={selectedRoadmap.completion_percentage || 0} />
                           </div>

                           {/* Feedback Section */}
                           <div className="feedback-section">
                               <h4>Rate the quality of this generated roadmap:</h4>
                               <FeedbackStars
                                   currentRating={feedbackRating}
                                   onRatingChange={setFeedbackRating}
                                   disabled={isSubmittingFeedback || feedbackSubmittedForId === selectedRoadmap.id}
                               />
                               {feedbackRating > 0 && feedbackSubmittedForId !== selectedRoadmap.id && (
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
                               {feedbackSubmittedForId === selectedRoadmap.id && (
                                    <p className="feedback-thanks">🙏 Thank you for your feedback on this roadmap!</p>
                               )}
                           </div>

                           {/* Roadmap Timeline */}
                           <div className="roadmap-timeline-container">
                               <div className="road-line"></div>
                               {Array.isArray(selectedRoadmap.roadmap) && selectedRoadmap.roadmap.map((stage, stageIndex) => (
                                   <React.Fragment key={stageIndex}>
                                       {Array.isArray(stage.steps) && stage.steps.map((step, stepIndex) => {
                                           currentTotalStepsCount++;
                                           const isLeft = (currentTotalStepsCount % 2 !== 0);
                                           const stepKey = `${stageIndex}-${stepIndex}`; // Unique key for this step
                                           return (
                                                <div key={stepKey} className={`roadmap-step ${isLeft ? 'step-left' : 'step-right'} ${step.is_completed ? 'step-completed' : ''} ${!step.is_unlocked ? 'step-locked' : ''}`} >
                                                    <div className="step-milestone"><div className="milestone-number">{currentTotalStepsCount}</div></div>
                                                    {step.is_unlocked ? (
                                                        <a href={step.study_link} target="_blank" rel="noopener noreferrer" className="step-content-link" title={`Go to resource for ${step.title}`}>
                                                            <div className="step-content">
                                                                <h3 className="step-title"><ResourceIcon type={step.resource_type} /> {step.title || 'Untitled Step'}</h3>
                                                                <p className="step-description">{step.description || 'No description.'}</p>
                                                            </div>
                                                        </a>
                                                    ) : (
                                                        <div className="step-content-link disabled" title="Complete previous steps to unlock">
                                                            <div className="step-content">
                                                                <h3 className="step-title"><ResourceIcon type={step.resource_type} /> {step.title || 'Untitled Step'}</h3>
                                                                <p className="step-description">{step.description || 'No description.'}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="step-actions">
                                                        {step.is_completed ? (
                                                            <span className="completion-status"> ✅ Completed (Score: {step.test_score ?? 'N/A'}%) </span>
                                                        ) : (
                                                            <button
                                                                className="test-btn"
                                                                onClick={() => handleGoToTest(step, stageIndex, stepIndex)}
                                                                // Disable if locked, or if *any* API call is loading
                                                                disabled={!step.is_unlocked || isLoading || isCheckingEligibility}
                                                                title={step.is_unlocked ? "Take the quiz for this step" : "This step is locked"}
                                                            >
                                                                {/* Show loading text *only* for the button being clicked */}
                                                                {isCheckingEligibility && checkingStepKey === stepKey ? 'Checking...' : (step.is_unlocked ? 'Go to Test' : 'Locked')}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                           );
                                       })}
                                   </React.Fragment>
                               ))}
                               {(!Array.isArray(selectedRoadmap.roadmap) || selectedRoadmap.roadmap.length === 0) && (
                                    <p className="roadmap-error small">Roadmap data seems empty or invalid.</p>
                               )}
                           </div> {/* End Timeline */}
                       </>
                   )}
                </main>
            </div>
        </AnimatedPage>
    );
}