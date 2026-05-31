"use client";

import { useEffect } from "react";

export function TaskFocusHighlighter({ taskId }: { taskId: string }) {
  useEffect(() => {
    const element = document.getElementById(`task-${taskId}`);

    if (!element) {
      return;
    }

    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.classList.add("task-card-focus");

    const timer = window.setTimeout(() => {
      element.classList.remove("task-card-focus");
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [taskId]);

  return null;
}
