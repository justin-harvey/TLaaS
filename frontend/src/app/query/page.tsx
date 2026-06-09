'use client';
import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Terminal, Play, Lightbulb, ChevronRight, Download } from 'lucide-react';
import { Card, Button, Badge, Input } from '@/components/cc';
import { queryNL, querySQL } from '@/lib/api';
import { fmtUSD } from '@/lib/utils';
import type { QuerySQLResponse } from '@/types';

// Monaco loaded client-side only (no SSR)
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false, loading: () => (
  <div className="flex items-center justify-center h-[200px] bg-[#ECE2CE] rounded-xs text-muted text-sm">Loading editor…</div>
)});

type Mode    = 'nl' | 'sql';
type ResView = 'table' | 'json';

const EXAMPLES = [
  'Top 5 vendors by total spend this month',
  'Show anomalous payments over $10,000',
  'Utilities spend by department, last 3 months',
];

export default function QueryPage() {
  const [mode, setMode]           = useState<Mode>('nl');
  const [nlInput, setNlInput]     = useState('');
  const [generatedSQL, setSQL]    = useState('');
  const [sqlInput, setSqlInput]   = useState('');
  const [step, setStep]           = useState<'idle'|'translating'|'ready'|'running'|'done'>('idle');
  const [result, setResult]       = useState<QuerySQLResponse | null>(null);
  const [view, setView]           = useState<ResView>('table');

  const translate = async () => {
    if (!nlInput.trim()) return;
    setStep('translating'); setSQL(''); setResult(null);
    const r = await queryNL(nlInput);
    setSQL(r.sql);
    setStep('ready');
  };

  const runSQL = async (sql: string) => {
    setStep('running'); setResult(null);
    const r = await querySQL(sql);
    setResult(r); setStep('done');
  };

  const activeSQL = mode === 'sql' ? sqlInput : generatedSQL;

  return (
    <div className="max-w-[1100px] mx-auto space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="type-label mb-1">Analytics</p>
          <h1 className="type-h1">Query Terminal</h1>
        </div>
        {/* Mode toggle */}
        <div className="flex bg-[#ECE2CE] rounded-sm p-0.5 gap-0.5">
          {(['nl','sql'] as Mode[]).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-3 py-1 rounded-xs text-[12px] font-semibold transition-all duration-[120ms] ${mode===m ? 'bg-[#FBF7EE] text-ink shadow-xs' : 'text-muted hover:text-ink-soft'}`}>
              {m === 'nl' ? 'Natural Language' : 'SQL'}
            </button>
          ))}
        </div>
      </div>

      {/* NL mode */}
      {mode === 'nl' && (
        <Card eyebrow="Ask a question" title="Natural Language Query">
          <div className="space-y-4">
            <div className="flex gap-3">
              <Input placeholder="e.g. Show me vendor spend over $10K flagged as anomalous"
                value={nlInput} onChange={e => setNlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && translate()}
                icon={<Terminal size={14} />} wrapStyle={{ flex: 1 }} />
              <Button onClick={translate} disabled={!nlInput.trim() || step === 'translating'}
                icon={step === 'translating' ? undefined : <ChevronRight size={13} />}>
                {step === 'translating' ? 'Translating…' : 'Translate'}
              </Button>
            </div>
            {/* Example chips */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="type-label">Try:</span>
              {EXAMPLES.map(ex => (
                <button key={ex} onClick={() => setNlInput(ex)}
                  className="text-[12px] text-blue-500 border border-blue-300/50 rounded-xs px-2.5 py-1 hover:bg-[#DCE6F2]/50 transition-colors bg-[#DCE6F2]/30">
                  {ex}
                </button>
              ))}
            </div>

            {/* AI translation flow */}
            {(step === 'ready' || step === 'running' || step === 'done') && (
              <div className="space-y-3 border-t border-[#DDD3BE] pt-4">
                <div className="flex items-center gap-2">
                  <Lightbulb size={14} className="text-[#C79A3E]" />
                  <span className="text-[12px] text-muted">Generated SQL — review before running</span>
                  <Badge tone="info" dot={false} style={{ fontSize: 10 }}>AI translation</Badge>
                </div>
                <pre className="text-[13px] font-mono bg-[#ECE2CE] rounded-xs p-4 text-ink overflow-auto">
                  {generatedSQL}
                </pre>
                <Button onClick={() => runSQL(generatedSQL)} disabled={step === 'running'}
                  icon={<Play size={13} />}>
                  {step === 'running' ? 'Running…' : 'Run this query'}
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* SQL mode */}
      {mode === 'sql' && (
        <Card eyebrow="Direct query" title="SQL Editor" padded={false}>
          <div className="border-b border-[#DDD3BE]">
            <MonacoEditor
              height={220}
              language="sql"
              value={sqlInput}
              onChange={v => setSqlInput(v || '')}
              theme="light"
              options={{ fontSize: 13, fontFamily: '"IBM Plex Mono", monospace', minimap: { enabled: false }, lineNumbers: 'on', scrollBeyondLastLine: false, padding: { top: 12 } }}
            />
          </div>
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-[12px] text-muted font-mono">Read-only sandbox — SELECT only</span>
            <Button size="sm" icon={<Play size={12} />} onClick={() => runSQL(sqlInput)} disabled={!sqlInput.trim() || step === 'running'}>
              {step === 'running' ? 'Running…' : 'Run'}
            </Button>
          </div>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card eyebrow="Query results" title={`${result.meta.rowCount} rows · ${result.meta.ms}ms`}
          actions={
            <div className="flex items-center gap-2">
              {(['table','json'] as ResView[]).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-xs transition-colors ${view===v ? 'bg-blue-100 text-blue-600' : 'text-muted hover:text-ink'}`}>
                  {v.toUpperCase()}
                </button>
              ))}
              <Button size="sm" variant="ghost" icon={<Download size={12} />}>Export</Button>
            </div>
          }>
          {view === 'table' ? (
            <div className="overflow-x-auto -mx-4 -mb-4">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#C6B99E] bg-[#ECE2CE]">
                    {result.columns.map(c => (
                      <th key={c} className="px-4 py-2 text-left type-label">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-[#DDD3BE] hover:bg-[#D7E1EF]/30">
                      {(row as unknown[]).map((cell, ci) => (
                        <td key={ci} className="px-4 py-2 font-mono text-ink-soft tabular-nums">
                          {typeof cell === 'number' ? fmtUSD(cell) : String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <pre className="text-[12px] font-mono bg-[#ECE2CE] rounded-xs p-3 overflow-auto max-h-64">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
          {result.meta.fingerprintVerified && (
            <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-[#DDD3BE]">
              <Badge tone="anchored" dot>Fingerprint verified</Badge>
              <span className="text-[11px] text-muted">Result set matches on-chain anchor</span>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
