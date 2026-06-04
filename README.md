# iAWE System — Vertex AI Edition

> Intelligent Automated Writing Evaluation for Sultan Qaboos University  
> **Powered with Vertex AI and Google's Agent Platform**

---

## Overview

The **iAWE System** (intelligent Automated Writing Evaluation) is a Progressive Web App (PWA) designed for **authorized SQU faculty members** to evaluate student writing with AI-powered assessment capabilities. This is the Vertex AI edition (`awe-system2`), which uses Google's Gemini Enterprise Agent Platform for enterprise-grade privacy, scoring determinism, and multi-call consensus.

**What makes this edition different from the student/teacher app (`awe-system1`):**

- **Vertex AI / Agent Platform backend** — Student data is never used for model training (Section 18 compliance)
- **Tri-mode authentication** — Supports Vertex AI + ADC, Vertex AI Express (API key), and AI Studio (legacy)
- **Deterministic scoring** — `temperature=0`, `topK=1`, `topP=0`, `seed=42` for reproducible results
- **Multi-call consensus** — 3 parallel Gemini calls with median scoring and confidence indicators (high/medium/low)
- **Auth-protected API routes** — HMAC-signed token middleware protects `/api/ocr` and `/api/assess` from unauthorized use
- **Email whitelist** — Only authorized SQU faculty emails can access the system

---

## Supported Courses

### Foundation Program

| Course Code | Course Name | Rubric Scale | Exam Types |
|-------------|-------------|:------------:|------------|
| FP0230 | English Language Foundation I | 0-6 per criterion | Mid-semester / Final |
| FP0340 | English Language Foundation II | 0-6 per criterion | Mid-semester / Final |

### Post-Foundation Program

| Course Code | Course Name | Rubric Scale | Writing Tasks |
|-------------|-------------|:------------:|---------------|
| LANC1070 | Academic English: Essay Writing | 0-5 per criterion | Synthesis Essay Practice Tests |
| LANC2070 | Academic English: Article Review | 0-5 per criterion | Article Review (critical analysis, APA citations) |
| LANC2160 | Academic English: Summary & Synthesis | 0-5 per criterion | Summary Writing / Synthesis Essay |
| LANC2146 | Report Writing | 0-5 per criterion | Discussion & Conclusion Practice |

---

## Architecture

### Authentication Flow

1. User signs in with their SQU email address
2. Email is validated against a server-side whitelist
3. An HMAC-signed token is issued as an httpOnly cookie (30-day expiry)
4. All requests to `/api/ocr` and `/api/assess` are verified by Next.js middleware
5. Unauthenticated requests receive 401

### AI Assessment Pipeline

```
Student Essay → OCR (Gemini Vision) → Extracted Text → AI Assessment (3x consensus calls)
                                                       ↓
                                              Median Scoring + Confidence Rating
                                                       ↓
                                              TypeScript Score Normalization
                                                       ↓
                                              Results + PDF Report
```

### Tri-Mode Gemini Authentication

| Mode | Env Vars | Features | Use Case |
|------|----------|----------|----------|
| **Vertex AI + ADC** | `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION` | Full determinism, region selection, Section 18 privacy | Production (recommended) |
| **Vertex AI Express** | `VERTEX_API_KEY` | Section 18 privacy, limited determinism | Quick start |
| **AI Studio** (legacy) | `GEMINI_API_KEY` | No privacy guarantee, no determinism | Development only |

### Scoring Determinism

On Vertex AI and Vertex AI Express, the system applies:

| Parameter | Value | Effect |
|-----------|-------|--------|
| `temperature` | 0 | Greedy decoding |
| `topK` | 1 | Single best token selected |
| `topP` | 0 | No nucleus sampling |
| `seed` | 42 | Reproducible randomness |
| `thinkingBudget` | 0 | No extended reasoning |

Additionally, **3 parallel consensus calls** are made with identical parameters. The median score per criterion is selected, and a confidence rating is assigned based on score spread across calls:

- **High confidence** — max spread ≤ 0.5 points
- **Medium confidence** — max spread ≤ 1.5 points
- **Low confidence** — max spread > 1.5 points

### Score Humanization Rules

The assessment engine applies 9 humanization rules for fair, encouraging, and consistent scoring:

1. **First Draft Awareness** — No penalty for lack of polish on timed exam essays
2. **OCR Error Forgiveness** — Spelling errors treated as potential OCR artifacts by default
3. **Arabic L1 Transfer Recognition** — 7 common transfer patterns classified as expected, not penalized
4. **Anti-Double-Penalization** — Each error penalized in only one criterion
5. **Effort Reward** — Attempted complexity not scored lower than simple accuracy
6. **Score Floor** — On-topic essays with ≥50% word count receive minimum 1/5 per criterion
7. **Borderline Benefit of Doubt** — Higher band awarded when genuinely uncertain
8. **Feedback Tone Guardrails** — Asset-based language, no judgmental phrasing
9. **Holistic Consistency Check** — Score spread across criteria must not exceed 2 points

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS 4, shadcn/ui |
| State | Zustand (persisted to localStorage) |
| AI/ML | Google Gemini via `@google/genai` SDK |
| OCR | Gemini 2.5 Flash Vision |
| Assessment | Gemini 2.5 Flash / Pro (tiered fallback) |
| Scoring | Deterministic TypeScript post-processing |
| Auth | HMAC-SHA256 tokens via Web Crypto API |
| PDF | PDFKit |
| DB | Prisma + SQLite (local dev), in-memory fallback (Vercel) |
| Deployment | Vercel (serverless) |

---

## Project Structure

```
awe-system2/
├── public/
│   ├── iawe-icon.png           # App icon
│   ├── icon-*.png              # PWA icons (48-512px)
│   ├── squ_logo.png            # SQU logo
│   ├── cps_logo.png            # CPS logo
│   └── manifest.json           # PWA manifest
├── prisma/
│   └── schema.prisma           # Database schema (SQLite)
├── src/
│   ├── middleware.ts            # Auth middleware (protects /api/ocr, /api/assess)
│   ├── app/
│   │   ├── api/
│   │   │   ├── assess/route.ts # AI assessment (tri-mode auth, consensus scoring)
│   │   │   ├── auth/route.ts   # Email whitelist authentication
│   │   │   ├── courses/route.ts# Course data
│   │   │   ├── essays/route.ts # Essay CRUD (DB + in-memory fallback)
│   │   │   ├── ocr/route.ts    # Gemini Vision OCR
│   │   │   └── pdf/assessment/ # PDF report generation
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Main SPA orchestrator
│   ├── components/
│   │   ├── screens/            # 9 screen components (Auth → Results)
│   │   ├── layout/             # BottomNav, InstallBanner, OfflineIndicator
│   │   ├── shared/             # AIDisclaimer
│   │   └── ui/                 # shadcn/ui components
│   ├── hooks/                  # Custom React hooks
│   └── lib/
│       ├── store.ts            # Zustand store (courses, assignments, state)
│       ├── whitelist.ts        # Email whitelist
│       ├── scoring-utils.ts    # Score recalculation
│       ├── image-utils.ts      # Image processing
│       └── animations.ts       # Framer Motion configs
├── .env.example                # Environment variable template
├── vercel.json                 # Vercel deployment config
└── package.json
```

---

## Quick Start (Local Development)

### Prerequisites

- Node.js 18+
- npm
- Google Cloud project with Vertex AI API enabled, **or** a Vertex AI Express API key

### Installation

```bash
# Clone the repository
git clone https://github.com/waleedmandour/awe-system2.git
cd awe-system2

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate
```

### Environment Configuration

Copy `.env.example` to `.env` and configure one authentication mode:

```bash
cp .env.example .env
```

**Vertex AI Express (recommended for quick start):**
```env
VERTEX_API_KEY=AQ.your-api-key-here
AUTH_SECRET=your-random-secret-here
```

**Vertex AI + ADC (recommended for production):**
```env
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=me-central1
AUTH_SECRET=your-random-secret-here
```

Generate `AUTH_SECRET` with: `openssl rand -base64 32`

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Create production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint checks |
| `npm run test` | Run unit tests |
| `npm run typecheck` | Run TypeScript type checking |

---

## Deployment on Vercel

### Environment Variables

Set these in your Vercel project settings (**Settings → Environment Variables**):

| Variable | Required | Description |
|----------|:--------:|-------------|
| `VERTEX_API_KEY` | Yes* | Vertex AI Express API key (prefix `AQ.`) |
| `GOOGLE_CLOUD_PROJECT` | Yes* | GCP project ID for Vertex AI + ADC |
| `GOOGLE_CLOUD_LOCATION` | No | Region (default: `me-central1`) |
| `AUTH_SECRET` | Yes | HMAC signing key for auth tokens |
| `DATABASE_URL` | No | Prisma DB URL (default: `file:./db/custom.db`) |

**Use either `VERTEX_API_KEY` (Express) or `GOOGLE_CLOUD_PROJECT` (ADC) — not both.**

For ADC on Vercel, set `GOOGLE_APPLICATION_CREDENTIALS_JSON` to the contents of your service account JSON key.

### Deploy Steps

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import `waleedmandour/awe-system2`
3. Configure environment variables (see above)
4. Click **Deploy**

> **Note:** On Vercel's Free tier, serverless functions are capped at 10 seconds. The Hobby plan ($20/mo) supports up to 60 seconds, which is required for multi-call consensus assessments.

---

## PWA Installation

The app can be installed on mobile devices for a native-like experience:

**iOS (Safari):**
1. Open the app URL in Safari
2. Tap Share → "Add to Home Screen"

**Android (Chrome):**
1. Open the app URL in Chrome
2. Tap Menu → "Install app"

---

## Privacy & Security

- **Section 18 compliant** — Vertex AI / Agent Platform guarantees student data is never used for model training
- **Server-side API keys** — No API keys exposed to the client; all Gemini calls are proxied through serverless API routes
- **HMAC authentication** — Tokens are signed with `AUTH_SECRET` using Web Crypto API; httpOnly cookies prevent client-side access
- **Email whitelist** — Only pre-approved SQU faculty emails can authenticate
- **Middleware protection** — `/api/ocr` and `/api/assess` require valid auth tokens; unauthenticated requests receive 401
- **No third-party data sharing** — Essays and assessments are processed only by Google Gemini via Vertex AI
- **Client-side storage** — Assessment records are stored in the browser's localStorage; PDF exports are generated client-side

---

## Model Routing

| Course Type | Primary Model | Fallback | Schema |
|-------------|:-------------:|:--------:|:------:|
| Foundation (FP0230, FP0340) | `gemini-2.5-flash` | `gemini-2.5-pro` | 0–6 scale |
| Credit / LANC1070 / LANC2070 | `gemini-2.5-flash` | `gemini-2.5-pro` | 0–5 scale |
| Summary (LANC2160) | `gemini-2.5-flash` | `gemini-2.5-pro` | 0–5 scale |
| Synthesis (LANC2160) | `gemini-2.5-flash` | `gemini-2.5-pro` | 0–5 scale |
| Report (LANC2146) | `gemini-2.5-flash` | `gemini-2.5-pro` | 0–5 scale |

---

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## Credits

### Project Team

- **Jokha Al Hosni** — Team Head
- **Sanna Al Hudhafi** — Member
- **Waleed Mandour** — Member

**Institution:** Sultan Qaboos University — Center for Preparatory Studies

---

## How to Cite

If you use the **iAWE System** in your research, teaching, or publications, please cite:

### APA

> Mandour, W. (2026). *iAWE System: A Multimodal, LLM-based Automated Writing Evaluation System for Formative Assessment* (Version 3.0.0) [Computer software]. Sultan Qaboos University — Center for Preparatory Studies. https://github.com/waleedmandour/awe-system2

### BibTeX

```bibtex
@software{mandour_awe_system_2026,
  author    = {Mandour, Waleed},
  title     = {{iAWE System: A Multimodal, LLM-based Automated Writing Evaluation System for Formative Assessment}},
  year      = {2026},
  version   = {3.0.0},
  publisher = {Sultan Qaboos University -- Center for Preparatory Studies},
  url       = {https://github.com/waleedmandour/awe-system2}
}
```

---

## License

This project is licensed under the [MIT License](LICENSE).

---

*Powered with Vertex AI and Google's Agent Platform, 2026*
