// ../hooks/AnimatedPage.jsx

import { motion } from "framer-motion";

const animations = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

const AnimatedPage = ({ children }) => {
  return (
    <motion.div
      variants={animations}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.5 }}
      // 👇 THIS IS THE PROBLEM. DELETE THE ENTIRE 'style' PROP.
      // style={{ background: "#0B021D", height: "100%" }}
    >
      {children}
    </motion.div>
  );
};

export default AnimatedPage;