import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import heroImg from "@/assets/hero-illustration.png";

const Welcome = () => {
  const navigate = useNavigate();

  const startLearner = () => {
    navigate("/student/join");
  };

  return (
    <div className="mobile-container flex flex-col items-center justify-between bg-background px-6 py-10">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mt-8"
      >
        <h1 className="text-4xl font-extrabold text-gradient-kinaiya tracking-tight">
          KINAIYA
        </h1>
        <p className="text-sm text-muted-foreground mt-1 font-body">
          Your Inner Character, Your Excellence
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="my-8"
      >
        <img
          src={heroImg}
          alt="Filipino child reading with AI assistance"
          className="w-72 h-72 object-cover rounded-3xl shadow-kinaiya"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="w-full space-y-4 text-center"
      >
        <p className="text-foreground font-display text-lg font-semibold">
          AI-Powered Reading Companion
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed px-4">
          Enhancing Filipino learners' English reading through adaptive, offline-capable AI intervention.
        </p>

        <div className="space-y-3 pt-4">
          <button
            onClick={() => navigate("/student/join")}
            className="w-full py-4 rounded-2xl bg-gradient-kinaiya text-primary-foreground font-display font-bold text-lg shadow-kinaiya active:scale-[0.98] transition-transform"
          >
            I'm a Student
          </button>
          <button
            onClick={() => navigate("/teacher")}
            className="w-full py-4 rounded-2xl bg-card border-2 border-border text-foreground font-display font-bold text-lg active:scale-[0.98] transition-transform"
          >
            I'm a Teacher
          </button>

        </div>
      </motion.div>
    </div>
  );
};

export default Welcome;
