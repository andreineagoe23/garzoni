import Head from "next/head";
import Link from "next/link";

export default function Pricing() {
  return (
    <>
      <Head>
        <title>Monevo Pricing</title>
        <meta
          name="description"
          content="Flexible plans for learners at every stage."
        />
      </Head>
      <main style={{ fontFamily: "system-ui", padding: "48px" }}>
        <h1>Pricing</h1>
        <p>SSR-ready pricing landing page.</p>
        <div style={{ marginTop: "24px" }}>
          <Link href="/">Back to home</Link>
        </div>
      </main>
    </>
  );
}
