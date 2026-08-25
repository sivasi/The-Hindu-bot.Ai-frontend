import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../api'
import { exchangeGoogleIdToken, resolveGoogleClientId } from '../auth'
import type { AuthUser } from '../authTypes'

type GoogleCredentialResponse = {
  credential?: string
  select_by?: string
}

type GoogleAccountsId = {
  initialize: (config: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
    context?: string
  }) => void
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: string
      theme?: string
      size?: string
      text?: string
      shape?: string
      logo_alignment?: string
      width?: number
    },
  ) => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } }
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client'

function loadGisScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`)
  if (existing) {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts?.id) {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Sign-In')), {
        once: true,
      })
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Sign-In'))
    document.head.appendChild(script)
  })
}

type GoogleSignInProps = {
  onSignedIn: (user: AuthUser) => void
  onError?: (message: string) => void
  embed?: boolean
}

export function GoogleSignIn({ onSignedIn, onError, embed = false }: GoogleSignInProps) {
  const buttonRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const onSignedInRef = useRef(onSignedIn)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onSignedInRef.current = onSignedIn
  }, [onSignedIn])

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    let cancelled = false

    async function setup() {
      try {
        const clientId = await resolveGoogleClientId()
        await loadGisScript()
        if (cancelled || !buttonRef.current) return

        const googleId = window.google?.accounts?.id
        if (!googleId) {
          throw new Error('Google Identity Services unavailable.')
        }

        googleId.initialize({
          client_id: clientId,
          callback: async (response) => {
            const idToken = response.credential
            if (!idToken) {
              const msg = 'Google did not return an ID token.'
              setLocalError(msg)
              onErrorRef.current?.(msg)
              return
            }
            setBusy(true)
            setLocalError(null)
            try {
              const data = await exchangeGoogleIdToken(idToken)
              onSignedInRef.current(data.user)
            } catch (err) {
              const msg =
                err instanceof ApiError
                  ? err.message
                  : err instanceof Error
                    ? err.message
                    : 'Sign-in failed.'
              setLocalError(msg)
              onErrorRef.current?.(msg)
            } finally {
              setBusy(false)
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
          context: 'signin',
        })

        buttonRef.current.innerHTML = ''
        googleId.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 280,
        })
        if (!cancelled) setReady(true)
      } catch (err) {
        if (cancelled) return
        const msg =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Could not start Google Sign-In.'
        setLocalError(msg)
        onErrorRef.current?.(msg)
      }
    }

    void setup()
    return () => {
      cancelled = true
    }
  }, [])

  const button = (
    <>
      <div className={`auth-signin-wrap${!ready || busy ? ' auth-signin-wrap-busy' : ''}`}>
        <span className="auth-signin-btn" aria-hidden>
          {busy ? 'Signing in…' : ready ? 'Sign in with Google' : 'Loading…'}
        </span>
        <div ref={buttonRef} className="auth-signin-gis" />
      </div>

      {localError ? (
        <p className="auth-error" role="alert">
          {localError}
        </p>
      ) : null}
    </>
  )

  if (embed) {
    return (
      <div className="welcome-signin" aria-busy={busy || !ready}>
        {button}
      </div>
    )
  }

  return (
    <section className="auth-lead animate-fade-up" aria-busy={busy || !ready}>
      <p className="auth-eyebrow">Archive edition</p>
      <h2 className="auth-headline">Sign in to ask the paper</h2>
      <p className="auth-deck">
        Open the desk with Google — then type your question where the lead headline sits.
      </p>
      {button}
    </section>
  )
}
