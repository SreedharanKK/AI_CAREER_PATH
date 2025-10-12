import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../Styles/JobRecommendations.css'; 

export default function JobRecommendations() {
    const navigate = useNavigate();
    const [editableSkills, setEditableSkills] = useState("");
    const [completedCourses, setCompletedCourses] = useState({}); // Now an object
    const [jobResults, setJobResults] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState(null);

    // --- 1. Fetch initial profile data on component mount ---
    useEffect(() => {
        const fetchProfileForJobs = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const res = await fetch('http://localhost:5000/api/user/get-profile-for-jobs', {
                    credentials: 'include',
                });
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
                }
                const data = await res.json();
                setEditableSkills(data.skills.join(', '));
                setCompletedCourses(data.completed_courses_by_domain || {});
            } catch (err) {
                console.error("Error fetching profile data:", err);
                setError(err.message || "Could not load your profile for job search.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchProfileForJobs();
    }, []);

    // --- 2. Function to trigger the AI job search ---
    const handleSearchJobs = async () => {
        setIsSearching(true);
        setError(null);
        setJobResults(null); // Clear previous results
        try {
            const payload = {
                skills: editableSkills.split(',').map(s => s.trim()).filter(s => s),
                completed_courses: completedCourses,
            };
            const res = await fetch('http://localhost:5000/api/user/search-jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            setJobResults(data.jobs);
        } catch (err) {
            console.error("Error searching for jobs:", err);
            setError(err.message || "The AI job search failed. Please try again.");
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="jobs-page-container">
            <div className="jobs-header">
                <h1 className="jobs-title">AI-Powered Job Search</h1>
                <p className="jobs-subtitle">We've pre-filled your profile. Edit your skills and search for fresh job postings that match you!</p>
            </div>

            {/* --- Search Input Section --- */}
            <div className="job-search-form">
                <div className="form-section">
                    <label>Your Skills (comma-separated):</label>
                    <textarea
                        className="skills-textarea-jobs"
                        value={editableSkills}
                        onChange={(e) => setEditableSkills(e.target.value)}
                        placeholder="e.g., Python, React, SQL..."
                        disabled={isLoading || isSearching}
                    />
                </div>
                <div className="form-section">
                    <label>Your Completed Roadmaps:</label>
                    <div className="completed-courses-list">
                        {isLoading ? <p>Loading courses...</p> : 
                            Object.keys(completedCourses).length > 0 ? (
                                Object.entries(completedCourses).map(([domain, courses]) => (
                                    <div key={domain} className="domain-group">
                                        <h4 className="domain-title">{domain}</h4>
                                        <div className="course-tags-container">
                                            {courses.map((course, i) => <span key={i} className="course-tag">{course}</span>)}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p>No completed courses found from your roadmaps.</p>
                            )
                        }
                    </div>
                </div>
                <div className="form-actions">
                    <button className="search-jobs-btn" onClick={handleSearchJobs} disabled={isLoading || isSearching}>
                        {isSearching ? 'Searching...' : 'Search for Jobs with AI'}
                    </button>
                     <button className="return-dashboard-btn" onClick={() => navigate('/dashboard')} disabled={isSearching}>
                        Return to Dashboard
                    </button>
                </div>
            </div>

            {/* --- Results Section --- */}
            <div className="results-container">
                {isSearching && (
                    <div className="feedback-container">
                        <div className="spinner"></div>
                        <p>Searching LinkedIn & Naukri and analyzing jobs for you...</p>
                    </div>
                )}
                {error && <div className="feedback-container"><p className="error-message">{error}</p></div>}
                {!isSearching && jobResults && (
                    <div className="jobs-grid">
                        {jobResults.map((job, index) => (
                             <a key={index} href={job.job_url} target="_blank" rel="noopener noreferrer" className="job-card-link">
                                <div className="job-card">
                                    <div className="job-card-header">
                                        <h3 className="job-title">{job.job_title}</h3>
                                        <p className="company-name">{job.company_name}</p>
                                    </div>
                                    <div className="job-details">
                                        <p><span className="detail-icon">📍</span> {job.location}</p>
                                        <p><span className="detail-icon">💰</span> {job.estimated_salary_lpa}</p>
                                    </div>
                                    <div className="job-skills">
                                        <h4>Why it's a good match:</h4>
                                        <p className="recommendation-reason">{job.recommendation_reason}</p>
                                    </div>
                                    <div className="view-job-btn">
                                        View Job Posting ↗
                                    </div>
                                </div>
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

