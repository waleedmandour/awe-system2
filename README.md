# AWE System - Automated Writing Evaluation

A Multimodal, LLM-based Automated Writing Evaluation (AWE) System for Formative Assessment

**For Foundation and Credit Course Students At Sultan Qaboos University**

---

## 🎯 Overview

This PWA (Progressive Web App) enables students to:
- Upload photos of handwritten essays (up to 2 pages)
- Extract text using Google Gemini OCR or Google Vision API
- Receive AI-powered assessment based on IELTS-aligned rubrics (CEFR A1–A2)
- Get constructive feedback with detailed justifications, error identification, and improvement suggestions
- Select exam type for FP0340 (Mid-semester or Final Exam) with appropriate word count targets
- Download assessment reports as PDF
- Install the app on mobile devices for quick access

---

## 🚀 Deployment on Vercel

The AWE System is configured for one-click deployment on [Vercel](https://vercel.com). The project uses **serverless API routes** for OCR and assessment, and all student data is stored in the browser's localStorage — no server-side database is required for core functionality.

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/waleedmandour/awe-system)

### Manual Deploy (via Vercel Dashboard)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **"Import Git Repository"**
3. Select **`waleedmandour/awe-system`**
4. Leave all defaults — Vercel auto-detects Next.js
5. Click **"Deploy"**

Vercel will automatically:
- Detect the Next.js framework and configure the build
- Install dependencies and run `prisma generate`
- Build and deploy the application
- Set up automatic redeployments on every `git push` to `main`

> **Note:** No environment variables are required. API keys (Gemini, Vision) are entered by users directly in the app and stored in their browser's localStorage.

### Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy (follow the prompts)
cd awe-system
vercel

# Deploy to production
vercel --prod
```

---

## 📋 Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- npm or Bun runtime
- Google Gemini API key (free tier available)
- Google Cloud Vision API key (optional, for enhanced OCR)

### Installation

```bash
# Clone the repository
git clone https://github.com/waleedmandour/awe-system.git
cd awe-system

# Install dependencies
npm install

# Setup database (optional — app works without it using in-memory fallbacks)
npx prisma db push

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm run start
```

---

## 📱 PWA Installation

Students can install the app on their devices:

**iOS (Safari):**
1. Open the app URL
2. Tap Share → "Add to Home Screen"

**Android (Chrome):**
1. Open the app URL
2. Tap Menu → "Install app"

---

## 🔑 API Keys

API keys are entered by each user inside the app and stored locally in their browser. No server-side keys are needed.

### Gemini API Key (Required)
1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Click "Get API Key"
3. Free tier: 15 requests/minute

### Google Vision OCR Key (Optional)
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Enable "Cloud Vision API"
3. Create credentials → API Key
4. Free tier: 1,000 units/month

---

## 📚 Supported Courses

### Foundation Program
| Course Code | Course Name | Assessment Scale | Exam Types |
|-------------|-------------|------------------|------------|
| 0230 | English Language Foundation I (FP0230) | 0–6 per criterion | Standard |
| 0340 | English Language Foundation II (FP0340) | 0–6 per criterion | Mid-semester (120 words) / Final (200 words) |

### Post-Foundation Program
| Course Code | Course Name | Assessment Scale |
|-------------|-------------|------------------|
| LANC2160 | Academic English: Summary Writing & 2-Point Synthesis Essay | 0–5 per criterion |

---

## 📋 Assessment Criteria

### Foundation Courses (FP0230, FP0340)
| Criterion | Scale | Description |
|-----------|-------|-------------|
| Task Response | 0–6 | How well the essay addresses the task requirements, audience, purpose, and genre |
| Coherence and Cohesion | 0–6 | Logical organization, paragraphing, and use of cohesive devices |
| Lexical Resource | 0–6 | Range and accuracy of vocabulary, word choice, and spelling |
| Grammatical Range and Accuracy | 0–6 | Range and accuracy of grammatical structures and punctuation |

**Total:** 24 marks | **Special Rules:** Off-topic penalties apply to Task Response and Lexical Resource.

### Post-Foundation (LANC2160)
| Criterion | Scale | Description |
|-----------|-------|-------------|
| Task Achievement | 0–5 | How well the summary captures main points |
| Coherence & Cohesion | 0–5 | Logical organization and linking of ideas |
| Lexical Resource | 0–5 | Range and accuracy of vocabulary |
| Grammatical Range & Accuracy | 0–5 | Range and accuracy of grammar |

**Total:** 20 marks

---

## 🔄 FP0340 Exam-Type Selection

FP0340 (English Language Foundation II) supports two exam types with different word count targets:

| Exam Type | Target Word Count | Acceptable Range |
|-----------|:-----------------:|:----------------:|
| Mid-semester Exam | 120 words | 110–130 words |
| Final Exam | 200 words | 190–210 words |

When FP0340 is selected in the app, students are presented with two buttons to choose the exam type before proceeding. The assessment prompt dynamically adjusts the word count expectations accordingly. All rubric criteria and scoring scales remain identical between exam types.

---

## 🛠️ Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript
- **Styling:** Tailwind CSS 4, shadcn/ui
- **Database:** Prisma ORM with SQLite (optional — graceful in-memory fallback)
- **State Management:** Zustand (persisted to localStorage)
- **AI Assessment:** Google Gemini (gemini-3-flash-preview)
- **OCR:** Google Gemini + Google Vision API (DOCUMENT_TEXT_DETECTION)
- **Animations:** Framer Motion
- **PDF Generation:** PDFKit
- **Deployment:** Vercel (serverless)

---

## 📂 Project Structure

```
├── prisma/
│   └── schema.prisma      # Database schema (optional)
├── public/
│   ├── squ_logo.png       # SQU logo
│   ├── manifest.json      # PWA manifest
│   └── sw.js              # Service worker
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── assess/    # AI assessment endpoint (Gemini)
│   │   │   ├── courses/   # Course data endpoint
│   │   │   ├── essays/    # Essay CRUD endpoint (DB or in-memory)
│   │   │   ├── ocr/       # OCR processing (Gemini + Vision)
│   │   │   └── pdf/       # PDF report generation
│   │   ├── globals.css    # Global styles
│   │   ├── layout.tsx     # Root layout
│   │   └── page.tsx       # Main application (SPA)
│   ├── components/ui/     # shadcn/ui components
│   ├── hooks/             # Custom React hooks
│   └── lib/
│       ├── db.ts          # Prisma client (graceful fallback)
│       ├── store.ts       # Zustand store (course, exam type, state)
│       └── utils.ts       # Utility functions
├── vercel.json            # Vercel deployment config
├── .env.example           # Environment variable template
└── package.json
```

---

## 🔒 Privacy & Security

- No data is shared with third parties beyond Google APIs (OCR and assessment)
- API keys are stored locally in each user's browser (localStorage)
- Essays and assessment records are stored in the browser — not on any server
- Server-side API routes only proxy requests to Google APIs
- Safety filters are configured to minimize false-positive blocking of academic content

---

## 🎨 Design Features

- **Mobile-First:** Optimized for iOS and Android with touch-friendly UI
- **Native Feel:** Smooth animations with Framer Motion
- **Safe Areas:** Full support for notched devices (iPhone X+)
- **PWA Features:** Offline support, install prompts, service worker
- **Accessibility:** ARIA support, semantic HTML
- **Dark Mode:** Automatic theme detection (light/dark/system)
- **SQU Branding:** Official green and gold color scheme

---

## 📝 Recent Updates

### FP0340 Exam-Type Selection
Added exam-type selection for FP0340 (Mid-semester vs Final Exam) with dynamic word count targets. Students choose between "For Mid-semester Exam" (120 words) and "For Final Exam" (200 words) before proceeding. The assessment prompt adjusts word count expectations automatically while keeping all rubric criteria identical.

### OCR/Assessment Parsing Fix
Resolved intermittent parsing failures caused by:
1. **Safety filter blocking:** Added `BLOCK_ONLY_HIGH` threshold for all safety categories to prevent false-positive blocking of legitimate academic essays on sensitive topics
2. **Null-safe response extraction:** Added optional chaining (`?.text?.()`) to prevent crashes when Gemini blocks content
3. **finishReason checking:** Added detection for `SAFETY`, `RECITATION`, `LANGUAGE`, and `MAX_TOKENS` finish reasons with informative error messages
4. **Automatic token escalation:** Implemented retry logic with increasing token limits (8192 → 16384 → 32768) when responses are truncated
5. **OCR pipeline hardening:** Applied the same safety and error-handling improvements to the OCR route

---

## 📦 Updating on GitHub

### Regular Updates

```bash
# Check status of changed files
git status

# Add all changes
git add .

# Commit with a descriptive message
git commit -m "Description of changes"

# Push to GitHub
git push origin main
```

> **Auto-deploy:** Once connected to Vercel, every push to `main` triggers an automatic deployment.

---

## 👨‍🏫 Credits

**Developed by:** Dr. Waleed Mandour
**Year:** 2025–2026
**Institution:** Sultan Qaboos University — Center for Preparatory Studies

---

## 📄 License

Educational use only. All rights reserved.
