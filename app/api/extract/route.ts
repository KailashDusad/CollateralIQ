export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const maxFileSize = 20 * 1024 * 1024

function cleanText(value: string) {
  return value.replace(/[■●▪]/g, '').replace(/\s+/g, ' ').trim()
}

function numberFrom(value: string) {
  const normalized = value.replace(/[₹■●▪]/g, '').replace(/,/g, '').trim()
  const match = normalized.match(/-?\d+(?:\.\d+)?/)
  if (!match) return undefined
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : undefined
}

function firstMatch(text: string, pattern: RegExp) {
  const match = text.match(pattern)
  return match?.[1] ? cleanText(match[1]) : undefined
}

function extractFields(text: string) {
  const result: Record<string, string | number> = {}
  const normalized = text.replace(/\u00a0/g, ' ')
  const lines = normalized.split(/\r?\n/).map(cleanText).filter(Boolean)
  const setText = (field: string, value: string | undefined) => { if (value) result[field] = value }
  const setNumber = (field: string, value: string | undefined) => { const parsed = value ? numberFrom(value) : undefined; if (parsed !== undefined) result[field] = parsed }
  const valueOnLine = (source: string, label: RegExp) => {
    const line = source.split(/\r?\n/).map(cleanText).find(candidate => label.test(candidate))
    if (!line) return undefined
    const match = line.match(label)
    return match?.[1] ? cleanText(match[1]) : undefined
  }

  // The supplied synthetic sale deed is a narrative document with a property table.
  // Prefer section-specific patterns so generic words like "name" and "age" cannot
  // capture headings, seller details, or page furniture.
  const purchaserIndex = lines.findIndex(line => /^Purchaser\s*\/\s*Buyer$/i.test(line))
  const purchaserLine = purchaserIndex >= 0 ? lines[purchaserIndex + 1] : undefined
  setText('borrower_name', purchaserLine?.split(/,\s*age\s*/i)[0])
  setNumber('age', purchaserLine?.match(/,\s*age\s*(\d+)/i)?.[1])

  const propertyStart = normalized.search(/2\.\s*DESCRIPTION OF THE PROPERTY/i)
  const propertyText = propertyStart >= 0 ? normalized.slice(propertyStart) : normalized
  setText('property_type', valueOnLine(propertyText, /^Property\s*Type\s+(.+)$/i))
  setText('building_name', valueOnLine(propertyText, /^Building\s*\/\s*Society\s+(.+)$/i))
  setText('flat_number', valueOnLine(propertyText, /^Flat\s*No\.?\s+(.+)$/i))
  setNumber('floor', valueOnLine(propertyText, /^Floor\s+(.+)$/i))
  setNumber('bhk', valueOnLine(propertyText, /^BHK\s+(.+)$/i))
  setText('property_address', valueOnLine(propertyText, /^Address\s+(.+)$/i))
  setNumber('carpet_area_sqft', valueOnLine(propertyText, /^Carpet\s*Area\s+(.+)$/i))
  setNumber('built_up_area_sqft', valueOnLine(propertyText, /^Built[- ]up\s*Area\s+(.+)$/i))
  setText('parking', valueOnLine(propertyText, /^Parking\s+(.+)$/i))
  setNumber('property_age_years', valueOnLine(propertyText, /^Approx\.?\s*Property\s*Age\s+(.+)$/i))

  const address = result.property_address as string | undefined
  if (address) {
    const addressParts = address.split(',').map(part => part.trim()).filter(Boolean)
    setText('locality', addressParts.find(part => /west|east|central|suburb|dadar|thane|mumbai/i.test(part)))
    setText('city', addressParts.find(part => /mumbai|thane/i.test(part)))
  }

  // Sale consideration is the only property-value signal in this deed. It is kept
  // explicitly as an indicative/demo value, never as a certified valuation.
  setNumber('indicative_value_inr', valueOnLine(normalized, /^Total\s*Sale\s*Consideration\s+(.+)$/i))

  // Strict labelled fallbacks for structured forms; deliberately no generic name,
  // age, address, or income matches because those words occur throughout deeds.
  const fallbackLabels: Record<string, [RegExp, 'text' | 'number']> = {
    credit_score: [/Credit\s*Score\s*[:\-]?\s*([^\n]+)/i, 'number'],
    loan_amount_inr: [/Loan\s*Amount(?:\s*\(INR\))?\s*[:\-]?\s*([^\n]+)/i, 'number'],
    annual_income_lakh: [/Annual\s*Income(?:\s*\(lakh\))?\s*[:\-]?\s*([^\n]+)/i, 'number'],
    tenure_years: [/Tenure(?:\s*\(years\))?\s*[:\-]?\s*([^\n]+)/i, 'number'],
    indicative_value_inr: [/Indicative\s*Value(?:\s*\(INR\))?\s*[:\-]?\s*([^\n]+)/i, 'number'],
    property_address: [/Property\s*Address\s*[:\-]?\s*([^\n]+)/i, 'text'],
    property_type: [/Property\s*Type\s*[:\-]?\s*([^\n]+)/i, 'text'],
  }
  for (const [field, [pattern, type]] of Object.entries(fallbackLabels)) {
    if (result[field] !== undefined) continue
    const value = firstMatch(normalized, pattern)
    if (type === 'number') setNumber(field, value)
    else setText(field, value)
  }

  return result
}

const extractionPrompt = `You are a document-understanding service for a residential secured-lending prototype.
Read the uploaded document carefully, including tables, images, scanned text, and narrative sections.
Return ONLY valid JSON. Never invent values. Use null when a value is absent or cannot be read.
Extract only facts explicitly present in the document. Keep the original meaning and units.

Return this object shape:
{
  "document_type": string|null,
  "borrower_name": string|null,
  "age": number|null,
  "occupation": string|null,
  "employer_business": string|null,
  "employment_business_vintage_years": number|null,
  "credit_score": number|null,
  "loan_amount_inr": number|null,
  "annual_income_lakh": number|null,
  "existing_emi_inr": number|null,
  "tenure_years": number|null,
  "loan_product": string|null,
  "loan_purpose": string|null,
  "interest_rate": number|null,
  "property_type": string|null,
  "property_address": string|null,
  "building_name": string|null,
  "flat_number": string|null,
  "bhk": number|null,
  "floor": number|null,
  "carpet_area_sqft": number|null,
  "built_up_area_sqft": number|null,
  "parking": string|null,
  "property_age_years": number|null,
  "indicative_value_inr": number|null,
  "city": string|null,
  "locality": string|null,
  "owner_name": string|null,
  "sale_consideration_inr": number|null,
  "encumbrance_status": string|null,
  "document_reference": string|null,
  "exceptions": string[]
}

For Indian amounts, return plain numeric rupees: INR 3,85,00,000 becomes 38500000.
For floor values, return the numeric floor. For BHK and areas, return numbers only.
If the document contains a discrepancy or explicitly says a value is synthetic/demo, preserve that fact in exceptions.`

async function geminiRequest(url: string, init: RequestInit) {
  const response = await fetch(url, init)
  const body = await response.text()
  if (!response.ok) throw new Error(`Gemini API ${response.status}: ${body.slice(0, 500)}`)
  return body ? JSON.parse(body) as Record<string, any> : {}
}

async function extractWithGemini(file: File, data: Buffer) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return undefined

  const generated = await geminiRequest(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { inline_data: { mime_type: file.type || 'application/pdf', data: data.toString('base64') } },
          { text: extractionPrompt },
        ],
      }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    }),
  })
  const responseText = generated.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('')
  if (!responseText) throw new Error('Gemini returned no extraction result.')
  const parsed = JSON.parse(responseText.replace(/^```json\s*|\s*```$/g, '').trim()) as Record<string, unknown>
  const fields = Object.fromEntries(Object.entries(parsed).filter(([, value]) => value !== null && value !== undefined && value !== ''))
  return { fields, model: geminiModel, source: 'gemini' }
}

export async function POST(request: Request) {
  try {
    const data = await request.formData()
    const file = data.get('document')
    if (!file || typeof file !== 'object' || typeof file.arrayBuffer !== 'function') return Response.json({ error: 'Upload a document.' }, { status: 400 })
    if (file.size > maxFileSize) return Response.json({ error: 'Document must be 50 MB or smaller.' }, { status: 413 })
    const dataBuffer = Buffer.from(await file.arrayBuffer())
    let geminiResult: Awaited<ReturnType<typeof extractWithGemini>>
    let geminiError = ''
    try {
      geminiResult = await extractWithGemini(file, dataBuffer)
    } catch (error) {
      geminiError = error instanceof Error ? error.message : 'Gemini extraction failed.'
      geminiResult = undefined
    }
    const fields = geminiResult?.fields || {}
    const required = ['borrower_name', 'age', 'credit_score', 'loan_amount_inr', 'annual_income_lakh', 'tenure_years', 'carpet_area_sqft', 'property_age_years', 'indicative_value_inr']
    if (!geminiResult) return Response.json({ error: geminiError || 'Set GEMINI_API_KEY in Vercel Project Settings > Environment Variables before uploading documents.' }, { status: 503 })
    return Response.json({ fields, missingFields: required.filter(field => fields[field] === undefined), source: file.name, extractionSource: geminiResult.source, model: geminiResult.model, warning: geminiError || undefined })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to read document.' }, { status: 422 })
  }
}
