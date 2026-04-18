/**
 * Legacy route: Stripe used to return here after checkout. Success URL now goes
 * straight to /personalized-path; this page only redirects old bookmarks/links.
 */
import { useLayoutEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const PaymentSuccessPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  useLayoutEffect(() => {
    if (sessionId) {
      navigate(
        `/personalized-path?session_id=${encodeURIComponent(sessionId)}`,
        { replace: true }
      );
    } else {
      navigate("/personalized-path", { replace: true });
    }
  }, [sessionId, navigate]);

  return null;
};

export default PaymentSuccessPage;
