import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Bot, User } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import '../Styles/Chatbot.css';

export default function Chatbot() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { sender: 'ai', text: "Hi! I'm your AI Mentor. Stuck on a concept or need career advice? Ask me anything!" }
    ]);
    const [inputText, setInputText] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);
    const { apiFetch } = useApi();

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!inputText.trim()) return;

        const userMsg = { sender: 'user', text: inputText };
        
        // Optimistic update: Show user message immediately
        setMessages(prev => [...prev, userMsg]);
        setInputText("");
        setIsTyping(true);

        // Prepare history for backend (exclude the very first greeting if you want, or keep it)
        const historyPayload = messages.map(m => ({ sender: m.sender, text: m.text }));

        const data = await apiFetch('/api/user/chat', {
            method: 'POST',
            body: JSON.stringify({ 
                message: userMsg.text,
                history: historyPayload
            })
        });

        setIsTyping(false);

        if (data && data.reply) {
            setMessages(prev => [...prev, { sender: 'ai', text: data.reply }]);
        } else {
            setMessages(prev => [...prev, { sender: 'ai', text: "Sorry, I couldn't connect to the server. Please try again." }]);
        }
    };

    return (
        <div className={`chatbot-container ${isOpen ? 'open' : ''}`}>
            {/* Toggle Button */}
            {!isOpen && (
                <button className="chatbot-toggle-btn" onClick={() => setIsOpen(true)}>
                    <MessageCircle size={28} />
                </button>
            )}

            {/* Chat Window */}
            <div className="chatbot-window">
                <div className="chatbot-header">
                    <div className="header-title">
                        <Bot size={20} />
                        <span>AI Mentor</span>
                    </div>
                    <button className="close-btn" onClick={() => setIsOpen(false)}>
                        <X size={20} />
                    </button>
                </div>

                <div className="chatbot-messages">
                    {messages.map((msg, index) => (
                        <div key={index} className={`message ${msg.sender}`}>
                            {msg.sender === 'ai' && <div className="avatar ai"><Bot size={14} /></div>}
                            <div className="message-content">
                                {/* Simple formatting for code blocks could go here later */}
                                {msg.text}
                            </div>
                            {msg.sender === 'user' && <div className="avatar user"><User size={14} /></div>}
                        </div>
                    ))}
                    {isTyping && (
                        <div className="message ai typing">
                            <div className="avatar ai"><Bot size={14} /></div>
                            <div className="typing-indicator">
                                <span></span><span></span><span></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <form className="chatbot-input-area" onSubmit={handleSend}>
                    <input 
                        type="text" 
                        placeholder="Type your doubt..." 
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        disabled={isTyping}
                    />
                    <button type="submit" disabled={!inputText.trim() || isTyping}>
                        {isTyping ? <Loader2 size={18} className="spinner" /> : <Send size={18} />}
                    </button>
                </form>
            </div>
        </div>
    );
}