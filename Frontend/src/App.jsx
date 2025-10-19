import { Toaster } from 'react-hot-toast';
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from 'framer-motion';

import HomePage from './Pages/HomePage';
import Dashboard from './Pages/Dashboard';
import UpdateDetails from './Pages/UpdateDetails';
import SkillGapAnalysis from './Pages/SkillGapAnalysis';
import Roadmap from './Pages/Roadmap';
import QuizPage from './Pages/QuizPage';
import LearningRecommendations from './Pages/LearningRecommendations';
import Achievements from './Pages/Achievements';
import JobRecommendations from './Pages/JobRecommendations';


function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
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
    </AnimatePresence>
  );
}

function App() {
  return (
    <>
      <BrowserRouter>
        
        <AnimatedRoutes />
      </BrowserRouter>
      <Toaster position="top-center" />
    </>
  );
}

export default App;

