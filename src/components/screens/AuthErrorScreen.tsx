'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ShieldX, RotateCcw } from 'lucide-react';
import { PageTransition } from '@/lib/animations';

const AuthErrorScreen = ({ onRetry }: { onRetry: () => void }) => {
  return (
    <PageTransition>
      <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-6 safe-area-top safe-area-bottom bg-gradient-to-b from-red-50/50 to-background">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex flex-col items-center w-full max-w-sm"
        >
          {/* Error Icon */}
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="relative mb-8"
          >
            <div className="w-28 h-28 rounded-full bg-red-100 flex items-center justify-center">
              <ShieldX className="w-14 h-14 text-red-500" />
            </div>
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-center mb-2"
          >
            <h1 className="text-2xl md:text-3xl font-bold text-red-700 mb-2">
              Access Denied
            </h1>
          </motion.div>

          {/* Error Details Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="w-full max-w-sm"
          >
            <div className="bg-white rounded-2xl shadow-lg border border-red-200 p-6 space-y-4">
              <div className="flex items-start gap-3 p-3 bg-red-50 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Invalid Email Domain</p>
                  <p className="text-sm text-red-600 mt-1">
                    Please use your SQU university email (@squ.edu.om) to login. 
                    Non-SQU email addresses are not authorized to access the AWE System.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-[#1a5f2a]/5 rounded-xl">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-[#1a5f2a]">Required format:</span>{' '}
                  yourname@<span className="font-medium text-[#c9a227]">squ.edu.om</span>
                </p>
              </div>

              {/* Try Again Button */}
              <Button
                onClick={onRetry}
                className="w-full h-12 text-base font-semibold bg-[#1a5f2a] hover:bg-[#1a5f2a]/90 rounded-xl shadow-md shadow-[#1a5f2a]/20 ios-press transition-all duration-200"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Try Again with SQU Email
              </Button>
            </div>
          </motion.div>

          {/* Help text */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="text-center text-xs text-muted-foreground mt-8 max-w-xs"
          >
            If you believe this is an error, please contact the Center for Preparatory Studies IT support.
          </motion.p>
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default AuthErrorScreen;
