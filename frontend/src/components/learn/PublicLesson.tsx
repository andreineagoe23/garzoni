import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import DOMPurify from "dompurify";
import apiClient from "services/httpClient";
import SeoHead from "components/seo/SeoHead";

type PublicLessonResponse = {
  slug: string;
  title: string;
  short_description: string;
  detailed_content: string;
  image_url: string;
  course: { id: number; title: string };
  sections: Array<{
    id: number;
    order: number;
    title: string;
    content_type: string;
    text_content: string;
  }>;
};

type RelatedLesson = {
  slug: string;
  title: string;
  short_description: string;
  course: { id: number; title: string };
};

export default function PublicLesson() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<PublicLessonResponse | null>(null);
  const [related, setRelated] = useState<RelatedLesson[]>([]);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    apiClient
      .get<PublicLessonResponse>(`/public/lessons/${slug}/`)
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err?.response?.status === 404 ? "not-found" : "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    apiClient
      .get<{ results: RelatedLesson[] }>("/public/lessons/")
      .then((res) => {
        if (cancelled) return;
        const others = (res.data.results ?? [])
          .filter((l) => l.slug !== data.slug && l.course.id === data.course.id)
          .slice(0, 4);
        setRelated(others);
      })
      .catch(() => {
        if (!cancelled) setRelated([]);
      });
    return () => {
      cancelled = true;
    };
  }, [data]);

  const sanitizedLessonHtml = useMemo(
    () => DOMPurify.sanitize(data?.detailed_content || ""),
    [data?.detailed_content]
  );
  const sanitizedSections = useMemo(
    () =>
      (data?.sections ?? []).map((section) => ({
        ...section,
        sanitizedText: DOMPurify.sanitize(section.text_content || ""),
      })),
    [data?.sections]
  );

  if (loading) {
    return (
      <main style={{ padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
        <p>Loading…</p>
      </main>
    );
  }

  if (error === "not-found" || !data) {
    return (
      <main style={{ padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
        <SeoHead
          title="Lesson not found — Garzoni"
          description="This lesson is not available."
          canonical={`https://www.garzoni.app/learn/${slug ?? ""}`}
        />
        <h1>Lesson not found</h1>
        <p>
          The lesson you’re looking for isn’t available. Browse all lessons
          inside the app.
        </p>
        <Link to="/register">Create a free account</Link>
      </main>
    );
  }

  const canonical = `https://www.garzoni.app/learn/${data.slug}`;
  const description =
    data.short_description ||
    `${data.title} — free finance lesson from Garzoni.`;

  return (
    <main style={{ padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <SeoHead
        title={`${data.title} — Garzoni`}
        description={description}
        canonical={canonical}
        image={data.image_url || undefined}
        course={{
          name: data.title,
          description,
          image: data.image_url || undefined,
          partOf: data.course?.title || undefined,
        }}
        breadcrumbs={[
          { name: "Home", url: "https://www.garzoni.app/" },
          { name: "Lessons", url: "https://www.garzoni.app/learn" },
          { name: data.title, url: canonical },
        ]}
      />
      <nav aria-label="Breadcrumb" style={{ fontSize: 14, opacity: 0.7 }}>
        <Link to="/">Home</Link> › <Link to="/learn">Lessons</Link> ›{" "}
        <span>{data.course.title}</span>
      </nav>
      <h1>{data.title}</h1>
      {data.short_description ? <p>{data.short_description}</p> : null}
      {data.image_url ? (
        <img
          src={data.image_url}
          alt={data.title}
          width={1200}
          height={630}
          style={{ width: "100%", height: "auto", borderRadius: 12 }}
          loading="lazy"
        />
      ) : null}
      <article
        dangerouslySetInnerHTML={{ __html: sanitizedLessonHtml }}
        style={{ lineHeight: 1.7 }}
      />
      {sanitizedSections.map((s) => (
        <section key={s.id}>
          <h2>{s.title}</h2>
          <div dangerouslySetInnerHTML={{ __html: s.sanitizedText }} />
        </section>
      ))}
      {related.length > 0 ? (
        <section style={{ marginTop: "3rem" }}>
          <h2>Related lessons</h2>
          <ul style={{ lineHeight: 1.9 }}>
            {related.map((l) => (
              <li key={l.slug}>
                <Link to={`/learn/${l.slug}`}>{l.title}</Link>
              </li>
            ))}
          </ul>
          <p>
            <Link to="/learn">Browse all free lessons →</Link>
          </p>
        </section>
      ) : (
        <p style={{ marginTop: "2rem" }}>
          <Link to="/learn">Browse all free lessons →</Link>
        </p>
      )}
      <aside
        style={{
          marginTop: "3rem",
          padding: "1.5rem",
          border: "1px solid #2a3a4a",
          borderRadius: 12,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Keep learning with Garzoni</h2>
        <p>
          Sign up for free to track progress, earn streaks, and unlock the full
          path of lessons, quizzes, and AI-powered tutor.
        </p>
        <Link
          to="/register"
          style={{
            display: "inline-block",
            padding: "0.75rem 1.5rem",
            background: "#22c55e",
            color: "#fff",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Create a free account
        </Link>
      </aside>
    </main>
  );
}
