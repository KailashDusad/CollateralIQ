import { loadAndTrainModel, getTrainedModel } from '@/lib/model-training'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const model = getTrainedModel() ?? await loadAndTrainModel()
    return Response.json({
      status: 'trained',
      trainedAt: model.trainedAt,
      samplesUsed: model.metrics.samplesUsed,
      testSetSize: model.metrics.testSetSize,
      metrics: model.metrics,
    })
  } catch (error) {
    return Response.json({
      status: 'dataset_missing',
      message: error instanceof Error ? error.message : 'Unable to load dataset',
    }, { status: 503 })
  }
}

export async function POST() {
  return GET()
}
