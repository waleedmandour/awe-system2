import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Detailed assessment rubrics for Foundation courses (0230, 0340)
const FOUNDATION_RUBRICS = {
  targetWordCount: { min: 110, max: 130, ideal: 120 },
  criteria:[
    {
      name: 'Task Response',
      maxScore: 6,
      description: 'How well the essay addresses the task requirements, audience, purpose, and genre.',
      rubric: {
        '0-2': 'Very Poor: Text fails to fulfill any task requirements and shows no understanding of audience, purpose or genre. Length of text may be inappropriate.',
        '3': 'Unsatisfactory: Response does not adequately fulfill task requirements and shows little awareness of audience, purpose and genre. Little or no attempt at topic development. Length of text may be inappropriate.',
        '3.5': 'Satisfactory: Response fulfills most task requirements and shows adequate awareness of audience, purpose and genre. Topic development is attempted but may be limited, predictable, and/or irrelevant in places. Length of text may be inappropriate.',
        '4': 'Good: Response fulfills specific task requirements. Little more could reasonably be expected for the level. Response shows a good level of awareness of audience, purpose and genre. Topic is developed and explored well.',
        '4.5-6': 'Excellent: Response fulfills all specific task requirements and exceeds expectations for this level. Response shows a high level of awareness of audience, purpose and genre. Topic is fully developed and explored.'
      }
    },
    {
      name: 'Coherence and Cohesion',
      maxScore: 6,
      description: 'Logical organization, paragraphing, and use of cohesive devices.',
      rubric: {
        '0-2': 'Very Poor: Very little control of organizational features. The text is largely confused and incoherent, making it challenging for the reader to process.',
        '3': 'Unsatisfactory: Organization is limited, compromising coherence. Some re-reading may be necessary. Ideas lack progression and may be repeated. There may be no paragraphs. Some simple cohesive devices are used but usually inaccurately and repetitively.',
        '3.5': 'Satisfactory: Organization provides an underlying coherence although progression may be inconsistent. Text may be stilted in places. Paragraphing is generally appropriate although ideas may not always be supported. Cohesive devices may be over or under used, or used mechanically in places. Text may be repetitive due to lack of referencing.',
        '4': 'Good: Organization of information and ideas makes text clear and easy to understand. Each paragraph has a main topic supported by some relevant details. Cohesive devices are frequently used accurately both within and/or between sentences.',
        '4.5-6': 'Excellent: Information and ideas are organized so effectively that text has a fluent progression throughout. Opening and closing sections are appropriate and fully developed. Each paragraph has a clear main topic supported by well-organised, relevant details. Cohesive devices are consistently used accurately both within and/or between sentences.'
      }
    },
    {
      name: 'Lexical Resource',
      maxScore: 6,
      description: 'Range and accuracy of vocabulary, word choice, and spelling.',
      rubric: {
        '0-2': 'Very Poor: Vocabulary is very limited and may be unrelated to the task or consists largely of inappropriate memorized chunks. Poor word choice and spelling prevent the communication of ideas.',
        '3': 'Unsatisfactory: Vocabulary is inadequate or inappropriate for the level and task and may be used repetitively. Errors in word choice and spelling frequently affect communication.',
        '3.5': 'Satisfactory: Text has a limited but adequate range of vocabulary for the level and task. Core vocabulary is usually used accurately and appropriately. If there are attempts to extend beyond this range, there may be some inaccuracy or inappropriacy which affects communication in places.',
        '4': 'Good: Text has a good range of vocabulary for the level and task. Core vocabulary is frequently used accurately and appropriately. If there are attempts to extend beyond this range, there may be some inaccuracy or inappropriacy, although communication is not affected.',
        '4.5-6': 'Excellent: Text has a significantly wider range of vocabulary than is expected for the level and task. Core vocabulary is consistently used accurately and appropriately. There may be occasional errors in word choice and spelling where more complex/creative lexis is attempted but communication is not affected.'
      }
    },
    {
      name: 'Grammatical Range and Accuracy',
      maxScore: 6,
      description: 'Range and accuracy of grammatical structures and punctuation.',
      rubric: {
        '0-2': 'Very Poor: Structures are inaccurate and errors predominate, preventing meaningful communication. Punctuation may be inadequate and/or inaccurate.',
        '3': 'Unsatisfactory: Structures are very limited and inadequate for the level and task. Errors are noticeable and may often affect communication. Punctuation may be inadequate and/or inaccurate.',
        '3.5': 'Satisfactory: Text has a limited but adequate range of structures for the level and task. Core structures for the level are usually used accurately and appropriately although they may sometimes be used mechanically. Grammatical errors may affect communication in places. Punctuation is generally effective.',
        '4': 'Good: Text has a good range of structures for the level and task. Core structures for the level are frequently used accurately and appropriately. If there are attempts to extend beyond this range, there may be some inaccuracy or inappropriacy, without affecting communication. Punctuation is well managed and effective.',
        '4.5-6': 'Excellent: Text has a significantly wider range of structures than is expected for the level and task. Core structures are consistently used accurately and appropriately. There may be occasional errors where more complex structures are attempted but communication is not affected. Punctuation is well managed and effective.'
      }
    }
  ],
  specialRules:[
    'If the text is somewhat off-topic, deduct 50% of the mark obtained for Task Response and Lexical Resource.',
    'A completely off-topic text should receive a zero for Task Response and Lexical Resource.'
  ]
};

// Post-foundation/Credit course criteria (LANC2160)
const CREDIT_CRITERIA =[
  { name: 'Task Achievement', maxScore: 5, description: 'How well the summary captures main points' },
  { name: 'Coherence & Cohesion', maxScore: 5, description: 'Logical organization and linking of ideas' },
  { name: 'Lexical Resource', maxScore: 5, description: 'Range and accuracy of vocabulary' },
  { name: 'Grammatical Range & Accuracy', maxScore: 5, description: 'Range and accuracy of grammar' },
];

// Build detailed rubric prompt for Foundation courses
function buildFoundationPrompt(text: string, topic: string | null, wordCount: number): string {
  const rubrics = FOUNDATION_RUBRICS;
  const wordCountStatus = wordCount < rubrics.targetWordCount.min 
    ? `WARNING: Word count (${wordCount}) is BELOW the required range of ${rubrics.targetWordCount.min}-${rubrics.targetWordCount.max} words. This MUST lower the Task Response score.`
    : wordCount > rubrics.targetWordCount.max
    ? `NOTE: Word count (${wordCount}) exceeds the target range of ${rubrics.targetWordCount.min}-${rubrics.targetWordCount.max} words. Minor flexibility is acceptable.`
    : `Word count (${wordCount}) is within the acceptable range of ${rubrics.targetWordCount.min}-${rubrics.targetWordCount.max} words.`;

  const criteriaDetails = rubrics.criteria.map(c => {
    const rubricLevels = Object.entries(c.rubric)
      .map(([score, desc]) => `  Score ${score}: ${desc}`)
      .join('\n');
    return `${c.name} (0-${c.maxScore}):\n${rubricLevels}`;
  }).join('\n\n');

  return `You are an expert writing assessor evaluating a Foundation level student essay for Sultan Qaboos University's Center for Preparatory Studies.

STUDENT LEVEL: CEFR A1-A2 (Basic User). Feedback must use simple, clear language that A1-A2 learners can understand. Be encouraging while maintaining appropriate standards. Avoid overly technical linguistic terminology.

${topic ? `Essay Topic: ${topic}` : 'No specific topic provided.'}

Student Essay:
"""
${text}
"""

WORD COUNT: ${wordCountStatus}

ASSESSMENT RUBRICS (Foundation Courses - FP0230 and FP0340):

${criteriaDetails}

SPECIAL RULES:
${rubrics.specialRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

============================================================
SCORING AND FEEDBACK INSTRUCTIONS (CRITICAL — FOLLOW EXACTLY):
============================================================

STEP 1 — SCORE each criterion using a WHOLE NUMBER (0, 1, 2, 3, 4, 5, or 6). No decimals.

STEP 2 — For EACH criterion, write a "Justification" paragraph that:
  (a) Explicitly names the score band you chose (e.g. "Score 4: Good")
  (b) Quotes at least ONE specific phrase or sentence from the student's essay as evidence
  (c) Explains why the essay fits that band descriptor — connect the evidence to the rubric
  (d) If the score is below 4, clearly state what is missing compared to the next higher band
  (e) If the score is 5 or 6, explain what the student did beyond expectations

This justification must make the score transparent and defensible. A reader should understand exactly why that score was given based on the evidence.

STEP 3 — For each criterion, list SPECIFIC errors found in the text. Format each as:
  - "[exact quoted text]" — explanation of the error and how to fix it

STEP 4 — For each criterion, provide 1-2 concrete, achievable suggestions for improvement appropriate for an A1-A2 learner.

STEP 5 — overallFeedback must be a comprehensive summary (3-5 sentences) that:
  - Highlights the student's strongest criterion and what they did well
  - Identifies the weakest area needing the most attention
  - Gives one prioritized action item to focus on next

STEP 6 — Calculate totalScore = sum of all criterion scores (max 24). Calculate percentage = round(totalScore / 24 * 100).

============================================================
JSON OUTPUT FORMAT (respond ONLY with valid JSON):
============================================================
{
  "scores": [
    {
      "criterionName": "Task Response",
      "score": 4,
      "maxScore": 6,
      "justification": "Score 4: Good. The essay addresses the task by [explanation]. For example, the student writes: \\"[exact quote]\\" which shows [specific rubric alignment].",
      "strengths": "The student clearly addresses the topic and provides relevant examples. The opening sentence introduces the subject effectively.",
      "mistakes": [
        "[exact quoted text]" — Explanation of the error and how to fix it
      ],
      "suggestions": "Try to add a clear concluding sentence that summarizes your main point. Use transition words like 'In conclusion' or 'To sum up'."
    }
  ],
  "totalScore": 16,
  "maxScore": 24,
  "percentage": 67,
  "overallFeedback": "Your strongest area is [criterion] where you [specific strength]. The area that needs the most improvement is [criterion] because [reason]. Focus on [one prioritized action] to improve your next essay."
}`;
}

// Build prompt for Credit/Post-foundation courses
function buildCreditPrompt(text: string, topic: string | null, wordCount: number): string {
  const criteria = CREDIT_CRITERIA;
  const totalMaxScore = criteria.reduce((sum, c) => sum + c.maxScore, 0);

  return `You are an expert writing assessor evaluating a Credit level student essay for Sultan Qaboos University's Center for Preparatory Studies.

STUDENT LEVEL: CEFR A1-A2 (Basic User). Feedback must use simple, clear language that A1-A2 learners can understand. Be encouraging while maintaining appropriate standards. Avoid overly technical linguistic terminology.

${topic ? `Essay Topic: ${topic}` : 'No specific topic provided.'}

Student Essay:
"""
${text}
"""

WORD COUNT: ${wordCount} words

ASSESSMENT CRITERIA (Credit Course - LANC2160):
${criteria.map(c => `- ${c.name} (0-${c.maxScore}): ${c.description}`).join('\n')}

============================================================
SCORING AND FEEDBACK INSTRUCTIONS (CRITICAL — FOLLOW EXACTLY):
============================================================

STEP 1 — SCORE each criterion using a WHOLE NUMBER (0, 1, 2, 3, 4, or 5). No decimals.

STEP 2 — For EACH criterion, write a "Justification" paragraph that:
  (a) Explicitly states the score you awarded and the reasoning behind it
  (b) Quotes at least ONE specific phrase or sentence from the student's essay as evidence
  (c) Explains why the essay earned that score based on the criterion description
  (d) If the score is below 3, clearly state what is missing compared to a higher score
  (e) If the score is 4 or 5, explain what the student did beyond basic expectations

STEP 3 — For each criterion, list SPECIFIC errors found in the text. Format each as:
  - "[exact quoted text]" — explanation of the error and how to fix it

STEP 4 — For each criterion, provide 1-2 concrete, achievable suggestions for improvement appropriate for an A1-A2 learner.

STEP 5 — overallFeedback must be a comprehensive summary (3-5 sentences) that highlights the student's strongest criterion, identifies the weakest area, and gives one prioritized action item.

STEP 6 — Calculate totalScore = sum of all criterion scores (max ${totalMaxScore}). Calculate percentage = round(totalScore / ${totalMaxScore} * 100).

============================================================
JSON OUTPUT FORMAT (respond ONLY with valid JSON):
============================================================
{
  "scores": [
    {
      "criterionName": "Task Achievement",
      "score": 4,
      "maxScore": 5,
      "justification": "The essay achieves the task well by [explanation]. For example, \\"[exact quote]\\" shows [specific alignment with criterion].",
      "strengths": "The student captures the main points effectively and demonstrates good comprehension of the source material.",
      "mistakes": [
        "[exact quoted text]" — Explanation of the error and how to fix it
      ],
      "suggestions": "Make sure every main point from the original text is represented in your summary. Use your own words rather than copying phrases."
    }
  ],
  "totalScore": 16,
  "maxScore": ${totalMaxScore},
  "percentage": 80,
  "overallFeedback": "Your strongest area is [criterion] where you [specific strength]. The area that needs the most improvement is [criterion] because [reason]. Focus on [one prioritized action] to improve your next essay."
}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, courseCode, topic, apiKey } = body;

    if (!text) {
      return NextResponse.json(
        { error: 'No text provided for assessment' },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key is required' },
        { status: 400 }
      );
    }

    // Calculate word count
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

    // Determine course type and build appropriate prompt
    const isFoundation =['0230', '0340'].includes(courseCode);
    const prompt = isFoundation 
      ? buildFoundationPrompt(text, topic, wordCount)
      : buildCreditPrompt(text, topic, wordCount);

    const criteria = isFoundation 
      ? FOUNDATION_RUBRICS.criteria 
      : CREDIT_CRITERIA;

    // 1. Initialize Official Google Gemini SDK
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // 2. Initialize Model with Strict Instructions
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3-flash-preview',
      systemInstruction: 'You are an expert writing assessment AI for Foundation and Credit level university courses at Sultan Qaboos University. All students are at CEFR A1-A2 level (Basic User). Your feedback must use simple, clear language appropriate for this proficiency level. Focus on fundamental skills and provide encouraging, constructive guidance. CRITICAL: For each criterion you MUST (1) quote exact words from the student essay as evidence, (2) explicitly justify why the score matches the rubric band, (3) list specific errors with quoted text, and (4) give actionable suggestions. You respond only with valid JSON. No markdown formatting or code blocks.'
    });

    // 3. Generate Content enforcing application/json output
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 6000,
        responseMimeType: "application/json",
      }
    });

    const responseText = result.response.text() || '';
    
    // Parse the JSON response
    let assessment;
    try {
      // Clean the response just in case the model ignores the mimeType instruction
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      assessment = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse assessment response:', responseText);
      return NextResponse.json(
        { error: 'Failed to parse AI assessment response' },
        { status: 500 }
      );
    }

    // Validate the assessment structure
    if (!assessment.scores || !Array.isArray(assessment.scores)) {
      return NextResponse.json(
        { error: 'Invalid assessment structure' },
        { status: 500 }
      );
    }

    // Ensure all criteria are assessed
    const assessedCriteria = assessment.scores.map((s: any) => s.criterionName);
    const missingCriteria = criteria.filter(c => !assessedCriteria.includes(c.name));
    
    if (missingCriteria.length > 0) {
      missingCriteria.forEach(c => {
        assessment.scores.push({
          criterionName: c.name,
          score: 0,
          maxScore: c.maxScore,
          justification: 'Unable to assess this criterion from the provided text.',
          strengths: '',
          mistakes: [],
          suggestions: 'Unable to provide suggestions.',
          feedback: 'Unable to assess this criterion from the provided text.'
        });
      });
    }

    // Normalize scores: round to whole numbers, build feedback string, clamp
    assessment.scores.forEach((s: any) => {
      s.score = Math.round(Number(s.score) || 0);
      s.maxScore = Math.round(Number(s.maxScore) || 0);

      // Build a structured feedback string from the individual fields
      // This preserves backwards compatibility with the frontend parseFeedback()
      const parts: string[] = [];

      if (s.strengths) {
        parts.push(`**Strengths:** ${s.strengths}`);
      }
      if (s.justification) {
        parts.push(`**Justification:** ${s.justification}`);
      }
      if (Array.isArray(s.mistakes) && s.mistakes.length > 0) {
        const mistakeLines = s.mistakes
          .map((m: any) => {
            const text = typeof m === 'string' ? m : (m.quote || m.text || '');
            const explanation = typeof m === 'string' ? '' : (m.explanation || m.reason || '');
            return `- "${text}" — ${explanation}`;
          })
          .join('\n');
        parts.push(`**Mistakes Found:**\n${mistakeLines}`);
      }
      if (s.suggestions) {
        parts.push(`**Suggestions:** ${s.suggestions}`);
      }

      // Use the built structured string, fallback to raw feedback if empty
      s.feedback = parts.length > 0 ? parts.join('\n\n') : (s.feedback || 'No feedback provided.');
    });

    // Recalculate total score to ensure accuracy
    assessment.totalScore = assessment.scores.reduce((sum: number, s: any) => sum + s.score, 0);
    assessment.maxScore = assessment.scores.reduce((sum: number, s: any) => sum + s.maxScore, 0);
    assessment.percentage = assessment.maxScore > 0 ? Math.round((assessment.totalScore / assessment.maxScore) * 100) : 0;

    // Add word count info
    assessment.wordCount = wordCount;
    assessment.targetWordCount = isFoundation ? FOUNDATION_RUBRICS.targetWordCount : null;

    return NextResponse.json({
      success: true,
      assessment: {
        ...assessment,
        createdAt: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Assessment error:', error);
    return NextResponse.json(
      { error: 'Failed to assess essay', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
