import { motion } from 'framer-motion';
import {
  ArrowRight,
  Bot,
  ChartColumnBig,
  ChevronRight,
  GitBranch,
  LineChart,
  Lock,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Table2,
} from 'lucide-react';
import type { Transition, Variants } from 'framer-motion';
import {
  chatMessages,
  dashboardCards,
  features,
  footerLinks,
  heroOrbitIcons,
  metrics,
  navLinks,
  painPoints,
  solutionFeatures,
  sqlPreview,
  steps,
} from './data/content.ts';
import { SectionHeading } from './components/SectionHeading.tsx';

const easeOut: Transition['ease'] = [0.22, 1, 0.36, 1];
const easeInOut: Transition['ease'] = [0.65, 0, 0.35, 1];

const sectionReveal: Variants = {
  hidden: { opacity: 0, y: 32 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: easeOut,
      staggerChildren: 0.12,
    },
  },
};

const itemReveal: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: easeOut } },
};

function App() {
  const productLink = 'https://velora-by-ambuj.vercel.app/';

  return (
    <div className="page-shell">
      <div className="page-glow page-glow-left" />
      <div className="page-glow page-glow-right" />

      <header className="topbar">
        <a className="brand" href="#hero">
          <span className="brand-mark" aria-hidden="true">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v2" />
              <path d="M12 20v2" />
              <path d="m4.93 4.93 1.41 1.41" />
              <path d="m17.66 17.66 1.41 1.41" />
              <path d="M2 12h2" />
              <path d="M20 12h2" />
              <path d="m6.34 17.66-1.41 1.41" />
              <path d="m19.07 4.93-1.41 1.41" />
            </svg>
          </span>
          <span>Velora</span>
        </a>

        <nav className="topnav" aria-label="Primary">
          {navLinks.map((link) => (
            <a key={link.label} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <a className="nav-cta" href={productLink} target="_blank" rel="noreferrer">
          Try Velora
        </a>
      </header>

      <main>
        <section className="hero section" id="hero">
          <motion.div
            className="hero-copy"
            initial="hidden"
            animate="show"
            variants={sectionReveal}
          >
            <motion.span className="pill" variants={itemReveal}>
              Chat-first analytics for modern teams
            </motion.span>
            <motion.h1 variants={itemReveal}>AI that understands your data</motion.h1>
            <motion.p variants={itemReveal}>
              Ask questions, get insights, build dashboards instantly.
            </motion.p>

            <motion.div className="hero-actions" variants={itemReveal}>
              <a className="button primary" href={productLink} target="_blank" rel="noreferrer">
                Get Started
                <ArrowRight size={18} />
              </a>
              <a className="button secondary" href="#showcase">
                <PlayCircle size={18} />
                View Demo
              </a>
            </motion.div>

            <motion.div className="hero-metrics" variants={itemReveal}>
              {metrics.map((metric) => (
                <div className="metric-card" key={metric.label}>
                  <strong>{metric.value}</strong>
                  <span>{metric.label}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>

          <motion.div
            className="hero-visual"
            initial={{ opacity: 0, x: 48 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: easeOut, delay: 0.15 }}
          >
            <div className="orbit">
              {heroOrbitIcons.map((Icon, index) => (
                <motion.div
                  className={`orbit-node orbit-node-${index + 1}`}
                  key={index}
                  animate={{ y: [0, -10, 0], rotate: [0, 4, 0] }}
                  transition={{ duration: 5 + index, repeat: Infinity, ease: easeInOut }}
                >
                  <Icon size={18} />
                </motion.div>
              ))}
            </div>

            <div className="visual-panel">
              <div className="visual-topline">
                <span className="status-dot" />
                <span>Velora session</span>
              </div>

              <div className="chat-card">
                {chatMessages.map((message) => (
                  <motion.div
                    className={`chat-bubble ${message.role}`}
                    key={message.text}
                    initial={{ opacity: 0, x: message.role === 'user' ? 24 : -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, ease: easeOut }}
                  >
                    <span>{message.role === 'user' ? 'You' : 'Velora'}</span>
                    <p>{message.text}</p>
                  </motion.div>
                ))}
              </div>

              <motion.div
                className="dashboard-mini"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4.4, repeat: Infinity, ease: easeInOut }}
              >
                <div className="dashboard-mini-header">
                  <LineChart size={18} />
                  <span>Instant workspace</span>
                </div>
                <div className="sparkline-bars">
                  {[48, 70, 54, 88, 76, 95, 81].map((height, index) => (
                    <motion.span
                      key={index}
                      style={{ height: `${height}%` }}
                      initial={{ scaleY: 0.2 }}
                      animate={{ scaleY: 1 }}
                      transition={{ duration: 0.55, delay: 0.2 + index * 0.08 }}
                    />
                  ))}
                </div>
              </motion.div>
            </div>
          </motion.div>
        </section>

        <section className="section section-split problem-section">
          <SectionHeading
            eyebrow="Why teams get stuck"
            title="Analytics workflows still ask too much from the wrong people"
            description="Business teams want answers now, but the path from question to trusted insight is still slow, technical, and fragmented."
          />

          <motion.div
            className="problem-grid"
            variants={sectionReveal}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
          >
            {painPoints.map((point, index) => (
              <motion.article className="glass-card problem-card" key={point} variants={itemReveal}>
                <span className="problem-index">0{index + 1}</span>
                <p>{point}</p>
              </motion.article>
            ))}
          </motion.div>
        </section>

        <section className="section solution-section" id="solution">
          <div className="solution-copy">
            <motion.div
              className="solution-badge"
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, ease: easeOut }}
            >
              <span className="solution-badge-dot">
                <span />
              </span>
              <span>The Velora Difference</span>
            </motion.div>

            <motion.h2
              className="solution-title"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, ease: easeOut }}
            >
              A chat-first interface built for <span>questions</span>, not maintenance.
            </motion.h2>

            <motion.p
              className="solution-lead"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, ease: easeOut, delay: 0.08 }}
            >
              Velora turns intent into queries, results, and shareable dashboards so the whole company can move from curiosity to action in one seamless flow.
            </motion.p>

            <motion.div
              className="solution-feature-list"
              variants={sectionReveal}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
            >
              {solutionFeatures.map((feature) => {
                const Icon = feature.icon;

                return (
                  <motion.div className="solution-feature-row" key={feature.title} variants={itemReveal}>
                    <div className="solution-feature-icon">
                      <Icon size={16} />
                    </div>
                    <div>
                      <h3>{feature.title}</h3>
                      <p>{feature.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>

          <motion.div
            className="solution-mockup-wrap"
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.7, ease: easeOut }}
          >
            <div className="solution-floating-pill glass-card">
              <div className="solution-floating-avatar">AI</div>
              <p>Found 3 trends in revenue growth...</p>
            </div>

            <div className="glass-card solution-mockup">
              <div className="solution-mockup-header">
                <div className="solution-window-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="solution-window-label">velora-workspace-v1</div>
              </div>

              <div className="solution-mockup-body">
                <div className="solution-mockup-sidebar">
                  <div className="solution-side-icon active">
                    <Bot size={18} />
                  </div>
                  <div className="solution-side-icon">
                    <ChartColumnBig size={18} />
                  </div>
                  <div className="solution-side-icon">
                    <Table2 size={18} />
                  </div>
                </div>

                <div className="solution-mockup-main">
                  <div className="solution-query-pill">
                    <span>"Show me the weekly revenue for the last 6 months"</span>
                    <strong>Running Query...</strong>
                  </div>

                  <div className="solution-chart-card">
                    <div className="solution-chart-top">
                      <div>
                        <h4>Weekly Revenue Watch</h4>
                        <p>
                          <span className="solution-live-dot" />
                          Updated live • SQL optimized
                        </p>
                      </div>
                      <strong>$42,912</strong>
                    </div>

                    <div className="solution-bars">
                      {[40, 55, 45, 70, 60, 85].map((height, index) => (
                        <motion.span
                          key={index}
                          style={{ height: `${height}%` }}
                          animate={{ opacity: [0.45, 1, 0.7] }}
                          transition={{ duration: 2.8, repeat: Infinity, delay: index * 0.16 }}
                        />
                      ))}
                      <svg className="solution-line" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <path d="M0 75 C18 58, 28 64, 45 48 S72 35, 100 10" />
                      </svg>
                    </div>

                    <div className="solution-months">
                      {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month) => (
                        <span key={month}>{month}</span>
                      ))}
                    </div>
                  </div>

                  <div className="solution-sync-note">
                    <Sparkles size={14} />
                    <span>Generated SQL, summary text, and widgets stay in sync with the conversation.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="solution-code-float">
              <pre>{`SELECT date_trunc('week', created_at),
       SUM(total_amount)
FROM orders
WHERE created_at > now() - interval '6 months'
GROUP BY 1
ORDER BY 1;`}</pre>
            </div>
          </motion.div>
        </section>

        <section className="section" id="features">
          <div className="features-heading">
            <motion.div
              className="features-badge"
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, ease: easeOut }}
            >
              <span>Capabilities</span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, ease: easeOut }}
            >
              Everything needed for chat to insight to dashboard
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, ease: easeOut, delay: 0.08 }}
            >
              A unified platform that handles the complexity of data engineering so your team can focus on answering the next big question.
            </motion.p>
          </div>

          <motion.div
            className="feature-grid"
            variants={sectionReveal}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
          >
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <motion.article className="glass-card feature-card" key={feature.title} variants={itemReveal}>
                  <div className="feature-icon">
                    <Icon size={20} />
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </motion.article>
              );
            })}
          </motion.div>

          <div className="features-divider" aria-hidden="true" />
        </section>

        <section className="section" id="how-it-works">
          <SectionHeading
            eyebrow="How it works"
            title="Five steps from raw warehouse data to a saved dashboard"
            description="The experience is linear, fast, and easy to trust because every stage stays visible as you move through it."
          />

          <motion.div
            className="timeline"
            variants={sectionReveal}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
          >
            {steps.map((step, index) => (
              <motion.div className="timeline-step" key={step.title} variants={itemReveal}>
                <div className="timeline-node">
                  <span>{index + 1}</span>
                </div>
                <div className="glass-card timeline-card">
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
                {index < steps.length - 1 ? <div className="timeline-connector" aria-hidden="true" /> : null}
              </motion.div>
            ))}
          </motion.div>
        </section>

        <section className="section showcase-section" id="showcase">
          <div>
            <SectionHeading
              eyebrow="Dashboard showcase"
              title="A conversation can become a full analytics surface"
              description="Velora can combine narrative answers, charts, and operational tables into a workspace that still feels lightweight."
            />
          </div>

          <motion.div
            className="showcase-panel glass-card"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.65, ease: easeOut }}
          >
            <div className="showcase-header">
              <div>
                <strong>Executive revenue board</strong>
                <span>Built from one conversation</span>
              </div>
              <div className="showcase-badges">
                <span>
                  <ShieldCheck size={14} />
                  Trusted SQL
                </span>
                <span>
                  <Lock size={14} />
                  Read-only mode
                </span>
              </div>
            </div>

            <div className="showcase-grid">
              <div className="showcase-chart large">
                <div className="widget-header">
                  <span>Revenue trend</span>
                  <ChevronRight size={16} />
                </div>
                <div className="area-chart">
                  {[20, 35, 30, 48, 44, 67, 60, 82, 91].map((height, index) => (
                    <motion.span
                      key={index}
                      style={{ height: `${height}%` }}
                      animate={{ opacity: [0.45, 1, 0.7] }}
                      transition={{ duration: 3, repeat: Infinity, delay: index * 0.15 }}
                    />
                  ))}
                </div>
              </div>

              <div className="showcase-stack">
                {dashboardCards.map((card) => (
                  <motion.div
                    className="showcase-widget"
                    key={card.title}
                    whileHover={{ y: -6, scale: 1.01 }}
                    transition={{ duration: 0.2, ease: easeOut }}
                  >
                    <span>{card.subtitle}</span>
                    <strong>{card.title}</strong>
                    <p>{card.trend}</p>
                  </motion.div>
                ))}
              </div>

              <div className="showcase-table">
                <div className="widget-header">
                  <span>Top accounts needing attention</span>
                  <GitBranch size={16} />
                </div>
                <div className="table-rows">
                  {[
                    ['Northwind', 'Renewal risk', 'High'],
                    ['Aster Labs', 'Expansion ready', 'Medium'],
                    ['MetricFlow', 'Usage spike', 'High'],
                  ].map((row) => (
                    <div className="table-row" key={row[0]}>
                      <span>{row[0]}</span>
                      <span>{row[1]}</span>
                      <strong>{row[2]}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="section developer-section" id="developers">
          <SectionHeading
            eyebrow="For developers and analysts"
            title="Transparent enough for power users, simple enough for everyone else"
            description="Velora keeps the generated SQL visible and editable, so teams can trust the workflow instead of treating AI like a black box."
          />

          <div className="developer-grid">
            <motion.div
              className="glass-card sql-panel"
              initial={{ opacity: 0, x: -28 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, ease: easeOut }}
            >
              <div className="code-header">
                <span>Generated SQL</span>
                <span className="code-badge">Debuggable</span>
              </div>
              <pre>
                <code>{sqlPreview}</code>
              </pre>
            </motion.div>

            <motion.div
              className="developer-points"
              variants={sectionReveal}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
            >
              {[
                'Inspect every query before it runs.',
                'Retain full control over filters, groupings, and joins.',
                'Review retries and fixes when source schemas change.',
                'Collaborate with non-technical teammates in one shared thread.',
              ].map((point) => (
                <motion.div className="glass-card developer-card" key={point} variants={itemReveal}>
                  <span className="developer-card-icon" aria-hidden="true">
                    <ShieldCheck size={16} />
                  </span>
                  <p>{point}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        <section className="section cta-section" id="cta">
          <motion.div
            className="cta-card"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.65, ease: easeOut }}
          >
            <span className="pill">Start faster with Velora</span>
            <h2>Replace static BI with a product your team will actually use every day.</h2>
            <p>
              Turn natural language into trusted SQL, instant dashboards, and shareable answers in one fast workflow.
            </p>
            <div className="hero-actions">
              <a className="button primary" href={productLink} target="_blank" rel="noreferrer">
                Try Velora
                <ArrowRight size={18} />
              </a>
              <a className="button secondary" href="#">
                Book a Demo
              </a>
            </div>
          </motion.div>
        </section>
      </main>

      <footer className="footer">
        <a className="brand" href="#hero">
          <span className="brand-mark" aria-hidden="true">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v2" />
              <path d="M12 20v2" />
              <path d="m4.93 4.93 1.41 1.41" />
              <path d="m17.66 17.66 1.41 1.41" />
              <path d="M2 12h2" />
              <path d="M20 12h2" />
              <path d="m6.34 17.66-1.41 1.41" />
              <path d="m19.07 4.93-1.41 1.41" />
            </svg>
          </span>
          <span>Velora</span>
        </a>

        <div className="footer-links">
          {footerLinks.map((link) => (
            <a key={link.label} href={link.href}>
              {link.label}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}

export default App;
