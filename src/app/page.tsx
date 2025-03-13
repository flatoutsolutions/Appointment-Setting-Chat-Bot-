import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import ChatInterface from './components/ChatInterface';

export default async function Home() {
  // Get the user session
  const { userId } = await auth();
  
  // If not signed in, redirect to sign-in page
  if (!userId) {
    redirect('/sign-in');
  }
  
  // Get user details
  const user = await currentUser();
  
  return (
    <main className="min-h-screen bg-gray-50">
      <ChatInterface />
    </main>
  );
}