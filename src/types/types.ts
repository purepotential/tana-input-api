import { z } from 'zod';

const dataType = z.enum(['plain', 'boolean', 'date', 'url', 'reference']);
const idType = z
  .string()
  .min(7)
  .max(16)
  .regex(/^[A-Za-z0-9_-]+$/);

const fieldBase = z.object({
  type: z.literal('field'),
  attributeId: idType,
});

const plainNodeBase = z.object({
  type: z.literal('node').optional(),
  dataType: dataType.exclude(['boolean', 'date', 'reference']).optional(),
  name: z.string(),
  description: z.string().optional().or(z.literal('')),
  supertags: z.array(z.object({ id: idType })).optional(),
});

const checkboxNode = z.object({
  type: z.literal('node').optional(),
  dataType: z.literal('boolean'),
  value: z.boolean(),
});

const dateNode = z.object({
  type: z.literal('node').optional(),
  dataType: z.literal('date'),
  name: z.string(),
});

const referenceNode = z.object({
  type: z.literal('node').optional(),
  dataType: z.literal('reference'),
  id: idType,
});

const fileNode = z.object({
  type: z.literal('node').optional(),
  dataType: z.literal('file'),
  file: z.string(),
  contentType: z.string(),
  filename: z.string(),
});

export type APIPlainNode = z.infer<typeof plainNodeBase> & {
  children?: z.infer<typeof nodeOrField>[];
};

const plainNode: z.ZodType<APIPlainNode> = plainNodeBase.extend({
  children: z.lazy(() => z.array(nodeOrField)).optional(),
});

export type APIField = z.infer<typeof fieldBase> & {
  children?: z.infer<typeof fieldChild>[];
};

const field: z.ZodType<APIField> = fieldBase.extend({
  children: z.lazy(() => z.array(fieldChild)).optional(),
});

const node = z.union([plainNode, dateNode, referenceNode, fileNode]);

const fieldChild = z.union([node, checkboxNode]);
const nodeOrField = z.union([field, node]);

export const APISchema = z.array(node);

export type APIDataType = z.infer<typeof dataType>;
export type APICheckboxNode = z.infer<typeof checkboxNode>;
export type APIDateNode = z.infer<typeof dateNode>;
export type APIReferenceNode = z.infer<typeof referenceNode>;
export type APIFileNode = z.infer<typeof fileNode>;
export type APINode = APIPlainNode | APIDateNode | APIReferenceNode | APIFileNode;
export type APIFieldValue = APINode | APICheckboxNode | APIFileNode;

export type TanaNode = {
  nodeId?: string;
  name: string;
  description: string;
  children?: TanaNode[];
};

export type Article = {
  name: string;
  description?: string;
  supertags: [{
    /* Article */
    id: 'Jv6WSsH6CO7u'
  }];
  children: [
    {
      /* Bookmark ID */
      type: 'field',
      attributeId: '1IJSCbcJ-4x6',
      children: APIFieldValue[]
    },
    {
      /* Title */
      type: 'field',
      attributeId: 'TAuNkyKd4gv4',
      children: APIFieldValue[]
    },
    {
      /* Description */
      type: 'field',
      attributeId: 'kmEPGZ9RM0hA',
      children: APIFieldValue[]
    },
    {
      /* AI Tags */
      type: 'field',
      attributeId: 'aosg60mUhj0s',
      children: APIFieldValue[]
    },
    {
      /* Created */
      type: 'field',
      attributeId: 'hrTDjcwTMcyo',
      children: [{
        type: 'node',
        dataType: 'date',
        name: string
      }]
    },
    {
      /* Source URL */
      type: 'field',
      attributeId: '1Q0LdvnE7q7a',
      children: [{
        type: 'node',
        dataType: 'url',
        name: string
      }]
    },
    {
      /* Archive ID */
      type: 'field',
      attributeId: 'zENeYHbvA6f4',
      children: APIFieldValue[]
    },
    {
      /* Archive URL */
      type: 'field',
      attributeId: 'jO0i0yhryT7J',
      children: [{
        type: 'node',
        dataType: 'url',
        name: string
      }]
    }
  ]
};
