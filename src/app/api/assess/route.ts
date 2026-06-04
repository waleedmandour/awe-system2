import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from '@google/genai';

// IMPORTANT: Vercel Hobby plan ($20/mo) allows maxDuration = 60.
// On the FREE tier, Vercel caps serverless functions at 10 seconds regardless of this setting.
// Prompts are optimised to complete within the 10-second free tier limit where possible.
export const maxDuration = 60;

// ─── Word Count Targets ─────────────────────────────────────────────────────

const FOUNDATION_WORD_COUNTS: Record<string, Record<string, { min: number; max: number; ideal: number; label: string }>> = {
  '0230': {
    'mid-semester': { min: 90, max: 130, ideal: 120, label: 'FP0230 Mid-semester Exam' },
    'final':        { min: 110, max: 140, ideal: 120, label: 'FP0230 Final Exam' },
  },
  '0340': {
    'mid-semester': { min: 110, max: 150, ideal: 120, label: 'FP0340 Mid-semester Exam' },
    'final':        { min: 140, max: 220, ideal: 200, label: 'FP0340 Final Exam' },
  },
};

const DEFAULT_FOUNDATION_WORD_COUNTS: Record<string, { min: number; max: number; ideal: number; label: string }> = {
  '0230': { min: 90, max: 130, ideal: 120, label: 'FP0230 Foundation Exam' },
  '0340': { min: 110, max: 150, ideal: 120, label: 'FP0340 Foundation Exam' },
};

// ─── Rubric Data ─────────────────────────────────────────────────────────────

const FOUNDATION_RUBRICS = {
  criteria:[
    {
      name: 'Task Response',
      maxScore: 6,
      description: 'How well the essay addresses the task requirements, audience, purpose, and genre.',
      rubric: {
        '0-1.5': 'Very Poor: Text fails to fulfill any task requirements and shows no understanding of audience, purpose or genre. Length of text may be inappropriate.',
        '2-2.5': 'Weak: Response shows minimal awareness of the task, audience, purpose or genre. Very limited topic development. Length of text is likely inappropriate.',
        '3': 'Unsatisfactory: Response does not adequately fulfill task requirements and shows little awareness of audience, purpose and genre. Little or no attempt at topic development. Length of text may be inappropriate.',
        '3.5': 'Satisfactory: Response fulfills most task requirements and shows adequate awareness of audience, purpose and genre. Topic development is attempted but may be limited, predictable, and/or irrelevant in places. Length of text may be inappropriate. BOUNDARY — NOT Good (4): The essay fulfills MOST but NOT ALL task requirements. At least one required element is missing, underdeveloped, or partially off-topic. Topic development includes at least ONE of: superficial analysis, predictable examples, or irrelevant tangents. KEY TEST: Can you point to a missing, underdeveloped, or off-topic element? If YES → remains 3.5.',
        '4': 'Good: Response fulfills specific task requirements. Little more could reasonably be expected for the level. Response shows a good level of awareness of audience, purpose and genre. Topic is developed and explored well. BOUNDARY — NOT Satisfactory (3.5): ALL task requirements are met — no missing elements, no underdeveloped points, no irrelevant tangents. KEY TEST from 3.5: Is there ANY missing, underdeveloped, or off-topic element? If NO → 4 is justified.',
        '4.5': 'Very Good: Response fulfills all specific task requirements. Response shows a very good level of awareness of audience, purpose and genre. Topic is well developed and explored with some depth.',
        '5-6': 'Excellent: Response fulfills all specific task requirements and exceeds expectations for this level. Response shows a high level of awareness of audience, purpose and genre. Topic is fully developed and explored.'
      }
    },
    {
      name: 'Coherence and Cohesion',
      maxScore: 6,
      description: 'Logical organization, paragraphing, and use of cohesive devices.',
      rubric: {
        '0-1.5': 'Very Poor: Very little control of organizational features. The text is largely confused and incoherent, making it challenging for the reader to process.',
        '2-2.5': 'Weak: Minimal organization. Ideas are disconnected and difficult to follow. No paragraphs or very poor paragraphing. Cohesive devices are absent or misused.',
        '3': 'Unsatisfactory: Organization is limited, compromising coherence. Some re-reading may be necessary. Ideas lack progression and may be repeated. There may be no paragraphs. Some simple cohesive devices are used but usually inaccurately and repetitively.',
        '3.5': 'Satisfactory: Organization provides an underlying coherence although progression may be inconsistent. Text may be stilted in places. Paragraphing is generally appropriate although ideas may not always be supported. Cohesive devices may be over or under used, or used mechanically in places. Text may be repetitive due to lack of referencing. BOUNDARY — NOT Good (4): The text is basically followable BUT shows at least ONE of: inconsistent progression between ideas, stilted/awkward transitions, mechanical/repetitive cohesive devices, or unsupported ideas within paragraphs. KEY TEST: Can the reader follow every idea without re-reading or pausing? If NO → remains 3.5.',
        '4': 'Good: Organization of information and ideas makes text clear and easy to understand. Each paragraph has a main topic supported by some relevant details. Cohesive devices are frequently used accurately both within and/or between sentences. BOUNDARY — NOT Satisfactory (3.5): The text flows clearly WITHOUT requiring re-reading. EVERY paragraph has an identifiable main topic. Cohesive devices are used accurately (not mechanically). KEY TEST from 3.5: Is there ANY paragraph with an unclear main topic, or ANY mechanical/repetitive cohesive device pattern? If NO → 4 is justified.',
        '4.5': 'Very Good: Information and ideas are clearly and logically organized. Each paragraph has a clear main topic supported by relevant details. Cohesive devices are consistently used accurately within and between sentences.',
        '5-6': 'Excellent: Information and ideas are organized so effectively that text has a fluent progression throughout. Opening and closing sections are appropriate and fully developed. Each paragraph has a clear main topic supported by well-organised, relevant details. Cohesive devices are consistently used accurately both within and/or between sentences.'
      }
    },
    {
      name: 'Lexical Resource',
      maxScore: 6,
      description: 'Range and accuracy of vocabulary, word choice, and spelling.',
      rubric: {
        '0-1.5': 'Very Poor: Vocabulary is very limited and may be unrelated to the task or consists largely of inappropriate memorized chunks. Poor word choice and spelling prevent the communication of ideas.',
        '2-2.5': 'Weak: Vocabulary is extremely limited and frequently inappropriate. Word choice and spelling errors are pervasive and severely impede communication. Only isolated words or phrases are comprehensible.',
        '3': 'Unsatisfactory: Vocabulary is inadequate or inappropriate for the level and task and may be used repetitively. Errors in word choice and spelling frequently affect communication.',
        '3.5': 'Satisfactory: Text has a limited but adequate range of vocabulary for the level and task. Core vocabulary is usually used accurately and appropriately. If there are attempts to extend beyond this range, there may be some inaccuracy or inappropriacy which affects communication in places. BOUNDARY — NOT Good (4): Vocabulary is ADEQUATE for basic communication BUT does NOT show the range or precision of Good. At least ONE of: noticeable repetition of key words, lack of topic-specific vocabulary, or attempts at less common vocabulary that result in errors affecting communication. KEY TEST: Does the student use a NOTICEABLY varied range of vocabulary WITHOUT errors that affect communication? If NO → remains 3.5.',
        '4': 'Good: Text has a good range of vocabulary for the level and task. Core vocabulary is frequently used accurately and appropriately. If there are attempts to extend beyond this range, there may be some inaccuracy or inappropriacy, although communication is not affected. BOUNDARY — NOT Satisfactory (3.5): The vocabulary range is NOTICEABLY varied — not just core words repeated. Communication is NOT affected by vocabulary errors. KEY TEST from 3.5: Is vocabulary NOTICEABLY repetitive, or are there vocabulary errors that affect communication? If NEITHER → 4 is justified.',
        '4.5': 'Very Good: Text has a very good range of vocabulary for the level and task. Vocabulary is used accurately and appropriately with only rare minor errors. Communication is clear and effective.',
        '5-6': 'Excellent: Text has a significantly wider range of vocabulary than is expected for the level and task. Core vocabulary is consistently used accurately and appropriately. There may be occasional errors in word choice and spelling where more complex/creative lexis is attempted but communication is not affected.'
      }
    },
    {
      name: 'Grammatical Range and Accuracy',
      maxScore: 6,
      description: 'Range and accuracy of grammatical structures and punctuation.',
      rubric: {
        '0-1.5': 'Very Poor: Structures are inaccurate and errors predominate, preventing meaningful communication. Punctuation may be inadequate and/or inaccurate.',
        '2-2.5': 'Weak: Very limited grammatical structures with frequent serious errors. Most sentences contain errors that impede understanding. Punctuation is largely absent or inaccurate.',
        '3': 'Unsatisfactory: Structures are very limited and inadequate for the level and task. Errors are noticeable and may often affect communication. Punctuation may be inadequate and/or inaccurate.',
        '3.5': 'Satisfactory: Text has a limited but adequate range of structures for the level and task. Core structures for the level are usually used accurately and appropriately although they may sometimes be used mechanically. Grammatical errors may affect communication in places. Punctuation is generally effective. BOUNDARY — NOT Good (4): Grammar is ADEQUATE but NOT varied. The student relies on a narrow set of sentence structures (mostly simple sentences, few complex ones). Grammatical errors may affect communication in at least one place. KEY TEST: Does the student use a GOOD RANGE of structures (simple + compound + complex) with communication NOT affected by grammar errors? If NO → remains 3.5.',
        '4': 'Good: Text has a good range of structures for the level and task. Core structures for the level are frequently used accurately and appropriately. If there are attempts to extend beyond this range, there may be some inaccuracy or inappropriacy, without affecting communication. Punctuation is well managed and effective. BOUNDARY — NOT Satisfactory (3.5): The student uses a GOOD RANGE of structures (not just simple sentences). Grammar errors, if present, do NOT affect communication. KEY TEST from 3.5: Is sentence structure noticeably varied, AND are there NO grammar errors that affect communication? If BOTH → 4 is justified.',
        '4.5': 'Very Good: Text has a very good range of structures for the level. Most structures are used accurately and appropriately. Minor errors do not impede communication. Punctuation is well managed and effective.',
        '5-6': 'Excellent: Text has a significantly wider range of structures than is expected for the level and task. Core structures are consistently used accurately and appropriately. There may be occasional errors where more complex structures are attempted but communication is not affected. Punctuation is well managed and effective.'
      }
    }
  ],
  specialRules:[
    'If the text is somewhat off-topic, deduct 50% of the mark obtained for Task Response and Lexical Resource.',
    'A completely off-topic text should receive a zero for Task Response and Lexical Resource.',
    'SCORE FLOOR: If the student wrote at least 50% of the minimum word count and the text is on-topic, each criterion must receive a minimum of 1/6. A score of 0/6 is reserved only for blank, near-blank, or completely incomprehensible submissions.',
    'ANTI-DOUBLE-PENALIZATION: Each error should be penalized in only ONE criterion. Do not deduct for the same underlying issue across multiple criteria.',
  ]
};

const CREDIT_CRITERIA = [
  { name: 'Task Achievement', maxScore: 5, description: 'How well the essay achieves the task requirements' },
  { name: 'Coherence & Cohesion', maxScore: 5, description: 'Logical organization and linking of ideas' },
  { name: 'Lexical Resource', maxScore: 5, description: 'Range and accuracy of vocabulary' },
  { name: 'Grammatical Range & Accuracy', maxScore: 5, description: 'Range and accuracy of grammar' },
];

const CREDIT_RUBRICS = {
  criteria: [
    {
      name: 'Task Achievement', maxScore: 5,
      rubric: {
        '0-1.5': 'Poor: Fails to fulfil any task requirements. 10% or more outside word count.',
        '2-2.5': 'Unsatisfactory: Does not adequately fulfil task requirements. Most details are unimportant. 10% or more outside word count.',
        '3-3.5': 'Satisfactory: Adequately fulfils task requirements. Most main ideas present. Meaning generally accurate; some unimportant details may be included. Up to 10% outside word count. BOUNDARY — NOT Good (4-4.5): At least ONE of: a main idea is missing, an unimportant detail takes the place of a key point, meaning is "generally" accurate but has some inaccuracies, or word count is outside the target range. KEY TEST: Are ALL main ideas present with accurate meaning AND relevant details AND within word count? If ANY fails → remains 3-3.5.',
        '4-4.5': 'Good: Fulfils all task requirements but a little more could be expected. Main ideas present. Meaning mostly accurate, most details relevant. Stays within word count. BOUNDARY — NOT Satisfactory (3-3.5): ALL main ideas are present (no missing points). Meaning is MOSTLY accurate (not just "generally"). MOST details are relevant. Word count is within range. KEY TEST from 3-3.5: Is there ANY missing main idea, ANY significant meaning inaccuracy, ANY irrelevant detail, or ANY word count violation? If ALL NO → 4-4.5 is justified.',
        '5': 'Excellent: Fulfils all task requirements and exceeds expectations. All main ideas present. Meaning accurate, all details relevant. Stays within word count.',
      }
    },
    {
      name: 'Coherence & Cohesion', maxScore: 5,
      rubric: {
        '0-1.5': 'Poor: Lacks organization and coherence. Text largely confused and incoherent, challenging for reader to process.',
        '2-2.5': 'Unsatisfactory: Organization and coherence limited. Some re-reading necessary. Most cohesive devices are simple, used inaccurately and mechanically.',
        '3-3.5': 'Satisfactory: Organization and coherence often adequate, but supporting ideas may be limited. Text may be stilted. Cohesive devices sometimes inaccurate, repetitive, or over/under used. BOUNDARY — NOT Good (4-4.5): At least ONE of: supporting ideas are limited, text feels stilted/awkward in places, cohesive devices are sometimes inaccurate or repetitive. KEY TEST: Is the text clear and easy to understand throughout, with accurate cohesive devices? If NO → remains 3-3.5.',
        '4-4.5': 'Good: Organization makes text clear and easy to understand. Cohesive devices almost always used accurately and appropriately within and between sentences. BOUNDARY — NOT Satisfactory (3-3.5): The text is clear and easy to understand (not just "adequate"). Cohesive devices are ALMOST ALWAYS accurate (not "sometimes inaccurate"). KEY TEST from 3-3.5: Is there ANY section that is stilted or hard to follow, OR ANY inaccurate/repetitive cohesive device? If ALL NO → 4-4.5 is justified.',
        '5': 'Excellent: Effective organization with logical flow throughout. Good range of cohesive devices used accurately and appropriately.',
      }
    },
    {
      name: 'Lexical Resource', maxScore: 5,
      rubric: {
        '0-1.5': 'Poor: Paraphrasing largely absent. Poor word choice, word form, and spelling prevent communication.',
        '2-2.5': 'Unsatisfactory: Very little paraphrasing; more than 15% directly copied. Inadequate vocabulary range. Errors in word choice, word form, and spelling predominate and affect communication.',
        '3-3.5': 'Satisfactory: Generally paraphrased; some copying but less than 15%. Limited but adequate vocabulary. Errors in word choice and spelling sometimes affect communication. BOUNDARY — NOT Good (4-4.5): There IS some direct copying (even if under 15%). Vocabulary is "limited but adequate" — NOT yet showing good range. Errors in word choice or spelling sometimes affect communication. KEY TEST: Is the text well paraphrased with VERY LITTLE copying, good vocabulary range, AND no communication-affecting errors? If ANY fails → remains 3-3.5.',
        '4-4.5': 'Good: Well paraphrased with very little copying. Good vocabulary range. Spelling mostly correct. BOUNDARY — NOT Satisfactory (3-3.5): Paraphrasing is effective with VERY LITTLE copying (not "some copying"). Vocabulary range is GOOD (not "limited but adequate"). KEY TEST from 3-3.5: Is there ANY noticeable copying, ANY limited/repetitive vocabulary, OR ANY word choice errors that affect communication? If ALL NO → 4-4.5 is justified.',
        '5': 'Excellent: Completely and accurately paraphrased. Wider vocabulary range than expected for the level. Spelling accurate.',
      }
    },
    {
      name: 'Grammatical Range & Accuracy', maxScore: 5,
      rubric: {
        '0-1.5': 'Poor: Inaccurate structures, errors predominate, preventing communication. Punctuation inadequate and/or inaccurate.',
        '2-2.5': 'Unsatisfactory: Very limited structures inadequate for the level. Grammatical errors noticeable and often affect communication. Punctuation may be inadequate/inaccurate.',
        '3-3.5': 'Satisfactory: Structures sometimes limited but adequate for the task. Grammatical errors may affect communication in places. Punctuation generally correct and effective. BOUNDARY — NOT Good (4-4.5): Grammar is "sometimes limited" — the student does NOT yet show a good range of structures. Errors "may affect communication in places" — communication is NOT consistently smooth. KEY TEST: Is there a GOOD RANGE of structures (not "sometimes limited") AND do grammar errors NOT affect communication? If EITHER fails → remains 3-3.5.',
        '4-4.5': 'Good: Good range of structures. Some inaccuracy but communication not affected. Punctuation well managed and effective. BOUNDARY — NOT Satisfactory (3-3.5): The student shows a GOOD RANGE of structures (not "sometimes limited"). Communication is NOT affected by grammar errors (not "may affect in places"). KEY TEST from 3-3.5: Are structures "sometimes limited" OR do grammar errors affect communication? If BOTH NO → 4-4.5 is justified.',
        '5': 'Excellent: Wider range of structures than expected for the level. Most sentences error-free. Punctuation well managed and effective.',
      }
    },
  ],
};

const SUMMARY_CRITERIA = [
  { name: 'Task Achievement', maxScore: 5, description: 'How effectively the summary captures the main points of the source text using the student\'s own words.' },
  { name: 'Coherence & Cohesion', maxScore: 5, description: 'How logically the summary is organized and how well ideas are linked together.' },
  { name: 'Lexical Resource', maxScore: 5, description: 'The range and accuracy of vocabulary used, including paraphrasing ability.' },
  { name: 'Grammar & Accuracy', maxScore: 5, description: 'The range and accuracy of grammatical structures, sentence variety, and punctuation.' },
];

const SUMMARY_RUBRICS = {
  criteria: [
    {
      name: 'Task Achievement', maxScore: 5,
      rubric: {
        '0-1': 'No summary, irrelevant, or isolated words. No main ideas captured. Largely copied.',
        '2': 'Captures at most one main idea. Misses most key points. Minimal paraphrasing, heavy copying.',
        '2.5-3': 'Captures main ideas adequately but may miss 1-2 points. Some paraphrasing with noticeable copying. BOUNDARY — NOT 3.5: Misses 1–2 main ideas from the source. Paraphrasing is inconsistent — some sentences are clearly copied rather than reworded. KEY TEST for 3.5: Are ALL main ideas captured with CONSISTENT paraphrasing? If NO → remains 2.5-3.',
        '3.5': 'Captures all main ideas effectively. Consistent paraphrasing with minor copied phrases. BOUNDARY — NOT 2.5-3: ALL main ideas are captured (no missing points). Paraphrasing is CONSISTENT (not just "some"). NOT 4-4.5: Still has minor copied phrases. KEY TEST for 4-4.5: Does the summary read as an INDEPENDENT text with EFFECTIVE paraphrasing throughout? If NO → remains 3.5.',
        '4-4.5': 'All main ideas captured clearly. Effective paraphrasing throughout. Focused, cohesive. BOUNDARY — NOT 3.5: Paraphrasing is EFFECTIVE throughout (not "consistent with minor copied phrases"). The summary is FOCUSED and COHESIVE (no unnecessary details, no tangents). KEY TEST from 3.5: Are there ANY noticeable copied phrases OR is the summary unfocused? If ALL NO → 4-4.5 is justified.',
        '5': 'Comprehensive, accurate reflection of source. Natural paraphrasing. Reads as independent text.',
      }
    },
    {
      name: 'Coherence and Cohesion', maxScore: 5,
      rubric: {
        '0-1': 'No coherence. Random fragments. No linking words. Ideas cannot be followed.',
        '2': 'Minimal organisation. Ideas listed, not connected. Very few linking words. Disjointed.',
        '2.5-3': 'Basic organisation. Simple linking words used appropriately. Generally easy to follow. BOUNDARY — NOT 3.5: Organization is basic with simple linking only. KEY TEST for 3.5: Is there clear logical progression with a good range of cohesive devices? If NO → remains 2.5-3.',
        '3.5': 'Well-organised with clear logical progression. Good range of cohesive devices. Smooth flow. BOUNDARY — NOT 2.5-3: Clear logical progression present with good range of cohesive devices. NOT 4-4.5: Flow is smooth but not yet "strong" or "natural" throughout. KEY TEST for 4-4.5: Are cohesive devices used effectively and NATURALLY throughout? If NO → remains 3.5.',
        '4-4.5': 'Clearly organised with strong progression. Cohesive devices used effectively and naturally. BOUNDARY — NOT 3.5: Cohesive devices used effectively and NATURALLY (not just "good range"). Strong progression throughout. KEY TEST from 3.5: Are cohesive devices used naturally throughout? If YES → 4-4.5 is justified.',
        '5': 'Exceptional organisation with flawless logical flow. Cohesive devices used with mastery.',
      }
    },
    {
      name: 'Lexical Resource', maxScore: 5,
      rubric: {
        '0-1': 'Extremely limited vocabulary. Inaccurate word choice. Pervasive spelling errors.',
        '2': 'Limited vocabulary, frequent repetition. Awkward word choice. Frequent spelling errors.',
        '2.5-3': 'Adequate vocabulary range. Basic paraphrasing usually effective. Some spelling errors. BOUNDARY — NOT 3.5: Vocabulary is adequate but basic, with some spelling errors. KEY TEST for 3.5: Is vocabulary range GOOD with effective paraphrasing and attempts at less common vocabulary? If NO → remains 2.5-3.',
        '3.5': 'Good vocabulary range. Paraphrasing effective. Some less common vocabulary attempted. BOUNDARY — NOT 2.5-3: Good vocabulary range with effective paraphrasing. NOT 4-4.5: Vocabulary is good but not yet "varied" or "natural" throughout. KEY TEST for 4-4.5: Is vocabulary VARIED with NATURAL paraphrasing and strong word choice? If NO → remains 3.5.',
        '4-4.5': 'Varied vocabulary. Natural paraphrasing. Strong word choice and collocation. BOUNDARY — NOT 3.5: Vocabulary is VARIED with NATURAL paraphrasing and strong word choice/collocation. KEY TEST from 3.5: Is vocabulary noticeably varied AND is paraphrasing natural throughout? If BOTH → 4-4.5 is justified.',
        '5': 'Sophisticated, precise vocabulary. Consistently natural paraphrasing. Flawless spelling.',
      }
    },
    {
      name: 'Grammar & Accuracy', maxScore: 5,
      rubric: {
        '0-1': 'No grammatical control. Random fragments. Errors prevent communication.',
        '2': 'Simple structures with frequent errors. Limited variety. Common errors (articles, tenses).',
        '2.5-3': 'Simple sentences accurate, some complex attempted. Errors occur but do not significantly affect meaning. BOUNDARY — NOT 3.5: Simple sentences accurate but complex structures have errors. KEY TEST for 3.5: Is there a good range of structures with reasonable accuracy and good sentence variety? If NO → remains 2.5-3.',
        '3.5': 'Good range of structures with reasonable accuracy. Minor errors. Good sentence variety. BOUNDARY — NOT 2.5-3: Good range of structures with reasonable accuracy. NOT 4-4.5: Errors are minor but present; sentence variety is good but not yet "enhancing quality." KEY TEST for 4-4.5: Is there strong control including complex sentences with infrequent errors? If NO → remains 3.5.',
        '4-4.5': 'Strong control including complex sentences. Errors infrequent/rare. Sentence variety enhances quality. BOUNDARY — NOT 3.5: Strong control including complex sentences. Errors are infrequent/rare. Sentence variety enhances quality. KEY TEST from 3.5: Is control strong AND are errors infrequent? If BOTH → 4-4.5 is justified.',
        '5': 'Near-native control. Wide variety of structures used naturally and accurately. Flawless punctuation.',
      }
    },
  ],
};

const SYNTHESIS_CRITERIA = [
  { name: 'Task Achievement', maxScore: 5, description: 'How effectively the synthesis essay fulfils the task requirements, synthesizes information from all source texts, and addresses the assignment prompt.' },
  { name: 'Coherence and Cohesion', maxScore: 5, description: 'How logically the synthesis essay is organized, how well ideas are linked, and how effectively information flows.' },
  { name: 'Lexical Resource', maxScore: 5, description: 'The range and accuracy of vocabulary, including paraphrasing ability and appropriate word choice.' },
  { name: 'Grammatical Range and Accuracy', maxScore: 5, description: 'The range and accuracy of grammatical structures, sentence variety, and punctuation.' },
];

const SYNTHESIS_RUBRICS = {
  criteria: [
    {
      name: 'Task Achievement', maxScore: 5,
      rubric: {
        '0-1.5': 'Poor: Fails to fulfil any task requirements. 10% or more outside word count.',
        '2-2.5': 'Unsatisfactory: Does not adequately fulfil task requirements. Most details are unimportant. 10% or more outside word count.',
        '3-3.5': 'Satisfactory: Adequately fulfils task requirements. Most main ideas present. Meaning generally accurate; some unimportant details may be included. Up to 10% outside word count. BOUNDARY — NOT Good (4-4.5): At least ONE of: a main idea is missing, an unimportant detail takes the place of a key point, meaning is "generally" accurate but has some inaccuracies, or word count is outside the target range. KEY TEST: Are ALL main ideas present with accurate meaning AND relevant details AND within word count? If ANY fails → remains 3-3.5. SYNTHESIS-SPECIFIC: At least one source text is not referenced or used. KEY TEST: Are ALL source texts referenced? If NO → remains 3-3.5.',
        '4-4.5': 'Good: Fulfils all task requirements but a little more could be expected. Main ideas present. Meaning mostly accurate, most details relevant. Stays within word count. BOUNDARY — NOT Satisfactory (3-3.5): ALL main ideas are present (no missing points). Meaning is MOSTLY accurate (not just "generally"). MOST details are relevant. Word count is within range. KEY TEST from 3-3.5: Is there ANY missing main idea, ANY significant meaning inaccuracy, ANY irrelevant detail, or ANY word count violation? If ALL NO → 4-4.5 is justified. SYNTHESIS-SPECIFIC: ALL source texts are referenced and integrated (not just listed). KEY TEST: Are ALL source texts used in the synthesis? If YES → synthesis requirement met.',
        '5': 'Excellent: Fulfils all task requirements and exceeds expectations. All main ideas present. Meaning accurate, all details relevant. Stays within word count.',
      }
    },
    {
      name: 'Coherence and Cohesion', maxScore: 5,
      rubric: {
        '0-1.5': 'Poor: Lacks organization and coherence. Text largely confused and incoherent, challenging for reader to process.',
        '2-2.5': 'Unsatisfactory: Organization and coherence limited. Some re-reading necessary. Most cohesive devices are simple, used inaccurately and mechanically.',
        '3-3.5': 'Satisfactory: Organization and coherence often adequate, but supporting ideas may be limited. Text may be stilted. Cohesive devices sometimes inaccurate, repetitive, or over/under used. BOUNDARY — NOT Good (4-4.5): At least ONE of: supporting ideas are limited, text feels stilted/awkward in places, cohesive devices are sometimes inaccurate or repetitive. KEY TEST: Is the text clear and easy to understand throughout, with accurate cohesive devices? If NO → remains 3-3.5.',
        '4-4.5': 'Good: Organization makes text clear and easy to understand. Cohesive devices almost always used accurately and appropriately within and between sentences. BOUNDARY — NOT Satisfactory (3-3.5): The text is clear and easy to understand (not just "adequate"). Cohesive devices are ALMOST ALWAYS accurate (not "sometimes inaccurate"). KEY TEST from 3-3.5: Is there ANY section that is stilted or hard to follow, OR ANY inaccurate/repetitive cohesive device? If ALL NO → 4-4.5 is justified.',
        '5': 'Excellent: Effective organization with logical flow throughout. Good range of cohesive devices used accurately and appropriately.',
      }
    },
    {
      name: 'Lexical Resource', maxScore: 5,
      rubric: {
        '0-1.5': 'Poor: Paraphrasing largely absent. Poor word choice, word form, and spelling prevent communication.',
        '2-2.5': 'Unsatisfactory: Very little paraphrasing; more than 15% directly copied. Inadequate vocabulary range. Errors in word choice, word form, and spelling predominate and affect communication.',
        '3-3.5': 'Satisfactory: Generally paraphrased; some copying but less than 15%. Limited but adequate vocabulary. Errors in word choice and spelling sometimes affect communication. BOUNDARY — NOT Good (4-4.5): There IS some direct copying (even if under 15%). Vocabulary is "limited but adequate" — NOT yet showing good range. Errors in word choice or spelling sometimes affect communication. KEY TEST: Is the text well paraphrased with VERY LITTLE copying, good vocabulary range, AND no communication-affecting errors? If ANY fails → remains 3-3.5.',
        '4-4.5': 'Good: Well paraphrased with very little copying. Good vocabulary range. Spelling mostly correct. BOUNDARY — NOT Satisfactory (3-3.5): Paraphrasing is effective with VERY LITTLE copying (not "some copying"). Vocabulary range is GOOD (not "limited but adequate"). KEY TEST from 3-3.5: Is there ANY noticeable copying, ANY limited/repetitive vocabulary, OR ANY word choice errors that affect communication? If ALL NO → 4-4.5 is justified.',
        '5': 'Excellent: Completely and accurately paraphrased. Wider vocabulary range than expected for the level. Spelling accurate.',
      }
    },
    {
      name: 'Grammatical Range and Accuracy', maxScore: 5,
      rubric: {
        '0-1.5': 'Poor: Inaccurate structures, errors predominate, preventing communication. Punctuation inadequate and/or inaccurate.',
        '2-2.5': 'Unsatisfactory: Very limited structures inadequate for the level. Grammatical errors noticeable and often affect communication. Punctuation may be inadequate/inaccurate.',
        '3-3.5': 'Satisfactory: Structures sometimes limited but adequate for the task. Grammatical errors may affect communication in places. Punctuation generally correct and effective. BOUNDARY — NOT Good (4-4.5): Grammar is "sometimes limited" — the student does NOT yet show a good range of structures. Errors "may affect communication in places" — communication is NOT consistently smooth. KEY TEST: Is there a GOOD RANGE of structures (not "sometimes limited") AND do grammar errors NOT affect communication? If EITHER fails → remains 3-3.5.',
        '4-4.5': 'Good: Good range of structures. Some inaccuracy but communication not affected. Punctuation well managed and effective. BOUNDARY — NOT Satisfactory (3-3.5): The student shows a GOOD RANGE of structures (not "sometimes limited"). Communication is NOT affected by grammar errors (not "may affect in places"). KEY TEST from 3-3.5: Are structures "sometimes limited" OR do grammar errors affect communication? If BOTH NO → 4-4.5 is justified.',
        '5': 'Excellent: Wider range of structures than expected for the level. Most sentences error-free. Punctuation well managed and effective.',
      }
    },
  ],
};

const LANC2146_CRITERIA = [
  { name: 'Task Response', maxScore: 5, description: 'Analysis and interpretation of data with details/examples/statistics; quality of the discussion section; adequacy of the conclusion (most obvious result, reference to previous research, restatement of aim, solutions/recommendations).' },
  { name: 'Coherence and Cohesion', maxScore: 5, description: 'Logical organization of information and ideas; use of cohesive devices (conjunctions and linkers); paragraphing.' },
  { name: 'Grammatical Range and Accuracy', maxScore: 5, description: 'Use of grammatical functions (cause/effect, compare/contrast, prediction, recommendation/suggestion/solution); grammar structures accuracy; punctuation.' },
  { name: 'Lexical Resource', maxScore: 5, description: 'Vocabulary range and genre-specific register; spelling, word formation, and capitalization.' },
];

const LANC2146_RUBRICS = {
  criteria: [
    {
      name: 'Task Response', maxScore: 5,
      rubric: {
        '1': 'Poor (1-1.5): The analysis and interpretation of the main trend lacks specific details, examples, and statistics. The conclusion is missing or irrelevant.',
        '2': 'Unsatisfactory (2-2.5): The analysis and interpretation of the main trend is supported by few details, examples, and statistics. The conclusion is insufficient, may not refer to previous research, may not restate the aim, and provides irrelevant recommendations.',
        '3': 'Satisfactory (3-3.5): The analysis and interpretation of one clear main trend is supported by relevant details and examples, including some statistics. The conclusion adequately summarizes the most obvious result, refers to previous research, restates the aim, and provides solutions/general recommendations, but there may be gaps in coverage. BOUNDARY — NOT Good (4-4.5): At least ONE of: statistics are present but not specific (e.g., "the numbers went up" without citing exact figures), the conclusion has gaps (missing previous research reference, missing aim restatement, or recommendations are generic rather than specific), or the analysis is surface-level without interpretation. KEY TEST: Are there ADEQUATE specific statistics, is the conclusion COMPLETE (all 4 elements present), and are recommendations SPECIFIC? If ANY fails → remains 3-3.5.',
        '4': 'Good (4-4.5): The analysis and interpretation of one clear main trend is supported by adequate details, examples, and relevant statistics. The conclusion adequately summarizes the most obvious result, refers to previous research, restates the aim, and provides solutions/general recommendations. BOUNDARY — NOT Satisfactory (3-3.5): Statistics are SPECIFIC and ADEQUATE. The conclusion is COMPLETE (all 4 elements: obvious result, previous research, aim restatement, recommendations). KEY TEST from 3-3.5: Is there ANY missing conclusion element, ANY vague statistics, OR ANY gap in coverage? If ALL NO → 4-4.5 is justified.',
        '5': 'Excellent (5): The analysis and interpretation of one clear main trend is supported by carefully chosen details and examples, including comprehensive statistics. The conclusion provides an insightful and effective summary of the most obvious result, refers to previous research, restates the aim, and provides solutions/specific recommendations.',
      }
    },
    {
      name: 'Coherence and Cohesion', maxScore: 5,
      rubric: {
        '1': 'Poor (1-1.5): Lacks coherent development of ideas, with disjointed or illogical writing which is largely confused and incoherent. Cohesive devices are missing or used inaccurately. Paragraphs lack clear organization and unity, with ideas scattered or unrelated.',
        '2': 'Unsatisfactory (2-2.5): Only basic understanding of information in the text through illogical and/or incoherent writing with limited development of ideas, and connections between concepts are unclear or inconsistent. Cohesive devices are used inaccurately and inappropriately. Paragraphs demonstrate some attempt at organization.',
        '3': 'Satisfactory (3-3.5): Generally logical and coherent writing, but may not be completely successful, possibly due to some misunderstanding of the data. Cohesive devices used may be accurate but not appropriate or too simple, over or under used, creating many abrupt or weak transitions. Paragraphs demonstrate development of ideas, but the organization is not sustained. BOUNDARY — NOT Good (4-4.5): At least ONE of: supporting ideas are limited, text feels stilted/awkward in places, cohesive devices are sometimes inaccurate or repetitive. KEY TEST: Is the text clear and easy to understand throughout, with accurate cohesive devices? If NO → remains 3-3.5.',
        '4': 'Good (4-4.5): Sufficient depth of analysis and interpretation, but with some abrupt or weak transitions. Cohesive devices are usually used accurately and appropriately. Paragraphs exhibit clear organization and unity. BOUNDARY — NOT Satisfactory (3-3.5): The text is clear and easy to understand (not just "adequate"). Cohesive devices are ALMOST ALWAYS accurate (not "sometimes inaccurate"). KEY TEST from 3-3.5: Is there ANY section that is stilted or hard to follow, OR ANY inaccurate/repetitive cohesive device? If ALL NO → 4-4.5 is justified.',
        '5': 'Excellent (5): Seamless flow of ideas with effective transitions that guide the reader through the in-depth analysis and interpretation. An extensive range of cohesive devices is used accurately and appropriately. Paragraphs are exceptionally well-organized and unified.',
      }
    },
    {
      name: 'Grammatical Range and Accuracy', maxScore: 5,
      rubric: {
        '1': 'Poor (1-1.5): Little control of grammar, with basic faulty sentence structures. Severe grammar errors that significantly impede understanding. Numerous instances of incorrect or missing punctuation throughout the text, hindering readability and comprehension.',
        '2': 'Unsatisfactory (2-2.5): Limited control of grammar, with repetitive sentence structures. Noticeable grammar errors throughout the text, making comprehension difficult. Noticeable errors in punctuation, hindering readability and comprehension.',
        '3': 'Satisfactory (3-3.5): Adequate control of grammar, with repetitive sentence structures. Occasional errors which impede understanding. Occasional instances of incorrect or missing punctuation, but overall punctuation usage is adequate for understanding. BOUNDARY — NOT Good (4-4.5): Grammar is "sometimes limited" — the student does NOT yet show a good range of structures. Errors "may affect communication in places" — communication is NOT consistently smooth. KEY TEST: Is there a GOOD RANGE of structures (not "sometimes limited") AND do grammar errors NOT affect communication? If EITHER fails → remains 3-3.5.',
        '4': 'Good (4-4.5): Proficient use of grammar, with a wide range of sentence structures with a few errors that do not impede understanding. The majority of sentences are error-free. Generally correct and appropriately-used punctuation, with only minor errors that do not significantly affect readability and comprehension. BOUNDARY — NOT Satisfactory (3-3.5): The student shows a GOOD RANGE of structures (not "sometimes limited"). Communication is NOT affected by grammar errors (not "may affect in places"). KEY TEST from 3-3.5: Are structures "sometimes limited" OR do grammar errors affect communication? If BOTH NO → 4-4.5 is justified.',
        '5': 'Excellent (5): Exemplary command of grammar, with a variety of sentence structures with no errors, allowing for clear and precise communication of ideas. All sentences are error-free. Punctuation is error-free and effectively used to enhance readability and comprehension.',
      }
    },
    {
      name: 'Lexical Resource', maxScore: 5,
      rubric: {
        '1': 'Poor (1-1.5): Basic vocabulary which may be repetitive or inappropriate for the task, hindering understanding. Limited control of word formation and/or spelling; numerous severe spelling and capitalization errors.',
        '2': 'Unsatisfactory (2-2.5): Uses a limited range of vocabulary (vocabulary choices are often inappropriate or ineffective, detracting from the overall quality of the description), but this is minimally adequate for the task. May make frequent and noticeable errors in spelling and/or word formation throughout the text, making it difficult to understand.',
        '3': 'Satisfactory (3-3.5): Uses an adequate range of vocabulary for the task (vocabulary choices are generally appropriate with some awareness of style and collocation, but there is some repetition or lack of variety). Makes some errors in spelling and/or word formation that may cause some difficulty for the reader. BOUNDARY — NOT Good (4-4.5): There IS some direct copying (even if under 15%). Vocabulary is "limited but adequate" — NOT yet showing good range. Errors in word choice or spelling sometimes affect communication. KEY TEST: Is the text well paraphrased with VERY LITTLE copying, good vocabulary range, AND no communication-affecting errors? If ANY fails → remains 3-3.5.',
        '4': 'Good (4-4.5): Uses a wide range of vocabulary with uncommon lexical items to allow some flexibility and precision, but there may be occasional inaccuracies in word choice and collocation. Produces rare errors in spelling and/or word formation and capitalization but they do not impede communication. BOUNDARY — NOT Satisfactory (3-3.5): Paraphrasing is effective with VERY LITTLE copying (not "some copying"). Vocabulary range is GOOD (not "limited but adequate"). KEY TEST from 3-3.5: Is there ANY noticeable copying, ANY limited/repetitive vocabulary, OR ANY word choice errors that affect communication? If ALL NO → 4-4.5 is justified.',
        '5': 'Excellent (5): Uses a wide range of vocabulary (rich, varied, and perfectly suited to the context) with very natural and sophisticated control of lexical features; rare minor errors occur only as slips. Produces no errors in spelling and/or word formation and capitalization.',
      }
    },
  ],
};

// ─── Gemini Structured Output Schema ────────────────────────────────────────
// totalScore, maxScore, and percentage are NOT included — LLMs hallucinate
// arithmetic. Those are computed purely in TypeScript after the response.
// Uses @google/genai Type enum (replaces SchemaType from old SDK).
// ─────────────────────────────────────────────────────────────────────────────

// Shared sub-schema for per-criterion score items
function buildScoreSchema(enumValues: string[], description: string) {
  return {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        criterionName: { type: Type.STRING },
        score: {
          type: Type.STRING,
          format: 'enum' as const,
          enum: enumValues,
          description,
        },
        maxScore: { type: Type.NUMBER },
        justification: { type: Type.STRING },
        strengths: { type: Type.STRING },
        mistakes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              quote: { type: Type.STRING },
              explanation: { type: Type.STRING },
            },
            required: ['quote', 'explanation'],
          },
        },
        suggestions: { type: Type.STRING },
      },
      required: ['criterionName', 'score', 'maxScore', 'justification', 'strengths', 'mistakes', 'suggestions'],
    },
  };
}

// Schema for Foundation Courses (FP0230, FP0340) — Strict 0–6 scale in 0.5 increments
const FOUNDATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    scores: buildScoreSchema(
      ['0', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '5.5', '6'],
      'Rubric score. You MUST select ONLY from the allowed 0.5 increment values between 0 and 6.',
    ),
    overallFeedback: { type: Type.STRING },
  },
  required: ['scores', 'overallFeedback'],
};

// Schema for Credit/Post-Foundation Courses — Strict 0–5 scale in 0.5 increments
const CREDIT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    scores: buildScoreSchema(
      ['0', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'],
      'Rubric score. You MUST select ONLY from the allowed 0.5 increment values between 0 and 5.',
    ),
    overallFeedback: { type: Type.STRING },
  },
  required: ['scores', 'overallFeedback'],
};

const CREDIT_HUMANIZATION = `
FIRST DRAFT AWARENESS:
These are handwritten exam essays written under timed conditions — they are first drafts with no opportunity for revision, editing, or spell-check. Do NOT penalize for lack of polish. Evaluate what the student ACHIEVED in a single timed sitting.

OCR ERROR AWARENESS:
The student text was extracted via OCR from handwritten scripts. Many apparent "spelling errors" may be OCR artifacts (letter substitution, merged/split words, character misrecognition). Do NOT count any spelling error as a student error or lower the Lexical Resource score for it — the AI cannot reliably distinguish OCR artifacts from genuine student spelling mistakes, so ALL apparent spelling errors must be treated as potential OCR artifacts and forgiven. Only flag a spelling issue if the exact same error appears 3+ times in a consistent pattern (e.g., "thier" repeated throughout), indicating it is clearly the student's own spelling rather than OCR noise.
BAND CALIBRATION FOR CEFR A2-B1 (what each band looks like at this level):
- 4.5-5/5 (Excellent): Exceptional for A2-B1. Approaches B1+ level. Very rare.
- 4/5 (Good): Strong for A2-B1. Clear communication with minor expected errors.
- 3-3.5/5 (Satisfactory): Average for A2-B1. Meaning usually clear despite grammar/vocabulary errors. Most credit students score here.
- 2-2.5/5 (Unsatisfactory): Below expectations even for A2-B1. Frequent errors impede understanding.
- 0-1.5/5 (Poor): Incomprehensible, completely off-task, or large-scale copying. Reserve for genuine failures.

ERROR CLASSIFICATION (apply per criterion — this is critical):
1. Expected A2/B1 errors (missing articles a/an/the, wrong prepositions in/on/at, subject-verb agreement for 3rd person singular, awkward paraphrasing from sources, limited sentence variety, minor spelling) → Do NOT lower the score. These are normal developmental errors at this level.
   ARABIC L1 TRANSFER ERRORS (also Expected — do NOT lower score):
   The students are Arabic L1 speakers. These patterns are normal developmental transfer, though some may be less frequent at A2-B1:
   - Missing copula "be" (e.g., "She happy" instead of "She is happy") — Arabic has no present-tense copula
   - Omission of indefinite articles (e.g., "I am student") — Arabic has no indefinite article
   - Overuse of definite article (e.g., "the life is hard") — Arabic uses al-definiteness more broadly
   - Subject-verb agreement with 3rd person singular (e.g., "he go") — Arabic verbs don't inflect for person the same way
   - Adjective-noun word order reversal (e.g., "car big" instead of "big car") — Arabic places adjectives after nouns (less frequent at A2-B1)
   - Preposition substitution (e.g., "in Monday" instead of "on Monday") — Arabic preposition usage differs significantly
   - Missing "it/there" expletive subjects (e.g., "Is hot today") — Arabic is pro-drop (less frequent at A2-B1)
   If these errors appear but meaning is still clear, classify them as expected A2/B1 errors. Only flag them if they genuinely impede comprehension.
2. Non-impeding errors (meaning still clear; repetitive vocabulary, minor punctuation, occasional awkward phrasing) → Only minor score impact if frequent.
3. Impeding errors (reader cannot understand; wrong text type; large-scale copying without paraphrasing; task fundamentally not met) → Significant score impact.
Rate each criterion based primarily on COMMUNICATION SUCCESS and IMPEDING errors, not total error count.

ANTI-DOUBLE-PENALIZATION:
1. Each error should be penalized in ONLY ONE criterion — the one where it primarily belongs:
   - Grammar errors (verb tense, subject-verb agreement, word order) → Grammar only
   - Word choice errors (wrong word, wrong form) → Lexical Resource only
   - Structural errors (missing paragraph, no cohesion) → Coherence & Cohesion only
2. If an error has secondary effects on another criterion, do NOT deduct again. For example, a grammar error that makes a sentence slightly awkward does NOT also lower Coherence.
3. The ONLY exception is Task Achievement, which may be independently affected if content is off-topic, regardless of other criterion scores.

EFFORT REWARD — REWARD ATTEMPTED COMPLEXITY:
1. If a student attempts a complex structure (e.g., subordinate clause, conditional, passive voice) and makes an error, the score should NOT be lower than if the student had written a simpler correct sentence. Reward the attempt.
2. If a student attempts to use a less common vocabulary word but uses it slightly incorrectly (e.g., wrong preposition collocation, wrong word form), this should be classified as a "non-impeding error" at minimum — do NOT penalize more harshly than if the student had used a simpler, correct word.
3. Students who show RANGE (even imperfect) should not score lower than students who show ACCURACY only in a narrow band. Range + some errors ≥ Accuracy in simple structures only.

SCORE FLOOR FOR GENUINE ATTEMPTS:
1. If a student has written at least 50% of the minimum word count AND the text is on-topic, each criterion should receive a MINIMUM of 1/5 — because producing any on-topic text demonstrates some level of competence in each criterion.
2. A score of 0/5 should be reserved ONLY for:
   - Complete off-topic writing (for Task Achievement)
   - Completely incomprehensible text (for other criteria)
   - Blank or near-blank submissions

SPECIAL RULES:
1. Reward successful communication of ideas. Do not be overly harsh on A2/B1 grammatical/spelling errors if the overall meaning is clear.
2. For error listings: classify each error as expected, non-impeding, or impeding. Do NOT provide corrections.

BORDERLINE DECISIONS — BENEFIT OF THE DOUBT:
1. When a student's performance sits on the borderline between two bands (e.g., 3 vs 3.5, or 4 vs 4.5), award the HIGHER band if:
   - The student showed effort beyond the minimum (attempted complexity, addressed the topic with some depth)
   - The errors present are primarily "expected" or "non-impeding" per the error classification rules
   - Communication was largely successful despite imperfections
2. Only award the LOWER band if:
   - Errors are predominantly "impeding" (meaning genuinely unclear)
   - The writing shows minimal effort or engagement with the task
   - Performance clearly falls on the lower side of the borderline
3. Default rule: When genuinely uncertain, round UP to the nearest 0.5 increment.

FEEDBACK TONE GUARDRAILS:
1. ALWAYS begin each criterion's feedback with at least one specific strength or successful communication moment before discussing errors.
2. Frame suggestions as "next steps" or "to improve further," never as "you failed to" or "you should have."
3. Use asset-based language:
   - "You successfully expressed..." / "You attempted a complex sentence..."
   - Avoid: "You failed to..." / "You didn't..." / "You lack..."
4. For students scoring 3/5 or below, include at least one statement that validates their effort: "Writing in a second language is challenging, and your essay shows that you are building important skills."
5. Avoid comparative language ("unlike stronger students...") — feedback should be criterion-referenced, not norm-referenced.
6. Error explanations should be educational, not judgmental:
   - "In English, the verb needs to agree with the subject..."
   - Avoid: "This is a basic grammatical error..."

SCORING: Follow the Evidence-First Scoring Protocol provided separately in the prompt. Do NOT skip the Boundary Verification step.
`;

// ─── Evidence-First Scoring Protocol (Approach 2) ─────────────────────────
// Replaces the SCORING FLOW sections in both CREDIT_HUMANIZATION and
// buildFoundationPrompt. Used by all prompt builders.
const SCORING_PROTOCOL = `
EVIDENCE-FIRST SCORING PROTOCOL (follow strictly in this order):
Step 1 — EVIDENCE GATHERING: For each criterion, identify and QUOTE specific text from the essay that is relevant. Quote at least 2 phrases: one that supports a higher band and one that supports a lower band. Do NOT assign a score yet.
Step 2 — BAND RANGE IDENTIFICATION: Based on the evidence, identify the NARROWEST possible band range (e.g., "between Satisfactory and Good"). State this range explicitly.
Step 3 — BOUNDARY VERIFICATION (CRITICAL — MANDATORY): If the range spans the Satisfactory/Good boundary, you MUST perform the Boundary Verification Check for that criterion. Check each condition — if ANY check for the higher band fails, the score stays at the lower band.
Step 4 — EXCLUSION CHECK: Check the BOUNDARY exclusion statements in the rubric. Does the evidence exclude the student from the higher band? If the exclusion statement says "NOT [higher band] if..." and the student's work matches that condition, the score stays at the lower band.
Step 5 — SCORE ASSIGNMENT: ONLY NOW assign a score. The score must be consistent with the evidence gathered (Step 1), the range identified (Step 2), and the boundary verification (Steps 3-4).
Step 6 — JUSTIFICATION WITH EVIDENCE: Write the justification citing the quoted evidence from Step 1. Explain WHY the score was assigned, referencing specific boundary conditions or exclusion checks that determined the outcome.
Step 7 — ERROR CLASSIFICATION: List up to 3 specific errors per criterion with quoted text. Classify each as expected, non-impeding, or impeding. Do NOT provide corrections.
Step 8 — HOLISTIC CONSISTENCY CHECK: After scoring all criteria, verify: (a) the spread between highest and lowest scores does not exceed 2 points, (b) no criterion score contradicts the evidence, and (c) the boundary verification checks are internally consistent.
`;

// ─── Boundary Verification Check Tables (Approach 2) ──────────────────────
// Mandatory binary checks when score falls on Satisfactory/Good boundary.

const FOUNDATION_BOUNDARY_CHECKS = `
BOUNDARY VERIFICATION CHECKS — Foundation Satisfactory (3.5) → Good (4):
Before assigning Good (4/6), ALL checks for that criterion must pass. If ANY fails → remains 3.5/6.
Task Response: □ ALL specific task requirements addressed (no missing elements) □ No underdeveloped or irrelevant supporting points □ Topic is developed, not just mentioned □ Word count is within or near target
Coherence and Cohesion: □ Reader can follow every idea without re-reading □ Every paragraph has an identifiable main topic □ Cohesive devices are used accurately (not mechanically) □ Ideas progress logically without jumps or repetition
Lexical Resource: □ Vocabulary is noticeably varied (not repetitive) □ Topic-specific vocabulary is used correctly □ Vocabulary errors do NOT affect communication □ Student attempts less common vocabulary with reasonable success
Grammatical Range and Accuracy: □ Sentence structures are varied (simple + compound + complex) □ Core grammatical structures are used accurately □ Grammar errors do NOT affect communication □ Punctuation is effective
`;

const CREDIT_BOUNDARY_CHECKS = `
BOUNDARY VERIFICATION CHECKS — Credit Satisfactory (3-3.5) → Good (4-4.5):
Before assigning Good (4-4.5/5), ALL checks for that criterion must pass. If ANY fails → remains 3-3.5/5.
Task Achievement: □ ALL main ideas present (no missing points) □ Meaning is MOSTLY accurate (not just "generally") □ Details are relevant (no unimportant details taking space) □ Word count is within range
Coherence and Cohesion: □ Text is clear and easy to understand throughout □ No stilted or awkward sections □ Cohesive devices are ALMOST ALWAYS accurate □ Smooth flow between ideas and paragraphs
Lexical Resource: □ Well paraphrased with VERY LITTLE copying □ Good vocabulary range (not repetitive) □ Word choice errors do NOT affect communication □ Spelling is mostly correct
Grammatical Range and Accuracy: □ Good range of structures (not "sometimes limited") □ Grammar errors do NOT affect communication □ Punctuation is well managed
`;

const SUMMARY_BOUNDARY_CHECKS = `
BOUNDARY VERIFICATION CHECKS — Summary Satisfactory (2.5-3) → 3.5 → Good (4-4.5):
Before assigning 3.5 or 4-4.5, ALL checks for that level must pass.
For 3.5: □ ALL main ideas captured (no missing points) □ Paraphrasing is CONSISTENT (not just "some")
For 4-4.5: □ Paraphrasing is EFFECTIVE throughout □ Summary is FOCUSED (no unnecessary details) □ Reads as cohesive independent text
Coherence for 4-4.5: □ Strong progression throughout □ Cohesive devices used naturally and effectively
Lexical for 4-4.5: □ Varied vocabulary □ Natural paraphrasing □ Strong word choice and collocation
Grammar for 4-4.5: □ Strong control including complex sentences □ Errors infrequent □ Sentence variety enhances quality
`;

const SYNTHESIS_BOUNDARY_CHECKS = `
BOUNDARY VERIFICATION CHECKS — Synthesis Satisfactory (3-3.5) → Good (4-4.5):
Same as Credit checks, plus:
Task Achievement synthesis-specific: □ ALL source texts are referenced and integrated (not just listed) □ Ideas are synthesized (not just summarized from each source)
`;

const REPORT_BOUNDARY_CHECKS = `
BOUNDARY VERIFICATION CHECKS — Report Writing Satisfactory (3-3.5) → Good (4-4.5):
Task Response: □ Specific statistics cited (actual numbers/percentages) □ Conclusion includes ALL four elements: (1) most obvious result, (2) reference to previous research, (3) restatement of aim, (4) solutions/recommendations □ Analysis goes beyond surface-level description to interpretation
Coherence: □ Sufficient depth of analysis and interpretation □ Cohesive devices used accurately and appropriately □ Paragraphs exhibit clear organization and unity
Grammar: □ Proficient use of grammar with wide range of sentence structures □ Majority of sentences are error-free □ Punctuation is correct and appropriate
Lexical: □ Wide range of vocabulary with uncommon lexical items □ Vocabulary is precise and appropriate for the genre □ Rare errors in spelling/word formation/capitalization
`;

// ─── Scored Exemplars as Calibration Anchors (Approach 3) ────────────────
// Concrete reference points at the Satisfactory/Good boundary for each rubric type.

const FOUNDATION_EXEMPLARS = `
CALIBRATION EXEMPLARS — Foundation Level (A1-A2):
These are REALISTIC student excerpts at the boundary. Use them as reference points when deciding between Satisfactory (3.5) and Good (4).

Task Response:
  SATISFACTORY (3.5/6): "Technology is important in our life. It help us in many ways like education and communication. People use phones and computers every day. Also technology make life easy."
  → Meets most requirements BUT: thesis is vague ("important in our life"), examples are predictable ("phones and computers"), no depth. KEY TEST: Can you point to a missing/underdeveloped element? YES → remains 3.5.
  GOOD (4/6): "Technology has become essential in modern education, especially after COVID-19. Students now use online platforms like Zoom and Google Classroom to attend lectures and submit assignments. While this increases access to learning, it also creates challenges for students without reliable internet."
  → ALL requirements addressed: specific examples, both benefits and challenges, clear thesis. KEY TEST: Is there ANY missing/underdeveloped element? NO → 4 justified.

Coherence and Cohesion:
  SATISFACTORY (3.5/6): "First, technology help education. Also, people use phones. Also, computers are important. Technology make communication easy. In addition, the internet is good for students."
  → Underlying coherence present BUT: mechanical devices ("Also... Also... In addition"), no logical progression. KEY TEST: Can the reader follow every idea without re-reading? NO → remains 3.5.
  GOOD (4/6): "Technology has transformed education in several ways. In the classroom, digital tools like smartboards allow teachers to present interactive lessons. Outside the classroom, students can access online resources at any time. As a result, learning has become more flexible and accessible."
  → Clear organization: topic sentence → inside → outside → conclusion. Accurate cohesive devices. KEY TEST: ANY unclear paragraph or mechanical device pattern? NO → 4 justified.

Lexical Resource:
  SATISFACTORY (3.5/6): "Technology is very important and useful. It help people in many ways. Education is good with technology. Communication is easy now. Life is better with technology."
  → Core vocabulary adequate BUT: highly repetitive ("technology" 3x, "good/easy/better" only descriptors). KEY TEST: Is vocabulary NOTICEABLY varied? NO → remains 3.5.
  GOOD (4/6): "Technology has revolutionized modern education. Digital tools such as smartboards and tablets have replaced traditional teaching methods. Students can now access a wealth of information online, making research more efficient."
  → Good range: "revolutionized," "digital tools," "traditional teaching methods," "wealth of information," "efficient." KEY TEST: Is vocabulary noticeably repetitive? NO → 4 justified.

Grammatical Range and Accuracy:
  SATISFACTORY (3.5/6): "Technology is important. It help students to learn. People can use computer for study. The internet make information easy to find. Student can learn online now."
  → Simple sentences mostly accurate BUT: repetitive S-V-O, 3rd person singular errors ("help" not "helps"), missing articles. KEY TEST: Is sentence structure noticeably varied? NO → remains 3.5.
  GOOD (4/6): "Although technology has improved access to education, it also presents challenges. Students who rely solely on online resources may lack face-to-face interaction with teachers. However, when used effectively, digital tools can enhance the learning experience."
  → Good range: concessive ("Although"), relative clause ("who rely"), conditional ("when used effectively"). No communication-affecting errors. KEY TEST: Varied structures AND no communication-affecting errors? BOTH YES → 4 justified.
`;

const CREDIT_EXEMPLARS = `
CALIBRATION EXEMPLARS — Credit Level (A2-B1):
Task Achievement:
  SATISFACTORY (3/5): "The article discusses the impact of social media on teenagers. Smith (2023) argues that social media affects mental health. The author also mentions that teenagers spend too much time on phones. I think social media is bad for young people."
  → Most main ideas present BUT: mental health point mentioned not explained, personal opinion added. KEY TEST: Are ALL main ideas present with accurate meaning? NO → remains 3.
  GOOD (4/5): "Smith (2023) argues that social media platforms exploit psychological vulnerabilities in teenagers, leading to increased anxiety and depression. The author supports this claim by citing a study showing that teenagers who spend more than three hours daily on social media are twice as likely to report mental health issues."
  → ALL main ideas present, explained, with supporting evidence. KEY TEST: ANY missing main idea or meaning inaccuracy? NO → 4 justified.

Lexical Resource:
  SATISFACTORY (3/5): "The author says that social media has a bad effect on teenagers. Young people use phones too much and this make them sad and stressed. Also, they cannot focus on their studies because of social media."
  → Generally paraphrased BUT: limited vocabulary ("bad effect," "sad and stressed," "too much"), noticeable repetition. KEY TEST: Good vocabulary range? NO → remains 3.
  GOOD (4/5): "The author contends that social media platforms have a detrimental impact on adolescent well-being. Excessive screen time contributes to elevated levels of anxiety and depression among young users, while simultaneously undermining their academic focus."
  → Well paraphrased: "detrimental impact," "adolescent well-being," "excessive screen time," "elevated levels." KEY TEST: ANY limited/repetitive vocabulary? NO → 4 justified.
`;

const SUMMARY_EXEMPLARS = `
CALIBRATION EXEMPLARS — Summary Writing (A2-B1):
Task Achievement:
  SATISFACTORY (3/5): "The article is about climate change and its effects on coastal cities. The author says that sea levels are rising because of global warming. Coastal cities like Miami and Jakarta are at risk of flooding. The article also discusses some solutions that governments can implement."
  → Captures main ideas BUT: solutions mentioned vaguely, paraphrasing inconsistent ("the article is about," "the author says"). KEY TEST: ALL main ideas with CONSISTENT paraphrasing? NO → remains 2.5-3.
  GOOD (4/5): "Rising sea levels caused by climate change threaten major coastal cities such as Miami and Jakarta with increased flooding. In response, governments are investing in flood defenses and relocating vulnerable populations, though these measures remain insufficient without significant carbon emission reductions."
  → All main ideas captured with effective paraphrasing. Reads as independent text. KEY TEST: ANY copied phrases or unfocused content? NO → 4 justified.
`;

const SYNTHESIS_EXEMPLARS = `
CALIBRATION EXEMPLARS — Synthesis Writing (A2-B1):
Task Achievement:
  SATISFACTORY (3/5): "Technology has both positive and negative effects on education. According to Source 1, online learning helps students access information easily. Source 2 says that technology can be distracting in classrooms. However, it is clear that technology is here to stay."
  → Only 2 of 3 sources referenced. Ideas listed, not synthesized. Conclusion is vague. KEY TEST: Are ALL source texts referenced? NO → remains 3.
  GOOD (4/5): "While digital tools have expanded access to education (Source 1), their impact on classroom focus remains contested. Source 2 highlights increased distraction, yet Source 3 demonstrates that structured technology integration actually improves engagement. This suggests that the issue is not technology itself, but how it is implemented."
  → ALL three sources synthesized into a coherent argument. Ideas integrated, not listed. KEY TEST: ALL source texts referenced? YES → 4 justified.
`;

const REPORT_EXEMPLARS = `
CALIBRATION EXEMPLARS — Report Writing (A2-B1):
Task Response:
  SATISFACTORY (3/5): "The results show that the experimental group performed better than the control group. The data indicates an upward trend in test scores. The conclusion is that the teaching method was effective. This agrees with previous research. The aim of the study was to test the method. Recommendations include improving the method."
  → Main trend identified BUT: statistics are vague ("performed better," "upward trend"), recommendations are generic ("improving the method"). KEY TEST: Adequate specific statistics? NO. Specific recommendations? NO → remains 3.
  GOOD (4/5): "The experimental group (M=78.3, SD=6.2) outperformed the control group (M=65.1, SD=8.4) by an average of 13.2 points, representing a statistically significant difference (p<0.05). This finding is consistent with Al-Rashdi (2022), who reported similar gains with collaborative learning. The study aimed to evaluate the effectiveness of peer tutoring; the results confirm its positive impact. It is recommended that instructors incorporate structured peer tutoring sessions into their lesson plans."
  → Specific statistics, all 4 conclusion elements present, specific recommendation. KEY TEST: ANY missing element or vague statistics? NO → 4 justified.
`;

// ─── Prompt Builders (Lean — no JSON formatting instructions) ────────────────
// Structured Outputs (responseSchema) guarantees valid JSON.
// We only need rubrics + scoring quality instructions.

function buildCriteriaText(rubrics: any): string {
  return rubrics.criteria.map(c => {
    const rubricLevels = Object.entries(c.rubric)
      .map(([score, desc]) => `  Score ${score}: ${desc}`)
      .join('\n');
    return `${c.name} (0-${c.maxScore}):\n${rubricLevels}`;
  }).join('\n\n');
}

function buildLanc2146Prompt(
  studentText: string,
  reportSections: { title: string; content: string }[],
  resultsCaption: string | null,
  resultsGraphDescription: string | null,
  assignmentTitle: string,
  wordCount: number,
  targetWordCount: { min: number; max: number; ideal: number }
): string {
  const rubrics = LANC2146_RUBRICS;
  const tenPercentBelow = Math.round(targetWordCount.min * 0.9);
  const tenPercentAbove = Math.round(targetWordCount.max * 1.1);

  const wordCountStatus = wordCount < tenPercentBelow
    ? `WARNING: Word count is MORE THAN 10% BELOW ${targetWordCount.min}. This MUST lower the Task Response score.`
    : wordCount < targetWordCount.min
    ? `NOTE: Word count is below ${targetWordCount.min}-${targetWordCount.max}. Up to 10% below is acceptable.`
    : wordCount > tenPercentAbove
    ? `NOTE: Word count is MORE THAN 10% ABOVE ${targetWordCount.max}. Do NOT deduct marks. Mention in feedback.`
    : wordCount > targetWordCount.max
    ? `NOTE: Word count exceeds ${targetWordCount.min}-${targetWordCount.max}. Do NOT deduct marks.`
    : `Word count is within ${targetWordCount.min}-${targetWordCount.max}.`;

  const sectionsText = reportSections.map(s => `=== ${s.title} ===\n${s.content}`).join('\n\n');

  return `You are an expert writing assessor for LANC2146 (Report Writing — Discussion & Conclusion) at Sultan Qaboos University. CEFR A2-B1 level.

ASSIGNMENT: ${assignmentTitle}
TARGET WORD COUNT: ${targetWordCount.min}-${targetWordCount.max} (ideal: ${targetWordCount.ideal}). Tolerance: +/-10%.
${wordCountStatus}

PROVIDED REPORT SECTIONS:
${sectionsText}
${resultsCaption ? `\nRESULTS FIGURE CAPTION: ${resultsCaption}${resultsGraphDescription ? `\nNote: The student was expected to read the bar graph showing the results. ${resultsGraphDescription}` : ''}` : ''}

STUDENT'S DISCUSSION AND CONCLUSION:
"""
${studentText}
"""

ASSESSMENT RUBRICS:
${buildCriteriaText(rubrics)}

${CREDIT_HUMANIZATION}
${REPORT_BOUNDARY_CHECKS}
${REPORT_EXEMPLARS}
${SCORING_PROTOCOL}
SCORING INSTRUCTIONS:
1. Score each criterion 0-5 (0.5 increments). Use the FULL range — do NOT default to middle scores.
2. For each criterion: quote at least ONE exact phrase from the student text as evidence in your justification.
3. List up to 3 specific errors per criterion as { "quote": "[exact text]", "explanation": "[why wrong]" }. Do NOT provide corrections.
4. Write 1-2 specific strengths and 1-2 actionable suggestions per criterion.
5. overallFeedback (3-4 sentences): strongest/weakest criterion, Discussion analysis quality, Conclusion adequacy, one prioritized action item.
6. Do NOT calculate totalScore or percentage — those are computed automatically.`;
}

function buildFoundationPrompt(
  text: string,
  topic: string | null,
  wordCount: number,
  targetWordCount: { min: number; max: number; ideal: number; label?: string }
): string {
  const rubrics = FOUNDATION_RUBRICS;
  const toleranceBelow = targetWordCount.min - 10;
  const toleranceAbove = targetWordCount.max + 10;
  const examLabel = targetWordCount.label || 'Foundation Exam';

  const wordCountStatus = wordCount < toleranceBelow
    ? `WARNING: Word count (${wordCount}) is SIGNIFICANTLY BELOW ${targetWordCount.min}-${targetWordCount.max}. This MUST lower the Task Response score.`
    : wordCount < targetWordCount.min
    ? `NOTE: Word count (${wordCount}) is slightly below ${targetWordCount.min}-${targetWordCount.max} (within 10-word tolerance). Do NOT penalize.`
    : wordCount > toleranceAbove
    ? `NOTE: Word count (${wordCount}) significantly exceeds ${targetWordCount.min}-${targetWordCount.max}. Do NOT deduct marks. Mention in feedback.`
    : wordCount > targetWordCount.max
    ? `Word count (${wordCount}) is slightly above ${targetWordCount.min}-${targetWordCount.max} (within tolerance). Do NOT deduct marks.`
    : `Word count (${wordCount}) is within ${targetWordCount.min}-${targetWordCount.max}.`;

  return `You are an expert, encouraging writing assessor for Foundation level students at Sultan Qaboos University. CEFR A1-A2 level.

EXAM TYPE: ${examLabel}
${topic ? `Essay Topic: ${topic}` : 'No specific topic provided.'}

Student Essay:
"""
${text}
"""

TARGET WORD COUNT: ${targetWordCount.min}-${targetWordCount.max} (ideal: ${targetWordCount.ideal}). Tolerance: +/-10 words.
${wordCountStatus}

ASSESSMENT RUBRICS (FP0230 and FP0340):
${buildCriteriaText(rubrics)}

FIRST DRAFT AWARENESS:
These are handwritten exam essays written under timed conditions — they are first drafts with no opportunity for revision, editing, or spell-check.
1. Do NOT penalize for lack of polish, minor inconsistencies, or surface-level errors that would be caught in a second draft.
2. Minor repetition, slight awkwardness in transitions, or occasional inconsistent tense use are NORMAL in first drafts — treat these as expected errors, not signs of poor writing ability.
3. Evaluate what the student ACHIEVED in a single timed sitting, not what an ideal revised version would look like.
4. Never use language like "should have proofread" or "could have been improved with editing" — these are irrelevant in an exam context.

OCR ERROR AWARENESS:
The student text was extracted via OCR from handwritten scripts. Many apparent "spelling errors" may be OCR artifacts (e.g., letter substitution, merged words, split words, character misrecognition). Apply these rules:
1. Do NOT count any apparent spelling error as a student error or lower the Lexical Resource score — the AI cannot reliably distinguish OCR artifacts from genuine student spelling mistakes, so ALL apparent spelling errors must be treated as potential OCR artifacts and forgiven.
2. If meaning is still recoverable despite garbled text, do NOT penalize.
3. Only flag a spelling issue as a genuine student error if the exact same error appears 3+ times in a consistent pattern (e.g., "thier" repeated throughout) — this indicates it is clearly the student's own spelling rather than OCR noise.
4. When uncertain whether an error is OCR or student-originated, always give the student the benefit of the doubt.

BAND CALIBRATION FOR CEFR A1-A2 (what each band looks like at this level):
- 5-6/6 (Excellent): Exceptional for A1-A2. Near-fluent grammar, rich vocabulary, perfect structure. Very rare at this level.
- 4-4.5/6 (Good): Strong for A1-A2. Clear communication with minor expected errors. This is the typical range for strong foundation students.
- 3-3.5/6 (Satisfactory): Average for A1-A2. Meaning is usually clear despite frequent grammar/vocabulary errors. Most foundation students score here.
- 2-2.5/6 (Weak): Below expectations even for A1-A2. Meaning often unclear, very limited vocabulary or severe structural issues.
- 0-1.5/6 (Very Poor): Incomprehensible or completely off-topic. Reserve for genuine failures to communicate.

ERROR CLASSIFICATION (apply per criterion — this is critical):
1. Expected A1/A2 errors (e.g., missing articles, wrong preposition, subject-verb agreement for 3rd person singular, incorrect word order in complex sentences) → Do NOT lower the score. These are normal developmental errors at this level.
   ARABIC L1 TRANSFER ERRORS (also Expected — do NOT lower score):
   The students are Arabic L1 speakers. The following patterns are normal developmental transfer, NOT poor writing:
   - Missing copula "be" (e.g., "She happy" instead of "She is happy") — Arabic has no copula in present tense
   - Omission of indefinite articles (e.g., "I am student") — Arabic has no indefinite article
   - Overuse of definite article (e.g., "the life is hard") — Arabic uses al-definiteness more broadly
   - Subject-verb agreement with 3rd person singular (e.g., "he go") — Arabic verbs don't inflect for person the same way
   - Adjective-noun word order reversal (e.g., "car big" instead of "big car") — Arabic places adjectives after nouns
   - Preposition substitution (e.g., "in Monday" instead of "on Monday") — Arabic preposition usage differs significantly
   - Missing "it/there" expletive subjects (e.g., "Is hot today") — Arabic is pro-drop
   If these errors appear but meaning is still clear, classify them as expected A1/A2 errors. Only flag them if they genuinely impede comprehension.
2. Non-impeding errors (meaning is still clear despite the error; e.g., wrong tense form, spelling that does not obscure meaning) → Only minor score impact if the error is frequent.
3. Impeding errors (reader genuinely cannot understand the intended meaning) → Significant score impact.
Rate each criterion based primarily on COMMUNICATION SUCCESS and IMPEDING errors, not total error count.

ANTI-DOUBLE-PENALIZATION:
1. Each error should be penalized in ONLY ONE criterion — the one where it primarily belongs:
   - Grammar errors (verb tense, subject-verb agreement, word order) → Grammar only
   - Word choice errors (wrong word, wrong form) → Lexical Resource only
   - Structural errors (missing paragraph, no cohesion) → Coherence & Cohesion only
2. If an error has secondary effects on another criterion, do NOT deduct again. For example, a grammar error that makes a sentence slightly awkward does NOT also lower Coherence.
3. The ONLY exception is Task Response, which may be independently affected if content is off-topic, regardless of other criterion scores.

EFFORT REWARD — REWARD ATTEMPTED COMPLEXITY:
1. If a student attempts a complex structure (e.g., subordinate clause, conditional, passive voice) and makes an error, the score should NOT be lower than if the student had written a simpler correct sentence. Reward the attempt.
2. If a student attempts to use a less common vocabulary word but uses it slightly incorrectly (e.g., wrong preposition collocation, wrong word form), this should be classified as a "non-impeding error" at minimum — do NOT penalize more harshly than if the student had used a simpler, correct word.
3. Students who show RANGE (even imperfect) should not score lower than students who show ACCURACY only in a narrow band. Range + some errors ≥ Accuracy in simple structures only.

SCORE FLOOR FOR GENUINE ATTEMPTS:
1. If a student has written at least 50% of the minimum word count AND the text is on-topic (even if error-heavy), each criterion should receive a MINIMUM of 1/6 — because producing any on-topic text demonstrates some level of competence in each criterion.
2. A score of 0/6 should be reserved ONLY for:
   - Complete off-topic writing (for Task Response)
   - Completely incomprehensible text (for other criteria)
   - Blank or near-blank submissions
3. If the student's text is legible, on-topic, and communicates even a basic idea, the minimum for Task Response should be 2/6.

SPECIAL RULES:
1. Deduct marks for Task Response ONLY IF the text is severely off-topic. Do not penalize minor tangents.
2. Reward successful communication of ideas. Do not be overly harsh on minor A1/A2 grammatical/spelling errors if the overall meaning is clear.

BORDERLINE DECISIONS — BENEFIT OF THE DOUBT:
1. When a student's performance sits on the borderline between two bands (e.g., 3 vs 3.5, or 4 vs 4.5), award the HIGHER band if:
   - The student showed effort beyond the minimum (attempted complexity, addressed the topic with some depth)
   - The errors present are primarily "expected" or "non-impeding" per the error classification rules
   - Communication was largely successful despite imperfections
2. Only award the LOWER band if:
   - Errors are predominantly "impeding" (meaning genuinely unclear)
   - The writing shows minimal effort or engagement with the task
   - Performance clearly falls on the lower side of the borderline
3. Default rule: When genuinely uncertain, round UP to the nearest 0.5 increment.

FEEDBACK TONE GUARDRAILS:
1. ALWAYS begin each criterion's feedback with at least one specific strength or successful communication moment before discussing errors.
2. Frame suggestions as "next steps" or "to improve further," never as "you failed to" or "you should have."
3. Use asset-based language:
   - "You successfully expressed..." / "You attempted a complex sentence..."
   - Avoid: "You failed to..." / "You didn't..." / "You lack..."
4. For students scoring 3/6 or below, include at least one statement that validates their effort: "Writing in a second language is challenging, and your essay shows that you are building important skills."
5. Avoid comparative language ("unlike stronger students...") — feedback should be criterion-referenced, not norm-referenced.
6. Error explanations should be educational, not judgmental:
   - "In English, the verb needs to agree with the subject..."
   - Avoid: "This is a basic grammatical error..."

${SCORING_PROTOCOL}
${FOUNDATION_BOUNDARY_CHECKS}
${FOUNDATION_EXEMPLARS}
SCORING INSTRUCTIONS:
1. Score each criterion 0-6 (0.5 increments). Use the FULL range — do NOT default to middle scores.
2. List up to 3 specific errors per criterion as { "quote": "[exact text]", "explanation": "[why wrong]" }. Classify each as expected, non-impeding, or impeding. Do NOT provide corrections.
3. Write 1-2 specific strengths and 1-2 actionable suggestions per criterion.
4. overallFeedback (3-4 sentences): strongest/weakest criterion, what the student communicated well, one prioritized action item.
5. For Task Response: address topic adherence and essay structure. If the word count exceeds the target, mention it but do NOT deduct marks.
6. Do NOT calculate totalScore or percentage — those are computed automatically.`;
}
function buildCreditPrompt(text: string, topic: string | null, wordCount: number): string {
  const rubrics = CREDIT_RUBRICS;

  return `You are an expert writing assessor for Credit level students at Sultan Qaboos University. CEFR A2-B1 level.

${topic ? `Essay Topic: ${topic}` : 'No specific topic provided.'}

Student Essay:
"""
${text}
"""

WORD COUNT: ${wordCount} words

ASSESSMENT RUBRICS (Credit Course — LANC2160):
${buildCriteriaText(rubrics)}

${CREDIT_HUMANIZATION}
${CREDIT_BOUNDARY_CHECKS}
${CREDIT_EXEMPLARS}
${SCORING_PROTOCOL}
SCORING INSTRUCTIONS:
1. Score each criterion 0-5 (0.5 increments). Use the FULL range — do NOT default to middle scores.
2. For each criterion: quote at least ONE exact phrase from the essay as evidence in your justification.
3. List up to 3 specific errors per criterion as { "quote": "[exact text]", "explanation": "[why wrong]" }. Do NOT provide corrections.
4. Write 1-2 specific strengths and 1-2 actionable suggestions per criterion.
5. overallFeedback (3-4 sentences): strongest/weakest criterion, one prioritized action item.
6. Do NOT calculate totalScore or percentage — those are computed automatically.`;
}

function buildSummaryPrompt(
  studentText: string,
  sourceText: string,
  sourceTitle: string,
  wordCount: number,
  targetWordCount: { min: number; max: number; ideal: number }
): string {
  const rubrics = SUMMARY_RUBRICS;
  const sourceWordCount = sourceText.trim().split(/\s+/).filter(Boolean).length;
  const tenPercentBelow = Math.round(targetWordCount.min * 0.9);
  const tenPercentAbove = Math.round(targetWordCount.max * 1.1);

  const wordCountStatus = wordCount < 20
    ? `WARNING: Word count (${wordCount}) is BELOW 20 words. This MUST significantly lower the Task Achievement score.`
    : wordCount < tenPercentBelow
    ? `WARNING: Word count is MORE THAN 10% BELOW ${targetWordCount.min}. This MUST lower the Task Achievement score.`
    : wordCount < targetWordCount.min
    ? `NOTE: Word count is below ${targetWordCount.min}-${targetWordCount.max}. Up to 10% below is acceptable.`
    : wordCount > tenPercentAbove
    ? `NOTE: Word count is MORE THAN 10% ABOVE ${targetWordCount.max}. Do NOT deduct marks. Mention in feedback.`
    : wordCount > targetWordCount.max
    ? `NOTE: Word count exceeds ${targetWordCount.min}-${targetWordCount.max}. Do NOT deduct marks.`
    : `Word count is within ${targetWordCount.min}-${targetWordCount.max}.`;

  return `You are an expert writing assessor for LANC2160 (Summary Writing) at Sultan Qaboos University. CEFR A2-B1 level.

SOURCE TEXT:
Title: "${sourceTitle}"
"""
${sourceText}
"""

STUDENT'S SUMMARY:
"""
${studentText}
"""

${wordCountStatus}
Target summary length: ${targetWordCount.min}-${targetWordCount.max} (approximately one-third of the ${sourceWordCount}-word source text). Tolerance: +/-10%.

SUMMARY RUBRICS:
${buildCriteriaText(rubrics)}

SUMMARY RULES:
1. Capture MAIN IDEAS only. No personal opinions or new information.
2. Student must use OWN WORDS (paraphrasing). Copied phrases lower TA and LR scores.
3. Off-topic summary = Task Achievement 0. Large-scale copying = low TA and LR.

${CREDIT_HUMANIZATION}
${SUMMARY_BOUNDARY_CHECKS}
${SUMMARY_EXEMPLARS}
${SCORING_PROTOCOL}
SCORING INSTRUCTIONS:
1. Score each criterion 0-5 (0.5 increments). Use the FULL range — do NOT default to middle scores.
2. For each criterion: quote at least ONE exact phrase from the summary as evidence.
3. List up to 3 specific errors per criterion as { "quote": "[exact text]", "explanation": "[why wrong]" }. Do NOT provide corrections.
4. Write 1-2 specific strengths and 1-2 actionable suggestions per criterion.
5. overallFeedback (3-4 sentences): which main ideas were captured/missed, strongest/weakest criterion, paraphrasing quality, one prioritized action item.
6. Do NOT calculate totalScore or percentage — those are computed automatically.`;
}

function buildLanc1070Prompt(
  studentText: string,
  sourceContent: string,
  sourceTitle: string,
  assignmentTitle: string,
  assignmentDescription: string,
  wordCount: number,
  targetWordCount: { min: number; max: number; ideal: number }
): string {
  const rubrics = SYNTHESIS_RUBRICS;
  const tenPercentBelow = Math.round(targetWordCount.min * 0.9);
  const tenPercentAbove = Math.round(targetWordCount.max * 1.1);

  const wordCountStatus = wordCount < tenPercentBelow
    ? `WARNING: Word count is MORE THAN 10% BELOW ${targetWordCount.min}. This MUST lower the Task Achievement score.`
    : wordCount < targetWordCount.min
    ? `NOTE: Word count is below ${targetWordCount.min}-${targetWordCount.max}. Up to 10% below is acceptable.`
    : wordCount > tenPercentAbove
    ? `NOTE: Word count is MORE THAN 10% ABOVE ${targetWordCount.max}. Do NOT deduct marks. Mention in feedback.`
    : wordCount > targetWordCount.max
    ? `NOTE: Word count exceeds ${targetWordCount.min}-${targetWordCount.max}. Do NOT deduct marks.`
    : `Word count is within ${targetWordCount.min}-${targetWordCount.max}.`;

  return `You are an expert writing assessor for LANC1070 (Synthesis Essay) at Sultan Qaboos University. CEFR A2-B1 level.

ASSIGNMENT: ${assignmentTitle}
WRITING TASK: ${assignmentDescription}
TARGET WORD COUNT: ${targetWordCount.min}-${targetWordCount.max} (ideal: ${targetWordCount.ideal}). Tolerance: +/-10%.
${wordCountStatus}

SOURCE TEXT:
Title: "${sourceTitle}"
"""
${sourceContent}
"""

STUDENT'S ESSAY:
"""
${studentText}
"""

SYNTHESIS RUBRICS:
${buildCriteriaText(rubrics)}

${CREDIT_HUMANIZATION}
${SYNTHESIS_BOUNDARY_CHECKS}
${SYNTHESIS_EXEMPLARS}
${SCORING_PROTOCOL}
SCORING INSTRUCTIONS:
1. Score each criterion 0-5 (0.5 increments). Use the FULL range — do NOT default to middle scores.
2. For each criterion: quote at least ONE exact phrase from the essay as evidence.
3. List up to 3 specific errors per criterion as { "quote": "[exact text]", "explanation": "[why wrong]" }. Do NOT provide corrections.
4. Write 1-2 specific strengths and 1-2 actionable suggestions per criterion.
5. overallFeedback (3-4 sentences): strongest/weakest criterion, discussion points addressed, paraphrasing quality, one prioritized action item.
6. Do NOT calculate totalScore or percentage — those are computed automatically.`;
}

function buildLanc2070Prompt(
  studentText: string,
  mainArticle: { title: string; author: string; year: number; content: string },
  excerpts: { author: string; year: number; title: string; content: string }[],
  assignmentTitle: string,
  writingPrompt: string,
  wordCount: number,
  targetWordCount: { min: number; max: number; ideal: number }
): string {
  const rubrics = CREDIT_RUBRICS; // Article review uses credit-level criteria
  const tenPercentBelow = Math.round(targetWordCount.min * 0.9);
  const tenPercentAbove = Math.round(targetWordCount.max * 1.1);

  const wordCountStatus = wordCount < tenPercentBelow
    ? `WARNING: Word count is MORE THAN 10% BELOW ${targetWordCount.min}. This MUST lower the Task Achievement score.`
    : wordCount < targetWordCount.min
    ? `NOTE: Word count is below ${targetWordCount.min}-${targetWordCount.max}. Up to 10% below is acceptable.`
    : wordCount > tenPercentAbove
    ? `NOTE: Word count is MORE THAN 10% ABOVE ${targetWordCount.max}. Do NOT deduct marks. Mention in feedback.`
    : wordCount > targetWordCount.max
    ? `NOTE: Word count exceeds ${targetWordCount.min}-${targetWordCount.max}. Do NOT deduct marks.`
    : `Word count is within ${targetWordCount.min}-${targetWordCount.max}.`;

  const excerptsText = excerpts.map((e, i) =>
    `Excerpt ${i + 1}: "${e.title}" by ${e.author} (${e.year})\n"""\n${e.content}\n"""`
  ).join('\n\n');

  return `You are an expert writing assessor for LANC2070 (Article Review) at Sultan Qaboos University. CEFR A2-B1 level.

ASSIGNMENT: ${assignmentTitle}
WRITING TASK: ${writingPrompt}
TARGET WORD COUNT: ${targetWordCount.min}-${targetWordCount.max} (ideal: ${targetWordCount.ideal}). Tolerance: +/-10%.
${wordCountStatus}

MAIN ARTICLE:
Title: "${mainArticle.title}" by ${mainArticle.author} (${mainArticle.year})
"""
${mainArticle.content}
"""

SUPPORTING EXCERPTS:
${excerptsText}

STUDENT'S ARTICLE REVIEW:
"""
${studentText}
"""

ARTICLE REVIEW RUBRICS:
${buildCriteriaText(rubrics)}

${CREDIT_HUMANIZATION}
${CREDIT_BOUNDARY_CHECKS}
${CREDIT_EXEMPLARS}
${SCORING_PROTOCOL}
SCORING INSTRUCTIONS:
1. Score each criterion 0-5 (0.5 increments). Use the FULL range — do NOT default to middle scores.
2. For Task Achievement: Evaluate whether the student critically analyses the article (not just summarizes), reviews at least 2 points from the author, uses at least 2 excerpts with proper in-text APA citations, and paraphrases effectively (no chunks of 3+ copied words).
3. For each criterion: quote at least ONE exact phrase from the student's review as evidence.
4. List up to 3 specific errors per criterion as { "quote": "[exact text]", "explanation": "[why wrong]" }. Do NOT provide corrections.
5. Write 1-2 specific strengths and 1-2 actionable suggestions per criterion.
6. overallFeedback (3-4 sentences): strongest/weakest criterion, quality of critical analysis vs summary, paraphrasing quality, one prioritized action item.
7. Do NOT calculate totalScore or percentage — those are computed automatically.`;
}

function buildSynthesisPrompt(
  studentText: string,
  sources: { title: string; content: string }[],
  assignmentTitle: string,
  assignmentDescription: string,
  wordCount: number,
  targetWordCount: { min: number; max: number; ideal: number }
): string {
  const rubrics = SYNTHESIS_RUBRICS;
  const tenPercentBelow = Math.round(targetWordCount.min * 0.9);
  const tenPercentAbove = Math.round(targetWordCount.max * 1.1);

  const wordCountStatus = wordCount < tenPercentBelow
    ? `WARNING: Word count is MORE THAN 10% BELOW ${targetWordCount.min}. This MUST lower the Task Achievement score.`
    : wordCount < targetWordCount.min
    ? `NOTE: Word count is below ${targetWordCount.min}-${targetWordCount.max}. Up to 10% below is acceptable.`
    : wordCount > tenPercentAbove
    ? `NOTE: Word count is MORE THAN 10% ABOVE ${targetWordCount.max}. Do NOT deduct marks. Mention in feedback.`
    : wordCount > targetWordCount.max
    ? `NOTE: Word count exceeds ${targetWordCount.min}-${targetWordCount.max}. Do NOT deduct marks.`
    : `Word count is within ${targetWordCount.min}-${targetWordCount.max}.`;

  const sourceTextsBlock = sources.map((s, i) => {
    const wc = s.content.trim().split(/\s+/).filter(Boolean).length;
    return `SOURCE TEXT ${i + 1}: "${s.title}" (${wc} words)\n"""\n${s.content}\n"""`;
  }).join('\n\n');

  return `You are an expert writing assessor for LANC2160 (Synthesis Essay) at Sultan Qaboos University. CEFR A2-B1 level.

TASK: The student read ALL THREE source texts and wrote a 4-paragraph synthesis essay (${targetWordCount.min}-${targetWordCount.max} words).
ASSIGNMENT: ${assignmentTitle}
INSTRUCTIONS: ${assignmentDescription}

${sourceTextsBlock}

STUDENT'S SYNTHESIS ESSAY:
"""
${studentText}
"""

${wordCountStatus}

SYNTHESIS RUBRICS (LANC2160 — Two-Point Essay Writing Marking Criteria):
${buildCriteriaText(rubrics)}

SYNTHESIS RULES:
1. Synthesize ALL THREE source texts. Address "${assignmentTitle}".
2. Use OWN WORDS (paraphrasing). Copied phrases/sentences lower TA and LR.
3. Structure: exactly 4 paragraphs (intro, body 1, body 2, conclusion). Note deviations in C&C.
4. No personal opinions or new information. Off-topic = TA 0.
5. Do NOT deduct marks if word count exceeds target. If 10%+ BELOW, lower TA per rubric.

${CREDIT_HUMANIZATION}
${SYNTHESIS_BOUNDARY_CHECKS}
${SYNTHESIS_EXEMPLARS}
${SCORING_PROTOCOL}
SCORING INSTRUCTIONS:
1. Score each criterion 0-5 (0.5 increments). Use the FULL range — do NOT default to middle scores.
2. For each criterion: quote at least ONE exact phrase from the essay as evidence.
3. List up to 3 specific errors per criterion as { "quote": "[exact text]", "explanation": "[why wrong]" }. Do NOT provide corrections.
4. Write 1-2 specific strengths and 1-2 actionable suggestions per criterion.
5. overallFeedback (3-4 sentences): which sources were used (all 3?), strongest/weakest criterion, paraphrasing/copied text %, one prioritized action item.
6. Do NOT calculate totalScore or percentage — those are computed automatically.`;
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

// Model tier groups — gemini-2.5-flash-lite removed due to known structured-output
// and instruction-following inconsistencies (see discuss.ai.google.dev #102367, #101331).
// Foundation essays are harder to evaluate (more OCR noise, L1 transfer, borderline cases),
// so they get the stronger pro fallback. Credit writing is more structured, flash suffices.
// Vertex AI uses a single model with deterministic decoding + multi-call consensus.
// Fallback to pro if flash is unavailable in the chosen region.
const FOUNDATION_TIERS = ['gemini-2.5-flash', 'gemini-2.5-pro'];
const CREDIT_TIERS = ['gemini-2.5-flash', 'gemini-2.5-pro'];

// Number of parallel consensus calls for deterministic scoring
const CONSENSUS_CALLS = 3;
// Fixed seed for best-effort determinism across calls
const FIXED_SEED = 42;

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

const RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_DELAYS = [5000, 15000, 30000];

/**
 * Strip markdown residue from Gemini-returned strings.
 * Coerces non-string values (arrays, objects) to strings to prevent
 * "e.replace is not a function" runtime errors.
 */
function clean(val: any): string {
  if (val == null) return '';
  let str: string;
  if (typeof val === 'string') {
    str = val;
  } else if (Array.isArray(val)) {
    str = val.map((item: any) => (typeof item === 'string' ? item : JSON.stringify(item))).join(' ');
  } else {
    str = JSON.stringify(val);
  }
  return str
    .replace(/\*\*/g, '')
    .replace(/\*(?!\*)/g, '')
    .replace(/^#+\s+/gm, '')
    .replace(/^---+$/gm, '')
    .trim();
}

/**
 * Build a clean, professional feedback string from structured fields.
 * These headers are required by parseFeedback() in scoring-utils.ts
 * to reliably identify each section.
 */
function buildFeedback(s: any): string {
  const parts: string[] = [];

  if (s.justification) parts.push(`Justification: ${s.justification}`);
  if (s.strengths) parts.push(`Strengths: ${s.strengths}`);
  if (Array.isArray(s.mistakes) && s.mistakes.length > 0) {
    const lines = s.mistakes
      .map((m: any) => m.quote ? `- "${m.quote}": ${m.explanation}` : `- ${m.explanation}`)
      .join('\n');
    parts.push(`Mistakes found:\n${lines}`);
  }
  if (s.suggestions) parts.push(`Suggestions: ${s.suggestions}`);

  return parts.length > 0 ? parts.join('\n\n') : 'No feedback provided.';
}

// ─── POST Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request: expected JSON body.', details: 'The request body could not be parsed as JSON.' },
        { status: 400 }
      );
    }
    const { text, courseCode, topic, examType, writingType, sourceTextId } = body;

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: 'No text provided for assessment', details: 'The text field is empty or missing from the request.' },
        { status: 400 }
      );
    }

    // ── Initialize Gemini API (Agent Platform / Vertex AI / AI Studio) ────────
    // Authentication modes, checked in priority order:
    //
    // 1. VERTEX AI (ADC): VERTEX_API_KEY not set, but GOOGLE_CLOUD_PROJECT is.
    //    SDK uses ADC automatically. On Vercel, set GOOGLE_APPLICATION_CREDENTIALS_JSON.
    //    Provides: region selection, seed/topK/topP determinism, Section 18 privacy.
    //
    // 2. VERTEX AI EXPRESS: VERTEX_API_KEY is set (with or without project).
    //    SDK uses the API key against the Vertex AI global endpoint.
    //    Provides: Section 18 privacy. No region selection, limited determinism.
    //    NOTE: The @google/genai SDK treats project/location and apiKey as MUTUALLY
    //    EXCLUSIVE for Vertex AI. When apiKey is set, project/location are cleared.
    //
    // 3. AI STUDIO (legacy): Only GEMINI_API_KEY is set.
    //    Free Gemini API — no privacy guarantee, no determinism controls.
    //
    // The SDK also reads GOOGLE_GENAI_USE_ENTERPRISE / GOOGLE_GENAI_USE_VERTEXAI
    // env vars to auto-enable enterprise mode, but explicit constructor params
    // always take precedence.
    //
    const vertexApiKey = process.env.VERTEX_API_KEY;
    const legacyApiKey = process.env.GEMINI_API_KEY;
    const vertexProject = process.env.GOOGLE_CLOUD_PROJECT;
    const vertexLocation = process.env.GOOGLE_CLOUD_LOCATION || 'me-central1';

    // Mode detection: API key for Vertex Express takes priority if set
    const useVertexExpress = !!vertexApiKey;
    const useVertexAI = !useVertexExpress && !!vertexProject;
    const useAIStudio = !useVertexExpress && !useVertexAI && !!legacyApiKey;

    if (!useVertexAI && !useVertexExpress && !useAIStudio) {
      return NextResponse.json(
        { error: 'Server configuration error: Set VERTEX_API_KEY for Vertex AI Express, or GOOGLE_CLOUD_PROJECT for Vertex AI with ADC, or GEMINI_API_KEY for AI Studio.', details: 'No API credentials configured.' },
        { status: 500 }
      );
    }

    // For Vercel: if GOOGLE_APPLICATION_CREDENTIALS_JSON is set, write it to a
    // temp file and point GOOGLE_APPLICATION_CREDENTIALS to it so ADC picks it up.
    if (useVertexAI && process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');
      const tmpPath = path.join(os.tmpdir(), `gcp-sa-${vertexProject}.json`);
      fs.writeFileSync(tmpPath, process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON, 'utf-8');
      process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpPath;
      console.log(`ADC: wrote service account JSON to ${tmpPath}`);
    }

    let ai: any;
    if (useVertexExpress) {
      // Vertex AI Express Mode: apiKey ONLY — project/location are NOT passed
      // because the SDK treats them as mutually exclusive for Vertex AI.
      // The SDK routes to the global Vertex AI endpoint automatically.
      ai = new GoogleGenAI({
        vertexai: true,
        apiKey: vertexApiKey,
      });
      console.log('Vertex AI (Express) initialized: using API key, global endpoint');
    } else if (useVertexAI) {
      // Full Vertex AI with ADC: project + location, NO apiKey
      ai = new GoogleGenAI({
        vertexai: true,
        project: vertexProject,
        location: vertexLocation,
      });
      console.log(`Vertex AI (ADC) initialized: project=${vertexProject}, location=${vertexLocation}`);
    } else {
      // AI Studio (legacy): apiKey only, no vertexai flag
      ai = new GoogleGenAI({ apiKey: legacyApiKey });
      console.log('AI Studio mode (legacy): using GEMINI_API_KEY');
    }

    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

    const isFoundation = ['0230', '0340'].includes(courseCode);
    const isSummaryWriting = courseCode === 'LANC2160' && writingType === 'summary';
    const isSynthesisWriting = courseCode === 'LANC2160' && writingType === 'synthesis';
    const isLanc1070 = courseCode === 'LANC1070';
    const isLanc2146 = courseCode === 'LANC2146';
    const isLanc2070 = courseCode === 'LANC2070';

    if (courseCode === 'LANC2160' && !writingType) {
      return NextResponse.json(
        { error: 'Writing type is required for LANC2160. Please select either "Summary" or "Synthesis" before assessing.', details: 'Missing writingType parameter for LANC2160' },
        { status: 400 }
      );
    }

    if ((isLanc1070 || isLanc2146 || isLanc2070 || isSummaryWriting || isSynthesisWriting) && !sourceTextId) {
      return NextResponse.json(
        { error: 'A source text or assignment must be selected before assessment. Please go back and select one.', details: `Missing sourceTextId for course ${courseCode}` },
        { status: 400 }
      );
    }

    let activeTargetWordCount: { min: number; max: number; ideal: number; label?: string } | null = null;
    let prompt: string;
    let criteria: any[];

    if (isFoundation) {
      const courseWordCounts = FOUNDATION_WORD_COUNTS[courseCode];
      const courseDefault = DEFAULT_FOUNDATION_WORD_COUNTS[courseCode];
      if (examType && courseWordCounts && courseWordCounts[examType]) {
        activeTargetWordCount = courseWordCounts[examType];
      } else if (courseDefault) {
        activeTargetWordCount = { ...courseDefault };
      } else {
        activeTargetWordCount = { min: 110, max: 130, ideal: 120, label: 'Foundation Exam' };
      }
      prompt = buildFoundationPrompt(text, topic, wordCount, activeTargetWordCount);
      criteria = FOUNDATION_RUBRICS.criteria;
    } else if (isSummaryWriting) {
      const { SUMMARY_SOURCE_TEXTS } = await import('@/lib/store');
      const sourceTextData = SUMMARY_SOURCE_TEXTS.find(s => s.id === sourceTextId);
      if (!sourceTextData) {
        return NextResponse.json(
          { error: 'Source text not found. Please select a valid source text for summary writing.', details: `No source text found for sourceTextId: ${sourceTextId}` },
          { status: 400 }
        );
      }
      activeTargetWordCount = { min: sourceTextData.targetMin, max: sourceTextData.targetMax, ideal: sourceTextData.targetIdeal, label: `Summary of "${sourceTextData.title}"` };
      prompt = buildSummaryPrompt(text, sourceTextData.originalText, sourceTextData.title, wordCount, activeTargetWordCount);
      criteria = SUMMARY_CRITERIA;
    } else if (isSynthesisWriting) {
      const { SYNTHESIS_ASSIGNMENTS } = await import('@/lib/store');
      const assignmentData = SYNTHESIS_ASSIGNMENTS.find(a => a.id === sourceTextId);
      if (!assignmentData) {
        return NextResponse.json(
          { error: 'Synthesis assignment not found. Please select a valid assignment.', details: `No synthesis assignment found for sourceTextId: ${sourceTextId}` },
          { status: 400 }
        );
      }
      activeTargetWordCount = { min: assignmentData.targetWordCount.min, max: assignmentData.targetWordCount.max, ideal: assignmentData.targetWordCount.ideal, label: `Synthesis: "${assignmentData.title}"` };
      prompt = buildSynthesisPrompt(text, assignmentData.sources.map(s => ({ title: s.title, content: s.content })), assignmentData.title, assignmentData.description, wordCount, activeTargetWordCount);
      criteria = SYNTHESIS_CRITERIA;
    } else if (isLanc2146) {
      const { LANC2146_PRACTICE_TESTS } = await import('@/lib/store');
      const practiceData = LANC2146_PRACTICE_TESTS.find(t => t.id === sourceTextId);
      if (!practiceData) {
        return NextResponse.json(
          { error: 'Report writing assignment not found. Please select a valid practice test.', details: `No LANC2146 practice test found for sourceTextId: ${sourceTextId}` },
          { status: 400 }
        );
      }
      activeTargetWordCount = { min: practiceData.targetWordCount.min, max: practiceData.targetWordCount.max, ideal: practiceData.targetWordCount.ideal, label: `Report: "${practiceData.title}"` };
      prompt = buildLanc2146Prompt(text, practiceData.reportSections.map(s => ({ title: s.title, content: s.content })), practiceData.resultsFigure?.caption || null, practiceData.resultsFigure?.graphDescription || null, practiceData.title, wordCount, activeTargetWordCount);
      criteria = LANC2146_CRITERIA;
    } else if (isLanc2070) {
      const { LANC2070_PRACTICE_TESTS } = await import('@/lib/store');
      const practiceData = LANC2070_PRACTICE_TESTS.find(t => t.id === sourceTextId);
      if (!practiceData) {
        return NextResponse.json(
          { error: 'Article review assignment not found. Please select a valid practice test.', details: `No LANC2070 practice test found for sourceTextId: ${sourceTextId}` },
          { status: 400 }
        );
      }
      activeTargetWordCount = { min: practiceData.targetWordCount.min, max: practiceData.targetWordCount.max, ideal: practiceData.targetWordCount.ideal, label: `Article Review: "${practiceData.title}"` };
      prompt = buildLanc2070Prompt(text, practiceData.mainArticle, practiceData.excerpts, practiceData.title, practiceData.writingPrompt, wordCount, activeTargetWordCount);
      criteria = CREDIT_CRITERIA;
    } else if (isLanc1070) {
      const { LANC1070_PRACTICE_TESTS } = await import('@/lib/store');
      const practiceData = LANC1070_PRACTICE_TESTS.find(t => t.id === sourceTextId);
      if (!practiceData) {
        return NextResponse.json(
          { error: 'LANC1070 practice test not found. Please select a valid practice test.', details: `No LANC1070 practice test found for sourceTextId: ${sourceTextId}` },
          { status: 400 }
        );
      }
      activeTargetWordCount = { min: practiceData.targetWordCount.min, max: practiceData.targetWordCount.max, ideal: practiceData.targetWordCount.ideal, label: `LANC1070: "${practiceData.title}"` };
      prompt = buildLanc1070Prompt(text, practiceData.sourceText.content, practiceData.sourceText.title, practiceData.title, practiceData.description, wordCount, activeTargetWordCount);
      criteria = SYNTHESIS_CRITERIA;
    } else {
      activeTargetWordCount = null;
      prompt = buildCreditPrompt(text, topic, wordCount);
      criteria = CREDIT_CRITERIA;
    }

    // ── Initialize Gemini: select schema & model tiers by course type ──────
    const currentSchema = isFoundation ? FOUNDATION_SCHEMA : CREDIT_SCHEMA;
    const targetModelTiers = isFoundation ? FOUNDATION_TIERS : CREDIT_TIERS;

    const systemInstruction = isSummaryWriting
      ? 'You are an expert writing assessment AI for LANC2160 (Summary Writing) at Sultan Qaboos University. CEFR A2-B1 level. Quote exact words from the student summary as evidence. Justify every score against the rubric. List specific errors with quoted text.'
      : isSynthesisWriting
      ? 'You are an expert writing assessment AI for LANC2160 (Synthesis Essay) at Sultan Qaboos University. CEFR A2-B1 level. Compare the essay against ALL THREE source texts. Quote exact words as evidence. Justify every score against the rubric. List specific errors with quoted text.'
      : isLanc1070
      ? 'You are an expert writing assessment AI for LANC1070 (Synthesis Essay) at Sultan Qaboos University. CEFR A2-B1 level. Compare the essay against the provided source text. Quote exact words as evidence. Justify every score against the rubric. List specific errors with quoted text.'
      : isLanc2070
      ? 'You are an expert writing assessment AI for LANC2070 (Article Review) at Sultan Qaboos University. CEFR A2-B1 level. Evaluate critical analysis vs summary, paraphrasing quality, and APA citation usage. Quote exact words as evidence. Justify every score against the rubric. List specific errors with quoted text.'
      : isLanc2146
      ? 'You are an expert writing assessment AI for LANC2146 (Report Writing) at Sultan Qaboos University. CEFR A2-B1 level. Evaluate Discussion (analysis/interpretation) and Conclusion (summary, recommendations). Quote exact words as evidence. Justify every score against the rubric. List specific errors with quoted text.'
      : isFoundation
      ? 'You are an expert, encouraging writing assessor for Foundation courses (FP0230, FP0340) at Sultan Qaboos University. CEFR A1-A2 level. Score relative to A1-A2 expectations — reward successful communication and only penalize impeding errors. Quote exact words as evidence for EVERY score.'
      : 'You are an expert writing assessment AI at Sultan Qaboos University. CEFR A2-B1 level. Quote exact words from the student essay as evidence. Justify every score against the rubric. List specific errors with quoted text.';

    // ── Single model call with retry + rate-limit handling ───────────────────
    async function callModel(modelName: string): Promise<any> {
      for (let rateLimitAttempt = 0; rateLimitAttempt < RATE_LIMIT_RETRIES; rateLimitAttempt++) {
        try {
          const result = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction,
              temperature: 0,
              topP: (useVertexAI || useVertexExpress) ? 0 : 1,     // topP=0 on Vertex AI (deterministic)
              topK: (useVertexAI || useVertexExpress) ? 1 : undefined, // topK=1 on Vertex AI (greedy)
              seed: (useVertexAI || useVertexExpress) ? FIXED_SEED : undefined, // seed on Vertex AI
              maxOutputTokens: 8192,
              responseMimeType: 'application/json',
              responseSchema: currentSchema,
              thinkingConfig: { thinkingBudget: 0 },
              safetySettings,
            },
          });

          // ── Check for blocking ──
          const promptFeedback = (result as any)?.promptFeedback;
          if (promptFeedback?.blockReason) {
            throw new Error(`PROMPT_BLOCKED:${promptFeedback.blockReason}`);
          }

          const candidate = (result as any)?.candidates?.[0];
          const finishReason = candidate?.finishReason;

          if (finishReason === 'SAFETY' || finishReason === 'RECITATION' || finishReason === 'LANGUAGE') {
            throw new Error(`RESPONSE_BLOCKED:${finishReason}`);
          }

          // ── Extract text (filter out thought parts) ──
          let rawText = '';
          if (candidate?.content?.parts) {
            for (const part of candidate.content.parts) {
              if (part.text && !part.thought) rawText += part.text;
            }
          }
          if (!rawText) rawText = result.text || '';

          if (!rawText || rawText.trim().length === 0) {
            throw new Error('AI returned an empty response.');
          }

          // Force clean markdown fences if Gemini stubbornly included them
          const cleanJsonText = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

          // ── Structured Output guarantees valid JSON — direct parse ──
          const assessment = JSON.parse(cleanJsonText);

          if (!assessment?.scores || !Array.isArray(assessment.scores)) {
            throw new Error('Response parsed but missing scores array.');
          }

          return assessment;
        } catch (genError: any) {
          const errMsg = genError?.message || String(genError);

          // Re-throw blocking errors immediately (not retryable)
          if (errMsg.startsWith('PROMPT_BLOCKED:')) {
            throw new Error(`AI content filter blocked the submission. Please try rephrasing your essay. (${errMsg})`);
          }
          if (errMsg.startsWith('RESPONSE_BLOCKED:')) {
            throw new Error(`AI content filter blocked the assessment response. Please try rephrasing. (${errMsg})`);
          }

          const isRateLimit = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota') || (errMsg.includes('rate') && errMsg.includes('limit'));

          if (isRateLimit && rateLimitAttempt < RATE_LIMIT_RETRIES - 1) {
            const delay = RATE_LIMIT_DELAYS[rateLimitAttempt];
            console.warn(`Rate limit hit on ${modelName}, retrying in ${delay / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          throw genError; // Re-throw for outer catch / fallback
        }
      }
      throw new Error('All rate-limit retries exhausted');
    }

    // ── Generate with Multi-Call Consensus (Vertex AI) or Single-Call (AI Studio) ──
    let assessment: any = null;
    let parsedOk = false;
    let usedModelName = '';
    let consensusConfidence: 'high' | 'medium' | 'low' | null = null;

    modelTierLoop: for (let modelTierIndex = 0; modelTierIndex < targetModelTiers.length; modelTierIndex++) {
      const modelName = targetModelTiers[modelTierIndex];

      try {
        if ((useVertexAI || useVertexExpress) && CONSENSUS_CALLS > 1) {
          // ── Multi-Call Consensus (Vertex AI) ──────────────────────────────
          // Launch CONSENSUS_CALLS parallel requests with identical parameters.
          // Take the median score per criterion and select the response closest
          // to the consensus for feedback text.
          console.log(`Launching ${CONSENSUS_CALLS} consensus calls with ${modelName}...`);
          const consensusResults = await Promise.allSettled(
            Array.from({ length: CONSENSUS_CALLS }, () => callModel(modelName))
          );

          const successful = consensusResults
            .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
            .map(r => r.value);

          if (successful.length === 0) {
            console.warn(`All ${CONSENSUS_CALLS} consensus calls failed for ${modelName}. Falling back...`);
            continue modelTierLoop;
          }

          if (successful.length === 1) {
            // Only 1 of 3 succeeded — low confidence
            assessment = successful[0];
            consensusConfidence = 'low';
            usedModelName = modelName;
            parsedOk = true;
            console.log(`Consensus: 1/${CONSENSUS_CALLS} succeeded (low confidence)`);
            break modelTierLoop;
          }

          // ── Median scoring per criterion ──
          const criteriaCount = successful[0].scores.length;
          // Pick the response whose total score is closest to the median total
          const totals = successful.map(r =>
            r.scores.reduce((sum: number, s: any) => sum + Number(s.score || 0), 0)
          );
          const sortedTotals = [...totals].sort((a, b) => a - b);
          const medianTotal = sortedTotals[Math.floor(sortedTotals.length / 2)];
          const bestIdx = totals.reduce((best, total, idx) =>
            Math.abs(total - medianTotal) < Math.abs(totals[best] - medianTotal) ? idx : best
          , 0);

          assessment = successful[bestIdx];
          usedModelName = modelName;

          // ── Confidence rating based on score spread ──
          let maxSpread = 0;
          for (let i = 0; i < criteriaCount; i++) {
            const scores = successful.map(r => Number(r.scores[i]?.score || 0));
            const spread = Math.max(...scores) - Math.min(...scores);
            maxSpread = Math.max(maxSpread, spread);
          }
          consensusConfidence = maxSpread <= 0.5 ? 'high' : maxSpread <= 1.5 ? 'medium' : 'low';
          parsedOk = true;

          console.log(`Consensus: ${successful.length}/${CONSENSUS_CALLS} succeeded, confidence=${consensusConfidence}, spread=${maxSpread}`);

        } else {
          // ── Single call (AI Studio / legacy fallback) ─────────────────────
          assessment = await callModel(modelName);
          usedModelName = modelName;
          consensusConfidence = null;
          parsedOk = true;
          console.log(`Assessment successful using model: ${modelName} (single call)`);
        }

        break modelTierLoop;

      } catch (genError: any) {
        const errMsg = genError?.message || String(genError);
        console.warn(`${modelName} failed (${errMsg}). Falling back to next model...`);
        continue modelTierLoop;
      }
    }

    if (!parsedOk || !assessment?.scores) {
      return NextResponse.json(
        { error: 'Failed to get a valid assessment from the AI. Please try again.', details: 'All model tiers failed to return a valid response.' },
        { status: 500 }
      );
    }

    // ── Process and normalize scores (deterministic TypeScript math) ──────────

    // Ensure all criteria are assessed (pad missing ones with zeros)
    const assessedNames = assessment.scores.map((s: any) => s.criterionName);
    const missingCriteria = criteria.filter(c => !assessedNames.includes(c.name));
    if (missingCriteria.length > 0) {
      missingCriteria.forEach(c => {
        assessment.scores.push({
          criterionName: c.name,
          score: 0,
          maxScore: c.maxScore,
          justification: 'Unable to assess this criterion from the provided text.',
          strengths: 'No specific strengths identified.',
          mistakes: [],
          suggestions: 'Unable to provide suggestions.',
        });
      });
    }

    // Normalize each score
    assessment.scores.forEach((s: any) => {
      // Clamp score to [0, maxScore] rounded to nearest 0.5
      const rawScore = Number(s.score) || 0;
      const maxScore = Math.round(Number(s.maxScore) || 0);
      s.score = Math.max(0, Math.min(Math.round(rawScore * 2) / 2, maxScore));
      s.maxScore = maxScore;

      // ── Score Floor: enforce minimum 1 for on-topic essays with sufficient words ──
      // This backs up the prompt-based Score Floor rule with a deterministic TypeScript check.
      // Note: Foundation uses "Task Response", Credit/Summary/Synthesis use "Task Achievement", LANC2146 uses "Task Response".
      const isTaskCriterion = s.criterionName === 'Task Response' || s.criterionName === 'Task Achievement';
      if (wordCount >= Math.round((activeTargetWordCount?.min ?? 0) * 0.5) && !isTaskCriterion && s.score === 0 && maxScore > 0) {
        s.score = 1; // Floor of 1 for non-task criteria
      }
      if (wordCount >= Math.round((activeTargetWordCount?.min ?? 0) * 0.5) && isTaskCriterion && s.score === 0 && maxScore > 0) {
        s.score = maxScore > 5 ? 2 : 1; // Floor of 2 for Task criterion on Foundation (0-6 scale); floor of 1 on Credit (0-5 scale)
      }

      // Clean text fields (strip markdown, handle arrays/objects)
      s.justification = clean(s.justification);
      s.strengths = clean(s.strengths);
      s.suggestions = clean(s.suggestions);

      // Ensure strengths and suggestions are never empty
      if (!s.strengths) s.strengths = 'No specific strengths identified for this criterion.';
      if (!s.suggestions) s.suggestions = 'No specific suggestions for this criterion.';

      // Clean mistakes array
      if (!Array.isArray(s.mistakes) || s.mistakes.length === 0) {
        s.mistakes = [{ quote: '', explanation: 'No specific mistakes identified for this criterion.' }];
      } else {
        s.mistakes = s.mistakes.map((m: any) => {
          if (typeof m === 'string') {
            const cleaned = m.replace(/^[\-\*]\s+/, '').trim().replace(/\s*[—\-]\s*/, ': ').trim();
            return { quote: cleaned, explanation: '' };
          }
          return {
            quote: clean(typeof m.quote === 'string' ? m.quote : (m.text || '')),
            explanation: clean(typeof m.explanation === 'string' ? m.explanation : (m.reason || '')),
          };
        }).filter((m: any) => m.quote || m.explanation);
      }

      // Build feedback string locally from clean fields
      s.feedback = buildFeedback(s);
    });

    // ── Deterministic math: compute totals in TypeScript ────────────────────
    const totalScore = Math.round(
      assessment.scores.reduce((sum: number, s: any) => sum + s.score, 0) * 2
    ) / 2;
    const maxScore = assessment.scores.reduce((sum: number, s: any) => sum + s.maxScore, 0);
    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    // Clean overallFeedback
    let overallFeedback = clean(assessment.overallFeedback);
    if (!overallFeedback) overallFeedback = 'No overall feedback provided.';

    return NextResponse.json({
      success: true,
      assessment: {
        scores: assessment.scores,
        totalScore,
        maxScore,
        percentage,
        overallFeedback,
        wordCount,
        targetWordCount: (isFoundation || isSummaryWriting || isSynthesisWriting || isLanc1070 || isLanc2146) ? activeTargetWordCount : null,
        modelUsed: usedModelName,
        consensusConfidence,
        vertexAI: useVertexAI || useVertexExpress,
        vertexLocation: (useVertexAI || useVertexExpress) ? vertexLocation : null,
        authMode: useVertexAI ? 'vertex_adc' : useVertexExpress ? 'vertex_express' : 'ai_studio',
        createdAt: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Assessment error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    let userError = 'Failed to assess essay';
    if (msg.includes('API key not valid') || msg.includes('API_KEY_INVALID') || msg.includes('invalid API key')) {
      userError = 'Gemini API key is invalid. Please check the GEMINI_API_KEY environment variable on the server.';
    } else if (msg.includes('model not found') || msg.includes('does not exist') || msg.includes('MODEL_NOT_FOUND')) {
      userError = 'The AI model is currently unavailable. Please try again later.';
    } else if (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
      userError = 'Gemini API quota exceeded. Please wait a few minutes and try again.';
    } else if (msg.includes('PERMISSION_DENIED') || msg.includes('forbidden')) {
      userError = 'Gemini API access denied. The API key may not have permission to use this model.';
    } else if (msg.includes('timeout') || msg.includes('TIMEOUT') || msg.includes('Function exceeded time limits') || msg.includes('504') || msg.includes('ECONNRESET') || msg.includes('socket hang up')) {
      userError = 'Assessment timed out. The AI took too long to respond. Please try again.';
    }
    return NextResponse.json({ error: userError, details: msg }, { status: 500 });
  }
}
