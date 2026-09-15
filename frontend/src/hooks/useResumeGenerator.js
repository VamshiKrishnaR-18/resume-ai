import { useState, useRef } from "react";
import { api } from "../api.js";

export function useResumeGenerator({
  selectedResume,
  jobDescription,
  companyName,
  jobTitle,
  jobLocation,
  model,
  MIN_JD_LENGTH,
  setError,
}) {
  const [version, setVersion] = useState(null);
  const [editedContent, setEditedContent] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [generating, setGenerating] = useState(false);

  // ✅ NEW: Abort controller (cancel streaming)
  const abortRef = useRef(null);

  // -----------------------------
  // Helper: auto scroll
  // -----------------------------
  function autoScroll() {
    setTimeout(() => {
      const el = document.querySelector(".panel:last-child");
      if (el) {
        el.scrollTo({
          top: el.scrollHeight,
          behavior: "smooth",
        });
      }
    }, 50);
  }

  // -----------------------------
  // Generate Resume (STREAMING)
  // -----------------------------
  async function handleGenerate() {
    if (!selectedResume) return;
    if (jobDescription.trim().length < MIN_JD_LENGTH) {
      setError(`Job description must be at least ${MIN_JD_LENGTH} characters`);
      return;
    }
    if (generating) return;

    setGenerating(true);
    setError("");
    setVersion(null);
    setEditedContent("");
    setEditMode(false);

    abortRef.current = new AbortController();

    try {
      let accumulated = "";

      await api.generateResumeStream(
        {
          resume_id: selectedResume.id,
          resume_content: selectedResume.content,
          job_description: jobDescription,
          company_name: companyName || undefined,
          job_title: jobTitle || undefined,
          job_location: jobLocation || undefined,
          provider: model,
        },
        (chunk) => {
          accumulated += chunk;
          setEditedContent(accumulated);
          autoScroll();
        },
        abortRef.current.signal
      );

      // ✅ STRONGER polling (wait for DB commit)
      let latest = null;

      for (let i = 0; i < 5; i++) {
        const versions = await api.listVersions(selectedResume.id);

        if (versions.length > 0) {
          latest = versions.sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
          )[0];

          if (latest.generation_status === "completed") break;
        }

        await new Promise((r) => setTimeout(r, 700));
      }

      if (latest) {
        const fullVersion = await api.getVersion(latest.id);
        setVersion(fullVersion);
        setEditedContent(fullVersion.tailored_content || accumulated);
      }
    } catch (err) {
      if (err.name === "AbortError") {
        setError("Generation cancelled");
      } else {
        setError(err.message || "Generation failed");
        setEditedContent(
          (prev) => prev + "\n\n⚠️ Generation interrupted. Try again."
        );
      }
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  }

  // -----------------------------
  // Retry Failed Version
  // -----------------------------
  async function handleRetry(versionId) {
    if (generating) return;

    setGenerating(true);
    setError("");
    setEditedContent("");

    abortRef.current = new AbortController();

    try {
      let accumulated = "";

      await api.retryVersionStream(
        versionId,
        (chunk) => {
          accumulated += chunk;
          setEditedContent(accumulated);
          autoScroll();
        },
        abortRef.current.signal
      );

      const updated = await api.getVersion(versionId);
      setVersion(updated);
      setEditedContent(updated.tailored_content || accumulated);
    } catch (err) {
      if (err.name === "AbortError") {
        setError("Retry cancelled");
      } else {
        setError(err.message || "Retry failed");
        setEditedContent(
          (prev) => prev + "\n\n⚠️ Retry failed. Try again."
        );
      }
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  }

  // -----------------------------
  // Cancel Generation
  // -----------------------------
  function cancelGeneration() {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }

  return {
    version,
    setVersion,
    editedContent,
    setEditedContent,
    editMode,
    setEditMode,
    generating,
    handleGenerate,
    handleRetry,
    cancelGeneration, // ✅ NEW
  };
}