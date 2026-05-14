import { auth } from '../services/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { Wine } from 'lucide-react';

export default function Login() {
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] text-white p-6">
      <div className="w-20 h-20 rounded-full bg-orange-500/10 flex items-center justify-center mb-8">
        <Wine className="w-10 h-10 text-orange-500" />
      </div>
      <h1 className="text-3xl font-bold mb-4">The Alchemist's Lab</h1>
      <p className="text-gray-400 mb-8 max-w-sm text-center">Manage your home bar and extract cocktail recipes using Gemini AI.</p>
      <button 
        onClick={handleLogin}
        className="px-8 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all"
      >
        Sign in with Google
      </button>
    </div>
  );
}
