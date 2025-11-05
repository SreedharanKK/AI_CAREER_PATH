import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; // --- 1. Import useLocation ---
import AnimatedPage from '../hooks/AnimatedPage';
import '../Styles/Roadmap.css';
import { useApi } from '../hooks/useApi';
import useParticleBackground from '../hooks/UseParticleBackground';
import FeedbackStars from '../components/FeedbackStars';
import toast from 'react-hot-toast';
import { X, Loader2, Star, Book, Zap, FileText,Download } from 'lucide-react'; // --- 2. Add new icons ---

// Now uses different icons and is a bit smaller
const ResourceIcon = ({ type }) => {
    let icon = <FileText size={16} />; // Default
    if (!type) type = "article"; // Default if type is missing

    const lowerType = type.toLowerCase();
    
    if (lowerType.includes('video')) {
        icon = <Zap size={16} />; // Use Zap for video
    } else if (lowerType.includes('interactive') || lowerType.includes('course')) {
        icon = <Star size={16} />; // Use Star for courses
    } else if (lowerType.includes('book')) {
        icon = <Book size={16} />;
    } else if (lowerType.includes('doc') || lowerType.includes('article')) {
        icon = <FileText size={16} />;
    }
    
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

// --- NEW: Generation Choice Modal ---
const GenerationChoiceModal = ({ domain, onClose, onGenerate, isLoading }) => {
    return (
        <div className="modal-overlay-practice" onClick={onClose}>
            <div className="modal-content-practice choice-modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close-btn-history" onClick={onClose} aria-label="Close modal"><X size={24} /></button>
                <h2>New Roadmap for {domain}</h2>
                <p className="choice-subtitle">How would you like to generate this roadmap?</p>
                
                <div className="choice-buttons-container">
                    <button className="choice-btn general" onClick={() => onGenerate(false)} disabled={isLoading}>
                        <h3>Generate General Roadmap</h3>
                        <p>A complete, comprehensive guide for the {domain} field, starting from the fundamentals.</p>
                    </button>
                    <button className="choice-btn personalized" onClick={() => onGenerate(true)} disabled={isLoading}>
                        <h3>Generate Personalized Roadmap</h3>
                        <p>Analyzes your existing skills to skip topics you already know and focuses on your gaps.</p>
                    </button>
                </div>
                {isLoading && (
                    <div className="choice-loading">
                        <Loader2 size={20} className="spinner-sm" />
                        <span>Generating your roadmap... this may take a minute.</span>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Main Roadmap Component ---
export default function Roadmap() {
    const navigate = useNavigate();
    const location = useLocation(); // --- 3. Get location ---
    const [newDomain, setNewDomain] = useState("");
    const [activeRoadmaps, setActiveRoadmaps] = useState([]);
    const [selectedRoadmap, setSelectedRoadmap] = useState(null);
    const [selectedDomain, setSelectedDomain] = useState(null);
    const [selectedPersonalization, setSelectedPersonalization] = useState(false); // --- 4. Track personalization ---
    
    const canvasRef = useRef(null);
    const { apiFetch, isLoading, error, setError } = useApi();
    useParticleBackground(canvasRef);

    // Feedback State
    const [feedbackRating, setFeedbackRating] = useState(0);
    const [feedbackComment, setFeedbackComment] = useState("");
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
    const [feedbackSubmittedForId, setFeedbackSubmittedForId] = useState(null);

    const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
    const [checkingStepKey, setCheckingStepKey] = useState(null); 

    // --- 5. New Modal State ---
    const [isChoiceModalOpen, setIsChoiceModalOpen] = useState(false);
    const [domainForGeneration, setDomainForGeneration] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [currentStage, setCurrentStage] = useState(0);
    
    // --- 6. MODIFIED: handleSelectRoadmap ---
    // Now accepts a personalization flag
    const handleSelectRoadmap = useCallback(async (domainToSelect, isPersonalized = false) => {
        if (!domainToSelect || (isLoading && selectedDomain === domainToSelect && selectedPersonalization === isPersonalized)) {
             return;
        }
        setSelectedRoadmap(null);
        setSelectedDomain(domainToSelect);
        setSelectedPersonalization(isPersonalized); // Track what we're viewing
        setFeedbackRating(0);
        setFeedbackComment("");
        setFeedbackSubmittedForId(null);
        setIsSubmittingFeedback(false);
        setError(null);

        // Send the personalization flag in the request
        const data = await apiFetch(`/api/user/get-user-roadmap?domain=${encodeURIComponent(domainToSelect)}&is_personalized=${isPersonalized}`);

        if (data && data.id && Array.isArray(data.roadmap)) {
            // Fetch list to update completion percentages
             const listData = await apiFetch('/api/user/get-all-active-roadmaps');
             let completionPercentage = 0;
             if (listData) {
                 setActiveRoadmaps(listData);
                 const activeInfo = listData.find(r => r.id === data.id);
                 if (activeInfo) {
                     completionPercentage = activeInfo.completion_percentage;
                 }
             }
             setSelectedRoadmap({
                 ...data,
                 domain: domainToSelect,
                 completion_percentage: completionPercentage,
                 is_personalized: isPersonalized // Store this in state
             });
        } else if (!error) {
             setError(`Could not load roadmap details for ${domainToSelect}.`);
             setSelectedRoadmap(null);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiFetch, setError, isLoading, selectedDomain]); // Removed activeRoadmaps, selectedRoadmap

    useEffect(() => {
        const loadInitial = async () => {
            const listData = await apiFetch('/api/user/get-all-active-roadmaps');
            if (listData) {
                setActiveRoadmaps(listData);
                
                // --- 7. Check for domain from other pages (e.g., Skill Gap) ---
                const domainFromState = location.state?.domain;
                if (domainFromState) {
                    // Try to find a personalized roadmap first
                    const personalized = listData.find(r => r.domain === domainFromState && r.is_personalized);
                    if (personalized) {
                        handleSelectRoadmap(personalized.domain, true);
                    } else {
                        // Fallback to general
                        const general = listData.find(r => r.domain === domainFromState && !r.is_personalized);
                        if (general) {
                            handleSelectRoadmap(general.domain, false);
                        } else {
                            // No roadmap exists, open generation modal
                            setNewDomain(domainFromState);
                            setDomainForGeneration(domainFromState);
                            setIsChoiceModalOpen(true);
                        }
                    }
                } else if (listData.length > 0 && !selectedDomain) {
                    // Default to first roadmap if no state passed
                    handleSelectRoadmap(listData[0].domain, listData[0].is_personalized);
                }
            } else {
                setActiveRoadmaps([]);
            }
        };
        loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiFetch, location.state]); // Re-run if location state changes

    
    const handleDomainSelect = () => {
        if (!newDomain) { toast.error("Please select a domain."); return; }

        const isExistingGeneral = activeRoadmaps.some(r => r.domain === newDomain && !r.is_personalized);
        const isExistingPersonalized = activeRoadmaps.some(r => r.domain === newDomain && r.is_personalized);

        // If *any* version exists, just view it.
        // We default to viewing personalized if it exists.
        if (isExistingPersonalized) {
            handleSelectRoadmap(newDomain, true);
            return;
        }
        if (isExistingGeneral) {
            handleSelectRoadmap(newDomain, false);
            return;
        }

        // If it doesn't exist, check limit
        if (activeRoadmaps.length >= 2) { 
            toast.error("Max 2 active roadmaps allowed. Please delete one (feature coming soon)."); 
            return; 
        }
        setDomainForGeneration(newDomain);
        setIsChoiceModalOpen(true);
    };

    const handleConfirmGeneration = useCallback(async (isPersonalized) => {
        setIsGenerating(true);
        setError(null);
        setSelectedRoadmap(null); // Clear main view
        setSelectedDomain(domainForGeneration); // Set this so loading text shows
        setSelectedPersonalization(isPersonalized);
        setIsChoiceModalOpen(false); // Close modal

        const data = await apiFetch("/api/user/generate-roadmap", {
            method: "POST",
            body: JSON.stringify({ domain: domainForGeneration, is_personalized: isPersonalized })
        });
        
        setIsGenerating(false);

        if (data && data.id && Array.isArray(data.roadmap)) {
            const listData = await apiFetch('/api/user/get-all-active-roadmaps');
            if (listData) {
                setActiveRoadmaps(listData);
            }
            
            setSelectedRoadmap({
                ...data,
                id: data.id,
                domain: domainForGeneration,
                completion_percentage: 0, // It's new
                is_personalized: isPersonalized
            });
            setNewDomain("");
            toast.success(`Roadmap for ${domainForGeneration} generated!`);
        } else if (!error) {
            setError(`Failed to generate roadmap for ${domainForGeneration}.`);
            setSelectedRoadmap(null);
            setSelectedDomain(null);
        }
        // Error is handled by the main error effect
    }, [apiFetch, domainForGeneration, error, setError]);

    
    // --- (handleGoToTest is unchanged) ---
    const handleGoToTest = async (stepData, stageIndex, stepIndex) => {
        const stepKey = `${stageIndex}-${stepIndex}`; 
        if (!selectedRoadmap?.id || !stepData) {
            toast.error("Roadmap or step data is missing.");
            return;
        }
        if (isCheckingEligibility || isLoading || isGenerating) return; 

        setIsCheckingEligibility(true);
        setCheckingStepKey(stepKey); 
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
        setCheckingStepKey(null); 

        if (eligibilityData) {
            if (eligibilityData.eligible) {
                navigate('/QuizPage', {
                    state: {
                        step: stepData,
                        roadmapId: selectedRoadmap.id,
                        stageIndex,
                        stepIndex
                    }
                });
            } else {
                if (eligibilityData.reason === "cooldown_active") {
                    toast.error(`Please wait. You can retry this quiz in about ${eligibilityData.minutes_remaining} minute(s).`, { duration: 4000 });
                } else if (eligibilityData.reason === "already_completed" || eligibilityData.reason === "already_passed") {
                    toast.info("You have already passed the quiz for this step.", { duration: 4000 });
                    handleSelectRoadmap(selectedDomain, selectedPersonalization);
                } else {
                    toast.error("You are not eligible to take this quiz at this time.", { duration: 4000 });
                }
            }
        } else {
            toast.error(error || "Could not check quiz eligibility.");
        }
    };
    
    // --- (handleFeedbackSubmit is unchanged) ---
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
    const handleExportRoadmap = () => {
    if (!selectedRoadmap) return;

    let markdownString = `# Roadmap for: ${selectedRoadmap.domain}\n\n`;

    selectedRoadmap.roadmap.forEach((stage, stageIndex) => {
        markdownString += `## ${stage.stage_title || `Stage ${stageIndex + 1}`}\n\n`;

        stage.steps.forEach((step, stepIndex) => {
            markdownString += `### ${stepIndex + 1}. ${step.title}\n`;
            markdownString += `${step.description}\n\n`;
            markdownString += "#### Resources:\n";
            step.study_links.forEach(link => {
                markdownString += `* [${link.title} (${link.type})](${link.url})\n`;
            });
            markdownString += "\n";
        });
    });

    // Create a blob and download it
    const blob = new Blob([markdownString], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedRoadmap.domain}_Roadmap.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
    // Determine layout class
    const layoutClassName = `roadmap-page-container ${selectedRoadmap || (isGenerating && selectedDomain) ? 'layout-shifted' : ''}`;
    let currentTotalStepsCount = 0;

    return (
        <AnimatedPage>
            <div className={layoutClassName}>
                <canvas ref={canvasRef} className="live-background-canvas"></canvas>

                {/* --- Sidebar Controls --- */}
                <aside className="roadmap-controls">
                    <h1 className="roadmap-title">AI Digital Roadmap</h1>
                    
                    <div className="active-roadmaps-box">
                         <h2 className="active-roadmaps-title">Your Active Roadmaps</h2>
                         {isLoading && activeRoadmaps.length === 0 && !error && (<p className="no-active-roadmaps">Loading list...</p>)}
                         {error && activeRoadmaps.length === 0 && (<p className="roadmap-error small">Failed to load roadmaps.</p>)}
                         {!isLoading && activeRoadmaps.length > 0 && (
                             activeRoadmaps.map(roadmap => (
                                 <button key={roadmap.id} 
                                     className={`roadmap-card ${selectedRoadmap?.id === roadmap.id ? 'active' : ''}`} 
                                     onClick={() => handleSelectRoadmap(roadmap.domain, roadmap.is_personalized)} 
                                     disabled={isLoading || isGenerating}>
                                     <span className="roadmap-card-domain">
                                        {roadmap.domain}
                                        {roadmap.is_personalized 
                                            ? <span className="personalized-tag">Personalized</span>
                                            : <span className="general-tag">General</span>
                                        }
                                    </span>
                                     <CompletionBar percentage={roadmap.completion_percentage} />
                                 </button>
                             ))
                         )}
                         {!isLoading && activeRoadmaps.length === 0 && !error && (<p className="no-active-roadmaps">You have no active roadmaps yet.</p>)}
                    </div>
                    
                    <div className="generate-roadmap-box">
                         <h2 className="generate-roadmap-title">Add / View Roadmap</h2>
                         <p className="roadmap-subtitle">Select a path to view or generate (Max 2).</p>
                         <select value={newDomain} onChange={(e) => setNewDomain(e.target.value)} className="domain-select-roadmap" disabled={isLoading || isGenerating} >
                            <option value="">-- Select Career Path --</option>
                            <optgroup label="Software & Web Development"> <option value="Frontend Developer">Frontend Developer</option> <option value="Backend Developer">Backend Developer</option> <option value="Full Stack Developer">Full Stack Developer</option> <option value="DevOps Engineer">DevOps Engineer</option> <option value="Android Developer">Android Developer</option> <option value="iOS Developer">iOS Developer</option> </optgroup>
                            <optgroup label="AI & Data Science"> <option value="AI / Machine Learning Engineer">AI / ML Engineer</option> <option value="Data Scientist">Data Scientist</option> <option value="Data Analyst">Data Analyst</option> <option value="Data Engineer">Data Engineer</option> </optgroup>
                            <optgroup label="Cyber Security"> <option value="Cyber Security Analyst">Cyber Security Analyst</option> <option value="Penetration Tester">Penetration Tester</option> <option value="Security Engineer">Security Engineer</option> </optgroup>
                         </select>
                         <button className="generate-btn-roadmap" onClick={handleDomainSelect} disabled={isLoading || isGenerating || !newDomain} >
                             {isLoading && selectedDomain === newDomain ? 'Loading...' : (activeRoadmaps.some(r => r.domain === newDomain) ? 'View Selected Roadmap' : 'Generate New Roadmap')}
                         </button>
                    </div>
                    <button className="return-btn-roadmap" onClick={() => navigate('/dashboard')} disabled={isLoading || isGenerating} >
                        Return to Dashboard
                    </button>
                </aside>

                {/* --- Main Content Area --- */}
                <main className="roadmap-main-content">
                    {/* General Loading State */}
                    {(isLoading || isGenerating) && selectedDomain && !selectedRoadmap && !error && (
                         <div className="loading-spinner"> <div className="spinner"></div> <p>Loading roadmap for {selectedDomain}...</p> </div>
                    )}
                    {/* General Error State */}
                    {error && !isLoading && !isGenerating && (<div className="roadmap-error">{error}</div>)}
                    {/* Placeholder */}
                    {!isLoading && !isGenerating && !selectedRoadmap && !error && (
                         <div className="no-roadmap-placeholder"> <p>Your personalized roadmap will appear here.</p> <p>{activeRoadmaps.length > 0 ? 'Select an active roadmap or generate/select a new one.' : 'Generate a new roadmap to start.'}</p> </div>
                    )}

                    {/* Selected Roadmap Display */}
                    {selectedRoadmap && !isLoading && !isGenerating && (
                        <>
                            <div className="selected-roadmap-header">
                                <h2>Roadmap for: {selectedRoadmap.domain}</h2>
                                <button className="export-btn" onClick={handleExportRoadmap}><Download size={16} /> Export as Markdown</button>
                                {selectedRoadmap.is_personalized 
                                    ? <span className="personalized-tag large">Personalized</span>
                                    : <span className="general-tag large">General Roadmap</span>
                                }
                                <CompletionBar percentage={selectedRoadmap.completion_percentage || 0} />
                            </div>

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

                            {Array.isArray(selectedRoadmap.roadmap) && selectedRoadmap.roadmap.length > 0 && (
                                <div className="roadmap-minimap">
                                    {selectedRoadmap.roadmap.map((stage, index) => (
                                        <a 
                                            key={index} 
                                            href={`#stage-${index}`} 
                                            className={`minimap-pill ${currentStage === index ? 'active' : ''}`}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                const element = document.getElementById(`stage-${index}`);
                                                if (element) {
                                                    // Calculate offset for sticky header/minimap
                                                    const offset = 120; // Adjust this value as needed
                                                    const bodyRect = document.body.getBoundingClientRect().top;
                                                    const elementRect = element.getBoundingClientRect().top;
                                                    const elementPosition = elementRect - bodyRect;
                                                    const offsetPosition = elementPosition - offset;
                                                    
                                                    window.scrollTo({
                                                        top: offsetPosition,
                                                        behavior: 'smooth'
                                                    });
                                                }
                                                setCurrentStage(index);
                                            }}
                                        >
                                            {stage.stage_title}
                                        </a>
                                    ))}
                                </div>
                            )}

                            {/* --- 11. MODIFIED: Roadmap Timeline --- */}
                            <div className="roadmap-timeline-container">
                                <div className="road-line"></div>
                                {Array.isArray(selectedRoadmap.roadmap) && selectedRoadmap.roadmap.map((stage, stageIndex) => (
                                    <React.Fragment key={stageIndex}>
                                        {/* --- RENDER STAGE TITLE --- */}
                                        <div className="stage-title-container" id={`stage-${stageIndex}`}>
                                            <h3>{stage.stage_title || `Stage ${stageIndex + 1}`}</h3>
                                        </div>
                                        {Array.isArray(stage.steps) && stage.steps.map((step, stepIndex) => {
                                            currentTotalStepsCount++;
                                            const isLeft = (currentTotalStepsCount % 2 !== 0);
                                            const stepKey = `${stageIndex}-${stepIndex}`; 
                                            return (
                                                <div key={stepKey} className={`roadmap-step ${isLeft ? 'step-left' : 'step-right'} ${step.is_completed ? 'step-completed' : ''} ${!step.is_unlocked ? 'step-locked' : ''}`} >
                                                    <div className="step-milestone"><div className="milestone-number">{currentTotalStepsCount}</div></div>
                                                    
                                                    {/* The main content box is no longer a link */}
                                                    <div className={`step-content ${!step.is_unlocked ? 'disabled' : ''}`}>
                                                        <h3 className="step-title">{step.title || 'Untitled Step'}</h3>
                                                        <p className="step-description">{step.description || 'No description.'}</p>
                                                        
                                                        {/* --- NEW: Resource Links List --- */}
                                                        {Array.isArray(step.study_links) && step.study_links.length > 0 && (
                                                            <div className="step-resources-list">
                                                                <h4>Learning Resources:</h4>
                                                                {step.study_links.map((link, index) => (
                                                                    <a 
                                                                        key={index} 
                                                                        href={step.is_unlocked ? link.url : undefined} 
                                                                        target="_blank" 
                                                                        rel="noopener noreferrer" 
                                                                        className={`resource-link ${!step.is_unlocked ? 'disabled-link' : ''}`}
                                                                        onClick={(e) => { if (!step.is_unlocked) e.preventDefault(); }}
                                                                    >
                                                                        <ResourceIcon type={link.type} /> 
                                                                        <span>{link.title}</span>
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="step-actions">
                                                        {step.is_completed ? (
                                                            <span className="completion-status"> ✅ Completed (Score: {step.test_score ?? 'N/A'}%) </span>
                                                        ) : (
                                                            <button
                                                                className="test-btn"
                                                                onClick={() => handleGoToTest(step, stageIndex, stepIndex)}
                                                                disabled={!step.is_unlocked || isLoading || isCheckingEligibility || isGenerating}
                                                                title={step.is_unlocked ? "Take the quiz for this step" : "This step is locked"}
                                                            >
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

                {/* --- 12. NEW: Render Choice Modal --- */}
                {isChoiceModalOpen && (
                    <GenerationChoiceModal
                        domain={domainForGeneration}
                        onClose={() => setIsChoiceModalOpen(false)}
                        onGenerate={handleConfirmGeneration}
                        isLoading={isGenerating}
                    />
                )}
            </div>
        </AnimatedPage>
    );
}
