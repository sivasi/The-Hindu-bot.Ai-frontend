type BackendDownProps = {
  onRetry: () => void
  retrying?: boolean
}

export function BackendDown({ onRetry, retrying }: BackendDownProps) {
  return (
    <section className="backend-down" aria-labelledby="backend-down-heading">
      <p className="backend-down-eyebrow">Archive edition</p>
      <h1 id="backend-down-heading" className="backend-down-title">
        The desk is away
      </h1>
      <p className="backend-down-lead">It will come back again.</p>
      <p className="backend-down-body">
        We could not reach the archive just now. Check back in a moment — the
        paper will reopen when the press is online.
      </p>
      <button
        type="button"
        className="backend-down-retry"
        onClick={onRetry}
        disabled={retrying}
      >
        {retrying ? 'Checking…' : 'Try again'}
      </button>
    </section>
  )
}
