import { apiFetch } from './api';
import { AuditDoc } from './auditDocs.service';

export interface DocGroup {
  id: number;
  name: string;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  documentCount: number;
}

export interface DocGroupDocument extends AuditDoc {
  addedBy: string | null;
  addedAt: string;
}

export const docGroupsService = {
  getAll: (): Promise<DocGroup[]> =>
    apiFetch<DocGroup[]>('/api/doc-groups'),

  create: (name: string, description?: string): Promise<DocGroup> =>
    apiFetch<DocGroup>('/api/doc-groups', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    }),

  update: (id: number, name: string, description?: string): Promise<DocGroup> =>
    apiFetch<DocGroup>(`/api/doc-groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, description }),
    }),

  delete: (id: number): Promise<void> =>
    apiFetch<void>(`/api/doc-groups/${id}`, { method: 'DELETE' }),

  getDocuments: (groupId: number): Promise<DocGroupDocument[]> =>
    apiFetch<DocGroupDocument[]>(`/api/doc-groups/${groupId}/documents`),

  addMembers: (groupId: number, documentIds: number[]): Promise<{ added: number; skipped: number }> =>
    apiFetch(`/api/doc-groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ documentIds }),
    }),

  removeMember: (groupId: number, docId: number): Promise<void> =>
    apiFetch<void>(`/api/doc-groups/${groupId}/members/${docId}`, { method: 'DELETE' }),

  getGroupsByDocument: (docId: number): Promise<DocGroup[]> =>
    apiFetch<DocGroup[]>(`/api/doc-groups/by-document/${docId}`),
};
