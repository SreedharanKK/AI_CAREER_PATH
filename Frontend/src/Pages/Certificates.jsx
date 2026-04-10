import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, Download, ArrowLeft, ShieldCheck, Calendar, Hash, ExternalLink, X } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import useParticleBackground from '../hooks/UseParticleBackground';
import '../Styles/Certificates.css';
import toast from 'react-hot-toast';

export default function Certificates() {
    const [certs, setCerts] = useState([]);
    const [selectedCert, setSelectedCert] = useState(null);
    const [userName, setUserName] = useState("");
    const navigate = useNavigate();
    const canvasRef = useRef(null);
    const { apiFetch, isLoading, error } = useApi();

    useParticleBackground(canvasRef);

    useEffect(() => {
        const loadInitialData = async () => {
            const [certResponse, profileResponse] = await Promise.all([
                apiFetch('/api/user/certificates/my'),
                apiFetch('/api/user/profile')
            ]);
            
            if (certResponse && !certResponse.error) {
                setCerts(certResponse);
            }
            if (profileResponse && profileResponse.fullName) {
                setUserName(profileResponse.fullName);
            }
        };
        loadInitialData();
    }, [apiFetch]);

    // Safety Logic: Determines Gold/Silver/Bronze. Defaults to Bronze if score is missing.
    const getTierDetails = (score) => {
        if (score === undefined || score === null) return { label: "CERTIFIED", color: "#cd7f32" };
        const s = Number(score);
        if (s >= 95) return { label: "GOLD", color: "#d4af37" };
        if (s >= 85) return { label: "SILVER", color: "#a5a5a5" };
        return { label: "BRONZE", color: "#cd7f32" };
    };

    const handleDownload = () => {
        window.print();
    };

    if (isLoading && certs.length === 0) {
        return (
            <div className="certs-loading">
                <div className="spinner-large"></div>
                <p>Retrieving your credentials...</p>
            </div>
        );
    }

    return (
        <div className="certs-page-wrapper">
    <canvas ref={canvasRef} className="live-background-canvas"></canvas>
    
    <div className="certs-container">
        {/* --- HEADER SECTION FIXED --- */}
        <header className="certs-page-header">
            <div className="top-nav">
                <button className="back-btn" onClick={() => navigate('/Dashboard')}>
                    <ArrowLeft size={18} /> Back to Dashboard
                </button>
            </div>
            
            <div className="header-text-group">
                <h1 className="certs-main-title">Achievement Gallery</h1>
                <p className="certs-subtitle">Verified professional certifications earned through roadmap mastery.</p>
            </div>
        </header>

                <div className="certs-masonry">
                    {certs.length > 0 ? certs.map((cert) => {
                        const tier = getTierDetails(cert.score);
                        return (
                            <div key={cert.id} className="cert-tile" onClick={() => setSelectedCert(cert)}>
                                <div className="cert-tile-icon" style={{ color: tier.color }}>
                                    <Award size={36} />
                                </div>
                                <div className="cert-tile-body">
                                    <h3>{cert.domain_name}</h3>
                                    <div className="cert-meta">
                                        <span><Calendar size={12} /> {cert.issued_at ? cert.issued_at.split(' ')[0] : 'N/A'}</span>
                                        <span className="tier-badge-small" style={{ color: tier.color }}>
                                            {tier.label} TIER
                                        </span>
                                    </div>
                                </div>
                                <button className="tile-action-btn"><ExternalLink size={16} /> View</button>
                            </div>
                        );
                    }) : (
                        <div className="empty-cert-state">
                    <div className="empty-icon-wrapper">
                        <ShieldCheck size={80} className="faint-icon" />
                    </div>
                    <h2>No Certificates Earned</h2>
                    <p>Complete 100% of any roadmap and pass the verification stages to unlock your first professional credential.</p>
                    <button className="action-link-btn" onClick={() => navigate('/Roadmap')}>
                        View Active Roadmaps
                    </button>
                </div>
                    )}
                </div>
            </div>

            {selectedCert && (
                <div className="cert-modal-overlay" onClick={() => setSelectedCert(null)}>
                    <div className="cert-modal-box" onClick={e => e.stopPropagation()}>
                        <button className="modal-close-x" onClick={() => setSelectedCert(null)}><X size={24}/></button>
                        
                        <div className={`certificate-document tier-${getTierDetails(selectedCert.score).label.toLowerCase()}`} id="printable-certificate">
                            <div className="cert-border-outer">
                                <div className="cert-border-inner">
                                    <div className="cert-watermark">SKILLFLOW</div>
                                    
                                    <div className="cert-header-section">
                                        <div className="cert-logo-wrapper">
                                            <ShieldCheck size={45} color={getTierDetails(selectedCert.score).color} />
                                            <span className="logo-text" style={{color: getTierDetails(selectedCert.score).color}}>SKILLFLOW AI</span>
                                        </div>
                                        <h2 className="main-cert-title">CERTIFICATE OF COMPLETION</h2>
                                    </div>

                                    <div className="cert-content-section">
                                        <p className="intro-text">This serves to officially recognize that</p>
                                        <h1 className="user-display-name">{userName || "Valued Student"}</h1>
                                        <p className="intro-text">has successfully completed the comprehensive training and verified milestones in the domain of</p>
                                        <h2 className="domain-display-name">{selectedCert.domain_name?.toUpperCase()}</h2>
                                    </div>

                                    <div className="cert-footer-section">
                                        <div className="footer-col left-align">
                                            <div className="footer-info">
                                                <span className="info-label">DATE OF ISSUE</span>
                                                <span className="info-value">{selectedCert.issued_at ? selectedCert.issued_at.split(' ')[0] : 'N/A'}</span>
                                            </div>
                                            <div className="footer-info mt-4">
                                                <span className="info-label">CREDENTIAL ID</span>
                                                <span className="info-value hash-code">{selectedCert.certificate_hash}</span>
                                            </div>
                                        </div>

                                        <div className="footer-seal">
                                            <div className="gold-seal-outer" style={{ '--tier-color': getTierDetails(selectedCert.score).color }}>
                                                <div className="seal-inner-circle">
                                                    <span className="seal-letter">{getTierDetails(selectedCert.score).label[0]}</span>
                                                </div>
                                            </div>
                                            <span className="seal-caption" style={{ color: getTierDetails(selectedCert.score).color }}>
                                                {getTierDetails(selectedCert.score).label} AWARD
                                            </span>
                                            <span className="tier-subtext">ACHIEVEMENT TIER: {getTierDetails(selectedCert.score).label}</span>
                                        </div>

                                        <div className="footer-col right-align">
                                            <div className="signature-area">
                                                <div className="sig-line">Digitally Signed</div>
                                                <span className="sig-title">SkillFlow AI Verification Engine</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="modal-controls">
                            <button className="m-btn-cancel" onClick={() => setSelectedCert(null)}>Close</button>
                            <button className="m-btn-download" onClick={handleDownload}>
                                <Download size={18} /> Download as PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}