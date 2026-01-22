'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  Upload,
  Eye,
  User,
  Download,
  Apple,
  Star
} from 'lucide-react'

// GitHub Icon component
const GitHubIcon = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
)

// Windows Icon
const WindowsIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 5.5L10.5 4.3V11.5H3V5.5ZM3 18.5V12.5H10.5V19.7L3 18.5ZM11.5 4.1L21 2.5V11.5H11.5V4.1ZM11.5 12.5H21V21.5L11.5 19.9V12.5Z" />
  </svg>
)

// Linux Icon
const LinuxIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587.26 1.252.392 1.966.392.734 0 1.434-.146 2.057-.426.214.49.64.852 1.159.977.665.2 1.43.03 2.217-.426.86-.499 1.873-.59 2.576-.837.328-.117.64-.257.816-.482.178-.228.276-.51.234-.82-.067-.51-.339-.73-.593-.94-.261-.21-.552-.334-.5-.553.104-.437.125-.926-.01-1.37-.067-.22-.158-.417-.266-.59.117-.257.18-.544.18-.842 0-.257-.034-.51-.102-.757-.164-.508-.454-.974-.873-1.379-.513-.508-1.163-.883-1.821-1.186-.328-.152-.657-.292-.981-.418-.188-.065-.388-.121-.524-.226l-.014-.01c-.038-.035-.076-.074-.109-.126-.125-.191-.215-.499-.31-.844-.189-.69-.335-1.493-.645-2.178-.323-.725-.733-1.254-1.227-1.618-.49-.36-1.038-.555-1.578-.595zM12.5 11.5a1 1 0 110 2 1 1 0 010-2z" />
  </svg>
)

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: 'easeOut' }
}

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
}

const features = [
  {
    icon: Upload,
    title: 'Drop Your Chaos',
    description: 'No manual entry. No formatting. Just drop your receipts, statements, and screenshots.'
  },
  {
    icon: Eye,
    title: 'Organizes Quietly',
    description: 'Yuki extracts transactions, categorizes spending, and learns your habits over time.'
  },
  {
    icon: User,
    title: 'You Stay in Control',
    description: 'Local-first. Your financial data never leaves your device. No bank connections required.'
  }
]

// GitHub release URL - update with your actual repo
const GITHUB_REPO = 'porkytheblack/yuki'
const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases/latest`

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-grid">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/yuki-icon.png"
              alt="Yuki"
              width={32}
              height={32}
              className="rounded-full"
            />
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`https://github.com/${GITHUB_REPO}`}
              className="btn-secondary text-sm"
            >
              <GitHubIcon size={16} />
              <Star size={14} />
              <span>Star</span>
            </a>
            <a href="#download" className="btn-primary text-sm">
              <Download size={16} />
              <span>Download</span>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="min-h-screen flex flex-col items-center justify-center px-4 pt-20 pb-16">
        <motion.div
          className="text-center max-w-4xl mx-auto"
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          {/* Pill badge */}
          <motion.div
            className="pill mb-8 inline-flex"
            variants={fadeIn}
          >
            <span className="text-[#a0a0a0]">Hi, I&apos;m Yuki</span>
            <Image
              src="/yuki-icon.png"
              alt="Yuki"
              width={24}
              height={24}
              className="rounded-full"
            />
          </motion.div>

          {/* Main Title */}
          <motion.h1
            className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight"
            variants={fadeIn}
          >
            Your Helpful{' '}
            <span className="text-accent">Accountant</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="text-lg md:text-xl text-[#a0a0a0] max-w-2xl mx-auto mb-12"
            variants={fadeIn}
          >
            A personal finance tracker that accepts your chaos.
            Upload receipts, statements, or just tell me about your spending—
            <span className="italic text-[#6b6b6b]">not a guilt machine.</span>
          </motion.p>

          {/* Demo Box */}
          <motion.div
            className="demo-box max-w-2xl mx-auto p-6 text-left mb-12"
            variants={fadeIn}
          >
            <p className="text-[#a0a0a0] mb-3">
              You drop a pile of receipts. Yuki <span className="highlight-peach">organizes</span>.
            </p>
            <p className="text-[#6b6b6b] mb-3">
              Weeks pass. You ask a question.
            </p>
            <p className="text-[#a0a0a0] mb-3">
              &quot;What did I spend the most on this month?&quot; <span className="highlight-peach">Yuki answers</span>.
            </p>
            <p className="text-[#a0a0a0]">
              Charts appear—<span className="highlight-blue">a pie chart here</span>, <span className="highlight-peach">a trend line there</span>.
            </p>
          </motion.div>

          {/* CTA Button */}
          <motion.div variants={fadeIn}>
            <a href="#download" className="btn-primary text-base">
              <Download size={20} />
              <span>Download Yuki</span>
            </a>
            <p className="text-[#6b6b6b] text-sm mt-4">
              Available for macOS, Windows, and Linux
            </p>
          </motion.div>
        </motion.div>
      </section>

      {/* Divider */}
      <div className="divider" />

      {/* Features Section */}
      <section className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="grid md:grid-cols-3 gap-6"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {features.map((feature) => (
              <motion.div
                key={feature.title}
                className="card p-6"
                variants={fadeIn}
              >
                <feature.icon size={24} className="text-accent mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-[#a0a0a0] text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Divider */}
      <div className="divider" />

      {/* Download Section */}
      <section className="py-24 px-4" id="download">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Start Tracking
            </h2>
            <p className="text-[#a0a0a0] mb-12">
              Download Yuki for your platform. Free and open source.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              <a
                href={`${RELEASES_URL}/download/Yuki.dmg`}
                className="platform-card flex flex-col items-center gap-2"
              >
                <Apple size={28} className="text-white" />
                <span className="font-medium text-white">macOS</span>
                <span className="text-xs text-[#6b6b6b]">Intel & Apple Silicon</span>
              </a>

              <a
                href={`${RELEASES_URL}/download/Yuki.msi`}
                className="platform-card flex flex-col items-center gap-2"
              >
                <WindowsIcon size={28} />
                <span className="font-medium text-white">Windows</span>
                <span className="text-xs text-[#6b6b6b]">.msi installer</span>
              </a>

              <a
                href={`${RELEASES_URL}/download/yuki.AppImage`}
                className="platform-card flex flex-col items-center gap-2"
              >
                <LinuxIcon size={28} />
                <span className="font-medium text-white">Linux</span>
                <span className="text-xs text-[#6b6b6b]">AppImage & .deb</span>
              </a>
            </div>

            <a
              href={RELEASES_URL}
              className="text-[#a0a0a0] hover:text-white text-sm underline underline-offset-4 transition-colors"
            >
              View all releases on GitHub
            </a>
          </motion.div>
        </div>
      </section>

      {/* Divider */}
      <div className="divider" />

      {/* Footer */}
      <footer className="py-8 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image
              src="/yuki-icon.png"
              alt="Yuki"
              width={24}
              height={24}
              className="rounded-full"
            />
            <span className="text-[#6b6b6b] text-sm">Yuki — Your Helpful Accountant</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-[#6b6b6b]">
            <a href={`https://github.com/${GITHUB_REPO}`} className="hover:text-white transition-colors flex items-center gap-2">
              <GitHubIcon size={16} />
              GitHub
            </a>
            <a href={`https://github.com/${GITHUB_REPO}/issues`} className="hover:text-white transition-colors">
              Report an Issue
            </a>
          </div>
        </div>
      </footer>
    </main>
  )
}
