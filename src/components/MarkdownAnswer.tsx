import ReactMarkdown from 'react-markdown'

type MarkdownAnswerProps = {
  content: string
}

export function MarkdownAnswer({ content }: MarkdownAnswerProps) {
  return (
    <div className="answer-body">
      <ReactMarkdown
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
