"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DetailItem } from "./DetailModal";
import type { UserSearchResult, ActivityType } from "@/types/assignment";
import type { AssignmentStatus } from "@/types/assignment";
import type { CohortListItem } from "@/types/cohort";
import {
  getTenantMailConfig,
  searchUsersByPhoneOrEmail,
  createAssignment,
  createCohortAssignment,
  createRecommendation,
} from "@/services/assignment.service";
import { listCohortsForScope } from "@/services/cohorts.service";
import { getTenantMailConfig, sendAssignmentEmail } from "@/services/mail.service";
import styles from "./AssignmentModal.module.css";

type AssignerRole = "company" | "professional" | "individual";
type AssignmentTarget = "individual" | "cohort";
type Stage = "search" | "found" | "not_found" | "confirm" | "cohort_select" | "cohort_confirm";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  item: DetailItem | null;
  activityType: ActivityType;
  assigneeId: string;
  assignerName: string;
  assignerRole?: string;
  tenantId: string;
  actionType: "assign" | "recommend";
  selfAssign?: boolean;
  onSuccess?: () => void;
};

export default function AssignmentModal({
  isOpen,
  onClose,
  item,
  activityType,
  assigneeId,
  assignerName,
  assignerRole,
  tenantId,
  actionType,
  selfAssign = false,
  onSuccess,
}: Props) {
  const [phoneOrEmail, setPhoneOrEmail] = useState("");
  const [searchIdentifierType, setSearchIdentifierType] = useState<"phone" | "email" | null>(null);
  const [alternateContact, setAlternateContact] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);

  const [assignmentTarget, setAssignmentTarget] = useState<AssignmentTarget>("individual");
  const [cohorts, setCohorts] = useState<CohortListItem[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState("");
  const [isLoadingCohorts, setIsLoadingCohorts] = useState(false);

  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stage, setStage] = useState<Stage>("search");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const profileIdFromSession =
    typeof window !== "undefined" ? sessionStorage.getItem("cs_profile_id") ?? "" : "";
  const actorScopeId = profileIdFromSession || assigneeId;

  const normalizedRole: AssignerRole =
    assignerRole === "company" || assignerRole === "professional" || assignerRole === "individual"
      ? assignerRole
      : "individual";

  const canAssignToCohort =
    actionType === "assign" && !selfAssign && (normalizedRole === "company" || normalizedRole === "professional");

  const selectedCohort = useMemo(
    () => cohorts.find((entry) => entry.id === selectedCohortId) ?? null,
    [cohorts, selectedCohortId]
  );

  const buildSelfUser = useCallback((): UserSearchResult | null => {
    if (!assigneeId) {
      return null;
    }

    const fullName = assignerName?.trim() || "User";
    const nameParts = fullName.split(/\s+/).filter(Boolean);
    const first = nameParts[0] ?? fullName;
    const last = nameParts.slice(1).join(" ");

    return {
      id: assigneeId,
      userId: assigneeId,
      fullName,
      firstName: first,
      lastName: last,
      phone: "",
      email: "",
      userType: "individual",
      tenantId,
    };
  }, [assigneeId, assignerName, tenantId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (selfAssign) {
      const selfUser = buildSelfUser();
      if (!selfUser) {
        setError("Unable to identify current user for self-assignment.");
        return;
      }
      setSelectedUser(selfUser);
      setStage("confirm");
      setMessage(`Ready to assign to ${selfUser.fullName}`);
      return;
    }

    setStage(assignmentTarget === "cohort" ? "cohort_select" : "search");
  }, [isOpen, selfAssign, assignmentTarget, buildSelfUser]);

  useEffect(() => {
    if (!isOpen || !canAssignToCohort || !actorScopeId) {
      return;
    }

    let active = true;
    setIsLoadingCohorts(true);

    void listCohortsForScope({
      role: normalizedRole === "company" ? "company" : "professional",
      tenantId,
      actorUserId: actorScopeId,
      status: "active",
    })
      .then((rows) => {
        if (!active) {
          return;
        }

        setCohorts(rows);
        if (rows.length === 0) {
          setMessage("No active cohorts available for assignment.");
        }
      })
      .catch((loadError) => {
        if (!active) {
          return;
        }

        const loadMessage =
          loadError instanceof Error ? loadError.message : "Failed to load cohorts.";
        setError(loadMessage);
      })
      .finally(() => {
        if (active) {
          setIsLoadingCohorts(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isOpen, canAssignToCohort, normalizedRole, tenantId, actorScopeId]);

  if (!isOpen || !item) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleClose = () => {
    setPhoneOrEmail("");
    setSearchIdentifierType(null);
    setAlternateContact("");
    setFirstName("");
    setLastName("");
    setSearchResults([]);
    setSelectedUser(null);
    setAssignmentTarget("individual");
    setSelectedCohortId("");
    setStage("search");
    setMessage("");
    setError("");
    onClose();
  };

  const inferSearchIdentifierType = (value: string): "phone" | "email" => {
    return value.includes("@") ? "email" : "phone";
  };

  const getActivityLabel = (): "program" | "assessment" | "event" => {
    if (item?.type === "tool") {
      return "assessment";
    }
    if (item?.type === "event") {
      return "event";
    }
    return "program";
  };

  const validateSearch = (): boolean => {
    if (assignmentTarget === "cohort") {
      if (stage === "cohort_select" && !selectedCohortId) {
        setError("Please select an active cohort.");
        return false;
      }
      return true;
    }

    if (stage === "search") {
      if (!phoneOrEmail.trim()) {
        setError("Please enter phone number or email");
        return false;
      }
      return true;
    }

    if (stage === "not_found") {
      if (!firstName.trim() || !lastName.trim() || !alternateContact.trim()) {
        const missingFieldLabel = searchIdentifierType === "email" ? "phone number" : "email";
        setError(`Please enter first name, last name, and ${missingFieldLabel}`);
        return false;
      }
      return true;
    }

    return true;
  };

  const handleSearch = async () => {
    setError("");
    setMessage("");

    if (!validateSearch()) {
      return;
    }

    if (assignmentTarget === "cohort") {
      if (!selectedCohort) {
        setError("Please select an active cohort.");
        return;
      }

      setStage("cohort_confirm");
      setMessage(`Ready to assign to cohort ${selectedCohort.name}`);
      return;
    }

    if (stage === "found" && selectedUser) {
      setStage("confirm");
      setMessage(
        `Ready to ${actionType === "recommend" ? "recommend" : "assign"} to ${selectedUser.fullName}`
      );
      return;
    }

    if (stage === "not_found" && firstName.trim() && lastName.trim() && alternateContact.trim()) {
      const searchedValue = phoneOrEmail.trim();
      const alternateValue = alternateContact.trim();
      const assigneePhone = searchIdentifierType === "phone" ? searchedValue : alternateValue;
      const assigneeEmail = searchIdentifierType === "email" ? searchedValue : alternateValue;

      const unregisteredUser: UserSearchResult = {
        id: `notfound-${Date.now()}`,
        userId: `notfound-${Date.now()}`,
        fullName: `${firstName.trim()} ${lastName.trim()}`,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: assigneePhone,
        email: assigneeEmail,
        userType: "individual",
        tenantId,
      };
      setSelectedUser(unregisteredUser);
      setStage("confirm");
      setMessage(
        `Ready to ${actionType === "recommend" ? "recommend" : "assign"} to ${unregisteredUser.fullName}`
      );
      return;
    }

    if (!phoneOrEmail.trim()) {
      setError("Please enter phone number or email to search");
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchUsersByPhoneOrEmail(phoneOrEmail, tenantId);

      if (results.length === 0) {
        const identifierType = inferSearchIdentifierType(phoneOrEmail.trim());
        const missingFieldLabel = identifierType === "phone" ? "email" : "phone number";

        setMessage(`User not found. Please provide first name, last name, and ${missingFieldLabel}.`);
        setSearchResults([]);
        setSelectedUser(null);
        setSearchIdentifierType(identifierType);
        setAlternateContact("");
        setFirstName("");
        setLastName("");
        setStage("not_found");
      } else if (results.length === 1) {
        setSelectedUser(results[0]);
        setSearchResults(results);
        setStage("found");
        setMessage(`User found: ${results[0].fullName}`);
      } else {
        setSearchResults(results);
        setMessage(`Found ${results.length} matching users. Select one to continue.`);
      }
    } catch (err) {
      console.error("[handleSearch] error:", err);
      setError("Error searching for users. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectUser = (user: UserSearchResult) => {
    setSelectedUser(user);
    setStage("found");
    setMessage(`User selected: ${user.fullName}`);
  };

  const handleAssign = async () => {
    if (!item) {
      setError("Activity details are missing.");
      return;
    }

    if (assignmentTarget === "cohort") {
      if (!selectedCohort) {
        setError("Please select a cohort first.");
        return;
      }

      setIsSubmitting(true);
      setError("");
      setMessage("");

      try {
        const assignerLookupIds = Array.from(
          new Set([assigneeId, profileIdFromSession].filter(Boolean))
        );

        const result = await createCohortAssignment({
          tenantId,
          cohortId: selectedCohort.id,
          assignerRole: normalizedRole === "company" ? "company" : "professional",
          activityType,
          activityId: item.id,
          activityTitle: item.title,
          creditsRequired: item.creditsRequired ?? 0,
          cost: item.cost,
          assignerId: actorScopeId,
          assignerName,
          assignerLookupIds,
        });

        if (result.success) {
          const activityLabel = getActivityLabel();
          window.alert(`The ${activityLabel} has been assigned to the cohort.`);
          setMessage(result.message);
          setTimeout(() => {
            handleClose();
            onSuccess?.();
          }, 1400);
        } else {
          setError(result.message);
        }
      } catch (err) {
        console.error("[handleAssignCohort] error:", err);
        setError("Error processing cohort assignment. Please try again.");
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    if (!selectedUser) {
      setError("Please select a user first");
      return;
    }

    if (actionType === "recommend") {
      setIsSubmitting(true);
      setError("");
      setMessage("");

      try {
        const result = await createRecommendation({
          tenantId,
          activityType,
          activityId: item.id,
          activityTitle: item.title,
          creditsRequired: item.creditsRequired ?? 0,
          cost: item.cost,
          assigneeId: selectedUser.userId,
          assigneePhone: selectedUser.phone,
          assigneeEmail: selectedUser.email,
          assigneeFirstName: selectedUser.firstName,
          assigneeLastName: selectedUser.lastName,
          assigneeFullName: selectedUser.fullName,
          assignerId: assigneeId,
          assignerName,
        });

        if (result.success) {
          const activityLabel = getActivityLabel();
          window.alert(`The ${activityLabel} has been recommended`);

          const mailConfig = await getTenantMailConfig(tenantId);
          const mailResult = await sendAssignmentEmail({
            mailConfig,
            assigneeEmail: selectedUser.email,
            assigneeName: selectedUser.fullName,
            activityType,
            activityTitle: item.title,
          });

          window.alert(mailResult.message);
          setMessage(`${result.message} ${mailResult.message}.`);
          setTimeout(() => {
            handleClose();
            onSuccess?.();
          }, 1500);
        } else {
          setError(result.message);
        }
      } catch (err) {
        console.error("[handleRecommend] error:", err);
        setError("Error processing recommendation. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setIsSubmitting(true);
    setError("");
    setMessage("");

    try {
      const assignmentStatus: AssignmentStatus =
        activityType === "event" && selfAssign ? "registered" : "assigned";

      const assignerLookupIds = Array.from(
        new Set([assigneeId, profileIdFromSession].filter(Boolean))
      );

      const result = await createAssignment({
        tenantId,
        activityType,
        activityId: item.id,
        activityTitle: item.title,
        creditsRequired: item.creditsRequired ?? 0,
        cost: item.cost,
        assigneeId: selectedUser.userId,
        assigneePhone: selectedUser.phone,
        assigneeEmail: selectedUser.email,
        assigneeFirstName: selectedUser.firstName,
        assigneeLastName: selectedUser.lastName,
        assigneeFullName: selectedUser.fullName,
        assignerId: assigneeId,
        assignerName,
        assignerLookupIds,
        status: assignmentStatus,
      });

      if (result.success) {
        const activityLabel = getActivityLabel();
        window.alert(`The ${activityLabel} has been assigned`);

        const mailConfig = await getTenantMailConfig(tenantId);
        const mailResult = await sendAssignmentEmail({
          mailConfig,
          assigneeEmail: selectedUser.email,
          assigneeName: selectedUser.fullName,
          activityType,
          activityTitle: item.title,
        });

        window.alert(mailResult.message);
        setMessage(`${result.message} ${mailResult.message}.`);
        setTimeout(() => {
          handleClose();
          onSuccess?.();
        }, 1500);
      } else {
        setError(result.message);
      }
    } catch (err) {
      console.error("[handleAssign] error:", err);
      setError("Error processing assignment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderTargetSelector = canAssignToCohort ? (
    <div className={styles.targetSwitch}>
      <button
        type="button"
        className={`${styles.switchButton} ${assignmentTarget === "individual" ? styles.switchButtonActive : ""}`}
        onClick={() => {
          setAssignmentTarget("individual");
          setStage("search");
          setError("");
          setMessage("");
        }}
      >
        Individual
      </button>
      <button
        type="button"
        className={`${styles.switchButton} ${assignmentTarget === "cohort" ? styles.switchButtonActive : ""}`}
        onClick={() => {
          setAssignmentTarget("cohort");
          setStage("cohort_select");
          setError("");
          setMessage("");
        }}
      >
        Cohort
      </button>
    </div>
  ) : null;

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {actionType === "recommend" ? "Recommend" : "Assign"}{" "}
            {item.type === "tool" ? "Assessment" : item.type === "program" ? "Program" : "Event"}
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={handleClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className={styles.content}>
          {renderTargetSelector}

          {assignmentTarget === "cohort" && stage === "cohort_select" ? (
            <div className={styles.searchStage}>
              <div className={styles.formGroup}>
                <label htmlFor="cohortSelect">Active Cohort</label>
                <select
                  id="cohortSelect"
                  className={styles.input}
                  value={selectedCohortId}
                  onChange={(event) => setSelectedCohortId(event.target.value)}
                  disabled={isLoadingCohorts}
                >
                  <option value="">Select cohort</option>
                  {cohorts.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {`${entry.name} (${entry.memberCount} individuals)`}
                    </option>
                  ))}
                </select>
              </div>
              {message ? <div className={styles.message}>{message}</div> : null}
              {error ? <div className={styles.error}>{error}</div> : null}
            </div>
          ) : null}

          {assignmentTarget === "cohort" && stage === "cohort_confirm" && selectedCohort ? (
            <div className={styles.confirmStage}>
              <div className={styles.confirmInfo}>
                <div className={styles.infoRow}>
                  <span className={styles.label}>Cohort:</span>
                  <span className={styles.value}>{selectedCohort.name}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.label}>Individuals:</span>
                  <span className={styles.value}>{selectedCohort.memberCount}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.label}>Activity:</span>
                  <span className={styles.value}>{item.title}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.label}>Coins per Person:</span>
                  <span className={styles.value}>{item.creditsRequired ?? 0}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.label}>Total Coins:</span>
                  <span className={styles.value}>{(item.creditsRequired ?? 0) * selectedCohort.memberCount}</span>
                </div>
              </div>
              {error ? <div className={styles.error}>{error}</div> : null}
              {message && !isSubmitting ? <div className={styles.message}>{message}</div> : null}
            </div>
          ) : null}

          {assignmentTarget === "individual" && stage === "search" ? (
            <div className={styles.searchStage}>
              <div className={styles.formGroup}>
                <label htmlFor="phoneOrEmail">Phone or Email</label>
                <input
                  id="phoneOrEmail"
                  type="text"
                  placeholder="Enter phone number or email"
                  value={phoneOrEmail}
                  disabled={isSearching}
                  onChange={(e) => {
                    setPhoneOrEmail(e.target.value);
                    setError("");
                  }}
                  className={styles.input}
                />
              </div>
              {error ? <div className={styles.error}>{error}</div> : null}
              {message ? <div className={styles.message}>{message}</div> : null}
            </div>
          ) : null}

          {assignmentTarget === "individual" && stage === "found" && selectedUser ? (
            <div className={styles.searchStage}>
              {message ? <p className={styles.message}>{message}</p> : null}
              <div className={styles.confirmInfo}>
                <div className={styles.infoRow}>
                  <span className={styles.label}>Phone:</span>
                  <span className={styles.value}>{selectedUser.phone || "N/A"}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.label}>Email:</span>
                  <span className={styles.value}>{selectedUser.email || "N/A"}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.label}>First Name:</span>
                  <span className={styles.value}>{selectedUser.firstName}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.label}>Last Name:</span>
                  <span className={styles.value}>{selectedUser.lastName}</span>
                </div>
              </div>
              {error ? <div className={styles.error}>{error}</div> : null}
            </div>
          ) : null}

          {assignmentTarget === "individual" && stage === "not_found" ? (
            <div className={styles.searchStage}>
              {message ? <p className={styles.message}>{message}</p> : null}
              <div className={styles.confirmInfo} style={{ marginBottom: "16px" }}>
                <div className={styles.infoRow}>
                  <span className={styles.label}>Searched:</span>
                  <span className={styles.value}>{phoneOrEmail}</span>
                </div>
              </div>
              <div className={styles.nameRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="firstName">First Name *</label>
                  <input
                    id="firstName"
                    type="text"
                    placeholder="First name"
                    value={firstName}
                    disabled={isSearching}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      setError("");
                    }}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="lastName">Last Name *</label>
                  <input
                    id="lastName"
                    type="text"
                    placeholder="Last name"
                    value={lastName}
                    disabled={isSearching}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      setError("");
                    }}
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="alternateContact">
                  {searchIdentifierType === "email" ? "Phone Number *" : "Email *"}
                </label>
                <input
                  id="alternateContact"
                  type="text"
                  placeholder={
                    searchIdentifierType === "email" ? "Enter phone number" : "Enter email address"
                  }
                  value={alternateContact}
                  disabled={isSearching}
                  onChange={(e) => {
                    setAlternateContact(e.target.value);
                    setError("");
                  }}
                  className={styles.input}
                />
              </div>

              {error ? <div className={styles.error}>{error}</div> : null}
            </div>
          ) : null}

          {assignmentTarget === "individual" && searchResults.length > 1 && stage === "search" ? (
            <div className={styles.searchStage}>
              {message ? <p className={styles.message}>{message}</p> : null}
              <div className={styles.results}>
                <p className={styles.resultsLabel}>Search Results:</p>
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className={`${styles.resultItem} ${selectedUser?.id === user.id ? styles.resultItemSelected : ""}`}
                    onClick={() => handleSelectUser(user)}
                  >
                    <span className={styles.resultName}>{user.fullName}</span>
                    <span className={styles.resultInfo}>{user.phone || user.email}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {assignmentTarget === "individual" && stage === "confirm" && selectedUser ? (
            <div className={styles.confirmStage}>
              <div className={styles.confirmInfo}>
                <div className={styles.infoRow}>
                  <span className={styles.label}>User:</span>
                  <span className={styles.value}>{selectedUser.fullName}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.label}>Activity:</span>
                  <span className={styles.value}>{item.title}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.label}>Credits Required:</span>
                  <span className={styles.value}>{item.creditsRequired ?? 0}</span>
                </div>

                {actionType === "assign" ? (
                  <div className={styles.confirmMessage}>
                    <p>{item.creditsRequired ?? 0} coins will be deducted from your wallet upon assignment.</p>
                  </div>
                ) : null}

                {actionType === "recommend" ? (
                  <div className={styles.confirmMessage}>
                    <p>{selectedUser.fullName} will be notified of this recommendation.</p>
                  </div>
                ) : null}
              </div>
              {error ? <div className={styles.error}>{error}</div> : null}
              {message && !isSubmitting ? <div className={styles.message}>{message}</div> : null}
            </div>
          ) : null}
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => {
              if (assignmentTarget === "cohort") {
                if (stage === "cohort_confirm") {
                  setStage("cohort_select");
                  setError("");
                  setMessage("");
                } else {
                  handleClose();
                }
                return;
              }

              if (stage === "found") {
                setStage("search");
                setSelectedUser(null);
                setError("");
                setMessage("");
              } else if (stage === "not_found") {
                setStage("search");
                setSearchIdentifierType(null);
                setAlternateContact("");
                setFirstName("");
                setLastName("");
                setError("");
                setMessage("");
              } else if (stage === "confirm" && !selfAssign) {
                setStage("search");
                setPhoneOrEmail("");
                setSearchResults([]);
                setSelectedUser(null);
                setError("");
                setMessage("");
              } else {
                handleClose();
              }
            }}
            disabled={isSearching || isSubmitting}
          >
            {stage === "search" || stage === "cohort_select" ? "Cancel" : "Back"}
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={
              stage === "search" || stage === "not_found" || stage === "found" || stage === "cohort_select"
                ? handleSearch
                : handleAssign
            }
            disabled={
              isSearching ||
              isSubmitting ||
              (assignmentTarget === "individual" && stage === "search" && !phoneOrEmail.trim()) ||
              (assignmentTarget === "individual" &&
                stage === "not_found" &&
                (!firstName.trim() || !lastName.trim() || !alternateContact.trim())) ||
              (assignmentTarget === "individual" && stage === "found" && !selectedUser) ||
              (assignmentTarget === "cohort" && stage === "cohort_select" && !selectedCohortId)
            }
          >
            {isSearching || isSubmitting ? (
              <span>{isSearching ? "Searching..." : "Processing..."}</span>
            ) : assignmentTarget === "cohort" && stage === "cohort_select" ? (
              "Continue"
            ) : assignmentTarget === "cohort" && stage === "cohort_confirm" ? (
              "Assign"
            ) : stage === "search" ? (
              "Search"
            ) : stage === "found" ? (
              "Continue"
            ) : stage === "not_found" ? (
              "Continue"
            ) : actionType === "recommend" ? (
              "Recommend"
            ) : (
              "Assign"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
