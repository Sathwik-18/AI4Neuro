'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { dashboardPathFor, ROLE_META } from '@/lib/roles';
import {
  Activity,
  Brain,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Mail,
  Phone,
  MapPin,
  BrainCircuit,
  LogIn,
  Menu,
  MoveUpRight,
  X,
  Layers,
  UsersRound,
  FileStack,
  Building2,
  Landmark,
  ScanSearch,
  RadioTower,
  ShieldPlus,
  UploadCloud,
  FileSearch,
  MessageSquareText,
  Users,
  ScanLine,
  FileText,
  KeyRound,
  Lock,
  ListChecks,
  HeartPulse,
} from 'lucide-react';
import { VariableProximity, GradientText, RotatingText } from './_effects';
import './landing.css';

// ============================================================================
// NAVBAR
// ============================================================================
const NAV_SECTIONS = [
  { href: '#home', label: 'Home' },
  { href: '#services', label: 'Services' },
  { href: '#process', label: 'Process' },
  { href: '#roles', label: 'Roles' },
  { href: '#security', label: 'Security' },
  { href: '#contact', label: 'Contact' },
];

function PublicNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, userProfile, loading } = useAuth();

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="navbar-wrap section-shell">
      <nav className="navbar" aria-label="Main navigation">
        <Link className="brand" href="/landing">
          <img
            src="/landing_homepage/AI4NEuroLOGO copy.png"
            alt="AI4Neuro Logo"
            className="h-10 w-auto object-contain"
            style={{ height: '40px' }}
          />
          <img
            src="/landing_homepage/AI4NeuroText.png"
            alt="AI4Neuro"
            className="h-5 w-auto object-contain"
            style={{ height: '20px' }}
          />
        </Link>

        <div className="nav-links">
          {NAV_SECTIONS.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </div>

        <div className="nav-actions">
          {!loading && user && userProfile ? (
            <Link href={dashboardPathFor(userProfile.role)} className="nav-cta">
              Dashboard
              <span>
                <MoveUpRight size={16} />
              </span>
            </Link>
          ) : (
            <>
              <Link href="/login" className="login-button">
                Login
                <LogIn size={16} />
              </Link>

              <a className="nav-cta" href="#contact">
                Request Demo
                <span>
                  <MoveUpRight size={16} />
                </span>
              </a>
            </>
          )}
        </div>

        <button
          className="mobile-menu"
          type="button"
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      <div className={`mobile-drawer-layer ${isMenuOpen ? 'open' : ''}`} aria-hidden={!isMenuOpen}>
        <button className="mobile-drawer-backdrop" type="button" aria-label="Close menu" onClick={closeMenu} />

        <aside className="mobile-drawer" aria-label="Mobile navigation">
          <div className="mobile-drawer-heading">
            <img
              src="/landing_homepage/AI4NEuroLOGO copy.png"
              alt="AI4Neuro Logo"
              style={{ height: '36px' }}
            />
            <strong>AI4NEURO</strong>
            <button type="button" aria-label="Close menu" onClick={closeMenu}>
              <X size={20} />
            </button>
          </div>

          <div className="mobile-drawer-links">
            {NAV_SECTIONS.map((item) => (
              <a key={item.href} href={item.href} onClick={closeMenu}>
                {item.label}
              </a>
            ))}
          </div>

          <div className="mobile-drawer-actions">
            {!loading && user && userProfile ? (
              <Link href={dashboardPathFor(userProfile.role)} className="nav-cta" onClick={closeMenu}>
                Dashboard
                <span>
                  <MoveUpRight size={16} />
                </span>
              </Link>
            ) : (
              <>
                <Link href="/login" className="login-button" onClick={closeMenu}>
                  Login
                  <LogIn size={16} />
                </Link>

                <a className="nav-cta" href="#contact" onClick={closeMenu}>
                  Request Demo
                  <span>
                    <MoveUpRight size={16} />
                  </span>
                </a>
              </>
            )}
          </div>
        </aside>
      </div>
    </header>
  );
}

// ============================================================================
// HERO
// ============================================================================
function Hero() {
  const headingRef = useRef<HTMLHeadingElement>(null);

  return (
    <section className="hero section-shell" id="home">
      <div className="hero-copy">
        <div className="eyebrow">
          <Activity size={16} />
          Early Alzheimer&apos;s Detection
        </div>

        <h1 ref={headingRef}>
          <VariableProximity
            label={"AI-powered\nneuro diagnostics\nfor earlier,\nclearer decisions."}
            className="hero-variable-title"
            fromFontVariationSettings="'wght' 520, 'opsz' 12"
            toFontVariationSettings="'wght' 1000, 'opsz' 12"
            containerRef={headingRef}
            radius={145}
            falloff="gaussian"
          />
        </h1>

        <p>
          AI4NEURO brings EEG and MRI analysis into a single clinical workflow — one upload,
          one result screen, and specialist-ready reports for the whole care team.
          PET support is on the roadmap.
        </p>

        <div className="hero-actions">
          <a className="primary-button" href="#services">
            Explore Services
            <span>
              <MoveUpRight size={17} />
            </span>
          </a>
          <a className="secondary-button" href="#process">View Process</a>
        </div>
      </div>

      <div className="hero-visual">
        <div className="image-card patient-card">
          <img src="/landing_homepage/patient.png" alt="Patient consultation" className="hero-image patient-img" />
        </div>

        <div className="helix-wrap" aria-hidden="true">
          <img
            src="/landing_homepage/double_helix_animation.gif"
            alt=""
            className="helix-img"
          />
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// STATS STRIP
// ============================================================================
const stats = [
  { icon: <Layers size={22} />, value: '2', label: 'Modalities live — EEG and MRI' },
  { icon: <UsersRound size={22} />, value: '5', label: 'Roles, each hospital-scoped' },
  { icon: <FileStack size={22} />, value: '3', label: 'Reports per analysis' },
  { icon: <ShieldCheck size={22} />, value: 'Isolated', label: 'One data boundary per hospital' },
];

function StatsStrip() {
  return (
    <section className="stats-strip section-shell" aria-label="Ai4Neuro highlights">
      {stats.map((stat) => (
        <article className="stat-card" key={stat.label}>
          <span>{stat.icon}</span>
          <strong>{stat.value}</strong>
          <small>{stat.label}</small>
        </article>
      ))}
    </section>
  );
}

// ============================================================================
// SERVICES SECTION
// ============================================================================
const services = [
  {
    icon: <ScanSearch size={24} />,
    title: 'MRI Analysis',
    text: 'Structural brain scan review for volume, region change, and Alzheimer-linked imaging markers.',
    visual: 'mri',
    image: '/services/mripatient.png',
  },
  {
    icon: <RadioTower size={24} />,
    title: 'EEG Intelligence',
    text: 'Signal pattern analysis for rhythm, slowing, connectivity, and cognitive decline indicators.',
    visual: 'eeg',
    image: '/services/eegpatient.png',
  },
  {
    icon: <Brain size={24} />,
    title: 'PET Biomarkers',
    text: 'Metabolic and amyloid-sensitive PET support for earlier specialist-led interpretation.',
    visual: 'pet',
    image: '/services/petpatient.png',
    comingSoon: true,
  },
];

function ServicesSection() {
  return (
    <section className="services-section section-shell" id="services">
      <div className="section-heading">
        <div className="eyebrow">Neuro Imaging Services</div>
        <h2 className="text-3xl font-bold">
          AI-powered diagnostics for{' '}
          <RotatingText
            texts={['EEG', 'MRI']}
            mainClassName="services-rotating-text"
            splitLevelClassName="services-rotating-word"
            elementLevelClassName="services-rotating-letter"
            staggerFrom="last"
            staggerDuration={0.035}
            rotationInterval={1800}
            splitBy="characters"
            auto
            loop
          />
        </h2>
      </div>

      <div className="service-grid">
        {services.map((service) => (
          <article
            className={`service-card ${service.comingSoon ? 'service-card-soon' : ''}`}
            key={service.title}
          >
            <div className={`service-visual service-visual-${service.visual}`}>
              <img className="service-image" src={service.image} alt={`${service.title} patient`} />
            </div>

            {service.comingSoon ? (
              <span className="service-badge">Coming soon</span>
            ) : (
              <a className="icon-button service-arrow" href="#contact" aria-label={`Open ${service.title}`}>
                <MoveUpRight size={19} />
              </a>
            )}

            <div className="service-icon">{service.icon}</div>
            <h3 className="text-3xl font-bold">{service.title}</h3>
            <p>{service.text}</p>
            {service.comingSoon && (
              <p className="service-note">Not yet available in the platform.</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

// ============================================================================
// PROCESS SECTION
// ============================================================================
const steps = [
  {
    icon: <UploadCloud size={23} />,
    title: 'Upload',
    text: 'A radiologist or doctor uploads an EEG recording or MRI scan against a patient record.',
  },
  {
    icon: <Sparkles size={23} />,
    title: 'AI Analysis',
    text: 'The modality pipeline runs in the background while the session reports live progress.',
  },
  {
    icon: <FileSearch size={23} />,
    title: 'Reports Generated',
    text: 'Findings and visualizations become patient, clinician, and technical PDFs automatically.',
  },
  {
    icon: <MessageSquareText size={23} />,
    title: 'Care Team Reviews',
    text: 'Results appear in the dashboard of everyone on that patient’s care team, and nowhere else.',
  },
];

function ProcessSection() {
  return (
    <section className="process-section section-shell" id="process">
      <div className="process-heading">
        <div className="eyebrow">Workflow</div>
        <h2>
          <GradientText
            colors={['#31241F', '#806257', '#C7A79B']}
            animationSpeed={8}
            showBorder={false}
            className="process-gradient-heading text-4xl font-bold"
          >
            From scan to early insight.
          </GradientText>
        </h2>
      </div>
      <div className="process-grid">
        {steps.map((step, index) => (
          <article className="process-card" key={step.title}>
            <small>{String(index + 1).padStart(2, '0')}</small>
            <span>{step.icon}</span>
            <h3 className="text-3xl font-bold">{step.title}</h3>
            <p>{step.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

// ============================================================================
// ROLES SECTION
// ============================================================================
const roles = [
  {
    role: 'super_admin' as const,
    icon: <Building2 size={22} />,
    text: 'Platform-wide oversight — every hospital, every user, every scan, and full analytics.',
  },
  {
    role: 'admin' as const,
    icon: <Landmark size={22} />,
    text: 'Runs a single hospital: creates doctors, radiologists and patients, and assigns care teams.',
  },
  {
    role: 'doctor' as const,
    icon: <Stethoscope size={22} />,
    text: 'Their assigned patients end to end, with the ability to start a new analysis.',
  },
  {
    role: 'radiologist' as const,
    icon: <ScanLine size={22} />,
    text: 'Uploads scans and tracks the sessions they run through the platform.',
  },
  {
    role: 'patient' as const,
    icon: <Users size={22} />,
    text: 'Read-only access to their own completed reports — and nothing beyond them.',
  },
];

function RolesSection() {
  return (
    <section className="roles-section section-shell" id="roles">
      <div className="section-heading">
        <div className="eyebrow">Built for every role</div>
        <h2 className="text-3xl font-bold">
          One platform, five points of view.
        </h2>
        <p className="section-lede">
          Access is decided by role and by hospital. Nobody sees a record that does not
          belong to their institution, and every check fails closed.
        </p>
      </div>

      <div className="roles-grid">
        {roles.map((entry) => (
          <article className={`role-card role-card-${ROLE_META[entry.role].accent}`} key={entry.role}>
            <span className="role-icon">{entry.icon}</span>
            <h3>{ROLE_META[entry.role].label}</h3>
            <p>{entry.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

// ============================================================================
// OUTPUTS SECTION — what you actually get back
// ============================================================================
const reportTypes = [
  {
    icon: <HeartPulse size={22} />,
    title: 'Patient report',
    text: 'A plain-language summary of the finding, written to be read by the person it is about.',
  },
  {
    icon: <Stethoscope size={22} />,
    title: 'Clinician report',
    text: 'The finding alongside the supporting metrics and visualizations a specialist needs.',
  },
  {
    icon: <FileText size={22} />,
    title: 'Technical report',
    text: 'Full model output: probability breakdown, per-trial consistency, and every generated chart.',
  },
];

const resultContents = [
  'Prediction with a confidence score',
  'Probability across CN, MCI and AD',
  'EEG timeseries, PSD and similarity plots',
  'MRI volume metrics against normative ranges',
  'An interactive slice viewer for MRI scans',
];

function OutputsSection() {
  return (
    <section className="outputs-section section-shell" id="outputs">
      <div className="section-heading">
        <div className="eyebrow">What you get back</div>
        <h2 className="text-3xl font-bold">Three reports from one upload.</h2>
        <p className="section-lede">
          Every completed analysis produces the same set of documents, written for three
          different readers — generated automatically, no formatting work required.
        </p>
      </div>

      <div className="outputs-layout">
        <div className="outputs-grid">
          {reportTypes.map((report) => (
            <article className="output-card" key={report.title}>
              <span className="output-icon">{report.icon}</span>
              <h3>{report.title}</h3>
              <p>{report.text}</p>
            </article>
          ))}
        </div>

        <aside className="outputs-panel">
          <div className="eyebrow">
            <ListChecks size={16} />
            In every result
          </div>
          <ul className="outputs-list">
            {resultContents.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}

// ============================================================================
// SECURITY SECTION
// ============================================================================
const securityPoints = [
  {
    icon: <ShieldCheck size={22} />,
    title: 'Hospital-scoped isolation',
    text: 'Every clinical record resolves to exactly one hospital. Cross-tenant reads are denied by default, not by exception.',
  },
  {
    icon: <KeyRound size={22} />,
    title: 'Verified on every request',
    text: 'Each API call carries a signed token, and the server re-checks role, hospital and account status before answering.',
  },
  {
    icon: <Lock size={22} />,
    title: 'Private storage',
    text: 'Scans, generated assets and reports live in private buckets, reachable only through short-lived signed links.',
  },
  {
    icon: <ListChecks size={22} />,
    title: 'Recorded activity',
    text: 'User management and analysis activity are written to an audit trail that administrators can review.',
  },
];

function SecuritySection() {
  return (
    <section className="security-section section-shell" id="security">
      <div className="security-panel">
        <div className="security-intro">
          <div className="eyebrow">Security &amp; tenancy</div>
          <h2 className="text-3xl font-bold">Patient data stays where it belongs.</h2>
          <p>
            Multi-tenancy is enforced in the backend, not assumed in the interface.
            A hospital&apos;s data is invisible to every other hospital on the platform.
          </p>
        </div>

        <div className="security-grid">
          {securityPoints.map((point) => (
            <article className="security-card" key={point.title}>
              <span>{point.icon}</span>
              <h3>{point.title}</h3>
              <p>{point.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// ABOUT SECTION
// ============================================================================
function AboutSection() {
  return (
    <section className="about-section section-shell" id="about">
      <div className="about-visual">
        <div className="about-image">
          <img src="/landing_homepage/DoctorsGroup.png" alt="Doctors group" className="about-doctors-image" />
        </div>
        <div className="about-floating-card">
          <BrainCircuit size={28} />
          <strong>Multimodal AI</strong>
          <small>MRI + EEG interpretation support</small>
        </div>
      </div>

      <div className="about-copy">
        <div className="eyebrow">About AI4NEURO</div>
        <h2 className="text-3xl font-bold">
          <GradientText
            colors={['#130601', '#58433B', '#806257']}
            animationSpeed={8}
            showBorder={false}
            className="about-gradient-heading"
          >
            Built for clinicians working against the clock.
          </GradientText>
        </h2>
        <p>
          AI4NEURO supports early Alzheimer&apos;s detection by combining scan findings and
          signal behaviour into a clean diagnostic dashboard. The experience is designed
          for clarity, not clutter.
        </p>
        <div className="about-list">
          <span>
            <ShieldPlus size={20} />
            Privacy-aware patient handling
          </span>
          <span>
            <ShieldPlus size={20} />
            Specialist-ready visual summaries
          </span>
        </div>
        <a className="primary-button" href="#contact">
          Book Screening
          <span>
            <MoveUpRight size={17} />
          </span>
        </a>
      </div>
    </section>
  );
}

// ============================================================================
// CONTACT SECTION
// ============================================================================
function ContactSection() {
  return (
    <section className="contact-section section-shell" id="contact">
      <div className="contact-panel">
        <div>
          <div className="eyebrow">Contact</div>
          <h2 className="text-2xl font-bold">Start a neuro screening conversation.</h2>
          <p>
            Talk to us about bringing AI4NEURO into your hospital, laboratory, or research
            programme — including a walkthrough of the workflow with your own team.
          </p>
        </div>

        <div className="contact-cards">
          <article>
            <Mail size={21} />
            <span>info@praxiatech.ai</span>
          </article>
          <article>
            <Phone size={21} />
            <span>+91 94132 59268</span>
          </article>
          <article>
            <MapPin size={21} />
            <span>Indore, Madhya Pradesh</span>
          </article>
        </div>

        <a className="primary-button" href="mailto:info@praxiatech.ai">
          Contact Team
          <span>
            <MoveUpRight size={17} />
          </span>
        </a>
      </div>
    </section>
  );
}

// ============================================================================
// FOOTER
// ============================================================================
function Footer() {
  return (
    <footer className="footer section-shell">
      <div className="footer-main">
        <div className="footer-identity">
          <Link className="footer-brand" href="/landing">
            <img
              src="/landing_homepage/AI4NEuroLOGO copy.png"
              alt="AI4Neuro Logo"
              style={{ height: '30px', marginRight: '6px' }}
            />
            <img
              src="/landing_homepage/AI4NeuroText.png"
              alt="AI4Neuro"
              style={{ height: '15px' }}
            />
          </Link>
          <p>Early Alzheimer&apos;s detection through EEG and MRI intelligence.</p>
        </div>

        <nav className="footer-links" aria-label="Footer navigation">
          <strong>Explore</strong>
          {NAV_SECTIONS.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="footer-links">
          <strong>Get in touch</strong>
          <a href="mailto:info@praxiatech.ai">info@praxiatech.ai</a>
          <a href="tel:+919413259268">+91 94132 59268</a>
          <span>Indore, Madhya Pradesh</span>
          <Link href="/login">Sign in</Link>
        </div>
      </div>

      <div className="footer-legal">
        <p className="footer-disclaimer">
          AI4NEURO provides decision support for qualified clinicians. It is not a diagnostic
          device and is not a substitute for professional clinical judgement.
        </p>
        <p className="footer-copyright">
          &copy; {new Date().getFullYear()} AI4NEURO. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

// ============================================================================
// MAIN PAGE EXPORT
// ============================================================================
export default function LandingPage() {
  return (
    <div className="landing-wrap app-shell">
      <PublicNavbar />
      <Hero />
      <StatsStrip />
      <ServicesSection />
      <ProcessSection />
      <RolesSection />
      <OutputsSection />
      <SecuritySection />
      <AboutSection />
      <ContactSection />
      <Footer />
    </div>
  );
}
