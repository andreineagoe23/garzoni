import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

function LessonPageRedirect() {
  const { courseId, pathId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!courseId) return;
    if (pathId) {
      navigate(`/courses/${pathId}/lessons/${courseId}/flow`, { replace: true });
      return;
    }
    navigate(`/lessons/${courseId}/flow`, { replace: true });
  }, [courseId, navigate, pathId]);

  return null;
}

export default LessonPageRedirect;
