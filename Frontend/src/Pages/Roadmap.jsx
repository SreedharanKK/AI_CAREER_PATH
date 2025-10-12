import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../Styles/Roadmap.css';

// A helper component to render icons based on the resource type
const ResourceIcon = ({ type }) => {
    const icons = {
        Course: '🎓',
        Video: '▶️',
        Article: '📄',
        Book: '📚',
        Project: '💻',
        Documentation: '📝',
        "Video Tutorial": '▶️',
        "Interactive Course": '🎓',
        "Project Idea": '💡',
        Default: '⭐'
    };
    const icon = icons[type] || icons['Default'];
    return <span className="resource-icon" title={type}>{icon}</span>;
};

export default function Roadmap() {
    const navigate = useNavigate();
    const [domain, setDomain] = useState("");
    const [roadmapData, setRoadmapData] = useState(null);
    const [isLoading, setIsLoading] = useState(true); // Start loading immediately
    const [error, setError] = useState(null);

    // --- Step 3: Memoized function to fetch an existing roadmap ---
    const fetchRoadmap = useCallback(async (selectedDomain) => {
        if (!selectedDomain) {
            setRoadmapData(null); // Clear roadmap if no domain is provided
            setIsLoading(false); // Stop loading if there's nothing to fetch
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`http://localhost:5000/api/user/get-user-roadmap?domain=${selectedDomain}`, {
                method: "GET",
                credentials: 'include',
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            setRoadmapData(data.roadmap ? data : null);
        } catch (err) {
            console.error("Error fetching roadmap:", err);
            setError(err.message || "Failed to fetch existing roadmap.");
        } finally {
            setIsLoading(false);
        }
    }, []); // Empty dependency array as it has no external dependencies from component state

    // --- Step 3: Memoized function to generate a new roadmap ---
    const handleGenerateRoadmap = useCallback(async () => {
        if (!domain) {
            setError("Please select a domain first.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setRoadmapData(null);
        try {
            const res = await fetch("http://localhost:5000/api/user/generate-roadmap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: 'include',
                body: JSON.stringify({ domain })
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            setRoadmapData(data);
        } catch (err) {
            console.error("Error generating roadmap:", err);
            setError(err.message || "Failed to generate the roadmap.");
        } finally {
            setIsLoading(false);
        }
    }, [domain]); // Depends only on the 'domain' state

    // --- Step 1: Effect to fetch the last generated domain on initial mount ---
    useEffect(() => {
        const fetchInitialDomain = async () => {
            setError(null);
            try {
                const res = await fetch(`http://localhost:5000/api/user/get-last-generated-domain`, {
                    credentials: 'include',
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.last_domain) {
                        // --- Step 2: Automatically set the domain state ---
                        setDomain(data.last_domain);
                        // The next useEffect will now trigger to fetch this domain's roadmap
                    } else {
                        setIsLoading(false); // No last domain, so we can stop the initial loading indicator
                    }
                } else {
                     setIsLoading(false); // Stop loading on HTTP error
                }
            } catch (err) {
                console.error("Error fetching initial domain:", err);
                setIsLoading(false); // Stop loading on fetch error
            }
        };
        fetchInitialDomain();
    }, []); // Runs only once on mount

    // --- Effect that runs whenever the 'domain' state changes ---
    useEffect(() => {
        // This will run both on initial load (if a last_domain was found)
        // and when the user manually changes the select dropdown.
        fetchRoadmap(domain);
    }, [domain, fetchRoadmap]); // Now depends on the stable fetchRoadmap function

    const handleGoToTest = (stepData, stageIndex, stepIndex) => {
        navigate('/QuizPage', {
            state: {
                step: stepData,
                roadmapId: roadmapData.id,
                stageIndex: stageIndex,
                stepIndex: stepIndex
            }
        });
    };

    const layoutClassName = `roadmap-page-container ${roadmapData ? 'layout-shifted' : ''}`;
    let totalStepsCount = 0;

    return (
        <div className={layoutClassName}>
            <aside className="roadmap-controls">
                <h1 className="roadmap-title">AI Digital Roadmap</h1>
                <p className="roadmap-subtitle">Select a career path to view your progress or generate a new journey.</p>
                <select 
                    value={domain} 
                    onChange={(e) => setDomain(e.target.value)} 
                    className="domain-select-roadmap"
                >
                    <option value="">-- Select Your Career Path --</option>
                    <optgroup label="Software & Web Development">
                        <option value="Frontend Developer">Frontend Developer</option>
                        <option value="Backend Developer">Backend Developer</option>
                        <option value="Full Stack Developer">Full Stack Developer</option>
                        <option value="DevOps Engineer">DevOps Engineer</option>
                        <option value="Android Developer">Android Developer</option>
                        <option value="iOS Developer">iOS Developer</option>
                    </optgroup>
                    <optgroup label="AI & Data Science">
                        <option value="AI / Machine Learning Engineer">AI / ML Engineer</option>
                        <option value="Data Scientist">Data Scientist</option>
                        <option value="Data Analyst">Data Analyst</option>
                        <option value="Data Engineer">Data Engineer</option>
                    </optgroup>
                    <optgroup label="Cyber Security">
                        <option value="Cyber Security Analyst">Cyber Security Analyst</option>
                        <option value="Penetration Tester">Penetration Tester</option>
                        <option value="Security Engineer">Security Engineer</option>
                    </optgroup>
                </select>
                <button 
                    className="generate-btn-roadmap" 
                    onClick={handleGenerateRoadmap} 
                    disabled={isLoading || !domain}
                >
                    {isLoading ? 'Loading...' : 'Generate/Refresh Roadmap'}
                </button>
                <button 
                    className="return-btn-roadmap" 
                    onClick={() => navigate('/dashboard')}
                >
                    Return to Dashboard
                </button>
            </aside>
            <main className="roadmap-main-content">
                {error && <div className="roadmap-error">{error}</div>}
                {isLoading && (
                    <div className="loading-spinner">
                        <div className="spinner"></div>
                        <p>Loading your learning journey...</p>
                    </div>
                )}
                {!isLoading && !roadmapData && (
                    <div className="no-roadmap-placeholder">
                        <p>Your personalized roadmap will appear here.</p>
                        <p>Select a career path to begin.</p>
                    </div>
                )}
                {roadmapData && (
                    <div className="roadmap-timeline-container">
                        <div className="road-line"></div>
                        {roadmapData.roadmap.map((stage, stageIndex) => (
                            <React.Fragment key={stageIndex}>
                                {stage.steps.map((step, stepIndex) => {
                                    totalStepsCount++;
                                    const isLeft = (totalStepsCount % 2 !== 0);
                                    return (
                                        <div 
                                            key={`${stageIndex}-${stepIndex}`} 
                                            className={`roadmap-step ${isLeft ? 'step-left' : 'step-right'} ${step.is_completed ? 'step-completed' : ''} ${!step.is_unlocked ? 'step-locked' : ''}`}
                                        >
                                            <div className="step-milestone">
                                                <div className="milestone-number">{totalStepsCount}</div>
                                            </div>
                                            <a 
                                                href={step.study_link} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="step-content-link"
                                            >
                                                <div className="step-content">
                                                    <h3 className="step-title">
                                                        <ResourceIcon type={step.resource_type} />
                                                        {step.title}
                                                    </h3>
                                                    <p className="step-description">{step.description}</p>
                                                </div>
                                            </a>
                                            <div className="step-actions">
                                                {step.is_completed ? (
                                                    <span className="completion-status">
                                                        ✅ Completed (Score: {step.test_score}%)
                                                    </span>
                                                ) : (
                                                    <button 
                                                        className="test-btn" 
                                                        onClick={() => handleGoToTest(step, stageIndex, stepIndex)}
                                                        disabled={!step.is_unlocked}
                                                    >
                                                        {step.is_unlocked ? 'Go to Test' : 'Locked'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

