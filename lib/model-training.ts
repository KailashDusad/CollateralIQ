import { read, utils } from 'xlsx'
import fs from 'fs'
import path from 'path'

export interface TrainedModel {
  isTrained: boolean
  trainedAt: number
  ltvMean: number
  ltvStdDev: number
  loanMean: number
  loanStdDev: number
  valueMean: number
  valueStdDev: number
  coefficients: {
    age: number
    creditScore: number
    tenureYears: number
    annualIncome: number
    employmentVintage: number
    existingEmi: number
    carpetArea: number
    propertyAge: number
  }
  metrics: {
    testMse: number
    testRmse: number
    testMae: number
    samplesUsed: number
    testSetSize: number
  }
}

export interface DatasetRow {
  case_id: string
  borrower_name: string
  age: number
  occupation: string
  credit_score: number
  loan_amount_inr: number
  annual_income_lakh: number
  existing_emi_inr: number
  tenure_years: number
  employment_business_vintage_years: number
  carpet_area_sqft: number
  property_age_years: number
  indicative_value_inr: number
  ltv_percent: number
  city: string
  locality: string
  property_type: string
  bedrooms: number
  [key: string]: any
}

let trainedModel: TrainedModel | null = null
let isTraining = false
const modelArtifactPath = path.join(process.cwd(), '.collateraliq-model.json')

export async function loadAndTrainModel(): Promise<TrainedModel> {
  if (trainedModel && trainedModel.isTrained) {
    console.log('[CollateralIQ] Model already trained, returning cached version')
    return trainedModel
  }

  if (isTraining) {
    console.log('[CollateralIQ] Model training in progress, waiting...')
    let attempts = 0
    while (isTraining && attempts < 300) {
      await new Promise(r => setTimeout(r, 100))
      attempts++
    }
    if (trainedModel && trainedModel.isTrained) return trainedModel
  }

  isTraining = true
  try {
    const candidatePaths = [
      path.join(process.cwd(), 'CollateralIQ_Government_Aligned_3000.csv'),
      path.join(process.cwd(), 'CollateralIQ_Government_Aligned_3000.xlsx'),
      path.join(process.cwd(), 'CollateralIQ_Government_Aligned_3000.xlsm'),
      path.join(process.cwd(), 'CollateralIQ_Government_Aligned_3000'),
      path.join(process.cwd(), 'data', 'CollateralIQ_Government_Aligned_3000.csv'),
      path.join(process.cwd(), 'data', 'CollateralIQ_Government_Aligned_3000.xlsx'),
    ]
    const filePath = candidatePaths.find(candidate => fs.existsSync(candidate))

    if (!filePath) {
      const expected = candidatePaths.slice(0, 3).join(', ')
      console.error('[CollateralIQ] Excel file not found. Expected one of:', expected)
      throw new Error(`Dataset not found. Add CollateralIQ_Government_Aligned_3000.xlsx to the project root.`)
    }

    console.log('[CollateralIQ] Loading dataset from', filePath)
    const workbook = read(fs.readFileSync(filePath), { cellDates: true })
    const sheetName = workbook.SheetNames[0]
    const rows = utils.sheet_to_json(workbook.Sheets[sheetName]) as DatasetRow[]

    console.log(`[CollateralIQ] Loaded ${rows.length} cases from dataset`)

    // Clean and validate data
    const cleanedRows = rows
      .filter(row => {
        const hasRequiredFields =
          row.age &&
          row.credit_score &&
          row.loan_amount_inr &&
          row.annual_income_lakh &&
          row.tenure_years &&
          row.indicative_value_inr &&
          row.ltv_percent !== undefined &&
          row.carpet_area_sqft &&
          row.property_age_years !== undefined

        const isValid =
          !isNaN(Number(row.age)) &&
          !isNaN(Number(row.credit_score)) &&
          !isNaN(Number(row.loan_amount_inr)) &&
          !isNaN(Number(row.ltv_percent)) &&
          Number(row.ltv_percent) > 0 &&
          Number(row.ltv_percent) < 100

        return hasRequiredFields && isValid
      })
      .map(row => ({
        ...row,
        age: Number(row.age),
        credit_score: Number(row.credit_score),
        loan_amount_inr: Number(row.loan_amount_inr),
        annual_income_lakh: Number(row.annual_income_lakh),
        existing_emi_inr: Number(row.existing_emi_inr) || 0,
        tenure_years: Number(row.tenure_years),
        employment_business_vintage_years: Number(row.employment_business_vintage_years) || 0,
        carpet_area_sqft: Number(row.carpet_area_sqft),
        property_age_years: Number(row.property_age_years) || 0,
        indicative_value_inr: Number(row.indicative_value_inr),
        ltv_percent: Number(row.ltv_percent),
      }))

    console.log(`[CollateralIQ] Cleaned dataset: ${cleanedRows.length} valid rows`)

    // Split: 80% train, 20% test
    const testSetSize = Math.max(1, Math.floor(cleanedRows.length * 0.2))
    const shuffled = [...cleanedRows].sort(() => Math.random() - 0.5)
    const testSet = shuffled.slice(0, testSetSize)
    const trainSet = shuffled.slice(testSetSize)

    console.log(`[CollateralIQ] Train set: ${trainSet.length}, Test set: ${testSet.length}`)

    // Calculate statistics on training set
    const ltvValues = trainSet.map(r => r.ltv_percent)
    const loanValues = trainSet.map(r => r.loan_amount_inr)
    const valueValues = trainSet.map(r => r.indicative_value_inr)

    const ltvMean = ltvValues.reduce((a, b) => a + b, 0) / ltvValues.length
    const loanMean = loanValues.reduce((a, b) => a + b, 0) / loanValues.length
    const valueMean = valueValues.reduce((a, b) => a + b, 0) / valueValues.length

    const ltvStdDev = Math.sqrt(
      ltvValues.reduce((sum, v) => sum + Math.pow(v - ltvMean, 2), 0) / ltvValues.length
    )
    const loanStdDev = Math.sqrt(
      loanValues.reduce((sum, v) => sum + Math.pow(v - loanMean, 2), 0) / loanValues.length
    )
    const valueStdDev = Math.sqrt(
      valueValues.reduce((sum, v) => sum + Math.pow(v - valueMean, 2), 0) / valueValues.length
    )

    // Linear regression for LTV = f(age, creditScore, tenure, income, ...)
    // Simplified: calculate correlations and derive coefficients
    const features = [
      { key: 'age', values: trainSet.map(r => r.age) },
      { key: 'credit_score', values: trainSet.map(r => r.credit_score) },
      { key: 'tenure_years', values: trainSet.map(r => r.tenure_years) },
      { key: 'annual_income_lakh', values: trainSet.map(r => r.annual_income_lakh) },
      { key: 'employment_business_vintage_years', values: trainSet.map(r => r.employment_business_vintage_years) },
      { key: 'existing_emi_inr', values: trainSet.map(r => r.existing_emi_inr) },
      { key: 'carpet_area_sqft', values: trainSet.map(r => r.carpet_area_sqft) },
      { key: 'property_age_years', values: trainSet.map(r => r.property_age_years) },
    ]

    const coefficients: Record<string, number> = {}
    features.forEach(feature => {
      const correlation = calculateCorrelation(feature.values, ltvValues)
      // Scale correlation to reasonable coefficient range
      coefficients[feature.key] = correlation * 0.5
    })

    console.log('[CollateralIQ] Model coefficients calculated:', coefficients)

    // Evaluate on test set
    const predictions = testSet.map(row => predictLTV(row, coefficients, ltvMean))
    const actuals = testSet.map(r => r.ltv_percent)

    const mse = predictions.reduce((sum, pred, i) => sum + Math.pow(pred - actuals[i], 2), 0) / predictions.length
    const rmse = Math.sqrt(mse)
    const mae = predictions.reduce((sum, pred, i) => sum + Math.abs(pred - actuals[i]), 0) / predictions.length

    trainedModel = {
      isTrained: true,
      trainedAt: Date.now(),
      ltvMean,
      ltvStdDev,
      loanMean,
      loanStdDev,
      valueMean,
      valueStdDev,
      coefficients: {
        age: coefficients['age'],
        creditScore: coefficients['credit_score'],
        tenureYears: coefficients['tenure_years'],
        annualIncome: coefficients['annual_income_lakh'],
        employmentVintage: coefficients['employment_business_vintage_years'],
        existingEmi: coefficients['existing_emi_inr'],
        carpetArea: coefficients['carpet_area_sqft'],
        propertyAge: coefficients['property_age_years'],
      },
      metrics: {
        testMse: mse,
        testRmse: rmse,
        testMae: mae,
        samplesUsed: trainSet.length,
        testSetSize: testSet.length,
      },
    }

    fs.writeFileSync(modelArtifactPath, JSON.stringify(trainedModel, null, 2), 'utf8')

    console.log('[CollateralIQ] Model trained successfully')
    console.log(`[CollateralIQ] Test metrics - RMSE: ${rmse.toFixed(2)}, MAE: ${mae.toFixed(2)}`)

    return trainedModel
  } finally {
    isTraining = false
  }
}

function calculateCorrelation(x: number[], y: number[]): number {
  const n = x.length
  const meanX = x.reduce((a, b) => a + b, 0) / n
  const meanY = y.reduce((a, b) => a + b, 0) / n

  const numerator = x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY), 0)
  const denomX = Math.sqrt(x.reduce((sum, xi) => sum + Math.pow(xi - meanX, 2), 0))
  const denomY = Math.sqrt(y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0))

  if (denomX === 0 || denomY === 0) return 0
  return numerator / (denomX * denomY)
}

function predictLTV(
  row: DatasetRow,
  coefficients: Record<string, number>,
  ltvMean: number
): number {
  let prediction = ltvMean
  prediction += (row.age - 35) * coefficients['age'] * 0.1
  prediction += (row.credit_score - 700) * coefficients['credit_score'] * 0.001
  prediction += (row.tenure_years - 20) * coefficients['tenure_years'] * 0.5
  prediction += (row.annual_income_lakh - 10) * coefficients['annual_income_lakh'] * 0.01
  prediction += (row.employment_business_vintage_years - 5) * coefficients['employment_business_vintage_years'] * 0.05
  prediction += (row.existing_emi_inr - 30000) * coefficients['existing_emi_inr'] * 0.00001
  prediction += (row.carpet_area_sqft - 850) * coefficients['carpet_area_sqft'] * 0.0001
  prediction += (row.property_age_years - 10) * coefficients['property_age_years'] * 0.1

  // Clamp to realistic LTV range
  return Math.max(20, Math.min(95, prediction))
}

export function getTrainedModel(): TrainedModel | null {
  if (trainedModel?.isTrained) return trainedModel

  try {
    const persisted = JSON.parse(fs.readFileSync(modelArtifactPath, 'utf8')) as TrainedModel
    if (persisted.isTrained && persisted.coefficients && persisted.metrics) {
      trainedModel = persisted
    }
  } catch {
    return null
  }

  return trainedModel
}

export function predictCaseLTV(row: DatasetRow, model: TrainedModel | null = trainedModel): number {
  if (!model || !model.isTrained) throw new Error('Model not trained')
  const safe = (value: unknown, fallback = 0) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  const normalized: DatasetRow = {
    ...row,
    age: safe(row.age, 35),
    credit_score: safe(row.credit_score, 700),
    loan_amount_inr: safe(row.loan_amount_inr),
    annual_income_lakh: safe(row.annual_income_lakh, 10),
    existing_emi_inr: safe(row.existing_emi_inr),
    tenure_years: safe(row.tenure_years, 20),
    employment_business_vintage_years: safe(row.employment_business_vintage_years, 5),
    carpet_area_sqft: safe(row.carpet_area_sqft, 850),
    property_age_years: safe(row.property_age_years, 10),
    indicative_value_inr: safe(row.indicative_value_inr),
  }
  const coefficients = {
    age: model.coefficients.age,
    credit_score: model.coefficients.creditScore,
    tenure_years: model.coefficients.tenureYears,
    annual_income_lakh: model.coefficients.annualIncome,
    employment_business_vintage_years: model.coefficients.employmentVintage,
    existing_emi_inr: model.coefficients.existingEmi,
    carpet_area_sqft: model.coefficients.carpetArea,
    property_age_years: model.coefficients.propertyAge,
  }
  const prediction = predictLTV(normalized, coefficients, model.ltvMean)
  if (!Number.isFinite(prediction)) throw new Error('Insufficient numeric case data to calculate LTV')
  return Number(prediction.toFixed(2))
}
