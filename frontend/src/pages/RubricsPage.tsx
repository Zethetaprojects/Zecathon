import PageLayout from '../components/PageLayout';

function Category({ name, max, desc }: { name: string; max: number; desc: string }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 py-3 border-b border-white/10 last:border-0">
      <div className="sm:w-48 flex-shrink-0">
        <p className="text-sm font-semibold text-white">{name}</p>
        <p className="text-xs text-neon-cyan">{max} points</p>
      </div>
      <p className="text-sm text-slate-400">{desc}</p>
    </div>
  );
}

export default function RubricsPage() {
  return (
    <PageLayout className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="font-pixel text-lg text-white text-shadow-neon mb-2">EVALUATOR RUBRICS</h1>
          <p className="text-slate-400 text-sm">
            These are the default categories. Organisers can override them when creating a hackathon.
          </p>
        </div>

        <div className="glass-panel p-6 mb-6">
          <h2 className="font-pixel text-xs text-neon-cyan mb-4">TECH PROJECTS (1000 POINTS)</h2>
          <Category name="Problem Understanding" max={150} desc="Does the code address the problem statement and use the right domain logic?" />
          <Category name="Implementation Completeness" max={200} desc="Are required features implemented and working?" />
          <Category name="Code Quality & Architecture" max={150} desc="Clean structure, separation of concerns, and maintainability." />
          <Category name="Innovation & Creativity" max={150} desc="Original features, creative solutions, and standout ideas." />
          <Category name="Technical Feasibility" max={100} desc="Can the project realistically run and scale?" />
          <Category name="Documentation" max={100} desc="README, setup instructions, comments, and API docs." />
          <Category name="Commit Authenticity / Effort" max={100} desc="Commit history showing genuine work over time." />
          <Category name="Presentation / Demo" max={50} desc="Screenshots, demo links, and UI polish." />
        </div>

        <div className="glass-panel p-6 mb-6">
          <h2 className="font-pixel text-xs text-neon-cyan mb-4">NON-TECH PROJECTS (1000 POINTS)</h2>
          <Category name="Problem-Specific Grounding" max={150} desc="Engagement with the specific problem context and friction." />
          <Category name="Reasoning & Judgment" max={200} desc="Visible trade-offs, alternatives considered, and rationale." />
          <Category name="Evidence & Verification" max={150} desc="Real, checkable evidence and data." />
          <Category name="Solution Effectiveness" max={150} desc="Does the proposal actually solve the problem?" />
          <Category name="Feasibility & Practicality" max={100} desc="Realistic implementation plan for the context." />
          <Category name="Communication of Thought" max={100} desc="Clarity of thinking, not just polished prose." />
          <Category name="Originality of Synthesis" max={150} desc="Original connections, framing, and insights." />
        </div>

        <div className="glass-panel p-6">
          <h2 className="font-pixel text-xs text-neon-cyan mb-3">VERDICT BANDS</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm text-slate-300">
            <div className="text-center p-3 rounded bg-white/5">
              <p className="font-semibold text-neon-cyan">850-1000</p>
              <p className="text-xs text-slate-400">Outstanding</p>
            </div>
            <div className="text-center p-3 rounded bg-white/5">
              <p className="font-semibold text-neon-cyan">700-849</p>
              <p className="text-xs text-slate-400">Excellent</p>
            </div>
            <div className="text-center p-3 rounded bg-white/5">
              <p className="font-semibold text-neon-cyan">500-699</p>
              <p className="text-xs text-slate-400">Satisfactory</p>
            </div>
            <div className="text-center p-3 rounded bg-white/5">
              <p className="font-semibold text-neon-cyan">0-499</p>
              <p className="text-xs text-slate-400">Needs Work</p>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
