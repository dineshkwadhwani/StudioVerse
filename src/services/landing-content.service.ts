import {
  collection,
  getDocs,
  query,
  where,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import type { LandingContentItem } from "@/types/tenant";
import { db } from "@/services/firebase";

type LandingCollection = "programs" | "tools" | "events";

type ListLandingItemsOptions = {
  promotedOnly?: boolean;
};

function mapLandingItem(id: string, data: DocumentData): LandingContentItem {
  const name = typeof data.name === "string" && data.name.trim() ? data.name.trim() : id;
  const title = typeof data.title === "string" && data.title.trim()
    ? data.title.trim()
    : typeof data.name === "string"
      ? data.name
      : id;
  const description = typeof data.description === "string" && data.description.trim()
    ? data.description.trim()
    : typeof data.shortDescription === "string" && data.shortDescription.trim()
      ? data.shortDescription.trim()
      : typeof data.longDescription === "string" && data.longDescription.trim()
        ? data.longDescription.trim()
        : "";
  const image = typeof data.image === "string" && data.image.trim()
    ? data.image.trim()
    : typeof data.thumbnailUrl === "string"
      ? data.thumbnailUrl
      : "";

  return { name, title, description, image };
}

export async function listLandingItemsByTenant(
  collectionName: LandingCollection,
  tenantId: string,
  options?: ListLandingItemsOptions,
): Promise<LandingContentItem[]> {
  const constraints: QueryConstraint[] = [where("tenantId", "==", tenantId)];

  if (options?.promotedOnly) {
    constraints.push(where("promoted", "==", true));
  }

  const snapshot = await getDocs(query(collection(db, collectionName), ...constraints));
  return snapshot.docs.map((item) => mapLandingItem(item.id, item.data()));
}
