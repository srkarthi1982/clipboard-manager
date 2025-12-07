/**
 * Clipboard Manager - store and organize frequently used snippets.
 *
 * Design goals:
 * - Maintain a history of copied items.
 * - Allow users to create collections/folders of saved snippets.
 * - Ready for multi-device sync metadata.
 */

import { defineTable, column, NOW } from "astro:db";

export const ClipboardItems = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),

    contentType: column.text({ optional: true }),      // "text", "url", "html", "json"
    content: column.text(),                            // actual clipboard content
    normalizedPreview: column.text({ optional: true }),// truncated / cleaned preview

    sourceApp: column.text({ optional: true }),        // e.g. "Chrome", "VS Code"
    sourceDevice: column.text({ optional: true }),     // device label
    isPinned: column.boolean({ default: false }),
    isArchived: column.boolean({ default: false }),

    createdAt: column.date({ default: NOW }),          // first seen
    lastCopiedAt: column.date({ optional: true }),     // last time user reused/copied it
  },
});

export const ClipboardCollections = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),
    name: column.text(),                               // "Work snippets", "Replies"
    description: column.text({ optional: true }),
    icon: column.text({ optional: true }),             // emoji/icon code
    isDefault: column.boolean({ default: false }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const ClipboardCollectionItems = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    collectionId: column.text({
      references: () => ClipboardCollections.columns.id,
    }),
    itemId: column.text({
      references: () => ClipboardItems.columns.id,
    }),
    addedAt: column.date({ default: NOW }),
  },
});

export const tables = {
  ClipboardItems,
  ClipboardCollections,
  ClipboardCollectionItems,
} as const;
