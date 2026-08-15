import { Evaluation } from '../types';

interface EvaluationReportProps {
  evaluation: Evaluation;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-pixel text-[10px] text-white uppercase tracking-widest mb-3">{children}</h3>;
}

function BulletList({ items, color = 'cyan' }: { items: string[]; color?: 'cyan' | 'pink' | 'yellow' }) {
  if (!items.length) return null;
  const bulletColor = {
    cyan: 'bg-neon-cyan',
    pink: 'bg-neon-pink',
    yellow: 'bg-neon-yellow',
  }[color];
  return (
    <ul className="space-y-2">
      {items.map((item, idx) => (
        <li key={idx} className="flex items-start gap-3 text-sm text-slate-300">
          <span className={`mt-2 w-1.5 h-1.5 rounded-full ${bulletColor} flex-shrink-0`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function EvaluationReport({ evaluation }: EvaluationReportProps) {
  const categoryEntries = Object.entries(evaluation.category_scores || {});
  const maxCategory = categoryEntries.length ? Math.max(...categoryEntries.map(([, v]) => v)) : 0;

  const verdictColor =
    {
      OUTSTANDING: 'text-neon-yellow',
      EXCELLENT: 'text-neon-cyan',
      SATISFACTORY: 'text-neon-purple',
      'NEEDS WORK': 'text-neon-pink',
      'NOT ASSESSABLE': 'text-slate-500',
    }[evaluation.verdict] || 'text-slate-300';

  return (
    <div className="space-y-6">
      {/* Score header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-4 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Total Score</p>
          <p className="font-pixel text-xl text-neon-cyan">{evaluation.total_score}</p>
        </div>
        <div className="glass-panel p-4 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Percentage</p>
          <p className="font-pixel text-xl text-neon-purple">{evaluation.percentage.toFixed(1)}%</p>
        </div>
        <div className="glass-panel p-4 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Verdict</p>
          <p className={`font-pixel text-sm ${verdictColor} mt-1`}>{evaluation.verdict}</p>
        </div>
      </div>

      {/* Authenticity band */}
      <div className="glass-panel p-4 flex items-center justify-between">
        <span className="text-xs text-slate-400 uppercase tracking-wider">Authenticity band</span>
        <span className="px-3 py-1 rounded text-xs font-semibold bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20">
          {evaluation.authenticity_band}
        </span>
      </div>

      {/* Category score bar chart */}
      {categoryEntries.length > 0 && (
        <div className="glass-panel p-5">
          <SectionTitle>Category Scores</SectionTitle>
          <div className="space-y-3">
            {categoryEntries.map(([category, score]) => {
              const width = maxCategory > 0 ? (score / maxCategory) * 100 : 0;
              return (
                <div key={category}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">{category}</span>
                    <span className="text-neon-cyan font-semibold">{score}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-purple transition-all duration-500"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  {evaluation.category_explanations?.[category] && (
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      {evaluation.category_explanations[category]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Overall assessment */}
      {evaluation.overall_assessment && (
        <div className="glass-panel p-5">
          <SectionTitle>Overall Assessment</SectionTitle>
          <p className="text-sm text-slate-300 leading-relaxed">{evaluation.overall_assessment}</p>
        </div>
      )}

      {/* Strengths / improvements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {evaluation.key_strengths && evaluation.key_strengths.length > 0 && (
          <div className="glass-panel p-5">
            <SectionTitle>Key Strengths</SectionTitle>
            <BulletList items={evaluation.key_strengths} color="cyan" />
          </div>
        )}
        {evaluation.areas_for_improvement && evaluation.areas_for_improvement.length > 0 && (
          <div className="glass-panel p-5">
            <SectionTitle>Areas for Improvement</SectionTitle>
            <BulletList items={evaluation.areas_for_improvement} color="pink" />
          </div>
        )}
      </div>

      {/* Red flags */}
      {evaluation.red_flags && evaluation.red_flags.length > 0 && (
        <div className="glass-panel p-5 border border-neon-pink/30">
          <SectionTitle>Red Flags</SectionTitle>
          <BulletList items={evaluation.red_flags} color="pink" />
        </div>
      )}

      {/* Review flags from backend */}
      {evaluation.review_flags && evaluation.review_flags.length > 0 && (
        <div className="glass-panel p-5 border border-neon-yellow/30">
          <SectionTitle>Review Flags</SectionTitle>
          <BulletList items={evaluation.review_flags} color="yellow" />
        </div>
      )}

      {/* Recommendation */}
      {evaluation.recommendation && (
        <div className="glass-panel p-5">
          <SectionTitle>Recommendation</SectionTitle>
          <p className="text-sm text-slate-300 leading-relaxed">{evaluation.recommendation}</p>
        </div>
      )}

      {/* Suggested judge questions */}
      {evaluation.judge_questions && evaluation.judge_questions.length > 0 && (
        <div className="glass-panel p-5 border border-neon-purple/30">
          <SectionTitle>Suggested Judge Questions</SectionTitle>
          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300">
            {evaluation.judge_questions.map((q, idx) => (
              <li key={idx} className="pl-1">{q}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
