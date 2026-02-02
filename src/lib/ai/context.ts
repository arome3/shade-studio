/**
 * Context Builder for AI Chat
 *
 * Assembles relevant context from user documents and project metadata
 * to provide the AI with useful background information. Handles token
 * limits through intelligent selection and truncation.
 */

import type { Project } from '@/types/project';

/** Document representation for context building */
export interface ContextDocument {
  id: string;
  title: string;
  type: string;
  content: string;
  updatedAt?: string;
}

/** Built context result */
export interface BuiltContext {
  /** Full context string to include in system prompt */
  contextString: string;
  /** Documents included in context */
  includedDocuments: string[];
  /** Documents excluded due to limits */
  excludedDocuments: string[];
  /** Estimated token count */
  estimatedTokens: number;
  /** Whether context was truncated */
  wasTruncated: boolean;
}

/** Context building options */
export interface ContextBuildOptions {
  /** Maximum tokens for context (default: 4000) */
  maxTokens?: number;
  /** User query for relevance scoring */
  query?: string;
  /** Include project metadata */
  includeProjectMetadata?: boolean;
  /** Include document summaries for excluded docs */
  includeSummaries?: boolean;
}

/** Default options */
const DEFAULT_OPTIONS: Required<ContextBuildOptions> = {
  maxTokens: 4000,
  query: '',
  includeProjectMetadata: true,
  includeSummaries: true,
};

/**
 * Estimate token count from text
 *
 * Uses a simple heuristic: ~4 characters per token on average.
 * This is approximate but sufficient for context management.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Average English word is ~5 chars, average token is ~4 chars
  // This gives roughly 1.25 tokens per word, which is reasonable
  return Math.ceil(text.length / 4);
}

/**
 * Calculate relevance score for a document against a query
 *
 * Simple keyword-based scoring. Returns a score from 0-1.
 */
export function calculateRelevanceScore(
  document: ContextDocument,
  query: string
): number {
  if (!query || !query.trim()) {
    // Without a query, prefer recently updated documents
    return 0.5;
  }

  const queryLower = query.toLowerCase();
  const keywords = queryLower.split(/\s+/).filter((k) => k.length > 2);

  if (keywords.length === 0) return 0.5;

  const textToSearch = `${document.title} ${document.content}`.toLowerCase();

  let matches = 0;
  for (const keyword of keywords) {
    if (textToSearch.includes(keyword)) {
      matches++;
    }
  }

  // Score is percentage of keywords found, with title matches weighted higher
  const titleLower = document.title.toLowerCase();
  const titleBonus = keywords.some((k) => titleLower.includes(k)) ? 0.2 : 0;

  return Math.min(1, (matches / keywords.length) + titleBonus);
}

/**
 * Select most relevant documents within token limit
 *
 * Ranks documents by relevance and selects as many as fit
 * within the token budget.
 */
export function selectRelevantDocuments(
  documents: ContextDocument[],
  options: ContextBuildOptions = {}
): { selected: ContextDocument[]; excluded: ContextDocument[] } {
  const { maxTokens = DEFAULT_OPTIONS.maxTokens, query = '' } = options;

  // Score and sort documents by relevance
  const scoredDocs = documents.map((doc) => ({
    doc,
    score: calculateRelevanceScore(doc, query),
    tokens: estimateTokens(doc.content),
  }));

  scoredDocs.sort((a, b) => b.score - a.score);

  // Select documents that fit within token budget
  const selected: ContextDocument[] = [];
  const excluded: ContextDocument[] = [];
  let totalTokens = 0;

  for (const { doc, tokens } of scoredDocs) {
    if (totalTokens + tokens <= maxTokens) {
      selected.push(doc);
      totalTokens += tokens;
    } else {
      excluded.push(doc);
    }
  }

  return { selected, excluded };
}

/**
 * Create a summary of documents for context
 *
 * When documents are too large to include fully, provide a summary
 * with titles and types so the AI knows what's available.
 */
export function summarizeDocuments(documents: ContextDocument[]): string {
  if (documents.length === 0) return '';

  const lines = documents.map((doc) => {
    const updated = doc.updatedAt
      ? ` (updated: ${new Date(doc.updatedAt).toLocaleDateString()})`
      : '';
    return `- ${doc.title} [${doc.type}]${updated}`;
  });

  return `Additional documents available but not included due to length:\n${lines.join('\n')}`;
}

/**
 * Format project metadata for context
 */
export function formatProjectMetadata(project: Partial<Project>): string {
  const parts: string[] = [];

  if (project.metadata?.name) {
    parts.push(`**Project:** ${project.metadata.name}`);
  }
  if (project.metadata?.description) {
    parts.push(`**Description:** ${project.metadata.description}`);
  }
  if (project.metadata?.grantProgram) {
    parts.push(`**Grant Program:** ${project.metadata.grantProgram}`);
  }
  if (project.metadata?.fundingAmount) {
    parts.push(`**Funding Amount:** $${project.metadata.fundingAmount.toLocaleString()}`);
  }
  if (project.team?.length) {
    parts.push(`**Team Size:** ${project.team.length} members`);
  }

  return parts.join('\n');
}

/**
 * Build context from documents and project metadata
 *
 * Main function for assembling AI context. Selects relevant documents,
 * includes project metadata, and manages token limits.
 */
export function buildContext(
  documents: ContextDocument[],
  project?: Partial<Project>,
  options: ContextBuildOptions = {}
): BuiltContext {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const { maxTokens, includeProjectMetadata, includeSummaries } = mergedOptions;

  const contextParts: string[] = [];
  let usedTokens = 0;

  // Add project metadata first (usually small)
  if (includeProjectMetadata && project) {
    const projectContext = formatProjectMetadata(project);
    if (projectContext) {
      const projectSection = `## Project Context\n${projectContext}`;
      const projectTokens = estimateTokens(projectSection);

      if (usedTokens + projectTokens <= maxTokens) {
        contextParts.push(projectSection);
        usedTokens += projectTokens;
      }
    }
  }

  // Calculate remaining token budget for documents
  const documentBudget = maxTokens - usedTokens - 200; // Reserve 200 for summaries

  // Select relevant documents
  const { selected, excluded } = selectRelevantDocuments(documents, {
    ...mergedOptions,
    maxTokens: documentBudget,
  });

  // Add selected documents
  if (selected.length > 0) {
    const docSection = selected.map((doc) => {
      return `### ${doc.title}\n**Type:** ${doc.type}\n\n${doc.content}`;
    }).join('\n\n---\n\n');

    const fullDocSection = `## Reference Documents\n\n${docSection}`;
    contextParts.push(fullDocSection);
    usedTokens += estimateTokens(fullDocSection);
  }

  // Add summaries for excluded documents
  if (includeSummaries && excluded.length > 0) {
    const summarySection = summarizeDocuments(excluded);
    if (summarySection) {
      contextParts.push(`\n${summarySection}`);
      usedTokens += estimateTokens(summarySection);
    }
  }

  const contextString = contextParts.join('\n\n');

  return {
    contextString,
    includedDocuments: selected.map((d) => d.id),
    excludedDocuments: excluded.map((d) => d.id),
    estimatedTokens: usedTokens,
    wasTruncated: excluded.length > 0,
  };
}

/**
 * Truncate content to fit within token limit
 *
 * Preserves beginning and end of content for context continuity.
 */
export function truncateContent(
  content: string,
  maxTokens: number
): { content: string; wasTruncated: boolean } {
  const currentTokens = estimateTokens(content);

  if (currentTokens <= maxTokens) {
    return { content, wasTruncated: false };
  }

  // Calculate how many characters to keep
  const maxChars = maxTokens * 4;
  const keepStart = Math.floor(maxChars * 0.7); // 70% from start
  const keepEnd = Math.floor(maxChars * 0.25); // 25% from end
  // 5% for truncation indicator

  const truncated = `${content.slice(0, keepStart)}\n\n[... content truncated for length ...]\n\n${content.slice(-keepEnd)}`;

  return { content: truncated, wasTruncated: true };
}

/**
 * Extract key sections from document content
 *
 * Attempts to identify and extract important sections like
 * executive summary, objectives, budget, etc.
 */
export function extractKeySections(content: string): Map<string, string> {
  const sections = new Map<string, string>();

  // Common section headers in grant proposals
  const sectionPatterns = [
    /(?:^|\n)#+\s*(executive\s+summary|abstract|overview)[:\s]*\n([\s\S]*?)(?=\n#+\s|\n---|\Z)/i,
    /(?:^|\n)#+\s*(objectives?|goals?)[:\s]*\n([\s\S]*?)(?=\n#+\s|\n---|\Z)/i,
    /(?:^|\n)#+\s*(methodology|approach)[:\s]*\n([\s\S]*?)(?=\n#+\s|\n---|\Z)/i,
    /(?:^|\n)#+\s*(budget|funding)[:\s]*\n([\s\S]*?)(?=\n#+\s|\n---|\Z)/i,
    /(?:^|\n)#+\s*(timeline|milestones?|schedule)[:\s]*\n([\s\S]*?)(?=\n#+\s|\n---|\Z)/i,
    /(?:^|\n)#+\s*(team|personnel)[:\s]*\n([\s\S]*?)(?=\n#+\s|\n---|\Z)/i,
  ];

  for (const pattern of sectionPatterns) {
    const match = content.match(pattern);
    if (match && match[1] && match[2]) {
      const sectionName = match[1].toLowerCase().trim();
      const sectionContent = match[2].trim();
      sections.set(sectionName, sectionContent);
    }
  }

  return sections;
}
