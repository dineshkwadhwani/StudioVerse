export type CategoryRecord = {
  id: string;
  tenantId: string;
  tenantName?: string;
  name: string;
  description: string;
  createdBy?: string;
  updatedBy?: string;
};

export type SubCategoryRecord = {
  id: string;
  tenantId: string;
  tenantName?: string;
  categoryId: string;
  categoryName?: string;
  name: string;
  description: string;
  createdBy?: string;
  updatedBy?: string;
};

export type TopicRecord = {
  id: string;
  tenantId: string;
  tenantName?: string;
  categoryId: string;
  categoryName?: string;
  subCategoryId: string;
  subCategoryName?: string;
  name: string;
  description: string;
  createdBy?: string;
  updatedBy?: string;
};

// Nested structure for single-document storage
export type TopicNested = {
  id: string;
  name: string;
  description: string;
};

export type SubCategoryNested = {
  id: string;
  name: string;
  description?: string;
  topics: TopicNested[];
};

export type CategoryRecordNested = {
  id: string;
  tenantId: string;
  tenantName?: string;
  name: string;
  description: string;
  subCategories: SubCategoryNested[];
  createdBy?: string;
  updatedBy?: string;
  createdAt?: any;
  updatedAt?: any;
};

export type CategoryFormValues = {
  id?: string;
  tenantId: string;
  name: string;
  description: string;
};

export type SubCategoryFormValues = {
  id?: string;
  tenantId: string;
  categoryId: string;
  name: string;
  description: string;
};

export const EMPTY_CATEGORY_FORM: CategoryFormValues = {
  tenantId: "",
  name: "",
  description: "",
};

export const EMPTY_SUB_CATEGORY_FORM: SubCategoryFormValues = {
  tenantId: "",
  categoryId: "",
  name: "",
  description: "",
};

export type TopicFormValues = {
  id?: string;
  tenantId: string;
  categoryId: string;
  subCategoryId: string;
  name: string;
  description: string;
};

export const EMPTY_TOPIC_FORM: TopicFormValues = {
  tenantId: "",
  categoryId: "",
  subCategoryId: "",
  name: "",
  description: "",
};
