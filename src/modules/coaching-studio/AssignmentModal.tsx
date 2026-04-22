"use client";

import { useCallback, useEffect, useState } from "react";
import type { DetailItem } from "./DetailModal";
import type { UserSearchResult, ActivityType } from "@/types/assignment";
import type { AssignmentStatus } from "@/types/assignment";
import { searchUsersByPhoneOrEmail, createAssignment, createRecommendation } from "@/services/assignment.service";
import { getTenantMailConfig, sendAssignmentEmail } from "@/services/mail.service";
import styles from "./AssignmentModal.module.css";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  item: DetailItem | null;
  activityType: ActivityType;
  assigneeId: string;
  assignerName: string;
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
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stage, setStage] = useState<"search" | "found" | "not_found" | "confirm">("search");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const buildSelfUser = useCallback((): UserSearchResult | null => {
    if (!assigneeId) {
      return null;
    }

    const fullName = assignerName?.trim() || "User";
    const nameParts = fullName.split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] ?? fullName;
    const lastName = nameParts.slice(1).join(" ");

    return {
      id: assigneeId,
      userId: assigneeId,
      fullName,
      firstName,
      lastName,
      phone: "",
      email: "",
      userType: "individual",
      tenantId,
    };
  }, [assigneeId, assignerName, tenantId]);

  useEffect(() => {
    if (!isOpen || !selfAssign) {
      return;
    }

    const selfUser = buildSelfUser();
    if (!selfUser) {
      setError("Unable to identify current user for self-assignment.");
      return;
    }

    setSelectedUser(selfUser);
    setStage("confirm");
    setMessage(`Ready to assign to ${selfUser.fullName}`);
    setError("");
  }, [isOpen, selfAssign, buildSelfUser]);

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
    if (stage === "found") {
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

    // Handle confirming found user - move to confirm stage
    if (stage === "found" && selectedUser) {
      setStage("confirm");
      setMessage(
        `Ready to ${actionType === "recommend" ? "recommend" : "assign"} to ${selectedUser.fullName}`
      );
      return;
    }

    // Handle confirming not-found user with first/last name - move to confirm stage
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

    // Search mode by phone/email
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
    if (!selectedUser || !item) {
      setError("Please select a user first");
      return;
    }

    // For recommend action, no wallet deduction needed
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
            tenantId,
            mailConfig,
            assignerName,
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

    // For assign action, proceed with wallet validation and coin deduction
    setIsSubmitting(true);
    setError("");
    setMessage("");

    try {
      const assignmentStatus: AssignmentStatus =
        activityType === "event" && selfAssign ? "registered" : "assigned";

      const assignerLookupIds = Array.from(
        new Set([
          assigneeId,
          typeof window !== "undefined" ? sessionStorage.getItem("cs_profile_id") ?? "" : "",
        ].filter(Boolean))
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
          tenantId,
          mailConfig,
          assignerName,
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
          {stage === "search" && (
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

              {error && <div className={styles.error}>{error}</div>}
              {message && <div className={styles.message}>{message}</div>}
            </div>
          )}

          {stage === "found" && selectedUser && (
            <div className={styles.searchStage}>
              {message && <p className={styles.message}>{message}</p>}
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

              {error && <div className={styles.error}>{error}</div>}
            </div>
          )}

          {stage === "not_found" && (
            <div className={styles.searchStage}>
              {message && <p className={styles.message}>{message}</p>}
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
                    searchIdentifierType === "email"
                      ? "Enter phone number"
                      : "Enter email address"
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

              {error && <div className={styles.error}>{error}</div>}
            </div>
          )}

          {searchResults.length > 1 && stage === "search" && (
            <div className={styles.searchStage}>
              {message && <p className={styles.message}>{message}</p>}
              <div className={styles.results}>
                <p className={styles.resultsLabel}>Search Results:</p>
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className={`${styles.resultItem} ${
                      selectedUser?.id === user.id ? styles.resultItemSelected : ""
                    }`}
                    onClick={() => handleSelectUser(user)}
                  >
                    <span className={styles.resultName}>{user.fullName}</span>
                    <span className={styles.resultInfo}>
                      {user.phone || user.email}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {stage === "confirm" && selectedUser && (
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

                {actionType === "assign" && (
                  <div className={styles.confirmMessage}>
                    <p>
                      {item.creditsRequired ?? 0} coins will be deducted from your wallet upon assignment.
                    </p>
                  </div>
                )}

                {actionType === "recommend" && (
                  <div className={styles.confirmMessage}>
                    <p>{selectedUser.fullName} will be notified of this recommendation.</p>
                  </div>
                )}
              </div>

              {error && <div className={styles.error}>{error}</div>}
              {message && !isSubmitting && <div className={styles.message}>{message}</div>}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => {
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
            {stage === "search" ? "Cancel" : "Back"}
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={stage === "search" || stage === "not_found" || stage === "found" ? handleSearch : handleAssign}
            disabled={
              isSearching ||
              isSubmitting ||
              (stage === "search" && !phoneOrEmail.trim()) ||
              (stage === "not_found" && (!firstName.trim() || !lastName.trim() || !alternateContact.trim())) ||
              (stage === "found" && !selectedUser)
            }
          >
            {isSearching || isSubmitting ? (
              <span>
                {isSearching ? "Searching..." : "Processing..."}
              </span>
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
