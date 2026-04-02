// src/app/coaching-studio/page.tsx
import Link from "next/link";

export default function CoachingStudioPage() {
  return (
    <main style={{ padding: '40px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Coaching Studio</h1>
      <p>This is the Coaching Studio starting page.</p>
      <p>Path: /coaching-studio</p>
      <p>
        <Link href="/coaching-studio/privacy-policy">Privacy Policy</Link>
      </p>
    </main>
  )
}