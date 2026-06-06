"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/services/firebase";
import type { TenantConfig } from "@/types/tenant";
import EventForm from "@/modules/admin/EventForm";
import TenantViewAllHeader from "@/modules/landing/components/ViewAllHeader";
import {
  createEventFormValues,
  normalizeEventForm,
  validateEventForm,
  type EventFormErrors,
} from "@/lib/validation/event.schema";
import {
  buildEventId,
  saveEvent,
  uploadEventThumbnail,
  validateEventThumbnailFile,
} from "@/services/events.service";
import {
  chargePromotionRequestOnSubmission,
  denyEventPromotionRequest,
} from "@/services/programPromotionRequests.service";
import { listActivePromotionPackagesForTenant } from "@/services/promotionPackages.service";
import { listActiveListingPackagesForTenant } from "@/services/listingPackages.service";
import { getWalletByUserAndTenant } from "@/services/wallet.service";
import { getTenantCompetencyFrameworkDetails } from "@/services/tenant-competency.service";
import { listCategories, listSubCategories } from "@/services/categories.service";
import { type EventFormValues, type EventSaveMode } from "@/types/event";
import type { PromotionPackageRecord } from "@/types/promotionPackage";
import type { ListingPackageRecord } from "@/types/listingPackage";
import type { CategoryRecord, SubCategoryRecord } from "@/types/category";
import type { CompetencyLevelOption } from "@/types/competency";
import styles from "@/modules/admin/SuperAdminPortal.module.css";

type Props = {
  config: TenantConfig;
};

type UserRole = "company" | "professional" | "superadmin";

function isAllowedRole(value: unknown): value is UserRole {
  return value === "company" || value === "professional" || value === "superadmin";
}

export default function CreateEventPage({ config }: Props) {
  const router = useRouter();
  const tenantId = config.id;
  const basePath = `/${tenantId}`;

  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [formErrors, setFormErrors] = useState<EventFormErrors>({});
  const [formValues, setFormValues] = useState<EventFormValues>(
    createEventFormValues({ tenantId, tenantIds: [tenantId] })
  );
  const [selectedThumbnail, setSelectedThumbnail] = useState<File | null>(null);
  const [promotionPackages, setPromotionPackages] = useState<PromotionPackageRecord[]>([]);
  const [promotionPackagesLoading, setPromotionPackagesLoading] = useState(false);
  const [listingPackages, setListingPackages] = useState<ListingPackageRecord[]>([]);
  const [listingPackagesLoading, setListingPackagesLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [competencyLevelOptions, setCompetencyLevelOptions] = useState<CompetencyLevelOption[]>([]);
  const [competencyFrameworkName, setCompetencyFrameworkName] = useState<string | null>(null);
  const [subCategories, setSubCategories] = useState<SubCategoryRecord[]>([]);
  const categoryOptionsForTenant = categories.filter((item) => item.tenantId === tenantId);
  const subCategoryOptionsForTenant = subCategories.filter((item) => item.tenantId === tenantId);

  useEffect(() => {
    const storedRoleRaw = sessionStorage.getItem("cs_role");
    if (!isAllowedRole(storedRoleRaw)) {
      router.replace(basePath);
      return;
    }
    setUserRole(storedRoleRaw);

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        router.replace(basePath);
      }
    });
    return () => unsubscribe();
  }, [basePath, router]);

  useEffect(() => {
    async function loadPackages(): Promise<void> {
      if (!tenantId) return;
      setPromotionPackagesLoading(true);
      setListingPackagesLoading(true);
      try {
        const [promo, listing] = await Promise.all([
          listActivePromotionPackagesForTenant(tenantId),
          listActiveListingPackagesForTenant(tenantId),
        ]);
        setPromotionPackages(promo.filter((pkg) => pkg.resourceType === "event"));
        setListingPackages(listing.filter((pkg) => pkg.resourceType === "event"));
      } catch (err) {
        console.error("Failed to load packages:", err);
      } finally {
        setPromotionPackagesLoading(false);
        setListingPackagesLoading(false);
      }
    }
    void loadPackages();
  }, [tenantId]);

  useEffect(() => {
    async function loadCompetencyFramework(): Promise<void> {
      const details = await getTenantCompetencyFrameworkDetails(tenantId);
      setCompetencyLevelOptions(details.options);
      setCompetencyFrameworkName(details.framework?.competencyName ?? null);
    }

    void loadCompetencyFramework();
  }, [tenantId]);

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
        console.error("Failed to load category options:", loadError);
      }
    }

    void loadCategoryOptions();
  }, []);

  function updateField<K extends keyof EventFormValues>(field: K, nextValue: EventFormValues[K]): void {
    setFormValues((prev) => ({ ...prev, [field]: nextValue }));
  }

  function handleThumbnailSelection(file: File | null): void {
    setFormErrors((prev) => ({ ...prev, thumbnailUrl: undefined }));
    if (!file) { setSelectedThumbnail(null); return; }
    const validationError = validateEventThumbnailFile(file);
    if (validationError) {
      setSelectedThumbnail(null);
      setFormErrors((prev) => ({ ...prev, thumbnailUrl: validationError }));
      return;
    }
    setSelectedThumbnail(file);
  }

  function removeCurrentThumbnail(): void {
    setSelectedThumbnail(null);
    setFormValues((prev) => ({ ...prev, thumbnailUrl: "", thumbnailPath: "" }));
    setFormErrors((prev) => ({ ...prev, thumbnailUrl: undefined }));
  }

  async function validatePromotionCredits(values: EventFormValues): Promise<string | null> {
    if (!values.promoted || !values.promotionPackageId) return null;
    const uid = auth.currentUser?.uid;
    if (!uid) return "Unable to verify wallet. Please sign in again.";
    const wallet = await getWalletByUserAndTenant({ userId: uid, tenantId: values.tenantId });
    const availableCoins = wallet?.availableCoins ?? 0;
    const selectedPackage = promotionPackages.find((pkg) => pkg.id === values.promotionPackageId);
    if (!selectedPackage) return "Selected promotion package is unavailable.";
    if (availableCoins < selectedPackage.costCredits) {
      return `Not enough credits. Required: ${selectedPackage.costCredits}, Available: ${availableCoins}.`;
    }
    return null;
  }

  async function submit(): Promise<void> {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const mode: EventSaveMode = formValues.published ? "publish" : "draft";
      const isSuperAdmin = userRole === "superadmin";

      const preliminaryErrors = validateEventForm(formValues, mode, {
        hasSelectedThumbnail: Boolean(selectedThumbnail),
        isSuperAdmin,
      });
      if (Object.keys(preliminaryErrors).length > 0) {
        setFormErrors(preliminaryErrors);
        return;
      }

      const creditError = await validatePromotionCredits(formValues);
      if (creditError) {
        setFormErrors((prev) => ({ ...prev, promotionPackageId: creditError }));
        setFormValues((prev) => ({ ...prev, promoted: false, promotionStatus: "none" }));
        return;
      }

      const nextId = buildEventId();
      let nextThumbnailUrl = formValues.thumbnailUrl || "";
      let nextThumbnailPath = formValues.thumbnailPath || "";

      if (selectedThumbnail) {
        setUploadBusy(true);
        const uploadResult = await uploadEventThumbnail({
          tenantId: formValues.tenantIds[0] || formValues.tenantId,
          eventId: nextId,
          file: selectedThumbnail,
        });
        nextThumbnailUrl = uploadResult.thumbnailUrl;
        nextThumbnailPath = uploadResult.thumbnailPath;
      }

      const nextFormValues: EventFormValues = { ...formValues, id: nextId, thumbnailUrl: nextThumbnailUrl, thumbnailPath: nextThumbnailPath };
      const payload = normalizeEventForm(nextFormValues, mode, isSuperAdmin);
      const categoryName = categoryOptionsForTenant.find((item) => item.id === payload.categoryId)?.name ?? null;
      const subCategoryName = subCategoryOptionsForTenant.find((item) => item.id === payload.subCategoryId)?.name ?? null;
      await saveEvent({ ...payload, categoryName, subCategoryName }, mode, false);

      if (payload.promotionStatus === "requested" && nextId) {
        const operatorId = auth.currentUser?.uid ?? "system";
        try {
          await chargePromotionRequestOnSubmission({ resourceType: "event", resourceId: nextId, operatorId });
        } catch (chargeError) {
          await denyEventPromotionRequest({ eventId: nextId, operatorId });
          throw chargeError;
        }
      }

      const publicationStatus = formValues.published ? " and submitted for listing approval" : " as draft";
      setMessage(`Event created${publicationStatus}.`);
      setTimeout(() => router.push(`${basePath}/manage-resources`), 1500);
    } catch (submitError) {
      console.error(submitError);
      const callableError = submitError as { message?: string; details?: { fieldErrors?: Record<string, string>; issues?: string[] } };
      const fieldErrors = callableError.details?.fieldErrors ?? {};
      const detailsIssues = callableError.details?.issues ?? [];
      if (Object.keys(fieldErrors).length > 0) {
        setFormErrors((prev) => ({ ...prev, ...fieldErrors }));
        setError("Please fix the highlighted fields.");
      } else if (detailsIssues.length > 0) {
        const issueMessage = detailsIssues.join(" ");
        setError(issueMessage);
        setFormErrors((prev) => ({ ...prev, form: issueMessage }));
      } else {
        const messageText = callableError.message || "Event save failed.";
        setError(messageText);
        setFormErrors((prev) => ({ ...prev, form: messageText }));
      }
    } finally {
      setBusy(false);
      setUploadBusy(false);
    }
  }

  if (!userRole) return null;

  return (
    <div>
      <TenantViewAllHeader config={config} currentPage="events" onSignInRegister={() => undefined} />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1rem" }}>
        <div className={styles.card}>
          <h2>Create Event</h2>
          <p className={styles.subtitle}>
            Events you create will be available within your workspace scope. They will appear in the wider catalogue only after a listing package is selected and approved.
          </p>
          {error ? <p className={styles.error}>{error}</p> : null}
          {message ? <p className={styles.info}>{message}</p> : null}
          <EventForm
            tenants={[{ id: tenantId, tenantId, tenantName: config.name, status: "active" }]}
            value={formValues}
            errors={formErrors}
            busy={busy}
            uploadBusy={uploadBusy}
            editing={false}
            thumbnailName={selectedThumbnail?.name ?? null}
            promotionPackages={promotionPackages}
            promotionPackagesLoading={promotionPackagesLoading}
            listingPackages={listingPackages}
            listingPackagesLoading={listingPackagesLoading}
            competencyLevelOptions={competencyLevelOptions}
            competencyFrameworkName={competencyFrameworkName}
            categories={categoryOptionsForTenant}
            subCategories={subCategoryOptionsForTenant}
            onChange={updateField}
            onThumbnailSelect={handleThumbnailSelection}
            onRemoveThumbnail={removeCurrentThumbnail}
            onCancel={() => router.push(`${basePath}/manage-resources`)}
            onSave={() => void submit()}
          />
        </div>
      </div>
    </div>
  );
}
