import { useState , useRef} from "react";
import { useNavigate } from "react-router-dom";
import "../Styles/HomePage.css";

export default function HomePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("signup");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [loginEmail, setLoginEmail] = useState("");

  // ✅ Initialize refs safely
  const otpRefs = Array.from({ length: 4 }, () => useRef(null));

  const handleOtpChange = (value, index) => {
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // only last digit
    setOtp(newOtp);

        // ✅ Auto move to next input
    if (value && index < otpRefs.length - 1) {
      otpRefs[index + 1].current?.focus();
    }
  };
  
  // ✅ Signup submit handler
  const handleSignupSubmit = async (e) => {
    e.preventDefault();

    const full_name = e.target[0].value;
    const email = e.target[1].value;
    const password = e.target[2].value;
    const confirm_password = e.target[3].value;

    if (password !== confirm_password) {
        alert("❌ Passwords do not match!");
        return; // Stop the submission
    }

    try {
      const res = await fetch("http://localhost:5000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name, email, password }),
      });

      const data = await res.json();
      console.log("Signup Response:", data);

      if (res.ok) {
        alert("✅ Signup Successful!");
        e.target.reset(); // clear form after success
        setActiveTab("login"); // ✅ move to login tab automatically
      } else {
        alert("❌ " + data.error);
      }
    } catch (err) {
      console.error("Error:", err);
      alert("⚠️ Server not responding");
    }
  };

  // ✅ Updated login submit handler
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    const email = e.target[0].value;
    const password = e.target[1].value;
    setLoginEmail(email); // store email for OTP verification

    try {
      const res = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      console.log("Login Response:", data);

      if (res.ok) {
        alert("✅ OTP sent to your email!");
        setOtpSent(true); // show OTP input section
      } else {
        alert("❌ " + data.error);
      }
    } catch (err) {
      console.error("Error:", err);
      alert("⚠️ Server not responding");
    }
  };

  // ✅ OTP verification handler
  const handleOtpVerify = async () => {
    const enteredOtp = otp.join(""); // join 4 digits

    try {
      const res = await fetch("http://localhost:5000/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", 
        body: JSON.stringify({ email: loginEmail, otp: enteredOtp }), // ✅ send email
      });

      const data = await res.json();
      console.log("OTP Verification Response:", data);

      if (res.ok) {
        alert("✅ OTP Verified! Redirecting to Dashboard...");
        navigate("/Dashboard");
      } else {
        alert("❌ " + data.error);
      }
    } catch (err) {
      console.error("Error:", err);
      alert("⚠️ Server not responding");
    }
  };

  return (
    <div className="homepage-container">
      {/* Website Info */}
      <div className="intro-section">
        <h1>AI Career Path Predictor & Skill Gap Analyzer</h1>
        <h3 className="tagline">
          Your personal AI mentor for skill growth & career success 🚀
        </h3>
        <p>
          Our platform helps students and professionals identify skill gaps,
          generate customized roadmaps, and stay job-ready with AI-powered
          analysis.
        </p>

        <ul className="features-list">
          <li>📌 Personalized learning roadmap based on your domain</li>
          <li>📌 AI-generated quizzes to track your skill progress</li>
          <li>📌 Resume analysis for final-year students</li>
          <li>📌 Smart job recommendations using LinkedIn</li>
          <li>📌 Secure OTP verification for account safety</li>
        </ul>

        <p className="why-choose">
          Unlike generic learning platforms, our AI understands your
          strengths and weaknesses, providing a step-by-step journey toward
          your dream job. Learn smarter, not harder!
        </p>
      </div>

      {/* Auth Card */}
      <div className="auth-card">
        {/* Tabs */}
        <div className="tab-buttons">
          <button
            className={activeTab === "signup" ? "active" : ""}
            onClick={() => {
              setActiveTab("signup");
              setOtpSent(false);
            }}
          >
            Sign Up
          </button>
          <button
            className={activeTab === "login" ? "active" : ""}
            onClick={() => {
              setActiveTab("login");
              setOtpSent(false);
            }}
          >
            Login
          </button>
        </div>

        {/* Signup */}
        {activeTab === "signup" && (
          <form className="form" onSubmit={handleSignupSubmit}>
            <input type="text" placeholder="Full Name" />
            <input type="email" placeholder="Email" />
            <input type="password" placeholder="Password" />
            <input type="password" placeholder="Re-enter Password" />
            <button className="btn-primary" type="submit">Sign Up</button>
          </form>
        )}

        {/* Login */}
        {activeTab === "login" && !otpSent && (
          <form onSubmit={handleLoginSubmit} className="form">
            <input type="email" placeholder="Email" />
            <input type="password" placeholder="Password" />
            <button className="btn-primary">Send OTP</button>
          </form>
        )}

        {/* OTP Verification */}
        {activeTab === "login" && otpSent && (
          <div className="otp-section">
            <p>Enter the OTP sent to your email</p>
            <div className="otp-inputs">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={otpRefs[i]}     // ✅ attach ref to each input
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(e.target.value, i)}
                />
              ))}
            </div>
            <button className="btn-success" type="button" onClick={handleOtpVerify}>
              Verify OTP
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
