"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useLanguage } from "../app/i18n";
import UserTour from "@/components/UserTour";
import { useTour } from "@/hooks/useTour";

/**
 * Main content component for the home page
 * Renders the landing page with animations and interactive elements
 * 
 * @returns {JSX.Element} The rendered home page content
 */
export default function HomeContent() {
  const { t, fontClass, serifFontClass } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const { isTourVisible, currentTourSteps, completeTour, skipTour } = useTour();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex flex-col items-center justify-center h-full login-fantasy-bg relative overflow-hidden">
      {/* 渐变背景层1 - 粉色光晕 */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background: "radial-gradient(circle at 30% 20%, rgba(236, 72, 153, 0.15) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(168, 85, 247, 0.12) 0%, transparent 50%)",
        }}
      />

      {/* 渐变背景层2 - 柔和晕染 */}
      <div
        className="absolute inset-0 z-1"
        style={{
          background: "linear-gradient(135deg, rgba(219, 39, 119, 0.08) 0%, rgba(168, 85, 247, 0.1) 50%, rgba(236, 72, 153, 0.06) 100%)",
        }}
      />
      <div className="absolute inset-0 pointer-events-none z-10">
        <div className="absolute top-10 left-10 opacity-5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L15 8H21L16 12L18 18L12 14L6 18L8 12L3 8H9L12 2Z" fill="#5b9cfa" />
          </svg>
        </div>
        <div className="absolute top-20 right-20 opacity-5">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 0L12 6H18L13 10L15 16L10 12L5 16L7 10L2 6H8L10 0Z" fill="#5b9cfa" />
          </svg>
        </div>
        <div className="absolute bottom-20 left-1/4 opacity-5">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 0C3.6 0 0 3.6 0 8C0 12.4 3.6 16 8 16C12.4 16 16 12.4 16 8C16 3.6 12.4 0 8 0ZM8 2C11.3 2 14 4.7 14 8C14 11.3 11.3 14 8 14C4.7 14 2 11.3 2 8C2 4.7 4.7 2 8 2Z" fill="#85c5e3" />
          </svg>
        </div>
        <div className="absolute bottom-10 right-1/4 opacity-5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 0C5.4 0 0 5.4 0 12C0 18.6 5.4 24 12 24C18.6 24 24 18.6 24 12C24 5.4 18.6 0 12 0ZM12 4C16.4 4 20 7.6 20 12C20 16.4 16.4 20 12 20C7.6 20 4 16.4 4 12C4 7.6 7.6 4 12 4Z" fill="#a18d6f" />
          </svg>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="text-center max-w-2xl px-4 relative z-20"
      >
        <h1 className="text-5xl font-cinzel mb-6 bg-clip-text text-transparent bg-gradient-to-r from-rose-500 via-purple-400 to-pink-400 drop-shadow-[0_0_10px_rgba(236,72,153,0.5)]">
        YX-story
        </h1>

        <div className="flex flex-col md:flex-row gap-4 justify-center mt-6">
          <Link href="/character-cards">
            <motion.div
              className={`portal-button text-[#f9a8d4] hover:text-[#fbcfe8] text-sm px-6 py-2 border border-[#4a3b5c] rounded-md cursor-pointer ${fontClass} tracking-wide shadow-inner`}
              whileHover={{ scale: 1.03, backgroundColor: "rgba(45, 27, 46, 0.6)" }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
            >
              {t("homePage.immediatelyStart")}
            </motion.div>
          </Link>
        </div>
      </motion.div>
      <UserTour
        steps={currentTourSteps}
        isVisible={isTourVisible}
        onComplete={completeTour}
        onSkip={skipTour}
      />
    </div>
  );
} 
