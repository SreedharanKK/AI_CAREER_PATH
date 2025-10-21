import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AnimatedPage from '../hooks/AnimatedPage';
import '../Styles/Roadmap.css';
import { useApi } from '../hooks/useApi';
import useParticleBackground from '../hooks/UseParticleBackground';

const ResourceIcon = ({ type }) => {
    const icons = { Course: '🎓', Video: '▶️', Article: '📄', Book: '📚', Project: '💻', Documentation: '📝', "Video Tutorial": '▶️', "Interactive Course": '🎓', "Project Idea": '💡', Default: '⭐' };
    const icon = icons[type] || icons['Default'];
    return <span className="resource-icon" title={type}>{icon}</span>;
};

const CompletionBar = ({ percentage }) => (
    <div className="completion-bar-container">
        <div className="completion-bar-track">
            <div className="completion-bar-fill" style={{ width: `${percentage}%` }}></div>
        </div>
        <span className="completion-bar-text">{percentage}%</span>
    </div>
);

export default function Roadmap() {
    const navigate = useNavigate();
    const [newDomain, setNewDomain] = useState(""); 
    const [activeRoadmaps, setActiveRoadmaps] = useState([]); 
    const [selectedRoadmap, setSelectedRoadmap] = useState(null); 
    
    const canvasRef = useRef(null);
    const { apiFetch, isLoading, error, setError } = useApi();
    useParticleBackground(canvasRef);
    let totalStepsCount = 0;

    const fetchActiveRoadmaps = useCallback(async () => {
        const data = await apiFetch('/api/user/get-all-active-roadmaps');
        if (data) {
            setActiveRoadmaps(data);
            if (data.length > 0 && !selectedRoadmap) {
                handleSelectRoadmap(data[0].domain);
            }
        }
    }, [apiFetch, selectedRoadmap]); 

    useEffect(() => {
        const fetchInitialList = async () => {
            const data = await apiFetch('/api/user/get-all-active-roadmaps');
            if (data) {
                setActiveRoadmaps(data);
                if (data.length > 0) {
                    handleSelectRoadmap(data[0].domain);
                }
            }
        };
        fetchInitialList();
    }, [apiFetch]);

    const handleSelectRoadmap = useCallback(async (domainToSelect) => {
        if (!domainToSelect) {
            setSelectedRoadmap(null);
            return;
        }
        setSelectedRoadmap(null); 
        const data = await apiFetch(`/api/user/get-user-roadmap?domain=${domainToSelect}`);
        if (data) {
            setSelectedRoadmap(data.roadmap ? data : null);
        }
    }, [apiFetch]); 

    const handleGenerateRoadmap = useCallback(async () => {
        if (!newDomain) {
            setError("Please select a domain to generate.");
            return;
        }
        const isExisting = activeRoadmaps.some(r => r.domain === newDomain);

        if (!isExisting && activeRoadmaps.length >= 2) {
            setError("You can only have 2 active roadmaps at a time. Please delete one to add another.");
            return;
        }
        
        setSelectedRoadmap(null); 
        const data = await apiFetch("/api/user/generate-roadmap", {
            method: "POST",
            body: JSON.stringify({ domain: newDomain })
        });
        
        if (data) {
            setSelectedRoadmap(data);
            setNewDomain(""); 
            fetchActiveRoadmaps(); 
        }
    }, [newDomain, activeRoadmaps, apiFetch, setError, fetchActiveRoadmaps]);

    
    const handleGoToTest = (stepData, stageIndex, stepIndex) => {
        if (selectedRoadmap?.id) {
            navigate('/QuizPage', { state: { step: stepData, roadmapId: selectedRoadmap.id, stageIndex, stepIndex } });
        } else {
            setError("Roadmap data is not available to start a quiz.");
        }
    };

    const layoutClassName = `roadmap-page-container ${selectedRoadmap ? 'layout-shifted' : ''}`;

    return (
        <AnimatedPage>
            <div className={layoutClassName}>
                <canvas ref={canvasRef} className="live-background-canvas"></canvas>

                <aside className="roadmap-controls">
                    <h1 className="roadmap-title">AI Digital Roadmap</h1>
                    
                    <div className="active-roadmaps-box">
                        <h2 className="active-roadmaps-title">Your Active Roadmaps</h2>
                        {activeRoadmaps.length > 0 ? (
                            activeRoadmaps.map(roadmap => (
                                <button 
                                    key={roadmap.id} 
                                    className={`roadmap-card ${selectedRoadmap?.id === roadmap.id ? 'active' : ''}`}
                                    onClick={() => handleSelectRoadmap(roadmap.domain)}
                                    disabled={isLoading && !selectedRoadmap}
                                >
                                    <span className="roadmap-card-domain">{roadmap.domain}</span>
                                    <CompletionBar percentage={roadmap.completion_percentage} />
                                </button>
                            ))
                        ) : (
                            <p className="no-active-roadmaps">You have no active roadmaps.</p>
                        )}
                    </div>

                    <div className="generate-roadmap-box">
                        <h2 className="generate-roadmap-title">Add a New Roadmap</h2>
                        <p className="roadmap-subtitle">Select a career path to generate a new journey (Max 2).</p>
                        <select value={newDomain} onChange={(e) => setNewDomain(e.target.value)} className="domain-select-roadmap" disabled={isLoading} >
                            <option value="">-- Select Career Path --</option>
                            <optgroup label="Software & Web Development"> <option value="Frontend Developer">Frontend Developer</option> <option value="Backend Developer">Backend Developer</option> <option value="Full Stack Developer">Full Stack Developer</option> <option value="DevOps Engineer">DevOps Engineer</option> <option value="Android Developer">Android Developer</option> <option value="iOS Developer">iOS Developer</option> </optgroup>
                            <optgroup label="AI & Data Science"> <option value="AI / Machine Learning Engineer">AI / ML Engineer</option> <option value="Data Scientist">Data Scientist</option> <option value="Data Analyst">Data Analyst</option> <option value="Data Engineer">Data Engineer</option> </optgroup>
                            <optgroup label="Cyber Security"> <option value="Cyber Security Analyst">Cyber Security Analyst</option> <option value="Penetration Tester">Penetration Tester</option> <option value="Security Engineer">Security Engineer</option> </optgroup>
                        </select>
                        <button className="generate-btn-roadmap" onClick={handleGenerateRoadmap} disabled={isLoading || !newDomain} >
                            {isLoading ? 'Generating...' : 'Generate New Roadmap'}
                        </button>
                    </div>
                    
                    <button className="return-btn-roadmap" onClick={() => navigate('/dashboard')} disabled={isLoading} >
                        Return to Dashboard
                    </button>
                </aside>
                
                <main className="roadmap-main-content">
                    {error && <div className="roadmap-error">{error}</div>}
                    
                    {isLoading && !selectedRoadmap && (
                        <div className="loading-spinner">
                            <div className="spinner"></div>
                            <p>Loading your learning journey...</p>
                        </div>
                    )}
                    
                    {!isLoading && !selectedRoadmap && !error && (
                        <div className="no-roadmap-placeholder">
                            <p>Your personalized roadmap will appear here.</p>
                            <p>{activeRoadmaps.length > 0 ? 'Select a roadmap to begin.' : 'Generate a new roadmap to start.'}</p>
                        </div>
                    )}
                    
                    {selectedRoadmap && (
                        <div className="roadmap-timeline-container">
                            <div className="road-line"></div>
                            {selectedRoadmap.roadmap.map((stage, stageIndex) => (
                                <React.Fragment key={stageIndex}>
                                    {stage.steps.map((step, stepIndex) => {
                                        totalStepsCount++;
                                        const isLeft = (totalStepsCount % 2 !== 0);
                                        return (
                                            <div key={`${stageIndex}-${stepIndex}`} className={`roadmap-step ${isLeft ? 'step-left' : 'step-right'} ${step.is_completed ? 'step-completed' : ''} ${!step.is_unlocked ? 'step-locked' : ''}`} >
                                                <div className="step-milestone"><div className="milestone-number">{totalStepsCount}</div></div>
                                                {step.is_unlocked ? (
                                                    <a href={step.study_link} target="_blank" rel="noopener noreferrer" className="step-content-link" >
                                                        <div className="step-content">
                                                            <h3 className="step-title"><ResourceIcon type={step.resource_type} /> {step.title}</h3>
                                                            <p className="step-description">{step.description}</p>
                                                        </div>
                                                    </a>
                                                ) : (
                                                    <div className="step-content-link disabled">
                                                        <div className="step-content">
                                                            <h3 className="step-title"><ResourceIcon type={step.resource_type} /> {step.title}</h3>
                                                            <p className="step-description">{step.description}</p>
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="step-actions">
                                                    {step.is_completed ? (
                                                        <span className="completion-status"> ✅ Completed (Score: {step.test_score}%) </span>
                                                    ) : (
                                                        <button className="test-btn" onClick={() => handleGoToTest(step, stageIndex, stepIndex)} disabled={!step.is_unlocked} >
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
        </AnimatedPage>
    );
}