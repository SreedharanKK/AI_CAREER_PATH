// src/Pages/JobHistory.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AnimatedPage from '../hooks/AnimatedPage';
import '../Styles/JobHistory.css';
import { useApi } from '../hooks/useApi';
import useParticleBackground from '../hooks/UseParticleBackground';
import { 
    ChevronLeft, LayoutDashboard, History, Bookmark, BookmarkCheck, 
    FileText, X, Clipboard, ClipboardCheck, Loader2 
} from 'lucide-react'; // --- All imports are here ---
import toast from 'react-hot-toast';

const CoverLetterModal = ({ job, isOpen, onClose, onGenerate, letterText, isLoading }) => {
    const [hasCopied, setHasCopied] = useState(false);
    const textAreaRef = useRef(null); 

    useEffect(() => {
        // Trigger generation only when modal opens and text is empty
        if (isOpen && !letterText && !isLoading) {
            onGenerate(job);
        }
    }, [isOpen, letterText, isLoading, onGenerate, job]);

    const handleCopyToClipboard = () => {
        if (!letterText || !textAreaRef.current) return;
        
        textAreaRef.current.select();
        try {
            // Use document.execCommand as a fallback for robustness
            document.execCommand('copy');
            setHasCopied(true);
            toast.success("Copied to clipboard!");
            setTimeout(() => setHasCopied(false), 2000);
        } catch (err) {
            toast.error("Failed to copy text.");
            console.error('Failed to copy: ', err);
        }
    };

    return (
        <div className="modal-overlay-practice" onClick={onClose}>
            <div className="modal-content-practice cover-letter-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close-btn-history" onClick={onClose} aria-label="Close modal"><X size={24} /></button>
                <h2>AI Cover Letter Generator</h2>
                <div className="cover-letter-job-title">
                    For: {job.job_title} at {job.company_name}
                </div>
                
                {isLoading ? (
                    <div className="cover-letter-loading">
                        <Loader2 size={32} className="spinner-icon animate-spin" />
                        <p>AI is writing your cover letter...</p>
                        <p className="loading-subtext">This may take a moment.</p>
                    </div>
                ) : (
                    <div className="cover-letter-output">
                        <textarea
                            ref={textAreaRef}
                            value={letterText}
                            readOnly
                            placeholder="Your cover letter will appear here..."
                        />
                    </div>
                )}
                
                <div className="cover-letter-actions">
                    <button 
                        className="copy-btn" 
                        onClick={handleCopyToClipboard}
                        disabled={isLoading || !letterText}
                    >
                        {hasCopied ? <ClipboardCheck size={18} /> : <Clipboard size={18} />}
                        {hasCopied ? 'Copied!' : 'Copy to Clipboard'}
                    </button>
                    <button 
                        className="practice-q-btn secondary close-explain-modal" 
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- This is the component that had the prop error ---
// --- It now correctly accepts all 4 props ---
const SavedJobCard = ({ job, onUnsave, onGenerateLetter, isUnsaving }) => {
    return (
         <div className="history-job-card saved-job-card">
            <a href={job.job_url} target="_blank" rel="noopener noreferrer" className="history-job-card-link-main">
                <div className="job-card-header">
                    <h4 className="history-job-title">{job.job_title}</h4>
                    <button 
                        className="save-job-btn saved"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onUnsave(); // Call the prop directly
                        }}
                        title="Unsave this job"
                        disabled={isUnsaving === job.job_id} 
                    >
                        {isUnsaving === job.job_id ? <Loader2 size={18} className="spinner-sm" /> : <BookmarkCheck size={18} />}
                    </button>
                </div>
                <p className="history-job-company">{job.company_name}</p>
                <p className="history-job-location">{job.location}</p>
                <p className="saved-at-timestamp">Saved: {job.saved_at_timestamp}</p>
            </a>
            {/* --- Action button at the bottom --- */}
            <div className="card-actions">
                <button 
                    className="generate-letter-btn" 
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onGenerateLetter(job); 
                    }}
                >
                    <FileText size={16} /> Generate Cover Letter
                </button>
            </div>
         </div>
    );
};

export default function JobHistory() {
    const navigate = useNavigate();
    const [history, setHistory] = useState(null); 
    const canvasRef = useRef(null);
    const { apiFetch, isLoading, error, setError } = useApi();
    useParticleBackground(canvasRef);

    const [activeTab, setActiveTab] = useState('history'); 
    const [savedJobs, setSavedJobs] = useState(null); 
    const [isUnsaving, setIsUnsaving] = useState(null);
    const [isLetterModalOpen, setIsLetterModalOpen] = useState(false);
    const [coverLetterText, setCoverLetterText] = useState("");
    const [isGeneratingLetter, setIsGeneratingLetter] = useState(false);
    const [selectedJobForLetter, setSelectedJobForLetter] = useState(null);

    useEffect(() => {
        if (error) {
            toast.error(`Error: ${error}`);
            if (activeTab === 'history') setHistory([]);
            if (activeTab === 'saved') setSavedJobs([]);
            setIsGeneratingLetter(false); // Stop loading on error
            setIsUnsaving(null); // Stop unsaving on error
        }
    }, [error, activeTab]);

    useEffect(() => {
        const fetchHistory = async () => {
            setError(null);
            setHistory(null); 
            const data = await apiFetch('/api/user/job-history');
            if (data && Array.isArray(data.history)) {
                setHistory(data.history);
            } else if (!error) {
                setHistory([]);
            }
        };

        const fetchSavedJobs = async () => {
            setError(null);
            setSavedJobs(null); 
            const data = await apiFetch('/api/user/saved-jobs');
            if (data && Array.isArray(data.saved_jobs)) {
                setSavedJobs(data.saved_jobs);
            } else if (!error) {
                setSavedJobs([]);
            }
        };

        if (activeTab === 'history') {
            fetchHistory();
        } else if (activeTab === 'saved') {
            fetchSavedJobs();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiFetch, setError, activeTab]); 

    const handleUnsave = async (jobId) => {
        if (isUnsaving) return; 
        
        setIsUnsaving(jobId);
        setError(null);
        
        const data = await apiFetch(`/api/user/unsave-job/${jobId}`, {
            method: 'DELETE',
        });

        setIsUnsaving(null);
        if (data && data.success) {
            toast.success("Job unsaved!");
            setSavedJobs(prevJobs => prevJobs.filter(job => job.job_id !== jobId));
        } else {
            toast.error(error || "Failed to unsave job.");
        }
    };

    const handleGenerateLetterClick = (job) => {
        setSelectedJobForLetter(job);
        setIsLetterModalOpen(true);
        setCoverLetterText(""); 
    };

    const generateLetter = async (job) => {
        if (isGeneratingLetter) return;
        setIsGeneratingLetter(true);
        setError(null);

        const data = await apiFetch('/api/user/generate-cover-letter', {
            method: 'POST',
            body: JSON.stringify(job) 
        });

        setIsGeneratingLetter(false);
        if (data && data.cover_letter_text) {
            setCoverLetterText(data.cover_letter_text);
        } else {
            setCoverLetterText(error || "Failed to generate cover letter. The AI might be busy. Please try again.");
        }
    };

    const renderMainContent = () => {
        if (isLoading && ((activeTab === 'history' && !history) || (activeTab === 'saved' && !savedJobs))) { 
            return (
                <div className="history-feedback-container">
                    <div className="spinner"></div>
                    <p>Loading {activeTab === 'history' ? 'search history' : 'saved jobs'}...</p>
                </div>
            );
        }
        
        if (activeTab === 'history') {
            if (Array.isArray(history) && history.length === 0) {
                return (
                     <div className="history-feedback-container">
                         <p>No job search history found.</p>
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
                                        <a key={job.job_id} href={job.job_url} target="_blank" rel="noopener noreferrer" className="history-job-card-link-main">
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
        }

        if (activeTab === 'saved') {
             if (Array.isArray(savedJobs) && savedJobs.length === 0) {
                return (
                     <div className="history-feedback-container">
                         <p>You haven't saved any jobs yet.</p>
                         <p className="feedback-subtitle">Click the bookmark icon on a job in the Job Search page to save it here.</p>
                     </div>
                );
            }
             if (Array.isArray(savedJobs)) {
                return (
                    <div className="history-job-grid saved-jobs-grid">
                        {savedJobs.map((job) => (
                            <SavedJobCard 
                                key={job.job_id} 
                                job={job} 
                                onUnsave={() => handleUnsave(job.job_id)} 
                                onGenerateLetter={handleGenerateLetterClick}
                                isUnsaving={isUnsaving}
                            />
                        ))}
                    </div>
                );
            }
        }

        return null; // Fallback
    };

    return (
        <AnimatedPage>
            <div className="job-history-page">
                <canvas ref={canvasRef} className="live-background-canvas"></canvas>
                <div className="job-history-container">
                    <div className="job-history-header">
                        <History size={32} />
                        <h1>Job Activity</h1>
                    </div>
                    
                    <div className="job-history-actions">
                        <button className="history-nav-btn" onClick={() => navigate('/JobRecommendations')}>
                            <ChevronLeft size={18} /> Back to Search
                        </button>
                        <button className="history-nav-btn" onClick={() => navigate('/Dashboard')}>
                            <LayoutDashboard size={18} /> Go to Dashboard
                        </button>
                    </div>

                    {/* --- NEW: TABS --- */}
                    <div className="history-tabs">
                        <button 
                            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                            onClick={() => setActiveTab('history')}
                        >
                            <History size={16} /> Search History
                        </button>
                        <button 
                            className={`tab-btn ${activeTab === 'saved' ? 'active' : ''}`}
                            onClick={() => setActiveTab('saved')}
                        >
                            <Bookmark size={16} /> Saved Jobs
                        </button>
                    </div>

                    {renderMainContent()}
                    
                </div>
            </div>
            {isLetterModalOpen && selectedJobForLetter && (
                <CoverLetterModal
                    job={selectedJobForLetter}
                    isOpen={isLetterModalOpen}
                    onClose={() => setIsLetterModalOpen(false)}
                    onGenerate={generateLetter}
                    letterText={coverLetterText}
                    isLoading={isGeneratingLetter}
                />
            )}
        </AnimatedPage>
    );
}