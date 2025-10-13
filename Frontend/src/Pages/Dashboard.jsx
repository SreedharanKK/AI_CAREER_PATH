import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUserCircle, faSignOutAlt, faTrophy, faRoute,
  faBullseye, faLightbulb, faBriefcase, faEdit, faFilePdf
} from '@fortawesome/free-solid-svg-icons';
import '../Styles/Dashboard.css';
import { useApi } from '../hooks/useApi'; // ✅ 1. Import the custom hook

export default function Dashboard() {
  const [userName, setUserName] = useState("Loading...");
  const [userDetails, setUserDetails] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [latestAnalysis, setLatestAnalysis] = useState(null);
  const [latestRoadmap, setLatestRoadmap] = useState(null);
  const [achievementsSummary, setAchievementsSummary] = useState(null);
  const [latestRecs, setLatestRecs] = useState(null);
  const navigate = useNavigate();

  // ✅ 2. Instantiate the hook
  const { apiFetch, isLoading, error } = useApi();

  // ✅ 3. Refactor useEffect to use the hook
  useEffect(() => {
    const fetchAllData = async () => {
      // Promise.all now uses the cleaner apiFetch function
      const [
        userRes,
        analysisRes,
        roadmapRes,
        recsRes,
        achievementsRes
      ] = await Promise.all([
        apiFetch('/api/user/profile'),
        apiFetch('/api/user/skill-gap/latest'),
        apiFetch('/api/user/roadmap/latest'),
        apiFetch('/api/user/learning-recommendations/latest'),
        apiFetch('/api/user/achievements/summary')
      ]);

      // No need for try/catch or 401 checks here; the hook handles it.
      // Just check if the data was returned successfully.
      if (userRes) {
        setUserName(userRes.fullName);
      }
      if (analysisRes?.analysis) {
        setLatestAnalysis(analysisRes.analysis);
      }
      if (roadmapRes?.roadmap) {
        setLatestRoadmap(roadmapRes.roadmap);
      }
      if (recsRes?.recommendations_summary) {
        setLatestRecs(recsRes.recommendations_summary);
      }
      if (achievementsRes?.summary) {
        setAchievementsSummary(achievementsRes.summary);
      }
    };

    fetchAllData();
  }, []); // The apiFetch function is stable, so we can keep the dependency array empty.

  // ✅ 4. Refactor handleViewProfile
  const handleViewProfile = async () => {
    // The hook simplifies this function significantly
    const data = await apiFetch('/api/user/details');
    
    if (data) {
      if (data.dob) {
        const dateObj = new Date(data.dob);
        if (!isNaN(dateObj)) {
          data.dob = dateObj.toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
          });
        }
      }
      setUserDetails(data);
      setShowProfile(true);
    }
  };

  const handleLogoutClick = () => setIsModalOpen(true);

  // ✅ 5. Refactor confirmLogout
  const confirmLogout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setIsModalOpen(false);
    navigate('/'); // Navigate after the hook clears the cookie
  };

  // ✅ 6. Add Loading and Error UI based on the hook's state
  if (isLoading && userName === "Loading...") {
    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <h2>Loading Dashboard...</h2>
        </div>
    );
  }

  if (error) {
     return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'red' }}>
            <h2>Error: {error}</h2>
        </div>
    );
  }
  
  return (
    <>
      <div className="dashboard-layout">
        <aside className="dashboard-sidebar">
          <div className="user-info">
            <FontAwesomeIcon icon={faUserCircle} className="user-icon" />
            <span className="user-name">{userName}</span>
          </div>
          <button className="sidebar-btn" onClick={handleViewProfile}>
            <span className="sidebar-btn-icon">✏️</span>
            View Profile
          </button>
          <button className="sidebar-btn logout-btn" onClick={handleLogoutClick}>
            <FontAwesomeIcon icon={faSignOutAlt} className="sidebar-btn-icon" />
            Logout
          </button>
        </aside>

        <main className="dashboard-main-content">
          {!showProfile ? (
            <div className="card-grid">
              {/* Achievements Card */}
              <div className="dashboard-card clickable" onClick={() => navigate('/Achievements')}>
                <div className="card-header">
                  <FontAwesomeIcon icon={faTrophy} className="card-icon" />
                  <h3>Your Achievements</h3>
                </div>
                <p className="card-description">View your completed milestones and courses.</p>
                {achievementsSummary ? (
                  <div className="analysis-preview">
                      <h4><span className="preview-icon">🌟</span> Progress Summary</h4>
                      <p><span className="preview-icon">🎓</span> Completed Courses: {achievementsSummary.completed_courses}</p>
                      <p><span className="preview-icon">📊</span> Analyses Performed: {achievementsSummary.skill_analyses_count}</p>
                  </div>
                ) : (
                  <p className="analysis-preview-none">Start learning to see your achievements!</p>
                )}
              </div>

              {/* Roadmap Card */}
              <div className="dashboard-card clickable" onClick={() => navigate('/Roadmap')}>
                <div className="card-header">
                  <FontAwesomeIcon icon={faRoute} className="card-icon" />
                  <h3>Career Path (Roadmap)</h3>
                </div>
                <p className="card-description">Your personalized journey to your dream job.</p>
                {latestRoadmap ? (
                    <div className="analysis-preview">
                        <h4><span className="preview-icon">📍</span>Latest Roadmap:</h4>
                        <p><strong><span className="preview-icon">🎯</span>Domain:</strong> {latestRoadmap.domain}</p>
                        {latestRoadmap.first_stage &&
                            <p><strong><span className="preview-icon">🚀</span>Starting Point:</strong> "{latestRoadmap.first_stage}"</p>
                        }
                    </div>
                ) : (
                    <p className="analysis-preview-none">No roadmap generated yet. Click to create one!</p>
                )}
              </div>

              {/* Skill Gap Analysis Card */}
              <div className="dashboard-card clickable" onClick={() => navigate('/SkillGapAnalysis')}>
                <div className="card-header">
                  <FontAwesomeIcon icon={faBullseye} className="card-icon" />
                  <h3>Skill Gap Analysis</h3>
                </div>
                <p className="card-description">Identify strengths and areas for improvement.</p>
                {latestAnalysis ? (
                    <div className="analysis-preview">
                        <h4><span className="preview-icon">📈</span>Latest Analysis:</h4>
                        <p><strong><span className="preview-icon">🎯</span>Domain:</strong> {latestAnalysis.interested_domain}</p>
                        {latestAnalysis.missing_skills && latestAnalysis.missing_skills.length > 0 &&
                            <p><strong><span className="preview-icon">🧠</span>Skills to learn:</strong> {latestAnalysis.missing_skills.join(', ')}</p>
                        }
                    </div>
                ) : (
                    <p className="analysis-preview-none">No analysis run yet. Click to find your skill gap!</p>
                )}
              </div>
              
              {/* Learning Recommendations Card */}
              <div className="dashboard-card clickable" onClick={() => navigate('/LearningRecommendations')}>
                <div className="card-header">
                  <FontAwesomeIcon icon={faLightbulb} className="card-icon" />
                  <h3>Learning Recommendations</h3>
                </div>
                <p className="card-description">AI-powered advice on what to learn next based on your profile.</p>
                {latestRecs ? (
                    <div className="analysis-preview">
                        <h4><span className="preview-icon">📚</span>Key Topics to Explore:</h4>
                        {latestRecs.topics && latestRecs.topics.length > 0 ? (
                           <p>{latestRecs.topics.join(', ')}</p>
                        ) : (
                           <p>No specific topics found in last recommendation.</p>
                        )}
                    </div>
                ) : (
                    <p className="analysis-preview-none">No recommendations generated yet. Click to get personalized advice!</p>
                )}
              </div>

              {/* Job Recommendations Card */}
              <div className="dashboard-card clickable full-width" onClick={() => navigate('/JobRecommendations')}>
                <div className="card-header">
                  <FontAwesomeIcon icon={faBriefcase} className="card-icon" />
                  <h3>Job Recommendations</h3>
                </div>
                <p className="card-description">Discover opportunities tailored to your profile.</p>
              </div>
            </div>
          ) : (
            <div className="profile-details">
              <h2>Your Profile</h2>
              <p><strong>Full Name:</strong> {userDetails?.fullName}</p>
              <p><strong>Email:</strong> {userDetails?.email}</p>
              <p><strong>Date of Birth:</strong> {userDetails?.dob}</p>
              <p><strong>Place:</strong> {userDetails?.place}</p>
              <p><strong>Degree:</strong> {userDetails?.degree}</p>
              <p><strong>Stream:</strong> {userDetails?.stream}</p>
              <p><strong>Skills:</strong> {userDetails?.skills?.join(", ")}</p>
              <p><strong>Domain:</strong> {userDetails?.domain?.join(", ")}</p>
              <p><strong>College:</strong> {userDetails?.college}</p>
              <p><strong>Year:</strong> {userDetails?.year}</p>
              {userDetails?.resume && (
                <a href={`http://localhost:5000/${userDetails.resume.replace(/\\/g, '/')}`} target="_blank" rel="noopener noreferrer" className="resume-btn">
                  <FontAwesomeIcon icon={faFilePdf} /> View Resume
                </a>
              )}
              <button className="update-btn" onClick={() => navigate('/UpdateDetails')}>
                Update Details
              </button>
              <button className="update-btn" style={{ backgroundColor: '#555', marginTop: '10px' }} onClick={() => setShowProfile(false)}>
                Return to Dashboard
              </button>
            </div>
          )}
        </main>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Confirm Logout</h2>
            <p>Are you sure you want to logout?</p>
            <div className="modal-actions">
              <button className="modal-btn modal-btn-cancel" onClick={() => setIsModalOpen(false)}>
                No, Cancel
              </button>
              <button className="modal-btn modal-btn-confirm" onClick={confirmLogout}>
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}