import { useState, useEffect, useRef } from "react"; // ✅ 1. Added useRef
import { useNavigate } from "react-router-dom";
import AnimatedPage from "../hooks/AnimatedPage";
import toast from 'react-hot-toast';
import "../Styles/UpdateDetails.css";
import { useApi } from "../hooks/useApi";
import useParticleBackground from "../hooks/UseParticleBackground";

export default function UpdateDetails() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    dob: "",
    place: "",
    degree: "",
    stream: "",
    skills: [],
    domain: [],
    college: "",
    year: "",
    resume: null,
  });
  
  const { apiFetch, isLoading, error } = useApi();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  useParticleBackground(canvasRef);

  // useEffect for fetching initial details
  useEffect(() => {
    const fetchDetails = async () => {
      const data = await apiFetch("/api/user/details");
      if (data) {
        setFormData({
          fullName: data.fullName || "",
          email: data.email || "",
          dob: data.dob ? new Date(data.dob).toISOString().split('T')[0] : "",
          place: data.place || "",
          degree: data.degree || "",
          stream: data.stream || "",
          skills: data.skills || [],
          domain: data.domain || [],
          college: data.college || "",
          year: data.year || "",
          resume: null, 
        });
      }
    };
    fetchDetails();
  }, []); 

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "skills" || name === "domain") {
      const items = value.split(",").map((v) => v.trim()).filter(v => v);
      setFormData((prev) => ({ ...prev, [name]: items }));
    } else if (name === "resume") {
      setFormData((prev) => ({ ...prev, resume: files[0] }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.year === "final" && !formData.resume) {
      const details = await apiFetch("/api/user/details"); 
      if (!details?.resume) {
          toast.error("Resume is mandatory for final year students and none is on file.");
          return;
      }
    }

    const dataToSend = new FormData();
    Object.keys(formData).forEach((key) => {
      if (key === "skills" || key === "domain") {
        dataToSend.append(key, JSON.stringify(formData[key]));
      } else if (formData[key] !== null) {
        dataToSend.append(key, formData[key]);
      }
    });

    const result = await apiFetch("/api/user/update", {
      method: "POST",
      body: dataToSend, 
    });

    if (result?.success) {
      toast.success("Details updated successfully!");
      navigate("/dashboard");
    } else if (error) {
      toast.error(`Update failed: ${error}`);
    }
  };

  // ✅ 4. Refactored return to include canvas and conditional logic
  return (
    <AnimatedPage>
        <>
      <canvas ref={canvasRef} className="live-background-canvas"></canvas>

      {(isLoading && !formData.email) ? (
        <div className="loading">Loading your details...</div>
      ) : (
        <div className="update-details-container">
          <h2>Update Your Details</h2>
          {error && <p style={{color: 'red', textAlign: 'center'}}>{error}</p>}
          
          <form className="update-form" onSubmit={handleSubmit}>
            <label>
              Full Name:
              <input type="text" name="fullName" value={formData.fullName} readOnly />
            </label>

            <label>
              Email:
              <input type="email" name="email" value={formData.email} readOnly />
            </label>

            <label>
              Date of Birth:
              <input type="date" name="dob" value={formData.dob} onChange={handleChange} />
            </label>

            <label>
              Place:
              <input type="text" name="place" value={formData.place} onChange={handleChange} />
            </label>

            <label>
              Degree:
              <input type="text" name="degree" value={formData.degree} onChange={handleChange} />
            </label>

            <label>
              Stream:
              <input type="text" name="stream" value={formData.stream} onChange={handleChange} />
            </label>

            <label>
              Skills (comma-separated):
              <input
                type="text"
                name="skills"
                value={formData.skills.join(", ")}
                onChange={handleChange}
              />
            </label>

            <label>
              Domain (comma-separated):
              <input
                type="text"
                name="domain"
                value={formData.domain.join(", ")}
                onChange={handleChange}
              />
            </label>

            <label>
              College:
              <input type="text" name="college" value={formData.college} onChange={handleChange} />
            </label>

            <label>
              Year:
              <select name="year" value={formData.year} onChange={handleChange}>
                <option value="">Select</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="final">Final Year</option>
              </select>
            </label>

            <label>
              Upload New Resume (optional, unless final year):
              <input
                type="file"
                name="resume"
                accept=".pdf"
                onChange={handleChange}
              />
            </label>

            <button type="submit" className="save-btn" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save'}
            </button>
          </form>
        </div>
      )}
    </>
    </AnimatedPage>
  );
}