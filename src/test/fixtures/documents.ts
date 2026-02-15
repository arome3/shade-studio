/**
 * Document test fixtures.
 *
 * Factory functions for creating Document, DocumentContent, and
 * DocumentMetadata shapes with sensible defaults and easy overrides.
 */

import type {
  Document,
  DocumentContent,
  DocumentMetadata,
  DocumentType,
  DocumentStatus,
} from '@/types/document';

let fixtureCounter = 0;

export function createMockDocumentMetadata(
  overrides?: Partial<DocumentMetadata>
): DocumentMetadata {
  const id = ++fixtureCounter;
  return {
    title: `Test Document ${id}`,
    type: 'proposal' as DocumentType,
    summary: `Summary for test document ${id}`,
    tags: ['test', 'fixture'],
    wordCount: 150,
    ...overrides,
  };
}

export function createMockDocumentContent(
  overrides?: Partial<DocumentContent>
): DocumentContent {
  return {
    body: '# Test Document\n\nThis is a test document body with some content.',
    sections: [
      {
        id: 'section-1',
        title: 'Introduction',
        content: 'This is the introduction section.',
        order: 0,
      },
    ],
    attachments: [],
    ...overrides,
  };
}

export function createMockDocument(overrides?: Partial<Document>): Document {
  const id = `doc-${++fixtureCounter}`;
  const now = new Date().toISOString();

  return {
    id,
    projectId: 'project-1',
    ownerId: 'test.near',
    metadata: createMockDocumentMetadata(),
    content: createMockDocumentContent(),
    status: 'draft' as DocumentStatus,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Reset the fixture counter (call in beforeEach for deterministic IDs).
 */
export function resetDocumentFixtures() {
  fixtureCounter = 0;
}
