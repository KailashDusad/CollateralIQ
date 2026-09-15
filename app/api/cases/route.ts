import { read, utils } from 'xlsx'
import fs from 'fs'
import path from 'path'

const datasetPath = path.join(process.cwd(), 'CollateralIQ_Government_Aligned_3000.csv')
const createdCases: Record<string, unknown>[] = []
const publicFields = ['case_id', 'borrower_name', 'age', 'occupation', 'employment_business_vintage_years', 'annual_income_lakh', 'existing_emi_inr', 'credit_score', 'loan_product', 'loan_purpose', 'loan_amount_inr', 'tenure_years', 'city', 'locality', 'property_type', 'property_address', 'carpet_area_sqft', 'property_age_years', 'exceptions', 'indicative_value_inr', 'indicative_value_low_inr', 'indicative_value_high_inr', 'ltv_percent', 'collateral_coverage_x', 'collateral_assessment', 'valuer_status', 'credit_review_status']

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    if (!fs.existsSync(datasetPath)) return Response.json({ error: 'Dataset not found. Add CollateralIQ_Government_Aligned_3000.csv to the project root.' }, { status: 503 })
    const workbook = read(fs.readFileSync(datasetPath), { cellDates: true })
    const rows = utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: '' })
    const cases = rows.map(row => Object.fromEntries(publicFields.map(field => [field, row[field] ?? ''])))
    return Response.json({ source: path.basename(datasetPath), total: cases.length + createdCases.length, cases: [...createdCases, ...cases] })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to load cases.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as Record<string, unknown>
    if (!input || typeof input !== 'object' || Array.isArray(input)) return Response.json({ error: 'A case object is required.' }, { status: 400 })
    const created = {
      ...input,
      case_id: textValue(input.case_id) || `CLIQ-DEMO-${String(createdCases.length + 1).padStart(4, '0')}`,
      created_at: new Date().toISOString(),
      data_source: 'User-entered demo intake',
      collateral_assessment: 'MEDIUM - REVIEW REQUIRED',
    }
    createdCases.unshift(created)
    return Response.json({ case: created }, { status: 201 })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to save case.' }, { status: 400 })
  }
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value)
}
