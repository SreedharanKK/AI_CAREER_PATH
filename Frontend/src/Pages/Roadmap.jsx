import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../Styles/Roadmap.css';
import { useApi } from '../hooks/useApi';

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
    
    const { apiFetch, isLoading, error, setError } = useApi();

    // Variable to track total steps for alternating layout
    let totalStepsCount = 0;

    const fetchRoadmap = useCallback(async (selectedDomain) => {
        if (!selectedDomain) {
            setRoadmapData(null);
            return;
        }
        const data = await apiFetch(`/api/user/get-user-roadmap?domain=${selectedDomain}`);
        if (data) {
            setRoadmapData(data.roadmap ? data : null);
        }
    }, [apiFetch]);

    const handleGenerateRoadmap = useCallback(async () => {
        if (!domain) {
            setError("Please select a domain first.");
            return;
        }
        setRoadmapData(null);
        const data = await apiFetch("/api/user/generate-roadmap", {
            method: "POST",
            body: JSON.stringify({ domain })
        });
        if (data) {
            setRoadmapData(data);
        }
    }, [domain, apiFetch, setError]);

    // Effect to run only once on component mount to get the last used domain
    useEffect(() => {
        const fetchInitialDomain = async () => {
            const data = await apiFetch(`/api/user/get-last-generated-domain`);
            if (data?.last_domain) {
                setDomain(data.last_domain);
            }
        };
        fetchInitialDomain();
    }, [apiFetch]); // Add apiFetch here as a dependency, useCallback makes it stable.

    // ✅ FIX: This useEffect now ONLY depends on the domain changing.
    // It no longer has `isLoading` as a dependency, which was causing the infinite loop.
    useEffect(() => {
        if (domain) {
            fetchRoadmap(domain);
        } else {
            // If the user deselects the domain, clear the roadmap
            setRoadmapData(null);
        }
    }, [domain, fetchRoadmap]);

    const handleGoToTest = (stepData, stageIndex, stepIndex) => {
        if (roadmapData?.id) {
            navigate('/QuizPage', {
                state: {
                    step: stepData,
                    roadmapId: roadmapData.id,
                    stageIndex,
                    stepIndex
                }
            });
        } else {
            setError("Roadmap data is not available to start a quiz.");
        }
    };

    const layoutClassName = `roadmap-page-container ${roadmapData ? 'layout-shifted' : ''}`;

    return (
        <div className={layoutClassName}>
            <aside className="roadmap-controls">
                <h1 className="roadmap-title">AI Digital Roadmap</h1>
                <p className="roadmap-subtitle">Select a career path to view your progress or generate a new journey.</p>
                <select 
                    value={domain} 
                    onChange={(e) => setDomain(e.target.value)} 
                    className="domain-select-roadmap"
                    disabled={isLoading}
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
                    disabled={isLoading}
                >
                    Return to Dashboard
                </button>
            </aside>
            <main className="roadmap-main-content">
                {error && <div className="roadmap-error">{error}</div>}
                
                {isLoading && !roadmapData && (
                    <div className="loading-spinner">
                        <div className="spinner"></div>
                        <p>Loading your learning journey...</p>
                    </div>
                )}
                
                {!isLoading && !roadmapData && !error && (
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
                                            {step.is_unlocked ? (
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
                                            ) : (
                                                <div className="step-content-link disabled">
                                                    <div className="step-content">
                                                        <h3 className="step-title">
                                                            <ResourceIcon type={step.resource_type} />
                                                            {step.title}
                                                        </h3>
                                                        <p className="step-description">{step.description}</p>
                                                    </div>
                                                </div>
                                            )}
                                            
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
