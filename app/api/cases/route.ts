import { read, utils } from 'xlsx'
import fs from 'fs'
import path from 'path'

const names = ['CollateralIQ_Government_Aligned_3000.csv','CollateralIQ_Government_Aligned_3000.xlsx','CollateralIQ_Government_Aligned_3000.xlsm','CollateralIQ_Government_Aligned_3000']
const createdCases: Record<string, unknown>[] = []

export const dynamic = 'force-dynamic'

export async function GET() {
  const file = names.map(name => path.join(process.cwd(), name)).find(fs.existsSync)
  if (!file) return Response.json({ error: 'Dataset not found. Add CollateralIQ_Government_Aligned_3000.csv to the project root.' }, { status: 503 })
  const workbook = read(fs.readFileSync(file), { cellDates: true })
  const rows = utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: '' })
  return Response.json({ source: path.basename(file), total: rows.length + createdCases.length, cases: [...createdCases, ...rows] })
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
