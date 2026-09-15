export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { loadAndTrainModel } = await import('./lib/model-training')
  console.log('[CollateralIQ] Training model during server startup...')
  await loadAndTrainModel()
  console.log('[CollateralIQ] Startup model training complete')
}
