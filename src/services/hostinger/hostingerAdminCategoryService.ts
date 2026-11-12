import type { Category } from "../../types/category";

const API_BASE = (import.meta.env.VITE_HOSTINGER_API_BASE_URL || (import.meta.env.DEV ? "/api" : "https://lavender-goldfish-844589.hostingersite.com/api")).replace(/\/+$/, "");
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { ...init, credentials: "include", headers: { Accept: "application/json", "Content-Type": "application/json", ...init.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : `Request failed (${response.status}).`);
  return body as T;
}
export const hostingerAdminCategoryService = {
  getAll: () => request<{ categories: Category[] }>("/admin/categories"),
  create: (category: Partial<Category> & { name: string }) => request<{ category: Category }>("/admin/categories", { method: "POST", body: JSON.stringify(category) }),
  update: (id: string, category: Partial<Category>) => request<{ category: Category }>(`/admin/categories/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(category) }),
  remove: (id: string) => request<{ success: boolean }>(`/admin/categories/${encodeURIComponent(id)}`, { method: "DELETE" }),
  reorder: (ids: string[]) => request<{ success: boolean }>("/admin/categories/reorder", { method: "PUT", body: JSON.stringify({ ids }) })
};
