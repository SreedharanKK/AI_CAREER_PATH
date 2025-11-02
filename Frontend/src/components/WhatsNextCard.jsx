// src/components/WhatsNextCard.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Brain, Zap, Target } from 'lucide-react'; // Example icons
import '../Styles/WhatsNextCard.css'; // You'll need to create this CSS file

export default function WhatsNextCard({ data, isLoading, userName }) {
    const navigate = useNavigate();

    if (isLoading) {
        return (
            <div className="whats-next-card loading">
                <div className="spinner-sm"></div>
                <span>Figuring out your next step...</span>
            </div>
        );
    }

    if (!data) {
        return null; // Don't show anything if data fails to load
    }

    const { type, payload } = data;

    let icon, title, message, buttonText, link;

    switch (type) {
        case 'ROADMAP_STEP':
            icon = <Zap size={24} />;
            title = `Keep up the momentum, ${userName}!`;
            message = `Your next step is to learn: **${payload.title}**`;
            buttonText = "Go to Roadmap";
            link = payload.link;
            break;
            
        case 'PRACTICE_SKILLS':
            icon = <Brain size={24} />;
            title = "Let's sharpen your skills!";
            message = `We noticed you have a gap in **${payload.skill}**. Let's practice it.`;
            buttonText = "Go to Practice Hub";
            link = payload.link;
            break;

        case 'RUN_ANALYSIS':
            icon = <Target size={24} />;
            title = "Ready for the next challenge?";
            message = `Let's analyze your skills for the **${payload.domain}** domain to find your gaps.`;
            buttonText = "Run Skill Gap Analysis";
            link = payload.link;
            break;
            
        case 'WELCOME':
        default:
            icon = <span role="img" aria-label="wave">👋</span>;
            title = `Welcome, ${userName}!`;
            message = "Let's get your profile set up or generate your first career roadmap.";
            buttonText = "Get Started";
            link = payload.link;
    }

    return (
        <div className="whats-next-card" onClick={() => navigate(link)}>
            <div className="wn-icon">{icon}</div>
            <div className="wn-content">
                <h4>{title}</h4>
                <p dangerouslySetInnerHTML={{ __html: message }} /> {/* Use this to render <strong> tags */}
            </div>
            <button className="wn-button">
                {buttonText} <ArrowRight size={18} />
            </button>
        </div>
    );
}