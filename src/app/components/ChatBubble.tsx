"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { Message } from "../lib/chatService";

interface ChatBubbleProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChatBubble({ isOpen, onClose }: ChatBubbleProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGreeted, setHasGreeted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { getToken } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();

  // Get user's name (first name or from email if not available)
  const getUserName = () => {
    if (!user) return "there";
    
    if (user.firstName) return user.firstName;
    
    // If no first name, try to extract from email
    const email = user.emailAddresses[0]?.emailAddress;
    if (email) {
      const namePart = email.split('@')[0];
      // Capitalize first letter and remove numbers/special chars if desired
      return namePart.charAt(0).toUpperCase() + namePart.slice(1);
    }
    
    return "there"; // Fallback
  };

  // Send a greeting to the user
  const sendGreeting = async () => {
    if (!isUserLoaded || hasGreeted) return;
    
    const userName = getUserName();
    setIsLoading(true);
    
    try {
      const token = await getToken();
      
      // This sends a hidden prompt to the AI - it won't be displayed in the UI
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          message: `Hi, I'm a new user named ${userName}. Please introduce yourself briefly.`,
          isHiddenGreeting: true  // Add this flag to identify this as a hidden greeting
        }),
      });
  
      if (!response.ok) {
        throw new Error(`Failed to send greeting: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Only add the assistant's response to the messages
      setMessages([
        { role: "assistant", content: `Hello ${userName}! ${data.response}` }
      ]);
      
      setHasGreeted(true);
    } catch (error) {
      console.error("Error sending greeting:", error);
      // Add a fallback greeting if the API call fails
      setMessages([
        { role: "assistant", content: `Hello ${userName}! How can I help you today?` }
      ]);
      setHasGreeted(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Load chat history
  const fetchChatHistory = useCallback(async () => {
    try {
      setError(null);
      const token = await getToken();
      
      const response = await fetch("/api/chat", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch chat history: ${response.status}`);
      }
      
      const data = await response.json();
      const historyMessages = data.history || [];
      
      setMessages(historyMessages);
      
      // If there's no chat history, send a greeting
      if (historyMessages.length === 0 && !hasGreeted && isUserLoaded) {
        sendGreeting();
      }
    } catch (error) {
      console.error("Error fetching chat history:", error);
      setError("Failed to load chat history. Please try again.");
    }
  }, [getToken, hasGreeted, isUserLoaded]);

  // Effect to load chat history when the chat is opened
  useEffect(() => {
    if (isOpen && isUserLoaded) {
      fetchChatHistory();
    }
  }, [isOpen, fetchChatHistory, isUserLoaded]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message to API
  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput("");
    setError(null);
    
    // Optimistically add user message
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const token = await getToken();
      
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to send message: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Add assistant response
      setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
    } catch (error) {
      console.error("Error sending message:", error);
      setError("Failed to send message. Please try again.");
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Sorry, there was an error processing your message." },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function formatTime() {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  }

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-20 right-6 w-96 h-[500px] bg-white rounded-xl shadow-2xl flex flex-col border border-gray-200 overflow-hidden">
      {/* Chat header */}
      <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-xl flex justify-between items-center">
        <div className="flex items-center">
          <div className="w-2 h-2 rounded-full bg-green-400 mr-2"></div>
          <span className="font-semibold text-lg">Chat Assistant</span>
        </div>
        <button onClick={onClose} className="text-white hover:text-gray-200 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      {/* Messages container */}
      <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-3">
            {error}
          </div>
        )}
        
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8 bg-white p-6 rounded-lg shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 text-blue-500">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <p className="font-medium mb-1">Welcome to the Chat Assistant</p>
            <p>Ask me anything or start a conversation!</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`mb-4 ${
                msg.role === "user" ? "text-right" : "text-left"
              }`}
            >
              <div className="flex flex-col">
                <div className={`inline-block max-w-[85%] px-4 py-3 rounded-2xl ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white ml-auto rounded-tr-none"
                    : "bg-white text-gray-800 mr-auto rounded-tl-none shadow-sm border border-gray-200"
                }`}>
                  {msg.content}
                </div>
                <span className={`text-xs text-gray-500 mt-1 ${
                  msg.role === "user" ? "ml-auto" : "mr-auto"
                }`}>
                  {formatTime()}
                </span>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="text-left mb-4">
            <div className="inline-block max-w-[85%] px-4 py-3 rounded-2xl bg-white text-gray-800 mr-auto rounded-tl-none shadow-sm border border-gray-200">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input form */}
      <form onSubmit={sendMessage} className="p-4 border-t border-gray-200 bg-white">
        <div className="flex">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 p-3 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800 placeholder-gray-500 font-medium"
            disabled={isLoading}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white p-3 rounded-r-lg disabled:bg-blue-400 hover:bg-blue-700 transition-colors"
            disabled={isLoading || !input.trim()}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}