'use client';

/**
 * AWE System — LTI Launch Page
 *
 * This page is displayed after a successful LTI 1.3 launch from Moodle.
 * It shows the student/teacher info from the LTI session and provides
 * the assessment workflow tailored to the LTI context.
 *
 * Features:
 *   - Displays student name and course info from Moodle
 *   - Pre-selects course based on LTI context
 *   - Auto-submits grade to Moodle via AGS after assessment
 *   - Shows grade passback status
 */

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LTISessionInfo {
  userName: string;
  userEmail?: string;
  contextTitle: string;
  resourceLinkTitle: string;
  roles: string[];
  agsAvailable: boolean;
}

interface AssessmentScore {
  totalScore: number;
  maxScore: number;
  percentage: number;
  scores: Array<{
    criterionName: string;
    score: number;
    maxScore: number;
  }>;
  overallFeedback?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LTILaunchPage() {
  const { toast } = useToast();
  const [sessionInfo, setSessionInfo] = useState<LTISessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [essayText, setEssayText] = useState('');
  const [assessing, setAssessing] = useState(false);
  const [assessment, setAssessment] = useState<AssessmentScore | null>(null);
  const [gradePassbackStatus, setGradePassbackStatus] = useState<'idle' | 'submitting' | 'success' | 'failed'>('idle');

  // ── Load LTI session info ──────────────────────────────────────────────
  useEffect(() => {
    async function loadSession() {
      try {
        const response = await fetch('/api/lti/grades');
        const data = await response.json();

        if (data.available !== undefined) {
          setSessionInfo({
            userName: data.session?.userName || 'Student',
            userEmail: data.session?.userEmail,
            contextTitle: data.session?.contextTitle || 'Unknown Course',
            resourceLinkTitle: data.session?.resourceLinkTitle || 'Assignment',
            roles: data.session?.roles || [],
            agsAvailable: data.available,
          });
        } else {
          setError('No LTI session found. Please launch this assignment from Moodle.');
        }
      } catch (err) {
        setError('Failed to load LTI session. Please relaunch from Moodle.');
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, []);

  // ── Handle assessment ──────────────────────────────────────────────────
  const handleAssess = useCallback(async () => {
    if (!essayText.trim()) {
      toast({ title: 'No text', description: 'Please enter your essay text.', variant: 'destructive' });
      return;
    }

    setAssessing(true);
    setAssessment(null);
    setGradePassbackStatus('idle');

    try {
      // Determine course from session
      const courseCode = determineCourseCode(sessionInfo?.contextTitle || '');

      const response = await fetch('/api/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: essayText,
          courseCode,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Assessment failed');
      }

      const result = await response.json();
      const assessmentData: AssessmentScore = {
        totalScore: result.assessment.totalScore,
        maxScore: result.assessment.maxScore,
        percentage: result.assessment.percentage,
        scores: result.assessment.scores,
        overallFeedback: result.assessment.overallFeedback,
      };

      setAssessment(assessmentData);

      // Submit grade to Moodle via AGS
      if (sessionInfo?.agsAvailable) {
        setGradePassbackStatus('submitting');
        try {
          const gradeResponse = await fetch('/api/lti/grades', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              percentage: assessmentData.percentage,
              maxScore: assessmentData.maxScore,
              comment: `AWE Assessment: ${assessmentData.totalScore}/${assessmentData.maxScore} (${assessmentData.percentage}%)`,
            }),
          });

          if (gradeResponse.ok) {
            setGradePassbackStatus('success');
            toast({ title: 'Grade Submitted', description: 'Your grade has been recorded in Moodle.' });
          } else {
            setGradePassbackStatus('failed');
            const errData = await gradeResponse.json();
            toast({ title: 'Grade Passback Failed', description: errData.error, variant: 'destructive' });
          }
        } catch {
          setGradePassbackStatus('failed');
          toast({ title: 'Grade Passback Failed', description: 'Could not connect to Moodle.', variant: 'destructive' });
        }
      }

    } catch (err) {
      toast({
        title: 'Assessment Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setAssessing(false);
    }
  }, [essayText, sessionInfo, toast]);

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-gradient-to-b from-[#0c1d3a] via-[#1e40af] to-[#0c1d3a]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/95 shadow-xl overflow-hidden p-1.5">
            <img src="/iawe-icon.png" alt="iAWE" className="w-full h-full object-contain" draggable={false} />
          </div>
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <p className="text-white/60 text-sm">Loading iAWE from Moodle...</p>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-gradient-to-b from-[#0c1d3a] via-[#1e40af] to-[#0c1d3a] p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">LTI Launch Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              Please go back to Moodle and relaunch this assignment.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main content ───────────────────────────────────────────────────────
  const isInstructorRole = sessionInfo?.roles.some(r =>
    r.includes('Instructor') || r.includes('Administrator') || r.includes('Staff')
  );

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-b from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 shadow overflow-hidden p-0.5">
            <img src="/iawe-icon.png" alt="iAWE" className="w-full h-full object-contain" draggable={false} />
          </div>
          <div className="flex-1">
            <h1 className="font-bold text-blue-900 text-lg leading-tight">iAWE System</h1>
            <p className="text-xs text-muted-foreground">Automated Writing Evaluation</p>
          </div>
          {sessionInfo?.agsAvailable && (
            <Badge variant="default" className="bg-green-600 text-white text-xs">
              Moodle Connected
            </Badge>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Session info card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              Welcome, {sessionInfo?.userName || 'Student'}
            </CardTitle>
            <CardDescription>
              {sessionInfo?.contextTitle} &middot; {sessionInfo?.resourceLinkTitle}
              {isInstructorRole && (
                <Badge variant="secondary" className="ml-2 text-xs">Instructor</Badge>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="bg-blue-50 border-blue-200">
              <AlertTitle className="text-blue-800 text-sm">How to use iAWE</AlertTitle>
              <AlertDescription className="text-blue-700 text-xs">
                {isInstructorRole
                  ? 'As an instructor, you can test the assessment flow. Student grades will be submitted to the Moodle gradebook automatically.'
                  : 'Paste or type your essay below and click "Assess My Essay". Your grade will be automatically submitted to the Moodle gradebook.'
                }
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Essay input (if not yet assessed) */}
        {!assessment && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Submit Your Essay</CardTitle>
              <CardDescription>
                Paste your essay text below for AI-powered assessment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                className="w-full min-h-[200px] p-3 border rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Paste or type your essay here..."
                value={essayText}
                onChange={(e) => setEssayText(e.target.value)}
                disabled={assessing}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {essayText.trim().split(/\s+/).filter(Boolean).length} words
                </span>
                <Button
                  onClick={handleAssess}
                  disabled={assessing || !essayText.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {assessing ? 'Assessing...' : 'Assess My Essay'}
                </Button>
              </div>
              {assessing && (
                <div className="space-y-2">
                  <Progress value={66} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    AI is evaluating your essay. This may take up to 60 seconds...
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Assessment results */}
        {assessment && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Assessment Results</CardTitle>
                <CardDescription>
                  Your essay has been evaluated by the AI assessment system
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Score summary */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-700">{assessment.totalScore}</div>
                    <div className="text-xs text-muted-foreground">out of {assessment.maxScore}</div>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-700">{assessment.percentage}%</div>
                    <div className="text-xs text-muted-foreground">Percentage</div>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-700">
                      {assessment.percentage >= 80 ? 'Excellent' :
                       assessment.percentage >= 60 ? 'Good' :
                       assessment.percentage >= 40 ? 'Satisfactory' : 'Needs Improvement'}
                    </div>
                    <div className="text-xs text-muted-foreground">Performance</div>
                  </div>
                </div>

                {/* Criterion scores */}
                <div className="space-y-3">
                  {assessment.scores.map((score, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{score.criterionName}</span>
                        <span className="text-muted-foreground">{score.score}/{score.maxScore}</span>
                      </div>
                      <Progress
                        value={(score.score / score.maxScore) * 100}
                        className="h-2"
                      />
                    </div>
                  ))}
                </div>

                {/* Overall feedback */}
                {assessment.overallFeedback && (
                  <div className="p-3 bg-gray-50 rounded-lg text-sm">
                    <p className="font-medium mb-1">Overall Feedback</p>
                    <p className="text-muted-foreground">{assessment.overallFeedback}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Grade passback status */}
            {sessionInfo?.agsAvailable && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Moodle Grade Submission</CardTitle>
                </CardHeader>
                <CardContent>
                  {gradePassbackStatus === 'submitting' && (
                    <div className="flex items-center gap-2 text-blue-600">
                      <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                      <span className="text-sm">Submitting grade to Moodle...</span>
                    </div>
                  )}
                  {gradePassbackStatus === 'success' && (
                    <Alert className="bg-green-50 border-green-200">
                      <AlertTitle className="text-green-800 text-sm">Grade Submitted Successfully</AlertTitle>
                      <AlertDescription className="text-green-700 text-xs">
                        Your grade ({assessment.percentage}%) has been recorded in the Moodle gradebook.
                      </AlertDescription>
                    </Alert>
                  )}
                  {gradePassbackStatus === 'failed' && (
                    <Alert className="bg-red-50 border-red-200">
                      <AlertTitle className="text-red-800 text-sm">Grade Submission Failed</AlertTitle>
                      <AlertDescription className="text-red-700 text-xs">
                        Your assessment was completed but the grade could not be sent to Moodle. Please inform your instructor.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

            {/* New assessment button */}
            <div className="text-center">
              <Button
                variant="outline"
                onClick={() => {
                  setAssessment(null);
                  setEssayText('');
                  setGradePassbackStatus('idle');
                }}
              >
                Submit Another Essay
              </Button>
            </div>
          </>
        )}

        {/* AI Disclaimer */}
        <div className="text-center text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
          This assessment was generated by artificial intelligence and may contain inaccuracies.
          Scores and feedback should be reviewed by a qualified instructor.
        </div>

        {/* Footer */}
        <footer className="text-center text-xs text-muted-foreground py-4 border-t">
          <p>iAWE System &middot; Sultan Qaboos University &middot; Center for Preparatory Studies</p>
          <p>Powered by Google Gemini AI &middot; 2026</p>
        </footer>
      </main>
    </div>
  );
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/**
 * Attempt to determine the AWE course code from the Moodle context title.
 * This is a heuristic; the course can also be specified via custom claims.
 */
function determineCourseCode(contextTitle: string): string {
  const lower = contextTitle.toLowerCase();

  if (lower.includes('0230') || lower.includes('foundation i')) return '0230';
  if (lower.includes('0340') || lower.includes('foundation ii')) return '0340';
  if (lower.includes('lanc2160') || lower.includes('summary')) return 'LANC2160';
  if (lower.includes('lanc1070') || lower.includes('synthesis')) return 'LANC1070';
  if (lower.includes('lanc2070') || lower.includes('report')) return 'LANC2070';

  // Default to Foundation I
  return '0230';
}
