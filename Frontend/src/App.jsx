import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import { BrowserRouter, Route, Routes } from "react-router-dom";
import './App.css'
import HomePage from './Pages/HomePage';
import Dashboard from './Pages/Dashboard';
import UpdateDetails from './Pages/UpdateDetails';
import SkillGapAnalysis from './Pages/SkillGapAnalysis';
import Roadmap from './Pages/Roadmap';
import QuizPage from './Pages/QuizPage';
import LearningRecommendations from './Pages/LearningRecommendations';
import Achievements from './Pages/Achievements';
import JobRecommendations from './Pages/JobRecommendations';

function App() {

  return (
    <BrowserRouter>
    <Routes>
      <Route path="/" element={<HomePage/>}/>
      <Route path='/Dashboard' element={<Dashboard/>}/>
      <Route path='/UpdateDetails' element={<UpdateDetails/>}/>
      <Route path='/SkillGapAnalysis' element={<SkillGapAnalysis/>}/>
      <Route path='/Roadmap' element={<Roadmap/>}/>
      <Route path='/QuizPage' element={<QuizPage/>}/>
      <Route path='/LearningRecommendations' element={<LearningRecommendations/>}/>
      <Route path='/Achievements' element={<Achievements/>}/>
      <Route path='/JobRecommendations' element={<JobRecommendations/>}/>
    </Routes>
    </BrowserRouter>
  )
}

export default App
