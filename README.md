# CollateralIQ

CollateralIQ is an AI-assisted collateral intelligence and verification prototype for residential secured lending. It helps Relationship Managers, Credit Officers, and Valuers turn fragmented property documents into a structured, explainable collateral assessment for Home Loans and Loan Against Property (LAP) cases.

> CollateralIQ supports human review. It does not certify valuation, establish legal title, conclusively detect fraud, replace professional valuers, or approve loans automatically.

## Why This Project

Residential collateral information is distributed across documents such as sale deeds, property cards, society certificates, building plans, occupancy certificates, tax receipts, and encumbrance records. Manual review makes it easy to miss inconsistencies and slows the path to credit review.

CollateralIQ demonstrates the workflow:

**Enter -> Upload -> Extract -> Verify -> Flag -> Compare -> Value -> Assess -> Review**

## Prototype Scope

### In scope

- Home Loan and Loan Against Property (LAP)
- Residential apartments/flats, independent houses, villas, and row houses
- Mumbai and Thane
- Relationship Manager, Credit Officer, and Valuer workflows
- Borrower and loan detail entry
- Primary and supporting document upload
- Structured field extraction and user confirmation
- Cross-document verification and exception flags
- Indicative value range, illustrative distress value, LTV, and collateral coverage
- Qualitative collateral assessment with human review safeguards
- Valuer review, credit decision capture, and lightweight audit trail
- A synthetic 3,000-row demo dataset

### Out of scope

- Commercial, industrial, or agricultural property
- Gold loans or securities-backed lending
- Live CERSAI, government, or property-record integrations
- Autonomous loan approval
- Arbitrary AI risk scores
- Certified valuation, legal title opinion, or conclusive fraud detection
- Consumer-facing property-price applications or report/PPT generation

## Main Workflow

1. Open the dashboard and review active cases, exceptions, average LTV, and valuer-pending cases.
2. Select **New Loan Case** and enter borrower and loan information.
3. Upload the primary property PDF or supporting documents.
4. Confirm extracted fields such as property type, address, flat number, BHK, area, floor, and indicative value.
5. Upload the seven supporting document types individually:
   - Sale Deed / Agreement
   - Property Card
   - Society Share Certificate
   - Approved Building Plan
   - Occupancy Certificate
   - Property Tax Receipt
   - Encumbrance / Security Interest Document
6. Review cross-document facts and potential inconsistencies.
7. Review the assessment matrix, indicative value range, distress-value scenario, LTV, and collateral coverage.
8. Route the case to human valuer and credit review. Record **Proceed**, **Request Clarification**, or **Reject** with reasons where required.

## Flagship Demo Case

Use the synthetic case `CLIQ-DADAR-001` for a walkthrough:

- Borrower: Arjun Mehta, fictional, 38, Business Owner
- Property: 2BHK apartment, Dadar West, Mumbai, Flat 702
- Area: 850 sq.ft carpet and 1,020 sq.ft built-up
- Loan: LAP, INR 2.50 Cr, 15 years, illustrative rate of 10.75%
- Indicative value: INR 4.675 Cr, with an illustrative range of INR 4.45-4.90 Cr
- LTV: 53.5%
- Collateral coverage: 1.87x
- Key exception: Sale Deed area of 850 sq.ft versus Tax Receipt area of 920 sq.ft
- Assessment: **MEDIUM - REVIEW REQUIRED**

The area difference is presented as a potential inconsistency requiring authorized manual verification, never as a fraud conclusion.

## Technology

- Next.js 16 App Router and Turbopack
- React 19 and TypeScript
- `xlsx` for reading the synthetic CSV/XLSX dataset
- `pdf-parse` for local PDF text extraction
- Optional Google Gemini document extraction through `GEMINI_API_KEY`
- A lightweight dataset-trained LTV estimation model with reported test metrics
- Lucide React icons and the project CSS design system

## Requirements

- Node.js 20 or newer
- npm or pnpm
- The dataset file `CollateralIQ_Government_Aligned_3000.csv` in the project root
- Optional: a Gemini API key for multimodal document extraction

## Setup

Install dependencies:

```powershell
npm install
```

Create a `.env` file in the project root when Gemini extraction is needed:

```env
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

Start the development server:

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build and Run

Validate the production build:

```powershell
npm run build
```

Run the production server locally:

```powershell
npm run start
```

The build output is written to `.next`. This project currently uses server-side API routes, so `.next` must be deployed to a Next.js/Node-compatible host such as Vercel. The `.next/static` directory alone is not a complete website.

## API Routes

| Route | Purpose |
| --- | --- |
| `GET /api/cases` | Loads the synthetic case dataset |
| `POST /api/cases` | Creates a demo case in the running process |
| `POST /api/extract` | Extracts document fields using Gemini or the local PDF fallback |
| `POST /api/model/predict` | Returns a model-supported LTV estimate |
| `GET /api/model/status` | Trains or loads the model and returns metrics |

Created demo cases are kept in memory and are not a persistent database record. Restarting the server clears them.

## Model and Responsible Use

The model is a prototype estimator trained from the synthetic dataset. It uses borrower, loan, and property factors including age, credit score, tenure, income, employment/business vintage, existing EMI, carpet area, and property age.

The application communicates these limitations directly:

- Model output is an estimate, not a credit decision.
- LTV and collateral coverage are arithmetic checks based on entered values.
- Document extraction must be confirmed by an authorized user.
- Exceptions require manual verification and are not fraud findings.
- Valuer and Credit Officer sign-off remain mandatory.
- No live government or CERSAI verification is performed.

## Assignment Alignment

The prototype demonstrates the required Input -> Processing -> Output -> Human Review chain:

| Assignment requirement | Prototype evidence |
| --- | --- |
| Product rationale | Fragmented residential collateral review is the core problem addressed |
| Target users | Relationship Manager, Credit Officer, and Valuer workflows |
| Dashboard | KPI cards, recent cases, searchable case register |
| Manual intake | Borrower, loan, and property fields |
| Document intelligence | Primary/supporting uploads and structured extraction |
| Verification | Cross-document comparison and exception flags |
| Valuation support | Indicative range, distress scenario, and comparable-oriented review |
| Credit support | LTV, collateral coverage, qualitative assessment, and human decision capture |
| Responsible fintech | Human sign-off, limitations, source labels, and audit events |
| Demo data | Synthetic 3,000-row dataset plus a flagship walkthrough case |

## Regulatory and Institutional Context

The assignment positions the product alongside, rather than as a replacement for, established institutional processes and sources:

- RBI: secured-lending, valuation governance, and security-interest context
- NHB RESIDEX: residential market trend context
- Maharashtra Government / Mahabhumi: property-record framework
- IBBI: registered valuer and valuation-report principles

These references provide context for the prototype and do not mean the application performs live verification or issues a regulated valuation.

## Project Structure

```text
app/
  api/
    cases/                  Dataset loading and demo case creation
    extract/                Document extraction
    model/predict/          LTV prediction
    model/status/           Model status and metrics
  page.tsx                  Main dashboard and case workflow
  globals.css               Application styling
lib/
  model-training.ts         Dataset loading and prototype model training
public/                     Static assets
CollateralIQ_Government_Aligned_3000.csv
```

## Deployment Note

This is a dynamic Next.js application because document extraction, model prediction, and case routes run on the server. A static-only host that serves HTML/CSS/JavaScript files cannot support the complete workflow without moving those APIs to a separate backend and changing the client integration.

For a complete demo deployment, use a Next.js-compatible host, include the dataset as a deployed asset, and configure `GEMINI_API_KEY` only when Gemini extraction is required.

