// src/Pages/JobHistory.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AnimatedPage from '../hooks/AnimatedPage';
import '../Styles/JobHistory.css'; // <-- NEW CSS FILE
import { useApi } from '../hooks/useApi';
import useParticleBackground from '../hooks/UseParticleBackground';
import { ChevronLeft, LayoutDashboard, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';

export default function JobHistory() {
    const navigate = useNavigate();
    const [history, setHistory] = useState(null); // null: loading, []: empty, [...]: data
    const canvasRef = useRef(null);
    const { apiFetch, isLoading, error, setError } = useApi();
    useParticleBackground(canvasRef);

    useEffect(() => {
        const fetchHistory = async () => {
            setError(null);
            setHistory(null); // Set to loading
            const data = await apiFetch('/api/user/job-history');
            if (data && Array.isArray(data.history)) {
                setHistory(data.history);
            } else if (!error) {
                // Handle success but empty data
                setHistory([]);
            }
            // If error, 'history' remains null, and 'error' state is set
        };
        fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiFetch, setError]); // Removed error

    useEffect(() => {
        if (error) {
            toast.error(`Error: ${error}`);
            setHistory([]); // Set to empty on error to stop loading
        }
    }, [error]);

    const renderMainContent = () => {
        if (isLoading || history === null) {
            return (
                <div className="history-feedback-container">
                    <div className="spinner"></div>
                    <p>Loading your job search history...</p>
                </div>
            );
        }
        
        if (Array.isArray(history) && history.length === 0) {
            return (
                 <div className="history-feedback-container">
                    <p>No job recommendation history found.</p>
                </div>
            );
        }
        
        if (Array.isArray(history)) {
            return (
                <div className="history-list">
                    {history.map((item) => (
                        <div key={item.id} className="history-item-card">
                            <div className="history-item-header">
                                <span className="history-timestamp">{item.created_at}</span>
                                <span className="history-queries">
                                    <strong>Queries:</strong> {item.base_queries || 'N/A'}
                                </span>
                                <span className="history-locations">
                                    <strong>Locations:</strong> {Array.isArray(item.locations) ? item.locations.join(', ') : 'N/A'}
                                </span>
                            </div>
                            <div className="history-job-grid">
                                {Array.isArray(item.recommendations) && item.recommendations.map((job) => (
                                    <a key={job.job_id} href={job.job_url} target="_blank" rel="noopener noreferrer" className="history-job-card-link">
                                        <div className="history-job-card">
                                            <h4 className="history-job-title">{job.job_title}</h4>
                                            <p className="history-job-company">{job.company_name}</p>
                                            <p className="history-job-location">{job.location}</p>
                                        </div>
                                    </a>
                                ))}
                                {(!Array.isArray(item.recommendations) || item.recommendations.length === 0) && (
                                     <p className="no-jobs-found-history">No jobs were found for this search.</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        return null; // Fallback
    };

    return (
        <AnimatedPage>
            <div className="job-history-page">
                <canvas ref={canvasRef} className="live-background-canvas"></canvas>
                <div className="job-history-container">
                    <div className="job-history-header">
                        <Briefcase size={32} />
                        <h1>Job Recommendation History</h1>
                    </div>
                    
                    <div className="job-history-actions">
                        <button className="history-nav-btn" onClick={() => navigate('/JobRecommendations')}>
                            <ChevronLeft size={18} /> Back to Search
                        </button>
                        <button className="history-nav-btn" onClick={() => navigate('/Dashboard')}>
                            <LayoutDashboard size={18} /> Go to Dashboard
                        </button>
                    </div>

                    {renderMainContent()}
                    
                </div>
            </div>
        </AnimatedPage>
    );
}