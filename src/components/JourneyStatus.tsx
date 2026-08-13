type JourneyStatusProps = {
  message: string
}

/** Single live journey line — replaces previous status.message. */
export function JourneyStatus({ message }: JourneyStatusProps) {
  return (
    <p className="journey-status animate-fade-up" role="status" aria-live="polite">
      <span className="journey-pulse" aria-hidden />
      <span className="journey-text">{message}</span>
    </p>
  )
}
