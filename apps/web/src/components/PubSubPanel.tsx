import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULTS } from '../config'
import { publish as pubsubPublish, subscribe as pubsubSubscribe, isEnabled as pubsubEnabled } from '../services/pubsub'

export default function PubSubPanel() {
  const [topic, setTopic] = useState<string>(DEFAULTS.topic)
  const [message, setMessage] = useState<string>('hello world')
  const [logs, setLogs] = useState<string[]>([])
  const enabled = useMemo(() => pubsubEnabled(), [])
  const subRef = useRef<{ unsubscribe: () => void } | null>(null)

  useEffect(() => {
    if (!enabled) return
    const sub = pubsubSubscribe(
      { topic },
      (data) => setLogs((l) => [JSON.stringify(data), ...l]),
      (err) => setLogs((l) => [String(err), ...l])
    )
    subRef.current = sub
    return () => {
      try { subRef.current?.unsubscribe?.() } catch {}
    }
  }, [enabled, topic])

  const onPublish = async () => {
    if (!enabled) return
    await pubsubPublish({ topic, message })
    setLogs((l) => [`[local] publish -> ${topic}: ${typeof message === 'string' ? message : JSON.stringify(message)}`, ...l])
  }

  if (!enabled) return null

  return (
    <div className="mt-6 space-y-3">
      <div className="flex flex-col gap-2 md:flex-row">
        <input
          className="w-full rounded-md border px-3 py-2"
          placeholder="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
        <input
          className="w-full rounded-md border px-3 py-2"
          placeholder="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button className="btn btn-primary" onClick={onPublish}>
          Publish
        </button>
      </div>
      <div className="card">
        <div className="mb-2 text-sm font-semibold">Logs</div>
        <div className="max-h-64 space-y-1 overflow-auto text-xs">
          {logs.map((l, i) => (
            <pre key={i} className="whitespace-pre-wrap">{l}</pre>
          ))}
        </div>
      </div>
    </div>
  )
}
