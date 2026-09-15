import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = path.join(root, 'CollateralIQ_Government_Aligned_3000.csv')
const output = path.join(root, 'public', 'cases.json')
const publicFields = ['case_id', 'borrower_name', 'age', 'occupation', 'employment_business_vintage_years', 'annual_income_lakh', 'existing_emi_inr', 'credit_score', 'loan_product', 'loan_purpose', 'loan_amount_inr', 'tenure_years', 'city', 'locality', 'property_type', 'property_address', 'carpet_area_sqft', 'property_age_years', 'exceptions', 'indicative_value_inr', 'indicative_value_low_inr', 'indicative_value_high_inr', 'ltv_percent', 'collateral_coverage_x', 'collateral_assessment', 'valuer_status', 'credit_review_status']

if (!fs.existsSync(source)) throw new Error(`Dataset not found: ${source}`)

const [headers, ...records] = parseCsv(fs.readFileSync(source, 'utf8'))
const cases = records.map(values => {
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || '']))
  return Object.fromEntries(publicFields.map(field => [field, row[field] || '']))
})

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, JSON.stringify({ source: path.basename(source), total: cases.length, cases }))
console.log(`Generated ${output} with ${cases.length} cases`)

function parseCsv(input) {
  const records = []
  let record = []
  let value = ''
  let quoted = false

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]
    const next = input[index + 1]
    if (character === '"' && quoted && next === '"') {
      value += '"'
      index += 1
    } else if (character === '"') {
      quoted = !quoted
    } else if (character === ',' && !quoted) {
      record.push(value)
      value = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1
      record.push(value)
      records.push(record)
      record = []
      value = ''
    } else {
      value += character
    }
  }

  if (value || record.length) {
    record.push(value)
    records.push(record)
  }
  return records
}
