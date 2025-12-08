import { defineAction, ActionError, type ActionAPIContext } from "astro:actions";
import { z } from "astro:schema";
import {
  ClipboardCollectionItems,
  ClipboardCollections,
  ClipboardItems,
  and,
  db,
  eq,
  inArray,
} from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

async function getOwnedCollection(collectionId: string, userId: string) {
  const [collection] = await db
    .select()
    .from(ClipboardCollections)
    .where(and(eq(ClipboardCollections.id, collectionId), eq(ClipboardCollections.userId, userId)));

  if (!collection) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Collection not found.",
    });
  }

  return collection;
}

async function getOwnedItem(itemId: string, userId: string) {
  const [item] = await db
    .select()
    .from(ClipboardItems)
    .where(and(eq(ClipboardItems.id, itemId), eq(ClipboardItems.userId, userId)));

  if (!item) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Clipboard item not found.",
    });
  }

  return item;
}

export const server = {
  createClipboardItem: defineAction({
    input: z.object({
      contentType: z.string().optional(),
      content: z.string().min(1),
      normalizedPreview: z.string().optional(),
      sourceApp: z.string().optional(),
      sourceDevice: z.string().optional(),
      isPinned: z.boolean().optional(),
      isArchived: z.boolean().optional(),
      lastCopiedAt: z.date().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();

      const [item] = await db
        .insert(ClipboardItems)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          contentType: input.contentType,
          content: input.content,
          normalizedPreview: input.normalizedPreview,
          sourceApp: input.sourceApp,
          sourceDevice: input.sourceDevice,
          isPinned: input.isPinned ?? false,
          isArchived: input.isArchived ?? false,
          createdAt: now,
          lastCopiedAt: input.lastCopiedAt,
        })
        .returning();

      return { success: true, data: { item } };
    },
  }),

  updateClipboardItem: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        contentType: z.string().optional(),
        content: z.string().optional(),
        normalizedPreview: z.string().optional(),
        sourceApp: z.string().optional(),
        sourceDevice: z.string().optional(),
        isPinned: z.boolean().optional(),
        isArchived: z.boolean().optional(),
        lastCopiedAt: z.date().optional(),
      })
      .refine(
        (input) =>
          input.contentType !== undefined ||
          input.content !== undefined ||
          input.normalizedPreview !== undefined ||
          input.sourceApp !== undefined ||
          input.sourceDevice !== undefined ||
          input.isPinned !== undefined ||
          input.isArchived !== undefined ||
          input.lastCopiedAt !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedItem(input.id, user.id);

      const [item] = await db
        .update(ClipboardItems)
        .set({
          ...(input.contentType !== undefined ? { contentType: input.contentType } : {}),
          ...(input.content !== undefined ? { content: input.content } : {}),
          ...(input.normalizedPreview !== undefined
            ? { normalizedPreview: input.normalizedPreview }
            : {}),
          ...(input.sourceApp !== undefined ? { sourceApp: input.sourceApp } : {}),
          ...(input.sourceDevice !== undefined ? { sourceDevice: input.sourceDevice } : {}),
          ...(input.isPinned !== undefined ? { isPinned: input.isPinned } : {}),
          ...(input.isArchived !== undefined ? { isArchived: input.isArchived } : {}),
          ...(input.lastCopiedAt !== undefined ? { lastCopiedAt: input.lastCopiedAt } : {}),
        })
        .where(eq(ClipboardItems.id, input.id))
        .returning();

      return { success: true, data: { item } };
    },
  }),

  listClipboardItems: defineAction({
    input: z.object({
      includeArchived: z.boolean().default(false),
      pinnedOnly: z.boolean().default(false),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const filters = [eq(ClipboardItems.userId, user.id)];
      if (!input.includeArchived) {
        filters.push(eq(ClipboardItems.isArchived, false));
      }
      if (input.pinnedOnly) {
        filters.push(eq(ClipboardItems.isPinned, true));
      }

      const items = await db.select().from(ClipboardItems).where(and(...filters));

      return { success: true, data: { items, total: items.length } };
    },
  }),

  createCollection: defineAction({
    input: z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      icon: z.string().optional(),
      isDefault: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();

      const [collection] = await db
        .insert(ClipboardCollections)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          name: input.name,
          description: input.description,
          icon: input.icon,
          isDefault: input.isDefault ?? false,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return { success: true, data: { collection } };
    },
  }),

  updateCollection: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        isDefault: z.boolean().optional(),
      })
      .refine(
        (input) =>
          input.name !== undefined ||
          input.description !== undefined ||
          input.icon !== undefined ||
          input.isDefault !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedCollection(input.id, user.id);

      const [collection] = await db
        .update(ClipboardCollections)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.icon !== undefined ? { icon: input.icon } : {}),
          ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
          updatedAt: new Date(),
        })
        .where(eq(ClipboardCollections.id, input.id))
        .returning();

      return { success: true, data: { collection } };
    },
  }),

  listCollections: defineAction({
    input: z.object({}).optional(),
    handler: async (_input, context) => {
      const user = requireUser(context);

      const collections = await db
        .select()
        .from(ClipboardCollections)
        .where(eq(ClipboardCollections.userId, user.id));

      return { success: true, data: { items: collections, total: collections.length } };
    },
  }),

  addItemToCollection: defineAction({
    input: z.object({
      collectionId: z.string().min(1),
      itemId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedCollection(input.collectionId, user.id);
      await getOwnedItem(input.itemId, user.id);

      const [link] = await db
        .insert(ClipboardCollectionItems)
        .values({
          id: crypto.randomUUID(),
          collectionId: input.collectionId,
          itemId: input.itemId,
          addedAt: new Date(),
        })
        .returning();

      return { success: true, data: { link } };
    },
  }),

  removeItemFromCollection: defineAction({
    input: z.object({
      collectionId: z.string().min(1),
      itemId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedCollection(input.collectionId, user.id);
      await getOwnedItem(input.itemId, user.id);

      const result = await db
        .delete(ClipboardCollectionItems)
        .where(
          and(
            eq(ClipboardCollectionItems.collectionId, input.collectionId),
            eq(ClipboardCollectionItems.itemId, input.itemId)
          )
        );

      if (result.rowsAffected === 0) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Link not found.",
        });
      }

      return { success: true };
    },
  }),

  listCollectionItems: defineAction({
    input: z.object({
      collectionId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedCollection(input.collectionId, user.id);

      const links = await db
        .select()
        .from(ClipboardCollectionItems)
        .where(eq(ClipboardCollectionItems.collectionId, input.collectionId));

      const itemIds = links.map((link) => link.itemId);
      if (itemIds.length === 0) {
        return { success: true, data: { items: [], total: 0 } };
      }

      const items = await db
        .select()
        .from(ClipboardItems)
        .where(inArray(ClipboardItems.id, itemIds));

      return { success: true, data: { items, total: items.length } };
    },
  }),
};
