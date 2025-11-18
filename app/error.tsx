'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-md w-full rounded-lg border bg-card p-6">
        <h2 className="text-2xl font-bold mb-4">Algo salió mal</h2>
        <p className="text-muted-foreground mb-4">
          {error.message || 'Ocurrió un error inesperado'}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
        >
          Intentar de nuevo
        </button>
      </div>
    </div>
  )
}












