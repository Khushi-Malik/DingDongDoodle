import { motion, AnimatePresence } from "motion/react";

interface TutorialOverlayProps {
  step: "create-island" | "draw-maple" | "none";
  onDismiss: () => void;
}

export function TutorialOverlay({ step, onDismiss }: TutorialOverlayProps) {
  const messages: Record<string, { title: string; description: string }> = {
    "create-island": {
      title: "Welcome to Art Island! 🍁",
      description:
        "Your island modal is ready! Create 'Toronto' with a pink color. The name and color are already set for you.",
    },
    "draw-maple": {
      title: "Draw a Goose! 🦆",
      description:
        "Great! Now let's draw a character! Click 'Add Drawing' and draw a goose on the canvas. Be creative!",
    },
  };

  return (
    <AnimatePresence>
      {step !== "none" && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onDismiss}
        >
          {/* Tutorial Box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            transition={{ type: "spring", damping: 25 }}
            className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              {messages[step].title}
            </h2>
            <p className="text-gray-600 mb-6 text-lg">
              {messages[step].description}
            </p>
            <button
              onClick={onDismiss}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg hover:shadow-xl"
            >
              Got it!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
