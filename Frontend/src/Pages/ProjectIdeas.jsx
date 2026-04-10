import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AnimatedPage from '../hooks/AnimatedPage';
import { useApi } from '../hooks/useApi';
import useParticleBackground from '../hooks/UseParticleBackground';
import { Code, Layers, Hammer, Sparkles, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import '../Styles/ProjectIdeas.css';

export default function ProjectIdeas() {
    const navigate = useNavigate();
    const { apiFetch, isLoading, error } = useApi();
    const [projects, setProjects] = useState([]);
    const canvasRef = useRef(null);
    useParticleBackground(canvasRef);

    useEffect(() => {
        const fetchProjects = async () => {
            const data = await apiFetch('/api/user/get-projects');
            if (data) setProjects(data);
        };
        fetchProjects();
    }, [apiFetch]);

    const handleGenerate = async () => {
        const toastId = toast.loading("AI Architect is designing your project...");
        const data = await apiFetch('/api/user/generate-project', { method: 'POST' });
        toast.dismiss(toastId);
        
        if (data) {
            setProjects(data);
            toast.success("New Project Blueprint Created!");
        } else {
            toast.error("Failed to generate project.");
        }
    };

    return (
        <AnimatedPage>
            <div className="projects-page">
                <canvas ref={canvasRef} className="live-background-canvas"></canvas>
                <div className="projects-container">
                    
                    <div className="projects-header">
                        <button className="back-btn" onClick={() => navigate('/dashboard')}>
                            <ChevronLeft size={20} /> Back
                        </button>
                        <h1><Hammer size={32} /> Build & Learn</h1>
                        <p>Practical project ideas tailored to your skills to fill your portfolio.</p>
                        <button className="generate-project-btn" onClick={handleGenerate} disabled={isLoading}>
                            {isLoading ? <span className="spinner-sm"></span> : <><Sparkles size={18} /> Generate New Idea</>}
                        </button>
                    </div>

                    <div className="projects-grid">
                        {projects.length === 0 && !isLoading && (
                            <div className="empty-state">
                                <p>No projects yet. Click "Generate New Idea" to start building!</p>
                            </div>
                        )}

                        {projects.map((project) => (
                            <div key={project.id} className="project-card">
                                <div className="card-header">
                                    <span className={`difficulty-tag ${project.difficulty?.toLowerCase()}`}>{project.difficulty}</span>
                                    <span className="project-date">{project.date}</span>
                                </div>
                                <h2>{project.title}</h2>
                                <p className="project-desc">{project.description}</p>
                                
                                <div className="tech-stack">
                                    <Code size={16} />
                                    {project.tech_stack.map(tech => <span key={tech} className="tech-tag">{tech}</span>)}
                                </div>

                                <div className="project-steps">
                                    <h4><Layers size={16} /> Development Steps:</h4>
                                    <ul>
                                        {project.steps.map((step, i) => (
                                            <li key={i}>{step}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="bonus-challenge">
                                    <strong>🔥 Bonus:</strong> {project.bonus_challenge}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </AnimatedPage>
    );
}