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
