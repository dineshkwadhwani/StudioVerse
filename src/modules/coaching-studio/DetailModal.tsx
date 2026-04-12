"use client";

import { useEffect, useState } from "react";
import styles from "./DetailModal.module.css";
import AssignmentModal from "./AssignmentModal";
import type { ActivityType } from "@/types/assignment";

type ContentType = "program" | "event" | "tool";
type UserType = "coach" | "learner";

export type DetailItem = {
  id: string;
  type: ContentType;
  title: string;
  image: string;
  description: string;
  details?: string;
  creditsRequired?: number;
  cost?: number;
  // Program-specific
  deliveryType?: string;
  durationValue?: number;
  durationUnit?: string;
  facilitatorName?: string;
  videoUrl?: string;
  // Event-specific
  eventType?: string;
  eventDate?: string;
  eventTime?: string;
  locationCity?: string;
  locationAddress?: string;
  // Tool-specific (Assessment)
  assessmentContext?: string;
  assessmentBenefit?: string;
  assessmentType?: string;
};

type Props = {
  item: DetailItem | null;
  isOpen: boolean;
  onClose: () => void;
  userType?: UserType;
  isLoggedIn?: boolean;
  onAuthRequired?: () => void;
  userId?: string;
  userName?: string;
  userRole?: string;
  tenantId?: string;
};

export default function DetailModal({ 
  item, 
  isOpen, 
  onClose, 
  userType = "coach", 
  isLoggedIn = false, 
  onAuthRequired,
  userId,
  userName,
  userRole,
  tenantId
}: Props) {
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [assignmentActionType, setAssignmentActionType] = useState<"assign" | "recommend">("assign");
  const [isSelfAssignmentFlow, setIsSelfAssignmentFlow] = useState(false);

  const mapItemTypeToActivityType = (itemType: ContentType): ActivityType => {
    if (itemType === "tool") {
      return "assessment";
    }
    return itemType;
  };

  const requireAuth = (): boolean => {
    if (!isLoggedIn && onAuthRequired) {
      onClose();
      onAuthRequired();
      return false;
    }
    return true;
  };

  const openAssignmentModal = (actionType: "assign" | "recommend", selfAssign = false) => {
    if (!requireAuth()) {
      return;
    }
    setAssignmentActionType(actionType);
    setIsSelfAssignmentFlow(selfAssign);
    setIsAssignmentModalOpen(true);
  };

  const handleAssign = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    openAssignmentModal("assign");
  };

  const handleRegisterNow = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    openAssignmentModal("assign", true);
  };

  const handleRecommend = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    openAssignmentModal("recommend");
  };

  const handleCloseAssignmentModal = () => {
    setIsAssignmentModalOpen(false);
    setIsSelfAssignmentFlow(false);
  };
  // Close modal on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  const formatDuration = (value?: number, unit?: string): string | null => {
    if (!value || !unit) return null;
    return `${value} ${unit}`;
  };

  const formatDateTime = (date?: string, time?: string): string | null => {
    if (!date) return null;
    if (!time) return date;
    return `${date} at ${time}`;
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        {/* Header with close button and credits */}
        <div className={styles.header}>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close details"
          >
            ✕
          </button>
          {item.creditsRequired !== undefined && (
            <div className={styles.creditsDisplay}>
              <img
                src="/tenants/coaching-studio/coin.png"
                alt="Credits"
                className={styles.coinIcon}
              />
              <span className={styles.creditsValue}>
                {item.creditsRequired} {item.creditsRequired === 1 ? "credit" : "credits"}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* Image */}
          <div className={styles.imageSection}>
            <img src={item.image} alt={item.title} className={styles.image} />
          </div>

          {/* Title and basic info */}
          <h2 className={styles.title}>{item.title}</h2>
          <p className={styles.description}>{item.description}</p>

          {/* Type badge */}
          <div className={styles.badgeRow}>
            <span className={`${styles.badge} ${styles[`badge-${item.type}`]}`}>
              {item.type === "program"
                ? item.deliveryType || "Program"
                : item.type === "event"
                  ? item.eventType || "Event"
                  : item.assessmentType || "Tool"}
            </span>
          </div>

          {/* Program-specific details */}
          {item.type === "program" && (
            <div className={styles.detailsGrid}>
              {item.facilitatorName && (
                <div className={styles.detailItem}>
                  <p className={styles.detailLabel}>Facilitator</p>
                  <p className={styles.detailValue}>{item.facilitatorName}</p>
                </div>
              )}
              {item.durationValue && item.durationUnit && (
                <div className={styles.detailItem}>
                  <p className={styles.detailLabel}>Duration</p>
                  <p className={styles.detailValue}>
                    {formatDuration(item.durationValue, item.durationUnit)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Event-specific details */}
          {item.type === "event" && (
            <div className={styles.detailsGrid}>
              {item.eventDate && (
                <div className={styles.detailItem}>
                  <p className={styles.detailLabel}>Date & Time</p>
                  <p className={styles.detailValue}>
                    {formatDateTime(item.eventDate, item.eventTime)}
                  </p>
                </div>
              )}
              {item.cost !== undefined && (
                <div className={styles.detailItem}>
                  <p className={styles.detailLabel}>Cost</p>
                  <p className={styles.detailValue}>
                    Rs. {item.cost.toFixed(2)}
                    {item.creditsRequired !== undefined && item.creditsRequired > 0 && (
                      <span style={{ color: "#666", fontWeight: 400 }}>
                        {" "}({item.creditsRequired} {item.creditsRequired === 1 ? "Credit" : "Credits"})
                      </span>
                    )}
                  </p>
                </div>
              )}
              {(item.locationCity || item.locationAddress) && (
                <div className={styles.detailItem}>
                  <p className={styles.detailLabel}>Venue</p>
                  <p className={styles.detailValue}>
                    {[item.locationAddress, item.locationCity].filter(Boolean).join(", ")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tool-specific details */}
          {item.type === "tool" && (
            <div className={styles.detailsGrid}>
              {item.assessmentContext && (
                <div className={styles.detailItem}>
                  <p className={styles.detailLabel}>Context</p>
                  <p className={styles.detailValue}>{item.assessmentContext}</p>
                </div>
              )}
              {item.assessmentBenefit && (
                <div className={styles.detailItem}>
                  <p className={styles.detailLabel}>Benefits</p>
                  <p className={styles.detailValue}>{item.assessmentBenefit}</p>
                </div>
              )}
            </div>
          )}

          {/* Full details section */}
          {item.details && (
            <div className={styles.fullDetails}>
              <h3 className={styles.detailsHeading}>Details</h3>
              <p className={styles.detailsText}>{item.details}</p>
            </div>
          )}

          {/* Video section */}
          {item.videoUrl && (
            <div className={styles.videoSection}>
              <h3 className={styles.detailsHeading}>Video Preview</h3>
              <div className={styles.videoContainer}>
                <iframe
                  src={item.videoUrl}
                  title={item.title}
                  className={styles.videoFrame}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className={styles.actionButtons}>
            {/* Tool buttons */}
            {item.type === "tool" && (
              <>
                <button type="button" className={styles.primaryButton} onClick={handleRegisterNow}>
                  Try Now
                </button>
                {userType === "coach" && (
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={handleAssign}
                  >
                    Assign
                  </button>
                )}
              </>
            )}

            {/* Program buttons */}
            {item.type === "program" && (
              <>
                <button type="button" className={styles.primaryButton} onClick={handleRegisterNow}>
                  Register Now
                </button>
                {userType === "coach" && (
                  <button type="button" className={styles.secondaryButton} onClick={handleAssign}>
                    Assign
                  </button>
                )}
                {userType === "learner" && (
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={handleRecommend}
                  >
                    Recommend
                  </button>
                )}
              </>
            )}

            {/* Event buttons */}
            {item.type === "event" && (
              <>
                <button type="button" className={styles.primaryButton} onClick={handleRegisterNow}>
                  Register Now
                </button>
                <button type="button" className={styles.secondaryButton} onClick={handleRecommend}>
                  Recommend Now
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Assignment Modal */}
      {item && (
        <AssignmentModal
          isOpen={isAssignmentModalOpen}
          onClose={handleCloseAssignmentModal}
          item={item}
          activityType={mapItemTypeToActivityType(item.type)}
          assigneeId={userId ?? ""}
          assignerName={userName ?? "User"}
          tenantId={tenantId ?? ""}
          actionType={assignmentActionType}
          selfAssign={isSelfAssignmentFlow}
          onSuccess={onClose}
        />
      )}
    </div>
  );
}
