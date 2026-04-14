'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Mail, Shield, LogIn, AlertTriangle } from 'lucide-react';
import { PageTransition } from '@/lib/animations';

const LoginScreen = ({ onLogin }: { onLogin: () => void }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn('google', {
        callbackUrl: '/', // Will be intercepted by client-side logic
        redirect: false,
      });

      if (result?.error) {
        // Check for specific error types
        if (result.error === 'AccessDenied' || result.url?.includes('auth-error')) {
          setError('Please use your SQU university email (@squ.edu.om) to login. Non-SQU email addresses are not allowed.');
        } else {
          setError(result.error);
        }
        setIsLoading(false);
      } else if (result?.ok) {
        // Successful sign-in — the session provider will handle updating state
        onLogin();
      }
    } catch (err) {
      console.error('Sign in error:', err);
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-6 safe-area-top safe-area-bottom bg-gradient-to-b from-[#1a5f2a]/5 to-background">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex flex-col items-center w-full max-w-sm"
        >
          {/* SQU Logo */}
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="relative mb-8"
          >
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl shadow-xl overflow-hidden bg-white p-3 border border-[#1a5f2a]/10">
              <img
                src="/squ_logo.png"
                alt="Sultan Qaboos University"
                className="w-full h-full object-contain"
              />
            </div>
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-center mb-2"
          >
            <h1 className="text-3xl md:text-4xl font-bold text-[#1a5f2a] mb-2">
              AWE System
            </h1>
            <p className="text-lg text-[#c9a227] font-medium">
              Automated Writing Evaluation
            </p>
          </motion.div>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="text-center text-muted-foreground max-w-xs mb-8 text-sm"
          >
            Center for Preparatory Studies
            <br />
            Sultan Qaboos University
          </motion.p>
        </motion.div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="w-full max-w-sm"
        >
          <div className="bg-white rounded-2xl shadow-lg border border-[#1a5f2a]/10 p-6 space-y-5">
            {/* Sign in with Google Button */}
            <Button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full h-14 text-base font-semibold bg-[#1a5f2a] hover:bg-[#1a5f2a]/90 rounded-xl shadow-md shadow-[#1a5f2a]/20 ios-press transition-all duration-200"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#ffffff"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    />
                    <path
                      fill="#ffffff"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#ffffff"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#ffffff"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Sign in with Google
                </div>
              )}
            </Button>

            {/* Info badges */}
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-[#1a5f2a]/5 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-[#1a5f2a]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Mail className="w-4 h-4 text-[#1a5f2a]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">SQU Email Required</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Use your SQU university email (@squ.edu.om) to continue
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-[#c9a227]/5 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-[#c9a227]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Shield className="w-4 h-4 text-[#c9a227]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Secure Access</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Your academic data is protected with institutional authentication
                  </p>
                </div>
              </div>
            </div>

            {/* Error Alert */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl"
              >
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Access Denied</p>
                  <p className="text-xs text-red-600 mt-0.5">{error}</p>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Footer text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="text-center text-xs text-muted-foreground mt-8"
        >
          By signing in, you agree to the AWE System terms of use
        </motion.p>
      </div>
    </PageTransition>
  );
};

export default LoginScreen;
