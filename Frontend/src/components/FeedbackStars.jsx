// src/components/FeedbackStars.jsx
import React, { useState } from 'react';
import { Star } from 'lucide-react';
import '../Styles/FeedbackStars.css'; // Create this CSS file

const FeedbackStars = ({ currentRating, onRatingChange, disabled }) => {
    const [hoverRating, setHoverRating] = useState(0);

    const handleMouseOver = (index) => {
        if (!disabled) {
            setHoverRating(index);
        }
    };

    const handleMouseLeave = () => {
        if (!disabled) {
            setHoverRating(0);
        }
    };

    const handleClick = (index) => {
        if (!disabled) {
            onRatingChange(index);
        }
    };

    return (
        <div className={`stars-container ${disabled ? 'disabled' : ''}`}>
            {[1, 2, 3, 4, 5].map((index) => (
                <Star
                    key={index}
                    className={`star-icon ${
                        (hoverRating || currentRating) >= index ? 'filled' : ''
                    } ${hoverRating >= index ? 'hovered' : ''}`}
                    onMouseOver={() => handleMouseOver(index)}
                    onMouseLeave={handleMouseLeave}
                    onClick={() => handleClick(index)}
                    size={24} // Adjust size as needed
                />
            ))}
        </div>
    );
};

export default FeedbackStars;