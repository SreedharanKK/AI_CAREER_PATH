import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../Styles/UpdateDetails.css";

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

  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Fetch user details
  useEffect(() => {
    fetch("http://localhost:5000/api/user/details", {
      method: "GET",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        setFormData({
          fullName: data.fullName || "",
          email: data.email || "",
          dob: data.dob || "",
          place: data.place || "",
          degree: data.degree || "",
          stream: data.stream || "",
          skills: data.skills || [],
          domain: data.domain || [],
          college: data.college || "",
          year: data.year || "",
          resume: null,
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching user details:", err);
        setLoading(false);
      });
  }, []);

  const handleChange = (e) => {
    const { name, value, files } = e.target;

    if (name === "skills" || name === "domain") {
      setFormData((prev) => ({
        ...prev,
        [name]: value.split(",").map((v) => v.trim()),
      }));
    } else if (name === "resume") {
      setFormData((prev) => ({ ...prev, resume: files[0] }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Make resume mandatory only for final year students
    if (formData.year === "final" && !formData.resume) {
      alert("Resume is mandatory for final year students.");
      return;
    }

    const dataToSend = new FormData();
    Object.keys(formData).forEach((key) => {
      if (key === "skills" || key === "domain") {
        dataToSend.append(key, JSON.stringify(formData[key]));
      } else {
        dataToSend.append(key, formData[key]);
      }
    });

    try {
      const res = await fetch("http://localhost:5000/api/user/update", {
        method: "POST",
        body: dataToSend,
        credentials: "include",
      });

      const result = await res.json();
      if (result.success) {
        alert("Details updated successfully!");
        navigate("/dashboard?section=personal");
      } else {
        alert("Update failed. Please try again.");
      }
    } catch (err) {
      console.error("Error updating details:", err);
      alert("Something went wrong!");
    }
  };

  if (loading) {
    return <div className="loading">Loading details...</div>;
  }

  return (
    <div className="update-details-container">
      <h2>Update Your Details</h2>
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
          Skills (comma separated):
          <input
            type="text"
            name="skills"
            value={formData.skills.join(", ")}
            onChange={handleChange}
          />
        </label>

        <label>
          Domain (comma separated):
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

        {/* Resume field always visible */}
        <label>
          Resume:
          <input
            type="file"
            name="resume"
            onChange={handleChange}
            required={formData.year === "final"} // Required only if final year
          />
        </label>

        <button type="submit" className="save-btn">
          Save
        </button>
      </form>
    </div>
  );
}
