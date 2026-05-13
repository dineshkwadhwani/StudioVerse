"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "@/services/firebase";
import { listActivePromotionPackagesForTenant } from "@/services/promotionPackages.service";
import { listActiveListingPackagesForTenant } from "@/services/listingPackages.service";
import { getWalletByUserAndTenant } from "@/services/wallet.service";
import { listCategories, listSubCategories } from "@/services/categories.service";
import { saveAssessmentDefinition } from "@/services/assessments.service";
import {
  chargePromotionRequestOnSubmission,
  denyAssessmentPromotionRequest,
} from "@/services/programPromotionRequests.service";
import {
  DEFAULT_REPORT_STYLE,
  REPORT_STYLE_LABELS,
} from "@/modules/assessments/report-styles";
import styles from "./SuperAdminPortal.module.css";
import {
  ASSESSMENT_LISTING_STATUS_LABELS,
  ASSESSMENT_PROMOTION_STATUS_LABELS,
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
  type AssessmentVisibility,
  type GeneratedQuestion,
} from "@/types/assessment";
import type { PromotionPackageRecord } from "@/types/promotionPackage";
import type { ListingPackageRecord } from "@/types/listingPackage";
import type { CategoryRecord, SubCategoryRecord } from "@/types/category";
import { tenantAssetPath } from "@/lib/tenant/assets";

function getErrorMessage(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return String(error);
  }

  const err = error as {
    message?: string;
    details?: {
      issues?: string[];
      fieldErrors?: Record<string, string>;
    };
  };

  const issues = err.details?.issues ?? [];
  const fieldErrors = err.details?.fieldErrors ?? {};
  const fieldMessages = Object.entries(fieldErrors).map(([field, message]) => `${field}: ${message}`);

  if (issues.length > 0 || fieldMessages.length > 0) {
    return [
      err.message ?? "Assessment validation failed.",
      ...issues,
      ...fieldMessages,
    ].join(" ");
  }

  return err.message ?? "Unknown error";
}

type TenantOption = {
  id: string;
  tenantId: string;
  tenantName: string;
  status: string;
};

type AssessmentsSectionProps = {
  tenants?: TenantOption[];
  isSuperAdmin?: boolean;
  searchQuery?: string;
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
  tenantIds: [],
  name: "",
  categoryId: "",
  subCategoryId: "",
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
  visibility: "public",
  ownershipScope: "tenant",
  ownerEntityId: "",
  promoted: false,
  promotionPackageId: "",
  promotionStatus: "none",
  listingPackageId: "",
  listingStatus: "none",
};

const ASSESSMENT_VISIBILITY_LABELS: Record<AssessmentVisibility, string> = {
  public: "Public",
  private: "Private",
};

function normalizeAssessmentStatus(value: string): AssessmentStatus {
  if (value === "published") {
    return "published";
  }
  if (value === "archived") {
    return "archived";
  }
  return "draft";
}

function processQuestionPromptTemplate(prompt: string, count: number): string {
  return prompt.replace(
    /\[\s*(?:no\s*of\s*questions|no_of_questions)\s*\]|\bno_of_questions\b/gi,
    String(count)
  );
}

function matchesTenantScope(args: {
  primaryTenantId: string;
  tenantIds?: string[];
  selectedTenantId: string;
}): boolean {
  if (args.primaryTenantId === args.selectedTenantId) {
    return true;
  }

  if (!Array.isArray(args.tenantIds) || args.tenantIds.length === 0) {
    return false;
  }

  return args.tenantIds.includes(args.selectedTenantId);
}

export default function AssessmentsSection({ tenants: propTenants, isSuperAdmin, searchQuery = "" }: AssessmentsSectionProps) {
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
  const [selectedPublicationState, setSelectedPublicationState] = useState<string>("all");
  const [selectedPromoted, setSelectedPromoted] = useState<string>("all");
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategoryRecord[]>([]);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const visibleAssessments = assessments.filter((a) => {
    if (selectedPublicationState === "published" && a.publicationState !== "published") {
      return false;
    }
    if (selectedPublicationState === "draft" && a.publicationState !== "unpublished") {
      return false;
    }
    if (selectedPromoted === "true" && a.promotionStatus !== "promoted") {
      return false;
    }
    if (!normalizedSearchQuery) {
      return true;
    }

    const searchableText = [
      a.name,
      a.shortDescription,
      a.longDescription,
      a.assessmentContext,
      a.assessmentBenefit,
      a.assessmentType,
      a.renderStyle,
      a.visibility,
      a.publicationState,
      a.status,
      a.promotionStatus,
      a.listingStatus,
      a.categoryName,
      a.subCategoryName,
    ]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join(" ")
      .toLowerCase();

    return searchableText.includes(normalizedSearchQuery);
  });
  const categoryOptionsForTenant = categories.filter((item) => item.tenantId === formValues.tenantId);
  const subCategoryOptionsForTenant = subCategories.filter((item) => item.tenantId === formValues.tenantId);
  const [promotionPackages, setPromotionPackages] = useState<PromotionPackageRecord[]>([]);
  const [promotionPackagesLoading, setPromotionPackagesLoading] = useState(false);
  const [listingPackages, setListingPackages] = useState<ListingPackageRecord[]>([]);
  const [listingPackagesLoading, setListingPackagesLoading] = useState(false);

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
    const q = query(collection(db, "assessments"), orderBy("createdAt", "desc"));
    getDocs(q)
      .then((snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AssessmentRecord, "id">) }));
        const filtered = selectedTenantId
          ? rows.filter((item) =>
              matchesTenantScope({
                primaryTenantId: item.tenantId,
                tenantIds: item.tenantIds,
                selectedTenantId,
              })
            )
          : rows;
        setAssessments(filtered);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedTenantId]);

  useEffect(() => {
    async function loadPromotionPackagesForForm(): Promise<void> {
      if (!formOpen || !formValues.tenantId) {
        setPromotionPackages([]);
        setPromotionPackagesLoading(false);
        return;
      }

      setPromotionPackagesLoading(true);
      try {
        const loaded = await listActivePromotionPackagesForTenant(formValues.tenantId);
        setPromotionPackages(loaded.filter((pkg) => pkg.resourceType === "assessment"));
      } catch (loadError) {
        console.error("Failed to load promotion packages for Assessment form:", loadError);
        setPromotionPackages([]);
      } finally {
        setPromotionPackagesLoading(false);
      }
    }

    void loadPromotionPackagesForForm();
  }, [formOpen, formValues.tenantId]);

  useEffect(() => {
    async function loadListingPackagesForForm(): Promise<void> {
      if (!formOpen || !formValues.tenantId) {
        setListingPackages([]);
        setListingPackagesLoading(false);
        return;
      }

      setListingPackagesLoading(true);
      try {
        const loaded = await listActiveListingPackagesForTenant(formValues.tenantId);
        setListingPackages(loaded.filter((pkg) => pkg.resourceType === "assessment"));
      } catch (loadError) {
        console.error("Failed to load listing packages for Assessment form:", loadError);
        setListingPackages([]);
      } finally {
        setListingPackagesLoading(false);
      }
    }

    void loadListingPackagesForForm();
  }, [formOpen, formValues.tenantId]);

  useEffect(() => {
    async function loadCategoryOptions(): Promise<void> {
      try {
        const [nextCategories, nextSubCategories] = await Promise.all([
          listCategories(),
          listSubCategories(),
        ]);
        setCategories(nextCategories);
        setSubCategories(nextSubCategories);
      } catch (loadError) {
        console.error("Failed to load categories for Assessment form:", loadError);
      }
    }

    void loadCategoryOptions();
  }, []);

  function openCreate() {
    setFormValues({
      ...EMPTY_FORM,
      tenantId: selectedTenantId,
      tenantIds: selectedTenantId ? [selectedTenantId] : [],
    });
    setSelectedAssessmentImage(null);
    setGeneratedQuestions([]);
    setExistingQuestionCount(0);
    setFetchError("");
    setFetchSuccess("");
    setLoadingExistingQuestions(false);
    setFormOpen(true);
  }

  function openEdit(assessment: AssessmentRecord) {
    const tenantIds = Array.isArray(assessment.tenantIds) && assessment.tenantIds.length > 0
      ? assessment.tenantIds
      : [assessment.tenantId];

    setFormValues({
      id: assessment.id,
      tenantId: assessment.tenantId,
      tenantIds,
      name: assessment.name,
      categoryId: assessment.categoryId ?? "",
      subCategoryId: assessment.subCategoryId ?? "",
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
      status: normalizeAssessmentStatus(assessment.status),
      publicationState: assessment.publicationState === "published" ? "published" : "unpublished",
      visibility: assessment.visibility === "private" ? "private" : "public",
      ownershipScope: assessment.ownershipScope,
      ownerEntityId: assessment.ownerEntityId,
      promoted: assessment.promotionStatus === "requested" || assessment.promotionStatus === "promoted",
      promotionPackageId: assessment.promotionPackageId ?? "",
      promotionStatus: assessment.promotionStatus ?? "none",
      listingPackageId: assessment.listingPackageId ?? "",
      listingStatus: assessment.listingStatus ?? (assessment.publicationState === "pending_publication_review" ? "requested" : "none"),
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
    if (!formValues.tenantId || formValues.tenantIds.length === 0) { setError("Please select at least one tenant."); return; }
    if (!formValues.name.trim()) { setError("Assessment name is required."); return; }
    if (generatedQuestions.length === 0) { setError("Please generate at least one question before saving."); return; }

    const parsedCreditsRequired = Number(formValues.creditsRequired);
    if (!Number.isFinite(parsedCreditsRequired) || parsedCreditsRequired < 0) {
      setError("Credits required must be a non-negative number.");
      return;
    }

    const hasPublishIntent = formValues.status === "published";
    if (hasPublishIntent && !isSuperAdmin && !formValues.listingPackageId.trim()) {
      setError("Select a listing package to submit publication approval request.");
      return;
    }

    if (formValues.promoted && !formValues.promotionPackageId.trim()) {
      setError("Select a promotion package to request Assessment promotion.");
      return;
    }

    if (formValues.promoted && formValues.promotionPackageId.trim()) {
      const role = typeof window !== "undefined" ? sessionStorage.getItem("cs_role") : null;
      const requiresCreditCheck = role === "company" || role === "professional";
      if (requiresCreditCheck) {
        const uid = auth.currentUser?.uid;
        if (!uid) {
          setError("Unable to verify wallet. Please sign in again.");
          return;
        }

        const wallet = await getWalletByUserAndTenant({ userId: uid, tenantId: formValues.tenantId });
        const availableCoins = wallet?.availableCoins ?? 0;
        const selectedPackage = promotionPackages.find((pkg) => pkg.id === formValues.promotionPackageId);
        if (!selectedPackage) {
          setError("Selected promotion package is unavailable.");
          return;
        }

        if (availableCoins < selectedPackage.costCredits) {
          setError(`Not enough credits. Required: ${selectedPackage.costCredits}, Available: ${availableCoins}.`);
          return;
        }
      }
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const isExisting = Boolean(formValues.id);
      const assessmentId = formValues.id ?? buildAssessmentId(formValues.tenantId, formValues.name);
      const requestedStatus = normalizeAssessmentStatus(formValues.status);
      const normalizedStatus = hasPublishIntent
        ? (isSuperAdmin ? "published" : "draft")
        : requestedStatus;
      const publicationState: AssessmentPublicationState = hasPublishIntent
        ? (isSuperAdmin ? "published" : "pending_publication_review")
        : (normalizedStatus === "published" ? "published" : "unpublished");

      const existingAssessment = isExisting
        ? assessments.find((assessment) => assessment.id === assessmentId)
        : undefined;
      let assessmentImageUrl =
        formValues.assessmentImageUrl ||
        existingAssessment?.assessmentImageUrl ||
        "";
      let assessmentImagePath =
        formValues.assessmentImagePath ||
        existingAssessment?.assessmentImagePath ||
        "";

      if (selectedAssessmentImage) {
        const extension = sanitizeExtension(selectedAssessmentImage);
        const nextPath = `assessments/${formValues.tenantId}/${assessmentId}/cover.${extension}`;
        const storageRef = ref(storage, nextPath);
        await uploadBytes(storageRef, selectedAssessmentImage, { contentType: selectedAssessmentImage.type });
        assessmentImageUrl = await getDownloadURL(storageRef);
        assessmentImagePath = nextPath;
      }

      const promotionStatus = formValues.promoted && formValues.promotionPackageId.trim()
        ? (isSuperAdmin ? "promoted" : "requested")
        : "none";
      const categoryName = categoryOptionsForTenant.find((item) => item.id === formValues.categoryId)?.name ?? null;
      const subCategoryName = subCategoryOptionsForTenant.find((item) => item.id === formValues.subCategoryId)?.name ?? null;
      const hasListingPackage = formValues.listingPackageId.trim().length > 0;
      const listingStatus = hasPublishIntent && hasListingPackage
        ? (isSuperAdmin ? "approved" : "requested")
        : "none";

      const newQuestions = isExisting
        ? generatedQuestions.slice(existingQuestionCount)
        : generatedQuestions;

      await saveAssessmentDefinition({
        id: isExisting ? assessmentId : undefined,
        tenantId: formValues.tenantId,
        tenantIds: formValues.tenantIds,
        name: formValues.name.trim(),
        categoryId: formValues.categoryId.trim() || null,
        categoryName,
        subCategoryId: formValues.subCategoryId.trim() || null,
        subCategoryName,
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
        status: normalizedStatus,
        promoted: promotionStatus === "promoted",
        promotionPackageId: promotionStatus === "none" ? null : formValues.promotionPackageId.trim(),
        promotionStatus,
        listingPackageId: listingStatus === "none" ? null : formValues.listingPackageId.trim(),
        listingStatus,
        publicationState,
        visibility: formValues.visibility,
        ownershipScope: formValues.ownershipScope,
        ownerEntityId: formValues.ownerEntityId.trim(),
        generatedQuestions: newQuestions,
        existingQuestionCount,
      }, isExisting);

      if (promotionStatus === "requested") {
        const operatorId = auth.currentUser?.uid ?? "system";
        try {
          await chargePromotionRequestOnSubmission({
            resourceType: "assessment",
            resourceId: assessmentId,
            operatorId,
          });
        } catch (chargeError) {
          await denyAssessmentPromotionRequest({ assessmentId, operatorId });
          throw chargeError;
        }
      }

      if (isExisting) {
        setMessage(`Assessment "${formValues.name}" updated.`);
      } else {
        setMessage(`Assessment "${formValues.name}" saved with ${generatedQuestions.length} questions.`);
      }

      closeForm();

      // Refresh list
      const q = query(collection(db, "assessments"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AssessmentRecord, "id">) }));
      const filtered = selectedTenantId
        ? rows.filter((item) =>
            matchesTenantScope({
              primaryTenantId: item.tenantId,
              tenantIds: item.tenantIds,
              selectedTenantId,
            })
          )
        : rows;
      setAssessments(filtered);
    } catch (e: unknown) {
      const msg = getErrorMessage(e);
      setError(`Save failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className={styles.card}>
      <h2>Manage Assessments</h2>
      <p className={styles.subtitle}>
        Create tenant-wide Assessments for StudioVerse tenants. Publish to make them
        visible; promote to elevate them on the landing page.
      </p>

      {/* Toolbar */}
      <div className={styles.controlCard}>
        <div className={styles.actions}>
          <select
            className={styles.select}
            style={{ minWidth: 220, marginBottom: 0 }}
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
            aria-label="Filter by tenant"
          >
            <option value="">All tenants</option>
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
        <>
          <div className={styles.filterPillGroup}>
            <button
              type="button"
              className={`${styles.filterPill} ${selectedPublicationState === "all" ? styles.active : ""}`}
              onClick={() => setSelectedPublicationState("all")}
            >
              All
            </button>
            <button
              type="button"
              className={`${styles.filterPill} ${selectedPublicationState === "published" ? styles.active : ""}`}
              onClick={() => setSelectedPublicationState("published")}
            >
              Published
            </button>
            <button
              type="button"
              className={`${styles.filterPill} ${selectedPublicationState === "draft" ? styles.active : ""}`}
              onClick={() => setSelectedPublicationState("draft")}
            >
              Draft
            </button>
            <button
              type="button"
              className={`${styles.filterPill} ${selectedPromoted === "true" ? styles.active : ""}`}
              onClick={() => setSelectedPromoted("true")}
            >
              Promoted
            </button>
          </div>

          {visibleAssessments.length === 0 ? (
            <div className={styles.emptyCard}>No assessments matched the current search/filter.</div>
          ) : (
            <div className={styles.assessmentGrid}>
              {visibleAssessments.map((a) => (
                <article key={a.id} className={styles.assessmentTile}>
                  <div className={styles.assessmentImageWrap}>
                    <img
                      className={styles.assessmentImage}
                      src={a.assessmentImageUrl || tenantAssetPath(a.tenantId, "hero1.png")}
                      alt={a.name}
                      loading="lazy"
                    />
                  </div>
                  <div className={styles.assessmentContent}>
                    <p className={styles.assessmentTitle}>{a.name}</p>
                    {a.shortDescription ? (
                      <p className={styles.assessmentDescription}>{a.shortDescription}</p>
                    ) : null}
                    <p className={styles.assessmentMeta}>Type: {ASSESSMENT_TYPE_LABELS[a.assessmentType] ?? a.assessmentType}</p>
                    <p className={styles.assessmentMeta}>Render: {RENDER_STYLE_LABELS[a.renderStyle] ?? a.renderStyle}</p>
                    <p className={styles.assessmentMeta}>Credits: {a.creditsRequired ?? 0} • {a.questionBankCount} Questions ({a.questionsPerAttempt}/attempt)</p>
                    <p className={styles.assessmentMeta}>Visibility: {ASSESSMENT_VISIBILITY_LABELS[a.visibility === "private" ? "private" : "public"]}</p>
                    <p className={styles.assessmentMeta}>Promotion: {ASSESSMENT_PROMOTION_STATUS_LABELS[a.promotionStatus ?? "none"]}</p>
                    <p className={styles.assessmentMeta}>Listing: {ASSESSMENT_LISTING_STATUS_LABELS[a.listingStatus ?? "none"]}</p>
                  </div>

                  <div className={styles.assessmentActions}>
                    <span className={styles.statusBadge}>
                      {a.publicationState === "pending_publication_review" ? "Under Review" : normalizeAssessmentStatus(a.status)}
                    </span>
                    <button type="button" className={styles.rowAction} onClick={() => openEdit(a)}>
                      Edit
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
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

            {/* ── Section: Tenant ── */}
            <fieldset style={{ border: "1px solid #c6dcea", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
              <legend style={{ fontWeight: 700, padding: "0 6px" }}>Tenant</legend>

              <label className={styles.label} htmlFor="a-tenant">Tenants *</label>
              <div id="a-tenant" className={styles.controlCard}>
                <div className={styles.radioRow}>
                  {tenants.map((t) => {
                    const checked = formValues.tenantIds.includes(t.tenantId);
                    return (
                      <label key={t.id} className={styles.radioPill}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const nextTenantIds = checked
                              ? formValues.tenantIds.filter((tenantId) => tenantId !== t.tenantId)
                              : [...formValues.tenantIds, t.tenantId];
                            setField("tenantIds", nextTenantIds);
                            setField("tenantId", nextTenantIds[0] ?? "");
                          }}
                        />
                        <span>{t.tenantName}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </fieldset>

            {/* ── Section: Assessment ── */}
            <fieldset style={{ border: "1px solid #c6dcea", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
              <legend style={{ fontWeight: 700, padding: "0 6px" }}>Assessment</legend>

              <label className={styles.label} htmlFor="a-name">Assessment Name *</label>
              <input id="a-name" className={styles.input} value={formValues.name} onChange={(e) => setField("name", e.target.value)} placeholder="e.g. Leadership Self-Awareness Assessment" />

              <label className={styles.label} htmlFor="a-short">Short Description</label>
              <input id="a-short" className={styles.input} value={formValues.shortDescription} onChange={(e) => setField("shortDescription", e.target.value)} placeholder="One-line description shown in listings" />

              <label className={styles.label} htmlFor="a-long">Long Description</label>
              <textarea id="a-long" className={styles.input} rows={3} value={formValues.longDescription} onChange={(e) => setField("longDescription", e.target.value)} placeholder="Full description for the assessment detail page" style={{ resize: "vertical" }} />

              <label className={styles.label} htmlFor="a-context">Assessment Context</label>
              <textarea id="a-context" className={styles.input} rows={3} value={formValues.assessmentContext} onChange={(e) => setField("assessmentContext", e.target.value)} placeholder="Describe the professional context or scenario this assessment addresses" style={{ resize: "vertical" }} />

              <label className={styles.label} htmlFor="a-benefit">Participant Benefit</label>
              <textarea id="a-benefit" className={styles.input} rows={2} value={formValues.assessmentBenefit} onChange={(e) => setField("assessmentBenefit", e.target.value)} placeholder="What will the participant gain or learn from this assessment?" style={{ resize: "vertical" }} />
            </fieldset>

            {/* ── Section: Assessment Details ── */}
            <fieldset style={{ border: "1px solid #c6dcea", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
              <legend style={{ fontWeight: 700, padding: "0 6px" }}>Assessment Details</legend>

              <label className={styles.label} htmlFor="a-visibility">Visibility</label>
              <select id="a-visibility" className={styles.select} value={formValues.visibility} onChange={(e) => setField("visibility", e.target.value as AssessmentVisibility)}>
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>

              <div className={styles.actions}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label className={styles.label} htmlFor="a-category">Category</label>
                  <select
                    id="a-category"
                    className={styles.select}
                    value={formValues.categoryId}
                    onChange={(e) => {
                      setField("categoryId", e.target.value);
                      setField("subCategoryId", "");
                    }}
                  >
                    <option value="">Select category</option>
                    {categoryOptionsForTenant.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: 1, minWidth: 180 }}>
                  <label className={styles.label} htmlFor="a-sub-category">Sub Category</label>
                  <select
                    id="a-sub-category"
                    className={styles.select}
                    value={formValues.subCategoryId}
                    onChange={(e) => setField("subCategoryId", e.target.value)}
                    disabled={!formValues.categoryId}
                  >
                    <option value="">Select sub category</option>
                    {subCategoryOptionsForTenant
                      .filter((item) => item.categoryId === formValues.categoryId)
                      .map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              <label className={styles.label} htmlFor="a-thumbnail">Thumbnail</label>
              <input
                id="a-thumbnail"
                className={styles.input}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleAssessmentImageSelection(e.target.files?.[0] ?? null)}
              />
              {selectedAssessmentImage ? (
                <p className={styles.info}>Selected image: {selectedAssessmentImage.name}</p>
              ) : null}
              {!selectedAssessmentImage && formValues.assessmentImageUrl ? (
                <button
                  type="button"
                  className={styles.ghostButton}
                  onClick={() => {
                    setSelectedAssessmentImage(null);
                    setField("assessmentImageUrl", "");
                    setField("assessmentImagePath", "");
                  }}
                  style={{ marginBottom: 8 }}
                >
                  Remove current image
                </button>
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
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
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
                  <input id="a-owner" className={styles.input} value={formValues.ownerEntityId} onChange={(e) => setField("ownerEntityId", e.target.value)} placeholder="Optional - leave blank for platform-level" />
                </div>
              </div>
            </fieldset>

            {/* ── Section: Publish ── */}
            <fieldset style={{ border: "1px solid #c6dcea", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
              <legend style={{ fontWeight: 700, padding: "0 6px" }}>Publish</legend>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <div>
                  <label className={styles.radioPill}>
                    <input
                      id="a-publish"
                      type="checkbox"
                      checked={formValues.status === "published"}
                      onChange={(e) => {
                        const nextPublished = e.target.checked;
                        setField("status", nextPublished ? "published" : "draft");
                        if (!nextPublished) {
                          setField("listingPackageId", "");
                          setField("listingStatus", "none");
                        }
                      }}
                    />
                    <span>Publish now</span>
                  </label>
                </div>
                <div>
                  <label className={styles.label} htmlFor="a-listing-package">Listing Package</label>
                  <select
                    id="a-listing-package"
                    className={styles.select}
                    value={formValues.listingPackageId}
                    onChange={(e) => setField("listingPackageId", e.target.value)}
                    disabled={formValues.status !== "published" || listingPackagesLoading}
                  >
                    <option value="">
                      {formValues.status === "published" ? "Select listing package" : "Enable publish first"}
                    </option>
                    {listingPackages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name} • {pkg.durationValue} {pkg.durationUnit} • {pkg.costCredits} credits
                      </option>
                    ))}
                  </select>
                  {formValues.status === "published" && !listingPackagesLoading && listingPackages.length === 0 ? (
                    <p className={styles.subtitle}>No active Assessment listing packages found for this tenant.</p>
                  ) : null}
                </div>
              </div>
            </fieldset>

            {/* ── Section: Promotion ── */}
            <fieldset style={{ border: "1px solid #c6dcea", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
              <legend style={{ fontWeight: 700, padding: "0 6px" }}>Promotion</legend>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <div>
                  <label className={styles.radioPill}>
                    <input
                      id="a-promoted"
                      type="checkbox"
                      checked={formValues.promoted}
                      onChange={(e) => {
                        const nextPromoted = e.target.checked;
                        setField("promoted", nextPromoted);
                        setField("promotionStatus", nextPromoted ? "requested" : "none");
                        if (!nextPromoted) {
                          setField("promotionPackageId", "");
                        }
                      }}
                    />
                    <span>Promote now</span>
                  </label>
                </div>
                <div>
                  <label className={styles.label} htmlFor="a-promotion-package">Promotion Package</label>
                  <select
                    id="a-promotion-package"
                    className={styles.select}
                    value={formValues.promotionPackageId}
                    onChange={(e) => setField("promotionPackageId", e.target.value)}
                    disabled={!formValues.promoted || promotionPackagesLoading}
                  >
                    <option value="">{formValues.promoted ? "Select promotion package" : "Enable promotion request first"}</option>
                    {promotionPackages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name} • {pkg.durationValue} {pkg.durationUnit} • {pkg.costCredits} credits
                      </option>
                    ))}
                  </select>
                  {!promotionPackagesLoading && formValues.promoted && promotionPackages.length === 0 ? (
                    <p className={styles.subtitle}>No active Assessment promotion packages found for this tenant.</p>
                  ) : null}
                </div>
              </div>
            </fieldset>

            {/* ── Section: Generate Questions ── */}
            <fieldset style={{ border: "1px solid #c6dcea", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
              <legend style={{ fontWeight: 700, padding: "0 6px" }}>Generate Questions</legend>

              <label className={styles.label} htmlFor="a-gen-prompt">Question Generation Prompt *</label>
              <textarea id="a-gen-prompt" className={styles.input} rows={4} value={formValues.questionGenerationPrompt} onChange={(e) => setField("questionGenerationPrompt", e.target.value)} placeholder={`Describe the type of questions to generate. Use [No of Questions] or [NO_OF_QUESTIONS] as a placeholder.\nE.g. "Generate exactly [NO_OF_QUESTIONS] self-awareness questions for senior leaders that explore emotional intelligence, blind spots, and behavioural patterns."`} style={{ resize: "vertical" }} />

              <label className={styles.label} htmlFor="a-bank-count">Questions to Generate</label>
              <input id="a-bank-count" type="number" min={1} max={100} className={styles.input} value={formValues.questionBankCount} onChange={(e) => setField("questionBankCount", e.target.value)} />

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

              {processedPromptPreview ? (
                <div style={{ marginTop: 10, border: "1px solid #c6dcea", borderRadius: 10, background: "#f6fbff", padding: 10 }}>
                  <p style={{ margin: "0 0 6px 0", fontSize: "0.82rem", color: "#1a6189", fontWeight: 700 }}>Processed Prompt Preview</p>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace", fontSize: "0.8rem", color: "#335269" }}>
                    {processedPromptPreview}
                  </pre>
                </div>
              ) : null}
            </fieldset>

            {/* ── Section: Analysis Prompt ── */}
            <fieldset style={{ border: "1px solid #c6dcea", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
              <legend style={{ fontWeight: 700, padding: "0 6px" }}>Analysis Prompt</legend>

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

              <label className={styles.label} htmlFor="a-analysis-prompt">Analysis Prompt</label>
              <textarea id="a-analysis-prompt" className={styles.input} rows={3} value={formValues.analysisPrompt} onChange={(e) => setField("analysisPrompt", e.target.value)} placeholder="Describe how the AI should interpret submitted answers and generate the narrative report for this assessment" style={{ resize: "vertical" }} />
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
