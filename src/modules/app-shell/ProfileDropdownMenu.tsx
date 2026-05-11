"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/services/firebase";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useTenantSearchConfig } from "@/hooks/useTenantSearchConfig";
import { getRoleLabel, getRoleMenuGroups } from "@/modules/activities/config/menuConfig";
import type { StudioUserRole } from "@/modules/activities/config/menuConfig";
import { clearAuthSessionCookies } from "@/lib/auth/sessionCookies";
import styles from "./ProfileDropdownMenu.module.css";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

type Props = {
  role: StudioUserRole | "superadmin" | null;
  tenantId: string;
  name: string;
  basePath: string;
  roleLabels?: {
    company: string;
    professional: string;
    individual: string;
    superAdmin?: string;
  };
};

export default function ProfileDropdownMenu({
  role,
  tenantId,
  name,
  basePath,
  roleLabels,
}: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

  const searchConfig = useTenantSearchConfig(tenantId);
  const effectiveRole: StudioUserRole | null =
    role === "superadmin" ? "company" : role;

  const initials = useMemo(() => getInitials(name), [name]);
  const roleMenuGroups = useMemo(
    () => getRoleMenuGroups(effectiveRole, { basePath, searchConfig }),
    [basePath, effectiveRole, searchConfig],
  );

  const displayRoleLabel = role === "superadmin" && roleLabels?.superAdmin
    ? roleLabels.superAdmin
    : getRoleLabel(effectiveRole, roleLabels);

  async function handleSignOut() {
    await signOut(auth);
    sessionStorage.clear();
    clearAuthSessionCookies();
    router.replace(basePath);
  }

  return (
    <div className={styles.profileArea} ref={menuRef}>
      <button
        type="button"
        className={styles.profileButton}
        onClick={() => setMenuOpen((prev) => !prev)}
      >
        {initials} ▾
      </button>
      {menuOpen && (
        <section className={styles.menuPanel}>
          <div className={styles.menuUser}>
            <p className={styles.menuName}>{name}</p>
            <p className={styles.menuRole}>{displayRoleLabel}</p>
          </div>
          {roleMenuGroups.map((group) => (
            <div key={group.key} className={styles.menuGroup}>
              <p className={styles.menuGroupTitle}>{group.label}</p>
              {group.items.map((item) => (
                <Fragment key={item.key}>
                  {item.type === "signout" && (
                    <hr className={styles.menuDivider} />
                  )}
                  {item.type === "signout" ? (
                    <button
                      type="button"
                      className={styles.menuItem}
                      onClick={handleSignOut}
                    >
                      {item.label}
                    </button>
                  ) : (
                    <Link
                      href={item.href}
                      className={styles.menuLink}
                      onClick={() => setMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  )}
                </Fragment>
              ))}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
