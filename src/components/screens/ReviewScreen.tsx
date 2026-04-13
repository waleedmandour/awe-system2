'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Edit3,
  AlertCircle,
} from 'lucide-react';

// Animation variants
const slideInRight = {
  initial: { opacity: 0, x: 50 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -50 },
};

const slideInLeft = {
  initial: { opacity: 0, x: -50 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 50 },
};

// Page transition wrapper
const PageTransition = ({ children, direction = 'right' }: { children: React.ReactNode; direction?: 'left' | 'right' }) => (
  <motion.div
    variants={direction === 'right' ? slideInRight : slideInLeft}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={{ duration: 0.3, ease: 'easeOut' }}
    className="w-full h-full"
  >
    {children}
  </motion.div>
);

// Review Screen Component
const ReviewScreen = ({ onSubmit, onBack }: { onSubmit: (text: string) => void; onBack: () => void }) => {
  const { extractedText, setExtractedText, selectedCourse } = useAppStore();
  const [editedText, setEditedText] = useState(extractedText);
  const [isEditing, setIsEditing] = useState(false);

  const wordCount = editedText.trim().split(/\s+/).filter(Boolean).length;
  const charCount = editedText.length;

  const handleSubmit = () => {
    if (editedText.trim().length < 50) {
      return;
    }
    setExtractedText(editedText);
    onSubmit(editedText);
  };

  return (
    <PageTransition>
      <div className="min-h-screen min-h-[100dvh] flex flex-col safe-area-top safe-area-bottom">
        {/* Header */}
        <div className="p-4 border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="h-10 w-10 rounded-full"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div>
                <h2 className="font-semibold text-lg">Review Text</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedCourse?.code} • {wordCount} words
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsEditing(!isEditing)}
              className="h-10 w-10 rounded-full"
            >
              {isEditing ? <CheckCircle className="w-5 h-5 text-[#1a5f2a]" /> : <Edit3 className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {isEditing ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  placeholder="Your extracted essay text..."
                  className="min-h-[400px] text-base leading-relaxed resize-none border-0 shadow-lg"
                />
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-card rounded-xl border shadow-sm p-4"
              >
                <p className="text-base leading-relaxed whitespace-pre-wrap">
                  {editedText || (
                    <span className="text-muted-foreground italic">No text extracted. Please edit to add content.</span>
                  )}
                </p>
              </motion.div>
            )}
          </div>
        </ScrollArea>

        {/* Stats Bar */}
        <div className="px-4 py-3 border-t bg-muted/50 flex items-center justify-around">
          <div className="text-center">
            <p className="text-lg font-semibold text-[#1a5f2a]">{wordCount}</p>
            <p className="text-xs text-muted-foreground">Words</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <p className="text-lg font-semibold text-[#1a5f2a]">{charCount}</p>
            <p className="text-xs text-muted-foreground">Characters</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <p className="text-lg font-semibold text-[#c9a227]">
              {editedText.split(/[.!?]+/).filter(s => s.trim()).length}
            </p>
            <p className="text-xs text-muted-foreground">Sentences</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-white/80 backdrop-blur-sm space-y-3">
          {editedText.trim().length < 50 && (
            <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-sm text-amber-700 dark:text-amber-300">
                Please add more text (minimum 50 characters required).
              </AlertDescription>
            </Alert>
          )}
          <Button
            onClick={handleSubmit}
            disabled={editedText.trim().length < 50}
            className="w-full h-12 bg-[#1a5f2a] hover:bg-[#1a5f2a]/90 rounded-xl ios-press"
          >
            Submit for Assessment
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </PageTransition>
  );
};

export default ReviewScreen;
