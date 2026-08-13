import { useEffect, useRef, useState } from 'react'

type StreamingAnswerProps = {
  text: string
}

type ParaItem = {
  id: number
  text: string
  visible: boolean
}

function splitParagraphs(text: string): { complete: string[]; pending: string } {
  if (!text) return { complete: [], pending: '' }

  // Prefer blank-line breaks; also treat a newline after sentence end as a break
  // so models that use single \n still reveal in chunks, not word-by-word.
  const normalized = text.replace(/\r\n/g, '\n')
  const chunks: string[] = []
  let buf = ''

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i]
    const next = normalized[i + 1]
    buf += ch

    const blankLine = ch === '\n' && next === '\n'
    const sentenceBreak =
      ch === '\n' &&
      next !== '\n' &&
      /[.!?]["')\]]?\s*$/.test(buf.slice(0, -1)) &&
      buf.trim().length > 80

    if (blankLine || sentenceBreak) {
      const para = buf.replace(/\n+$/, '').trim()
      if (para) chunks.push(para)
      buf = ''
      if (blankLine) i++ // skip second \n
    }
  }

  return { complete: chunks, pending: buf }
}

const FADE_MS = 480
const GAP_MS = 220

/** Reveals completed paragraphs one-by-one with opacity fade. */
export function StreamingAnswer({ text }: StreamingAnswerProps) {
  const { complete, pending } = splitParagraphs(text)
  const [items, setItems] = useState<ParaItem[]>([])
  const seenRef = useRef(0)
  const queueRef = useRef<string[]>([])
  const busyRef = useRef(false)
  const idRef = useRef(0)
  const endRef = useRef<HTMLDivElement>(null)
  const timersRef = useRef<number[]>([])

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => window.clearTimeout(t))
    }
  }, [])

  useEffect(() => {
    if (complete.length <= seenRef.current) return
    const fresh = complete.slice(seenRef.current)
    seenRef.current = complete.length
    queueRef.current.push(...fresh)
    pump()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete.length, text])

  function pump() {
    if (busyRef.current) return
    const next = queueRef.current.shift()
    if (!next) return

    busyRef.current = true
    const id = ++idRef.current

    setItems((prev) => [...prev, { id, text: next, visible: false }])

    // Next frame → trigger opacity transition
    const t1 = window.setTimeout(() => {
      setItems((prev) =>
        prev.map((p) => (p.id === id ? { ...p, visible: true } : p)),
      )
      requestAnimationFrame(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    }, 32)

    const t2 = window.setTimeout(() => {
      busyRef.current = false
      pump()
    }, FADE_MS + GAP_MS)

    timersRef.current.push(t1, t2)
  }

  const showPending =
    pending.trim().length > 0 && queueRef.current.length === 0 && !busyRef.current

  const waiting = items.length === 0 && !pending.trim()

  return (
    <div className="answer-body answer-stream" aria-live="polite">
      {items.map((p) => (
        <p
          key={p.id}
          className={`answer-stream-para${p.visible ? ' is-visible' : ''}`}
        >
          {p.text}
        </p>
      ))}

      {showPending && (
        <p className="answer-stream-para is-pending">
          {pending}
          <span className="answer-caret" aria-hidden />
        </p>
      )}

      {waiting && (
        <p className="answer-stream-waiting">
          <span className="answer-caret" aria-hidden />
          Writing…
        </p>
      )}

      <div ref={endRef} />
    </div>
  )
}
