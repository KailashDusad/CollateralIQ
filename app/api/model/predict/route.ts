import { getTrainedModel, loadAndTrainModel, predictCaseLTV, type DatasetRow } from '@/lib/model-training'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const model = getTrainedModel() ?? await loadAndTrainModel()
    const input = await request.json() as DatasetRow
    const predictedLtv = predictCaseLTV(input, model)

    return Response.json({
      predictedLtv: Number(predictedLtv.toFixed(2)),
      modelStatus: 'trained',
      humanReviewRequired: true,
      note: 'Model-supported estimate only. Final credit decisions require authorized human review.',
    })
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'Unable to score case',
    }, { status: 503 })
  }
}
