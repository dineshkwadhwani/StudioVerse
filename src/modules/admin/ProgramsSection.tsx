"use client";

import { useEffect, useState, startTransition } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import ProgramForm from "./ProgramForm";
import styles from "./SuperAdminPortal.module.css";
import { auth, db } from "@/services/firebase";
import {
  createProgramFormValues,
  normalizeProgramForm,
  validateProgramForm,
  type ProgramFormErrors,
} from "@/lib/validation/program.schema";
import {
  buildProgramId,
  listPrograms,
  saveProgram,
  uploadProgramThumbnail,
  validateThumbnailFile,
} from "@/services/programs.service";
import {
  chargePromotionRequestOnSubmission,
  denyProgramPromotionRequest,
} from "@/services/programPromotionRequests.service";
import { listActivePromotionPackagesForTenant } from "@/services/promotionPackages.service";
import { listActiveListingPackagesForTenant } from "@/services/listingPackages.service";
import { getWalletByUserAndTenant } from "@/services/wallet.service";
import { listCategories, listSubCategories, listTopics } from "@/services/categories.service";
import { listLanguages } from "@/services/languages.service";
import {
  PROGRAM_STATUS_LABELS,
  PROGRAM_VISIBILITY_LABELS,
  toDateInputValue,
  type ProgramFormValues,
  type ProgramRecord,
  type ProgramSaveMode,
} from "@/types/program";
import type { PromotionPackageRecord } from "@/types/promotionPackage";
import type { ListingPackageRecord } from "@/types/listingPackage";
import type { CategoryRecord, SubCategoryRecord, TopicRecord } from "@/types/category";
import type { LanguageRecord } from "@/services/languages.service";
import type { CompetencyLevelOption } from "@/types/competency";
import { getTenantCompetencyFrameworkDetails } from "@/services/tenant-competency.service";
import { tenantAssetPath } from "@/lib/tenant/assets";

type TenantOption = {
  id: string;
  tenantId: string;
  tenantName: string;
  status: string;
};

type ProgramsSectionProps = {
  tenants?: TenantOption[];
  isSuperAdmin?: boolean;
  searchQuery?: string;
};

function mapProgramToForm(program: ProgramRecord): ProgramFormValues {
  const tenantIds = Array.isArray(program.tenantIds) && program.tenantIds.length > 0
    ? program.tenantIds
    : [program.tenantId];

  return createProgramFormValues({
    id: program.id,
    tenantId: program.tenantId,
    tenantIds,
    competencyLevel: String(program.competencyLevel ?? 1),
    name: program.name,
    categoryId: program.categoryId ?? "",
    subCategoryId: program.subCategoryId ?? "",
    topicIds: Array.isArray(program.topicIds) ? program.topicIds : [],
    shortDescription: program.shortDescription,
    longDescription: program.longDescription,
    deliveryType: program.deliveryType,
    durationValue: String(program.durationValue),
    durationUnit: program.durationUnit,
    details: program.details,
    videoUrl: program.videoUrl ?? "",
    creditsRequired: String(program.creditsRequired),
    availableFrom: toDateInputValue(program.availableFrom),
    expiresAt: toDateInputValue(program.expiresAt),
    status: program.status,
    facilitatorName: program.facilitatorName ?? "",
    promoted: program.promotionStatus === "requested" || program.promotionStatus === "promoted",
    promotionPackageId: program.promotionPackageId ?? "",
    promotionStatus: program.promotionStatus,
    listingPackageId: program.listingPackageId ?? "",
    listingStatus: program.listingStatus ?? (program.publicationState === "pending_publication_review" ? "requested" : "none"),
    published: program.publicationState === "published",
    visibility: program.visibility === "private" ? "private" : "public",
    ownershipScope: program.ownershipScope,
    ownerEntityId: program.ownerEntityId ?? "",
    catalogVisibility: program.catalogVisibility,
    publicationState: program.publicationState,
    thumbnailUrl: program.thumbnailUrl ?? "",
    thumbnailPath: program.thumbnailPath ?? "",
  });
}

export default function ProgramsSection({ tenants: propTenants, isSuperAdmin, searchQuery = "" }: ProgramsSectionProps) {
  const [programs, setPrograms] = useState<ProgramRecord[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>(propTenants ?? []);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [formErrors, setFormErrors] = useState<ProgramFormErrors>({});
  const [formOpen, setFormOpen] = useState(false);
  const [formValues, setFormValues] = useState<ProgramFormValues>(createProgramFormValues());
  const [selectedThumbnail, setSelectedThumbnail] = useState<File | null>(null);
  const [promotionPackages, setPromotionPackages] = useState<PromotionPackageRecord[]>([]);
  const [promotionPackagesLoading, setPromotionPackagesLoading] = useState(false);
  const [listingPackages, setListingPackages] = useState<ListingPackageRecord[]>([]);
  const [listingPackagesLoading, setListingPackagesLoading] = useState(false);
  const [selectedPublicationState, setSelectedPublicationState] = useState<string>("all");
  const [selectedPromoted, setSelectedPromoted] = useState<string>("all");
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategoryRecord[]>([]);
  const [topics, setTopics] = useState<TopicRecord[]>([]);
  const [languages, setLanguages] = useState<LanguageRecord[]>([]);
  const [competencyLevelOptions, setCompetencyLevelOptions] = useState<CompetencyLevelOption[]>([]);
  const [competencyFrameworkName, setCompetencyFrameworkName] = useState<string | null>(null);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const visiblePrograms = programs.filter((program) => {
    if (selectedPublicationState !== "all" && program.publicationState !== selectedPublicationState) {
      return false;
    }
    if (selectedPromoted === "true" && !program.promoted) {
      return false;
    }
    if (!normalizedSearchQuery) {
      return true;
    }

    const searchableText = [
      program.name,
      program.shortDescription,
      program.longDescription,
      program.details,
      program.facilitatorName,
      program.deliveryType,
      typeof program.durationValue === "number" ? String(program.durationValue) : "",
      program.durationUnit,
      program.visibility,
      program.publicationState,
      program.status,
      program.categoryName,
      program.subCategoryName,
    ]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join(" ")
      .toLowerCase();

    return searchableText.includes(normalizedSearchQuery);
  });
  const categoryOptionsForTenant = categories.filter((item) => item.tenantId === formValues.tenantId);
  const subCategoryOptionsForTenant = subCategories.filter((item) => item.tenantId === formValues.tenantId);

  async function loadTenants(): Promise<void> {
    try {
      const q = query(collection(db, "tenants"), where("status", "==", "active"));
      const snapshot = await getDocs(q);
      const loadedTenants: TenantOption[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        tenantId: doc.data().tenantId,
        tenantName: doc.data().tenantName,
        status: doc.data().status,
      }));
      setTenants(loadedTenants);
    } catch (loadError) {
      console.error("Failed to load tenants:", loadError);
      setError("Could not load tenants.");
    }
  }

  async function refreshPrograms(tenantId?: string): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const nextPrograms = await listPrograms(tenantId);
      startTransition(() => setPrograms(nextPrograms));
    } catch (loadError) {
      console.error(loadError);
      setError("Could not load Programs right now.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTenants();
  }, []);

  useEffect(() => {
    async function loadCategoryOptions(): Promise<void> {
      try {
        const [nextCategories, nextSubCategories, nextTopics] = await Promise.all([
          listCategories(),
          listSubCategories(),
          listTopics(),
        ]);
        setCategories(nextCategories);
        setSubCategories(nextSubCategories);
        setTopics(nextTopics);
      } catch (loadError) {
        console.error("Failed to load categories/languages for Program form:", loadError);
      }
    }

    void loadCategoryOptions();
  }, []);

  useEffect(() => {
    async function loadCompetencyFramework(): Promise<void> {
      const details = await getTenantCompetencyFrameworkDetails(formValues.tenantId);
      setCompetencyLevelOptions(details.options);
      setCompetencyFrameworkName(details.framework?.competencyName ?? null);
      setFormValues((prev) => ({
        ...prev,
        competencyLevel: prev.competencyLevel || "1",
      }));
    }

    void loadCompetencyFramework();
  }, [formValues.tenantId]);

  useEffect(() => {
    async function loadLanguageOptions(): Promise<void> {
      try {
        const nextLanguages = await listLanguages(formValues.tenantId);
        setLanguages(nextLanguages);
      } catch (loadError) {
        console.error("Failed to load languages for Program form:", loadError);
      }
    }

    void loadLanguageOptions();
  }, [formValues.tenantId]);

  useEffect(() => {
    void refreshPrograms(selectedTenantId || undefined);
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
        setPromotionPackages(loaded.filter((pkg) => pkg.resourceType === "program"));
      } catch (loadError) {
        console.error("Failed to load promotion packages for Program form:", loadError);
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
        setListingPackages(loaded.filter((pkg) => pkg.resourceType === "program"));
      } catch (loadError) {
        console.error("Failed to load listing packages for Program form:", loadError);
        setListingPackages([]);
      } finally {
        setListingPackagesLoading(false);
      }
    }

    void loadListingPackagesForForm();
  }, [formOpen, formValues.tenantId]);

  function openCreate(): void {
    const defaultTenantId = selectedTenantId || tenants.find((tenant) => tenant.status === "active")?.tenantId || "";
    setFormValues(createProgramFormValues({ tenantId: defaultTenantId, tenantIds: defaultTenantId ? [defaultTenantId] : [] }));
    setSelectedThumbnail(null);
    setFormErrors({});
    setMessage("");
    setError("");
    setFormOpen(true);
  }

  function openEdit(program: ProgramRecord): void {
    setFormValues(mapProgramToForm(program));
    setSelectedThumbnail(null);
    setFormErrors({});
    setMessage("");
    setError("");
    setFormOpen(true);
  }

  function closeForm(): void {
    setFormOpen(false);
    setFormErrors({});
    setSelectedThumbnail(null);
  }

  function updateField<K extends keyof ProgramFormValues>(field: K, nextValue: ProgramFormValues[K]): void {
    setFormValues((previous) => ({ ...previous, [field]: nextValue }));
  }

  function handleThumbnailSelection(file: File | null): void {
    setFormErrors((previous) => ({ ...previous, thumbnailUrl: undefined }));
    if (!file) {
      setSelectedThumbnail(null);
      return;
    }

    const validationError = validateThumbnailFile(file);
    if (validationError) {
      setSelectedThumbnail(null);
      setFormErrors((previous) => ({ ...previous, thumbnailUrl: validationError }));
      return;
    }

    setSelectedThumbnail(file);
  }

  function removeCurrentThumbnail(): void {
    setSelectedThumbnail(null);
    setFormValues((previous) => ({
      ...previous,
      thumbnailUrl: "",
      thumbnailPath: "",
    }));
    setFormErrors((previous) => ({ ...previous, thumbnailUrl: undefined }));
  }

  async function validatePromotionCreditsForRequester(values: ProgramFormValues): Promise<string | null> {
    if (!values.promoted || !values.promotionPackageId) {
      return null;
    }

    const role = typeof window !== "undefined" ? sessionStorage.getItem("cs_role") : null;
    const requiresCreditCheck = role === "company" || role === "professional";
    if (!requiresCreditCheck) {
      return null;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) {
      return "Unable to verify wallet. Please sign in again.";
    }

    const wallet = await getWalletByUserAndTenant({ userId: uid, tenantId: values.tenantId });
    const availableCoins = wallet?.availableCoins ?? 0;

    let selectedPackage = promotionPackages.find((pkg) => pkg.id === values.promotionPackageId);
    if (!selectedPackage && values.tenantId) {
      const loaded = await listActivePromotionPackagesForTenant(values.tenantId);
      selectedPackage = loaded.find((pkg) => pkg.resourceType === "program" && pkg.id === values.promotionPackageId);
    }

    if (!selectedPackage) {
      return "Selected promotion package is unavailable.";
    }

    if (availableCoins < selectedPackage.costCredits) {
      return `Not enough credits. Required: ${selectedPackage.costCredits}, Available: ${availableCoins}.`;
    }

    return null;
  }

  async function submit(): Promise<void> {
    setBusy(true);
    setError("");
    setMessage("");

    console.log("[ProgramsSection] Submit started. Categories loaded:", categories.length, "SubCategories loaded:", subCategories.length);

    try {
      // Determine mode based on the published checkbox
      const mode: ProgramSaveMode = formValues.published ? "publish" : "draft";

      const preliminaryErrors = validateProgramForm(formValues, mode, {
        hasSelectedThumbnail: Boolean(selectedThumbnail),
        isSuperAdmin,
      });
      if (Object.keys(preliminaryErrors).length > 0) {
        setFormErrors(preliminaryErrors);
        return;
      }

      const creditValidationError = await validatePromotionCreditsForRequester(formValues);
      if (creditValidationError) {
        setFormErrors((previous) => ({ ...previous, promotionPackageId: creditValidationError }));
        setFormValues((previous) => ({
          ...previous,
          promoted: false,
          promotionStatus: "none",
        }));
        return;
      }

      // isExisting must be captured BEFORE we generate a new id,
      // because formValues.id is only set when the form was opened via Edit.
      const isExisting = Boolean(formValues.id);
      const nextId = formValues.id ?? buildProgramId();
      const existingProgram = isExisting
        ? programs.find((program) => program.id === nextId)
        : undefined;
      let nextThumbnailUrl =
        formValues.thumbnailUrl ||
        existingProgram?.thumbnailUrl ||
        "";
      let nextThumbnailPath =
        formValues.thumbnailPath ||
        existingProgram?.thumbnailPath ||
        "";

      if (selectedThumbnail) {
        setUploadBusy(true);
        const uploadResult = await uploadProgramThumbnail({
          tenantId: formValues.tenantIds[0] || formValues.tenantId,
          programId: nextId,
          file: selectedThumbnail,
        });
        nextThumbnailUrl = uploadResult.thumbnailUrl;
        nextThumbnailPath = uploadResult.thumbnailPath;
      }

      const nextFormValues = {
        ...formValues,
        id: nextId,
        thumbnailUrl: nextThumbnailUrl,
        thumbnailPath: nextThumbnailPath,
      };

      const payload = normalizeProgramForm(nextFormValues, mode, isSuperAdmin);
      const categoryName = categoryOptionsForTenant.find((item) => item.id === payload.categoryId)?.name ?? null;
      const subCategoryName = subCategoryOptionsForTenant.find((item) => item.id === payload.subCategoryId)?.name ?? null;
      
      // Debug logging for category persistence issue
      const debugInfo = {
        categoryId: payload.categoryId,
        categoryName,
        subCategoryId: payload.subCategoryId,
        subCategoryName,
        categoryOptionsCount: categoryOptionsForTenant.length,
        subCategoryOptionsCount: subCategoryOptionsForTenant.length,
      };
      console.log("[ProgramsSection] Save program - Category debug:", JSON.stringify(debugInfo, null, 2));
      
      const savePayload = {
        ...payload,
        categoryName,
        subCategoryName,
        topicIds: formValues.topicIds ?? [],
      };
      console.log("[ProgramsSection] Payload being sent to saveProgram:", JSON.stringify(savePayload, (k, v) => typeof v === 'object' ? '[object]' : v, 2));
      
      await saveProgram(
        savePayload,
        mode,
        isExisting,
      );

      if (payload.promotionStatus === "requested" && nextId) {
        const operatorId = auth.currentUser?.uid ?? "system";
        try {
          await chargePromotionRequestOnSubmission({
            resourceType: "program",
            resourceId: nextId,
            operatorId,
          });
        } catch (chargeError) {
          await denyProgramPromotionRequest({ programId: nextId, operatorId });
          throw chargeError;
        }
      }

      setFormValues(nextFormValues);
      setFormOpen(false);
      setSelectedThumbnail(null);
      setFormErrors({});
      
      const action = isExisting ? "updated" : "created";
      const publicationStatus = formValues.published
        ? (isSuperAdmin ? " and published" : " and submitted for listing approval")
        : " as draft";
      setMessage(`Program ${action}${publicationStatus}.`);
      
      await refreshPrograms(selectedTenantId || undefined);
    } catch (submitError) {
      console.error(submitError);
      const callableError = submitError as {
        message?: string;
        details?: {
          fieldErrors?: Record<string, string>;
          issues?: string[];
        };
      };

      const fieldErrors = callableError.details?.fieldErrors ?? {};
      const detailsIssues = callableError.details?.issues ?? [];

      if (Object.keys(fieldErrors).length > 0) {
        setFormErrors((previous) => ({ ...previous, ...fieldErrors }));
        setError("Please fix the highlighted fields.");
      } else if (detailsIssues.length > 0) {
        const issueMessage = detailsIssues.join(" ");
        setError(issueMessage);
        setFormErrors((previous) => ({ ...previous, form: issueMessage }));
      } else {
        const messageText = callableError.message || "Program save failed.";
        setError(messageText);
        setFormErrors((previous) => ({ ...previous, form: messageText }));
      }
    } finally {
      setBusy(false);
      setUploadBusy(false);
    }
  }

  return (
    <article className={styles.card}>
      <h2>Manage Programs</h2>
      <p className={styles.subtitle}>
        Create tenant-wide Programs for StudioVerse tenants, save drafts, and publish when metadata is complete.
      </p>

      <div className={styles.controlCard}>
        <div className={styles.actions}>
          <select
            className={styles.select}
            value={selectedTenantId}
            onChange={(event) => setSelectedTenantId(event.target.value)}
            style={{ minWidth: 220, marginBottom: 0 }}
          >
            <option value="">All tenants</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.tenantId}>
                {tenant.tenantName}
              </option>
            ))}
          </select>
          <button type="button" className={styles.button} onClick={openCreate}>
            Add Program
          </button>
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      {message ? <p className={styles.info}>{message}</p> : null}

      {loading ? (
        <div className={styles.emptyCard}>Loading Programs...</div>
      ) : programs.length === 0 ? (
        <div className={styles.emptyCard}>No Programs found for the selected tenant filter.</div>
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

          {visiblePrograms.length === 0 ? (
            <div className={styles.emptyCard}>No Programs matched the current search/filter.</div>
          ) : (
            <div className={styles.programGrid}>
              {visiblePrograms.map((program) => (
                <article key={program.id} className={styles.programTile}>
                  <div className={styles.programImageWrap}>
                    <img
                      className={styles.programImage}
                      src={program.thumbnailUrl || tenantAssetPath(program.tenantId, "hero1.png")}
                      alt={program.name}
                      loading="lazy"
                    />
                  </div>
                  <div className={styles.programContent}>
                    <p className={styles.programTitle}>{program.name}</p>
                    {program.shortDescription ? (
                      <p className={styles.programDescription}>{program.shortDescription}</p>
                    ) : null}
                    <p className={styles.programMeta}>Delivery: {program.deliveryType}</p>
                    <p className={styles.programMeta}>Duration: {program.durationValue} {program.durationUnit}</p>
                    <p className={styles.programMeta}>Visibility: {PROGRAM_VISIBILITY_LABELS[program.visibility]}</p>
                  </div>

                  <div className={styles.programActions}>
                    <span className={styles.statusBadge}>
                      {program.publicationState === "pending_publication_review" ? "Under Review" : PROGRAM_STATUS_LABELS[program.status]}
                    </span>
                    <button type="button" className={styles.rowAction} onClick={() => openEdit(program)}>
                      Edit
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {formOpen ? (
        <ProgramForm
          tenants={tenants}
          value={formValues}
          errors={formErrors}
          busy={busy}
          uploadBusy={uploadBusy}
          editing={Boolean(formValues.id)}
          thumbnailName={selectedThumbnail?.name ?? null}
          promotionPackages={promotionPackages}
          promotionPackagesLoading={promotionPackagesLoading}
          listingPackages={listingPackages}
          listingPackagesLoading={listingPackagesLoading}
          categories={categoryOptionsForTenant}
          competencyLevelOptions={competencyLevelOptions}
          competencyFrameworkName={competencyFrameworkName}
          subCategories={subCategoryOptionsForTenant}
          topics={topics.filter((t) => t.tenantId === formValues.tenantId && t.subCategoryId === formValues.subCategoryId)}
          languages={languages}
          onChange={updateField}
          onThumbnailSelect={handleThumbnailSelection}
          onRemoveThumbnail={removeCurrentThumbnail}
          onCancel={closeForm}
          onSave={() => void submit()}
        />
      ) : null}
    </article>
  );
}
