import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link'; // Added Link import
import ChatInterface from './components/ChatInterface';

export default async function Home() {
  try {
    // Get the user session
    const { userId } = await auth();
    
    // If not signed in, redirect to sign-in page
    if (!userId) {
      return redirect('/sign-in');
    }
    
    // No need to get user details here since we're not using them
    // The user details are fetched and used in the ChatInterface component
    
    return (
      <main className="min-h-screen bg-gray-50">
        <ChatInterface />
      </main>
    );
  } catch (error) {
    console.error("Error in Home page:", error);
    
    // Fallback UI in case of auth error
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-6 bg-white rounded-lg shadow-md">
          <h1 className="text-2xl font-bold mb-4">Authentication Error</h1>
          <p className="mb-4">There was a problem with authentication. Please try signing in again.</p>
          <Link 
            href="/sign-in" 
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Sign In
          </Link>
        </div>
      </main>
    );
  }
}