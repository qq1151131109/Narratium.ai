"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Send, ArrowRight } from "lucide-react";

interface AgentUserInputProps {
  question: string;
  options?: string[];
  onResponse: (response: string) => void;
  isLoading?: boolean;
}

export default function AgentUserInput({ question, options, onResponse, isLoading }: AgentUserInputProps) {
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [customInput, setCustomInput] = useState<string>("");
  const [inputMode, setInputMode] = useState<"options" | "custom">(options && options.length > 0 ? "options" : "custom");

  const handleSubmit = () => {
    if (isLoading) return;
    
    const response = inputMode === "options" ? selectedOption : customInput;
    if (response.trim()) {
      onResponse(response.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-4"
    >
      <div className="flex items-start space-x-3 mb-4">
        <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
          <ArrowRight className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h4 className="text-[#7db3fd] font-medium text-sm mb-2">Agent is asking for input:</h4>
          <p className="text-[#7db3fd] text-sm whitespace-pre-wrap">{question}</p>
        </div>
      </div>

      {/* Options Mode */}
      {options && options.length > 0 && (
        <div className="space-y-3">
          <div className="flex space-x-2 text-xs">
            <button
              onClick={() => setInputMode("options")}
              className={`px-3 py-1 rounded-full transition-colors ${
                inputMode === "options"
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-black/20 text-[#7db3fd]/60 hover:text-[#7db3fd]"
              }`}
            >
              Choose from options
            </button>
            <button
              onClick={() => setInputMode("custom")}
              className={`px-3 py-1 rounded-full transition-colors ${
                inputMode === "custom"
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-black/20 text-[#7db3fd]/60 hover:text-[#7db3fd]"
              }`}
            >
              Custom input
            </button>
          </div>

          {inputMode === "options" && (
            <div className="grid gap-2">
              {options.map((option, index) => (
                <motion.button
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => setSelectedOption(option)}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    selectedOption === option
                      ? "bg-blue-500/20 border-blue-500/40 text-[#7db3fd]"
                      : "bg-black/20 border-blue-500/20 text-[#7db3fd]/80 hover:bg-black/30 hover:border-blue-500/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{option}</span>
                    {selectedOption === option && (
                      <div className="w-2 h-2 bg-blue-400 rounded-full" />
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Custom Input Mode */}
      {inputMode === "custom" && (
        <div className="space-y-3">
          <div className="relative">
            <textarea
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your response..."
              className="w-full bg-black/20 border border-blue-500/20 rounded-lg p-3 text-[#7db3fd] text-sm placeholder-[#7db3fd]/40 resize-none min-h-[80px] max-h-[160px] focus:outline-none focus:border-blue-500/40"
              disabled={isLoading}
            />
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end mt-4">
        <button
          onClick={handleSubmit}
          disabled={
            isLoading || 
            (inputMode === "options" && !selectedOption) || 
            (inputMode === "custom" && !customInput.trim())
          }
          className="flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-sky-400 text-black rounded-lg py-2 px-4 font-medium text-sm hover:from-blue-400 hover:to-sky-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black" />
              <span>Sending...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Send Response</span>
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
} 
