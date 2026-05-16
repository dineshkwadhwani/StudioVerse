"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./ManageCategoriesPage.module.css";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/services/firebase";
import {
  EMPTY_CATEGORY_FORM,
  EMPTY_SUB_CATEGORY_FORM,
  EMPTY_TOPIC_FORM,
  type CategoryFormValues,
  type CategoryRecord,
  type SubCategoryFormValues,
  type SubCategoryRecord,
  type TopicFormValues,
  type TopicRecord,
} from "@/types/category";
import {
  listCategories,
  listSubCategories,
  listTopics,
  seedTaxonomyFromXlsx,
  saveCategory,
  saveSubCategory,
  saveTopic,
} from "@/services/categories.service";

type TabKey = "category" | "sub-category" | "topic";

type ManageCategoriesPageProps = {
  operatorId: string;
};

type TenantOption = {
  id: string;
  tenantId: string;
  tenantName: string;
  status: string;
};

const TAB_LIST: Array<{ key: TabKey; label: string }> = [
  { key: "category", label: "Category" },
  { key: "sub-category", label: "Sub Category" },
  { key: "topic", label: "Topic" },
];

export default function ManageCategoriesPage({ operatorId }: ManageCategoriesPageProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("category");
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategoryRecord[]>([]);
  const [topics, setTopics] = useState<TopicRecord[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [categoryForm, setCategoryForm] = useState<CategoryFormValues>(EMPTY_CATEGORY_FORM);
  const [subCategoryForm, setSubCategoryForm] = useState<SubCategoryFormValues>(EMPTY_SUB_CATEGORY_FORM);
  const [topicForm, setTopicForm] = useState<TopicFormValues>(EMPTY_TOPIC_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categories) {
      map.set(category.id, category.name);
    }
    return map;
  }, [categories]);

  const subCategoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const sub of subCategories) {
      map.set(sub.id, sub.name);
    }
    return map;
  }, [subCategories]);

  const tenantNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const tenant of tenants) {
      map.set(tenant.tenantId, tenant.tenantName);
    }
    return map;
  }, [tenants]);

  const categoryOptionsForSubCategory = useMemo(() => {
    if (!subCategoryForm.tenantId) return [];
    return categories.filter((item) => item.tenantId === subCategoryForm.tenantId);
  }, [categories, subCategoryForm.tenantId]);

  const categoryOptionsForTopic = useMemo(() => {
    if (!topicForm.tenantId) return [];
    return categories.filter((item) => item.tenantId === topicForm.tenantId);
  }, [categories, topicForm.tenantId]);

  const subCategoryOptionsForTopic = useMemo(() => {
    if (!topicForm.categoryId) return [];
    return subCategories.filter((item) => item.categoryId === topicForm.categoryId);
  }, [subCategories, topicForm.categoryId]);

  async function refreshAll(): Promise<void> {
    const [nextCategories, nextSubCategories, nextTopics] = await Promise.all([
      listCategories(),
      listSubCategories(),
      listTopics(),
    ]);
    setCategories(nextCategories);
    setSubCategories(nextSubCategories);
    setTopics(nextTopics);
  }

  useEffect(() => {
    void refreshAll();
  }, []);

  useEffect(() => {
    async function loadTenants(): Promise<void> {
      const snapshot = await getDocs(query(collection(db, "tenants"), where("status", "==", "active")));
      const rows: TenantOption[] = snapshot.docs.map((entry) => ({
        id: entry.id,
        tenantId: String(entry.data().tenantId ?? ""),
        tenantName: String(entry.data().tenantName ?? ""),
        status: String(entry.data().status ?? "inactive"),
      }));
      setTenants(rows);
    }

    void loadTenants();
  }, []);

  function resetMessages(): void {
    setError("");
    setSuccess("");
  }

  async function handleSaveCategory(): Promise<void> {
    const name = categoryForm.name.trim();
    const description = categoryForm.description.trim();
    const tenantId = categoryForm.tenantId.trim();

    if (!tenantId) { setError("Select a tenant for this category."); return; }
    if (!name) { setError("Category name is required."); return; }

    const tenantName = tenantNameById.get(tenantId) ?? "";
    setBusy(true);
    resetMessages();
    try {
      await saveCategory({ id: categoryForm.id, tenantId, tenantName, name, description, operatorId });
      await refreshAll();
      setCategoryForm(EMPTY_CATEGORY_FORM);
      setSuccess("Category saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save category.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveSubCategory(): Promise<void> {
    const categoryId = subCategoryForm.categoryId.trim();
    const tenantId = subCategoryForm.tenantId.trim();
    const name = subCategoryForm.name.trim();
    const description = subCategoryForm.description.trim();

    if (!tenantId) { setError("Select a tenant for this sub category."); return; }
    if (!categoryId) { setError("Select a category for this sub category."); return; }
    if (!name) { setError("Sub category name is required."); return; }

    const tenantName = tenantNameById.get(tenantId) ?? "";
    const categoryName = categoryNameById.get(categoryId) ?? "";
    setBusy(true);
    resetMessages();
    try {
      await saveSubCategory({ id: subCategoryForm.id, tenantId, tenantName, categoryId, categoryName, name, description, operatorId });
      await refreshAll();
      setSubCategoryForm({ ...EMPTY_SUB_CATEGORY_FORM, tenantId, categoryId });
      setSuccess("Sub category saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save sub category.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveTopic(): Promise<void> {
    const tenantId = topicForm.tenantId.trim();
    const categoryId = topicForm.categoryId.trim();
    const subCategoryId = topicForm.subCategoryId.trim();
    const name = topicForm.name.trim();
    const description = topicForm.description.trim();

    if (!tenantId) { setError("Select a tenant for this topic."); return; }
    if (!categoryId) { setError("Select a category for this topic."); return; }
    if (!subCategoryId) { setError("Select a sub category for this topic."); return; }
    if (!name) { setError("Topic name is required."); return; }

    const tenantName = tenantNameById.get(tenantId) ?? "";
    const categoryName = categoryNameById.get(categoryId) ?? "";
    const subCategoryName = subCategoryNameById.get(subCategoryId) ?? "";
    setBusy(true);
    resetMessages();
    try {
      await saveTopic({ id: topicForm.id, tenantId, tenantName, categoryId, categoryName, subCategoryId, subCategoryName, name, description, operatorId });
      await refreshAll();
      setTopicForm({ ...EMPTY_TOPIC_FORM, tenantId, categoryId, subCategoryId });
      setSuccess("Topic saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save topic.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSeedTaxonomy(): Promise<void> {
    setBusy(true);
    resetMessages();
    try {
      const result = await seedTaxonomyFromXlsx();
      if (result.status === "already-exists") {
        setSuccess(result.message);
        return;
      }
      await refreshAll();
      const detailMessage = `Taxonomy seeded successfully! Added ${result.categories} categories, ${result.subCategories} sub-categories, and ${result.topics} topics.`;
      setSuccess(detailMessage);
    } catch (seedError) {
      setError(seedError instanceof Error ? seedError.message : "Failed to seed taxonomy.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.layout}>
      <section className={styles.heroCard}>
        <h2 className={styles.title}>Manage Categories</h2>
        <p className={styles.contextText}>
          Maintain platform-wide categories, sub categories, and topics used by Programs, Assessments, and Events across all tenants.
        </p>
        <div className={styles.tabBar}>
          {TAB_LIST.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={activeTab === tab.key ? `${styles.tab} ${styles.tabActive}` : styles.tab}
              onClick={() => { setActiveTab(tab.key); resetMessages(); }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.contentCard}>
        {error ? <p className={styles.error}>{error}</p> : null}
        {success ? <p className={styles.success}>{success}</p> : null}

        {activeTab === "category" ? (
          <>
            <div className={styles.formGrid}>
              <div>
                <label>Tenant</label>
                <select
                  className={styles.select}
                  value={categoryForm.tenantId}
                  onChange={(event) => setCategoryForm((prev) => ({ ...prev, tenantId: event.target.value }))}
                  disabled={busy}
                >
                  <option value="">Select tenant</option>
                  {tenants.map((item) => (
                    <option key={item.id} value={item.tenantId}>{item.tenantName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Name</label>
                <input
                  className={styles.input}
                  value={categoryForm.name}
                  onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
                  disabled={busy}
                />
              </div>
              <div className={styles.fullRow}>
                <label>Description</label>
                <textarea
                  className={styles.textarea}
                  value={categoryForm.description}
                  onChange={(event) => setCategoryForm((prev) => ({ ...prev, description: event.target.value }))}
                  disabled={busy}
                />
              </div>
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.button} onClick={handleSaveCategory} disabled={busy}>
                {busy ? "Saving..." : categoryForm.id ? "Update Category" : "Save Category"}
              </button>
              <button type="button" className={styles.ghostButton} onClick={() => setCategoryForm(EMPTY_CATEGORY_FORM)} disabled={busy}>
                Reset
              </button>
            </div>
            <table className={styles.table}>
              <thead>
                <tr><th>Tenant</th><th>Name</th><th>Description</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr><td colSpan={4} className={styles.muted}>No categories yet.</td></tr>
                ) : (
                  categories.map((item) => (
                    <tr key={item.id}>
                      <td>{item.tenantName || tenantNameById.get(item.tenantId) || item.tenantId}</td>
                      <td>{item.name}</td>
                      <td>{item.description || "-"}</td>
                      <td>
                        <button type="button" className={styles.ghostButton} disabled={busy}
                          onClick={() => setCategoryForm({ id: item.id, tenantId: item.tenantId, name: item.name, description: item.description })}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </>
        ) : activeTab === "sub-category" ? (
          <>
            <div className={styles.formGrid}>
              <div>
                <label>Tenant</label>
                <select
                  className={styles.select}
                  value={subCategoryForm.tenantId}
                  onChange={(event) => setSubCategoryForm((prev) => ({ ...prev, tenantId: event.target.value, categoryId: "" }))}
                  disabled={busy}
                >
                  <option value="">Select tenant</option>
                  {tenants.map((item) => (
                    <option key={item.id} value={item.tenantId}>{item.tenantName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Category</label>
                <select
                  className={styles.select}
                  value={subCategoryForm.categoryId}
                  onChange={(event) => setSubCategoryForm((prev) => ({ ...prev, categoryId: event.target.value }))}
                  disabled={busy || !subCategoryForm.tenantId}
                >
                  <option value="">Select category</option>
                  {categoryOptionsForSubCategory.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Name</label>
                <input
                  className={styles.input}
                  value={subCategoryForm.name}
                  onChange={(event) => setSubCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
                  disabled={busy}
                />
              </div>
              <div className={styles.fullRow}>
                <label>Description</label>
                <textarea
                  className={styles.textarea}
                  value={subCategoryForm.description}
                  onChange={(event) => setSubCategoryForm((prev) => ({ ...prev, description: event.target.value }))}
                  disabled={busy}
                />
              </div>
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.button} onClick={handleSaveSubCategory} disabled={busy}>
                {busy ? "Saving..." : subCategoryForm.id ? "Update Sub Category" : "Save Sub Category"}
              </button>
              <button type="button" className={styles.ghostButton} onClick={() => setSubCategoryForm(EMPTY_SUB_CATEGORY_FORM)} disabled={busy}>
                Reset
              </button>
            </div>
            <table className={styles.table}>
              <thead>
                <tr><th>Tenant</th><th>Category</th><th>Sub Category</th><th>Description</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {subCategories.length === 0 ? (
                  <tr><td colSpan={5} className={styles.muted}>No sub categories yet.</td></tr>
                ) : (
                  subCategories.map((item) => (
                    <tr key={item.id}>
                      <td>{item.tenantName || tenantNameById.get(item.tenantId) || item.tenantId}</td>
                      <td>{item.categoryName || categoryNameById.get(item.categoryId) || item.categoryId}</td>
                      <td>{item.name}</td>
                      <td>{item.description || "-"}</td>
                      <td>
                        <button type="button" className={styles.ghostButton} disabled={busy}
                          onClick={() => setSubCategoryForm({ id: item.id, tenantId: item.tenantId, categoryId: item.categoryId, name: item.name, description: item.description })}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </>
        ) : (
          <>
            <div className={styles.formGrid}>
              <div>
                <label>Tenant</label>
                <select
                  className={styles.select}
                  value={topicForm.tenantId}
                  onChange={(event) => setTopicForm((prev) => ({ ...prev, tenantId: event.target.value, categoryId: "", subCategoryId: "" }))}
                  disabled={busy}
                >
                  <option value="">Select tenant</option>
                  {tenants.map((item) => (
                    <option key={item.id} value={item.tenantId}>{item.tenantName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Category</label>
                <select
                  className={styles.select}
                  value={topicForm.categoryId}
                  onChange={(event) => setTopicForm((prev) => ({ ...prev, categoryId: event.target.value, subCategoryId: "" }))}
                  disabled={busy || !topicForm.tenantId}
                >
                  <option value="">Select category</option>
                  {categoryOptionsForTopic.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Sub Category</label>
                <select
                  className={styles.select}
                  value={topicForm.subCategoryId}
                  onChange={(event) => setTopicForm((prev) => ({ ...prev, subCategoryId: event.target.value }))}
                  disabled={busy || !topicForm.categoryId}
                >
                  <option value="">Select sub category</option>
                  {subCategoryOptionsForTopic.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Name</label>
                <input
                  className={styles.input}
                  value={topicForm.name}
                  onChange={(event) => setTopicForm((prev) => ({ ...prev, name: event.target.value }))}
                  disabled={busy}
                />
              </div>
              <div className={styles.fullRow}>
                <label>Description</label>
                <textarea
                  className={styles.textarea}
                  value={topicForm.description}
                  onChange={(event) => setTopicForm((prev) => ({ ...prev, description: event.target.value }))}
                  disabled={busy}
                />
              </div>
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.button} onClick={handleSaveTopic} disabled={busy}>
                {busy ? "Saving..." : topicForm.id ? "Update Topic" : "Save Topic"}
              </button>
              <button type="button" className={styles.ghostButton} onClick={() => setTopicForm(EMPTY_TOPIC_FORM)} disabled={busy}>
                Reset
              </button>
            </div>
            <table className={styles.table}>
              <thead>
                <tr><th>Tenant</th><th>Category</th><th>Sub Category</th><th>Topic</th><th>Description</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {topics.length === 0 ? (
                  <tr><td colSpan={6} className={styles.muted}>No topics yet.</td></tr>
                ) : (
                  topics.map((item) => (
                    <tr key={item.id}>
                      <td>{item.tenantName || tenantNameById.get(item.tenantId) || item.tenantId}</td>
                      <td>{item.categoryName || categoryNameById.get(item.categoryId) || item.categoryId}</td>
                      <td>{item.subCategoryName || subCategoryNameById.get(item.subCategoryId) || item.subCategoryId}</td>
                      <td>{item.name}</td>
                      <td>{item.description || "-"}</td>
                      <td>
                        <button type="button" className={styles.ghostButton} disabled={busy}
                          onClick={() => setTopicForm({ id: item.id, tenantId: item.tenantId, categoryId: item.categoryId, subCategoryId: item.subCategoryId, name: item.name, description: item.description })}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </>
        )}
      </section>
    </section>
  );
}
