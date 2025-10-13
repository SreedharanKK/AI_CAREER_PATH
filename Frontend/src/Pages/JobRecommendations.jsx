import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../Styles/JobRecommendations.css'; 
import { useApi } from '../hooks/useApi'; // ✅ 1. Import the custom hook

export default function JobRecommendations() {
    const navigate = useNavigate();
    const [editableSkills, setEditableSkills] = useState("");
    const [completedCourses, setCompletedCourses] = useState({});
    const [jobResults, setJobResults] = useState(null);
    
    // ✅ 2. Instantiate the hook
    // We'll use the hook's isLoading for the initial page load
    // and its error state for any API call failures.
    const { apiFetch, isLoading, error } = useApi();
    
    // This local state is specific to the search button action
    const [isSearching, setIsSearching] = useState(false);

    // ✅ 3. Refactor useEffect to use the hook
    useEffect(() => {
        const fetchProfileForJobs = async () => {
            const data = await apiFetch('/api/user/get-profile-for-jobs');
            if (data) {
                setEditableSkills(data.skills.join(', '));
                setCompletedCourses(data.completed_courses_by_domain || {});
            }
        };
        fetchProfileForJobs();
    }, []); // apiFetch is stable, so the dependency array is correct

    // ✅ 4. Refactor handleSearchJobs to use the hook
    const handleSearchJobs = async () => {
        setIsSearching(true);
        setJobResults(null); 

        const payload = {
            skills: editableSkills.split(',').map(s => s.trim()).filter(s => s),
            completed_courses: completedCourses,
        };
        
        const data = await apiFetch('/api/user/search-jobs', {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        if (data) {
            setJobResults(data.jobs);
        }
        // The hook will set an error message if the API call fails
        setIsSearching(false);
    };

    return (
        <div className="jobs-page-container">
            <div className="jobs-header">
                <h1 className="jobs-title">AI-Powered Job Search</h1>
                <p className="jobs-subtitle">We've pre-filled your profile. Edit your skills and search for fresh job postings that match you!</p>
            </div>

            <div className="job-search-form">
                <div className="form-section">
                    <label>Your Skills (comma-separated):</label>
                    <textarea
                        className="skills-textarea-jobs"
                        value={editableSkills}
                        onChange={(e) => setEditableSkills(e.target.value)}
                        placeholder="e.g., Python, React, SQL..."
                        disabled={isLoading || isSearching} // Disabled on initial load AND search
                    />
                </div>
                <div className="form-section">
                    <label>Your Completed Roadmaps:</label>
                    <div className="completed-courses-list">
                        {/* ✅ 5. Use the hook's isLoading for initial load feedback */}
                        {isLoading ? <p>Loading your profile...</p> : 
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
                        {isSearching ? 'AI is Searching...' : 'Search for Jobs with AI'}
                    </button>
                     <button className="return-dashboard-btn" onClick={() => navigate('/dashboard')} disabled={isSearching}>
                         Return to Dashboard
                     </button>
                </div>
            </div>

            <div className="results-container">
                {isSearching && (
                    <div className="feedback-container">
                        <div className="spinner"></div>
                        <p>Searching LinkedIn & Naukri and analyzing jobs for you...</p>
                    </div>
                )}
                {/* ✅ 6. Use the hook's error state for centralized error display */}
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