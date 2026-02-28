import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { streamDDChat, streamDDReport } from '../api/client'
import type { ChatMessage } from '../types/api'

type ReportStatus = 'idle' | 'streaming' | 'done' | 'error'

interface Props {
  ticker: string
}

export default function StockTab({ ticker }: Props) {
  const [reportText, setReportText] = useState('')
  const [reportStatus, setReportStatus] = useState<ReportStatus>('idle')
  const [reportError, setReportError] = useState<string | null>(null)
  // messages holds the full conversation: [assistantReport, userQ1, assistantA1, ...]
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatStreaming, setChatStreaming] = useState(false)
  const [pendingAnswer, setPendingAnswer] = useState('')

  const abortReportRef = useRef<(() => void) | null>(null)
  const abortChatRef = useRef<(() => void) | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-start report on mount
  useEffect(() => {
    startReport()
    return () => {
      abortReportRef.current?.()
      abortChatRef.current?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scroll chat to bottom when new content arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pendingAnswer])

  function startReport() {
    abortReportRef.current?.()
    setReportText('')
    setReportStatus('streaming')
    setReportError(null)
    setMessages([])

    let accumulated = ''

    abortReportRef.current = streamDDReport(
      ticker,
      (chunk) => {
        accumulated += chunk
        setReportText((prev) => prev + chunk)
      },
      () => {
        setReportStatus('done')
        // Store the completed report as the first assistant message
        setMessages([{ role: 'assistant', content: accumulated }])
      },
      (err) => {
        setReportStatus('error')
        setReportError(err)
      },
    )
  }

  function sendChat() {
    const text = chatInput.trim()
    if (!text || chatStreaming) return

    setChatInput('')
    const userMsg: ChatMessage = { role: 'user', content: text }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setChatStreaming(true)
    setPendingAnswer('')

    let accumulated = ''

    abortChatRef.current = streamDDChat(
      ticker,
      updatedMessages,
      (chunk) => {
        accumulated += chunk
        setPendingAnswer((prev) => prev + chunk)
      },
      () => {
        setChatStreaming(false)
        setPendingAnswer('')
        setMessages((prev) => [...prev, { role: 'assistant', content: accumulated }])
      },
      (err) => {
        setChatStreaming(false)
        setPendingAnswer('')
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `_Error: ${err}_` },
        ])
      },
    )
  }

  function handleChatKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendChat()
    }
  }

  // Chat messages excluding the first assistant message (the report itself)
  const chatHistory = messages.slice(1)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Report section */}
      <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-800">
            Due Diligence: <span className="text-blue-700">{ticker}</span>
          </h2>
          <button
            type="button"
            onClick={startReport}
            disabled={reportStatus === 'streaming'}
            className="text-xs px-3 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Regenerate
          </button>
        </div>

        {reportStatus === 'streaming' && !reportText && (
          <div className="flex items-center gap-2 text-gray-400 text-sm mt-8">
            <span className="animate-pulse">●●●</span>
            <span>Generating report…</span>
          </div>
        )}

        {reportStatus === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
            <p className="font-semibold text-red-700 mb-1">Report failed</p>
            <p className="text-red-600">{reportError}</p>
            <button
              type="button"
              onClick={startReport}
              className="mt-2 text-xs text-red-700 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {reportText && (
          <div className="prose prose-sm max-w-none text-gray-800">
            <ReactMarkdown>{reportText}</ReactMarkdown>
            {reportStatus === 'streaming' && (
              <span className="inline-block w-2 h-4 ml-0.5 bg-blue-500 animate-pulse rounded-sm align-middle" />
            )}
          </div>
        )}
      </div>

      {/* Chat section — only shown after report is done */}
      {reportStatus === 'done' && (
        <div className="border-t border-gray-200 flex flex-col max-h-[45%] min-h-[220px]">
          {/* Chat history */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {chatHistory.map((msg, i) => {
              const isUser = msg.role === 'user'
              return (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: stable list, append-only
                  key={i}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                    }`}
                  >
                    {isUser ? (
                      msg.content
                    ) : (
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Streaming answer */}
            {chatStreaming && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-xl rounded-bl-sm px-3 py-2 text-sm bg-gray-100 text-gray-800">
                  {pendingAnswer ? (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{pendingAnswer}</ReactMarkdown>
                    </div>
                  ) : (
                    <span className="text-gray-400 animate-pulse">●●●</span>
                  )}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-gray-100">
            <div className="flex gap-2 items-end">
              <textarea
                ref={chatInputRef}
                data-testid={`dd-chat-input-${ticker}`}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleChatKeyDown}
                placeholder="Ask a follow-up question… (Enter to send, Shift+Enter for newline)"
                rows={2}
                disabled={chatStreaming}
                className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
              />
              <button
                type="button"
                onClick={sendChat}
                disabled={!chatInput.trim() || chatStreaming}
                className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
