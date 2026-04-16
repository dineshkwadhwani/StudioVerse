"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/services/firebase";
import {
  DEFAULT_REPORT_STYLE,
  REPORT_STYLE_LABELS,
} from "@/modules/assessments/report-styles";
import styles from "./SuperAdminPortal.module.css";
import {
  ASSESSMENT_TYPE_LABELS,
  RENDER_STYLE_LABELS,
  type AssessmentFormValues,
  type AssessmentOwnershipScope,
  type AssessmentPublicationState,
  type AssessmentReportStyle,
  type AssessmentQuestionRecord,
  type AssessmentRecord,
  type AssessmentRenderStyle,
  type AssessmentStatus,
  type AssessmentType,
  type GeneratedQuestion,
} from "@/types/assessment";

type TenantOption = {
  id: string;
  tenantId: string;
  tenantName: string;
  status: string;
};

type AssessmentsSectionProps = {
  tenants?: TenantOption[];
};

type AssessmentFormValuesWithCreatedBy = AssessmentFormValues & {
  createdBy?: string;
};

function buildAssessmentId(tenantId: string, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${tenantId}-${slug}`;
}

function sanitizeExtension(file: File): string {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg" || extension === "png" || extension === "webp") {
    return extension;
  }
  return "jpg";
}

function validateAssessmentImageFile(file: File): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "Use a JPG, PNG, or WebP image for the assessment image.";
  }
  if (file.size > 2 * 1024 * 1024) {
    return "Assessment image must be 2MB or smaller.";
  }
  return null;
}

const EMPTY_FORM: AssessmentFormValues = {
  tenantId: "",
  name: "",
  shortDescription: "",
  longDescription: "",
  assessmentImageUrl: "",
  assessmentImagePath: "",
  assessmentContext: "",
  assessmentBenefit: "",
  assessmentType: "self-awareness",
  renderStyle: "single-choice",
  reportStyle: DEFAULT_REPORT_STYLE,
  creditsRequired: "0",
  questionBankCount: "20",
  questionsPerAttempt: "10",
  analysisPrompt: "",
  questionGenerationPrompt: "",
  status: "draft",
  publicationState: "unpublished",
  ownershipScope: "tenant",
  ownerEntityId: "",
};

function processQuestionPromptTemplate(prompt: string, count: number): string {
  return prompt.replace(
    /\[\s*(?:no\s*of\s*questions|no_of_questions)\s*\]|\bno_of_questions\b/gi,
    String(count)
  );
}

export default function AssessmentsSection({ tenants: propTenants }: AssessmentsSectionProps) {
  const [tenants, setTenants] = useState<TenantOption[]>(propTenants ?? []);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formValues, setFormValues] = useState<AssessmentFormValuesWithCreatedBy>(EMPTY_FORM);
  const [selectedAssessmentImage, setSelectedAssessmentImage] = useState<File | null>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [existingQuestionCount, setExistingQuestionCount] = useState(0);
  const [loadingExistingQuestions, setLoadingExistingQuestions] = useState(false);
  const [fetchingQuestions, setFetchingQuestions] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [fetchSuccess, setFetchSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const processedPromptPreview = useMemo(() => {
    const count = parseInt(formValues.questionBankCount, 10);
    if (!formValues.questionGenerationPrompt.trim() || !Number.isFinite(count) || count < 1) {
      return "";
    }

    return processQuestionPromptTemplate(formValues.questionGenerationPrompt, count);
  }, [formValues.questionBankCount, formValues.questionGenerationPrompt]);

  const renderStyleOptions = useMemo(
    () =>
      (Object.entries(RENDER_STYLE_LABELS) as [AssessmentRenderStyle, string][]).sort((a, b) =>
        a[1].localeCompare(b[1])
      ),
    []
  );

  const reportStyleOptions = useMemo(
    () =>
      (Object.entries(REPORT_STYLE_LABELS) as [AssessmentReportStyle, string][]).sort((a, b) =>
        a[1].localeCompare(b[1])
      ),
    []
  );

  // Load tenants if not passed in as props
  useEffect(() => {
    if (propTenants && propTenants.length > 0) return;
    getDocs(query(collection(db, "tenants")))
      .then((snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TenantOption, "id">) }));
        setTenants(rows);
      })
      .catch(() => {});
  }, [propTenants]);

  // Load assessments when tenant filter changes
  useEffect(() => {
    setLoading(true);
    const q = selectedTenantId
      ? query(collection(db, "assessments"), where("tenantId", "==", selectedTenantId), orderBy("createdAt", "desc"))
      : query(collection(db, "assessments"), orderBy("createdAt", "desc"));
    getDocs(q)
      .then((snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AssessmentRecord, "id">) }));
        setAssessments(rows);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedTenantId]);

  function openCreate() {
    setFormValues({ ...EMPTY_FORM, tenantId: selectedTenantId });
    setSelectedAssessmentImage(null);
    setGeneratedQuestions([]);
    setExistingQuestionCount(0);
    setFetchError("");
    setFetchSuccess("");
    setLoadingExistingQuestions(false);
    setFormOpen(true);
  }

  function openEdit(assessment: AssessmentRecord) {
    setFormValues({
      id: assessment.id,
      tenantId: assessment.tenantId,
      name: assessment.name,
      shortDescription: assessment.shortDescription,
      longDescription: assessment.longDescription,
      assessmentImageUrl: assessment.assessmentImageUrl ?? "",
      assessmentImagePath: assessment.assessmentImagePath ?? "",
      assessmentContext: assessment.assessmentContext,
      assessmentBenefit: assessment.assessmentBenefit,
      assessmentType: assessment.assessmentType,
      renderStyle: assessment.renderStyle,
      reportStyle: assessment.reportStyle ?? DEFAULT_REPORT_STYLE,
      creditsRequired: String(assessment.creditsRequired ?? 0),
      questionBankCount: String(assessment.questionBankCount),
      questionsPerAttempt: String(assessment.questionsPerAttempt),
      analysisPrompt: assessment.analysisPrompt,
      questionGenerationPrompt: assessment.questionGenerationPrompt,
      status: assessment.status,
      publicationState: assessment.publicationState,
      ownershipScope: assessment.ownershipScope,
      ownerEntityId: assessment.ownerEntityId,
    });
    // Load existing questions from database.
    // Avoid orderBy here to prevent composite index dependency in edit flow.
    setLoadingExistingQuestions(true);
    getDocs(query(collection(db, "assessmentQuestions"), where("assessmentId", "==", assessment.id)))
      .then((snap) => {
        const existing = snap.docs.map((d) => {
          const data = d.data() as Omit<AssessmentQuestionRecord, "id"> & { correctAnswer?: string };
          const correctAnswers = Array.isArray(data.correctAnswers)
            ? data.correctAnswers
            : typeof data.correctAnswer === "string" && data.correctAnswer.trim().length > 0
            ? data.correctAnswer.split(",").map((item) => item.trim()).filter(Boolean)
            : [];

          return {
            displayOrder: typeof data.displayOrder === "number" ? data.displayOrder : Number.MAX_SAFE_INTEGER,
            questionText: data.questionText,
            options: data.options,
            correctAnswers,
            scoringRule: data.scoringRule,
            imageDescription: data.imageDescription,
            tags: data.tags,
            weight: data.weight,
          } as GeneratedQuestion & { displayOrder: number };
        });

        const ordered = existing
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((question) => ({
            questionText: question.questionText,
            options: question.options,
            correctAnswers: question.correctAnswers,
            scoringRule: question.scoringRule,
            imageDescription: question.imageDescription,
            tags: question.tags,
            weight: question.weight,
          }));

        setGeneratedQuestions(ordered);
        setFetchError("");
        setExistingQuestionCount(existing.length);
      })
      .catch((loadError) => {
        console.error("Failed to load existing assessment questions:", loadError);
        setGeneratedQuestions([]);
        setExistingQuestionCount(0);
        setFetchError("Could not load existing questions for this assessment.");
      })
      .finally(() => {
        setLoadingExistingQuestions(false);
      });
    setFetchError("");
    setFetchSuccess("");
    setError("");
    setSelectedAssessmentImage(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setSelectedAssessmentImage(null);
    setGeneratedQuestions([]);
    setExistingQuestionCount(0);
    setLoadingExistingQuestions(false);
    setFetchError("");
    setFetchSuccess("");
    setError("");
  }

  function setField<K extends keyof AssessmentFormValuesWithCreatedBy>(key: K, value: AssessmentFormValuesWithCreatedBy[K]) {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleAssessmentImageSelection(file: File | null) {
    if (!file) {
      setSelectedAssessmentImage(null);
      return;
    }

    const validationError = validateAssessmentImageFile(file);
    if (validationError) {
      setError(validationError);
      setSelectedAssessmentImage(null);
      return;
    }

    setError("");
    setSelectedAssessmentImage(file);
  }

  async function fetchQuestions(append: boolean) {
    if (loadingExistingQuestions) {
      setFetchError("Please wait for existing questions to load before fetching more.");
      return;
    }

    const count = parseInt(formValues.questionBankCount, 10);
    if (!formValues.name) { setFetchError("Please enter an Assessment name first."); return; }
    if (!formValues.questionGenerationPrompt.trim()) { setFetchError("Please enter a Question Generation Prompt first."); return; }
    if (!count || count < 1) { setFetchError("Question Bank Count must be at least 1."); return; }

    setFetchingQuestions(true);
    setFetchError("");
    setFetchSuccess("");

    try {
      const processedPrompt = processQuestionPromptTemplate(formValues.questionGenerationPrompt, count);

      const res = await fetch("/api/assessments/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentName: formValues.name,
          assessmentContext: formValues.assessmentContext,
          assessmentBenefit: formValues.assessmentBenefit,
          renderStyle: formValues.renderStyle,
          questionGenerationPrompt: processedPrompt,
          questionCount: count,
          existingCount: (append || Boolean(formValues.id)) ? generatedQuestions.length : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setFetchError(data.error ?? "Failed to fetch questions."); return; }
      const incoming: GeneratedQuestion[] = Array.isArray(data.questions) ? data.questions : [];
      if (incoming.length === 0) { setFetchError("No questions were returned from the AI. Try rephrasing your prompt."); return; }
      const shouldAppend = append || Boolean(formValues.id);
      setGeneratedQuestions((prev) => (shouldAppend ? [...prev, ...incoming] : incoming));
      if (!shouldAppend) {
        setExistingQuestionCount(0);
      }
      const retrievedCount = typeof data.retrievedCount === "number" ? data.retrievedCount : incoming.length;
      setFetchSuccess(`Successfully fetched ${retrievedCount} question${retrievedCount === 1 ? "" : "s"}.`);
    } catch {
      setFetchError("Network error while fetching questions. Please retry.");
    } finally {
      setFetchingQuestions(false);
    }
  }

  async function saveAssessment() {
    if (!formValues.tenantId) { setError("Please select a tenant."); return; }
    if (!formValues.name.trim()) { setError("Assessment name is required."); return; }
    if (generatedQuestions.length === 0) { setError("Please generate at least one question before saving."); return; }

    const parsedCreditsRequired = Number(formValues.creditsRequired);
    if (!Number.isFinite(parsedCreditsRequired) || parsedCreditsRequired < 0) {
      setError("Credits required must be a non-negative number.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const isExisting = Boolean(formValues.id);
      const assessmentId = formValues.id ?? buildAssessmentId(formValues.tenantId, formValues.name);
      const assessmentRef = doc(db, "assessments", assessmentId);

      let assessmentImageUrl = formValues.assessmentImageUrl;
      let assessmentImagePath = formValues.assessmentImagePath;

      if (selectedAssessmentImage) {
        const extension = sanitizeExtension(selectedAssessmentImage);
        const nextPath = `assessments/${formValues.tenantId}/${assessmentId}/cover.${extension}`;
        const storageRef = ref(storage, nextPath);
        await uploadBytes(storageRef, selectedAssessmentImage, { contentType: selectedAssessmentImage.type });
        assessmentImageUrl = await getDownloadURL(storageRef);
        assessmentImagePath = nextPath;
      }

      const assessmentDoc: Record<string, unknown> = {
        tenantId: formValues.tenantId,
        name: formValues.name.trim(),
        shortDescription: formValues.shortDescription.trim(),
        longDescription: formValues.longDescription.trim(),
        assessmentImageUrl,
        assessmentImagePath,
        assessmentContext: formValues.assessmentContext.trim(),
        assessmentBenefit: formValues.assessmentBenefit.trim(),
        assessmentType: formValues.assessmentType,
        renderStyle: formValues.renderStyle,
        reportStyle: formValues.reportStyle || DEFAULT_REPORT_STYLE,
        creditsRequired: parsedCreditsRequired,
        questionBankCount: generatedQuestions.length,
        questionsPerAttempt: parseInt(formValues.questionsPerAttempt, 10) || generatedQuestions.length,
        analysisPrompt: formValues.analysisPrompt.trim(),
        questionGenerationPrompt: formValues.questionGenerationPrompt.trim(),
        status: formValues.status,
        publicationState: formValues.publicationState,
        ownershipScope: formValues.ownershipScope,
        ownerEntityId: formValues.ownerEntityId.trim(),
        createdBy: isExisting ? formValues.createdBy || "superadmin" : "superadmin",
        updatedBy: "superadmin",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        publishedAt: null,
      };

      if (isExisting) {
        // Update existing assessment metadata
        await updateDoc(assessmentRef, assessmentDoc);

        // Add only newly appended questions, keep existing questions untouched.
        const newQuestions = generatedQuestions.slice(existingQuestionCount);
        if (newQuestions.length > 0) {
          const batch = writeBatch(db);

          newQuestions.forEach((q, idx) => {
            const qRef = doc(collection(db, "assessmentQuestions"));
            batch.set(qRef, {
              assessmentId,
              tenantId: formValues.tenantId,
              questionText: q.questionText,
              questionType: formValues.renderStyle,
              renderStyle: formValues.renderStyle,
              options: q.options ?? [],
              correctAnswers: q.correctAnswers ?? [],
              scoringRule: q.scoringRule ?? "correct=1, wrong=0",
              imageUrl: "",
              imageDescription: q.imageDescription ?? "",
              displayOrder: existingQuestionCount + idx + 1,
              weight: q.weight ?? 1,
              tags: q.tags ?? [],
              isActive: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });
          await batch.commit();
        }
        setMessage(`Assessment "${formValues.name}" updated.`);
      } else {
        // Create new assessment
        const batch = writeBatch(db);
        batch.set(assessmentRef, assessmentDoc);

        generatedQuestions.forEach((q, idx) => {
          const qRef = doc(collection(db, "assessmentQuestions"));
          batch.set(qRef, {
            assessmentId,
            tenantId: formValues.tenantId,
            questionText: q.questionText,
            questionType: formValues.renderStyle,
            renderStyle: formValues.renderStyle,
            options: q.options ?? [],
            correctAnswers: q.correctAnswers ?? [],
            scoringRule: q.scoringRule ?? "correct=1, wrong=0",
            imageUrl: "",
            imageDescription: q.imageDescription ?? "",
            displayOrder: idx + 1,
            weight: q.weight ?? 1,
            tags: q.tags ?? [],
            isActive: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });

        await batch.commit();
        setMessage(`Assessment "${formValues.name}" saved with ${generatedQuestions.length} questions.`);
      }

      closeForm();

      // Refresh list
      const q = selectedTenantId
        ? query(collection(db, "assessments"), where("tenantId", "==", selectedTenantId), orderBy("createdAt", "desc"))
        : query(collection(db, "assessments"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setAssessments(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AssessmentRecord, "id">) })));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Save failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className={styles.card}>
      <h2>Manage Assessments</h2>

      {/* Toolbar */}
      <div className={styles.controlCard}>
        <div className={styles.actions}>
          <select
            className={styles.select}
            style={{ width: "auto", marginBottom: 0 }}
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
            aria-label="Filter by tenant"
          >
            <option value="">All Tenants</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.tenantId}>
                {t.tenantName}
              </option>
            ))}
          </select>
          <button type="button" className={styles.button} onClick={openCreate}>
            + Create Assessment
          </button>
        </div>
      </div>

      {/* Messages */}
      {message && <p className={styles.info}>{message}</p>}
      {error && <p className={styles.error}>{error}</p>}

      {/* Assessments table */}
      {loading ? (
        <p className={styles.emptyCard}>Loading assessments…</p>
      ) : assessments.length === 0 ? (
        <div className={styles.emptyCard}>No assessments found. Create the first one.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Render Style</th>
                <th>Credits</th>
                <th>Questions (Bank)</th>
                <th>Per Attempt</th>
                <th>Status</th>
                <th>Published</th>
                <th>Tenant</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 700 }}>{a.name}</td>
                  <td>{ASSESSMENT_TYPE_LABELS[a.assessmentType] ?? a.assessmentType}</td>
                  <td>{RENDER_STYLE_LABELS[a.renderStyle] ?? a.renderStyle}</td>
                  <td>{a.creditsRequired ?? 0}</td>
                  <td>{a.questionBankCount}</td>
                  <td>{a.questionsPerAttempt}</td>
                  <td><span className={styles.statusBadge}>{a.status}</span></td>
                  <td><span className={styles.statusBadge}>{a.publicationState}</span></td>
                  <td>{a.tenantId}</td>
                  <td>
                    <button type="button" className={styles.rowAction} onClick={() => openEdit(a)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      {formOpen && (
        <div className={styles.modalOverlay}>
          <section className={styles.modal} style={{ width: "min(860px, 100%)", maxHeight: "92vh", overflowY: "auto" }}>
            <div className={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>{formValues.id ? "Edit Assessment" : "Create Assessment"}</h3>
              <button type="button" className={styles.ghostButton} onClick={closeForm} style={{ padding: "6px 14px" }}>
                ✕ Close
              </button>
            </div>

            {/* ── Section: Identity ── */}
            <fieldset style={{ border: "1px solid #c6dcea", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
              <legend style={{ fontWeight: 700, padding: "0 6px" }}>Identity</legend>

              <label className={styles.label} htmlFor="a-tenant">Tenant *</label>
              <select id="a-tenant" className={styles.select} value={formValues.tenantId} onChange={(e) => setField("tenantId", e.target.value)}>
                <option value="">— Select Tenant —</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.tenantId}>{t.tenantName}</option>
                ))}
              </select>

              <label className={styles.label} htmlFor="a-name">Assessment Name *</label>
              <input id="a-name" className={styles.input} value={formValues.name} onChange={(e) => setField("name", e.target.value)} placeholder="e.g. Leadership Self-Awareness Assessment" />

              <label className={styles.label} htmlFor="a-short">Short Description</label>
              <input id="a-short" className={styles.input} value={formValues.shortDescription} onChange={(e) => setField("shortDescription", e.target.value)} placeholder="One-line description shown in listings" />

              <label className={styles.label} htmlFor="a-long">Long Description</label>
              <textarea id="a-long" className={styles.input} rows={3} value={formValues.longDescription} onChange={(e) => setField("longDescription", e.target.value)} placeholder="Full description for the assessment detail page" style={{ resize: "vertical" }} />

              <label className={styles.label} htmlFor="a-image">Assessment Image</label>
              <input
                id="a-image"
                className={styles.input}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleAssessmentImageSelection(e.target.files?.[0] ?? null)}
              />
              {selectedAssessmentImage ? (
                <p className={styles.info}>Selected image: {selectedAssessmentImage.name}</p>
              ) : null}
              {!selectedAssessmentImage && formValues.assessmentImageUrl ? (
                <div style={{ marginBottom: 12 }}>
                  <p className={styles.subtitle} style={{ marginBottom: 8 }}>Current assessment image</p>
                  <img
                    src={formValues.assessmentImageUrl}
                    alt="Assessment"
                    style={{ width: "100%", maxWidth: 320, borderRadius: 10, border: "1px solid #c6dcea" }}
                  />
                </div>
              ) : null}
            </fieldset>

            {/* ── Section: Context & Purpose ── */}
            <fieldset style={{ border: "1px solid #c6dcea", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
              <legend style={{ fontWeight: 700, padding: "0 6px" }}>Context &amp; Purpose</legend>

              <label className={styles.label} htmlFor="a-context">Assessment Context</label>
              <textarea id="a-context" className={styles.input} rows={3} value={formValues.assessmentContext} onChange={(e) => setField("assessmentContext", e.target.value)} placeholder="Describe the professional context or scenario this assessment addresses" style={{ resize: "vertical" }} />

              <label className={styles.label} htmlFor="a-benefit">Participant Benefit</label>
              <textarea id="a-benefit" className={styles.input} rows={2} value={formValues.assessmentBenefit} onChange={(e) => setField("assessmentBenefit", e.target.value)} placeholder="What will the participant gain or learn from this assessment?" style={{ resize: "vertical" }} />
            </fieldset>

            {/* ── Section: Configuration ── */}
            <fieldset style={{ border: "1px solid #c6dcea", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
              <legend style={{ fontWeight: 700, padding: "0 6px" }}>Configuration</legend>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <div>
                  <label className={styles.label} htmlFor="a-type">Assessment Type</label>
                  <select id="a-type" className={styles.select} value={formValues.assessmentType} onChange={(e) => setField("assessmentType", e.target.value as AssessmentType)}>
                    {(Object.entries(ASSESSMENT_TYPE_LABELS) as [AssessmentType, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={styles.label} htmlFor="a-render">Render Style</label>
                  <select id="a-render" className={styles.select} value={formValues.renderStyle} onChange={(e) => setField("renderStyle", e.target.value as AssessmentRenderStyle)}>
                    {renderStyleOptions.map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={styles.label} htmlFor="a-bank-count">Questions to Generate (Bank Count)</label>
                  <input id="a-bank-count" type="number" min={1} max={100} className={styles.input} value={formValues.questionBankCount} onChange={(e) => setField("questionBankCount", e.target.value)} />
                </div>
                <div>
                  <label className={styles.label} htmlFor="a-credits-required">Credits Required</label>
                  <input
                    id="a-credits-required"
                    type="number"
                    min={0}
                    className={styles.input}
                    value={formValues.creditsRequired}
                    onChange={(e) => setField("creditsRequired", e.target.value)}
                  />
                </div>
                <div>
                  <label className={styles.label} htmlFor="a-per-attempt">Questions Per Attempt</label>
                  <input id="a-per-attempt" type="number" min={1} max={100} className={styles.input} value={formValues.questionsPerAttempt} onChange={(e) => setField("questionsPerAttempt", e.target.value)} />
                </div>
                <div>
                  <label className={styles.label} htmlFor="a-status">Status</label>
                  <select id="a-status" className={styles.select} value={formValues.status} onChange={(e) => setField("status", e.target.value as AssessmentStatus)}>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label className={styles.label} htmlFor="a-pub">Publication State</label>
                  <select id="a-pub" className={styles.select} value={formValues.publicationState} onChange={(e) => setField("publicationState", e.target.value as AssessmentPublicationState)}>
                    <option value="unpublished">Unpublished</option>
                    <option value="published">Published</option>
                    <option value="scheduled">Scheduled</option>
                  </select>
                </div>
                <div>
                  <label className={styles.label} htmlFor="a-scope">Ownership Scope</label>
                  <select id="a-scope" className={styles.select} value={formValues.ownershipScope} onChange={(e) => setField("ownershipScope", e.target.value as AssessmentOwnershipScope)}>
                    <option value="platform">Platform</option>
                    <option value="tenant">Tenant</option>
                    <option value="professional">Professional</option>
                  </select>
                </div>
                <div>
                  <label className={styles.label} htmlFor="a-owner">Owner Entity ID</label>
                  <input id="a-owner" className={styles.input} value={formValues.ownerEntityId} onChange={(e) => setField("ownerEntityId", e.target.value)} placeholder="Optional — leave blank for platform-level" />
                </div>
              </div>
            </fieldset>

            {/* ── Section: AI Prompts ── */}
            <fieldset style={{ border: "1px solid #c6dcea", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
              <legend style={{ fontWeight: 700, padding: "0 6px" }}>AI Prompts</legend>

              <label className={styles.label} htmlFor="a-analysis-prompt">Analysis Prompt (used to generate participant reports)</label>
              <textarea id="a-analysis-prompt" className={styles.input} rows={3} value={formValues.analysisPrompt} onChange={(e) => setField("analysisPrompt", e.target.value)} placeholder="Describe how the AI should interpret submitted answers and generate the narrative report for this assessment" style={{ resize: "vertical" }} />

              <label className={styles.label} htmlFor="a-report-style">Report Style</label>
              <select
                id="a-report-style"
                className={styles.select}
                value={formValues.reportStyle}
                onChange={(e) => setField("reportStyle", e.target.value as AssessmentReportStyle)}
              >
                {reportStyleOptions.map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>

              <label className={styles.label} htmlFor="a-gen-prompt">Question Generation Prompt *</label>
              <textarea id="a-gen-prompt" className={styles.input} rows={4} value={formValues.questionGenerationPrompt} onChange={(e) => setField("questionGenerationPrompt", e.target.value)} placeholder={`Describe the type of questions to generate. Use [No of Questions] or [NO_OF_QUESTIONS] as a placeholder.\nE.g. "Generate exactly [NO_OF_QUESTIONS] self-awareness questions for senior leaders that explore emotional intelligence, blind spots, and behavioural patterns."`} style={{ resize: "vertical" }} />

              {processedPromptPreview ? (
                <div style={{ marginTop: 10, border: "1px solid #c6dcea", borderRadius: 10, background: "#f6fbff", padding: 10 }}>
                  <p style={{ margin: "0 0 6px 0", fontSize: "0.82rem", color: "#1a6189", fontWeight: 700 }}>Processed Prompt Preview</p>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace", fontSize: "0.8rem", color: "#335269" }}>
                    {processedPromptPreview}
                  </pre>
                </div>
              ) : null}

              {fetchError && <p className={styles.error}>{fetchError}</p>}
              {fetchSuccess && <p className={styles.info}>{fetchSuccess}</p>}

              <div className={styles.actions} style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => fetchQuestions(false)}
                  disabled={fetchingQuestions || loadingExistingQuestions}
                >
                  {loadingExistingQuestions
                    ? "Loading Existing Questions..."
                    : fetchingQuestions
                    ? "Fetching Questions..."
                    : `Fetch ${formValues.questionBankCount || "N"} Questions from AI`}
                </button>
                {generatedQuestions.length > 0 && (
                  <button
                    type="button"
                    className={styles.ghostButton}
                    onClick={() => fetchQuestions(true)}
                    disabled={fetchingQuestions || loadingExistingQuestions}
                  >
                    {fetchingQuestions ? "Fetching…" : `+ Get ${formValues.questionBankCount || "More"} More`}
                  </button>
                )}
              </div>
            </fieldset>

            {/* ── Generated Questions Table ── */}
            {generatedQuestions.length > 0 && (
              <fieldset style={{ border: "1px solid #c6dcea", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
                <legend style={{ fontWeight: 700, padding: "0 6px" }}>
                  Generated Questions ({generatedQuestions.length})
                </legend>
                <div style={{ maxHeight: 360, overflowY: "auto", borderRadius: 10, border: "1px solid #c6dcea" }}>
                  <table className={styles.table} style={{ minWidth: 700 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 36 }}>#</th>
                        <th>Question</th>
                        <th>Options</th>
                        <th>Correct Answer</th>
                        <th>Scoring Rule</th>
                        <th>Tags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generatedQuestions.map((q, idx) => (
                        <tr key={idx}>
                          <td style={{ color: "#4d6e86", fontWeight: 700 }}>{idx + 1}</td>
                          <td style={{ maxWidth: 280 }}>{q.questionText || "-"}</td>
                          <td>
                            {q.options && q.options.length > 0 ? (
                              q.options.map((o, oi) => (
                                <div key={oi} style={{ fontSize: "0.82rem", color: "#4d6e86" }}>
                                  <strong>{o.value || "-"}</strong>: {o.label || "-"}
                                </div>
                              ))
                            ) : (
                              <span style={{ fontSize: "0.82rem", color: "#4d6e86" }}>-</span>
                            )}
                          </td>
                          <td style={{ fontWeight: 700, color: "#1a6189" }}>{(q.correctAnswers ?? []).join(", ") || "-"}</td>
                          <td style={{ fontSize: "0.82rem", color: "#4d6e86" }}>{q.scoringRule || "-"}</td>
                          <td style={{ fontSize: "0.82rem" }}>{(q.tags ?? []).join(", ") || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </fieldset>
            )}

            {/* ── Footer actions ── */}
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.button}
                onClick={saveAssessment}
                disabled={saving || generatedQuestions.length === 0}
              >
                {saving ? "Saving…" : "Save Assessment"}
              </button>
              <button type="button" className={styles.ghostButton} onClick={closeForm} disabled={saving}>
                Cancel
              </button>
            </div>
          </section>
        </div>
      )}
    </article>
  );
}
