import Link from "next/link";
import { ArrowLeftRight, FileText, Image as ImageIcon, LockKeyhole, QrCode } from "lucide-react";
import { toolCategories } from "@/lib/tool-categories";
import styles from "./home.module.css";

const shortcuts = [
  { name: "Merge PDF", href: "/pdf/merge", icon: FileText },
  { name: "Resize image", href: "/image/resize", icon: ImageIcon },
  { name: "Create a QR code", href: "/data/qr-code", icon: QrCode },
];

export default function Home() {
  return (
    <main className={styles.home} id="main-content">
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.intro}>
          <h1 id="hero-title">Your files.<br /><span>Your browser.</span></h1>
          <p>Convert, edit, and organize files with tools that run right in your browser.</p>
          <div className={styles.actions}>
            <Link href="/convert" className={styles.primary}>
              <ArrowLeftRight size={19} aria-hidden="true" />
              Convert a file
            </Link>
            <a href="#tools" className={styles.secondary}>Browse tools</a>
          </div>
        </div>

        <nav className={styles.shortcuts} aria-label="Quick tools">
          <h2>Quick tools</h2>
          {shortcuts.map(({ href, icon: Icon, name }) => (
            <Link href={href} key={href}><Icon size={20} aria-hidden="true" />{name}</Link>
          ))}
        </nav>
      </section>

      <section id="tools" className={styles.catalog} aria-labelledby="tools-title">
        <h2 id="tools-title">Explore the tools</h2>
        <ul className={styles.grid}>
          {toolCategories.map(({ name, href, icon: Icon, description, tone }) => (
            <li key={href}>
              <Link href={href} className={styles.card} data-tone={tone}>
                <span className={styles.icon}><Icon size={22} aria-hidden="true" /></span>
                <div>
                  <h3>{name}</h3>
                  <p>{description}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <aside className={styles.privacy}>
        <span className={styles.privacyIcon}><LockKeyhole size={24} aria-hidden="true" /></span>
        <div>
          <h2>File processing stays on your device.</h2>
          <p>Optional AI tools send the content you choose directly to Google Gemini.</p>
        </div>
        <Link href="/privacy">Privacy policy</Link>
      </aside>
    </main>
  );
}
