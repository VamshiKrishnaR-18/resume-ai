import { useState } from "react";
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

  async function handleGenerate() {
    if (!selectedResume || jobDescription.trim().length < MIN_JD_LENGTH || generating) return;

    setGenerating(true);
    setError("");
    setVersion(null);
    setEditedContent("");
    setEditMode(false);

    try {
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
        (chunk, accumulated) => {
          setEditedContent(accumulated);

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
      );

      let latest = null;
      for (let i = 0; i < 3; i++) {
        const versions = await api.listVersions(selectedResume.id);
        if (versions.length > 0) {
          latest = versions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
          break;
        }
        await new Promise((r) => setTimeout(r, 500));
      }

      if (latest) {
        const fullVersion = await api.getVersion(latest.id);
        setVersion(fullVersion);
        setEditedContent(fullVersion.tailored_content);
      }
    } catch (err) {
      setError(err.message);
      setEditedContent((prev) => prev + "\n\n⚠️ Generation interrupted. Try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRetry(versionId) {
    if (generating) return;

    setGenerating(true);
    setError("");
    setEditedContent("");

    try {
      await api.retryVersionStream(versionId, (chunk, accumulated) => {
        setEditedContent(accumulated);
      });

      const updated = await api.getVersion(versionId);
      setVersion(updated);
      setEditedContent(updated.tailored_content);
    } catch (err) {
      setError(err.message || "Retry failed");
      setEditedContent((prev) => prev + "\n\n⚠️ Retry failed. Try again.");
    } finally {
      setGenerating(false);
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
  };
}