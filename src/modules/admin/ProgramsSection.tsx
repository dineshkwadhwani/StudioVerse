"use client";

import { useEffect, useState, startTransition } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import ProgramForm from "./ProgramForm";
import styles from "./SuperAdminPortal.module.css";
import { db } from "@/services/firebase";
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
  PROGRAM_STATUS_LABELS,
  toDateInputValue,
  type ProgramFormValues,
  type ProgramRecord,
  type ProgramSaveMode,
} from "@/types/program";

type TenantOption = {
  id: string;
  tenantId: string;
  tenantName: string;
  status: string;
};

type ProgramsSectionProps = {
  tenants?: TenantOption[];
};

function mapProgramToForm(program: ProgramRecord): ProgramFormValues {
  return createProgramFormValues({
    id: program.id,
    tenantId: program.tenantId,
    name: program.name,
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
    promoted: program.promoted,
    ownershipScope: program.ownershipScope,
    ownerEntityId: program.ownerEntityId ?? "",
    catalogVisibility: program.catalogVisibility,
    publicationState: program.publicationState,
    thumbnailUrl: program.thumbnailUrl ?? "",
    thumbnailPath: program.thumbnailPath ?? "",
  });
}

export default function ProgramsSection({ tenants: propTenants }: ProgramsSectionProps) {
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
    void refreshPrograms(selectedTenantId || undefined);
  }, [selectedTenantId]);

  function openCreate(): void {
    const defaultTenantId = selectedTenantId || tenants.find((tenant) => tenant.status === "active")?.tenantId || "";
    setFormValues(createProgramFormValues({ tenantId: defaultTenantId }));
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

  async function submit(mode: ProgramSaveMode): Promise<void> {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const preliminaryErrors = validateProgramForm(formValues, mode, {
        hasSelectedThumbnail: Boolean(selectedThumbnail),
      });
      if (Object.keys(preliminaryErrors).length > 0) {
        setFormErrors(preliminaryErrors);
        return;
      }

      // isExisting must be captured BEFORE we generate a new id,
      // because formValues.id is only set when the form was opened via Edit.
      const isExisting = Boolean(formValues.id);
      const nextId = formValues.id ?? buildProgramId();
      let nextThumbnailUrl = formValues.thumbnailUrl;
      let nextThumbnailPath = formValues.thumbnailPath;

      if (selectedThumbnail) {
        setUploadBusy(true);
        const uploadResult = await uploadProgramThumbnail({
          tenantId: formValues.tenantId,
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

      const payload = normalizeProgramForm(nextFormValues, mode);
      await saveProgram(payload, mode, isExisting);

      setFormValues(nextFormValues);
      setFormOpen(false);
      setSelectedThumbnail(null);
      setFormErrors({});
      setMessage(mode === "publish" ? "Program saved and marked as published." : "Program draft saved.");
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
        <div className={styles.userStack}>
          {programs.map((program) => (
            <section key={program.id} className={styles.userItem}>
              <div>
                <p className={styles.userName}>{program.name}</p>
                <p className={styles.userMeta}>Tenant: {program.tenantId}</p>
                <p className={styles.userMeta}>Delivery: {program.deliveryType} • Duration: {program.durationValue} {program.durationUnit}</p>
                <p className={styles.userMeta}>Publication: {program.publicationState}</p>
                <p className={styles.userMeta}>Promoted: {program.promoted ? "Yes" : "No"}</p>
              </div>

              <div className={styles.userActions}>
                <span className={styles.statusBadge}>{PROGRAM_STATUS_LABELS[program.status]}</span>
                <button type="button" className={styles.rowAction} onClick={() => openEdit(program)}>
                  Edit
                </button>
              </div>
            </section>
          ))}
        </div>
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
          onChange={updateField}
          onThumbnailSelect={handleThumbnailSelection}
          onCancel={closeForm}
          onSaveDraft={() => void submit("draft")}
          onPublish={() => void submit("publish")}
        />
      ) : null}
    </article>
  );
}
