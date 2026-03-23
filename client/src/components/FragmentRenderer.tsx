import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type {
  AnyFragment,
  ChartFragment,
  CodeFragment,
  DashboardFragment,
  ErrorFragment,
  MarkdownFragment,
  TableFragment,
} from '../types';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import { Terminal, Database, ShieldAlert, BarChart3, Presentation, ChevronDown, ChevronUp, Bookmark, Check, Loader2 } from 'lucide-react';

import { useState } from 'react';
import { api } from '../lib/appConfig';

interface Props {
  fragment: AnyFragment;
  connectionId?: string | null;
}


const CollapsibleWrapper: React.FC<{
    children: React.ReactNode;
    threshold: number;
    currentCount: number;
    label: string;
}> = ({ children, threshold, currentCount, label }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const shouldCollapse = currentCount > threshold;

    if (!shouldCollapse) return <>{children}</>;

    return (
        <div className="relative group/collapse">
            <div 
                className={`transition-all duration-500 ease-in-out relative flex flex-col ${
                    isExpanded ? 'max-h-1250' : 'max-h-100 overflow-hidden'
                }`}
            >
                {children}
                {!isExpanded && (
                    <div className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-[#0A0A0A] to-transparent pointer-events-none z-10" />
                )}
            </div>
            
            <div className="flex justify-center p-4 bg-[#0A0A0A] border-t border-white/5">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/3 hover:bg-white/8 text-white/60 hover:text-white transition-all text-xs font-bold uppercase tracking-widest border border-white/5 active:scale-95"
                >

                    {isExpanded ? (
                        <>
                            <ChevronUp size={14} className="text-[#F06543]" />
                            <span>Show Less</span>
                        </>
                    ) : (
                        <>
                            <ChevronDown size={14} className="text-[#F06543]" />
                            <span>View All {currentCount} {label}</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

// Handle potentially mismatched ESM/CJS imports in some environments
const HighchartsReactComp = (HighchartsReact as unknown as { default?: React.ComponentType<HighchartsReact.Props>; [key: string]: unknown }).default || 
                         (HighchartsReact as React.ComponentType<HighchartsReact.Props>);

export default function FragmentRenderer({ fragment, connectionId }: Props) {
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleSaveDashboard = async (name: string, fragments: AnyFragment[]) => {
        if (!connectionId || saving || saved) return;
        setSaving(true);
        try {
            await api.post('/dashboards/save', {
                connectionId,
                name: name || 'Untitled Dashboard',
                fragments,
                queries: [] // Can be extracted if needed
            });
            setSaved(true);
        } catch (err) {
            console.error('Failed to save dashboard:', err);
        } finally {
            setSaving(false);
        }
    };

    switch (fragment.type) {
        case 'md': {
            const markdownData = fragment.data as MarkdownFragment['data'];
            return (
                <div className="prose prose-sm prose-invert max-w-none text-[#BBB] leading-relaxed px-6 py-6 font-medium selection:bg-[#F06543]/30">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                        h1: ({...props}) => <h1 className="text-xl font-black text-white mb-4 mt-2 tracking-tight" {...props} />,
                        h2: ({...props}) => <h2 className="text-lg font-extrabold text-white mb-3 mt-4 tracking-tight" {...props} />,
                        h3: ({...props}) => <h3 className="text-md font-bold text-[#F06543] mb-2 mt-4 uppercase tracking-wider" {...props} />,
                        p: ({...props}) => <p className="mb-4 text-[#AAA] last:mb-0" {...props} />,
                        strong: ({...props}) => <strong className="text-white font-bold" {...props} />,
                        ul: ({...props}) => <ul className="list-disc pl-5 mb-4 space-y-2 text-[#999]" {...props} />,
                        code: ({...props}) => <code className="bg-[#222] text-[#F06543] px-1.5 py-0.5 rounded-md font-mono text-[13px]" {...props} />,
                    }}>
                        {markdownData.content}
                    </ReactMarkdown>
                </div>

            );
        }
        case 'table': {
            const tableData = fragment.data as TableFragment['data'];
            return (
                <div className="w-full">
                    <div className="flex items-center gap-2 px-6 py-4 border-b border-white/5 bg-[#151515]/50">
                        <Database size={15} className="text-[#F06543]" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#666]">Result Dataset</span>
                    </div>
                    <CollapsibleWrapper threshold={10} currentCount={tableData.rows.length} label="Rows">
                        <div className="overflow-x-auto bg-[#0A0A0A]">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/5 bg-[#111]">
                                        {tableData.columns.map((col: string) => (
                                            <th key={col} className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.25em] text-[#F06543]/80">
                                                {col.replace('_', ' ')}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/3">
                                    {tableData.rows.map((row: Record<string, unknown>, i: number) => (
                                        <tr key={i} className="hover:bg-white/2 transition-all duration-200 group">

                                            {tableData.columns.map((col: string) => (
                                                <td key={col} className="px-6 py-4 text-[13.5px] font-medium text-[#999] group-hover:text-white transition-colors tabular-nums">
                                                    {typeof row[col] === 'number' 
                                                      ? (row[col] as number).toLocaleString(undefined, { maximumFractionDigits: 2 }) 
                                                      : String(row[col] ?? '-')}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CollapsibleWrapper>
                    {tableData.rows.length === 0 && (
                        <div className="py-12 text-center text-[#444] font-medium text-sm">No results found in this dataset.</div>
                    )}
                </div>
            );

        }
        case 'code': {
            const codeData = fragment.data as CodeFragment['data'];
            const lines = codeData.code.split('\n');
            return (
                <div className="w-full">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#171717]">
                        <div className="flex items-center gap-2.5">
                            <Terminal size={15} className="text-[#F06543]" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#666]">SQL Engine Output</span>
                        </div>
                        <div className="flex gap-1.5">
                           <div className="w-2.5 h-2.5 rounded-full bg-red-500/20" />
                           <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20" />
                           <div className="w-2.5 h-2.5 rounded-full bg-green-500/20" />
                        </div>
                    </div>
                    <CollapsibleWrapper threshold={15} currentCount={lines.length} label="Lines of SQL">
                        <div className="flex font-mono text-[13.5px] leading-relaxed overflow-x-auto p-0 bg-[#0A0A0A]">
                            <div className="bg-[#0D0D0D] text-[#444] text-right py-6 px-4 select-none border-r border-white/5 shrink-0 opacity-50">
                                {lines.map((_, i) => (
                                <div key={i} className="h-6 leading-6">{(i + 1).toString().padStart(2, '0')}</div>
                                ))}
                            </div>
                            <div className="flex-1 py-6 px-6 overflow-x-auto">
                            <pre className="text-[#CCC] whitespace-pre font-mono selection:bg-[#F06543]/30">
                                {codeData.code}
                            </pre>
                            </div>
                        </div>
                    </CollapsibleWrapper>
                </div>
            );

        }
        case 'chart': {
            const chartData = fragment.data as ChartFragment['data'];
            const rawOptions = chartData.highchartOptions as Record<string, Record<string, unknown>>;
            
            const options = {
                ...rawOptions,
                chart: { ...((rawOptions.chart as Record<string, unknown>) || {}), backgroundColor: 'transparent' },
                title: { 
                    ...((rawOptions.title as Record<string, unknown>) || {}),
                    style: { color: '#ffffff', fontSize: '16px', fontWeight: 'bold' } 
                },
                legend: { ...((rawOptions.legend as Record<string, unknown>) || {}), itemStyle: { color: '#888888', fontWeight: 'bold' } },
                credits: { enabled: false },
                xAxis: { ...((rawOptions.xAxis as Record<string, unknown>) || {}), labels: { style: { color: '#666' } }, gridLineWidth: 0, lineWidth: 0 },
                yAxis: { ...((rawOptions.yAxis as Record<string, unknown>) || {}), labels: { style: { color: '#666' } }, gridLineColor: '#222' }
            };

            return (
                <div className="w-full">
                     <div className="flex items-center gap-2 px-6 py-4 border-b border-white/5 bg-[#151515]/50">
                        <BarChart3 size={15} className="text-[#F06543]" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#666]">Visual Insight Analytics</span>
                    </div>
                    <div className="p-8 bg-[#0D0D0D]">
                        <HighchartsReactComp highcharts={Highcharts} options={options} />
                    </div>
                </div>
            );
        }

        case 'dashboard': {
             const dashboardData = fragment.data as DashboardFragment['data'];
            return (
                <div className="w-full group">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#1A1A1A]">
                        <div className="flex items-center gap-2">
                             <Presentation size={15} className="text-[#F06543]" />
                             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#888]">Comprehensive Analytics Dashboard</span>
                        </div>
                        {connectionId && (
                           <button 
                             onClick={() => handleSaveDashboard((fragment as { name?: string }).name || 'Dashboard', dashboardData.fragments)}
                             disabled={saving || saved}

                             className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                               saved 
                               ? 'bg-green-500/10 text-green-500 cursor-default' 
                               : 'bg-white/5 hover:bg-[#F06543]/20 text-[#666] hover:text-[#F06543] active:scale-95'
                             }`}
                           >
                             {saved ? <Check size={12} /> : saving ? <Loader2 size={12} className="animate-spin" /> : <Bookmark size={12} />}
                             {saved ? 'Saved!' : saving ? 'Saving...' : 'Save to Library'}
                           </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8 bg-[#080808]">
                        {dashboardData.fragments.map((subFrag: AnyFragment, idx: number) => (
                            <div key={idx} className="overflow-hidden rounded-2xl border border-white/5 bg-[#111] shadow-2xl transition-transform duration-300 hover:scale-[1.01]">
                                <FragmentRenderer fragment={subFrag} connectionId={connectionId} />
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        case 'error': {
            const errorData = fragment.data as ErrorFragment['data'];
            return (
                <div className="w-full flex items-center gap-5 p-8 bg-red-500/4 border-l-4 border-red-500/60 selection:bg-red-500/20 animate-in fade-in slide-in-from-left-4 duration-500">
                    <div className="h-12 w-12 shrink-0 rounded-2xl bg-red-500/10 flex items-center justify-center shadow-lg">
                        <ShieldAlert size={24} className="text-red-500/80" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500/50">Execution Failure</span>
                        <p className="text-sm font-bold text-red-100 leading-relaxed">{errorData.message}</p>
                    </div>
                </div>
            );
        }
        default:
            return <div className="text-zinc-600 text-[10px] uppercase font-bold tracking-widest p-8 italic bg-[#0A0A0A]">Unrecognized fragment artifact</div>;
    }
}


