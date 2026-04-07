import Head from "next/head";
import Link from "next/link";

export default function Home() {
  return (
    <>
      <Head>
        <title>Garzoni</title>
        <meta
          name="description"
          content="Learn finance with guided paths, challenges, and missions."
        />
      </Head>
      <main style={{ fontFamily: "system-ui", padding: "48px" }}>
        <h1>Garzoni</h1>
        <p>A fast, SEO-friendly marketing shell using Next.js (SSR/SSG).</p>
        <div style={{ marginTop: "24px" }}>
          <Link href="/pricing">View pricing</Link>
        </div>
      </main>
    </>
  );
}
