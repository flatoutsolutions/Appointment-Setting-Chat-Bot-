"use client";

import { useState } from "react"; // Removed useEffect since it's not used
import { useUser, useAuth, SignInButton } from "@clerk/nextjs";
import ChatBubble from "./ChatBubble";

export default function ChatInterface() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isButtonVisible, setIsButtonVisible] = useState(true);
  const { isSignedIn, user, isLoaded: isUserLoaded } = useUser();
  const { isLoaded: isAuthLoaded } = useAuth();

  // Toggle chat open/closed
  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
    // Hide button when chat is open
    setIsButtonVisible(!isChatOpen);
  };

  // Wait for Clerk to load
  if (!isUserLoaded || !isAuthLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  // Show sign-in UI if not signed in
  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        <div className="text-center p-8 max-w-md bg-white rounded-xl shadow-lg">
          <h1 className="text-3xl font-bold mb-6 text-gray-800">Welcome to Our App</h1>
          <p className="mb-8 text-gray-600">Please sign in to continue and access your personalized chat assistant.</p>
          <div className="inline-block">
            <SignInButton mode="modal">
              <button className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg text-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-1">
                Sign In
              </button>
            </SignInButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Main content area */}
      <div className="container mx-auto p-6">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
          Welcome to Our App
        </h1>
        
        <div className="text-center mb-10">
          <p className="text-xl text-gray-700">
            Hello, <span className="font-semibold">{user?.firstName || "User"}</span>! How can we help you today?
          </p>
        </div>
        
        <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-md">
          <h2 className="text-2xl font-semibold mb-6 text-gray-800">About Our Service</h2>
          <p className="mb-4 text-gray-600 leading-relaxed">
            This is an app developed by minds at AgentGpt it will remember your chat history and you.
          </p>
          <p className="text-gray-600 leading-relaxed">
            Your chat history is saved even after you log out, and will be
            available when you log back in. Try asking the chatbot to remember information
            and see how it persists across sessions!
          </p>
          
          <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
            <p className="text-blue-800 font-medium">Pro Tip:</p>
            <p className="text-blue-700">Click the chat bubble in the bottom right to start a conversation with our AI assistant.</p>
          </div>
        </div>
      </div>

      {/* Chat bubble button with animation and label */}
      {isButtonVisible && (
        <div className="fixed bottom-6 right-6 flex flex-col items-end space-y-2">
          <div className="bg-blue-600 text-white py-2 px-4 rounded-lg shadow-md">
            <span>Need help? Chat with us!</span>
          </div>
          <button
            onClick={toggleChat}
            className="w-16 h-16 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-all transform hover:-translate-y-1 relative"
          >
            {/* Pulse effect */}
            <span className="absolute w-full h-full rounded-full bg-blue-500 opacity-30 animate-ping"></span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </button>
        </div>
      )}

      {/* Chat bubble component */}
      <ChatBubble isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  );
}