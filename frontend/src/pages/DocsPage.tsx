import PageLayout from '../components/PageLayout';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-panel p-6 mb-6">
      <h2 className="font-pixel text-xs text-neon-cyan mb-3">{title}</h2>
      <div className="text-sm text-slate-300 leading-relaxed space-y-3">{children}</div>
    </div>
  );
}

export default function DocsPage() {
  return (
    <PageLayout className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="font-pixel text-lg text-white text-shadow-neon mb-2">HOW IT WORKS</h1>
          <p className="text-slate-400 text-sm">A simple guide to running and competing in a ZECATHON hackathon.</p>
        </div>

        <Section title="For Organisers">
          <p>
            Create a hackathon, upload your problem statements, and invite teams. You can set custom scoring rubrics or use the platform defaults.
          </p>
          <p>
            Once submissions are in, judges can trigger AI evaluation for tech (GitHub) and non-tech (documents) projects in one click.
          </p>
        </Section>

        <Section title="For Participants">
          <p>Join or create a team, pick the problem statement you want to solve, and submit your project before the deadline.</p>
          <p>
            <strong className="text-white">Tech tracks:</strong> submit a public GitHub repository link. Add an optional PPT if you have one.
          </p>
          <p>
            <strong className="text-white">Non-tech tracks:</strong> upload your PDF, DOCX, PPTX, or XLSX document. You can also add a supporting GitHub link or PPT.
          </p>
        </Section>

        <Section title="For Judges">
          <p>
            Review the leaderboard, inspect evaluation reports, and use the suggested judge questions to guide your final Q&A with each team.
          </p>
          <p>If a submission looks off, you can retry the evaluation or override scores manually in your own records.</p>
        </Section>

        <Section title="Live Leaderboards">
          <p>
            Every hackathon gets a public leaderboard link you can share. Scores are automatically spread out so no two teams accidentally tie.
          </p>
        </Section>
      </div>
    </PageLayout>
  );
}
