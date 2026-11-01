"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <p className="eyebrow">A RECESS HAS BEEN CALLED</p>
      <h1>The court hit a snag.</h1>
      <p>Your cached matches are safe.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
