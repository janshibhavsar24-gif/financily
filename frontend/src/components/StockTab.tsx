import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { streamDDChat, streamDDReport } from '../api/client'
import type { ChatMessage } from '../types/api'

interface Props {
  ticker: string
  // Persisted messages (survives tab switch); first entry is the full report as assistant msg
  initialMessages: ChatMessage[]
  onMessagesChange: (messages: ChatMessage[]) => void
}

type ReportStatus = 'streaming' | 'done' | 'error'

export default function StockTab({ ticker, initialMessages, onMessagesChange }: Props) {
  // If we already have messages (tab was visited before), start in 'done' state
  const hasExisting = initialMessages.length > 0
  const [reportText, setReportText] = useState(
    hasExisting ? (initialMessages[0]?.content ?? '') : '',
  )
  const [reportStatus, setReportStatus] = useState<ReportStatus>(
    hasExisting ? 'done' : 'streaming',
  )
  const [reportError, setReportError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [chatInput, setChatInput] = useState('')
  const [chatStreaming, setChatStreaming] = useState(false)

  const abortRef = useRef<(() => void) | null>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const reportAccRef = useRef('')  // accumulator to avoid stale closure

  // Stream the report when first opened (no existing messages)
  useEffect(() => {
    if (hasExisting) return

    reportAccRef.current = ''
    setReportText('')
    setReportStatus('streaming')
    setReportError(null)

    const abort = streamDDReport(
      ticker,
      (chunk) => {
        reportAccRef.current += chunk
        setReportText(reportAccRef.current)
      },
      (_tokens) => {
        const fullText = reportAccRef.current
        const finalMessages: ChatMessage[] = [{ role: 'assistant', content: fullText }]
        setMessages(finalMessages)
        setReportStatus('done')
        onMessagesChange(finalMessages)
      },
      (msg) => {
        setReportStatus('error')
        setReportError(msg)
      },
    )
    abortRef.current = abort
    return () => {
      abortRef.current?.()
    }
  // Run once on mount only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync messages to parent whenever they change
  useEffect(() => {
    onMessagesChange(messages)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  // Scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatStreaming])

  function handleRegenerate() {
    abortRef.current?.()
    reportAccRef.current = ''
    setReportText('')
    setReportStatus('streaming')
    setReportError(null)
    setMessages([])
    onMessagesChange([])

    const abort = streamDDReport(
      ticker,
      (chunk) => {
        reportAccRef.current += chunk
        setReportText(reportAccRef.current)
      },
      (_tokens) => {
        const fullText = reportAccRef.current
        const finalMessages: ChatMessage[] = [{ role: 'assistant', content: fullText }]
        setMessages(finalMessages)
        setReportStatus('done')
        onMessagesChange(finalMessages)
      },
      (msg) => {
        setReportStatus('error')
        setReportError(msg)
      },
    )
    abortRef.current = abort
  }

  function handleSendChat() {
    const text = chatInput.trim()
    if (!text || chatStreaming) return
    setChatInput('')

    const userMsg: ChatMessage = { role: 'user', content: text }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setChatStreaming(true)

    let assistantAcc = ''

    const abort = streamDDChat(
      ticker,
      updatedMessages,
      (chunk) => {
        assistantAcc += chunk
        setMessages([...updatedMessages, { role: 'assistant', content: assistantAcc }])
      },
      () => {
        const final: ChatMessage[] = [...updatedMessages, { role: 'assistant' as const, content: assistantAcc }]
        setMessages(final)
        setChatStreaming(false)
      },
      (msg) => {
        setMessages([...updatedMessages, { role: 'assistant', content: `_Error: ${msg}_` }])
        setChatStreaming(false)
      },
    )
    abortRef.current = abort
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Report section */}
      <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-800">
            Due Diligence — {ticker}
          </h2>
          {(reportStatus === 'done' || reportStatus === 'error') && (
            <button
              type="button"
              onClick={handleRegenerate}
              className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-2 py-1 rounded"
            >
              Regenerate
            </button>
          )}
        </div>

        {reportStatus === 'error' && reportError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
            <p className="text-sm font-semibold text-red-700 mb-1">Failed to generate report</p>
            <p className="text-sm text-red-600">{reportError}</p>
            <button
              type="button"
              onClick={handleRegenerate}
              className="mt-2 text-xs text-red-700 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {(reportStatus === 'streaming' || reportStatus === 'done') && reportText && (
          <div className="prose prose-sm max-w-none text-gray-800">
            <ReactMarkdown>{reportText}</ReactMarkdown>
            {reportStatus === 'streaming' && (
              <span className="inline-flex gap-0.5 ml-1 align-middle">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </span>
            )}
          </div>
        )}

        {reportStatus === 'streaming' && !reportText && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="inline-flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
            <span>Generating report…</span>
          </div>
        )}
      </div>

      {/* Chat section — visible once report is done */}
      {reportStatus === 'done' && (
        <div className="border-t border-gray-200 flex flex-col flex-shrink-0">
          {/* Message history (conversations after the initial report) */}
          {messages.length > 1 && (
            <div
              className="overflow-y-auto px-4 py-3 space-y-3"
              style={{ maxHeight: '220px' }}
            >
              {messages.slice(1).map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-sm lg:max-w-lg px-3 py-2 rounded-lg text-sm ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              {chatStreaming && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 px-3 py-2 rounded-lg">
                    <span className="inline-flex gap-0.5">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="inline-block w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </span>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>
          )}

          {/* Input */}
          <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
            <textarea
              data-testid={`dd-chat-input-${ticker}`}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendChat()
                }
              }}
              placeholder="Ask a follow-up question… (Enter to send)"
              rows={2}
              disabled={chatStreaming}
              className="flex-1 text-sm border border-gray-300 rounded px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleSendChat}
              disabled={!chatInput.trim() || chatStreaming}
              className="px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed self-end"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
