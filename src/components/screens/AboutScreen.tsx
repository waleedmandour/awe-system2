'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  BookOpen,
  Cpu,
  Globe,
  Code2,
  GraduationCap,
  Sparkles,
  ExternalLink,
  User,
} from 'lucide-react';
import { PageTransition } from '@/lib/animations';

const AboutScreen = ({ onBack }: { onBack: () => void }) => {
  const fadeInUp = (delay: number) => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.4 },
  });

  return (
    <PageTransition direction="left">
      <div className="min-h-screen min-h-[100dvh] bg-background safe-area-top safe-area-bottom">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b">
          <div className="flex items-center gap-3 p-4 max-w-2xl mx-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="rounded-full h-9 w-9 ios-press"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-bold text-[#1a5f2a]">About AWE System</h1>
          </div>
        </div>

        <div className="p-4 max-w-2xl mx-auto space-y-4 pb-24">
          {/* Logo & Title */}
          <motion.div {...fadeInUp(0.1)} className="text-center pt-4 pb-2">
            <div className="w-24 h-24 mx-auto mb-4 rounded-2xl shadow-lg overflow-hidden bg-white p-2 border border-[#1a5f2a]/10">
              <img
                src="/squ_logo.png"
                alt="Sultan Qaboos University"
                className="w-full h-full object-contain"
              />
            </div>
            <h2 className="text-2xl font-bold text-[#1a5f2a] mb-1">AWE System</h2>
            <p className="text-[#c9a227] font-medium">Automated Writing Evaluation</p>
          </motion.div>

          {/* App Description */}
          <motion.div {...fadeInUp(0.2)}>
            <Card className="border-[#1a5f2a]/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#1a5f2a]">
                  <Sparkles className="w-5 h-5" />
                  About the Platform
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  AWE (Automated Writing Evaluation) System is a multimodal, AI-powered platform developed for the Center for Preparatory Studies at Sultan Qaboos University. The system leverages Google Gemini AI to provide formative assessment of student writing across Foundation and Post-Foundation (Credit) English courses.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Students can upload handwritten essays via camera, receive detailed rubric-aligned feedback, scores, and specific improvement suggestions — all through an installable Progressive Web App accessible on any device.
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Supported Courses */}
          <motion.div {...fadeInUp(0.3)}>
            <Card className="border-[#1a5f2a]/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#1a5f2a]">
                  <GraduationCap className="w-5 h-5" />
                  Supported Courses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3">
                  <div className="p-3 bg-[#1a5f2a]/5 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-[#1a5f2a] text-white border-[#1a5f2a]">Foundation</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="border-[#c9a227] text-[#c9a227]">FP0230</Badge>
                      <span className="text-xs text-muted-foreground self-center">Foundation English I</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <Badge variant="outline" className="border-[#c9a227] text-[#c9a227]">FP0340</Badge>
                      <span className="text-xs text-muted-foreground self-center">Foundation English II</span>
                    </div>
                  </div>
                  <div className="p-3 bg-[#c9a227]/5 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-[#c9a227] text-white border-[#c9a227]">Post-Foundation</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="border-[#1a5f2a] text-[#1a5f2a]">LANC1070</Badge>
                      <span className="text-xs text-muted-foreground self-center">Academic Essay Writing</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <Badge variant="outline" className="border-[#1a5f2a] text-[#1a5f2a]">LANC2160</Badge>
                      <span className="text-xs text-muted-foreground self-center">Summary & Synthesis Writing</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Technology Stack */}
          <motion.div {...fadeInUp(0.4)}>
            <Card className="border-[#1a5f2a]/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#1a5f2a]">
                  <Code2 className="w-5 h-5" />
                  Technology Stack
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: 'Next.js', desc: 'React Framework' },
                    { name: 'Google Gemini AI', desc: 'AI Assessment' },
                    { name: 'Prisma', desc: 'ORM & Database' },
                    { name: 'Tailwind CSS', desc: 'UI Styling' },
                  ].map((tech) => (
                    <div key={tech.name} className="p-2.5 bg-muted/50 rounded-lg">
                      <p className="text-sm font-medium text-foreground">{tech.name}</p>
                      <p className="text-xs text-muted-foreground">{tech.desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Topics */}
          <motion.div {...fadeInUp(0.5)}>
            <Card className="border-[#1a5f2a]/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#1a5f2a]">
                  <BookOpen className="w-5 h-5" />
                  Research Topics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Automated Writing Evaluation',
                    'Formative Assessment',
                    'AI in Education',
                    'Essay Scoring',
                    'CEFR-Aligned Rubrics',
                    'Multimodal Learning',
                    'Natural Language Processing',
                    'Higher Education',
                  ].map((topic) => (
                    <Badge key={topic} variant="outline" className="border-[#1a5f2a]/30 text-[#1a5f2a]">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Links */}
          <motion.div {...fadeInUp(0.6)}>
            <Card className="border-[#1a5f2a]/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#1a5f2a]">
                  <Globe className="w-5 h-5" />
                  Resources
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                  <div className="w-9 h-9 rounded-full bg-[#1a5f2a]/10 flex items-center justify-center flex-shrink-0">
                    <Cpu className="w-4 h-4 text-[#1a5f2a]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Source Code</p>
                    <p className="text-xs text-muted-foreground truncate">
                      github.com/waleedmandour/awe-system2
                    </p>
                  </div>
                  <a
                    href="https://github.com/waleedmandour/awe-system2"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1a5f2a] hover:text-[#1a5f2a]/80 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Developer */}
          <motion.div {...fadeInUp(0.7)}>
            <Card className="border-[#c9a227]/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#c9a227]">
                  <User className="w-5 h-5" />
                  Developer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 p-3 bg-[#c9a227]/5 rounded-xl">
                  <div className="w-12 h-12 rounded-full bg-[#c9a227]/10 flex items-center justify-center">
                    <User className="w-6 h-6 text-[#c9a227]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Dr. Waleed Mandour</p>
                    <p className="text-xs text-muted-foreground">
                      Center for Preparatory Studies
                      <br />
                      Sultan Qaboos University
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Version */}
          <motion.div {...fadeInUp(0.8)} className="text-center pb-4">
            <p className="text-xs text-muted-foreground">
              AWE System v1.0.0
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              AI Co-Marker Assistance Project, 2026
            </p>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
};

export default AboutScreen;
