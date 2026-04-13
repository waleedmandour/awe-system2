'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, type Course, SUMMARY_SOURCE_TEXTS } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  BookOpen,
  CheckCircle,
  FileText,
  Award,
  ClipboardList,
} from 'lucide-react';
import { PageTransition } from '@/lib/animations';

// Course Selection Screen
const CourseSelectionScreen = ({ onSelect, onBack }: { onSelect: () => void; onBack: () => void }) => {
  const { courses, selectedCourse, setSelectedCourse, selectedExamType, setSelectedExamType, selectedWritingType, setSelectedWritingType, selectedSourceTextId, setSelectedSourceTextId } = useAppStore();
  const [activeTab, setActiveTab] = useState<'foundation' | 'credit'>('foundation');

  // Whether the currently selected course requires an exam-type choice
  const needsExamType = selectedCourse?.code === '0340';

  // Whether the currently selected course requires a writing-type choice
  const needsWritingType = selectedCourse?.code === 'LANC2160';
  const needsSourceText = needsWritingType && selectedWritingType === 'summary';

  // Whether the Continue button should be enabled
  const canContinue = selectedCourse && (!needsExamType || selectedExamType) && (!needsWritingType || selectedWritingType) && (!needsSourceText || selectedSourceTextId);

  const filteredCourses = courses.filter((course) => {
    if (activeTab === 'credit') return course.program === 'post-foundation';
    return course.program === activeTab;
  });

  const handleSelectCourse = (course: Course) => {
    setSelectedCourse(course);
  };

  return (
    <PageTransition>
      <div className="min-h-screen min-h-[100dvh] flex flex-col safe-area-top safe-area-bottom">
        {/* Header */}
        <div className="p-4 border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
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
              <h2 className="font-semibold text-lg">Select Course</h2>
              <p className="text-sm text-muted-foreground">Choose your writing course</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="p-4 pb-0">
          <Tabs value={activeTab} onValueChange={(v) => {
            setActiveTab(v as 'foundation' | 'credit');
          }}>
            <TabsList className="w-full h-12 p-1 bg-muted rounded-xl">
              <TabsTrigger
                value="foundation"
                className="flex-1 h-10 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                <GraduationCap className="w-4 h-4 mr-2" />
                Foundation
              </TabsTrigger>
              <TabsTrigger
                value="credit"
                className="flex-1 h-10 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Credit
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Course Cards */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {filteredCourses.map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card
                  className={`cursor-pointer transition-all duration-200 border-2 ${
                    selectedCourse?.id === course.id
                      ? 'border-[#1a5f2a] bg-[#1a5f2a]/5'
                      : 'border-transparent hover:border-muted-foreground/20'
                  }`}
                  onClick={() => setSelectedCourse(course)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            activeTab === 'foundation'
                              ? 'bg-gradient-to-br from-[#1a5f2a] to-[#2a7f3a]'
                              : 'bg-gradient-to-br from-[#c9a227] to-[#d9b237]'
                          }`}
                        >
                          {activeTab === 'foundation' ? (
                            <GraduationCap className="w-6 h-6 text-white" />
                          ) : (
                            <BookOpen className="w-6 h-6 text-white" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {course.code}
                            </Badge>
                          </div>
                          <h3 className="font-semibold mt-1">{course.name}</h3>
                          {course.description && (
                            <p className="text-sm text-muted-foreground mt-1">{course.description}</p>
                          )}
                        </div>
                      </div>
                      {selectedCourse?.id === course.id && (
                        <CheckCircle className="w-6 h-6 text-[#1a5f2a]" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Exam-Type Selection for FP0340 */}
          <AnimatePresence>
            {needsExamType && (
              <motion.div
                initial={{ opacity: 0, y: 15, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="px-4 pt-2 pb-4 space-y-2">
                  <p className="text-sm font-medium text-muted-foreground px-1">
                    Select exam type:
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedExamType('mid-semester')}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all duration-200 ios-press ${
                        selectedExamType === 'mid-semester'
                          ? 'border-[#1a5f2a] bg-[#1a5f2a]/10 text-[#1a5f2a]'
                          : 'border-muted-foreground/20 bg-white hover:border-muted-foreground/40 text-muted-foreground'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      <span>For Mid-semester Exam</span>
                    </button>
                    <button
                      onClick={() => setSelectedExamType('final')}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all duration-200 ios-press ${
                        selectedExamType === 'final'
                          ? 'border-[#1a5f2a] bg-[#1a5f2a]/10 text-[#1a5f2a]'
                          : 'border-muted-foreground/20 bg-white hover:border-muted-foreground/40 text-muted-foreground'
                      }`}
                    >
                      <Award className="w-4 h-4" />
                      <span>For Final Exam</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Writing-Type Selection for LANC2160 */}
          <AnimatePresence>
            {needsWritingType && (
              <motion.div
                initial={{ opacity: 0, y: 15, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="px-4 pt-2 pb-4 space-y-2">
                  <p className="text-sm font-medium text-muted-foreground px-1">
                    Select writing task:
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedWritingType('summary')}
                      className={`flex-1 flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-4 py-4 text-sm font-medium transition-all duration-200 ios-press ${
                        selectedWritingType === 'summary'
                          ? 'border-[#c9a227] bg-[#c9a227]/10 text-[#c9a227]'
                          : 'border-muted-foreground/20 bg-white hover:border-muted-foreground/40 text-muted-foreground'
                      }`}
                    >
                      <FileText className="w-5 h-5" />
                      <span>Summary Writing</span>
                    </button>
                    <button
                      onClick={() => setSelectedWritingType('synthesis')}
                      className={`flex-1 flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-4 py-4 text-sm font-medium transition-all duration-200 ios-press ${
                        selectedWritingType === 'synthesis'
                          ? 'border-[#c9a227] bg-[#c9a227]/10 text-[#c9a227]'
                          : 'border-muted-foreground/20 bg-white hover:border-muted-foreground/40 text-muted-foreground'
                      }`}
                    >
                      <ClipboardList className="w-5 h-5" />
                      <span>Synthesis Essay</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Source Text Selection for Summary Writing */}
          <AnimatePresence>
            {needsSourceText && (
              <motion.div
                initial={{ opacity: 0, y: 15, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="px-4 pt-2 pb-4 space-y-2">
                  <p className="text-sm font-medium text-muted-foreground px-1">
                    Select source text to summarize:
                  </p>
                  <div className="space-y-2">
                    {SUMMARY_SOURCE_TEXTS.map((source) => {
                      const isSelected = selectedSourceTextId === source.id;
                      return (
                        <motion.div
                          key={source.id}
                          whileTap={{ scale: 0.98 }}
                        >
                          <button
                            onClick={() => setSelectedSourceTextId(source.id)}
                            className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                              isSelected
                                ? 'border-[#c9a227] bg-[#c9a227]/5'
                                : 'border-muted-foreground/20 bg-white hover:border-[#c9a227]/30'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                isSelected
                                  ? 'bg-[#c9a227] text-white'
                                  : 'bg-muted text-muted-foreground'
                              }`}>
                                <FileText className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-semibold leading-tight ${
                                  isSelected ? 'text-[#c9a227]' : 'text-foreground'
                                }`}>
                                  {source.title}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {source.wordCount} words &middot; Target summary: {source.targetMin}&ndash;{source.targetMax} words
                                </p>
                              </div>
                            </div>
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t bg-white/80 backdrop-blur-sm">
          <Button
            onClick={onSelect}
            disabled={!canContinue}
            className="w-full h-12 bg-[#1a5f2a] hover:bg-[#1a5f2a]/90 rounded-xl ios-press"
          >
            Continue with {selectedCourse?.code || 'Course'}
            {needsExamType && selectedExamType && (
              <span className="ml-1 text-sm font-normal opacity-80">
                ({selectedExamType === 'mid-semester' ? 'Mid-semester' : 'Final'})
              </span>
            )}
            {needsWritingType && selectedWritingType && (
              <span className="ml-1 text-sm font-normal opacity-80">
                ({selectedWritingType === 'summary' ? 'Summary' : 'Synthesis Essay'}){needsSourceText && selectedSourceTextId ? `: ${SUMMARY_SOURCE_TEXTS.find(s => s.id === selectedSourceTextId)?.title.split('—')[0].trim() || ''}` : ''}
              </span>
            )}
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </PageTransition>
  );
};

export default CourseSelectionScreen;
